
/* ---------- Tooltip ---------- */
const tip = $("tip");
function presenceList(st, id) {
  const p = st[id].p; const keys = EVIL_ORDER.filter(k => p[k]);
  const th = Object.values(st[id].threats);
  if (!keys.length && !th.length) return `<div class="muted small">No threats here.</div>`;
  return keys.map(k => `<div style="display:flex;gap:6px;align-items:center">${swatch(k, 14)}<span><b style="font-weight:500">${EVILS[k].short}</b> · tier ${p[k]} ${esc(TIERS[p[k]].name)}</span></div>`).join("") +
    th.map(t => `<div style="display:flex;gap:6px;align-items:center">${thrSwatch(t, 14)}<span><b style="font-weight:500">${esc(threatName(t))}</b> · tier ${t.tier}${t.site ? " · " + esc(siteName(id, t.site)) : ""}</span></div>`).join("");
}
function swatch(evil, size = 16, tier) {
  const r = size / 2 - 1;
  return `<svg width="${size}" height="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" aria-hidden="true" style="flex:none;overflow:visible"><path d="${shapePath(EVILS[evil].shape, r * .8)}" fill="var(--${evil})"/>${tier ? `<text x="0" y="${EVILS[evil].shape === "triangle" ? 2 : 0}" font-size="${size * .55}" font-weight="700" fill="var(--tok-ink)" text-anchor="middle" dominant-baseline="central">${tier}</text>` : ""}</svg>`;
}
function thrSwatch(t, size = 16, withTier) {
  const r = size / 2 - 1;
  return `<svg width="${size}" height="${size}" viewBox="${-size / 2} ${-size / 2} ${size} ${size}" aria-hidden="true" style="flex:none;overflow:visible"><path d="${shapePath(t.kind === "lesser" ? "hex" : "shield", r * .85)}" fill="${thrColor(t)}"/>${withTier ? `<text x="0" y="0" font-size="${size * .55}" font-weight="700" fill="var(--tok-ink)" text-anchor="middle" dominant-baseline="central">${t.tier}</text>` : ""}</svg>`;
}
function showTip(html, evt) {
  tip.innerHTML = html; tip.hidden = false;
  const wrap = $("mapwrap").getBoundingClientRect();
  let x = evt.clientX - wrap.left + 16, y = evt.clientY - wrap.top + 16;
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  if (x + tw > wrap.width - 8) x = evt.clientX - wrap.left - tw - 16;
  if (y + th > wrap.height - 8) y = evt.clientY - wrap.top - th - 16;
  tip.style.left = Math.max(6, x) + "px"; tip.style.top = Math.max(6, y) + "px";
}
function regionTip(id) {
  const r = R[id], st = currentState(), here = st[id];
  const status = here.status ? ` <span class="pill st-${here.status}">${STATUSES[here.status]}</span>` : "";
  const marks = Object.values(here.marks);
  const note = S.notes[id]?.public;
  const danger = r.kind === "chapter" ? " " + dangerPill(dangerOf(st, id)) : "";
  const nx = r.kind === "chapter" ? nextEventFor(id) : null;
  return `<h4>${esc(r.name)}</h4><div class="sub">${esc(r.kind === "chapter" ? "Chapter · " + r.band : r.band)}${status}${danger}</div><div>${esc(note || r.blurb)}</div><div class="pres">${presenceList(st, id)}${marks.map(m => `<div style="display:flex;gap:6px;align-items:center">${pinSwatch(m, 14)}<span>${esc(markName(m))}</span></div>`).join("")}</div>${here.note ? `<div class="muted small" style="margin-top:6px">${esc(here.note)}</div>` : ""}${nx ? `<div class="small" style="margin-top:6px"><b>Next event:</b> ${esc(shortDate(nx.date))}, ${esc(nx.name)}</div>` : ""}<div class="muted small" style="margin-top:6px">Click for the record. Double-click to zoom into the region.</div>`;
}
function sinceLine(ev) { return ev ? `<div class="muted small since">Last change: ${esc(ev.title || "Untitled event")}${ev.when ? " · " + esc(ev.when) : ""}</div>` : ""; }
function tokenTip(evil, id, site) {
  const here = currentState()[id];
  const t = site ? (here.at[site]?.[evil] || 0) : (here.p[evil] || 0), T = TIERS[t];
  const placed = site ? [] : Object.entries(here.at).filter(([, f]) => f[evil]).map(([sid, f]) => `${siteName(id, sid)} (${f[evil]})`);
  const last = lastChange(c => (c.type === "set" && c.evil === evil && c.region === id && (!site || c.site === site)) || (c.type === "move" && c.evil === evil && (c.from === id || c.to === id)));
  return `<h4>${EVILS[evil].name}</h4><div class="sub">${site ? "at " + esc(siteName(id, site)) + ", " : "in "}${esc(R[id].name)} · tier ${t}: ${esc(T.name)}</div><div><b style="font-weight:500">Fielded:</b> ${esc(T.fielded)}</div><div><b style="font-weight:500">Reach:</b> ${esc(T.reach)}</div><div><b style="font-weight:500">Approval:</b> ${esc(T.approval)}</div>${placed.length ? `<div style="margin-top:4px"><b style="font-weight:500">At:</b> ${esc(placed.join(", "))}${here.base[evil] ? `; region-wide ${here.base[evil]}` : ""}</div>` : ""}${sinceLine(last)}`;
}
function threatTip(tid) {
  const st = currentState(), id = findThreat(st, tid); if (!id) return "";
  const t = st[id].threats[tid];
  const what = t.kind === "lesser" ? LESSER[t.group]?.what : "";
  return `<h4>${esc(threatName(t))}</h4><div class="sub">${esc(threatKind(t))} · tier ${t.tier}: ${esc(TIERS[t.tier].name)} in ${esc(R[id].name)}${t.site ? ", " + esc(siteName(id, t.site)) : ""}</div>${t.note ? `<div>${esc(t.note)}</div>` : ""}${what ? `<div class="muted small" style="margin-top:4px">${esc(what)}</div>` : ""}${sinceLine(lastChange(c => c.type === "threat" && c.tid === tid))}`;
}
function markTip(mid) {
  const st = currentState(), id = findMark(st, mid); if (!id) return "";
  const m = st[id].marks[mid];
  return `<h4>${esc(markName(m))}</h4><div class="sub">${esc(MARKS[m.icon]?.name || "Pinpoint")} · ${esc(R[id].name)}${m.site ? ", " + esc(siteName(id, m.site)) : ""}</div>${m.note ? `<div>${esc(m.note)}</div>` : ""}${sinceLine(lastChange(c => c.type === "mark" && c.mid === mid))}`;
}
function siteTip(region, sid) {
  const here = currentState()[region], s = sitesFor(region, true).find(x => x.id === sid); if (!s) return "";
  const f = here.at[sid] || {}, keys = EVIL_ORDER.filter(k => f[k]);
  const th = Object.values(here.threats).filter(t => t.site === sid);
  const mk = Object.values(here.marks).filter(m => m.site === sid);
  const list = keys.map(k => `<div style="display:flex;gap:6px;align-items:center">${swatch(k, 14)}<span>${EVILS[k].short} · tier ${f[k]}</span></div>`).join("") + th.map(t => `<div style="display:flex;gap:6px;align-items:center">${thrSwatch(t, 14)}<span>${esc(threatName(t))} · tier ${t.tier}</span></div>`).join("") +
    mk.map(m => `<div style="display:flex;gap:6px;align-items:center">${pinSwatch(m, 14)}<span>${esc(markName(m))}</span></div>`).join("");
  const story = VIS_RANK[S.layer] >= 1 && s.story ? `<div class="muted small" style="margin-top:4px"><b style="font-weight:500">Story team:</b> ${esc(s.story)}</div>` : "";
  return `<h4>${esc(s.name)}</h4><div class="sub">${esc(R[region].name)}${s.custom ? " · added by a rep" : ""}</div>${s.note ? `<div>${esc(s.note)}</div>` : ""}${story}<div class="pres">${list || `<div class="muted small">Quiet for now.</div>`}</div>`;
}
function pinSwatch(m, size = 16) {
  const r = size * .3;
  return `<svg width="${size}" height="${size}" viewBox="${-size / 2} ${-size + 1} ${size} ${size}" aria-hidden="true" style="flex:none;overflow:visible"><g class="mk"><path class="shape" d="M0,0L${-r * .866},${-r * 1.4}A${r},${r} 0 1,1 ${r * .866},${-r * 1.4}Z"/><text class="glyph" y="${-r * 1.9}" font-size="${r * 1.15}">${esc(MARKS[m.icon]?.glyph || "●")}</text></g></svg>`;
}

