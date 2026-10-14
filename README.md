# Taxy website

Static mirror of https://taxy.au (originally WordPress + Elementor) served as a Jekyll site.

The legal pages (`privacy-policy.md`, `security.md`, `terms.md` and `legal/`) are generated
from `taxy-ops/legal` by `node script/build-legal.mjs`, which reads that repo as checked out.
Edit the source there and re-run it; never edit the generated pages here.

## Run locally

```
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.

## Deploy guard

Every push to `main` deploys, and `script/check-site.mjs` runs on the built site first
(`.github/workflows/pages.yml`). Any failure stops the deploy. It checks:

- `robots.txt` exists, doesn't block the whole site, and points at `https://taxy.au/sitemap.xml`
- `sitemap.xml` exists, lists only `https://taxy.au/` URLs that were built, and includes the
  homepage and the CGT calculator
- every page in the sitemap is indexable (no `noindex`), has exactly one canonical equal to its
  own URL, a title and a meta description, and any `og:image` is an absolute taxy.au URL that exists
- `CNAME` is `taxy.au`
- every internal link and asset on every built page resolves, including `#anchors` (which is
  what catches a redirect stub pointing at a homepage section that's been renamed)

Redirect stubs and `noindex` pages are fine as long as they set `sitemap: false`.
Run it locally against a production build:

```
JEKYLL_ENV=production bundle exec jekyll build
node script/check-site.mjs
```

Outbound links are checked separately, monthly and on demand (`.github/workflows/link-check.yml`,
Actions tab → Run workflow). That one never blocks a deploy; 403/429 responses are warnings.
