#!/usr/bin/env node
// Post-build guard: fail the deploy when the built site breaks SEO basics or
// its own links.
//
// Runs against the Jekyll output after `jekyll build` and before the Pages
// upload in .github/workflows/pages.yml, so a non-zero exit stops the deploy.
//
//   robots.txt     present, doesn't disallow / for all agents, names the sitemap
//   sitemap.xml    present; every <loc> on https://taxy.au/ and built; the
//                  homepage and the CGT calculator listed
//   sitemap pages  no robots noindex; exactly one canonical, equal to the page's
//                  own sitemap URL; a <title>; a meta description; any og:image
//                  or twitter:image an absolute https://taxy.au URL that is built
//   CNAME          is taxy.au
//   internal links every internal href/src/srcset/poster on every built page
//                  resolves to a built file, and every #fragment to an id on the
//                  target page
//
// Redirect stubs (redirect_to / redirect_from) and noindex pages are fine as long
// as they stay out of the sitemap. Their links are still checked, which is what
// catches a stub pointing at a homepage anchor that no longer exists.
//
// URLs resolve the way GitHub Pages serves them: /x/ -> x/index.html, and /x ->
// x, x.html or x/index.html. Matching is case-sensitive, as it is in production.
//
// Usage:   node script/check-site.mjs [site-dir]      (default: _site)
// Exit:    0 all checks pass, 1 any check fails or the site dir is missing.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = resolve(process.argv[2] || join(ROOT, "_site"));

const ORIGIN = "https://taxy.au";
const DOMAIN = "taxy.au";
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
const INTERNAL_HOSTS = new Set(["taxy.au", "www.taxy.au"]);
const REQUIRED_IN_SITEMAP = [`${ORIGIN}/`, `${ORIGIN}/tools/cgt-discount-calculator/`];

if (!existsSync(SITE)) {
  console.error(`check-site: ${SITE} not found. Build first: JEKYLL_ENV=production bundle exec jekyll build`);
  process.exit(1);
}

// ---------------------------------------------------------------- the build

/** Every file in the build, as a site-relative path with "/" separators. */
const files = new Set();
(function walk(dir, prefix) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix + e.name;
    if (e.isDirectory()) walk(join(dir, e.name), rel + "/");
    else files.add(rel);
  }
})(SITE, "");

const read = (rel) => readFileSync(join(SITE, rel), "utf8");
const isHtml = (rel) => rel.endsWith(".html");

/** The URL a built file is served at: x/index.html -> /x/, anything else as-is. */
function urlFor(rel) {
  const path = rel === "index.html" ? "" : rel.endsWith("/index.html") ? rel.slice(0, -10) : rel;
  return `${ORIGIN}/${encodeURI(path)}`;
}

/** The built file a URL path is served from, or null. Mirrors GitHub Pages. */
function fileFor(pathname) {
  let p;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    p = pathname;
  }
  const rel = p.replace(/^\/+/, "");
  const candidates = rel === "" || rel.endsWith("/") ? [rel + "index.html"] : [rel, `${rel}.html`, `${rel}/index.html`];
  return candidates.find((c) => files.has(c)) ?? null;
}

// ---------------------------------------------------------------- HTML

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…" };
function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e) => {
    if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? m;
    const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
  });
}

// A start tag, with quoted attribute values allowed to contain ">".
const TAG = /<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*\/?>/g;
const ATTR = /([^\s"'>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const parsed = new Map();
/** Tags (name + decoded attributes), <title> texts and fragment targets of a built page. */
function parse(rel) {
  if (parsed.has(rel)) return parsed.get(rel);
  // Drop comments and script/style bodies so markup inside them isn't read as tags.
  const html = read(rel)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2\s*>/gi, "$1</$2>");
  const tags = [];
  for (const m of html.matchAll(TAG)) {
    const attrs = {};
    for (const a of (m[2] || "").matchAll(ATTR)) {
      const name = a[1].toLowerCase();
      if (!(name in attrs)) attrs[name] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
    }
    tags.push({ name: m[1].toLowerCase(), attrs });
  }
  const titles = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/gi)].map((t) => decodeEntities(t[1]).trim());
  const ids = new Set();
  for (const t of tags) {
    if (t.attrs.id) ids.add(t.attrs.id);
    if (t.name === "a" && t.attrs.name) ids.add(t.attrs.name); // legacy <a name> anchors
  }
  const page = { tags, titles, ids };
  parsed.set(rel, page);
  return page;
}

