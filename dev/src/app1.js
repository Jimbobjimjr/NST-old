(() => {
"use strict";
const CONFIG = Object.assign({ apiUrl: "", pollSeconds: 60 }, window.WARMAP_CONFIG || {});
const PARAMS = new URLSearchParams(location.search);
const EMBED = PARAMS.get("embed") === "1";
const SVGNS = "http://www.w3.org/2000/svg";
const W = 1000, H = 1492;
const MAIN_SRC = "maps/main.jpg";

/* ---------- Lore (from the NST Guidebook and Community Update #3) ---------- */
const EVIL_ORDER = ["pale", "drowned", "gor", "wild"];
const EVILS = {
  pale: { name: "The Pale Host", short: "Pale Host", tagline: "Deathless empire", saying: "Death has patience. Death remembers.",
    figure: "Khallazar, the Lich-Regent (the Scarab King)", wants: "To complete something left undone. It collects the dead.",
    presses: "Braylong's north pass, and anywhere the living abandon their dead.", feel: "A slow, suffocating press. Silence, then drums.",
    counter: "Lay the dead to rest; break Bone Standards, soul-jars and Unholy Wards.", defectors: "Bound Remnants", shape: "diamond" },
  drowned: { name: "The Drowned Court", short: "Drowned Court", tagline: "Abyssal dominion", saying: "What the sea takes, it keeps.",
    figure: "The Abyssal Sovereign (the Coral Crown)", wants: "To drown the land and reclaim all water for the sea.",
    presses: "All oceans, coasts, rivers and wells; most strongly the Whispering Sea and the coast around Reefwatch Keep.", feel: "They seep rather than march. Salt on the grass, a well bubbling.",
    counter: "Destroy or sanctify coral spires; secure clean water; break the conch or Tide Totem.", defectors: "Brine-Oath Breakers", shape: "circle" },
  gor: { name: "The Gor Horde", short: "Gor Horde", tagline: "Warclan confederation", saying: "War is not what they do. War is what they are.",
    figure: "The Warchanter", wants: "Endless war, and to unmake the Age of Walls.",
    presses: "The western border of the Abandoned Lands.", feel: "Thunder that walks. Drums like heartbeats, then the chant: Prove. Or fall.",
    counter: "Silence the drums, take down war-banners, cut supply lines, answer a challenge.", defectors: "Black Feathers", shape: "square" },
  wild: { name: "The Wildwrought", short: "Wildwrought", tagline: "Living retribution", saying: "The world does not need you; it remembers how to live without you.",
    figure: "The Thorn-Regent (the Hart-Mask)", wants: "To rewild the world and purge abused magic.",
    presses: "Braylong's south swamp, and anywhere magic is mined, bottled or forced into machines.", feel: "Surgical, not frenzied. They strike, take what should not exist, and vanish.",
    counter: "Protect Fonts of Power, smash Briar Totems, make reparations.", defectors: "Penitents", shape: "triangle" },
};
const TIERS = [
  { n: 0, name: "None", fielded: "", reach: "", approval: "" },
  { n: 1, name: "Rumour", fielded: "Signs, omens, aftermath or a lone scout", reach: "One scene", approval: "Chapter story team" },
  { n: 2, name: "Pocket problem", fielded: "Swarm and bruiser units only", reach: "One event, one site", approval: "Chapter story team, logged with the NST Rep" },
  { n: 3, name: "Incursion", fielded: "Adds controllers and at most one champion", reach: "One region, a few events", approval: "NST Rep signs off" },
  { n: 4, name: "Campaign", fielded: "Champions recur; a named lieutenant may appear", reach: "A region or several chapters, across a season", approval: "NST Team (Brett or Andrew)" },
  { n: 5, name: "National event", fielded: "The figurehead appears", reach: "The whole Abandoned Lands; permanent change", approval: "NST Team only" },
];
/* Lesser Evils (guidebook chapter 12). They stop at tier 3. */
const LESSER = {
  ferren: { name: "Ferren Synod", home: "braylong", what: "Rat-like tunnel scavengers who fell from the Wildwrought into machine-worship: sabotage, black markets, poison gas." },
  forsworn: { name: "The Forsworn", home: null, what: "A disciplined confederacy of abandoned soldiers and mercenaries: raids, siege extortion, hostage-taking. No pay, no pity, no prisoners." },
  vine: { name: "The Waking Vine", home: null, what: "Wild magic waking the land where Skein scars tear: living forests, Vinebound guardians, Briarborn." },
  dragons: { name: "Dragon's Vengeance", home: "sudenburg", what: "A mercenary company, once the Red Company's backer, turned rogue militant force." },
  koruvea: { name: "Koru'Vea pirates", home: "reefwatch", what: "Island pirates who raid trade, smuggle relics and sometimes become uneasy allies." },
};
const OTHER = { bandits: "Bandits and raiders", beasts: "Beasts and monsters", cult: "Cult", faction: "Rival faction", disaster: "Disaster, plague or blight", unknown: "Unknown" };
const STATUSES = { holding: "Holding", threatened: "Threatened", besieged: "Besieged", fallen: "Fallen", liberated: "Liberated" };
const VIS = { public: "Players", story: "Story team", nst: "NST Team only" };
const VIS_RANK = { public: 0, story: 1, nst: 2 };
const ROLES = { viewer: { name: "Viewer", max: "public" }, story: { name: "Story team", max: "story" }, rep: { name: "NST Rep", max: "nst" }, nst: { name: "NST Team", max: "nst" }, lead: { name: "NST Lead", max: "nst" } };
/* Pinpoints: story moments and points of interest placed on a region's map. */
const MARKS = {
  pin: { name: "Point of interest", glyph: "●" }, star: { name: "Story moment", glyph: "★" }, flag: { name: "Camp or rally point", glyph: "⚑" },
  battle: { name: "Battle", glyph: "⚔\uFE0E" }, danger: { name: "Danger", glyph: "!" }, mystery: { name: "Mystery", glyph: "?" }, loss: { name: "Death or loss", glyph: "✝" },
};
const NOTICE_TEXT = "This map is still being updated. Places and positions may change.";

const REGIONS = [
  { id: "ritterstein", name: "Ritterstein", kind: "chapter", band: "Northern Highlands", pos: [675, 122],
    blurb: "The northern shield on the Whispering Sea. If a threat rises from the sea, Ritterstein bleeds first and warns the rest.",
    gov: "Mayor advised by three Lord Merchants", econ: "Coal, stone and salt; coastal trade", tens: "Resentment of the Dominion, northern sea threats, fragile trade routes",
    orbit: ["Whispering Sea", "Blarek Reach", "Sunken Watchtower", "Abandoned Dwarven Fortress"] },
  { id: "kreigstor", name: "New Kriegstor", kind: "chapter", band: "Northern Highlands", pos: [496, 298],
    blurb: "A young crossroads town, a waypoint between the Dominion and the Abandoned Lands. Kreigstor burned once. It will not burn again.",
    gov: "Green Council with community assembly", econ: "Caravan trade, timber, stone, labour contracts", tens: "Warlord pressure, supply strain, Grove disputes, rising crime",
    orbit: ["Verrath's Encampment", "Ruined Dominion Watchtower", "Unexplored Caverns", "Shrouded Area"] },
  { id: "bracken", name: "Bracken", kind: "chapter", band: "Midlands", pos: [632, 418],
    blurb: "Ringed by Leben's Blessing, a living wall of thorn bound from a Font of Power. A waypoint between the northern routes and the inland towns.",
    gov: "Community council and an elected Reeve", econ: "Farming, hunting, leatherwork, timber", tens: "Raiders, cult influence, strained resources, distrust of mages",
    orbit: ["Leben's Blessing"] },
  { id: "eisendreieck", name: "Eisendreieck", kind: "chapter", band: "Midlands", pos: [276, 701],
    blurb: "The last major settlement before the western wastelands: a city of smoke, stone and iron that survives by grit.",
    gov: "Bürgermeister council, mining guilds and the Patrician families", econ: "Iron ore, deep-shaft mining, metalwork, grain and livestock", tens: "Guild rivalries, mine-claim disputes, bandit raids, pressure from the western wastes",
    orbit: ["Eisendreieck Mines", "The College Foundry", "Aran's Rest", "Greyhook Pass"] },
  { id: "sudenburg", name: "Sudenburg", kind: "chapter", band: "Midlands", pos: [491, 593], major: true,
    blurb: "The largest city in the Abandoned Lands and the hub of the Chapter Network. If Sudenburg falls, everything falls with it.",
    gov: "The Broker, the Small Council and the Senate", econ: "Logistics capital: grain, ore, timber, salvage, shipping", tens: "Political factions, trade pressure, corruption whispers, relic smuggling",
    orbit: ["Zarnos (in ashes)", "Brasethis", "Vroshkar", "Krovidan (in ashes)", "Samrakel"] },
  { id: "stromstadt", name: "Stromstadt", kind: "chapter", band: "Midlands", pos: [326, 990],
    blurb: "A river-stop town where the Handra bends toward the eastern plains, with the hostile Rodinia Forest at its edge.",
    gov: "Town Council of riverfolk elders; the Trade Master seat is vacant", econ: "River trade, seasonal fishing, cider brewing, timber", tens: "Rodinia Forest and Fen attacks, stalled trade, a leaderless council",
    orbit: ["The River Docks", "Rodinia Forest Edge", "The Old Mill", "Southbrook Farms", "Greystone Ford", "Stonebrook Chapel"] },
  { id: "braylong", name: "Braylong", kind: "chapter", band: "Midlands", pos: [656, 738],
    blurb: "The eastern shield. Its north pass leads toward the Pale Host and its south swamp toward the Wildwrought. Every adult carries a weapon.",
    gov: "The Moot of local warbands", econ: "Gold panning, mining, ruin salvage, grain, hunting, warhound breeding", tens: "Isolation during invasions, warband resource conflicts",
    orbit: ["Northern Mountains (Ferren colony)", "Northern Riverlands", "Western Riverlands", "Southern Swamplands", "Southern Mountains", "Eastern Plains bunkers"] },
  { id: "handelsdorf", name: "Handelsdorf", kind: "chapter", band: "Midlands", pos: [425, 811],
    blurb: "A trade town on a bend of the River Handra. Whoever holds the nearby Ironwater Step controls the flow of the whole peninsula.",
    gov: "Town Council of guild leaders, warband captains and elected seats", econ: "River trade, ferries, barter markets, tolls, black-market relics", tens: "Merchants against warbands, council infighting, smuggling, marsh cult rumours",
    orbit: ["The Ironwater Step", "Kleiner Marsh", "Floodfields", "Sturmwald", "Graumorgen Weald", "Broken Bridge", "Morvanth's Ribs"] },
  { id: "weitnordlich", name: "Weitnördlich", kind: "chapter", band: "Southern Tropics", pos: [548, 1080],
    blurb: "A tropical outpost of the old Dominion. Its chapter page is still being written.",
    gov: "To be confirmed", econ: "To be confirmed", tens: "To be confirmed", orbit: [] },
  { id: "helsreik", name: "Helsreik", kind: "chapter", band: "Southern Tropics", pos: [327, 1199],
    blurb: "A southern gate between the Greyspine Mountains and the river routes. The mountains above it do not sleep.",
    gov: "Baron Jean Edgar Moreau, the Council of Stewards and his Magistrate", econ: "River tolls, ore refining, ironworks, logging, caravan contracts", tens: "Isolation, class resentment, disappearances near the mountains",
    orbit: ["Outpost Diem", "Timberward", "Hamlet Steads", "Brinehaven", "Hidden Ruins"] },
  { id: "reefwatch", name: "Reefwatch Keep", kind: "chapter", band: "Southern Tropics", pos: [343, 1438],
    blurb: "A rebuilt Dominion sea-fort clinging to the southern edge. Home waters of the Koru'Vea pirates, a Lesser Evil.",
    gov: "No formal rule; salvage crews and dock bosses", econ: "Ship salvage, relic trade, smuggling, coastal logistics", tens: "Crew power shifts, relic corruption, sea cults, cartel violence",
    orbit: ["Moonlight Lighthouse", "Uncharted Mangroves", "Blood River Hinterlands", "Coral Shoals", "Shattered Coast Ruins"] },
  { id: "dominion", name: "Road to the Dominion", kind: "border", band: "Beyond the network", pos: [360, 190],
    blurb: "The old imperial road north, through New Kriegstor. The Dominion withdrew and has not returned." },
  { id: "wastes", name: "The Western Wastes", kind: "realm", home: "gor", band: "Beyond the western border", pos: [85, 730],
    blurb: "Beyond Greyhook Pass. The Gor Horde presses the western border from here." },
  { id: "northpass", name: "The North Pass", kind: "realm", home: "pale", band: "Beyond Braylong", pos: [840, 600],
    blurb: "The pass beyond Braylong's Northern Riverlands, leading toward the Pale Host." },
  { id: "southswamp", name: "The South Swamp", kind: "realm", home: "wild", band: "Beyond Braylong", pos: [810, 890],
    blurb: "Braylong's wildest ground, and the pass that leads toward the Wildwrought." },
  { id: "whispering", name: "The Whispering Sea", kind: "sea", band: "Northern waters", pos: [800, 70], onArt: true,
    blurb: "Cold northern waters off Ritterstein. In the quiet between thunder boom and clap, the Drowned Court whispers." },
  { id: "witchlight", name: "Witchlight Cove", kind: "sea", band: "Western waters", pos: [165, 450], onArt: true,
    blurb: "The western cove below the northern highlands, opening to the outer sea." },
  { id: "dreamers", name: "Dreamers' Pool", kind: "sea", band: "Inland water", pos: [652, 318], onArt: true,
    blurb: "A long inland water between New Kriegstor and Bracken." },
  { id: "tricksters", name: "Tricksters' Loch", kind: "sea", band: "Southern waters", pos: [540, 1195], onArt: true,
    blurb: "A long sea loch reaching up from the south coast toward Weitnördlich." },
  { id: "shoals", name: "Dagger Shoals", kind: "sea", band: "Southern waters", pos: [225, 1375], onArt: true,
    blurb: "Reef-strewn waters beside Reefwatch Keep: wary Reefkin and whispered tales of leviathans." },
];
const R = Object.fromEntries(REGIONS.map(r => [r.id, r]));
const REGION_DEFAULTS = Object.fromEntries(REGIONS.map(r => [r.id, { name: r.name, blurb: r.blurb }]));
const CHAPTERS = REGIONS.filter(r => r.kind === "chapter");

const ROADS = [["kreigstor","dominion"],["kreigstor","ritterstein"],["kreigstor","bracken"],["kreigstor","sudenburg"],["bracken","sudenburg"],["sudenburg","eisendreieck"],["sudenburg","braylong"],["sudenburg","handelsdorf"],["eisendreieck","handelsdorf"],["handelsdorf","braylong"],["handelsdorf","stromstadt"],["handelsdorf","weitnordlich"],["stromstadt","helsreik"],["weitnordlich","helsreik"],["helsreik","reefwatch"],["weitnordlich","reefwatch"],["eisendreieck","wastes"],["braylong","northpass"],["braylong","southswamp"]];
const LANES = [["ritterstein","whispering"],["reefwatch","shoals"],["helsreik","shoals"],["weitnordlich","tricksters"],["bracken","dreamers"],["kreigstor","dreamers"]];

/* Regional maps drawn by each chapter. Regions without one zoom into Shani's map instead. */
const DETAIL = {
  bracken: { src: "maps/bracken.jpg", w: 1600, h: 1200 },
  braylong: { src: "maps/braylong.jpg", w: 1600, h: 1200 },
  handelsdorf: { src: "maps/handelsdorf.jpg", w: 1600, h: 1066 },
  eisendreieck: { src: "maps/eisendreieck.jpg", w: 1024, h: 768 },
  helsreik: { src: "maps/helsreik.jpg", w: 1600, h: 1200 },
  reefwatch: { src: "maps/reefwatch.jpg", w: 853, h: 480 },
  sudenburg: { src: "maps/sudenburg.jpg", w: 1600, h: 1600 },
};
/* Named sites on each regional map, as fractions of the map's width and height. */
const SITE_SEED = {
  bracken: [["Bracken Village", .46, .47], ["Lumber Mill", .12, .09], ["Forest Glade", .18, .25], ["Ancient Ruin", .06, .37], ["Bridge", .90, .65], ["Arcane Ruins", .44, .06], ["Shadow Ruin", .11, .58], ["Frostgrave Watch Tower", .35, .92], ["Fort Blackridge", .54, .79], ["Abandoned Mine", .44, .88], ["Old Battlefield", .68, .83], ["Hidden Hut", .31, .79], ["Hunting Lodge", .71, .67], ["Caves", .86, .87], ["Ruined Hamlet", .79, .93], ["The Leap", .49, .83]],
  braylong: [["Braylong", .54, .50], ["Velaris", .58, .05], ["Halls of Aspiration", .61, .28], ["Ravenfield", .26, .25], ["Beacon Star", .21, .51], ["The Exchange", .12, .49], ["Tower of Vigilance", .73, .52], ["Edjerha", .50, .71], ["Sage Shrine", .23, .81], ["Rubrician", .61, .90], ["Broken Grotto", .85, .78]],
  sudenburg: [["Sudenburg", .63, .63], ["Samrakel", .42, .14], ["Stoneforge Hold", .59, .36], ["Brasethis", .40, .40], ["Krovidan", .08, .43], ["Zarnos", .92, .58], ["Korgemar Keep", .72, .59], ["Berlain's Tower", .56, .70], ["Sebastian's Keep", .69, .72], ["Vroshkar", .43, .79]],
  helsreik: [["Helsreik", .33, .46], ["Outpost Diem", .19, .03], ["Timberward", .67, .40], ["Farm", .46, .47], ["Brinehaven", .15, .72], ["Bridge", .39, .52]],
  eisendreieck: [["Eisendreieck", .13, .80], ["Watchtower", .10, .70], ["The Foundry", .51, .14], ["The Mine", .69, .13], ["North-west encampment", .18, .12], ["North-east encampment", .82, .24], ["East encampment", .88, .46], ["Ruins (north)", .68, .28], ["Ruins (centre)", .56, .44], ["Ruins (west)", .45, .34], ["Ruins (east)", .78, .44], ["Ruins (south)", .69, .59], ["Ruins (south-east)", .78, .63], ["Ruins (south-west)", .51, .66], ["West farms", .18, .55], ["South farms", .27, .70], ["Far south farms", .54, .97], ["Waystation", .82, .92], ["The swamp", .16, .37], ["The Barrens", .93, .86]],
  handelsdorf: [["Handelsdorf", .52, .27], ["Golden Crescent", .46, .24], ["Dirge of the Tides", .49, .15], ["Floodfields", .58, .24], ["Saint Anissa Farm", .58, .29], ["Company of the Black Rose", .64, .31], ["East Lumber Mill", .71, .33], ["West Lumber Mill", .44, .33], ["Kleiner Marsh", .33, .29], ["Great Kurgan", .12, .31], ["Skjöldling Raiders", .19, .27], ["Shadow's Crew", .03, .36], ["Morvanth's Ribs", .49, .39], ["Bärenhurst", .72, .41], ["Peligrosa Lumber Mill", .15, .44], ["Weisshardt Farm", .29, .42], ["Crusaders of Aquitaine", .04, .47], ["Gezwitscher Plains", .30, .48], ["Graumorgen Weald", .45, .49], ["Blud Mine", .33, .55], ["Hügel Mine", .69, .52], ["Bloody Oaks Lumber Mill", .60, .56], ["Order of the Wyverns", .83, .48], ["Le Roche Mine", .03, .56], ["Notre Terre Farm", .04, .63], ["Sturmwald", .63, .61], ["Zwirchau Mine", .88, .59], ["Zweimond Lake", .28, .65], ["Alfeblod Lumber Mill", .20, .70], ["Akisen Legion", .45, .70], ["Broken Bridge", .75, .67], ["Doppelsöldner Mine", .95, .68], ["Farm ruins", .80, .72], ["Gräten Lake", .60, .77], ["Sab-Mith Mine", .04, .82], ["Fyremead Farm", .45, .83], ["Ashwood Path", .42, .97], ["Elves of the Everfrost", .08, .97]],
  reefwatch: [["Reefwatch Keep", .56, .86], ["Docks", .45, .93], ["Market", .50, .82], ["Mine and Quarry", .55, .73], ["Lumber Camp", .72, .71], ["Lighthouse", .13, .27], ["Dagger Shoals", .22, .47], ["Old Dominion Road", .49, .40], ["Blood River", .77, .45]],
};
const slug = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const BUILTIN_SITES = {};
for (const id in SITE_SEED) BUILTIN_SITES[id] = SITE_SEED[id].map(([name, x, y]) => ({ id: id + "-" + slug(name), region: id, name, x, y, builtin: true }));

/* Opening positions: where the guidebook says each evil presses. Shown until the shared log has events. */
const OPENING = { id: "opening", order: 0, title: "Opening positions", when: "NST Guidebook, October 2026", chapter: "national", visibility: "public",
  summary: "Where each External Evil presses at the start of the story, as the guidebook sets out. Tokens show pressure on that front, using the Power Scale.",
  changes: [ { type: "set", evil: "gor", region: "wastes", tier: 3 }, { type: "set", evil: "pale", region: "northpass", tier: 3 },
    { type: "set", evil: "wild", region: "southswamp", tier: 3 }, { type: "set", evil: "drowned", region: "whispering", tier: 3 },
    { type: "set", evil: "drowned", region: "shoals", tier: 2 } ] };

/* ---------- App state ---------- */
const S = {
  logFilter: "", events: [], sites: {}, notes: {}, usingFallback: true, idx: 0, layer: "public", hidden: new Set(), focus: null, selected: null, hover: null,
  site: null, siteEdit: false, pendingSite: null,
  tab: "threats", downloads: null,
  positions: {}, layoutMode: false, draft: null, playing: false, confirmDel: null,
  vb: { x: 0, y: 0, w: W, h: H },
  settings: { notice: { text: NOTICE_TEXT, done: [] }, regions: {}, danger: {}, turns: {} }, placing: null,
};
const Store = { mode: "local", me: { role: "viewer", name: "", chapters: [] } };
try { const l = localStorage.getItem("alwm.layer"); if (l && VIS_RANK[l] !== undefined) S.layer = l; } catch (e) {}
try { const h = JSON.parse(localStorage.getItem("alwm.hidden") || "[]"); h.forEach(x => S.hidden.add(x)); } catch (e) {}
try { const ly = JSON.parse(localStorage.getItem("alwm.layers") || "{}"); for (const k in ly) { const el = document.getElementById(k); if (el) el.checked = !!ly[k]; } } catch (e) {}

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const posOf = id => S.positions[id] || R[id].pos;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3000); }

