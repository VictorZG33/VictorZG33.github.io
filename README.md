# wentaoz.com

Personal homepage of Wentao Zhang, served by GitHub Pages at https://wentaoz.com.

There is no build step: every file is served as-is. Edit and push to `main`; GitHub Pages redeploys in about a minute.

- `index.html` is the homepage.
- `wine-moon/index.html` is 醉月历 Wine Moon, the biodynamic wine calendar.
- `wine-moon/engine.js` computes the Moon's position and the fruit, flower, leaf and root periods. Both the calendar and the Wine Moon card on the homepage load it, so a fix there reaches both.
- `CNAME` tells GitHub Pages which custom domain to serve (don't delete it).
- `.nojekyll` turns off Jekyll processing so the files are served as-is.