/* ---------- Pan, zoom, drag on the whole map ---------- */
function applyVB() { const v = S.vb; svg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`); }
function svgPoint(evt, s = svg) { const pt = s.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY; return pt.matrixTransform(s.getScreenCTM().inverse()); }
function zoom(f, cx, cy) {
  const v = S.vb; const nw = Math.max(260, Math.min(W * 1.15, v.w * f)); const k = nw / v.w;
  cx = cx ?? v.x + v.w / 2; cy = cy ?? v.y + v.h / 2;
  v.x = cx - (cx - v.x) * k; v.y = cy - (cy - v.y) * k; v.w = nw; v.h = v.h * k; applyVB();
}
function animateVB(target, dur, done) {
  const from = { ...S.vb }, t0 = performance.now();
  const step = now => {
    const t = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - t, 3);
    for (const k of ["x", "y", "w", "h"]) S.vb[k] = from[k] + (target[k] - from[k]) * e;
    applyVB();
    if (t < 1) requestAnimationFrame(step); else done && done();
  };
  requestAnimationFrame(step);
}
svg.addEventListener("wheel", e => { e.preventDefault(); const p = svgPoint(e); zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
$("zin").onclick = () => zoom(1 / 1.3); $("zout").onclick = () => zoom(1.3);
$("zfit").onclick = () => { S.vb = { x: 0, y: 0, w: W, h: H }; applyVB(); };
let drag = null;
/* Two-finger pinch zoom on touch screens, for both maps. */
const pinchDist = m => { const [a, b] = [...m.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
const pinchMid = m => { const [a, b] = [...m.values()]; return { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }; };
const ptrs = new Map();
svg.addEventListener("pointerdown", e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2 && !S.layoutMode) { drag = { mode: "pinch", d: pinchDist(ptrs) }; svg.setPointerCapture(e.pointerId); tip.hidden = true; return; }
  const city = e.target.closest(".citygrp");
  if (S.layoutMode && city) { drag = { mode: "city", id: city.dataset.region, el: city, moved: false }; city.classList.add("dragging"); svg.setPointerCapture(e.pointerId); return; }
  drag = { mode: "pan", sx: e.clientX, sy: e.clientY, vb: { ...S.vb }, moved: false, target: e.target };
  svg.setPointerCapture(e.pointerId);
});
svg.addEventListener("pointermove", e => {
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (drag && drag.mode === "pinch") { if (ptrs.size < 2) return; const nd = pinchDist(ptrs), p = svgPoint(pinchMid(ptrs)); zoom(drag.d / nd, p.x, p.y); drag.d = nd; return; }
  if (drag && drag.mode === "pan") {
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true; svg.classList.add("panning"); tip.hidden = true;
    const k = Math.max(S.vb.w / svg.clientWidth, S.vb.h / svg.clientHeight); S.vb.x = drag.vb.x - dx * k; S.vb.y = drag.vb.y - dy * k; applyVB(); return;
  }
  if (drag && drag.mode === "city") {
    const p = svgPoint(e); drag.moved = true;
    S.positions[drag.id] = [Math.round(Math.max(10, Math.min(W - 10, p.x))), Math.round(Math.max(10, Math.min(H - 10, p.y)))];
    renderMap({ fresh: false }); return;
  }
  hoverAt(e);
});
const endPtr = e => { ptrs.delete(e.pointerId); };
svg.addEventListener("pointercancel", e => { endPtr(e); drag = null; svg.classList.remove("panning"); });
svg.addEventListener("pointerup", e => {
  endPtr(e);
  const d = drag; drag = null; svg.classList.remove("panning");
  if (!d || d.mode === "pinch") return;
  if (d.mode === "city") { if (d.moved) saveLayout(); return; }
  if (!d.moved) clickAt(d.target);
});
svg.addEventListener("pointerleave", () => { tip.hidden = true; setHover(null); });
svg.addEventListener("dblclick", e => { const info = targetInfo(document.elementFromPoint(e.clientX, e.clientY) || e.target); if (info && !S.layoutMode) openRegion(info.region); });
function targetInfo(t) {
  const tok = t.closest && t.closest(".tok");
  if (tok && tok.dataset.region) return { kind: "tok", evil: tok.dataset.evil, region: tok.dataset.region };
  const th = t.closest && t.closest(".thr");
  if (th && th.dataset.region) return { kind: "thr", tid: th.dataset.tid, region: th.dataset.region };
  const mk = t.closest && t.closest(".mk");
  if (mk && mk.dataset.region) return { kind: "mark", mid: mk.dataset.mid, region: mk.dataset.region };
  const c = t.closest && (t.closest(".citygrp") || t.closest(".terr"));
  if (c) return { kind: "region", region: c.dataset.region };
  return null;
}
function setHover(id) {
  if (S.hover === id) return;
  svg.querySelectorAll(".terr.hover").forEach(p => p.classList.remove("hover"));
  S.hover = id;
  if (id) svg.querySelectorAll(`.terr[data-region="${id}"]`).forEach(p => p.classList.add("hover"));
}
function hoverAt(e) {
  const info = targetInfo(e.target);
  if (!info) { tip.hidden = true; setHover(null); return; }
  setHover(info.region);
  showTip(info.kind === "tok" ? tokenTip(info.evil, info.region) : info.kind === "thr" ? threatTip(info.tid) : info.kind === "mark" ? markTip(info.mid) : regionTip(info.region), e);
}
function clickAt(t) { const info = targetInfo(t); if (info) selectRegion(info.region); }
function selectRegion(id) {
  if (RV.id && RV.id !== id) { openRegion(id, false); return; }
  if (S.selected !== id) { S.site = null; S.pendingSite = null; }
  S.selected = id; S.tab = "region";
  svg.querySelectorAll(".terr.sel").forEach(p => p.classList.remove("sel"));
  svg.querySelectorAll(`.terr[data-region="${id}"]`).forEach(p => p.classList.add("sel"));
  renderSide();
}

/* ---------- Region view: a zoomed map of one region with its sites ---------- */
const RV = { id: null, view: null, vb: null, back: null };
const rsvg = $("rmap");
function openRegion(id, animate = true) {
  if (!R[id]) return;
  stop(); tip.hidden = true;
  const show = () => {
    RV.id = id; RV.view = viewOf(id); RV.vb = { x: RV.view.x, y: RV.view.y, w: RV.view.w, h: RV.view.h };
    S.selected = id; S.site = null; S.siteEdit = false; S.pendingSite = null; S.tab = "region";
    const rv = $("rview"); rv.hidden = false; rv.classList.remove("enter", "site-edit");
    if (animate && !reduced) { void rv.offsetWidth; rv.classList.add("enter"); }
    $("mapwrap").classList.add("rv-open");
    $("mapwrap").style.setProperty("--rv-ar", `${RV.view.w} / ${RV.view.h}`);
    renderRegionView({ fresh: false }); renderSide(); syncURL();
  };
  if (animate && !reduced && !RV.id) {
    RV.back = { ...S.vb };
    const [x, y] = posOf(id), w = 300, h = w * S.vb.h / S.vb.w;
    animateVB({ x: x - w / 2, y: y - h / 2, w, h }, 420, show);
  } else show();
}
function closeRegion() {
  if (!RV.id) return;
  const id = RV.id;
  RV.id = null; S.siteEdit = false; S.pendingSite = null; S.site = null; S.placing = null;
  $("rview").hidden = true; $("mapwrap").classList.remove("rv-open"); tip.hidden = true;
  if (RV.back) { const b = RV.back; RV.back = null; if (reduced) { S.vb = b; applyVB(); } else animateVB(b, 420); }
  S.selected = id; renderSide(); syncURL();
}
function syncURL() {
  try { const u = new URL(location.href); if (RV.id) u.searchParams.set("region", RV.id); else u.searchParams.delete("region"); history.replaceState(null, "", u); } catch (e) {}
}
function applyRVB() { const v = RV.vb; rsvg.setAttribute("viewBox", `${v.x} ${v.y} ${v.w} ${v.h}`); }
function rzoom(f, cx, cy) {
  const v = RV.vb, base = RV.view; const nw = Math.max(base.w / 7, Math.min(base.w * 1.2, v.w * f)); const k = nw / v.w;
  cx = cx ?? v.x + v.w / 2; cy = cy ?? v.y + v.h / 2;
  v.x = cx - (cx - v.x) * k; v.y = cy - (cy - v.y) * k; v.w = nw; v.h = v.h * k; applyRVB();
}
function renderRegionView(opts = {}) {
  if (!RV.id) return;
  const id = RV.id, r = R[id], v = RV.view, st = currentState(), here = st[id], prev = prevForView()[id];
  const ev = currentEvent(), fresh = opts.fresh !== false && !reduced;
  $("rv-name").textContent = r.name;
  $("rv-band").textContent = (r.kind === "chapter" ? "Chapter · " + r.band : r.band) + (v.crop ? " · from the main map" : " · regional map");
  $("rv-status").innerHTML = here.status ? `<span class="pill st-${here.status}">${STATUSES[here.status]}</span>` : "";
  const nt = $("rv-notice"); nt.hidden = !noticeOn(id); nt.textContent = S.settings.notice?.text || "";
  $("rview").classList.toggle("site-edit", S.siteEdit || !!S.placing);
  applyRVB();
  rsvg.innerHTML = "";
  const u = v.w / 100;
  const root = el("g", {}, rsvg);
  el("rect", { x: v.x - v.w * 3, y: v.y - v.h * 3, width: v.w * 7, height: v.h * 7, fill: "var(--sea-deep)" }, root);
  if (v.crop) {
    el("image", { href: MAIN_SRC, x: 0, y: 0, width: W, height: H, preserveAspectRatio: "none", class: "rv-art" }, root);
    const c = cellOf(id); if (c) el("path", { d: polyD(c.poly), class: "rv-cell", "clip-path": clipOf(id), "stroke-width": u * .5, "stroke-dasharray": `${u * 1.6} ${u * 1.2}` }, root);
  } else el("image", { href: v.src, x: 0, y: 0, width: v.w, height: v.h, preserveAspectRatio: "none", class: "rv-art" }, root);
  // A fallen region is blacked out; a besieged one is hatched red.
  if (here.status === "fallen" || here.status === "besieged") {
    const defs = el("defs", {}, root); siegePattern(defs, "rv-siege", u * 2.4);
    const c = v.crop && cellOf(id), d = c ? polyD(c.poly) : `M${v.x},${v.y}h${v.w}v${v.h}h${-v.w}Z`;
    const g = el("g", { "pointer-events": "none", "clip-path": c ? clipOf(id) : null }, root);
    if (here.status === "fallen") el("path", { d, class: "blackout rv" }, g);
    else { el("path", { d, fill: "url(#rv-siege)" }, g); el("path", { d, fill: "none", stroke: "var(--bad)", "stroke-width": u * .9 }, g); }
    const t = el("text", { class: "rv-stamp " + here.status, x: v.x + v.w / 2, y: v.y + v.h / 2, "font-size": u * 8, "text-anchor": "middle", "dominant-baseline": "central", "stroke-width": u * .5, "pointer-events": "none" }, root);
    t.textContent = STATUSES[here.status];
  }
  const showNames = $("rv-names").checked;
  const explicitSites = new Set((ev?.changes || []).filter(c => c.type === "clash" && c.region === id && c.site).map(c => c.site));
  const sites = sitesFor(id);
  const known = new Set(sites.map(s => s.id));
  for (const s of sites) {
    const [sx, sy] = siteXY(v, s);
    const forces = here.at[s.id] || {};
    const fk = EVIL_ORDER.filter(k => forces[k] && !S.hidden.has(k));
    const th = threatShown() ? Object.values(here.threats).filter(t => t.site === s.id) : [];
    const busy = fk.length || th.length;
    const g = el("g", { class: "site" + (busy ? " busy" : "") + (S.site === s.id ? " sel" : ""), "data-site": s.id, transform: `translate(${sx},${sy})` }, root);
    el("circle", { r: u * 2.4, fill: "transparent" }, g);
    el("circle", { class: "site-dot", r: u * (busy ? 1 : .75), "stroke-width": u * .3 }, g);
    if (s.custom || showNames || S.site === s.id) {
      const t = el("text", { class: "slabel", y: -u * 1.7, "text-anchor": "middle", "font-size": u * 2.3, "stroke-width": u * .65 }, g); t.textContent = s.name;
    }
    if (fk.length > 1 || explicitSites.has(s.id)) { const sg = el("g", { class: explicitSites.has(s.id) ? "clash" : "", transform: `translate(${-u * 3.2},${-u * 3.2})` }, g); if (explicitSites.has(s.id)) el("circle", { class: "ring", r: 17 * u * 1.3 / 14 }, sg); swords(sg, u * 1.3); }
    let i = 0;
    fk.forEach(k => {
      const tg = tokenEl(k, forces[k], g);
      tg.setAttribute("transform", `translate(${u * 3.3 + i * u * 4.3},0) scale(${u * 1.8 / 22})`);
      tg.dataset.site = s.id;
      if (S.focus && S.focus !== k) tg.classList.add("dim");
      const before = prev.at[s.id]?.[k] || 0;
      if (fresh && !before) tg.classList.add("new"); else if (fresh && forces[k] > before) tg.classList.add("rise");
      i++;
    });
    th.forEach(t => {
      const tg = threatEl(t, g, 13);
      tg.setAttribute("transform", `translate(${u * 3.3 + i * u * 4.3},0) scale(${u * 1.7 / 13})`);
      tg.dataset.region = id;
      if (fresh && !prev.threats[t.tid]) tg.classList.add("new");
      i++;
    });
  }
  // Pinpoints: at a site, at a spot on the map, or (with neither) in the tray below.
  const marks = marksShown() ? Object.values(here.marks) : [];
  const siteAt = Object.fromEntries(sites.map(s => [s.id, s]));
  const perSite = {};
  marks.forEach(m => {
    let x, y;
    if (m.site && siteAt[m.site]) { const k = perSite[m.site] = (perSite[m.site] || 0) + 1; [x, y] = siteXY(v, siteAt[m.site]); x += -u * 1.6 * k; y -= u * .8; }
    else if (m.x != null && m.y != null) [x, y] = [v.x + m.x * v.w, v.y + m.y * v.h];
    else return;
    const g = pinEl(m, root, 10);
    g.setAttribute("transform", `translate(${x},${y}) scale(${u * 1.25 / 10})`);
    g.dataset.region = id;
    if (fresh && !prev.marks[m.mid]) g.classList.add("new");
  });
  if (S.pendingSite && S.pendingSite.region === id) {
    const [sx, sy] = siteXY(v, S.pendingSite);
    const g = el("g", { class: "site pending sel", transform: `translate(${sx},${sy})` }, root);
    el("circle", { class: "site-dot", r: u * 1.2, "stroke-width": u * .35 }, g);
  }
  // Forces with no site sit in the tray, as do threats whose site was removed.
  const loose = EVIL_ORDER.filter(k => here.base[k] && !S.hidden.has(k));
  const looseT = threatShown() ? Object.values(here.threats).filter(t => !t.site || !known.has(t.site)) : [];
  let tray = `<div class="lbl">Across ${esc(r.name)}</div>`;
  if (!loose.length && !looseT.length && !marks.some(m => !(m.site && siteAt[m.site]) && m.x == null)) tray += `<div class="muted">${Object.keys(here.p).length || Object.keys(here.threats).length ? "Every force here is placed at a site." : "No threats in this region this year."}</div>`;
  tray += loose.map(k => `<div class="row">${swatch(k, 18, here.base[k])}<span>${EVILS[k].short} · ${esc(TIERS[here.base[k]].name)}, region-wide</span></div>`).join("");
  tray += looseT.map(t => `<div class="row">${thrSwatch(t, 18, true)}<span>${esc(threatName(t))}${t.site ? " · at a removed site" : " · region-wide"}</span></div>`).join("");
  tray += marks.filter(m => !(m.site && siteAt[m.site]) && m.x == null).map(m => `<div class="row">${pinSwatch(m, 18)}<span>${esc(markName(m))} · region-wide</span></div>`).join("");
  $("rv-tray").innerHTML = tray;
  const hint = $("rv-hint");
  if (S.placing) { hint.hidden = false; hint.textContent = "Click the map, or a site, to place the pinpoint. Esc cancels."; }
  else if (S.siteEdit) { hint.hidden = false; hint.textContent = "Click empty ground to add a site. Drag a site to move it."; }
  else if (S.draft && S.draft.changes.length) { hint.hidden = false; hint.textContent = "Previewing your draft event"; }
  else hint.hidden = true;
}
let rdrag = null;
rsvg.addEventListener("wheel", e => { e.preventDefault(); const p = svgPoint(e, rsvg); rzoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, p.x, p.y); }, { passive: false });
$("rz-in").onclick = () => rzoom(1 / 1.3); $("rz-out").onclick = () => rzoom(1.3);
$("rz-fit").onclick = () => { RV.vb = { x: RV.view.x, y: RV.view.y, w: RV.view.w, h: RV.view.h }; applyRVB(); };
$("rv-back").onclick = () => closeRegion();
const rptrs = new Map();
rsvg.addEventListener("pointerdown", e => {
  rptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (rptrs.size === 2) { rdrag = { mode: "pinch", d: pinchDist(rptrs) }; rsvg.setPointerCapture(e.pointerId); tip.hidden = true; return; }
  const site = e.target.closest(".site:not(.pending)");
  if (S.siteEdit && !S.placing && site && canEditRegion(RV.id)) { rdrag = { mode: "site", id: site.dataset.site, el: site, moved: false }; rsvg.setPointerCapture(e.pointerId); return; }
  rdrag = { mode: "pan", sx: e.clientX, sy: e.clientY, vb: { ...RV.vb }, moved: false, target: e.target, e };
  rsvg.setPointerCapture(e.pointerId);
});
rsvg.addEventListener("pointermove", e => {
  if (rptrs.has(e.pointerId)) rptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (rdrag && rdrag.mode === "pinch") { if (rptrs.size < 2) return; const nd = pinchDist(rptrs), p = svgPoint(pinchMid(rptrs), rsvg); rzoom(rdrag.d / nd, p.x, p.y); rdrag.d = nd; return; }
  if (rdrag && rdrag.mode === "pan") {
    const dx = e.clientX - rdrag.sx, dy = e.clientY - rdrag.sy;
    if (!rdrag.moved && Math.hypot(dx, dy) < 5) return;
    rdrag.moved = true; rsvg.classList.add("panning"); tip.hidden = true;
    const k = Math.max(RV.vb.w / rsvg.clientWidth, RV.vb.h / rsvg.clientHeight); RV.vb.x = rdrag.vb.x - dx * k; RV.vb.y = rdrag.vb.y - dy * k; applyRVB(); return;
  }
  if (rdrag && rdrag.mode === "site") {
    const p = svgPoint(e, rsvg), v = RV.view; rdrag.moved = true;
    rdrag.x = Math.max(0, Math.min(1, (p.x - v.x) / v.w)); rdrag.y = Math.max(0, Math.min(1, (p.y - v.y) / v.h));
    rdrag.el.setAttribute("transform", `translate(${p.x},${p.y})`); return;
  }
  const info = rTarget(e.target);
  if (!info) { tip.hidden = true; return; }
  showTip(info.kind === "tok" ? tokenTip(info.evil, RV.id, info.site) : info.kind === "thr" ? threatTip(info.tid) : info.kind === "mark" ? markTip(info.mid) : siteTip(RV.id, info.site), e);
});
rsvg.addEventListener("pointercancel", e => { rptrs.delete(e.pointerId); rdrag = null; rsvg.classList.remove("panning"); });
rsvg.addEventListener("pointerup", async e => {
  rptrs.delete(e.pointerId);
  const d = rdrag; rdrag = null; rsvg.classList.remove("panning");
  if (!d || d.mode === "pinch") return;
  if (d.mode === "site") {
    if (d.moved) await saveSite({ id: d.id, region: RV.id, x: +d.x.toFixed(4), y: +d.y.toFixed(4) });
    S.site = d.id; renderRegionView({ fresh: false }); renderSide(); return;
  }
  if (d.moved) return;
  const info = rTarget(d.target);
  if (S.placing) { const p = svgPoint(e, rsvg), v = RV.view; placeMark(info?.site || "", Math.max(0, Math.min(1, (p.x - v.x) / v.w)), Math.max(0, Math.min(1, (p.y - v.y) / v.h))); return; }
  if (info && info.site) { S.site = info.site; S.pendingSite = null; }
  else if (info && info.kind === "thr") { const t = currentState()[RV.id].threats[info.tid]; S.site = t?.site || null; }
  else if (info && info.kind === "mark") { const m = currentState()[RV.id].marks[info.mid]; S.site = m?.site || null; }
  else if (S.siteEdit && canEditRegion(RV.id)) { const p = svgPoint(e, rsvg), v = RV.view; S.pendingSite = { region: RV.id, x: +((p.x - v.x) / v.w).toFixed(4), y: +((p.y - v.y) / v.h).toFixed(4) }; S.site = null; }
  else S.site = null;
  S.tab = "region"; renderRegionView({ fresh: false }); renderSide();
  if (S.pendingSite) setTimeout(() => $("ps-name")?.focus(), 0);
});
rsvg.addEventListener("pointerleave", () => { tip.hidden = true; });
function rTarget(t) {
  const site = t.closest && t.closest(".site:not(.pending)");
  const tok = t.closest && t.closest(".tok");
  if (tok) return { kind: "tok", evil: tok.dataset.evil, site: tok.dataset.site };
  const th = t.closest && t.closest(".thr");
  if (th) return { kind: "thr", tid: th.dataset.tid, site: site?.dataset.site };
  const mk = t.closest && t.closest(".mk");
  if (mk) return { kind: "mark", mid: mk.dataset.mid };
  if (site) return { kind: "site", site: site.dataset.site };
  return null;
}

/* ---------- Chrome: header, timeline, legend ---------- */
function renderChrome() {
  const max = VIS_RANK[maxLayer()];
  document.querySelectorAll("#layerseg button").forEach(b => { b.hidden = VIS_RANK[b.dataset.layer] > max; b.setAttribute("aria-pressed", String(b.dataset.layer === S.layer)); });
  $("layerseg").hidden = max === 0; $("layer-lbl").hidden = max === 0;
  const n = TURNS.length, sc = $("scrub"), ti = turnIndexOf(S.idx);
  sc.max = Math.max(0, n - 1); sc.value = ti; sc.disabled = n < 2;
  const ev = currentEvent();
  const ticks = $("ticks"); ticks.innerHTML = "";
  if (n > 1) TURNS.forEach((t, k) => {
    const b = document.createElement("button"); b.type = "button"; b.textContent = turnNo(t.key); b.title = turnName(t.key) + (t.events.length > 1 ? ` (${t.events.length} entries)` : ": " + (t.events[0].title || ""));
    b.style.left = (k / (n - 1) * 100) + "%"; if (k === ti) b.className = "on";
    b.onclick = () => { stop(); goTo(t.last, k === ti + 1); }; ticks.appendChild(b);
  });
  const now = $("tl-now");
  if (!ev) { now.innerHTML = `<h2>No story events yet</h2><p class="muted">Open the Story log to record the first movement.</p>`; }
  else if (ev.multi) {
    now.innerHTML = `<h2>${esc(ev.title)}</h2><span class="meta">${ev.multi.length} entries this year</span>
      <div class="turnlist">${ev.multi.map(e => `<div><b>${esc(e.title || "Untitled event")}</b> <span class="muted">· ${esc(R[e.chapter]?.name || "National")}${e.when ? " · " + esc(e.when) : ""}</span>${e.summary ? `<div class="small">${esc(e.summary)}</div>` : ""}</div>`).join("")}</div>${describeChanges(ev)}`;
  }
  else {
    const ch = ev.chapter && R[ev.chapter] ? R[ev.chapter].name : "National";
    now.innerHTML = `<h2>${esc(ev.title || "Untitled event")}</h2><span class="meta">${esc(ev.when || "")}${ev.when ? " · " : ""}${esc(ch)} · <span class="pill vis-${ev.visibility || "public"}">${VIS[ev.visibility || "public"]}</span>${ev.example ? ` <span class="pill ex">Example</span>` : ""}</span>${ev.summary ? `<p>${esc(ev.summary)}</p>` : ""}${describeChanges(ev)}`;
  }
  $("tl-play").textContent = S.playing ? "❚❚" : "▶";
  $("tl-play").setAttribute("aria-label", S.playing ? "Pause" : "Play the story");
  ["tl-first", "tl-prev"].forEach(id => $(id).disabled = ti <= 0);
  $("tl-next").disabled = ti >= n - 1;
  $("tl-play").disabled = n < 2;
  renderWho();
  renderSide();
}
function describeChanges(ev) {
  const at = (region, site) => (R[region]?.name || "?") + (site ? " (" + siteName(region, site) + ")" : "");
  const before = (() => { if (ev.multi) return prevStateOf(EV.indexOf(ev.multi[0])); const i = EV.indexOf(ev); return i > 0 ? STATES[i - 1] : ev === S.draft ? draftBaseState() : blankState(); })();
  const parts = (ev.changes || []).map(c => {
    if (c.type === "set") return `${EVILS[c.evil]?.short || "?"} ${+c.tier ? "at tier " + c.tier : c.all ? "withdraws entirely from" : "withdraws"} in ${at(c.region, c.site)}`.replace("withdraws entirely from in", "withdraws entirely from");
    if (c.type === "move") return `${EVILS[c.evil]?.short || "?"} advances ${at(c.from, c.fromSite)} → ${at(c.to, c.toSite)}${c.keep ? " (holding its ground behind)" : ""}`;
    if (c.type === "clash") return `${EVILS[c.a]?.short || "?"} clashes with ${EVILS[c.b]?.short || "?"} at ${at(c.region, c.site)}${c.note ? ": " + c.note : ""}`;
    if (c.type === "status") return `${R[c.region]?.name || "?"} is ${(STATUSES[c.status] || "clear").toLowerCase()}${c.note ? ": " + c.note : ""}`;
    if (c.type === "threat") {
      const wasR = findThreat(before, c.tid), old = wasR ? before[wasR].threats[c.tid] : null;
      const nm = c.name || old?.name || threatName(c);
      if (c.remove) return `${nm} is gone${wasR ? " from " + R[wasR].name : ""}${c.note ? ": " + c.note : ""}`;
      return `${nm} ${old ? "now" : "appears"} at tier ${c.tier || old?.tier || 1} in ${at(c.region, c.site)}`;
    }
    if (c.type === "mark") {
      const wasR = findMark(before, c.mid), old = wasR ? before[wasR].marks[c.mid] : null;
      const nm = c.label || old?.label || MARKS[c.icon]?.name || "A pinpoint";
      if (c.remove) return `${nm} is cleared from ${R[wasR || c.region]?.name || "the map"}`;
      return `${nm} ${old ? "is updated" : "is marked"} in ${at(c.region, c.site)}`;
    }
    return "";
  }).filter(Boolean);
  return parts.length ? `<p class="muted small" style="font-size:13px">${parts.map(esc).join(" · ")}</p>` : "";
}
function renderLegend() {
  $("legend").innerHTML = EVIL_ORDER.map(k => `<div class="row">${swatch(k, 15, 2)} ${EVILS[k].short}</div>`).join("") +
    `<div class="row">${thrSwatch({ kind: "lesser", tier: 1 }, 15, true)} Lesser Evil</div><div class="row">${thrSwatch({ kind: "other", tier: 1 }, 15, true)} Other threat</div>` +
    `<div class="row"><svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden="true"><g class="swords" transform="scale(.5)"><circle r="14"/><line x1="-8" y1="-8" x2="8" y2="8"/><line x1="8" y1="-8" x2="-8" y2="8"/></g></svg> Contested</div>` +
    `<div class="row">${pinSwatch({ icon: "star" }, 15)} Pinpoint</div>` +
    `<div class="row"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><defs><pattern id="lg-siege" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="var(--bad)" fill-opacity=".15"/><line x1="0" y1="0" x2="0" y2="5" stroke="var(--bad)" stroke-width="2"/></pattern></defs><rect x="1" y="1" width="14" height="14" rx="2" fill="url(#lg-siege)" stroke="var(--bad)" stroke-width="1.5"/></svg> Besieged</div>` +
    `<div class="row"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="1" width="14" height="14" rx="2" class="blackout"/></svg> Fallen</div>` +
    `<div class="row"><svg width="30" height="14" viewBox="0 0 30 14" aria-hidden="true"><rect x="0" y="0" width="30" height="14" rx="7" fill="var(--accent)"/></svg> Next event</div>` +
    `<div class="row" style="grid-column:1/-1"><span class="dkey">${DANGER.map(x => `<i style="background:${x.color}"></i>`).join("")}</span> Danger: calm to dire</div>` +
    `<div class="row muted" style="grid-column:1/-1">Numbers are Power Scale tiers. Double-click a region to zoom in.</div>`;
}

/* ---------- Side panel ---------- */
const TABS = ["threats", "region", "log", "overview", "dispatches", "calendar", "requests", "recap"];
/* "Year 4 of 6." in the header, plus the selected chapter's own step. */
function renderSubStep() {
  const n = TURNS.length, ti = turnIndexOf(S.idx);
  const rs = S.selected && R[S.selected]?.kind === "chapter" ? regionSteps(S.selected) : null, rk = rs ? rs.filter(i => i <= S.idx).length : 0;
  $("sub-step").textContent = n ? (S.draft && S.draft.changes.length ? "Draft preview." : `Year ${turnNo(TURNS[ti].key)} of ${turnNo(TURNS[n - 1].key)}.${rs && rs.length ? ` ${R[S.selected].name}: beat ${rk} of ${rs.length}.` : ""}`) : "";
}
function renderSide() {
  renderSubStep();
  tabBadges();
  document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === S.tab)));
  TABS.forEach(t => $("pane-" + t).hidden = t !== S.tab);
  ({ threats: renderThreats, region: renderRegion, log: renderLog, overview: renderOverview, dispatches: renderDispatches, calendar: renderCalendar, requests: renderRequests, recap: renderRecap })[S.tab]();
}
/* Events up to the step on screen that touch a region, newest first. */
function eventsTouching(id) {
  const upto = S.draft && S.draft.changes.length ? EV.length - 1 : S.idx, out = [];
  for (let i = upto; i >= 0; i--) {
    const e = EV[i]; if (!e) continue;
    if ((e.changes || []).some(c => c.region === id || c.from === id || c.to === id) || e.chapter === id) out.push(i);
  }
  return out;
}
/* Every entry that touches a region, in story order: the region's own story. */
function regionSteps(id) {
  const out = [];
  EV.forEach((e, i) => { if ((e.changes || []).some(c => c.region === id || c.from === id || c.to === id) || e.chapter === id) out.push(i); });
  return out;
}
function regionStory(r) {
  const steps = regionSteps(r.id), t = curTurn(), seen = steps.filter(i => i <= S.idx).length;
  if (!steps.length) return `<div><h5>${esc(r.name)}'s story</h5><span class="muted small">Nothing has happened here yet.</span></div>`;
  const prev = steps.filter(i => t && i < t.first).pop(), next = steps.find(i => i > S.idx);
  return `<div class="rstory"><h5>${esc(r.name)}'s story · beat ${seen} of ${steps.length}</h5>
    <div class="btnrow"><button type="button" class="btn" ${prev != null ? `data-jump="${prev}"` : "disabled"}>◀ Previous here</button><button type="button" class="btn" ${next != null ? `data-jump="${next}"` : "disabled"}>Next here ▶</button></div>
    <div class="hist">${steps.map((i, k) => { const e = EV[i], now = t && i >= t.first && i <= t.last, later = i > S.idx;
      return `<button type="button" data-jump="${i}" class="${now ? "now" : ""}${later ? " later" : ""}"><b>${k + 1}. ${esc(e.title || "Untitled event")}</b><br><span class="muted">${esc(turnName(turnKey(e)))}${e.when ? " · " + esc(e.when) : ""}${later ? " · later in the story" : ""}</span></button>`; }).join("")}</div></div>`;
}
/* "Right now": one line per chapter, built from what is on the map in this year. */
function renderOverview() {
  const st = currentState();
  const rows = CHAPTERS.map(r => {
    const here = st[r.id], d = dangerOf(st, r.id);
    const top = [...EVIL_ORDER.filter(k => here.p[k]).map(k => ({ n: EVILS[k].short, t: here.p[k] })), ...Object.values(here.threats).map(t => ({ n: threatName(t), t: t.tier }))].sort((a, b) => b.t - a.t);
    const last = eventsTouching(r.id)[0];
    return { r, d, here, top, last };
  }).sort((a, b) => b.d.lv - a.d.lv || a.r.name.localeCompare(b.r.name));
  $("pane-overview").innerHTML = `<div><h3>The Abandoned Lands right now</h3><p class="small muted" style="margin:6px 0 0">Every chapter in this year of the story, most dangerous first. Click one for its full summary.</p></div>
    <div class="overview">${rows.map(({ r, d, here, top, last }) => `<button type="button" class="ovrow" data-goreg="${r.id}">
      <span class="ovname">${esc(r.name)}</span>${dangerPill(d)}${here.status ? `<span class="pill st-${here.status}">${STATUSES[here.status]}</span>` : ""}
      <span class="small muted ovline">${top.length ? esc(top.slice(0, 2).map(x => `${x.n} ${x.t}`).join(" · ")) : "No threats"}${last != null ? ` · Last: ${esc(EV[last].title || "Untitled event")}` : ""}</span></button>`).join("")}</div>`;
}
function strength(st, k) { let s = 0, regs = []; for (const id in st) if (st[id].p[k]) { s += st[id].p[k]; regs.push(id); } return { s, regs }; }
function renderThreats() {
  const st = currentState(), prev = prevForView();
  const maxS = Math.max(8, ...EVIL_ORDER.map(k => strength(st, k).s));
  const pane = $("pane-threats");
  const lesser = allThreats(st).sort((a, b) => b.tier - a.tier);
  pane.innerHTML = `<div class="note">Strength adds up every tier the evil holds on the map in this year. Toggle an evil to hide it, or focus to dim the rest.</div>` + EVIL_ORDER.map(k => {
    const E = EVILS[k], { s, regs } = strength(st, k), ps = strength(prev, k).s, d = s - ps;
    const trend = d > 0 ? `<span class="trend-up">▲ ${d}</span>` : d < 0 ? `<span class="trend-down">▼ ${-d}</span>` : `<span>steady</span>`;
    const on = !S.hidden.has(k);
    const fig = S.layer === "public" ? "Unknown to players" : E.figure;
    return `<div class="evil ${on ? "" : "off"}">
      <div class="evil-head">${swatch(k, 26)}<div class="grow"><div class="nm">${E.name}</div><div class="tg">${E.tagline} · “${esc(E.saying)}”</div></div>
        <button type="button" class="eye" data-eye="${k}" aria-pressed="${on}">${on ? "Shown" : "Hidden"}</button></div>
      <div class="meter"><span>Strength ${s}</span><span class="bar"><i style="width:${s / maxS * 100}%;background:var(--${k})"></i></span>${trend}</div>
      <div class="chips">${regs.length ? regs.map(id => `<button type="button" class="chip" data-goreg="${id}">${esc(R[id].name)} · ${st[id].p[k]}</button>`).join("") : `<span class="muted small">Not on the map in this year.</span>`}</div>
      <details><summary>Dossier</summary><dl style="margin-top:6px">
        <dt>Figurehead</dt><dd>${esc(fig)}</dd><dt>Wants</dt><dd>${esc(E.wants)}</dd><dt>Presses</dt><dd>${esc(E.presses)}</dd>
        <dt>On field</dt><dd>${esc(E.feel)}</dd><dt>Counterplay</dt><dd>${esc(E.counter)}</dd><dt>Defectors</dt><dd>${esc(E.defectors)}</dd></dl></details>
      <div class="btnrow"><button type="button" class="btn" data-focus="${k}" aria-pressed="${S.focus === k}">${S.focus === k ? "Clear focus" : "Focus on map"}</button></div>
    </div>`;
  }).join("") + `<div><h5>Lesser evils and other threats</h5>${lesser.length ? `<div class="thrlist">${lesser.map(t => `<div class="thrrow">${thrSwatch(t, 20, true)}<div class="t">${esc(threatName(t))}<small>${esc(threatKind(t))}</small></div><button type="button" class="chip" data-goreg="${t.region}">${esc(R[t.region].name)}</button></div>`).join("")}</div>` : `<div class="muted small">None on the map in this year. Reps add them from a region's page or the Story log.</div>`}</div>`;
}
function tierRow(k, total, own, ctrlAttrs, sub) {
  const ctrl = ctrlAttrs ? `<span class="stepper" role="group" aria-label="${EVILS[k].short} tier"><button type="button" ${ctrlAttrs} data-d="-1" aria-label="Lower tier">−</button><span>${own}</span><button type="button" ${ctrlAttrs} data-d="1" aria-label="Raise tier">+</button></span>` : `<b>${total || "–"}</b>`;
  return `<div class="presrow">${swatch(k, 20)}<div class="t">${EVILS[k].name}<small>${sub}</small></div>${ctrl}</div>`;
}
function threatRows(list, regionId, editing) {
  if (!list.length) return "";
  return `<div class="thrlist">${list.map(t => `<div class="thrrow">${thrSwatch(t, 20, true)}<div class="t">${esc(threatName(t))}<small>${esc(threatKind(t))} · tier ${t.tier}: ${esc(TIERS[t.tier].name)}${t.site ? " · " + esc(siteName(regionId, t.site)) : ""}${t.note ? " · " + esc(t.note) : ""}</small></div>${editing ? `<span class="acts"><button type="button" class="btn" data-thrchg="${t.tid}">Change</button><button type="button" class="btn" data-thrgone="${t.tid}">Gone</button></span>` : ""}</div>`).join("")}</div>`;
}
function markRows(list, regionId, editing) {
  if (!list.length) return "";
  return `<div class="thrlist">${list.map(m => `<div class="thrrow">${pinSwatch(m, 20)}<div class="t">${esc(markName(m))}<small>${esc(MARKS[m.icon]?.name || "Pinpoint")}${m.site ? " · " + esc(siteName(regionId, m.site)) : m.x == null ? " · region-wide" : ""}${m.note ? " · " + esc(m.note) : ""}</small></div>${editing ? `<span class="acts"><button type="button" class="btn" data-mkchg="${m.mid}">Change</button><button type="button" class="btn" data-mkgone="${m.mid}">Clear</button></span>` : ""}</div>`).join("")}</div>`;
}
function renderRegion() {
  const pane = $("pane-region");
  if (!S.selected) { pane.innerHTML = `<div class="empty">Click a town, a front or a sea on the map to see who threatens it, its condition and its history. Double-click to zoom into the region's own map.</div>`; return; }
  const r = R[S.selected], st = currentState(), here = st[r.id];
  const editing = canDraft() && !S.layoutMode;
  const regionEdit = canEditRegion(r.id), detailEdit = canSiteDetails(r.id);
  const inView = RV.id === r.id;
  const sites = sitesFor(r.id, true);
  const site = S.site ? sites.find(x => x.id === S.site) : null;
  const note = S.notes[r.id] || {};
  const statusPill = here.status ? `<span class="pill st-${here.status}">${STATUSES[here.status]}</span>` : `<span class="pill st-holding">Holding</span>`;
  let html = `<div class="region"><div class="lbl">${esc(r.kind === "chapter" ? "Chapter · " + r.band : r.band)}</div><h3>${esc(r.name)}</h3><div style="margin-top:6px">${statusPill}${here.note ? ` <span class="small muted">${esc(here.note)}</span>` : ""}</div>
    <p style="margin:8px 0 0">${esc(r.blurb)}</p></div>
    <div class="btnrow">${inView ? `<button type="button" class="btn primary" data-closereg="1">← Back to the whole map</button>` : `<button type="button" class="btn primary" data-openreg="${r.id}">Zoom into ${esc(r.name)}</button>`}
    ${inView && regionEdit ? `<button type="button" class="btn big" id="site-edit" aria-pressed="${S.siteEdit}">${S.siteEdit ? "Done editing sites" : "Edit sites"}</button>` : ""}</div>`;
  if (r.kind === "chapter") html += nowBox(r, st, here) + aheadBox(r);
  // Pending new site
  if (S.pendingSite && S.pendingSite.region === r.id && regionEdit) {
    html += `<div class="sitebox"><h5>New site</h5><input id="ps-name" placeholder="Name, e.g. Old Mill ford" aria-label="Site name"><input id="ps-note" placeholder="Short description (optional)" aria-label="Site description"><div class="btnrow"><button type="button" class="btn primary" id="ps-save">Add site</button><button type="button" class="btn big" id="ps-cancel">Cancel</button></div></div>`;
  }
  // Selected site
  if (site) {
    const f = here.at[site.id] || {};
    const th = Object.values(here.threats).filter(t => t.site === site.id);
    const mk = Object.values(here.marks).filter(m => m.site === site.id);
    const storyOK = VIS_RANK[S.layer] >= 1;
    html += `<div class="sitebox"><div class="lbl">Site in ${esc(r.name)}</div><h3 style="font-size:20px">${esc(site.name)}</h3>${site.note && !detailEdit ? `<p style="margin:0">${esc(site.note)}</p>` : ""}${site.story && storyOK && !detailEdit ? `<p style="margin:0" class="small"><b style="font-weight:500">Story team:</b> ${esc(site.story)}</p>` : ""}
      <div>${EVIL_ORDER.map(k => (f[k] || editing) ? tierRow(k, f[k] || 0, f[k] || 0, editing ? `data-step="${k}" data-site="${site.id}"` : "", f[k] ? `Tier ${f[k]}: ${esc(TIERS[f[k]].name)}` : "Not here") : "").join("") || `<div class="muted small">No External Evil at this site.</div>`}</div>
      ${threatRows(th, r.id, editing)}${markRows(mk, r.id, editing)}
      ${editing ? `<div class="btnrow"><button type="button" class="btn" data-addthr="${site.id}">+ Lesser evil or threat here</button><button type="button" class="btn" data-addmark="${site.id}">+ Pinpoint here</button><button type="button" class="btn" data-addclash="${site.id}">+ Clash here</button></div>` : ""}
      ${detailEdit ? `<div class="field"><label class="lbl" for="se-note">Details players see</label><textarea id="se-note" placeholder="What's here: people, landmarks, rumours">${esc(site.note || "")}</textarea></div><div class="field"><label class="lbl" for="se-story">Story team details</label><textarea id="se-story" placeholder="Hooks, secrets and plans for this place">${esc(site.story || "")}</textarea></div><div class="btnrow"><button type="button" class="btn primary" id="se-details">Save details</button></div>` : ""}
      ${S.siteEdit && regionEdit ? `${canRenameSite(site) ? `<div class="field"><label class="lbl" for="se-name">Name</label><input id="se-name" value="${esc(site.name)}"></div><div class="btnrow"><button type="button" class="btn" id="se-save">Save name</button></div>` : `<div class="note">Only the NST Lead can rename the map's own places.</div>`}<div class="btnrow"><button type="button" class="btn danger" id="se-del">${site.custom ? "Delete site" : "Hide site"}</button></div>` : ""}
      <div class="btnrow"><button type="button" class="btn" data-unsite="1">Close site</button></div></div>`;
  }
  // The "being updated" notice and location names, for the NST Team and the NST Lead
  if (inView && isNST()) {
    const nt = S.settings.notice || {};
    html += `<div class="notebox"><h5>Map notice</h5><label class="ck"><input type="checkbox" id="mn-show" ${noticeOn(r.id) || !nt.text ? "checked" : ""}> Show the notice on ${esc(r.name)}'s map</label>
      <label class="lbl" for="mn-text">Notice on every region map still being updated</label><input id="mn-text" value="${esc(nt.text ?? NOTICE_TEXT)}" placeholder="Leave empty to hide it everywhere">
      <div class="btnrow"><button type="button" class="btn" id="mn-save">Save notice</button></div></div>`;
  }
  if (isLead()) {
    const o = S.settings.regions?.[r.id] || {};
    html += `<div class="notebox"><h5>Location details · NST Lead</h5><label class="lbl" for="ld-name">Name on the map</label><input id="ld-name" value="${esc(r.name)}">
      <label class="lbl" for="ld-blurb">Description</label><textarea id="ld-blurb">${esc(r.blurb || "")}</textarea>
      <div class="btnrow"><button type="button" class="btn primary" id="ld-save">Save</button>${o.name || o.blurb ? `<button type="button" class="btn" id="ld-reset">Back to the original</button>` : ""}</div>
      <div class="note">Renames this place everywhere on the map. To rename a place on a region's map, zoom in, press Edit sites and click it.</div></div>`;
  }
  // Story notes for the region
  const canStory = VIS_RANK[S.layer] >= 1;
  if (regionEdit) {
    html += `<div class="notebox"><h5>Current situation</h5><label class="lbl" for="n-pub">For players</label><textarea id="n-pub" placeholder="What players know about this region right now">${esc(note.public || "")}</textarea>
      <label class="lbl" for="n-story">For story teams and the NST Team</label><textarea id="n-story" placeholder="Hooks, plans and things players haven't found yet">${esc(note.story || "")}</textarea>
      <div class="btnrow"><button type="button" class="btn primary" id="n-save">Save notes</button>${note.updatedBy ? `<span class="note">Last updated by ${esc(note.updatedBy)}${note.updatedAt ? ", " + esc(new Date(note.updatedAt).toLocaleDateString()) : ""}</span>` : ""}</div></div>`;
  } else if (note.public || (canStory && note.story)) {
    html += `<div class="notebox"><h5>Current situation</h5>${note.public ? `<p>${esc(note.public)}</p>` : ""}${canStory && note.story ? `<div class="lbl">Story team notes</div><p>${esc(note.story)}</p>` : ""}${note.updatedBy ? `<span class="note">Updated by ${esc(note.updatedBy)}</span>` : ""}</div>`;
  }
  // Region totals
  const rows = EVIL_ORDER.map(k => {
    const total = here.p[k] || 0, own = here.base[k] || 0;
    const placed = Object.entries(here.at).filter(([, f]) => f[k]).map(([sid, f]) => `${siteName(r.id, sid)} (${f[k]})`);
    const sub = total ? `Tier ${total}: ${esc(TIERS[total].name)} · ${esc(TIERS[total].approval)}${placed.length ? `<br>At ${esc(placed.join(", "))}${own ? `; region-wide ${own}` : ""}` : ""}` : "Not present";
    return tierRow(k, total, own, editing ? `data-step="${k}"` : "", sub);
  }).join("");
  html += `<div><h5>External Evils here</h5>${rows}${editing ? `<div class="btnrow" style="margin-top:8px"><label class="small" for="st-sel">Condition</label><select id="st-sel" class="btn">${["none", ...Object.keys(STATUSES)].map(s => `<option value="${s}" ${(here.status || "none") === s ? "selected" : ""}>${s === "none" ? "Holding (clear)" : STATUSES[s]}</option>`).join("")}</select></div><div class="note">Steppers here set region-wide strength. To place a force at a site, zoom in and click the site. Changes go into a draft event in the Story log; nothing is saved until you add it to the story.</div>` : ""}</div>`;
  const th = Object.values(here.threats).sort((a, b) => b.tier - a.tier);
  html += `<div><h5>Lesser evils and other threats</h5>${threatRows(th, r.id, editing) || `<div class="muted small">None here in this year.</div>`}${editing ? `<div class="btnrow" style="margin-top:6px"><button type="button" class="btn" data-addthr="">+ Add a lesser evil or threat</button></div>` : ""}</div>`;
  const mks = Object.values(here.marks);
  html += `<div><h5>Pinpoints</h5>${markRows(mks, r.id, editing) || `<div class="muted small">No pinpoints here in this year.</div>`}${editing ? `<div class="btnrow" style="margin-top:6px"><button type="button" class="btn" data-addmark="">+ Pinpoint on the map</button></div><div class="note">Mark story moments, camps, battles or places of interest. Click the region's map to place it.</div>` : ""}</div>`;
  if (r.gov) html += `<div class="region"><h5>The town</h5><dl><dt>Governance</dt><dd>${esc(r.gov)}</dd><dt>Economy</dt><dd>${esc(r.econ)}</dd><dt>Tensions</dt><dd>${esc(r.tens)}</dd></dl></div>`;
  if (r.orbit && r.orbit.length) html += `<div><h5>Regional orbit</h5><div class="chips">${r.orbit.map(o => `<span class="chip">${esc(o)}</span>`).join("")}</div></div>`;
  html += regionStory(r);
  pane.innerHTML = html;
}

