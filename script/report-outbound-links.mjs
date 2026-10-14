#!/usr/bin/env node
// Turn lychee's JSON report into the outbound link check's verdict.
//
// Used by .github/workflows/link-check.yml once lychee has checked every
// outbound link on the built site. 403 and 429 are warnings: sites routinely
// refuse or throttle bots while serving people fine. Any other failure (404,
// 5xx, DNS, TLS, timeout) fails the job.
//
// Usage:   node script/report-outbound-links.mjs <lychee-report.json>
// Env:     LYCHEE_EXIT_CODE     lychee's exit code: 0 all good, 2 link failures,
//                               anything else means lychee itself failed
//          GITHUB_STEP_SUMMARY  if set (it is in Actions), a summary table lands there
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const WARN_CODES = new Set([403, 429]);
const file = process.argv[2];
const lycheeExit = process.env.LYCHEE_EXIT_CODE ?? "";

// Workflow-command escaping (https://docs.github.com/actions/reference/workflow-commands-for-github-actions)
const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const annotate = (level, title, msg) => console.log(`::${level} title=${esc(title).replace(/[:,]/g, " ")}::${esc(msg)}`);

function die(msg) {
  annotate("error", "Outbound link check", msg);
  process.exit(1);
}

if (lycheeExit !== "" && lycheeExit !== "0" && lycheeExit !== "2")
  die(`lychee exited ${lycheeExit} (configuration or runtime error), see the lychee step's log`);
if (!file || !existsSync(file)) die(`no lychee report at ${file}`);
let report;
try {
  report = JSON.parse(readFileSync(file, "utf8"));
} catch (e) {
  die(`lychee report ${file} is not JSON: ${e.message}`);
}
// Links actually requested. Not `total`, which also counts the excluded ones
// (every taxy.au link is excluded on purpose).
const checked = ["successful", "errors", "timeouts", "unknown"].reduce((n, k) => n + (report[k] || 0), 0);
if (checked === 0) die("lychee checked no outbound links, so the input glob or excludes are probably wrong");

// Group by URL + status so a link in the footer of every page is reported once.
const groups = new Map();
for (const map of ["error_map", "timeout_map"]) {
  for (const [source, entries] of Object.entries(report[map] || {})) {
    for (const e of entries) {
      const text = e.status?.text || (map === "timeout_map" ? "Timeout" : "Error");
      const code = e.status?.code ?? Number(text.match(/^\d{3}\b/)?.[0]);
      const key = `${e.url}\u0000${text}`;
      if (!groups.has(key)) groups.set(key, { url: e.url, text, details: e.status?.details, code, pages: new Set() });
      groups.get(key).pages.add(e.span?.line ? `${source}:${e.span.line}` : source);
    }
  }
}
const all = [...groups.values()];
const warnings = all.filter((g) => WARN_CODES.has(g.code));
const failures = all.filter((g) => !WARN_CODES.has(g.code));

const pagesOf = (g) => {
  const p = [...g.pages].sort();
  return p.slice(0, 3).join(", ") + (p.length > 3 ? ` (+${p.length - 3} more)` : "");
};
for (const g of warnings) annotate("warning", `Outbound link ${g.code} (bot blocked or rate-limited)`, `${g.url} on ${pagesOf(g)}`);
for (const g of failures)
  annotate("error", "Broken outbound link", `${g.url}: ${g.text}${g.details ? ` (${g.details})` : ""} on ${pagesOf(g)}`);

const line = `${checked} outbound links checked: ${failures.length} broken, ${warnings.length} warning${warnings.length === 1 ? "" : "s"} (403/429)`;
console.log(line);

if (process.env.GITHUB_STEP_SUMMARY) {
  const cell = (s) => String(s).replace(/\|/g, "\\|");
  const table = (rows) =>
    "| Link | Status | Found on |\n|---|---|---|\n" +
    rows.map((g) => `| ${cell(g.url)} | ${cell(g.text)} | ${cell(pagesOf(g))} |`).join("\n") +
    "\n\n";
  let md = `## Outbound links\n\n${line}\n\n`;
  if (failures.length) md += `### Broken\n\n${table(failures)}`;
  if (warnings.length) md += `### Warnings (403/429, usually bot blocking: check by hand)\n\n${table(warnings)}`;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

process.exit(failures.length ? 1 : 0);
