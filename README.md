# Compositional Motion Styles

Project website for **Weakly Supervised Discovery of Motion Styles for Compositional Robot Control**, by Heedo Woo, Antonio Marino, Eduardo Sebastián, and Amanda Prorok, University of Cambridge.

Public website: `https://www.proroklab.org/compositional-motion-styles/`.

GitHub Pages origin: `https://peter010103.github.io/compositional-motion-styles/`.

## Preview locally

```bash
python3 scripts/serve_preview.py
```

Open `http://localhost:8080/compositional-motion-styles/`. The preview serves the same repository subdirectory used by GitHub Pages. When `.release-assets/` is available, it serves the velocity video banks locally and substitutes those URLs in the preview response. The committed site always uses this repository's public release URLs.

## Publish

1. Push this repository to `git@github.com:Peter010103/compositional-motion-styles.git`.
2. Enable GitHub Pages in repository Settings → Pages, selecting **GitHub Actions** as the source.
3. Publish the 16 video banks from `.release-assets/` under the tag `velocity-explorer-720p-v1`:

```bash
gh release create velocity-explorer-720p-v1 .release-assets/style_??_720p.mp4 \
  --repo Peter010103/compositional-motion-styles \
  --title "Velocity explorer videos" \
  --notes "Saved rollout video banks for the interactive velocity explorer."
```

The Pages workflow publishes only the public files selected by `scripts/build_site.py`. The video banks remain release assets rather than Git objects or Pages files. The initial static site is approximately 223 MB; the separate video banks total approximately 3 GB.

## Lab-domain integration

The lab website serves `/compositional-motion-styles/` through a Cloudflare Pages proxy to this site's GitHub Pages address, following its existing workshop integration. The paper links to the lab-domain URL. Project content is maintained here; the lab repository supplies the route. The existing submitted website remains independent.

## Checks

```bash
python3 scripts/check_site.py
node scripts/check_browser.mjs
```

The browser check requires Node 22+, Google Chrome, and the preview server. It checks author information, reference selection, command/style metric toggles, video playback, controller comparisons, and mobile overflow. Screenshots and results are written to `.preview/`.

`paper.pdf` contains the named eight-page manuscript. Its project link points to this website; the manuscript source remains in the paper project.
