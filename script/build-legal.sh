#!/bin/bash
# Regenerate the published legal/policy pages from their source of truth.
#
# The .md docs in taxy-ops/legal/ are the single source of truth (see that
# repo's README). This script lifts each one onto the site verbatim: it strips
# the non-rendering <!-- … --> headers and the leading H1 (the hero shows the
# title), rewrites absolute taxy.au cross-links to root-relative, and prepends
# the Jekyll front matter. Edit the source in taxy-ops, then re-run this.
#
# Usage:   script/build-legal.sh
# Source:  override the source folder with  LEGAL_SRC=/path/to/legal  script/build-legal.sh
set -euo pipefail

SRC="${LEGAL_SRC:-/Users/amanda/code/taxy-ops/legal}"
DST="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root

[ -d "$SRC" ] || { echo "Source folder not found: $SRC (set LEGAL_SRC)"; exit 1; }

# Transform a source .md body: strip HTML comments, drop the leading H1 (shown
# in the hero), rewrite absolute taxy.au cross-links to root-relative.
body() {
  perl -0777 -pe '
    s/<!--.*?-->//gs;                                   # strip non-rendering comment headers
    s/\A\s*#[^\n]*\n+//s;                                # drop the leading H1 (hero shows the title)
    s{\]\(https://taxy\.au/(legal/dpa|legal/subprocessors|legal/terms|legal/end-user-agreement|privacy-policy|security|terms)\)}{](/$1/)}g;
    s/\A\s+//s; s/\s+\z/\n/s;                            # tidy leading/trailing whitespace
  ' "$1"
}

page() {  # page <src> <dst> <permalink> <title> <heading> <description> [stampdate] [toc]
  local src="$SRC/$1" dst="$DST/$2" permalink="$3" title="$4" heading="$5" desc="$6" stamp="${7:-}" toc="${8:-}"
  {
    printf -- '---\n'
    printf 'layout: legal\n'
    printf 'title: "%s"\n' "$title"
    printf 'heading: "%s"\n' "$heading"
    printf 'description: "%s"\n' "$desc"
    printf 'permalink: %s\n' "$permalink"
    if [ -n "$toc" ]; then printf 'toc: true\n'; fi
    printf -- '---\n\n'
    if [ -n "$stamp" ]; then printf '_Last updated: %s._\n\n' "$stamp"; fi
    body "$src"
  } > "$dst"
  echo "wrote $dst"
}

page privacy-policy.md privacy-policy.md /privacy-policy/ \
  "Privacy policy" "Privacy Policy" \
  "How Taxy handles personal information across our website and platform — controller and processor roles, AI sub-processors, data residency, and your rights under the Privacy Act and APPs." \
  "" toc

page security.md security.md /security/ \
  "Security" "Security at Taxy" \
  "How Taxy protects your clients' data — Australian data residency, encryption in transit and at rest, MFA and zero-trust access, and our ISMS." \
  "10 June 2026"

page website-terms-of-use.md terms.md /terms/ \
  "Website terms of use" "Website Terms of Use" \
  "The terms governing use of the taxy.au marketing website. Use of the Taxy platform is governed separately by our Cloud Service Agreement."

page standard-terms.md legal/terms.md /legal/terms/ \
  "Cloud Service Agreement — Standard Terms" "Cloud Service Agreement — Standard Terms" \
  "Taxy's Cloud Service Agreement Standard Terms (v2.1, AU), governing use of the app.taxy.au platform." \
  "10 June 2026" toc

page end-user-agreement.md legal/end-user-agreement.md /legal/end-user-agreement/ \
  "End user agreement" "End User Agreement" \
  "The agreement binding the individuals who log in to app.taxy.au — firm staff and invited clients — covering acceptable use and account security." \
  "" toc

page dpa.md legal/dpa.md /legal/dpa/ \
  "Data Processing Agreement" "Data Processing Agreement" \
  "Taxy's Data Processing Agreement — how we process Customer Personal Data as a processor or sub-processor under the Privacy Act, the APPs, and (where applicable) European data protection law." \
  "10 June 2026" toc

page subprocessors.md legal/subprocessors.md /legal/subprocessors/ \
  "Sub-processors" "Sub-processors" \
  "The sub-processors Taxy engages to provide app.taxy.au, the customer data each processes, and their locations."