/* The region's summary: danger, condition and the latest events, all from canon map entries. */
function nowBox(r, st, here) {
  const d = dangerOf(st, r.id);
  const since = here.status ? lastChange(c => c.type === "status" && c.region === r.id) : null;
  const recent = eventsTouching(r.id).slice(0, 3);
  const o = S.settings.danger?.[r.id];
  let html = `<div class="nowbox"><h5>Right now</h5>${dangerGauge(d.lv)}<div><b class="dname" style="color:${DANGER[d.lv].color}">${DANGER[d.lv].name}</b>${d.set ? ` <span class="small muted">set by the NST Team</span>` : ""}</div>
    <p style="margin:4px 0 0">${esc(d.feel)}</p>
    <div class="small muted" style="margin-top:4px">${d.why.length ? "Why: " + esc(d.why.join(" · ")) : "No threats here."}</div>
    ${here.status ? `<div class="small" style="margin-top:6px"><span class="pill st-${here.status}">${STATUSES[here.status]}</span>${since ? ` since ${esc(since.title || "an untitled event")}${since.when ? " (" + esc(since.when) + ")" : ""}` : ""}</div>` : ""}
    <div class="lbl" style="margin-top:8px">Latest events</div>${recent.length ? `<div class="hist">${recent.map(i => `<button type="button" data-jump="${i}"><b>${esc(EV[i].title || "Untitled event")}</b>${EV[i].when ? ` <span class="muted">· ${esc(EV[i].when)}</span>` : ""}</button>`).join("")}</div>` : `<div class="small muted">Nothing has happened here yet.</div>`}`;
  if (isNST()) {
    html += `<details class="dset"${o ? " open" : ""}><summary>Set the danger level by hand</summary>
      <label class="lbl" for="dg-level">Level</label><select id="dg-level" class="btn"><option value="">Work it out from the map (${DANGER[d.auto].name})</option>${DANGER.map((x, i) => `<option value="${i}" ${o && +o.level === i ? "selected" : ""}>${x.name}</option>`).join("")}</select>
      <label class="lbl" for="dg-why">Why (players see this)</label><input id="dg-why" value="${esc(o?.why || "")}" placeholder="e.g. The thorn wall is failing">
      <label class="lbl" for="dg-feel">What players feel</label><input id="dg-feel" value="${esc(o?.feel || "")}" placeholder="Leave empty for the usual line">
      <div class="btnrow"><button type="button" class="btn" id="dg-save">Save danger level</button></div></details>`;
  }
  return html + `</div>`;
}

