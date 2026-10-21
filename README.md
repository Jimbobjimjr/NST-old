# Abandoned Lands Story Map

A living map of the four External Evils, the Lesser Evils and other threats across the Swordcraft Abandoned Lands. It runs as a plain website, so it can be embedded in a wiki page. Chapter NST Reps sign in with a code to record story events, place threats at sites on their region's map, and write their region's "current situation" notes.

The story is stored in a Google Sheet that you own. The website reads it and sends changes to it through a small Apps Script.

## What's in this folder

| Path | What it is |
|---|---|
| `index.html` | The whole map app |
| `config.js` | The one setting you need to change: the address of your story sheet |
| `maps/` | Shani's main map and the seven regional maps |
| `apps-script/Code.gs` | The story sheet's backend, to paste into Google Apps Script |
| `dev/` | The readable source of `index.html`, the build script and the tests (see "Changing the map" below) |

You can open `index.html` straight from this folder to look around. Until `config.js` has an address, it shows the opening positions, and **Try editing** keeps any changes in that browser only.

## 1. Set up the story sheet (about ten minutes)

1. Make a new Google Sheet, for example "Story Map sheet", in a Drive the NST Team controls.
2. Open **Extensions > Apps Script**. Delete what's there and paste in all of `apps-script/Code.gs`. Save.
3. In the function menu at the top, pick **setup** and press **Run**. Allow the permissions it asks for (it only touches this sheet).
4. Back in the sheet you'll see the tabs Events, Sites, Notes, Reps, Settings and Log. The **Reps** tab has one row with your NST code. Change it to something you'll remember if you like.
5. In Apps Script, choose **Deploy > New deployment**, type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then **Deploy**. Copy the web app URL. It ends in `/exec`.
6. Open `config.js` and paste that URL between the quotes after `apiUrl:`.

If you later change `Code.gs`, paste the new version over the old one, save, then use **Deploy > Manage deployments > Edit > New version > Deploy** so the URL stays the same. New columns are added to the sheet by themselves.

## 2. Add your reps

One row per person in the **Reps** tab:

| code | name | role | chapters | active |
|---|---|---|---|---|
| a code you give them | how they show up in the log | `story`, `rep`, `nst` or `lead` | chapter ids, comma separated, or `all` | TRUE |

- `story` can sign in to see story-team events and notes, add details to places on their chapters' region maps, and write their chapters' dispatches, calendar events and requests. They can't change the story.
- `rep` can record events for their chapters, place threats, pinpoints and sites in their region, and write their region's notes. They see everything, including NST Team only events. Shown on the map as **NST Rep**.
- `nst` (shown as **NST Team**; `nst team` also works in the sheet) can do everything a rep can in every chapter, plus tier 4 and 5 appearances, Lesser Evils past tier 3, national events, reordering the story, arranging the main map and the "being updated" notice on region maps, and setting a region's danger level by hand.
- `lead` is the **NST Lead**: everything `nst` can do, plus renaming places and deciding chapter requests. That covers regions and fronts on the main map (for example the North Pass) and the places drawn on each region's map. Reps can still name the sites they add themselves.
- Set `active` to FALSE to switch a code off. Change the code to revoke it.

Chapter ids: `ritterstein`, `kreigstor`, `bracken`, `eisendreieck`, `sudenburg`, `stromstadt`, `braylong`, `handelsdorf`, `weitnordlich`, `helsreik`, `reefwatch`.

The sheet itself enforces these rules, so a rep can't get around them from the browser. Every change lands in the **Log** tab with who made it. Players without a code only ever receive events marked "Players".

## 3. Put the site online

Any static host works. Two free options:

- **GitHub Pages**: make a public repository, upload everything in this folder, then **Settings > Pages > Deploy from a branch > main**. The map appears at `https://<you>.github.io/<repo>/`.
- **Netlify**: drag this folder onto app.netlify.com/drop and claim the site.

## 4. Embed it in the wiki

