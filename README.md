# wentaoz.com

Personal homepage of Wentao Zhang, served by GitHub Pages at https://wentaoz.com.

There is no build step: every file is served as-is. Edit and push to `main`; GitHub Pages redeploys in about a minute.

- `index.html` is the homepage. The film strip's thickness and material live in the address (`?d=70&m=al2o3`), so a link opens on the same colour. The growth per ALD cycle behind the cycle count is the `gpc` of each entry in `MATERIALS`.
- `wine-moon/index.html` is 醉月历 Wine Moon, the biodynamic wine calendar.
- `wine-moon/engine.js` computes the Moon's position and the fruit, flower, leaf and root periods. Both the calendar and the Wine Moon card on the homepage load it, so a fix there reaches both.
- `404.html` is what GitHub Pages serves for any missing path; its links are absolute for that reason.
- `og.png` and `wine-moon/og.png` are the 1200×630 preview images link previews show. They are screenshots of the pages, so retake them if the name, strip or Wine Moon colours change.
- The light/dark choice is stored in `localStorage` under `wentaoz.theme` and shared by every page; with nothing stored, pages follow the system setting.
- `CNAME` tells GitHub Pages which custom domain to serve (don't delete it).
- `.nojekyll` turns off Jekyll processing so the files are served as-is.