/* The chapter's next event and latest dispatch, linking to their tabs. */
function aheadBox(r) {
  const nx = nextEventFor(r.id), dp = S.dispatches.filter(x => x.chapter === r.id).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))[0];
  if (!nx && !dp) return "";
  return `<div class="aheadbox">${nx ? `<button type="button" data-tabgo="calendar"><span class="lbl">Next event</span><b>${esc(longDate(nx.date))}</b> ${esc(nx.name)}</button>` : ""}${dp ? `<button type="button" data-tabgo="dispatches" data-dpfrom="${r.id}"><span class="lbl">Latest dispatch</span><b>${esc(dp.title)}</b>${dp.when ? ` <span class="muted">· ${esc(dp.when)}</span>` : ""}</button>` : ""}</div>`;
}

/* ---------- Draft editing ---------- */
function defaultChapter() { const mine = myChapters(); if (isNST()) return "national"; return mine[0] || "national"; }
function newDraft() { return { id: null, title: "", when: "", chapter: defaultChapter(), visibility: "story", summary: "", changes: [], turn: openTurnKey() }; }
function ensureDraft() { if (!S.draft) S.draft = newDraft(); return S.draft; }
function claimChapter(dr, id) { if (R[id]?.kind === "chapter" && dr.chapter === "national" && (isNST() || myChapters().includes(id))) dr.chapter = id; }
function stepTier(evil, d, site) {
  const dr = ensureDraft(), id = S.selected;
  const cur = applyEvent(draftBaseState(), dr)[id];
  const now = site ? (cur.at[site]?.[evil] || 0) : (cur.base[evil] || 0);
  const t = Math.max(0, Math.min(5, now + d));
  const ex = dr.changes.find(c => c.type === "set" && c.region === id && c.evil === evil && (c.site || "") === (site || ""));
  if (ex) ex.tier = t; else dr.changes.push(site ? { type: "set", evil, region: id, site, tier: t } : { type: "set", evil, region: id, tier: t });
  claimChapter(dr, id);
  refreshAll(false);
}
function setStatus(v) {
  const dr = ensureDraft(); const id = S.selected;
  const ex = dr.changes.find(c => c.type === "status" && c.region === id);
  if (ex) ex.status = v; else dr.changes.push({ type: "status", region: id, status: v, note: "" });
  claimChapter(dr, id);
  refreshAll(false);
}
const newTid = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function addThreat(site) {
  const dr = ensureDraft(), id = S.selected || "sudenburg";
  const home = Object.keys(LESSER).find(k => LESSER[k].home === id);
  dr.changes.push({ type: "threat", tid: newTid(), kind: "lesser", group: home || "forsworn", name: "", tier: 1, region: id, site: site || "", note: "" });
  claimChapter(dr, id);
  S.tab = "log"; refreshAll(false); toast("Fill in the threat in the draft below");
}
const newMid = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
/* Start placing a pinpoint: the next click on the region's map sets where it goes. */
function startPlacing(ci) {
  const id = ci != null ? S.draft?.changes[ci]?.region : S.selected;
  if (!id || !R[id]) return;
  S.placing = { ci: ci ?? null };
  if (RV.id !== id) openRegion(id); else { renderRegionView({ fresh: false }); renderSide(); }
  toast("Click the map to place the pinpoint");
}
function placeMark(site, x, y) {
  const dr = ensureDraft(), id = RV.id;
  let c = S.placing?.ci != null ? dr.changes[S.placing.ci] : null;
  if (!c || c.type !== "mark") { c = freshChange("mark", id); dr.changes.push(c); }
  c.region = id;
  if (site) Object.assign(c, { site, x: null, y: null }); else Object.assign(c, { site: "", x: +x.toFixed(4), y: +y.toFixed(4) });
  claimChapter(dr, id);
  S.placing = null; S.tab = "log"; refreshAll(false); toast("Name the pinpoint in the draft");
}
function addMark(site) {
  const id = S.selected; if (!id) return;
  if (site) { const dr = ensureDraft(), c = freshChange("mark", id); c.site = site; dr.changes.push(c); claimChapter(dr, id); S.tab = "log"; refreshAll(false); toast("Name the pinpoint in the draft"); return; }
  startPlacing(null);
}
function editMark(mid, gone) {
  const st = currentState(), id = findMark(st, mid); if (!id) return;
  const m = st[id].marks[mid], dr = ensureDraft();
  const ex = dr.changes.find(c => c.type === "mark" && c.mid === mid);
  if (ex) { if (gone) ex.remove = true; }
  else dr.changes.push({ type: "mark", mid, icon: m.icon, label: m.label, region: id, site: m.site || "", x: m.x, y: m.y, note: m.note || "", ...(gone ? { remove: true } : {}) });
  claimChapter(dr, id);
  if (!gone) { S.tab = "log"; toast("Change the pinpoint in the draft below"); }
  refreshAll(false);
}
function editThreat(tid, gone) {
  const st = currentState(), id = findThreat(st, tid); if (!id) return;
  const t = st[id].threats[tid], dr = ensureDraft();
  const ex = dr.changes.find(c => c.type === "threat" && c.tid === tid);
  if (ex) { if (gone) ex.remove = true; }
  else dr.changes.push({ type: "threat", tid, kind: t.kind, group: t.group, name: t.name, tier: t.tier, region: id, site: t.site || "", note: t.note || "", ...(gone ? { remove: true } : {}) });
  claimChapter(dr, id);
  if (!gone) { S.tab = "log"; toast("Change the threat in the draft below"); }
  refreshAll(false);
}
function draftWarnings(dr) {
  const out = [], base = draftBaseState();
  let running = cloneState(base);
  for (const c of dr.changes) {
    if (c.type === "set" || c.type === "move") {
      const rid = c.type === "set" ? c.region : c.to;
      const before = running[rid]?.p[c.evil] || 0;
      const nextS = applyEvent(running, { changes: [c] });
      const after = nextS[rid]?.p[c.evil] || 0;
      const nm = `${EVILS[c.evil]?.short} in ${R[rid]?.name}`;
      if (after - before > 1) out.push({ t: `${nm} jumps from tier ${before} to ${after}. The guidebook climbs one tier at a time and gives players an event to respond.` });
      if (after > before && after === 5) out.push({ hard: true, nst: true, t: `${nm} reaches tier 5: a national event where the figurehead appears. NST Team only.` });
      else if (after > before && after === 4) out.push({ hard: true, nst: true, t: `${nm} at tier 4 is a campaign. Brett or Andrew must approve it.` });
      else if (after > before && after === 3 && R[rid]?.kind === "chapter") out.push({ t: `${nm} at tier 3 is an incursion. The chapter's NST Rep signs off, and it is limited to one per evil per chapter per season.` });
      if (c.type === "move" && !(c.fromSite ? running[c.from]?.at[c.fromSite]?.[c.evil] : running[c.from]?.p[c.evil])) out.push({ t: `${EVILS[c.evil]?.short} has no force in ${R[c.from]?.name}${c.fromSite ? " at " + siteName(c.from, c.fromSite) : ""} to move from at this point.` });
    }
    if (c.type === "clash" && c.a === c.b) out.push({ t: "A clash needs two different evils." });
    if (c.type === "threat" && !c.remove) {
      const wasR = findThreat(running, c.tid), old = wasR ? running[wasR].threats[c.tid] : null, nm = c.name || threatName(c);
      if (c.kind === "lesser" && +c.tier > 3) out.push({ hard: true, nst: true, t: `Lesser Evils stop at tier 3. Past that the NST Team decides whether ${nm} becomes something greater.` });
      else if (+c.tier === 3 && (!old || old.tier < 3)) out.push({ t: `${nm} at tier 3 needs the chapter's NST Rep to sign off.` });
      if (old && +c.tier - old.tier > 1) out.push({ t: `${nm} jumps from tier ${old.tier} to ${c.tier}. Lesser Evils grow one step per season at most.` });
      const home = c.kind === "lesser" ? LESSER[c.group]?.home : null;
      if (home && home !== c.region) out.push({ t: `${LESSER[c.group].name} belongs to ${R[home].name}. Talk to ${R[home].name}'s NST Rep before using them.` });
      if (c.kind === "other" && !String(c.name || "").trim()) out.push({ t: "Give this threat a name so players and other chapters can tell it apart." });
    }
    if (c.type === "mark" && !c.remove) {
      if (!String(c.label || "").trim()) out.push({ t: "Give the pinpoint a name, so players can tell what it marks." });
      if (!c.site && c.x == null && !findMark(running, c.mid)) out.push({ t: "This pinpoint has no spot yet. Press Place on the map, or pick a site, or it shows as region-wide." });
    }
    running = applyEvent(running, { changes: [c] });
  }
  const evilsAtT2 = new Set(); dr.changes.forEach(c => { const rid = c.region || c.to; const t = running[rid]?.p[c.evil]; if (t === 2 && c.evil) evilsAtT2.add(c.evil); });
  if (evilsAtT2.size > 1) out.push({ t: "More than one External Evil at pocket-problem level in one event. The guidebook allows one per event so players can tell them apart." });
  if (!isNST() && dr.chapter !== "national" && !myChapters().includes(dr.chapter)) out.push({ hard: true, nst: true, t: "You can only record events for your own chapter." });
  if (!isNST() && dr.chapter === "national") out.push({ hard: true, nst: true, t: "National events are recorded by the NST Team. Pick your chapter." });
  return out;
}
const opt = (v, l, sel) => `<option value="${esc(v)}" ${String(sel ?? "") === String(v) ? "selected" : ""}>${esc(l)}</option>`;
function regionOptions(sel, filter) { return REGIONS.filter(filter || (() => true)).map(r => opt(r.id, r.name, sel)).join(""); }
function siteOptions(region, sel) { return opt("", "Region-wide (no site)", sel) + sitesFor(region).map(s => opt(s.id, s.name, sel)).join(""); }
function evilOptions(sel) { return EVIL_ORDER.map(k => opt(k, EVILS[k].short, sel)).join(""); }
function tierOptions(sel, min = 0, max = 5) { return TIERS.filter(t => t.n >= min && t.n <= max).map(t => opt(t.n, `${t.n} · ${t.name}`, +sel)).join(""); }
function changeEditor(c, i) {
  const typeSel = `<select data-ci="${i}" data-f="type" aria-label="Kind of change">${[["set", "Set presence"], ["move", "Advance / move"], ["clash", "Clash between evils"], ["status", "Region condition"], ["threat", "Lesser evil or other threat"], ["mark", "Pinpoint or marker"]].map(([v, l]) => opt(v, l, c.type)).join("")}</select>`;
  let body = "";
  if (c.type === "set") body = `<select data-ci="${i}" data-f="evil" aria-label="Evil">${evilOptions(c.evil)}</select><select data-ci="${i}" data-f="tier" aria-label="Tier">${tierOptions(c.tier)}</select><select data-ci="${i}" data-f="region" aria-label="Region">${regionOptions(c.region)}</select><select data-ci="${i}" data-f="site" aria-label="Site">${siteOptions(c.region, c.site || "")}</select>${!c.site && !+c.tier ? `<label class="ck"><input type="checkbox" data-ci="${i}" data-f="all" ${c.all ? "checked" : ""}> Also clear it from every site in the region</label>` : ""}`;
  if (c.type === "move") body = `<select data-ci="${i}" data-f="evil" aria-label="Evil">${evilOptions(c.evil)}</select><select data-ci="${i}" data-f="tier" aria-label="Arriving tier">${tierOptions(c.tier || 1, 1)}</select><select data-ci="${i}" data-f="from" aria-label="From">${regionOptions(c.from)}</select><select data-ci="${i}" data-f="fromSite" aria-label="From site">${siteOptions(c.from, c.fromSite || "")}</select><select data-ci="${i}" data-f="to" aria-label="To">${regionOptions(c.to)}</select><select data-ci="${i}" data-f="toSite" aria-label="To site">${siteOptions(c.to, c.toSite || "")}</select><label class="ck"><input type="checkbox" data-ci="${i}" data-f="keep" ${c.keep ? "checked" : ""}> Keep a force where it came from</label>`;
  if (c.type === "clash") body = `<select data-ci="${i}" data-f="a" aria-label="First evil">${evilOptions(c.a)}</select><select data-ci="${i}" data-f="b" aria-label="Second evil">${evilOptions(c.b)}</select><select data-ci="${i}" data-f="region" aria-label="Where">${regionOptions(c.region)}</select><select data-ci="${i}" data-f="site" aria-label="Site">${siteOptions(c.region, c.site || "")}</select><input class="full" data-ci="${i}" data-f="note" placeholder="What happened between them" value="${esc(c.note || "")}">`;
  if (c.type === "status") body = `<select data-ci="${i}" data-f="region" aria-label="Region">${regionOptions(c.region)}</select><select data-ci="${i}" data-f="status" aria-label="Condition">${["none", ...Object.keys(STATUSES)].map(s => opt(s, s === "none" ? "Holding (clear)" : STATUSES[s], c.status || "none")).join("")}</select><input class="full" data-ci="${i}" data-f="note" placeholder="Short note (optional)" value="${esc(c.note || "")}">`;
  if (c.type === "threat") {
    const before = draftBaseState(), existing = findThreat(before, c.tid);
    const pick = `<select class="full" data-ci="${i}" data-f="tid" aria-label="Which threat">${opt("__new", "A new threat", existing ? "" : "__new")}${allThreats(before).map(t => opt(t.tid, `${threatName(t)} (${R[t.region].name})`, c.tid)).join("")}</select>`;
    const groups = c.kind === "lesser" ? Object.keys(LESSER).map(k => opt(k, LESSER[k].name, c.group)).join("") : Object.keys(OTHER).map(k => opt(k, OTHER[k], c.group)).join("");
    body = `${pick}<select data-ci="${i}" data-f="kind" aria-label="Kind">${opt("lesser", "Lesser Evil", c.kind)}${opt("other", "Other threat", c.kind)}</select><select data-ci="${i}" data-f="group" aria-label="${c.kind === "lesser" ? "Which Lesser Evil" : "Category"}">${groups}</select>
      <input class="full" data-ci="${i}" data-f="name" placeholder="${c.kind === "lesser" ? "Band or leader name (optional)" : "Name, e.g. the Blackmaw raiders"}" value="${esc(c.name || "")}">
      <select data-ci="${i}" data-f="tier" aria-label="Tier">${tierOptions(c.tier || 1, 1, c.kind === "lesser" && !isNST() ? 3 : 5)}</select><select data-ci="${i}" data-f="region" aria-label="Region">${regionOptions(c.region)}</select>
      <select class="full" data-ci="${i}" data-f="site" aria-label="Site">${siteOptions(c.region, c.site || "")}</select>
      <input class="full" data-ci="${i}" data-f="note" placeholder="What it is doing" value="${esc(c.note || "")}">
      ${existing ? `<label class="ck"><input type="checkbox" data-ci="${i}" data-f="remove" ${c.remove ? "checked" : ""}> Defeated or gone (takes it off the map)</label>` : ""}`;
  }
  if (c.type === "mark") {
    const before = draftBaseState(), existing = findMark(before, c.mid);
    const pick = `<select class="full" data-ci="${i}" data-f="mid" aria-label="Which pinpoint">${opt("__new", "A new pinpoint", existing ? "" : "__new")}${allMarks(before).map(m => opt(m.mid, `${markName(m)} (${R[m.region].name})`, c.mid)).join("")}</select>`;
    const where = (c.x != null ? opt("__xy", "Placed on the map", "__xy") : "") + siteOptions(c.region, c.x != null ? "__xy" : c.site || "");
    body = `${pick}<select data-ci="${i}" data-f="icon" aria-label="Kind of pinpoint">${Object.keys(MARKS).map(k => opt(k, MARKS[k].glyph.replace("\uFE0E", "") + " " + MARKS[k].name, c.icon)).join("")}</select><select data-ci="${i}" data-f="region" aria-label="Region">${regionOptions(c.region)}</select>
      <input class="full" data-ci="${i}" data-f="label" placeholder="Name, e.g. The burned chapel" value="${esc(c.label || "")}">
      <select data-ci="${i}" data-f="site" aria-label="Where">${where}</select><button type="button" class="btn" data-placemark="${i}">Place on the map</button>
      <input class="full" data-ci="${i}" data-f="note" placeholder="What happened or what's here" value="${esc(c.note || "")}">
      ${existing ? `<label class="ck"><input type="checkbox" data-ci="${i}" data-f="remove" ${c.remove ? "checked" : ""}> Clear it from the map</label>` : ""}`;
  }
  return `<div class="chg"><div class="full" style="padding-right:22px">${typeSel}</div>${body}<button type="button" class="x" data-delc="${i}" aria-label="Remove this change">×</button></div>`;
}
function freshChange(type, sel) {
  sel = sel || S.selected || "sudenburg";
  if (type === "set") return { type: "set", evil: "pale", region: sel, site: S.site && S.selected === sel ? S.site : "", tier: 1 };
  if (type === "move") return { type: "move", evil: "gor", from: "wastes", to: sel === "wastes" ? "eisendreieck" : sel, toSite: "", tier: 1, keep: true };
  if (type === "clash") return { type: "clash", a: "pale", b: "wild", region: sel, site: S.site && S.selected === sel ? S.site : "", note: "" };
  if (type === "status") return { type: "status", region: sel, status: "threatened", note: "" };
  if (type === "mark") return { type: "mark", mid: newMid(), icon: "star", label: "", region: sel, site: S.site && S.selected === sel ? S.site : "", x: null, y: null, note: "" };
  const home = Object.keys(LESSER).find(k => LESSER[k].home === sel);
  return { type: "threat", tid: newTid(), kind: "lesser", group: home || "forsworn", name: "", tier: 1, region: sel, site: S.site && S.selected === sel ? S.site : "", note: "" };
}
function renderLog() {
  const pane = $("pane-log");
  let html = "";
  if (S.usingFallback) html += `<div class="empty">${S.loaded ? "The shared story log is empty. The map shows the guidebook's opening positions until the first event is saved." : "Loading the shared story log…"}</div>`;
  if (canDraft()) {
    if (!S.draft) html += `<div class="btnrow"><button type="button" class="btn primary" id="d-new">Record a new event</button><span class="note">Or open a region and use its steppers.</span></div>`;
    else {
      const dr = S.draft, warns = draftWarnings(dr), blocked = !isNST() && warns.some(w => w.nst);
      const chapterOpts = (isNST() ? `<option value="national">National</option>` : "") + regionOptions(dr.chapter, r => r.kind === "chapter" && (isNST() || myChapters().includes(r.id)));
      const turnOpts = [...new Set([...allTurnKeys(), +dr.turn])].sort((a, b) => a - b).map(k => opt(k, turnName(k) + (k === openTurnKey() ? " (current)" : ""), dr.turn)).join("");
      html += `<div class="draft"><div class="lbl">${dr.id ? "Editing event" : "New event"} · goes into ${esc(turnName(dr.turn))}</div>
        ${isNST() ? `<div class="field"><label class="lbl" for="d-turn">Year</label><select id="d-turn">${turnOpts}</select></div>` : ""}
        <div class="field"><label class="lbl" for="d-title">Title</label><input id="d-title" value="${esc(dr.title)}" placeholder="e.g. The bells of the barrow road"></div>
        <div class="row2"><div class="field"><label class="lbl" for="d-when">When</label><input id="d-when" value="${esc(dr.when)}" placeholder="Season, event or date"></div>
        <div class="field"><label class="lbl" for="d-ch">Chapter</label><select id="d-ch">${chapterOpts}</select></div></div>
        <div class="field"><label class="lbl" for="d-vis">Who can see it</label><select id="d-vis">${Object.keys(VIS).map(v => opt(v, VIS[v], dr.visibility)).join("")}</select></div>
        <div class="field"><label class="lbl" for="d-sum">What happened</label><textarea id="d-sum" placeholder="What players saw, did and changed">${esc(dr.summary)}</textarea></div>
        <div class="lbl">Changes to the map</div>
        ${dr.changes.map(changeEditor).join("") || `<div class="note">No changes yet. Add one below, or open a region on the map and use its steppers.</div>`}
        <div class="btnrow"><button type="button" class="btn" data-addc="set">+ Presence</button><button type="button" class="btn" data-addc="move">+ Advance</button><button type="button" class="btn" data-addc="clash">+ Clash</button><button type="button" class="btn" data-addc="status">+ Condition</button><button type="button" class="btn" data-addc="threat">+ Lesser evil or threat</button><button type="button" class="btn" data-addc="mark">+ Pinpoint</button></div>
        ${warns.length ? `<div class="warns">${warns.map(w => `<div class="${w.hard ? "hard" : ""}">${esc(w.t)}</div>`).join("")}</div>` : ""}
        ${blocked ? `<div class="note">This needs the NST Team. Discard it, or ask Brett or Andrew to record it.</div>` : ""}
        <div class="btnrow"><button type="button" class="btn primary" id="d-save" ${dr.title.trim() && !blocked ? "" : "disabled"}>${dr.id ? "Save changes" : "Add to the story"}</button><button type="button" class="btn big" id="d-cancel">Discard</button></div></div>`;
    }
  } else {
    html += `<div class="note">${Store.mode === "sheets" ? "Chapter NST Reps can sign in with their rep code to record events." : "This copy isn't connected to the shared story sheet yet."}</div>`;
  }
  const ok = openTurnKey();
  html += `<div class="turnbox"><div><span class="lbl">Current year</span><br><b>${esc(turnName(ok))}</b></div>
    <div class="note">New entries go into this year. ${isNST() ? "Start a new year when the national story moves on." : "The NST Team starts each new year."}</div>
    ${isNST() && !S.usingFallback ? `<details class="dset"><summary>Start a new year or rename this one</summary><label class="lbl" for="turn-label">Year name</label><input id="turn-label" placeholder="e.g. 2026 or The Year of Ash">
      <div class="btnrow"><button type="button" class="btn primary" id="turn-open">Start year ${allTurnKeys().length + 1}</button><button type="button" class="btn" id="turn-rename">Rename year ${turnNo(ok)}</button></div></details>` : ""}</div>`;
  const chs = [...new Set(EV.map(e => e.chapter).filter(c => R[c]))];
  html += `<div class="field"><label class="lbl" for="log-filter">Whose story</label><select id="log-filter">${opt("", "The whole Abandoned Lands", S.logFilter)}${CHAPTERS.filter(r => chs.includes(r.id) || r.id === S.logFilter).map(r => opt(r.id, r.name, S.logFilter)).join("")}</select></div>`;
  const fsteps = S.logFilter ? regionSteps(S.logFilter) : null;
  html += `<div class="lbl">${fsteps ? `${esc(R[S.logFilter].name)}'s story · ${fsteps.length} beat${fsteps.length === 1 ? "" : "s"}` : `The story so far · ${TURNS.length} year${TURNS.length === 1 ? "" : "s"}, ${EV.length} entr${EV.length === 1 ? "y" : "ies"}`} visible to ${VIS[S.layer]}</div>`;
  const ct = curTurn();
  html += TURNS.map(t => {
    const rows = [];
    for (let i = t.first; i <= t.last; i++) if (!fsteps || fsteps.includes(i)) rows.push(i);
    if (!rows.length) return "";
    return `<div class="turnhead${t === ct ? " cur" : ""}"><button type="button" data-jump="${t.last}">${esc(turnName(t.key))}</button><span class="muted small">${t.events.length} entr${t.events.length === 1 ? "y" : "ies"}</span></div>` + rows.map(i => {
    const e = EV[i];
    const ch = e.chapter && R[e.chapter] ? R[e.chapter].name : "National";
    const del = S.confirmDel === e.id, mine = !S.usingFallback && canEditEvent(e);
    const acts = mine ? (del
      ? `<button type="button" class="btn danger" data-delok="${e.id}">Delete</button><button type="button" data-delno="1">Keep</button>`
      : `${isNST() && t.events.length > 1 ? `<button type="button" data-up="${i}" aria-label="Move earlier in the year" ${i === t.first ? "disabled" : ""}>↑</button><button type="button" data-down="${i}" aria-label="Move later in the year" ${i === t.last ? "disabled" : ""}>↓</button>` : ""}<button type="button" data-edit="${e.id}">Edit</button><button type="button" data-del="${e.id}" aria-label="Delete event">✕</button>`) : "";
    return `<div class="ev ${t === ct && !(S.draft && S.draft.changes.length) ? "cur" : ""}"><div class="n">${fsteps ? fsteps.indexOf(i) + 1 : "•"}</div><div style="min-width:0"><button type="button" data-jump="${i}" style="border:0;background:none;padding:0;text-align:left" class="tt">${esc(e.title)}</button>
      <div class="mm"><span>${esc(e.when || "")}</span><span>${esc(ch)}</span><span class="pill vis-${e.visibility || "public"}">${VIS[e.visibility || "public"]}</span>${e.example ? `<span class="pill ex">Example</span>` : ""}${e.updatedBy ? `<span>by ${esc(e.updatedBy)}</span>` : ""}</div></div><div class="acts">${acts}</div></div>`;
  }).join(""); }).join("");
  if (isNST() && !S.usingFallback && S.events.some(e => e.example)) html += `<div class="btnrow"><button type="button" class="btn" id="clear-ex">Remove the example events</button></div>`;
  if (isNST() && S.usingFallback && S.loaded) html += `<div class="btnrow"><button type="button" class="btn big" id="seed-open">Save the opening positions as year 1</button></div>`;
  html += `<details class="setup" ${S.layoutMode ? "open" : ""}><summary>Map setup</summary>
    ${isNST() ? `<div class="btnrow"><button type="button" class="btn big" id="lay-toggle" aria-pressed="${S.layoutMode}">${S.layoutMode ? "Done arranging" : "Arrange places on the map"}</button><button type="button" class="btn" id="lay-reset">Reset positions</button></div>
    <div class="note">Drag towns, fronts and waters to move them. Territories redraw around them and the change is shared.</div>` : `<div class="note">Arranging the main map is for the NST Team. Reps can add and move sites inside their own region's map.</div>`}
    <div class="btnrow"><button type="button" class="btn" id="exp">Export the story as JSON</button></div></details>`;
  pane.innerHTML = html;
}

/* ---------- Saving through the store ---------- */
const clean = o => JSON.parse(JSON.stringify(o));
async function saveDraft() {
  const dr = S.draft; if (!dr || !dr.title.trim() || !canDraft()) return;
  if (!isNST() && draftWarnings(dr).some(w => w.nst)) { toast("This change needs the NST Team"); return; }
  const body = clean({ turn: dr.turn ?? openTurnKey(), title: dr.title.trim(), when: dr.when.trim(), chapter: dr.chapter || "national", visibility: dr.visibility || "story", summary: dr.summary.trim(),
    changes: dr.changes.map(c => { const o = { ...c }; if (o.tier !== undefined) o.tier = +o.tier; for (const k of ["site", "fromSite", "toSite"]) if (o[k] === "") delete o[k]; for (const k of ["x", "y"]) if (o[k] == null) delete o[k]; return o; }),
    updatedBy: Store.me.name || "", updatedAt: new Date().toISOString() });
  try {
    if (dr.id) { await Store.saveEvent({ id: dr.id, ...body }); toast("Event updated"); }
    else {
      body.order = S.events.reduce((m, e) => Math.max(m, e.order ?? 0), -1) + 1; body.example = false; body.createdAt = body.updatedAt;
      S.jumpToId = await Store.saveEvent(body); toast("Added to the story");
    }
    S.draft = null; refreshAll(false);
  } catch (e) { toast("Couldn't save: " + (e?.message || "try again")); }
}
async function swapOrder(i, j) {
  const a = EV[i], b = EV[j]; if (!a || !b) return;
  const all = S.events.slice().sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
  const ia = all.indexOf(a), ib = all.indexOf(b); [all[ia], all[ib]] = [all[ib], all[ia]];
  const orders = all.map((e, k) => ({ id: e.id, order: k })).filter((o, k) => all[k].order !== k);
  try { await Store.reorder(orders); } catch (e) { toast("Couldn't reorder: " + (e?.message || "")); }
}
let layoutTimer = null;
function saveLayout() {
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(async () => { try { await Store.savePositions(S.positions); toast("Map layout saved"); } catch (e) { toast("Couldn't save the layout"); } }, 300);
}
async function saveSetting(key, value, done) {
  const before = S.settings[key];
  S.settings[key] = clean(value); applyRegionInfo(); renderMap({ fresh: false }); renderChrome();
  try { await Store.saveSetting(key, S.settings[key]); toast(done || "Saved"); }
  catch (e) { S.settings[key] = before; applyRegionInfo(); renderMap({ fresh: false }); renderChrome(); toast("Couldn't save: " + (e?.message || "try again")); }
}

/* ---------- Full screen ---------- */
function setFS(on) {
  $("mapwrap").classList.toggle("fs", on);
  document.body.classList.toggle("fs-on", on);
  ["fs", "rz-fs"].forEach(id => { const b = $(id); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Exit full screen" : "Full screen"); b.title = on ? "Exit full screen" : "Full screen"; });
}
function toggleFS() {
  const w = $("mapwrap"), on = !w.classList.contains("fs");
  if (on) { setFS(true); if (document.fullscreenEnabled && w.requestFullscreen) w.requestFullscreen().catch(() => {}); }
  else { setFS(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
}
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) setFS(false); });
async function saveSite(patch) {
  const cur = S.sites[patch.id] || {};
  const full = clean({ ...cur, ...patch, updatedBy: Store.me.name || "", updatedAt: new Date().toISOString() });
  S.sites[patch.id] = full;
  try { await Store.saveSite(full); } catch (e) { toast("Couldn't save the site: " + (e?.message || "")); }
}

/* ---------- Header: sign in and embed ---------- */
function renderWho() {
  const b = $("who-btn"), m = Store.me;
  $("share-btn").hidden = !isLead(); // Only the NST Lead hands out embed code.
  b.hidden = EMBED && Store.mode !== "sheets";
  if (Store.mode === "local") b.textContent = m.role === "viewer" ? "Try editing" : "Stop demo";
  else b.textContent = m.role === "viewer" ? "Rep sign in" : (m.name || ROLES[m.role].name);
  const full = new URL(location.href); full.searchParams.delete("embed");
  $("fullmap").href = full.toString();
}
function chapterNames(m) { return m.role === "nst" || m.role === "lead" ? "all chapters" : (m.chapters || []).map(c => R[c]?.name || c).join(", ") || "no chapter yet"; }
function openPop(kind) {
  const pop = $("pop");
  if (!pop.hidden && pop.dataset.kind === kind) { pop.hidden = true; return; }
  pop.dataset.kind = kind; pop.hidden = false;
  if (kind === "share") {
    const u = new URL(location.href); u.search = ""; u.hash = "";
    u.searchParams.set("embed", "1"); if (RV.id) u.searchParams.set("region", RV.id);
    const code = `<iframe src="${u.toString()}" title="Abandoned Lands Story Map" width="100%" height="860" style="border:0;max-width:1500px" loading="lazy" allow="fullscreen" allowfullscreen></iframe>`;
    pop.innerHTML = `<b>Embed ${RV.id ? "this region" : "the story map"} in a wiki page</b><textarea id="emb-code" readonly>${esc(code)}</textarea><div class="btnrow"><button type="button" class="btn primary" id="emb-copy">Copy code</button><button type="button" class="btn big" id="pop-close">Close</button></div><div class="note">${location.protocol === "file:" ? "This copy is opened from a file. Host the site first, then copy the code from the hosted page." : "Paste it into any wiki or site that accepts iframes. Add &amp;region= with a town's id to open straight onto its map, or &amp;tab=dispatches to open on the Dispatches."}</div>`;
  } else if (kind === "who") {
    const m = Store.me;
    if (Store.mode === "local") {
      pop.innerHTML = m.role === "viewer" ? `<b>Try the editor</b><div class="note">This copy isn't connected to the shared story sheet, so anything you record stays in this browser only. It's for trying things out.</div><div class="btnrow"><button type="button" class="btn primary" id="demo-on">Start demo editing</button><button type="button" class="btn big" id="pop-close">Close</button></div>`
        : `<b>Demo editing is on</b><div class="note">Changes are saved in this browser only.</div><div class="btnrow"><button type="button" class="btn" id="demo-off">Stop demo</button><button type="button" class="btn danger" id="demo-reset">Clear demo data</button></div>`;
    } else if (m.role === "viewer") {
      pop.innerHTML = `<label class="lbl" for="code-in">Rep code</label><input id="code-in" type="password" autocomplete="current-password" placeholder="The code the NST Team gave you"><div class="btnrow"><button type="button" class="btn primary" id="code-go">Sign in</button><button type="button" class="btn big" id="pop-close">Cancel</button></div><div class="note">Chapter NST Reps can record events, place threats and write notes for their own chapter. Codes are kept in the story sheet's Reps tab.</div>`;
      setTimeout(() => $("code-in")?.focus(), 0);
    } else {
      pop.innerHTML = `<div class="who">Signed in as <b>${esc(m.name || "a rep")}</b>, ${esc(ROLES[m.role].name)} for ${esc(chapterNames(m))}.</div><div class="btnrow"><button type="button" class="btn" id="sign-out">Sign out</button><button type="button" class="btn big" id="pop-close">Close</button></div>`;
    }
  }
}
function afterAuth(raise) {
  const max = VIS_RANK[maxLayer()];
  if (raise) S.layer = maxLayer();
  if (VIS_RANK[S.layer] > max) S.layer = maxLayer();
  if (!canDraft()) { S.draft = null; S.siteEdit = false; S.pendingSite = null; S.layoutMode = false; S.placing = null; }
  S.idx = 9999; refreshAll(false);
}

