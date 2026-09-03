# Taxy website

Static mirror of https://taxy.au (originally WordPress + Elementor) served as a Jekyll site.

> **Before running `script/build-legal.sh`:** it regenerates the legal pages from
> `taxy-ops/legal` **on whatever branch that repo is currently on**, and ops main already
> carries unpublished `iris.taxy.au` content plus a new `/legal/attributions/` page. Running
> it on this repo's `main` will pull that onto the publishable branch silently. Those changes
> are staged on the branch `iris-domain-and-attributions`; publish from there when
> iris.taxy.au is live.

## Run locally

```
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.