Open the hosted map, sign in with the NST Lead's code and press **Embed** (only the NST Lead sees that button). It gives you code like this:

```html
<iframe src="https://YOUR-SITE/index.html?embed=1" title="Abandoned Lands Story Map" width="100%" height="860" style="border:0" loading="lazy" allow="fullscreen" allowfullscreen></iframe>
```

- `?embed=1` gives a compact header with an "Open full map" button.
- Add `&region=bracken` (any chapter id) to open straight onto that region's map, which suits a chapter's own wiki page.
- Google Sites: **Insert > Embed > By URL**. MediaWiki needs an iframe extension (Widgets or EmbedVideo, for example). Fandom doesn't allow iframes, so link to the map instead.

Reps can sign in from inside the embed too.

## Using it

- **Double-click a region**, or press **Zoom into** on its page, to open its regional map. Regions without their own map zoom into Shani's map.
- Zoom with the **+** and **−** buttons, the mouse wheel, or two fingers on a phone. The **full screen** button (the four corners) fills the screen with the map; press it again or Esc to leave. Hover over any token, threat, pinpoint or place for its details and the last event that changed it.
- **Pinpoints** mark story moments, camps, battles, dangers and places of interest. Reps add them with **+ Pinpoint on the map** on a region's page, then click the map where it goes, or with **+ Pinpoint here** on a site. Like threats, they go into the story as part of an event.
- A region's **Condition** shows on the map: **besieged** regions are hatched red and **fallen** ones are blacked out, on the main map and the region's own map.
- Every town has a **danger level**, from Calm through Uneasy, Dangerous and Perilous to Dire, shown as the colour of its ring on the map. It's worked out from the threats and the condition at the step on screen: the highest tier there, one step more for three or more threats at once or for a siege, Dire if the region has fallen. The NST Team can set a level by hand, with a reason players see, from **Set the danger level by hand** on the region's page; that only applies at the latest step of the story.
- A town's page opens with **Right now**: its danger level and why, what players feel, its condition and since when, and its latest events. The **Right now** tab lists every chapter at a glance, most dangerous first.
- **Dispatches** are news for players, written by each chapter's story team (or rep, or the NST Team) after their events. Anyone can read them, including on the wiki: add `&tab=dispatches` to the embed link to open on them. The NST Team can pin one to the top and write national dispatches.
- The **Calendar** shows every chapter's events for the year, month by month (with a year picker; past events are greyed), and each town shows its next event date on the map (the **Next event dates** layer). The tab shows how many events fall in the next 30 days. Story teams and reps add their own chapter's events; story teams and the NST Team also see what's planned and the main threat, and get a heads-up when two chapters plan the same evil within 30 days. The NST Team can link the full Swordcraft calendar from the bottom of the tab.
- **Requests** let a chapter ask before a story crosses into another chapter. Only the chapters involved and the NST Team see a request, and they can comment on it; only the NST Lead can approve, approve with changes, or decline it. Players never see requests.
- The **Yearly recap** (NST Team only, when viewing as NST) sums up a year from the map: events posted, threats risen and beaten back, regions besieged, fallen or liberated, entries and dispatches by chapter, the biggest moments, and what needs a look (chapters with no events, Lesser Evils left alone for three or more steps, regions that ended the year Perilous or Dire). Events count towards the year they were saved in.
- The story moves in **years**. The NST Team starts each year (for example "2026" or "The Year of Ash") from the top of the **Story log**, and every entry posted until the next year goes into it, so several chapters' events can happen in the same year. The count at the top of the map and the timeline step through years, not single entries. Reps always post into the current year; the NST Team can move an entry to another year when editing it. Entries saved before years existed are each their own year. (In the sheet these are still called turns.)
- Each region also has **its own story**: a town's page lists every entry that touched it (beat 3 of 5, and so on) with buttons to go through them, and **Whose story** in the Story log shows one chapter's entries on their own.
- Each region map shows a notice while it's being updated. The NST Team can change its wording, or switch it off for a map that's finished, from the region's page.
- Click a site to see what's there. Reps use the steppers to place an External Evil at that site, and **+ Lesser evil or threat here** to add one.
- **Edit sites** (reps, in their own region): click empty ground to add a site, drag a site to move it, rename or hide the built-in ones.
- Everything that changes the story goes into a draft in the **Story log** and is saved only when you press **Add to the story**. The map previews the draft while you work, and warns you about the guidebook's rules (one tier at a time, tier 3 sign-off, Lesser Evils stop at tier 3, home chapters for Dragon's Vengeance, the Koru'Vea and the Ferren Synod).