/* ---------- Event wiring ---------- */
document.addEventListener("click", async e => {
  const t = e.target.closest("button"); if (!t) { if (!e.target.closest("#pop")) $("pop").hidden = true; return; }
  const d = t.dataset;
  if (t.id === "share-btn") { openPop("share"); return; }
  if (t.id === "who-btn") { openPop("who"); return; }
  if (t.id === "pop-close") { $("pop").hidden = true; return; }
  if (t.id === "emb-copy") { const ta = $("emb-code"); try { await navigator.clipboard.writeText(ta.value); toast("Embed code copied"); } catch (x) { ta.select(); toast("Select the code and copy it"); } return; }
  if (t.id === "code-go") { await doSignIn(); return; }
  if (t.id === "sign-out") { $("pop").hidden = true; await Store.signOut(); afterAuth(true); toast("Signed out"); return; }
  if (t.id === "demo-on" || t.id === "demo-off") { $("pop").hidden = true; await Store.signIn(t.id === "demo-on"); afterAuth(true); return; }
  if (t.id === "demo-reset") { $("pop").hidden = true; Store.reset(); afterAuth(false); toast("Demo data cleared"); return; }
  if (!t.closest("#pop") && !t.closest(".head-tools")) $("pop").hidden = true;
  if (t.closest("#layerseg") && d.layer) { S.layer = d.layer; try { localStorage.setItem("alwm.layer", S.layer); } catch (x) {} S.idx = 9999; refreshAll(false); return; }
  if (t.closest(".tabs") && d.tab) { S.tab = d.tab; renderSide(); return; }
  if (d.eye) { S.hidden.has(d.eye) ? S.hidden.delete(d.eye) : S.hidden.add(d.eye); try { localStorage.setItem("alwm.hidden", JSON.stringify([...S.hidden])); } catch (x) {} redraw({ fresh: false }); renderSide(); return; }
  if (d.focus) { S.focus = S.focus === d.focus ? null : d.focus; redraw({ fresh: false }); renderSide(); return; }
  if (d.goreg) { selectRegion(d.goreg); return; }
  if (d.tabgo) { S.tab = d.tabgo; if (d.dpfrom) S.dispFilter = d.dpfrom; renderSide(); return; }
  if (d.openreg) { openRegion(d.openreg); return; }
  if (d.closereg) { closeRegion(); return; }
  if (d.unsite) { S.site = null; renderRegionView({ fresh: false }); renderSide(); return; }
  if (d.jump) { stop(); if (S.draft && !S.draft.changes.length) S.draft = null; goTo(+d.jump, true); return; }
  if (d.step) { stepTier(d.step, +d.d, d.site || null); return; }
  if (d.addthr !== undefined) { addThreat(d.addthr); return; }
  if (d.addclash) { const dr = ensureDraft(); dr.changes.push(freshChange("clash", S.selected)); claimChapter(dr, S.selected); S.tab = "log"; refreshAll(false); return; }
  if (d.thrchg) { editThreat(d.thrchg, false); return; }
  if (d.addmark !== undefined) { addMark(d.addmark); return; }
  if (d.mkchg) { editMark(d.mkchg, false); return; }
  if (d.mkgone) { editMark(d.mkgone, true); return; }
  if (d.placemark !== undefined) { startPlacing(+d.placemark); return; }
  if (t.id === "fs" || t.id === "rz-fs") { toggleFS(); return; }
  if (d.thrgone) { editThreat(d.thrgone, true); return; }
  if (t.id === "site-edit") { S.siteEdit = !S.siteEdit; S.pendingSite = null; renderRegionView({ fresh: false }); renderSide(); return; }
  if (t.id === "ps-cancel") { S.pendingSite = null; renderRegionView({ fresh: false }); renderSide(); return; }
  if (t.id === "ps-save") {
    const name = $("ps-name").value.trim(); if (!name) { toast("Give the site a name"); return; }
    const ps = S.pendingSite, id = ps.region + "-c-" + slug(name) + "-" + Date.now().toString(36).slice(-4);
    await saveSite({ id, region: ps.region, name, x: ps.x, y: ps.y, note: $("ps-note").value.trim(), custom: true });
    S.pendingSite = null; S.site = id; renderRegionView({ fresh: false }); renderSide(); toast("Site added"); return;
  }
  if (t.id === "se-save") { await saveSite({ id: S.site, region: S.selected, name: $("se-name").value.trim() || siteName(S.selected, S.site) }); renderRegionView({ fresh: false }); renderSide(); toast("Name saved"); return; }
  if (t.id === "se-details") { await saveSite({ id: S.site, region: S.selected, note: $("se-note").value.trim(), story: $("se-story").value.trim() }); renderRegionView({ fresh: false }); renderSide(); toast("Details saved"); return; }
  if (t.id === "mn-save") {
    const id = S.selected, cur = S.settings.notice || {}, done = new Set(cur.done || []);
    if ($("mn-show").checked) done.delete(id); else done.add(id);
    await saveSetting("notice", { text: $("mn-text").value.trim(), done: [...done] }, "Notice saved"); return;
  }
  if (t.id === "dg-save") {
    const id = S.selected, all = { ...(S.settings.danger || {}) }, v = $("dg-level").value;
    if (v === "") delete all[id];
    else { const o = { level: +v }, why = $("dg-why").value.trim(), feel = $("dg-feel").value.trim(); if (why) o.why = why; if (feel) o.feel = feel; all[id] = o; }
    await saveSetting("danger", all, v === "" ? "Danger level worked out from the map again" : "Danger level saved"); return;
  }
  if (t.id === "ld-save" || t.id === "ld-reset") {
    const id = S.selected, all = { ...(S.settings.regions || {}) };
    if (t.id === "ld-reset") delete all[id];
    else { const name = $("ld-name").value.trim(), blurb = $("ld-blurb").value.trim(), d = REGION_DEFAULTS[id]; const o = {}; if (name && name !== d.name) o.name = name; if (blurb && blurb !== d.blurb) o.blurb = blurb; if (Object.keys(o).length) all[id] = o; else delete all[id]; }
    await saveSetting("regions", all, t.id === "ld-reset" ? "Back to the original name" : "Location saved"); return;
  }
  if (t.id === "se-del") {
    const s = sitesFor(S.selected, true).find(x => x.id === S.site); if (!s) return;
    if (s.custom) { delete S.sites[s.id]; try { await Store.deleteSite(s.id); } catch (x) { toast("Couldn't delete the site"); } }
    else await saveSite({ id: s.id, region: S.selected, hidden: true });
    S.site = null; renderRegionView({ fresh: false }); renderSide(); toast(s.custom ? "Site deleted" : "Site hidden"); return;
  }
  if (t.id === "n-save") {
    const note = { public: $("n-pub").value.trim(), story: $("n-story").value.trim(), updatedBy: Store.me.name || "", updatedAt: new Date().toISOString() };
    try { await Store.saveNote(S.selected, note); S.notes[S.selected] = note; toast("Notes saved"); renderSide(); } catch (x) { toast("Couldn't save the notes: " + (x?.message || "")); }
    return;
  }
  if (t.id === "turn-open" || t.id === "turn-rename") {
    const cur = S.settings.turns || {}, labels = { ...(cur.labels || {}) }, label = $("turn-label").value.trim();
    const key = t.id === "turn-open" ? Math.max(...allTurnKeys(), 0) + 1 : openTurnKey();
    if (t.id === "turn-rename" && !label) { toast("Type the year's new name"); return; }
    if (label) labels[key] = label; else delete labels[key];
    const msg = t.id === "turn-open" ? `Year ${allTurnKeys().length + 1} has begun` : "Year renamed";
    await saveSetting("turns", { open: key, labels }, msg); return;
  }
  if (t.id === "d-new") { S.draft = newDraft(); S.idx = EV.length - 1; refreshAll(false); return; }
  if (t.id === "d-cancel") { S.draft = null; refreshAll(false); return; }
  if (t.id === "d-save") { await saveDraft(); return; }
  if (d.addc) { const dr = ensureDraft(); dr.changes.push(freshChange(d.addc)); claimChapter(dr, S.selected); refreshAll(false); return; }
  if (d.delc !== undefined) { S.draft.changes.splice(+d.delc, 1); refreshAll(false); return; }
  if (d.edit) { const ev = S.events.find(x => x.id === d.edit); if (ev) { S.draft = clean({ id: ev.id, title: ev.title || "", when: ev.when || "", chapter: ev.chapter || "national", visibility: ev.visibility || "story", summary: ev.summary || "", changes: ev.changes || [], turn: turnKey(ev) }); S.tab = "log"; refreshAll(false); } return; }
  if (d.del) { S.confirmDel = d.del; renderLog(); return; }
  if (d.delno) { S.confirmDel = null; renderLog(); return; }
  if (d.delok) { S.confirmDel = null; try { await Store.deleteEvent(d.delok); toast("Event deleted"); } catch (x) { toast("Couldn't delete: " + (x?.message || "")); } return; }
  if (d.up) { await swapOrder(+d.up, +d.up - 1); return; }
  if (d.down) { await swapOrder(+d.down, +d.down + 1); return; }
  if (t.id === "clear-ex") { for (const ev of S.events.filter(x => x.example)) { try { await Store.deleteEvent(ev.id); } catch (x) {} } toast("Example events removed"); return; }
  if (t.id === "seed-open") { try { await Store.saveEvent({ ...OPENING, example: false }); toast("Opening positions saved"); } catch (x) { toast("Couldn't save"); } return; }
  if (t.id === "lay-toggle") { S.layoutMode = !S.layoutMode; renderMap({ fresh: false }); renderSide(); return; }
  if (t.id === "lay-reset") { S.positions = {}; renderMap({ fresh: false }); try { await Store.savePositions({}); toast("Positions reset"); } catch (x) {} return; }
  if (t.id === "exp") { exportJSON(); return; }
});
async function doSignIn() {
  const code = $("code-in")?.value.trim(); if (!code) return;
  try { await Store.signIn(code); $("pop").hidden = true; afterAuth(true); toast(`Signed in as ${Store.me.name || "a rep"}`); }
  catch (x) { toast(x?.message || "That code wasn't recognised"); }
}
document.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.id === "code-in") { doSignIn(); return; }
  if (e.key === "Escape") {
    if (!$("pop").hidden) { $("pop").hidden = true; return; }
    if (S.placing) { S.placing = null; renderRegionView({ fresh: false }); return; }
    if ($("mapwrap").classList.contains("fs") && !document.fullscreenElement) { setFS(false); return; }
    if (RV.id) { closeRegion(); return; }
  }
  if (e.target.closest("input, textarea, select")) return;
  if (e.key === "ArrowRight") { stop(); stepTurn(1); }
  if (e.key === "ArrowLeft") { stop(); stepTurn(-1); }
});
document.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "scrub") { stop(); if (TURNS[+t.value]) goTo(TURNS[+t.value].last, false); return; }
  if (!S.draft) return;
  if (t.id === "d-title") { S.draft.title = t.value; const b = $("d-save"); if (b) b.disabled = !t.value.trim() || (!isNST() && draftWarnings(S.draft).some(w => w.nst)); return; }
  if (t.id === "d-when") { S.draft.when = t.value; return; }
  if (t.id === "d-sum") { S.draft.summary = t.value; return; }
  if (t.dataset.ci !== undefined && t.tagName === "INPUT" && t.type !== "checkbox") { S.draft.changes[+t.dataset.ci][t.dataset.f] = t.value; return; }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if ((t.id && t.id.startsWith("ly-")) || t.id === "rv-names") { try { const o = {}; document.querySelectorAll(".layers input, #rv-names").forEach(i => o[i.id] = i.checked); localStorage.setItem("alwm.layers", JSON.stringify(o)); } catch (x) {} renderMap({ fresh: false }); return; }
  if (t.id === "st-sel") { setStatus(t.value); return; }
  if (t.id === "log-filter") { S.logFilter = t.value; renderSide(); return; }
  if (!S.draft) return;
  if (t.id === "d-ch") { S.draft.chapter = t.value; refreshAll(false); return; }
  if (t.id === "d-vis") { S.draft.visibility = t.value; return; }
  if (t.id === "d-turn") { S.draft.turn = +t.value; renderSide(); return; }
  if (t.dataset.ci !== undefined) {
    const i = +t.dataset.ci, c = S.draft.changes[i], f = t.dataset.f;
    if (f === "type") S.draft.changes[i] = freshChange(t.value, c.region || c.to);
    else if (f === "keep" || f === "remove" || f === "all") c[f] = t.checked;
    else if (f === "tier") c.tier = +t.value;
    else if (f === "region") { c.region = t.value; c.site = ""; if (c.type === "mark") { c.x = null; c.y = null; } }
    else if (f === "site" && c.type === "mark") { if (t.value !== "__xy") Object.assign(c, { site: t.value, x: null, y: null, wide: !t.value }); }
    else if (f === "mid") {
      if (t.value === "__new") Object.assign(c, { mid: newMid(), label: "", remove: false });
      else { const st = draftBaseState(), rid = findMark(st, t.value), old = st[rid].marks[t.value]; Object.assign(c, { mid: t.value, icon: old.icon, label: old.label, region: rid, site: old.site || "", x: old.x, y: old.y, note: old.note || "" }); }
    }
    else if (f === "from") { c.from = t.value; c.fromSite = ""; }
    else if (f === "to") { c.to = t.value; c.toSite = ""; }
    else if (f === "kind") { c.kind = t.value; c.group = t.value === "lesser" ? (Object.keys(LESSER).find(k => LESSER[k].home === c.region) || "forsworn") : "bandits"; if (c.kind === "lesser" && c.tier > 3 && !isNST()) c.tier = 3; }
    else if (f === "tid") {
      if (t.value === "__new") Object.assign(c, { tid: newTid(), name: "", remove: false });
      else { const st = draftBaseState(), rid = findThreat(st, t.value), old = st[rid].threats[t.value]; Object.assign(c, { tid: t.value, kind: old.kind, group: old.group, name: old.name, tier: old.tier, region: rid, site: old.site || "", note: old.note || "" }); }
    }
    else c[f] = t.value;
    refreshAll(false);
  }
});
$("tl-first").onclick = () => { stop(); goTo(0, false); };
$("tl-prev").onclick = () => { stop(); stepTurn(-1); };
$("tl-next").onclick = () => { stop(); stepTurn(1); };
$("tl-play").onclick = () => { S.playing ? stop() : play(); };
let playTimer = null;
function play() {
  if (TURNS.length < 2) return;
  if (S.draft && S.draft.changes.length) { toast("Finish or discard the draft to play the story"); return; }
  S.draft = null;
  S.playing = true; if (S.idx >= EV.length - 1) goTo(0, false); else renderChrome();
  const tick = () => { if (!S.playing) return; if (S.idx >= EV.length - 1) { stop(); return; } stepTurn(1); playTimer = setTimeout(tick, 2600); };
  playTimer = setTimeout(tick, 900);
}
function stop() { S.playing = false; clearTimeout(playTimer); $("tl-play").textContent = "▶"; $("tl-play").setAttribute("aria-label", "Play the story"); }