const meta = (page, key) =>
  page.tags.filter((t) => t.name === "meta" && [t.attrs.name, t.attrs.property].some((v) => v?.toLowerCase() === key));
const relTokens = (t) => (t.attrs.rel || "").toLowerCase().split(/\s+/);

// ---------------------------------------------------------------- failures

const failures = new Map(); // section -> messages
const fail = (section, message) => {
  if (!failures.has(section)) failures.set(section, []);
  failures.get(section).push(message);
};

// ---------------------------------------------------------------- robots.txt

function checkRobots() {
  const S = "robots.txt";
  if (!files.has("robots.txt")) return fail(S, "missing from the build");
  let agents = [];
  let inRules = false;
  const sitemaps = [];
  for (const raw of read("robots.txt").split(/\r?\n/)) {
    const m = raw.replace(/#.*/, "").match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2];
    if (key === "user-agent") {
      if (inRules) {
        agents = []; // a User-agent line after rules starts a new group
        inRules = false;
      }
      agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      inRules = true;
      if (key === "disallow" && agents.includes("*") && ["/", "/*"].includes(value))
        fail(S, `"Disallow: ${value}" for User-agent: * blocks the whole site`);
    } else if (key === "sitemap") {
      sitemaps.push(value);
    }
  }
  if (!sitemaps.includes(SITEMAP_URL)) fail(S, `no "Sitemap: ${SITEMAP_URL}" line`);
}

// ---------------------------------------------------------------- sitemap

/** Sitemap URLs that resolve to a built HTML page: [{ loc, rel }]. */
function checkSitemap() {
  const S = "sitemap.xml";
  if (!files.has("sitemap.xml")) {
    fail(S, "missing from the build");
    return [];
  }
  const locs = [...read("sitemap.xml").matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/g)].map((m) => decodeEntities(m[1]));
  const pages = [];
  for (const loc of locs) {
    if (!loc.startsWith(`${ORIGIN}/`)) {
      fail(S, `${loc}: not on ${ORIGIN}/`);
      continue;
    }
    const rel = fileFor(new URL(loc).pathname);
    if (!rel) fail(S, `${loc}: no built page`);
    else if (isHtml(rel)) pages.push({ loc, rel });
  }
  for (const url of REQUIRED_IN_SITEMAP) if (!locs.includes(url)) fail(S, `${url} is not listed`);
  return pages;
}

function checkSitemapPage({ loc, rel }) {
  const S = "Sitemap pages (must be indexable)";
  const page = parse(rel);
  const where = `${loc} (${rel})`;

  for (const t of [...meta(page, "robots"), ...meta(page, "googlebot")]) {
    if (/\b(noindex|none)\b/i.test(t.attrs.content || ""))
      fail(S, `${where}: robots meta "${t.attrs.content}" — a sitemap page must be indexable (drop noindex, or set sitemap: false)`);
  }

  const canon = page.tags.filter((t) => t.name === "link" && relTokens(t).includes("canonical"));
  if (canon.length === 0) fail(S, `${where}: no <link rel="canonical">`);
  else if (canon.length > 1) fail(S, `${where}: ${canon.length} canonical links (${canon.map((t) => t.attrs.href).join(", ")})`);
  else if (canon[0].attrs.href !== loc) fail(S, `${where}: canonical is "${canon[0].attrs.href}", expected "${loc}"`);

  if (!page.titles.some(Boolean)) fail(S, `${where}: no <title>`);

  if (!meta(page, "description").some((t) => (t.attrs.content || "").trim()))
    fail(S, `${where}: no meta description`);

  for (const key of ["og:image", "twitter:image"]) {
    for (const t of meta(page, key)) {
      const img = (t.attrs.content || "").trim();
      if (!img.startsWith(`${ORIGIN}/`)) fail(S, `${where}: ${key} "${img}" is not an absolute ${ORIGIN}/ URL`);
      else if (!fileFor(new URL(img).pathname)) fail(S, `${where}: ${key} "${img}" — no such file in the build`);
    }
  }
}