/* ---------- Permissions ---------- */
const role = () => Store.me.role || "viewer";
const isLead = () => role() === "lead";
const isNST = () => role() === "nst" || isLead();
const canDraft = () => isNST() || role() === "rep";
const myChapters = () => isNST() ? CHAPTERS.map(r => r.id) : (Store.me.chapters || []);
const canEditRegion = id => isNST() || (role() === "rep" && myChapters().includes(id));
const canEditEvent = ev => isNST() || (role() === "rep" && myChapters().includes(ev.chapter));
const maxLayer = () => ROLES[role()]?.max || "public";
/* Story team codes can add details to places in their own chapters. */
const canSiteDetails = id => canEditRegion(id) || (role() === "story" && (Store.me.chapters || []).includes(id));
/* Built-in place names belong to the NST Lead; reps name the places they add. */
const canRenameSite = s => isLead() || (!!s.custom && canEditRegion(s.region));

/* The NST Lead can rename regions and rewrite their descriptions. */
function applyRegionInfo() {
  const o = S.settings.regions || {};
  REGIONS.forEach(r => { const d = REGION_DEFAULTS[r.id], x = o[r.id] || {}; r.name = x.name || d.name; r.blurb = x.blurb || d.blurb; });
}
const noticeOn = id => !!(S.settings.notice?.text) && !(S.settings.notice.done || []).includes(id);