async function exportJSON() {
  const data = JSON.stringify({ exportedAt: new Date().toISOString(), events: S.usingFallback ? [OPENING] : S.events, sites: Object.values(S.sites), notes: S.notes, positions: S.positions, settings: S.settings, dispatches: S.dispatches, calendar: S.calendar, requests: S.requests }, null, 2);
  if (S.downloads) { try { await S.downloads.save({ filename: "abandoned-lands-story.json", data }); return; } catch (e) { if (e?.code === "declined") return; } }
  try {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: "application/json" })); a.download = "abandoned-lands-story.json"; document.body.appendChild(a); a.click(); a.remove();
  } catch (e) { try { await navigator.clipboard.writeText(data); toast("Story copied to the clipboard as JSON"); } catch (x) { toast("Export isn't available in this view"); } }
}

function refreshAll(fresh) {
  rebuild();
  if (S.jumpToId) { const i = EV.findIndex(e => e.id === S.jumpToId); if (i >= 0) S.idx = TURNS[turnIndexOf(i)].last; S.jumpToId = null; }
  renderMap({ fresh: !!fresh }); renderChrome();
}
function setSettings(o) {
  S.settings = { notice: o.notice || { text: NOTICE_TEXT, done: [] }, regions: o.regions || {}, danger: o.danger || {}, calendar: o.calendar || {}, turns: o.turns || {} };
  applyRegionInfo();
}
function applyData(d, first) {
  const atEnd = S.idx >= EV.length - 1;
  if (d.events) S.events = d.events.map(e => ({ ...e, changes: typeof e.changes === "string" ? JSON.parse(e.changes || "[]") : (e.changes || []) }));
  if (d.sites) S.sites = Array.isArray(d.sites) ? Object.fromEntries(d.sites.map(s => [s.id, s])) : d.sites;
  if (d.notes) S.notes = d.notes;
  if (d.positions) S.positions = d.positions;
  if (d.settings) setSettings(d.settings);
  applyLists(d);
  S.loaded = true;
  S.usingFallback = S.events.length === 0;
  if (first || atEnd) S.idx = 9999;
  refreshAll(!!first);
}