## Data format

Each row in **Events** is one entry in the story. Its `changes` column holds a JSON list. Every map layer uses the same shape, so new layers can be added later without changing old events.

```json
{ "type": "set",    "evil": "pale", "region": "braylong", "site": "braylong-velaris", "tier": 2 }
{ "type": "move",   "evil": "gor", "from": "wastes", "to": "eisendreieck", "toSite": "eisendreieck-the-mine", "tier": 2, "keep": true }
{ "type": "clash",  "a": "pale", "b": "wild", "region": "braylong", "site": "", "note": "..." }
{ "type": "status", "region": "sudenburg", "status": "threatened", "note": "..." }
{ "type": "threat", "tid": "t123", "kind": "lesser", "group": "koruvea", "name": "", "tier": 2, "region": "reefwatch", "site": "reefwatch-docks", "note": "...", "remove": false }
{ "type": "mark",   "mid": "m123", "icon": "battle", "label": "The burned chapel", "region": "bracken", "x": 0.3, "y": 0.39, "note": "...", "remove": false }
```

- `evil`: `pale`, `drowned`, `gor`, `wild`.
- `site` is optional everywhere. Without it, a force is region-wide.
- A `threat` keeps its `tid` for its whole life. A later change with the same `tid` moves it, changes its tier, or with `"remove": true` takes it off the map.
- A `mark` is a pinpoint. Like a threat it keeps its `mid` for life. It sits at a `site`, or at `x` and `y` on the region's map (fractions of its width and height), or region-wide with neither. `icon` is `pin`, `star`, `flag`, `battle`, `danger`, `mystery` or `loss`.
- `kind` is `lesser` or `other`. For `lesser`, `group` is `ferren`, `forsworn`, `vine`, `dragons` or `koruvea`. For `other` it's `bandits`, `beasts`, `cult`, `faction`, `disaster` or `unknown`.
- Built-in site ids are the region id plus the site's name in lower case with dashes, for example `bracken-fort-blackridge`. Sites reps add are listed in the **Sites** tab, with `x` and `y` as fractions of the regional map's width and height.

**Export the story as JSON** under Map setup in the Story log downloads everything at once.

The **Settings** tab also holds `notice` (the region map notice and which maps have it switched off), `regions` (names and descriptions the NST Lead has changed) `danger` (levels the NST Team has set by hand: `{"bracken": {"level": 3, "why": "...", "feel": "..."}}`, where 0 is Calm and 4 is Dire) `calendar` (`{"url": "..."}`, the link to the full Swordcraft calendar) and `turns` (`{"open": 12, "labels": {"12": "November 2026"}}`: the turn new entries go into, and turn names). Each event's `turn` column holds its turn's key; an empty `turn` means the event is its own turn, keyed by its `order`.

The **Dispatches**, **Calendar** and **Requests** tabs are created the first time they're needed. Calendar dates are `yyyy-mm-dd`; `evil` is an External Evil id (`pale`, `drowned`, `gor`, `wild`) or a Lesser Evil id. A request's `affects` is a comma-separated list of chapter ids, its `status` is `waiting`, `approved`, `changes` or `declined`, and its `comments` are JSON.

## Changing the map

`index.html` is built from the files in `dev/src`. Edit those, then run `python3 dev/build.py` from this folder to rebuild `index.html`. `dev/test` has browser tests that run the page against `Code.gs` in Node (they need Node, Playwright and Chromium).