/* ---------- Sites ---------- */
function viewOf(id) {
  const d = DETAIL[id];
  if (d) return { src: d.src, x: 0, y: 0, w: d.w, h: d.h, detail: true };
  const cw = 340, ch = 255, [px, py] = posOf(id);
  const x = Math.max(0, Math.min(W - cw, px - cw / 2)), y = Math.max(0, Math.min(H - ch, py - ch / 2));
  return { src: MAIN_SRC, x, y, w: cw, h: ch, crop: true };
}
function sitesFor(id, withHidden) {
  let list;
  if (BUILTIN_SITES[id]) list = BUILTIN_SITES[id].map(s => ({ ...s }));
  else { const v = viewOf(id), [px, py] = posOf(id); list = [{ id: id + "-centre", region: id, name: R[id].name, x: (px - v.x) / v.w, y: (py - v.y) / v.h, builtin: true }]; }
  const byId = Object.fromEntries(list.map(s => [s.id, s]));
  for (const sid in S.sites) {
    const d = S.sites[sid]; if (!d || d.region !== id) continue;
    if (byId[sid]) Object.assign(byId[sid], { name: d.name || byId[sid].name, x: d.x ?? byId[sid].x, y: d.y ?? byId[sid].y, hidden: !!d.hidden, note: d.note || "", story: d.story || "" });
    else { const s = { id: sid, region: id, name: d.name || "New site", x: +d.x, y: +d.y, hidden: !!d.hidden, note: d.note || "", story: d.story || "", custom: true }; list.push(s); byId[sid] = s; }
  }
  return withHidden ? list : list.filter(s => !s.hidden);
}
function siteName(region, sid) { if (!sid) return ""; const s = sitesFor(region, true).find(x => x.id === sid); return s ? s.name : "an unmarked site"; }
function siteXY(v, s) { return [v.x + s.x * v.w, v.y + s.y * v.h]; }