/* ---------- Storage: Google Sheet, or this browser ---------- */
function startSheets() {
  Store.mode = "sheets";
  let code = ""; try { code = localStorage.getItem("alwm.code") || ""; } catch (e) {}
  let first = true;
  const load = async () => {
    const u = new URL(CONFIG.apiUrl); u.searchParams.set("action", "load"); if (code) u.searchParams.set("code", code);
    const r = await fetch(u.toString(), { cache: "no-store" }); const j = await r.json();
    if (j.error) throw new Error(j.error);
    if (j.badCode && code) { code = ""; try { localStorage.removeItem("alwm.code"); } catch (e) {} toast("Your rep code is no longer valid. Sign in again."); }
    const before = Store.me.role;
    Store.me = j.me || { role: "viewer", name: "", chapters: [] };
    applyData(j, first); first = false;
    if (before !== Store.me.role) afterAuth(false);
  };
  const post = async (action, payload) => {
    const r = await fetch(CONFIG.apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, code, ...payload }) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "The story sheet refused that change");
    await load(); return j;
  };
  Store.signIn = async c => { const prev = code; code = c; try { await load(); } catch (e) { code = prev; throw e; } if (Store.me.role === "viewer") { code = prev; throw new Error("That rep code wasn't recognised"); } try { localStorage.setItem("alwm.code", code); } catch (e) {} };
  Store.signOut = async () => { code = ""; try { localStorage.removeItem("alwm.code"); } catch (e) {} await load(); };
  Store.saveEvent = async ev => (await post("saveEvent", { event: ev })).id;
  Store.deleteEvent = id => post("deleteEvent", { id });
  Store.reorder = orders => post("reorder", { orders });
  Store.saveSite = site => post("saveSite", { site });
  Store.deleteSite = id => post("deleteSite", { id });
  Store.saveNote = (region, note) => post("saveNote", { region, note });
  Store.savePositions = positions => post("savePositions", { positions });
  Store.saveSetting = (key, value) => post("saveSetting", { key, value });
  Store.act = (action, payload) => post(action, payload);
  load().catch(e => { S.loaded = true; toast("Couldn't reach the story sheet: " + e.message); refreshAll(false); });
  setInterval(() => { if (!document.hidden && !S.draft && !S.placing && !S.dispForm && !S.calForm && !S.reqForm && !rdrag && !drag) load().catch(() => {}); }, Math.max(15, CONFIG.pollSeconds) * 1000);
}
function startLocal() {
  Store.mode = "local";
  const KEY = "alwm.local";
  const fresh = () => ({ events: [{ ...OPENING, example: false }], sites: [], notes: {}, positions: {}, dispatches: [], calendar: [], requests: [] });
  let data = null; try { data = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (!data) data = fresh();
  let demo = false; try { demo = localStorage.getItem("alwm.demo") === "1"; } catch (e) {}
  const setMe = () => { Store.me = demo ? { role: "lead", name: "Demo editor", chapters: [] } : { role: "viewer", name: "", chapters: [] }; };
  setMe();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} applyData(clean(data)); };
  Store.signIn = async on => { demo = !!on; try { localStorage.setItem("alwm.demo", demo ? "1" : "0"); } catch (e) {} setMe(); };
  Store.signOut = async () => Store.signIn(false);
  Store.reset = () => { data = fresh(); save(); };
  Store.saveEvent = async ev => { const ex = ev.id && data.events.find(e => e.id === ev.id); if (ex) Object.assign(ex, ev); else { ev = { ...ev, id: ev.id || "ev" + Date.now().toString(36) }; data.events.push(ev); } save(); return ev.id; };
  Store.deleteEvent = async id => { data.events = data.events.filter(e => e.id !== id); save(); };
  Store.reorder = async list => { list.forEach(o => { const e = data.events.find(x => x.id === o.id); if (e) e.order = o.order; }); save(); };
  Store.saveSite = async s => { data.sites = data.sites.filter(x => x.id !== s.id).concat([s]); save(); };
  Store.deleteSite = async id => { data.sites = data.sites.filter(x => x.id !== id); save(); };
  Store.saveNote = async (region, n) => { data.notes[region] = n; save(); };
  Store.savePositions = async p => { data.positions = p; save(); };
  Store.saveSetting = async (key, value) => { (data.settings ||= {})[key] = value; save(); };
  Store.act = async (a, p) => { const r = reduceAct(data, Store.me, a, p), list = (data[r.coll] ||= []).filter(x => x.id !== r.id); if (r.doc) list.push(r.doc); data[r.coll] = list; save(); return { id: r.id }; };
  applyData(clean(data), true);
}

/* ---------- Boot ---------- */
if (EMBED) document.body.classList.add("embed");
buildMapSkeleton(); renderLegend();
S.idx = 9999;
if (["dispatches", "calendar", "overview", "log"].includes(PARAMS.get("tab"))) S.tab = PARAMS.get("tab");
refreshAll(true);
$("layers").open = false;
(async () => {
  if (CONFIG.apiUrl) startSheets(); else startLocal();
  afterAuth(false);
  const rg = PARAMS.get("region");
  if (rg && R[rg]) openRegion(rg, false);
})();
})();