// ---------------------------------------------------------------- CNAME

function checkCname() {
  if (!files.has("CNAME")) return fail("CNAME", "missing from the build");
  const value = read("CNAME").trim();
  if (value !== DOMAIN) fail("CNAME", `is "${value}", expected "${DOMAIN}"`);
}

// ---------------------------------------------------------------- internal links

const SKIP_SCHEME = /^(mailto|tel|sms|javascript|data|blob|about):/i;

/** Every URL-bearing attribute value on a page. */
function linksOf(page) {
  const out = [];
  for (const t of page.tags) {
    for (const attr of ["href", "src", "poster"]) if (t.attrs[attr] !== undefined) out.push(t.attrs[attr]);
    if (t.attrs.srcset) for (const c of t.attrs.srcset.split(",")) out.push(c.trim().split(/\s+/)[0]);
  }
  return out.map((v) => v.trim()).filter(Boolean);
}

function checkInternalLinks() {
  const broken = new Map(); // problem -> Set(source page URLs)
  let count = 0;
  const html = [...files].filter(isHtml).sort();
  for (const rel of html) {
    const base = urlFor(rel);
    for (const raw of linksOf(parse(rel))) {
      if (SKIP_SCHEME.test(raw)) continue;
      let u;
      try {
        u = new URL(raw, base);
      } catch {
        add(broken, `"${raw}" — not a valid URL`, base);
        continue;
      }
      if (!/^https?:$/.test(u.protocol) || !INTERNAL_HOSTS.has(u.hostname)) continue;
      count++;
      const target = fileFor(u.pathname);
      if (!target) {
        add(broken, `"${raw}" — nothing is built at ${u.pathname}`, base);
        continue;
      }
      let frag = u.hash.slice(1);
      try {
        frag = decodeURIComponent(frag);
      } catch {}
      // "#top" scrolls to the top with or without an element (HTML spec); ":~:" is a text fragment.
      if (!frag || !isHtml(target) || frag.toLowerCase() === "top" || frag.startsWith(":~:")) continue;
      if (!parse(target).ids.has(frag)) add(broken, `"${raw}" — no id="${frag}" on ${urlFor(target)} (${target})`, base);
    }
  }
  for (const [problem, sources] of broken) {
    const list = [...sources].map((s) => s.slice(ORIGIN.length));
    const shown = list.slice(0, 5).join(", ") + (list.length > 5 ? `, … (+${list.length - 5} more)` : "");
    fail("Internal links", `${problem}\n      on ${list.length} page${list.length > 1 ? "s" : ""}: ${shown}`);
  }
  return { pages: html.length, links: count };
}

function add(map, key, source) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(source);
}

// ---------------------------------------------------------------- run

checkRobots();
const sitemapPages = checkSitemap();
for (const p of sitemapPages) checkSitemapPage(p);
checkCname();
const { pages, links } = checkInternalLinks();

const total = [...failures.values()].reduce((n, l) => n + l.length, 0);
if (total === 0) {
  console.log(
    `check-site: OK — robots.txt, sitemap (${sitemapPages.length} pages), CNAME, ` +
      `${links} internal links across ${pages} built pages (${SITE})`,
  );
  process.exit(0);
}

console.error(`check-site: ${total} problem${total > 1 ? "s" : ""} in ${SITE}\n`);
for (const [section, messages] of failures) {
  console.error(section);
  for (const m of messages) console.error(`  ✗ ${m}`);
  console.error("");
}
console.error("Fix these before deploying. The checks are described at the top of script/check-site.mjs.");
process.exit(1);