/* ---------- Story engine ---------- */
function visibleEvents() {
  const src = S.usingFallback ? [OPENING] : S.events;
  return src.filter(e => VIS_RANK[e.visibility || "public"] <= VIS_RANK[S.layer]).slice().sort((a, b) => turnKey(a) - turnKey(b) || (a.order ?? 0) - (b.order ?? 0));
}
/* Turns: the NST Team opens each turn of the national story, and every entry posted meanwhile goes into it.
   Entries saved before turns existed have no turn, so each one is its own turn, keyed by its order. */
const turnKey = e => e.turn != null && e.turn !== "" ? +e.turn : +(e.order ?? 0);
function allTurnKeys() {
  const keys = new Set((S.usingFallback ? [OPENING] : S.events).map(turnKey));
  const open = S.settings.turns?.open; if (open != null) keys.add(+open);
  return [...keys].sort((a, b) => a - b);
}
/* The turn new entries go into: the one the NST Team opened last, or the latest turn with entries. */
function openTurnKey() { const k = allTurnKeys(); return k.length ? k[k.length - 1] : 0; }
const turnNo = key => allTurnKeys().indexOf(+key) + 1;
const turnLabel = key => S.settings.turns?.labels?.[key] || "";
const turnName = key => `Year ${turnNo(key)}${turnLabel(key) ? " · " + turnLabel(key) : ""}`;
let TURNS = [];
function turnIndexOf(i) { const t = TURNS.findIndex(x => i >= x.first && i <= x.last); return t < 0 ? TURNS.length - 1 : t; }
const curTurn = () => TURNS[turnIndexOf(S.idx)];
function blankRegion() { return { p: {}, base: {}, at: {}, threats: {}, marks: {}, status: null, note: "" }; }
function blankState() { const s = {}; REGIONS.forEach(r => s[r.id] = blankRegion()); return s; }
function cloneState(s) {
  const o = {};
  for (const k in s) {
    const r = s[k], at = {}, th = {}, mk = {};
    for (const x in r.at) at[x] = { ...r.at[x] };
    for (const t in r.threats) th[t] = { ...r.threats[t] };
    for (const m in r.marks) mk[m] = { ...r.marks[m] };
    o[k] = { p: { ...r.p }, base: { ...r.base }, at, threats: th, marks: mk, status: r.status, note: r.note };
  }
  return o;
}
const clampT = (t, lo = 0) => Math.max(lo, Math.min(5, Math.round(+t || 0)));
function recalc(r) { r.p = {}; for (const k of EVIL_ORDER) { let t = r.base[k] || 0; for (const sid in r.at) t = Math.max(t, r.at[sid][k] || 0); if (t) r.p[k] = t; } }
function clearEvil(r, k, site) {
  if (site) { if (r.at[site]) { delete r.at[site][k]; if (!Object.keys(r.at[site]).length) delete r.at[site]; } return; }
  delete r.base[k]; for (const sid in r.at) clearEvil(r, k, sid);
}
function findThreat(s, tid) { for (const id in s) if (s[id].threats[tid]) return id; return null; }
function findMark(s, mid) { for (const id in s) if (s[id].marks[mid]) return id; return null; }
const markName = m => m.label || MARKS[m.icon]?.name || "Pinpoint";
function threatName(t) { return t.name || (t.kind === "lesser" ? LESSER[t.group]?.name : OTHER[t.group]) || "Unnamed threat"; }
function threatKind(t) { return t.kind === "lesser" ? "Lesser Evil" + (t.name && LESSER[t.group] && t.name !== LESSER[t.group].name ? " · " + LESSER[t.group].name : "") : "Other threat · " + (OTHER[t.group] || "Unknown"); }
function applyEvent(prev, ev) {
  const s = cloneState(prev);
  for (const c of ev.changes || []) {
    if (c.type === "set" && s[c.region] && EVILS[c.evil]) {
      const r = s[c.region], t = clampT(c.tier);
      if (c.site) { if (t) (r.at[c.site] ||= {})[c.evil] = t; else clearEvil(r, c.evil, c.site); }
      else if (t) r.base[c.evil] = t;
      else if (c.all) clearEvil(r, c.evil);
      else delete r.base[c.evil];
      recalc(r);
    } else if (c.type === "move" && s[c.from] && s[c.to] && EVILS[c.evil]) {
      const a = s[c.from], b = s[c.to];
      const had = c.fromSite ? (a.at[c.fromSite]?.[c.evil] || 0) : (a.p[c.evil] || 0);
      const t = clampT(c.tier || had || 1, 1);
      if (!c.keep) clearEvil(a, c.evil, c.fromSite || null);
      if (c.toSite) (b.at[c.toSite] ||= {})[c.evil] = t; else b.base[c.evil] = t;
      recalc(a); recalc(b);
    } else if (c.type === "status" && s[c.region]) {
      s[c.region].status = c.status && c.status !== "none" ? c.status : null; s[c.region].note = c.note || "";
    } else if (c.type === "threat" && c.tid) {
      const was = findThreat(s, c.tid), old = was ? s[was].threats[c.tid] : null;
      if (was) delete s[was].threats[c.tid];
      if (c.remove) continue;
      const reg = s[c.region] ? c.region : was; if (!reg) continue;
      s[reg].threats[c.tid] = { tid: c.tid, kind: c.kind || old?.kind || "other", group: c.group || old?.group || "unknown", name: c.name || old?.name || "",
        tier: clampT(c.tier || old?.tier || 1, 1), site: c.site ?? old?.site ?? "", note: c.note ?? old?.note ?? "" };
    } else if (c.type === "mark" && c.mid) {
      const was = findMark(s, c.mid), old = was ? s[was].marks[c.mid] : null;
      if (was) delete s[was].marks[c.mid];
      if (c.remove) continue;
      const reg = s[c.region] ? c.region : was; if (!reg) continue;
      // A pinpoint sits at a site, at a spot on the region's map (x, y as fractions), or region-wide.
      const placed = !!c.site || c.x != null || !!c.wide, keepOld = !placed && reg === was && old;
      s[reg].marks[c.mid] = { mid: c.mid, icon: MARKS[c.icon] ? c.icon : old?.icon || "pin", label: c.label ?? old?.label ?? "", note: c.note ?? old?.note ?? "",
        site: placed ? c.site || "" : keepOld ? old.site : "", x: placed ? (c.site ? null : +c.x) : keepOld ? old.x : null, y: placed ? (c.site ? null : +c.y) : keepOld ? old.y : null };
    }
  }
  return s;
}
let EV = [], STATES = [];
function rebuild() {
  EV = visibleEvents();
  STATES = []; let s = blankState();
  EV.forEach(e => { s = applyEvent(s, e); STATES.push(s); });
  TURNS = [];
  EV.forEach((e, i) => { const k = turnKey(e), t = TURNS[TURNS.length - 1]; if (t && t.key === k) { t.last = i; t.events.push(e); } else TURNS.push({ key: k, first: i, last: i, events: [e] }); });
  if (S.idx > EV.length - 1) S.idx = Math.max(0, EV.length - 1);
  // The map always shows the end of a turn: every entry in it has happened.
  if (TURNS.length) S.idx = TURNS[turnIndexOf(S.idx)].last;
}
function currentState() {
  if (S.draft && S.draft.changes.length) return applyEvent(draftBaseState(), S.draft);
  return STATES[S.idx] || blankState();
}
function draftBaseState() {
  if (!S.draft) return STATES[S.idx] || blankState();
  if (S.draft.id) { const i = EV.findIndex(e => e.id === S.draft.id); return i > 0 ? STATES[i - 1] : blankState(); }
  return STATES[EV.length - 1] || blankState();
}
function prevStateOf(i) { return i > 0 ? STATES[i - 1] : blankState(); }
function prevForView() { return S.draft && S.draft.changes.length ? draftBaseState() : prevStateOf(curTurn() ? curTurn().first : S.idx); }
/* The turn on screen, as one event: its own entry, or all its entries' changes together. */
function currentEvent() {
  if (S.draft && S.draft.changes.length) return S.draft;
  const t = curTurn(); if (!t) return EV[S.idx];
  if (t.events.length === 1) return t.events[0];
  const vis = t.events.reduce((m, e) => VIS_RANK[e.visibility || "public"] > VIS_RANK[m] ? e.visibility || "public" : m, "public");
  return { turn: t.key, multi: t.events, title: turnName(t.key), when: "", chapter: "national", visibility: vis, changes: t.events.flatMap(e => e.changes || []) };
}
const threatShown = () => $("ly-threats").checked;
function allThreats(st) { const out = []; for (const id in st) for (const tid in st[id].threats) out.push({ ...st[id].threats[tid], region: id }); return out; }
function allMarks(st) { const out = []; for (const id in st) for (const mid in st[id].marks) out.push({ ...st[id].marks[mid], region: id }); return out; }
const marksShown = () => $("ly-marks").checked;
/* The latest event, up to the step on screen, with a change matching `test`. */
function lastChange(test) {
  const upto = S.draft && S.draft.changes.length ? EV.length - 1 : S.idx;
  if (S.draft && S.draft.changes.some(test)) return { title: S.draft.title || "your draft", when: "" };
  for (let i = upto; i >= 0; i--) if (EV[i] && (EV[i].changes || []).some(test)) return EV[i];
  return null;
}

