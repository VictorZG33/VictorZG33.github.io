# ski-roads

A Cloudflare Worker that reads Caltrans' and the California Highway Patrol's feeds for [上山 First Chair](https://wentaoz.com/ski/) and answers with only the mountain highways the page's resorts are reached by: I-80, US-50, SR-89, SR-267, SR-28 and SR-88, from the foothills to the Nevada line. The page finds it at `ROADS_ENDPOINT` in `ski/index.html`.

## Why it exists

Two of the feeds can't be read by a page on another site: CHP's incidents and Caltrans' road conditions text (`roads.dot.ca.gov`) send no `Access-Control-Allow-Origin`. The Worker reads them for the page. CHP's own feed (`media.chp.ca.gov/sa_xml/sa.xml`) sits behind a firewall that never answers Cloudflare, so the Worker reads the copy Caltrans' QuickMap draws its CHP Incidents layer from (`quickmap.dot.ca.gov/data/chp-only.kml`), and CHP's feed only if QuickMap can't be reached. QuickMap's copy has each incident's log number, which names its dispatch centre, what it is, where and when, but not CHP's area or location notes.

The other three, Caltrans' chain controls, road cameras and lane closures (`cwwp2.dot.ca.gov`), do allow it, but they come uncompressed: about 3 MB for District 3 alone, most of it whitespace and highways nowhere near the mountains. The Worker sends the page 20 to 50 kB of it instead. When the Worker can't be reached, the page fetches these three itself and keeps the same parts, with the same code: `ski/roads.js`, which both import.

## Endpoints

All `GET`, all answering `{at, data}`, where `at` is when the feed was fetched (milliseconds since 1970):

| Path | What | Kept for |
|---|---|---|
| `/chains?d=3` or `d=10` | chain control checkpoints, one per checkpoint and direction, with the most demanding status Caltrans has set there | 1 min |
| `/cams?d=3` or `d=10` | the road cameras that work, each with its picture's address and its video's, if any | 6 h |
| `/closures?d=3` or `d=10` | lane closures on the highways themselves, on now or starting within 36 hours | 5 min |
| `/chp` | the incidents of CHP's Truckee and Sacramento dispatch centres, from QuickMap or else CHP: what, where, when and how many notes, but not the notes, which can carry licence plates and callers' details | 1 min |
| `/roads` | Caltrans' road conditions text for the six highways, by area heading | 2 min |

District 3 is Marysville (I-80, US-50, SR-89, SR-267, SR-28), District 10 Stockton (SR-88, for Kirkwood). Each answer is kept in the Worker's memory for the time above, so a burst of visitors fetches each feed once; if a feed can't be reached, an answer up to 45 minutes old is sent instead, with an `X-Stale` header saying why. Nothing is stored anywhere else.

The feeds are not always well. Caltrans' servers answer `500` now and then, more often in a storm, when everyone is looking, so each request to them is tried three times with a growing pause; the chain controls are asked for as CSV and as JSON by turns, four times in all, since Caltrans publishes both and one often answers when the other doesn't (`ccFromCsv` in `ski/roads.js` reads the CSV, a quarter the size of the JSON). The road conditions page sends, about as often as not, a page with no highway on it; each highway is asked up to three times, and one that still won't come keeps its last good text, up to 45 minutes old. Requests are answered only for `https://wentaoz.com` (by the `Origin` header).

On the free plan a request may use 10 ms of CPU. Reading District 3's lane closures, the largest feed at 1.2 MB, takes about 5, which is why each district is a request of its own.

## Deploying

`.github/workflows/ski-roads.yml` deploys the Worker whenever this folder or `ski/roads.js` changes on `main`. It needs only `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, the repository secrets the other Workers already use. Actions → Ski roads server → Run workflow deploys it by hand; the run's summary shows its address, `https://ski-roads.<subdomain>.workers.dev`, which should match `ROADS_ENDPOINT` in `ski/index.html`.

To try it locally, run `npm install` and then `npx wrangler dev --var DEV_ORIGINS:http://localhost:8000` here, serve the repository with `python3 -m http.server 8000`, and point `ROADS_ENDPOINT` at `http://localhost:8787` without committing that.

## Terms

Caltrans publishes these feeds for anyone to use under its [conditions of use](https://dot.ca.gov/conditions-of-use); CHP's incident feed is public information. The Worker only passes on part of what they say, unchanged, with the time it was fetched, and the page credits both and says to check QuickMap and the resort before leaving.
