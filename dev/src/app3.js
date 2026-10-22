
/* ---------- Dispatches, the events calendar, chapter requests and the yearly recap ---------- */
S.dispatches = []; S.calendar = []; S.requests = [];
S.dispForm = null; S.calForm = null; S.reqForm = null; S.dispFilter = ""; S.recapYear = null;
const REQ_STATUS = { waiting: "Waiting for the NST Lead", approved: "Approved", changes: "Approved with changes", declined: "Declined" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Story teams and reps write dispatches, calendar entries and requests for their own chapters; the NST Team for any. */
const canWriteFor = ch => isNST() || ((role() === "story" || role() === "rep") && (Store.me.chapters || []).includes(ch));
const writableChapters = () => CHAPTERS.filter(r => canWriteFor(r.id));
const storyLayer = () => VIS_RANK[S.layer] >= 1;
const showRequests = () => role() !== "viewer" && storyLayer();
const showRecap = () => isNST() && S.layer === "nst";
const chName = id => id === "national" ? "National" : (R[id]?.name || id);
const involvedIn = q => isNST() || [q.chapter, ...(q.affects || [])].some(c => (Store.me.chapters || []).includes(c));

/* Dates are kept as yyyy-mm-dd. */
const pad = n => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parseDay = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const dayDiff = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 864e5);
const shortDate = s => { const d = parseDay(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const longDate = s => { const d = parseDay(s); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const isoDay = s => { const d = new Date(s); return isNaN(d) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const paras = t => String(t || "").split(/\n{2,}|\r\n\r\n/).filter(x => x.trim()).map(p => `<p>${esc(p.trim()).replace(/\n/g, "<br>")}</p>`).join("");
const threatLabel = k => EVILS[k]?.short || LESSER[k]?.name || "";
const safeLink = u => /^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "";

function upcoming() { const t = todayStr(); return S.calendar.filter(c => c.date >= t).sort((a, b) => a.date.localeCompare(b.date) || chName(a.chapter).localeCompare(chName(b.chapter))); }
function nextEventFor(id) { return upcoming().find(c => c.chapter === id) || null; }
/* Two chapters planning the same evil within 30 days of each other. */
function calendarClashes() {
  const list = upcoming().filter(c => c.evil), out = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.evil === b.evil && a.chapter !== b.chapter && dayDiff(a.date, b.date) <= 30) out.push([a, b]);
  }
  return out;
}

/* Date badges on the main map: each chapter's next event. */
const calShown = () => $("ly-cal")?.checked;
function paintCalendar() {
  G.cities.querySelectorAll(".calbadge").forEach(n => n.remove());
  if (!calShown()) return;
  G.cities.querySelectorAll(".citygrp").forEach(g => {
    const id = g.dataset.region; if (R[id]?.kind !== "chapter") return;
    const nx = nextEventFor(id); if (!nx) return;
    const b = el("g", { class: "calbadge", transform: "translate(0,-38)", "pointer-events": "none" }, g);
    el("rect", { x: -34, y: -14, width: 68, height: 26, rx: 13 }, b);
    const t = el("text", { y: 6, "text-anchor": "middle" }, b); t.textContent = shortDate(nx.date);
  });
}

/* Small counts on the tab labels: events in the next 30 days, requests waiting. */
function tabBadges() {
  const t = todayStr(), soon = upcoming().filter(c => dayDiff(t, c.date) <= 30).length;
  const waiting = S.requests.filter(q => q.status === "waiting" && involvedIn(q)).length;
  const set = (id, label, n, title) => { const b = $(id); b.innerHTML = esc(label) + (n ? ` <span class="tabbadge" title="${esc(title)}">${n}</span>` : ""); };
  set("tab-calendar", "Calendar", soon, `${soon} event${soon === 1 ? "" : "s"} in the next 30 days`);
  set("tab-requests", "Requests", waiting, `${waiting} waiting for a decision`);
  $("tab-requests").hidden = !showRequests();
  $("tab-recap").hidden = !showRecap();
  if ((S.tab === "requests" && !showRequests()) || (S.tab === "recap" && !showRecap())) S.tab = "threats";
}

/* ---------- Dispatches ---------- */
function renderDispatches() {
  const pane = $("pane-dispatches");
  const mine = writableChapters();
  let html = `<div><h3>Dispatches</h3><p class="small muted" style="margin:6px 0 0">News from across the Abandoned Lands, carried by rider and written by each chapter's story team after their events.</p></div>`;
  const f = S.dispForm;
  if (f) {
    const opts = (isNST() ? opt("national", "National", f.chapter) : "") + mine.map(r => opt(r.id, r.name, f.chapter)).join("");
    html += `<div class="draft"><div class="lbl">${f.id ? "Editing dispatch" : "New dispatch"} · players can read this</div>
      <div class="row2"><div class="field"><label class="lbl" for="dp-ch">From</label><select id="dp-ch">${opts}</select></div>
      <div class="field"><label class="lbl" for="dp-when">When</label><input id="dp-when" value="${esc(f.when)}" placeholder="e.g. After the October event"></div></div>
      <div class="field"><label class="lbl" for="dp-title">Headline</label><input id="dp-title" value="${esc(f.title)}" placeholder="e.g. The well at Southbrook runs clean again"></div>
      <div class="field"><label class="lbl" for="dp-body">The news</label><textarea id="dp-body" rows="6" placeholder="Write it as a traveller would tell it. Only what players saw and heard.">${esc(f.body)}</textarea></div>
      ${isNST() ? `<label class="ck"><input type="checkbox" id="dp-pin" ${f.pinned ? "checked" : ""}> Pin to the top</label>` : ""}
      <div class="btnrow"><button type="button" class="btn primary" id="dp-save">${f.id ? "Save changes" : "Send the dispatch"}</button><button type="button" class="btn big" id="dp-cancel">Discard</button></div></div>`;
  } else if (mine.length) html += `<div class="btnrow"><button type="button" class="btn primary" id="dp-new">Write a dispatch</button></div>`;
  const from = [...new Set(S.dispatches.map(x => x.chapter))];
  if (from.length > 1) html += `<div class="field"><label class="lbl" for="dp-filter">Show dispatches from</label><select id="dp-filter">${opt("", "Everywhere", S.dispFilter)}${from.sort((a, b) => chName(a).localeCompare(chName(b))).map(c => opt(c, chName(c), S.dispFilter)).join("")}</select></div>`;
  const list = S.dispatches.filter(x => !S.dispFilter || x.chapter === S.dispFilter)
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  html += list.length ? `<div class="dlist">${list.map(x => `<article class="dispatch${x.pinned ? " pinned" : ""}">
      <div class="lbl">${x.pinned ? "Pinned · " : ""}${esc(chName(x.chapter))}${x.when ? " · " + esc(x.when) : ""}</div><h4>${esc(x.title)}</h4>${paras(x.body)}
      <div class="dfoot">${x.createdBy ? `<span class="note">Sent by ${esc(x.createdBy)}</span>` : ""}${R[x.chapter] ? `<button type="button" class="chip" data-goreg="${x.chapter}">${esc(R[x.chapter].name)} on the map</button>` : ""}
      ${canWriteFor(x.chapter) ? (S.confirmDel === x.id ? `<button type="button" class="btn danger" data-dpdelok="${x.id}">Delete</button><button type="button" class="btn" data-delno="1">Keep</button>` : `<button type="button" class="btn" data-dpedit="${x.id}">Edit</button><button type="button" class="btn" data-dpdel="${x.id}" aria-label="Delete dispatch">✕</button>`) : ""}</div></article>`).join("")}</div>`
    : `<div class="empty">No dispatches yet. ${mine.length ? "Write the first one after your next event." : "Story teams write these after their events."}</div>`;
  pane.innerHTML = html;
}

/* ---------- Events calendar ---------- */
function renderCalendar() {
  const pane = $("pane-calendar"), mine = writableChapters(), story = storyLayer();
  const link = safeLink(S.settings.calendar?.url);
  const thisYear = new Date().getFullYear(), years = [...new Set([thisYear, ...S.calendar.map(c => +c.date.slice(0, 4))])].filter(Boolean).sort();
  if (!years.includes(S.calYear)) S.calYear = thisYear;
  let html = `<div><h3>The year's events</h3><p class="small muted" style="margin:6px 0 0">Every chapter's events for the year, month by month. Each town's next event also shows on the map.</p></div>
    ${years.length > 1 ? `<div class="field"><label class="lbl" for="cl-year">Year</label><select id="cl-year">${years.map(y => opt(y, y, S.calYear)).join("")}</select></div>` : ""}`;
  if (link) html += `<div class="btnrow"><a class="btn big" href="${esc(link)}" target="_blank" rel="noopener">Open the full Swordcraft calendar ↗</a></div>`;
  if (story) {
    const cl = calendarClashes();
    if (cl.length) html += `<div class="warns">${cl.map(([a, b]) => `<div>Heads-up: ${esc(chName(a.chapter))} (${shortDate(a.date)}) and ${esc(chName(b.chapter))} (${shortDate(b.date)}) both plan ${esc(threatLabel(a.evil))} within 30 days.</div>`).join("")}</div>`;
  }
  const f = S.calForm;
  if (f) {
    const opts = (isNST() ? opt("national", "National", f.chapter) : "") + mine.map(r => opt(r.id, r.name, f.chapter)).join("");
    html += `<div class="draft"><div class="lbl">${f.id ? "Editing event" : "New calendar event"}</div>
      <div class="row2"><div class="field"><label class="lbl" for="cl-date">Date</label><input id="cl-date" type="date" value="${esc(f.date)}"></div>
      <div class="field"><label class="lbl" for="cl-ch">Chapter</label><select id="cl-ch">${opts}</select></div></div>
      <div class="field"><label class="lbl" for="cl-name">Event name</label><input id="cl-name" value="${esc(f.name)}" placeholder="e.g. Bracken: The Thorn Moot"></div>
      <div class="field"><label class="lbl" for="cl-link">Link (optional)</label><input id="cl-link" value="${esc(f.link)}" placeholder="The event's page or ticket link"></div>
      <div class="lbl" style="margin-top:4px">For story teams and the NST Team only</div>
      <div class="field"><label class="lbl" for="cl-evil">Main threat planned</label><select id="cl-evil">${opt("", "Not decided", f.evil)}<optgroup label="External Evils">${EVIL_ORDER.map(k => opt(k, EVILS[k].short, f.evil)).join("")}</optgroup><optgroup label="Lesser Evils">${Object.keys(LESSER).map(k => opt(k, LESSER[k].name, f.evil)).join("")}</optgroup></select></div>
      <div class="field"><label class="lbl" for="cl-plan">What's planned</label><textarea id="cl-plan" placeholder="A line or two for neighbouring story teams">${esc(f.plan)}</textarea></div>
      <div class="btnrow"><button type="button" class="btn primary" id="cl-save">${f.id ? "Save changes" : "Add to the calendar"}</button><button type="button" class="btn big" id="cl-cancel">Discard</button></div></div>`;
  } else if (mine.length) html += `<div class="btnrow"><button type="button" class="btn primary" id="cl-new">Add an event</button></div>`;
  const row = c => `<div class="calrow${c.date < todayStr() ? " past" : ""}"><div class="caldate"><b>${parseDay(c.date).getDate()}</b><span>${MONTHS[parseDay(c.date).getMonth()]}</span></div><div style="min-width:0">
    <div class="tt">${safeLink(c.link) ? `<a href="${esc(safeLink(c.link))}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}</div>
    <div class="mm"><span>${esc(longDate(c.date))}</span>${R[c.chapter] ? `<button type="button" class="chip" data-goreg="${c.chapter}">${esc(chName(c.chapter))}</button>` : `<span>${esc(chName(c.chapter))}</span>`}</div>
    ${story && (c.plan || c.evil) ? `<div class="small calplan">${c.evil ? `<span class="pill">${esc(threatLabel(c.evil))}</span> ` : ""}${esc(c.plan || "")}</div>` : ""}</div>
    <div class="acts">${canWriteFor(c.chapter) ? (S.confirmDel === c.id ? `<button type="button" class="btn danger" data-cldelok="${c.id}">Delete</button><button type="button" data-delno="1">Keep</button>` : `<button type="button" data-cledit="${c.id}">Edit</button><button type="button" data-cldel="${c.id}" aria-label="Delete calendar event">✕</button>`) : ""}</div></div>`;
  const inYear = S.calendar.filter(c => c.date.startsWith(S.calYear + "-")).sort((a, b) => a.date.localeCompare(b.date) || chName(a.chapter).localeCompare(chName(b.chapter)));
  html += inYear.length ? MONTHS.map((m, i) => {
    const list = inYear.filter(c => +c.date.slice(5, 7) === i + 1);
    return list.length ? `<div class="calmonth"><h5>${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][i]} ${S.calYear}</h5><div class="callist">${list.map(row).join("")}</div></div>` : "";
  }).join("") : `<div class="empty">No events on the calendar for ${S.calYear} yet.${mine.length ? " Add your chapter's events so they show here and on the map." : ""}</div>`;
  if (isNST()) html += `<details class="setup"><summary>Calendar link</summary><label class="lbl" for="cl-url">Link to the full Swordcraft calendar</label><input id="cl-url" value="${esc(S.settings.calendar?.url || "")}" placeholder="https://…"><div class="btnrow"><button type="button" class="btn" id="cl-url-save">Save link</button></div></details>`;
  pane.innerHTML = html;
}

/* ---------- Chapter requests: never shown to players, decided by the NST Lead ---------- */
function renderRequests() {
  const pane = $("pane-requests"), mine = writableChapters();
  let html = `<div><h3>Chapter requests</h3><p class="small muted" style="margin:6px 0 0">Ask before a story crosses a border. The chapters involved can comment; only the NST Lead decides. Players never see these.</p></div>`;
  const f = S.reqForm;
  if (f) {
    html += `<div class="draft"><div class="lbl">${f.id ? "Editing request" : "New request"}</div>
      <div class="field"><label class="lbl" for="rq-ch">Asking for</label><select id="rq-ch">${mine.map(r => opt(r.id, r.name, f.chapter)).join("")}</select></div>
      <div class="field"><div class="lbl">Chapters it affects</div><div class="ckgrid">${CHAPTERS.filter(r => r.id !== f.chapter).map(r => `<label class="ck"><input type="checkbox" data-rqaff="${r.id}" ${f.affects.includes(r.id) ? "checked" : ""}> ${esc(r.name)}</label>`).join("")}</div></div>
      <div class="field"><label class="lbl" for="rq-text">What are you asking?</label><textarea id="rq-text" rows="4" placeholder="e.g. Can the Pale Host scouts from Braylong follow our players into our woods?">${esc(f.text)}</textarea></div>
      <div class="btnrow"><button type="button" class="btn primary" id="rq-save">${f.id ? "Save changes" : "Send to the NST Lead"}</button><button type="button" class="btn big" id="rq-cancel">Discard</button></div></div>`;
  } else if (mine.length) html += `<div class="btnrow"><button type="button" class="btn primary" id="rq-new">Make a request</button></div>`;
  const list = S.requests.filter(involvedIn).sort((a, b) => (a.status === "waiting" ? 0 : 1) - (b.status === "waiting" ? 0 : 1) || String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  html += list.length ? `<div class="dlist">${list.map(q => {
    const own = canWriteFor(q.chapter) && q.status === "waiting";
    return `<article class="request st-${q.status}"><div class="lbl">${esc(chName(q.chapter))} → ${esc((q.affects || []).map(chName).join(", "))}</div>
      <div><span class="pill rq-${q.status}">${REQ_STATUS[q.status] || q.status}</span></div>
      <p>${esc(q.text).replace(/\n/g, "<br>")}</p><div class="note">Asked by ${esc(q.createdBy || "someone")}${q.createdAt ? ", " + esc(isoDay(q.createdAt)) : ""}</div>
      ${q.reply || q.decidedBy ? `<div class="rqreply"><b>${esc(q.decidedBy || "NST Lead")}:</b> ${esc(q.reply || REQ_STATUS[q.status])}</div>` : ""}
      ${(q.comments || []).length ? `<div class="rqcomments">${q.comments.map(c => `<div><b>${esc(c.by)}</b> ${esc(c.text)}</div>`).join("")}</div>` : ""}
      <div class="rqcomment"><input data-rqc="${q.id}" aria-label="Comment on this request" placeholder="Add a comment"><button type="button" class="btn" data-rqcsend="${q.id}">Comment</button></div>
      ${isLead() ? `<div class="rqdecide"><div class="lbl">Your decision · NST Lead</div><div class="row2"><select data-rqst="${q.id}" aria-label="Decision">${Object.keys(REQ_STATUS).map(k => opt(k, k === "waiting" ? "Not decided yet" : REQ_STATUS[k], q.status)).join("")}</select>
        <button type="button" class="btn primary" data-rqdecide="${q.id}">Save decision</button></div><input data-rqreply="${q.id}" aria-label="Note with the decision" value="${esc(q.reply || "")}" placeholder="A note with your decision (optional)"></div>` : ""}
      ${own || isLead() ? `<div class="btnrow">${own ? `<button type="button" class="btn" data-rqedit="${q.id}">Edit</button>` : ""}${S.confirmDel === q.id ? `<button type="button" class="btn danger" data-rqdelok="${q.id}">Withdraw</button><button type="button" class="btn" data-delno="1">Keep</button>` : `<button type="button" class="btn" data-rqdel="${q.id}">Withdraw</button>`}</div>` : ""}</article>`;
  }).join("")}</div>` : `<div class="empty">No requests involving ${isNST() ? "any chapter" : "your chapter"} yet.</div>`;
  pane.innerHTML = html;
}

/* ---------- Yearly recap, for the NST Team ---------- */
function eventYear(e) {
  const m = String(e.createdAt || e.updatedAt || "").match(/^(\d{4})/) || String(e.when || "").match(/\b(20\d\d)\b/);
  return m ? +m[1] : null;
}
function threatStepsSince(tid, upto) { for (let i = upto; i >= 0; i--) if ((EV[i].changes || []).some(c => c.type === "threat" && c.tid === tid)) return turnIndexOf(upto) - turnIndexOf(i); return turnIndexOf(upto) + 1; }
function recapFor(year) {
  const idx = EV.map((e, i) => i).filter(i => eventYear(EV[i]) === year && EV[i].id !== "opening");
  const out = { entries: idx.length, rose: 0, beaten: 0, besieged: [], fallen: [], liberated: [], byCh: {}, moments: [], lingering: [], hot: [], dispatches: {} };
  idx.forEach(i => {
    const a = prevStateOf(i), b = STATES[i], e = EV[i]; let score = 0;
    for (const k of EVIL_ORDER) {
      const sa = strength(a, k).s, sb = strength(b, k).s;
      if (sb > sa) { out.rose++; score += sb - sa; } else if (sb < sa) { out.beaten++; score += sa - sb; }
      for (const id in b) if ((b[id].p[k] || 0) >= 4 && (a[id].p[k] || 0) < 4) score += 3;
    }
    const ta = Object.fromEntries(allThreats(a).map(t => [t.tid, t])), tb = Object.fromEntries(allThreats(b).map(t => [t.tid, t]));
    for (const tid in tb) if (!ta[tid] || tb[tid].tier > ta[tid].tier) { out.rose++; score++; }
    for (const tid in ta) if (!tb[tid] || tb[tid].tier < ta[tid].tier) { out.beaten++; score++; }
    for (const id in b) if (a[id].status !== b[id].status) {
      if (b[id].status === "besieged") { out.besieged.push(id); score += 3; }
      if (b[id].status === "fallen") { out.fallen.push(id); score += 5; }
      if (b[id].status === "liberated") { out.liberated.push(id); score += 3; }
    }
    const ch = R[e.chapter] ? e.chapter : "national";
    out.byCh[ch] = (out.byCh[ch] || 0) + 1;
    out.moments.push({ i, score });
  });
  out.moments.sort((x, y) => y.score - x.score || x.i - y.i); out.moments = out.moments.filter(m => m.score > 0).slice(0, 5);
  out.quiet = CHAPTERS.filter(r => !out.byCh[r.id]).map(r => r.id);
  if (idx.length) {
    const last = idx[idx.length - 1], end = STATES[last];
    out.lingering = allThreats(end).filter(t => t.kind === "lesser").map(t => ({ t, steps: threatStepsSince(t.tid, last) })).filter(x => x.steps >= 3);
    out.hot = CHAPTERS.map(r => ({ id: r.id, d: dangerOf(end, r.id) })).filter(x => x.d.auto >= 3);
  }
  S.dispatches.filter(x => String(x.createdAt || "").startsWith(String(year))).forEach(x => out.dispatches[x.chapter] = (out.dispatches[x.chapter] || 0) + 1);
  return out;
}
function renderRecap() {
  const pane = $("pane-recap");
  const years = [...new Set(S.events.map(eventYear).filter(Boolean))].sort((a, b) => b - a);
  if (!years.length) years.push(new Date().getFullYear());
  if (!years.includes(S.recapYear)) S.recapYear = years[0];
  const y = S.recapYear, r = recapFor(y), uniq = a => [...new Set(a)].map(id => esc(R[id].name)).join(", ");
  const stat = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  let html = `<div><h3>Yearly recap</h3><p class="small muted" style="margin:6px 0 0">For the NST Team only: the year's story from the map, ready for planning the next one.</p></div>
    <div class="field"><label class="lbl" for="rc-year">Year</label><select id="rc-year">${years.map(v => opt(v, v, y)).join("")}</select></div>
    <div class="stats">${stat(r.entries, "events posted")}${stat(r.rose, "threats rose")}${stat(r.beaten, "threats beaten back")}${stat(new Set(r.besieged).size, "regions besieged")}${stat(new Set(r.fallen).size, "regions fell")}${stat(new Set(r.liberated).size, "regions liberated")}</div>`;
  if (r.besieged.length || r.fallen.length || r.liberated.length) html += `<div class="small">${r.besieged.length ? `<div>Besieged: ${uniq(r.besieged)}</div>` : ""}${r.fallen.length ? `<div>Fell: ${uniq(r.fallen)}</div>` : ""}${r.liberated.length ? `<div>Liberated: ${uniq(r.liberated)}</div>` : ""}</div>`;
  const looks = [
    ...(r.quiet.length ? [`No events in ${y} from ${r.quiet.map(id => esc(R[id].name)).join(", ")}.`] : []),
    ...r.lingering.map(x => `${esc(threatName(x.t))} has sat in ${esc(R[x.t.region].name)} at tier ${x.t.tier} for ${x.steps} year${x.steps === 1 ? "" : "s"} without a change.`),
    ...r.hot.map(x => `${esc(R[x.id].name)} ended the year ${DANGER[x.d.auto].name}.`),
  ];
  html += `<div><h5>Needs a look</h5>${looks.length ? `<div class="warns">${looks.map(t => `<div>${t}</div>`).join("")}</div>` : `<div class="muted small">Nothing stands out.</div>`}</div>`;
  html += `<div><h5>Biggest moments</h5>${r.moments.length ? `<div class="hist">${r.moments.map(m => `<button type="button" data-jump="${m.i}"><b>${esc(EV[m.i].title || "Untitled event")}</b> <span class="muted">· ${esc(chName(EV[m.i].chapter || "national"))}${EV[m.i].when ? " · " + esc(EV[m.i].when) : ""}</span></button>`).join("")}</div>` : `<div class="muted small">No events with map changes in ${y}.</div>`}</div>`;
  const rows = [...CHAPTERS.map(c => c.id), "national"].map(id => ({ id, n: r.byCh[id] || 0, d: r.dispatches[id] || 0 })).filter(x => x.id !== "national" || x.n || x.d);
  html += `<div><h5>By chapter</h5><div class="bych">${rows.map(x => `<div class="${x.n ? "" : "quiet"}"><span>${esc(chName(x.id))}</span><span>${x.n} event${x.n === 1 ? "" : "s"}</span><span class="muted">${x.d} dispatch${x.d === 1 ? "" : "es"}</span></div>`).join("")}</div></div>`;
  pane.innerHTML = html;
}

/* ---------- Saving ---------- */
async function act(action, payload, done) {
  try { const res = await Store.act(action, clean(payload)); if (done) toast(done); return res || {}; }
  catch (e) { toast("Couldn't save: " + (e?.message || "try again")); return null; }
}
/* How this browser's demo store applies each action. The story sheet does the same in Code.gs, with permission checks. */
function reduceAct(lists, me, a, p) {
  const now = new Date().toISOString(), nid = pre => pre + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const find = (k, id) => (lists[k] || []).find(x => x.id === id);
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
  if (a === "saveDispatch") { const ex = p.item.id && find("dispatches", p.item.id); const doc = { ...(ex || { createdBy: me.name, createdAt: now }), ...pick(p.item, ["chapter", "title", "body", "when", "pinned"]), id: ex?.id || nid("d"), updatedAt: now }; return { coll: "dispatches", id: doc.id, doc }; }
  if (a === "saveCal") { const ex = p.item.id && find("calendar", p.item.id); const doc = { ...(ex || {}), ...pick(p.item, ["date", "chapter", "name", "link", "plan", "evil"]), id: ex?.id || nid("c"), updatedBy: me.name, updatedAt: now }; return { coll: "calendar", id: doc.id, doc }; }
  if (a === "saveRequest") { const ex = p.item.id && find("requests", p.item.id); const doc = { ...(ex || { status: "waiting", reply: "", comments: [], createdBy: me.name, createdAt: now }), ...pick(p.item, ["chapter", "affects", "text"]), id: ex?.id || nid("q") }; return { coll: "requests", id: doc.id, doc }; }
  if (a === "commentRequest") { const ex = find("requests", p.id); return { coll: "requests", id: p.id, doc: { ...ex, comments: [...(ex.comments || []), { by: me.name, text: p.text, at: now }] } }; }
  if (a === "decideRequest") { const ex = find("requests", p.id), open = p.status === "waiting"; return { coll: "requests", id: p.id, doc: { ...ex, status: p.status, reply: p.reply || "", decidedBy: open ? "" : me.name, decidedAt: open ? "" : now } }; }
  const del = { deleteDispatch: "dispatches", deleteCal: "calendar", deleteRequest: "requests" }[a];
  if (del) return { coll: del, id: p.id, doc: null };
  throw new Error("Unknown action " + a);
}
function applyLists(d) {
  if (d.dispatches) S.dispatches = d.dispatches;
  if (d.calendar) S.calendar = d.calendar.map(c => ({ ...c, date: String(c.date || "").slice(0, 10) }));
  if (d.requests) S.requests = d.requests.map(q => ({ ...q, affects: Array.isArray(q.affects) ? q.affects : String(q.affects || "").split(",").filter(Boolean), comments: q.comments || [] }));
}

const valOf = id => ($(id)?.value ?? "").trim();
document.addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) return;
  const d = t.dataset, again = () => { renderMap({ fresh: false }); renderChrome(); };
  if (d.delno && S.tab !== "log") { S.confirmDel = null; renderSide(); return; }
  // Dispatches
  if (t.id === "dp-new") { S.dispForm = { id: null, chapter: S.selected && canWriteFor(S.selected) ? S.selected : (isNST() ? "national" : writableChapters()[0].id), title: "", body: "", when: "", pinned: false }; renderSide(); $("dp-title")?.focus(); return; }
  if (t.id === "dp-cancel") { S.dispForm = null; renderSide(); return; }
  if (d.dpedit) { const x = S.dispatches.find(v => v.id === d.dpedit); if (x) { S.dispForm = clean({ id: x.id, chapter: x.chapter, title: x.title || "", body: x.body || "", when: x.when || "", pinned: !!x.pinned }); renderSide(); } return; }
  if (t.id === "dp-save") {
    const f = S.dispForm, item = { id: f.id || undefined, chapter: $("dp-ch").value, title: valOf("dp-title"), body: valOf("dp-body"), when: valOf("dp-when"), pinned: !!$("dp-pin")?.checked };
    if (!item.title) { toast("Give the dispatch a headline"); return; }
    if (await act("saveDispatch", { item }, f.id ? "Dispatch updated" : "Dispatch sent")) { S.dispForm = null; again(); }
    return;
  }
  if (d.dpdel) { S.confirmDel = d.dpdel; renderSide(); return; }
  if (d.dpdelok) { S.confirmDel = null; await act("deleteDispatch", { id: d.dpdelok }, "Dispatch deleted"); again(); return; }
  // Calendar
  if (t.id === "cl-new") { S.calForm = { id: null, date: "", chapter: S.selected && canWriteFor(S.selected) ? S.selected : writableChapters()[0].id, name: "", link: "", plan: "", evil: "" }; renderSide(); return; }
  if (t.id === "cl-cancel") { S.calForm = null; renderSide(); return; }
  if (d.cledit) { const x = S.calendar.find(v => v.id === d.cledit); if (x) { S.calForm = clean({ id: x.id, date: x.date, chapter: x.chapter, name: x.name || "", link: x.link || "", plan: x.plan || "", evil: x.evil || "" }); renderSide(); } return; }
  if (t.id === "cl-save") {
    const f = S.calForm, item = { id: f.id || undefined, date: valOf("cl-date"), chapter: $("cl-ch").value, name: valOf("cl-name"), link: valOf("cl-link"), plan: valOf("cl-plan"), evil: $("cl-evil").value };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) { toast("Pick a date"); return; }
    if (!item.name) { toast("Give the event a name"); return; }
    if (await act("saveCal", { item }, f.id ? "Event updated" : "Added to the calendar")) { S.calForm = null; again(); }
    return;
  }
  if (d.cldel) { S.confirmDel = d.cldel; renderSide(); return; }
  if (d.cldelok) { S.confirmDel = null; await act("deleteCal", { id: d.cldelok }, "Event removed"); again(); return; }
  if (t.id === "cl-url-save") { const url = valOf("cl-url"); if (url && !safeLink(url)) { toast("The link needs to start with https://"); return; } await saveSetting("calendar", { url }, "Calendar link saved"); return; }
  // Requests
  if (t.id === "rq-new") { const ch = S.selected && canWriteFor(S.selected) ? S.selected : writableChapters()[0].id; S.reqForm = { id: null, chapter: ch, affects: [], text: "" }; renderSide(); return; }
  if (t.id === "rq-cancel") { S.reqForm = null; renderSide(); return; }
  if (d.rqedit) { const q = S.requests.find(v => v.id === d.rqedit); if (q) { S.reqForm = clean({ id: q.id, chapter: q.chapter, affects: q.affects || [], text: q.text || "" }); renderSide(); } return; }
  if (t.id === "rq-save") {
    const f = S.reqForm, item = { id: f.id || undefined, chapter: $("rq-ch").value, affects: f.affects.filter(c => c !== $("rq-ch").value), text: valOf("rq-text") };
    if (!item.affects.length) { toast("Pick the chapters it affects"); return; }
    if (!item.text) { toast("Say what you're asking"); return; }
    if (await act("saveRequest", { item }, f.id ? "Request updated" : "Sent to the NST Lead")) { S.reqForm = null; again(); }
    return;
  }
  if (d.rqcsend) { const inp = document.querySelector(`[data-rqc="${d.rqcsend}"]`), text = inp?.value.trim(); if (!text) return; if (await act("commentRequest", { id: d.rqcsend, text }, "Comment added")) again(); return; }
  if (d.rqdecide) {
    const status = document.querySelector(`[data-rqst="${d.rqdecide}"]`).value, reply = document.querySelector(`[data-rqreply="${d.rqdecide}"]`).value.trim();
    if (await act("decideRequest", { id: d.rqdecide, status, reply }, status === "waiting" ? "Request reopened" : "Decision saved")) again();
    return;
  }
  if (d.rqdel) { S.confirmDel = d.rqdel; renderSide(); return; }
  if (d.rqdelok) { S.confirmDel = null; await act("deleteRequest", { id: d.rqdelok }, "Request withdrawn"); again(); return; }
});
/* Keep what's typed in a form, so a refresh from the story sheet doesn't wipe it. */
document.addEventListener("input", e => {
  const t = e.target, map = { "dp-title": ["dispForm", "title"], "dp-body": ["dispForm", "body"], "dp-when": ["dispForm", "when"], "cl-date": ["calForm", "date"], "cl-name": ["calForm", "name"], "cl-link": ["calForm", "link"], "cl-plan": ["calForm", "plan"], "rq-text": ["reqForm", "text"] };
  const m = map[t.id]; if (m && S[m[0]]) S[m[0]][m[1]] = t.value;
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "dp-ch" && S.dispForm) { S.dispForm.chapter = t.value; return; }
  if (t.id === "dp-pin" && S.dispForm) { S.dispForm.pinned = t.checked; return; }
  if (t.id === "cl-ch" && S.calForm) { S.calForm.chapter = t.value; return; }
  if (t.id === "cl-evil" && S.calForm) { S.calForm.evil = t.value; return; }
  if (t.id === "dp-filter") { S.dispFilter = t.value; renderSide(); return; }
  if (t.id === "cl-year") { S.calYear = +t.value; renderSide(); return; }
  if (t.id === "rc-year") { S.recapYear = +t.value; renderSide(); return; }
  if (t.dataset.rqaff && S.reqForm) { const a = new Set(S.reqForm.affects); t.checked ? a.add(t.dataset.rqaff) : a.delete(t.dataset.rqaff); S.reqForm.affects = [...a]; return; }
  if (t.id === "rq-ch" && S.reqForm) { S.reqForm.chapter = t.value; S.reqForm.text = valOf("rq-text"); renderSide(); return; }
});
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.dataset?.rqc) document.querySelector(`[data-rqcsend="${e.target.dataset.rqc}"]`)?.click();
});