/* Danger: worked out from the threats and the condition at the step on screen. The NST Team can set a region's level by hand. */
const DANGER = [
  { name: "Calm", color: "var(--ok)", feel: "Roads are open and markets are busy. People sleep easy." },
  { name: "Uneasy", color: "var(--uneasy)", feel: "Odd tales on the roads. Travellers keep together and watch the treeline." },
  { name: "Dangerous", color: "var(--warn)", feel: "Travel needs an escort. Prices are rising and outlying farms are emptying." },
  { name: "Perilous", color: "var(--peril)", feel: "Travel is unsafe after dark. Supplies run short and the wardens are calling for help." },
  { name: "Dire", color: "var(--bad)", feel: "The region is fighting to survive. Few roads in or out are safe." },
];
function dangerOf(st, id) {
  const here = st[id], why = [];
  let top = 0;
  for (const k of EVIL_ORDER) if (here.p[k]) { top = Math.max(top, here.p[k]); why.push(`${EVILS[k].short} at tier ${here.p[k]}`); }
  for (const t of Object.values(here.threats)) { top = Math.max(top, t.tier); why.push(`${threatName(t)} at tier ${t.tier}`); }
  let lv = Math.min(4, top);
  if (why.length >= 3 && lv < 4) { lv++; why.push(`${why.length} threats at once`); }
  if (here.status === "threatened") { lv = Math.max(lv, 1); why.push("region threatened"); }
  if (here.status === "besieged") { lv = Math.min(4, Math.max(lv + 1, 2)); why.push("region besieged"); }
  if (here.status === "fallen") { lv = 4; why.push("region fallen"); }
  if (here.status === "liberated" && lv > 0) { lv--; why.push("recently liberated"); }
  // A level set by the NST Team describes the story now, so it only applies at the latest step.
  const o = S.settings.danger?.[id], latest = !(S.draft && S.draft.changes.length) && S.idx >= EV.length - 1;
  if (o && DANGER[o.level] && latest) return { lv: +o.level, why: [o.why || "Set by the NST Team"], feel: o.feel || DANGER[o.level].feel, set: true, auto: lv };
  return { lv, why, feel: DANGER[lv].feel, set: false, auto: lv };
}
const dangerShown = () => $("ly-danger").checked;
function dangerPill(d) { return `<span class="pill danger" style="--dc:${DANGER[d.lv].color}">${DANGER[d.lv].name}</span>`; }
function dangerGauge(lv) { return `<div class="dgauge" aria-hidden="true">${DANGER.map((x, i) => `<span style="background:${x.color};opacity:${i <= lv ? 1 : .2}"></span>`).join("")}</div>`; }
function paintDanger(st) {
  G.cities.querySelectorAll(".citygrp").forEach(g => {
    const ring = g.querySelector(".city-ring"); if (!ring) return;
    if (dangerShown()) { const d = dangerOf(st, g.dataset.region); ring.style.stroke = DANGER[d.lv].color; ring.classList.add("dz"); }
    else { ring.style.stroke = ""; ring.classList.remove("dz"); }
  });
}

