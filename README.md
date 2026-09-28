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
