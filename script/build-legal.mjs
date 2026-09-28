#!/usr/bin/env node
// Regenerate the published legal/policy pages from their source of truth.
//
// The .md docs in taxy-ops/legal/ are the single source of truth (see that
// repo's README). This script lifts each one onto the site verbatim: it strips
// the non-rendering <!-- … --> headers and the leading H1 (the hero shows the
// title), rewrites absolute taxy.au cross-links to root-relative, and prepends
// the Jekyll front matter. Edit the source in taxy-ops, then re-run this.
//
// It reads taxy-ops/legal AS CHECKED OUT: whatever branch and uncommitted edits
// that repo has are what lands here.
//
// Usage:   node script/build-legal.mjs
// Source:  override the source folder with  LEGAL_SRC=/path/to/legal node script/build-legal.mjs
//          (default: the sibling checkout, ../taxy-ops/legal from this repo's root)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DST = resolve(dirname(fileURLToPath(import.meta.url)), ".."); // repo root
const SRC = process.env.LEGAL_SRC || resolve(DST, "../taxy-ops/legal");

if (!existsSync(SRC)) {
  console.error(`Source folder not found: ${SRC} (set LEGAL_SRC)`);
  process.exit(1);
}

// Transform a source .md body: strip HTML comments, drop the leading H1 (shown
// in the hero), rewrite absolute taxy.au cross-links to root-relative.
// "Whitespace" is spelled out as ASCII because the Perl original matched bytes;
// JS \s would also eat Unicode spaces and change the output.
const WS = "[ \\t\\n\\r\\f\\v]";
const LINKS =
  "legal/dpa|legal/subprocessors|legal/terms|legal/end-user-agreement|privacy-policy|security|terms";

function body(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, "") // strip non-rendering comment headers
    .replace(new RegExp(`^${WS}*#[^\\n]*\\n+`), "") // drop the leading H1 (hero shows the title)
    .replace(new RegExp(`\\]\\(https://taxy\\.au/(${LINKS})\\)`, "g"), "](/$1/)")
    .replace(new RegExp(`^${WS}+`), "") // tidy leading whitespace
    .replace(new RegExp(`${WS}+$`), "\n"); // …and trailing: end on exactly one newline
}

// "Last updated" is NOT set here. It lives in the source .md, on its own line
// immediately after the H1 — one mechanism, one place, in the repo that owns the
// document. Bump it there when the content changes; this script just carries it.
function page(src, dst, permalink, title, heading, desc, toc = false) {
  const fm =
    "---\n" +
    "layout: legal\n" +
    `title: "${title}"\n` +
    `heading: "${heading}"\n` +
    `description: "${desc}"\n` +
    `permalink: ${permalink}\n` +
    (toc ? "toc: true\n" : "") +
    "---\n\n";
  const out = join(DST, dst);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, fm + body(readFileSync(join(SRC, src), "utf8")));
  console.log(`wrote ${out}`);
}

page("privacy-policy.md", "privacy-policy.md", "/privacy-policy/",
  "Privacy policy", "Privacy Policy",
  "How Taxy handles personal information across our website and platform — controller and processor roles, AI sub-processors, data residency, and your rights under the Privacy Act and APPs.",
  true);

page("security.md", "security.md", "/security/",
  "Security", "Security at Taxy",
  "How Taxy protects your clients' data — Australian data residency, encryption in transit and at rest, MFA and limited access, and our ISMS.");

page("website-terms-of-use.md", "terms.md", "/terms/",
  "Website terms of use", "Website Terms of Use",
  "The terms governing use of the taxy.au marketing website. Use of the Taxy platform is governed separately by our Cloud Service Agreement.");

page("standard-terms.md", "legal/terms.md", "/legal/terms/",
  "Cloud Service Agreement — Standard Terms", "Cloud Service Agreement — Standard Terms",
  "Taxy's Cloud Service Agreement Standard Terms (v2.1, AU), governing use of the Taxy platform.",
  true);

page("end-user-agreement.md", "legal/end-user-agreement.md", "/legal/end-user-agreement/",
  "End user agreement", "End User Agreement",
  "The agreement binding the individuals who log in to app.taxy.au and iris.taxy.au — firm staff and invited clients — covering acceptable use and account security.",
  true);

page("dpa.md", "legal/dpa.md", "/legal/dpa/",
  "Data Processing Agreement", "Data Processing Agreement",
  "Taxy's Data Processing Agreement — how we process Customer Personal Data as a processor or sub-processor under the Privacy Act, the APPs, and (where applicable) European data protection law.",
  true);

page("subprocessors.md", "legal/subprocessors.md", "/legal/subprocessors/",
  "Sub-processors", "Sub-processors",
  "The sub-processors Taxy engages to provide the Taxy platform, the customer data each processes, and their locations.");

page("data-attributions.md", "legal/attributions.md", "/legal/attributions/",
  "Data attributions", "Data Attributions",
  "Third-party data used in Taxy products and the licence attribution each source requires — the TPB Public Register and the ABN Lookup web services.");
