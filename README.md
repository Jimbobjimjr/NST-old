# Abandoned Lands War Map

A living map of the four External Evils, the Lesser Evils and other threats across the Swordcraft Abandoned Lands. It runs as a plain website, so it can be embedded in a wiki page. Chapter NST reps sign in with a code to record story events, place threats at sites on their region's map, and write their region's "current situation" notes.

The story is stored in a Google Sheet that you own. The website reads it and sends changes to it through a small Apps Script.

## What's in this folder

| Path | What it is |
|---|---|
| `index.html` | The whole map app |
| `config.js` | The one setting you need to change: the address of your story sheet |
| `maps/` | Shani's main map and the seven regional maps |
| `apps-script/Code.gs` | The story sheet's backend, to paste into Google Apps Script |

You can open `index.html` straight from this folder to look around. Until `config.js` has an address, it shows the opening positions, and **Try editing** keeps any changes in that browser only.

## 1. Set up the story sheet (about ten minutes)

1. Make a new Google Sheet, for example "War Map story", in a Drive the NST controls.
2. Open **Extensions > Apps Script**. Delete what's there and paste in all of `apps-script/Code.gs`. Save.
3. In the function menu at the top, pick **setup** and press **Run**. Allow the permissions it asks for (it only touches this sheet).
4. Back in the sheet you'll see the tabs Events, Sites, Notes, Reps, Settings and Log. The **Reps** tab has one row with your NST code. Change it to something you'll remember if you like.
5. In Apps Script, choose **Deploy > New deployment**, type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**. Copy the web app URL. It ends in `/exec`.
6. Open `config.js` and paste that URL between the quotes after `apiUrl:`.

If you later change `Code.gs`, use **Deploy > Manage deployments > Edit > New version** so the URL stays the same.

## 2. Add your reps

One row per person in the **Reps** tab:

| code | name | role | chapters | active |
|---|---|---|---|---|
| a code you give them | how they show up in the log | `rep`, `story` or `nst` | chapter ids, comma separated, or `all` | TRUE |

- `rep` can record events for their chapters, place threats and sites in their region, and write their region's notes. They see everything, including NST-only events.
- `story` can sign in to see story-team events and notes, but can't change anything.
- `nst` can do everything: tier 4 and 5 appearances, Lesser Evils past tier 3, national events, reordering the story and arranging the main map.
- Set `active` to FALSE to switch a code off. Change the code to revoke it.

Chapter ids: `ritterstein`, `kreigstor`, `bracken`, `eisendreieck`, `sudenburg`, `stromstadt`, `braylong`, `handelsdorf`, `weitnordlich`, `helsreik`, `reefwatch`.

The sheet itself enforces these rules, so a rep can't get around them from the browser. Every change lands in the **Log** tab with who made it. Players without a code only ever receive events marked "Players".

## 3. Put the site online

Any static host works. Two free options:

- **GitHub Pages**: make a public repository, upload everything in this folder, then **Settings > Pages > Deploy from a branch > main**. The map appears at `https://<you>.github.io/<repo>/`.
- **Netlify**: drag this folder onto app.netlify.com/drop and claim the site.

## 4. Embed it in the wiki

Open the hosted map and press **Embed**. It gives you code like this:

```html
<iframe src="https://YOUR-SITE/index.html?embed=1" title="Abandoned Lands War Map" width="100%" height="860" style="border:0" loading="lazy"></iframe>
```

- `?embed=1` gives a compact header with an "Open full map" button.
- Add `&region=bracken` (any chapter id) to open straight onto that region's map, which suits a chapter's own wiki page.
- Google Sites: **Insert > Embed > By URL**. MediaWiki needs an iframe extension (Widgets or EmbedVideo, for example). Fandom doesn't allow iframes, so link to the map instead.

Reps can sign in from inside the embed too.

## Using it

- **Double-click a region**, or press **Zoom into** on its page, to open its regional map. Regions without their own map zoom into Shani's map.
- Click a site to see what's there. Reps use the steppers to place an External Evil at that site, and **+ Lesser evil or threat here** to add one.
- **Edit sites** (reps, in their own region): click empty ground to add a site, drag a site to move it, rename or hide the built-in ones.
- Everything that changes the story goes into a draft in the **Story log** and is saved only when you press **Add to the story**. The map previews the draft while you work, and warns you about the guidebook's rules (one tier at a time, tier 3 sign-off, Lesser Evils stop at tier 3, home chapters for Dragon's Vengeance, the Koru'Vea and the Ferren Synod).

## Data format

Each row in **Events** is one step of the story. Its `changes` column holds a JSON list. Every map layer uses the same shape, so new layers can be added later without changing old events.

```json
{ "type": "set",    "evil": "pale", "region": "braylong", "site": "braylong-velaris", "tier": 2 }
{ "type": "move",   "evil": "gor", "from": "wastes", "to": "eisendreieck", "toSite": "eisendreieck-the-mine", "tier": 2, "keep": true }
{ "type": "clash",  "a": "pale", "b": "wild", "region": "braylong", "site": "", "note": "..." }
{ "type": "status", "region": "sudenburg", "status": "threatened", "note": "..." }
{ "type": "threat", "tid": "t123", "kind": "lesser", "group": "koruvea", "name": "", "tier": 2, "region": "reefwatch", "site": "reefwatch-docks", "note": "...", "remove": false }
```

- `evil`: `pale`, `drowned`, `gor`, `wild`.
- `site` is optional everywhere. Without it, a force is region-wide.
- A `threat` keeps its `tid` for its whole life. A later change with the same `tid` moves it, changes its tier, or with `"remove": true` takes it off the map.
- `kind` is `lesser` or `other`. For `lesser`, `group` is `ferren`, `forsworn`, `vine`, `dragons` or `koruvea`. For `other` it's `bandits`, `beasts`, `cult`, `faction`, `disaster` or `unknown`.
- Built-in site ids are the region id plus the site's name in lower case with dashes, for example `bracken-fort-blackridge`. Sites reps add are listed in the **Sites** tab, with `x` and `y` as fractions of the regional map's width and height.

**Export the story as JSON** under Map setup in the Story log downloads everything at once.