/* ---------- Map geometry, traced from Shani Downing's map of the Abandoned Lands ---------- */
/*__MASKS__*/
const ptsD = poly => "M" + poly.map(p => (+p[0]).toFixed(1) + "," + (+p[1]).toFixed(1)).join("L") + "Z";
const LAND_D = MASKS.land.map(ptsD).join(" ");
const WATER_D = MASKS.water.map(ptsD).join(" ");
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) if (attrs[k] !== undefined && attrs[k] !== null) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

const svg = $("map");
let G = {};
function buildMapSkeleton() {
  svg.innerHTML = "";
  const defs = el("defs", {}, svg);
  const cpL = el("clipPath", { id: "clip-land" }, defs); el("path", { d: LAND_D }, cpL);
  const cpO = el("clipPath", { id: "clip-outer" }, defs); el("path", { d: `M0,0H${W}V${H}H0Z ` + LAND_D, "clip-rule": "evenodd" }, cpO);
  const cpW = el("clipPath", { id: "clip-water" }, defs); el("path", { d: WATER_D }, cpW);
  EVIL_ORDER.forEach(k => {
    const p = el("pattern", { id: "hatch-" + k, width: 12, height: 12, patternUnits: "userSpaceOnUse", patternTransform: "rotate(35)" }, defs);
    el("rect", { width: 12, height: 12, fill: `var(--${k})`, "fill-opacity": .14 }, p);
    el("line", { x1: 0, y1: 0, x2: 0, y2: 12, stroke: `var(--${k})`, "stroke-width": 4, "stroke-opacity": .55 }, p);
    const m = el("marker", { id: "ah-" + k, viewBox: "0 0 10 10", refX: 6, refY: 5, markerWidth: 4.5, markerHeight: 4.5, orient: "auto-start-reverse" }, defs);
    el("path", { d: "M0,0L10,5L0,10z", fill: `var(--${k})` }, m);
  });
  siegePattern(defs, "hatch-siege", 12);

  G.root = el("g", { id: "vp" }, svg);
  el("rect", { x: -3000, y: -3000, width: W + 6000, height: H + 6000, fill: "var(--sea-deep)" }, G.root);
  G.plain = el("g", {}, G.root);
  el("rect", { x: 0, y: 0, width: W, height: H, fill: "var(--land-wild)" }, G.plain);
  el("path", { d: WATER_D, fill: "var(--sea)" }, G.plain);
  el("path", { d: LAND_D, fill: "var(--land)" }, G.plain);
  G.base = el("image", { id: "base-art", href: MAIN_SRC, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none" }, G.root);
  G.outerTerr = el("g", { "clip-path": "url(#clip-outer)" }, G.root);
  G.seaTerr = el("g", { "clip-path": "url(#clip-water)" }, G.root);
  G.landTerr = el("g", { "clip-path": "url(#clip-land)" }, G.root);
  G.outerTint = el("g", { "clip-path": "url(#clip-outer)" }, G.root);
  G.seaTint = el("g", { "clip-path": "url(#clip-water)" }, G.root);
  G.tint = el("g", { "clip-path": "url(#clip-land)" }, G.root);
  G.coast = el("path", { d: LAND_D, class: "coast", "pointer-events": "none" }, G.root);
  G.routes = el("g", { "pointer-events": "none" }, G.root);
  G.trails = el("g", { "pointer-events": "none" }, G.root);
  G.arrows = el("g", { "pointer-events": "none" }, G.root);
  G.status = el("g", { "pointer-events": "none" }, G.root);
  G.cities = el("g", {}, G.root);
  G.clash = el("g", { "pointer-events": "none" }, G.root);
  G.threats = el("g", {}, G.root);
  G.marks = el("g", {}, G.root);
  G.tokens = el("g", {}, G.root);
  G.fx = el("g", { "pointer-events": "none" }, G.root);
}
let VOR = { land: [], outer: [], sea: [] };
function computeCells() {
  const make = list => {
    const pts = list.map(r => posOf(r.id));
    if (pts.length < 2) return list.map(r => ({ id: r.id, poly: [[0, 0], [W, 0], [W, H], [0, H]] }));
    const vor = d3.Delaunay.from(pts).voronoi([-40, -40, W + 40, H + 40]);
    return list.map((r, i) => ({ id: r.id, poly: vor.cellPolygon(i) }));
  };
  VOR.land = make(REGIONS.filter(r => r.kind === "chapter"));
  VOR.outer = make(REGIONS.filter(r => r.kind === "realm" || r.kind === "border"));
  VOR.sea = make(REGIONS.filter(r => r.kind === "sea"));
}
const polyD = poly => poly ? ptsD(poly) : "";
const tintLayer = id => R[id].kind === "sea" ? G.seaTint : R[id].kind === "chapter" ? G.tint : G.outerTint;
const clipOf = id => R[id].kind === "sea" ? "url(#clip-water)" : R[id].kind === "chapter" ? "url(#clip-land)" : "url(#clip-outer)";
/* Besieged regions get red hatching; fallen ones are blacked out. */
function siegePattern(defs, id, size) {
  const p = el("pattern", { id, width: size, height: size, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
  el("rect", { width: size, height: size, fill: "var(--bad)", "fill-opacity": .12 }, p);
  el("line", { x1: 0, y1: 0, x2: 0, y2: size, stroke: "var(--bad)", "stroke-width": size * .32, "stroke-opacity": .62 }, p);
  return p;
}
function statusFill(status, d, parent) {
  if (status === "fallen") el("path", { d, class: "blackout", "pointer-events": "none" }, parent);
  else if (status === "besieged") el("path", { d, fill: "url(#hatch-siege)", "pointer-events": "none" }, parent);
}
const cellOf = id => [...VOR.land, ...VOR.outer, ...VOR.sea].find(c => c.id === id);
function drawTerritories() {
  computeCells();
  G.landTerr.innerHTML = ""; G.seaTerr.innerHTML = ""; G.outerTerr.innerHTML = "";
  const artOn = $("ly-art").checked;
  G.base.style.display = artOn ? "" : "none";
  G.plain.style.display = artOn ? "none" : "";
  const add = (cells, parent, cls) => cells.forEach(c => {
    const p = el("path", { d: polyD(c.poly), class: "terr " + cls, "data-region": c.id, fill: "transparent" }, parent);
    if (S.selected === c.id) p.classList.add("sel");
  });
  add(VOR.outer, G.outerTerr, "outer"); add(VOR.sea, G.seaTerr, "sea"); add(VOR.land, G.landTerr, "land");
  G.coast.style.display = $("ly-borders").checked ? "" : "none";
  [G.landTerr, G.seaTerr, G.outerTerr].forEach(g => g.classList.toggle("noborder", !$("ly-borders").checked));
}
function drawRoutes() {
  G.routes.innerHTML = "";
  if (!$("ly-routes").checked) return;
  const line = (a, b, cls) => { const [x1, y1] = posOf(a), [x2, y2] = posOf(b); const mx = (x1 + x2) / 2 + (y2 - y1) * .08, my = (y1 + y2) / 2 - (x2 - x1) * .08; el("path", { d: `M${x1},${y1}Q${mx},${my} ${x2},${y2}`, class: cls }, G.routes); };
  ROADS.forEach(([a, b]) => line(a, b, "road")); LANES.forEach(([a, b]) => line(a, b, "lane"));
}

/* ---------- Tokens, cities, overlays ---------- */
const SLOT = { pale: [40, -25], drowned: [88, -25], gor: [40, 25], wild: [88, 25] };
function slotPos(regionId, evil) { const [x, y] = posOf(regionId), [dx, dy] = SLOT[evil]; return [x + dx, y + dy]; }
function shapePath(shape, r) {
  if (shape === "diamond") return `M0,${-r * 1.2}L${r * 1.1},0L0,${r * 1.2}L${-r * 1.1},0Z`;
  if (shape === "square") return `M${-r * .92},${-r * .92}H${r * .92}V${r * .92}H${-r * .92}Z`;
  if (shape === "triangle") return `M0,${-r * 1.25}L${r * 1.15},${r * .8}H${-r * 1.15}Z`;
  if (shape === "hex") { const a = []; for (let i = 0; i < 6; i++) { const t = Math.PI / 3 * i; a.push(`${(r * 1.08 * Math.cos(t)).toFixed(2)},${(r * 1.08 * Math.sin(t)).toFixed(2)}`); } return "M" + a.join("L") + "Z"; }
  if (shape === "shield") return `M${-r},${-r * .9}H${r}V${r * .15}Q${r},${r * .75} 0,${r * 1.15}Q${-r},${r * .75} ${-r},${r * .15}Z`;
  return `M${-r},0A${r},${r} 0 1,0 ${r},0A${r},${r} 0 1,0 ${-r},0Z`;
}
function tokenEl(evil, tier, parent) {
  const g = el("g", { class: "tok", "data-evil": evil }, parent);
  el("path", { class: "halo", d: shapePath(EVILS[evil].shape, 23), stroke: `var(--${evil})` }, g);
  el("path", { class: "shape", d: shapePath(EVILS[evil].shape, 22), fill: `var(--${evil})` }, g);
  const t = el("text", { class: "num", y: EVILS[evil].shape === "triangle" ? 3 : 0 }, g); t.textContent = tier;
  return g;
}
const thrColor = t => t.kind === "lesser" ? "var(--lesser)" : "var(--other)";
function threatEl(t, parent, r = 13) {
  const g = el("g", { class: "thr", "data-tid": t.tid }, parent);
  el("path", { class: "shape", d: shapePath(t.kind === "lesser" ? "hex" : "shield", r), fill: thrColor(t) }, g);
  const n = el("text", { class: "num", "font-size": r * 1.15, y: t.kind === "lesser" ? 0 : -r * .02 }, g); n.textContent = t.tier;
  return g;
}
/* A map pin with its tip at (0, 0). */
function pinEl(m, parent, r = 10) {
  const g = el("g", { class: "mk", "data-mid": m.mid }, parent);
  const cy = -r * 1.9;
  el("path", { class: "shape", d: `M0,0L${-r * .866},${cy + r * .5}A${r},${r} 0 1,1 ${r * .866},${cy + r * .5}Z` }, g);
  const t = el("text", { class: "glyph", y: cy, "font-size": r * 1.15 }, g); t.textContent = MARKS[m.icon]?.glyph || "●";
  return g;
}
function drawCities() {
  G.cities.innerHTML = "";
  const names = $("ly-names").checked;
  REGIONS.forEach(r => {
    const [x, y] = posOf(r.id);
    const g = el("g", { class: "citygrp", "data-region": r.id, transform: `translate(${x},${y})` }, G.cities);
    if (r.kind === "chapter") {
      el("circle", { class: "city-ring", r: r.major ? 17 : 14 }, g);
      if (names || !$("ly-art").checked) { const t = el("text", { class: "mlabel", y: 44, "text-anchor": "middle", "font-size": r.major ? 30 : 25 }, g); t.textContent = r.name; }
    } else if (r.kind === "sea") {
      el("circle", { r: 5, fill: "var(--river)", "fill-opacity": .7 }, g);
      if (names || !r.onArt || !$("ly-art").checked) { const t = el("text", { class: "mlabel sea", y: 32, "text-anchor": "middle", "font-size": 24 }, g); t.textContent = r.name; }
    } else {
      el("circle", { r: 5, fill: "var(--label)", "fill-opacity": .7 }, g);
      const t = el("text", { class: "mlabel realm", y: 34, "text-anchor": "middle", "font-size": 27 }, g); t.textContent = r.name;
      if (r.home) { const s2 = el("text", { class: "mlabel feat", y: 58, "text-anchor": "middle" }, g); s2.textContent = "Front of " + EVILS[r.home].name; }
    }
    el("circle", { r: 26, fill: "transparent" }, g);
  });
}
function drawOverlays(opts = {}) {
  const st = currentState();
  paintDanger(st); paintCalendar();
  const ev = currentEvent();
  const prev = prevForView();
  const fresh = opts.fresh !== false;
  const hiddenTok = opts.hiddenTok || new Set();
  // tint
  G.tint.innerHTML = ""; G.seaTint.innerHTML = ""; G.outerTint.innerHTML = "";
  if ($("ly-tint").checked) {
    [...VOR.land, ...VOR.outer, ...VOR.sea].forEach(c => {
      const p = st[c.id].p; const keys = Object.keys(p).filter(k => !S.hidden.has(k));
      const parent = tintLayer(c.id);
      if (!keys.length) return;
      keys.sort((a, b) => p[b] - p[a]);
      const top = keys[0];
      const dim = S.focus && S.focus !== top;
      el("path", { d: polyD(c.poly), fill: `var(--${top})`, "fill-opacity": dim ? .03 : Math.min(.42, .07 * p[top] + .04), "pointer-events": "none" }, parent);
      if (keys.length > 1) el("path", { d: polyD(c.poly), fill: `url(#hatch-${keys[1]})`, "pointer-events": "none", opacity: dim ? .2 : 1 }, parent);
    });
  }
  // fallen and besieged regions show even with threat shading off
  [...VOR.land, ...VOR.outer, ...VOR.sea].forEach(c => statusFill(st[c.id].status, polyD(c.poly), tintLayer(c.id)));
  // status rings
  G.status.innerHTML = "";
  REGIONS.forEach(r => {
    const s = st[r.id].status; if (!s || s === "holding") return;
    const [x, y] = posOf(r.id);
    const col = s === "threatened" ? "var(--warn)" : s === "besieged" ? "var(--bad)" : s === "liberated" ? "var(--ok)" : "var(--muted)";
    el("circle", { class: "status-ring", cx: x, cy: y, r: 23, stroke: col, "stroke-dasharray": s === "threatened" ? "4 3" : null }, G.status);
  });
  // trails (earlier moves up to current step)
  G.trails.innerHTML = "";
  if ($("ly-trails").checked) {
    const upto = S.draft && S.draft.changes.length ? EV.length : (curTurn() ? curTurn().first : S.idx);
    for (let i = 0; i < upto; i++) (EV[i].changes || []).forEach(c => {
      if (c.type !== "move" || S.hidden.has(c.evil) || !R[c.from] || !R[c.to] || c.from === c.to) return;
      el("path", { class: "trail", d: arcD(posOf(c.from), posOf(c.to), .18), stroke: `var(--${c.evil})`, opacity: S.focus && S.focus !== c.evil ? .2 : 1 }, G.trails);
    });
  }
  // arrows for this step's moves
  G.arrows.innerHTML = "";
  (ev?.changes || []).forEach(c => {
    if (c.type !== "move" || S.hidden.has(c.evil) || !R[c.from] || !R[c.to] || c.from === c.to) return;
    const a = posOf(c.from), b = posOf(c.to);
    const bb = shorten(a, b, 30);
    el("path", { class: "arrow", d: arcD(a, bb, .18), stroke: `var(--${c.evil})`, "marker-end": `url(#ah-${c.evil})`, opacity: S.focus && S.focus !== c.evil ? .2 : .95 }, G.arrows);
  });
  // clashes: explicit this step (pulsing) + contested (static)
  G.clash.innerHTML = "";
  const explicit = new Set((ev?.changes || []).filter(c => c.type === "clash" && R[c.region]).map(c => c.region));
  REGIONS.forEach(r => {
    const keys = Object.keys(st[r.id].p).filter(k => !S.hidden.has(k));
    if (!explicit.has(r.id) && keys.length < 2) return;
    const [x, y] = posOf(r.id);
    const g = el("g", { class: explicit.has(r.id) ? "clash" : "", transform: `translate(${x - 40},${y - 30})` }, G.clash);
    if (explicit.has(r.id)) el("circle", { class: "ring", r: 17 }, g);
    swords(g, 14);
  });
  // lesser evils and other threats: a row of small markers under the town
  G.threats.innerHTML = "";
  if (threatShown()) REGIONS.forEach(r => {
    const list = Object.values(st[r.id].threats).sort((a, b) => b.tier - a.tier);
    const [x, y] = posOf(r.id);
    list.slice(0, 4).forEach((t, i) => {
      const g = threatEl(t, G.threats, 12);
      g.setAttribute("transform", `translate(${x - 38 - i * 27},${y + 30})`);
      g.dataset.region = r.id;
      if (fresh && !reduced && !findThreatIn(prev, t.tid)) g.classList.add("new");
    });
    if (list.length > 4) { const t = el("text", { class: "mlabel feat", x: x - 38 - 4 * 27, y: y + 36, "text-anchor": "middle" }, G.threats); t.textContent = "+" + (list.length - 4); }
  });
  // pinpoints: a row of small pins above the town
  G.marks.innerHTML = "";
  if (marksShown()) REGIONS.forEach(r => {
    const list = Object.values(st[r.id].marks);
    const [x, y] = posOf(r.id);
    list.slice(0, 3).forEach((m, i) => {
      const g = pinEl(m, G.marks, 9);
      g.setAttribute("transform", `translate(${x - 34 - i * 22},${y - 16})`);
      g.dataset.region = r.id;
      if (fresh && !reduced && !findMark(prev, m.mid)) g.classList.add("new");
    });
    if (list.length > 3) { const t = el("text", { class: "mlabel feat", x: x - 34 - 3 * 22, y: y - 22, "text-anchor": "middle" }, G.marks); t.textContent = "+" + (list.length - 3); }
  });
  // tokens
  G.tokens.innerHTML = "";
  REGIONS.forEach(r => {
    const p = st[r.id].p;
    EVIL_ORDER.forEach(k => {
      if (!p[k] || S.hidden.has(k)) return;
      const key = r.id + ":" + k;
      const [x, y] = slotPos(r.id, k);
      const g = tokenEl(k, p[k], G.tokens);
      g.setAttribute("transform", `translate(${x},${y})`);
      g.dataset.region = r.id;
      if (hiddenTok.has(key)) g.style.opacity = 0;
      if (S.focus && S.focus !== k) g.classList.add("dim");
      const before = prev[r.id]?.p[k] || 0;
      if (fresh && !before && !reduced) g.classList.add("new");
      else if (fresh && p[k] > before) g.classList.add("rise");
    });
  });
}
function findThreatIn(st, tid) { return !!findThreat(st, tid); }
function swords(parent, r) {
  const sw = el("g", { class: "swords", transform: r === 14 ? null : `scale(${r / 14})` }, parent);
  el("circle", { r: 14 }, sw);
  el("line", { x1: -8, y1: -8, x2: 8, y2: 8 }, sw); el("line", { x1: 8, y1: -8, x2: -8, y2: 8 }, sw);
  return sw;
}
function arcD(a, b, bend) { const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend; return `M${a[0]},${a[1]}Q${mx},${my} ${b[0]},${b[1]}`; }
function shorten(a, b, d) { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [b[0] - dx / l * d, b[1] - dy / l * d]; }
function fly(evil, from, to, tier, done) {
  const g = tokenEl(evil, tier, G.fx);
  const a = slotPos(from, evil), b = slotPos(to, evil);
  const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * .18, my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * .18;
  const t0 = performance.now(), D = 1100;
  const step = now => {
    let t = Math.min(1, (now - t0) / D); const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const x = (1 - e) * (1 - e) * a[0] + 2 * (1 - e) * e * mx + e * e * b[0];
    const y = (1 - e) * (1 - e) * a[1] + 2 * (1 - e) * e * my + e * e * b[1];
    g.setAttribute("transform", `translate(${x},${y}) scale(${1 + Math.sin(e * Math.PI) * .35})`);
    if (t < 1) requestAnimationFrame(step); else { g.remove(); done && done(); }
  };
  requestAnimationFrame(step);
}

/* ---------- Rendering the whole map ---------- */
function redraw(opts) { drawOverlays(opts); renderRegionView(opts); }
function renderMap(opts) {
  drawTerritories(); drawRoutes(); drawCities(); drawOverlays(opts); renderRegionView(opts);
  svg.classList.toggle("layout-mode", S.layoutMode);
  const bn = $("banner");
  if (S.layoutMode) { bn.hidden = false; bn.textContent = "Drag places to reposition them"; }
  else if (S.draft && S.draft.changes.length) { bn.hidden = false; bn.textContent = "Previewing your draft event"; }
  else bn.hidden = true;
}
function stepTurn(d) { if (TURNS.length) goTo(TURNS[Math.max(0, Math.min(TURNS.length - 1, turnIndexOf(S.idx) + d))].last, d > 0); }
function goTo(i, animate) {
  if (!EV.length) return;
  i = Math.max(0, Math.min(EV.length - 1, i));
  const ft = turnIndexOf(S.idx), tt = turnIndexOf(i), turn = TURNS[tt];
  S.idx = turn.last; i = S.idx;
  const forwardOne = animate && tt === ft + 1 && !reduced && !RV.id;
  const moves = forwardOne ? turn.events.flatMap(e => e.changes || []).filter(c => c.type === "move" && R[c.from] && R[c.to] && c.from !== c.to && !S.hidden.has(c.evil)) : [];
  const hide = new Set(moves.map(c => c.to + ":" + c.evil));
  redraw({ hiddenTok: hide, fresh: true });
  moves.forEach(c => {
    const tier = STATES[i][c.to].p[c.evil] || c.tier || 1;
    fly(c.evil, c.from, c.to, tier, () => {
      const t = G.tokens.querySelector(`.tok[data-evil="${c.evil}"][data-region="${c.to}"]`);
      if (t) { t.style.opacity = ""; t.classList.add("new"); }
    });
  });
  renderChrome();
}
