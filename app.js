/* Puebla Electoral — resultados 2015–2024 del municipio de Puebla.
   Datos: data/res/*.json (por elección) y data/geo/*.geojson (capas). Sin servidor. */
(() => {
'use strict';

const PARTY = {
  MORENA: ['#8A1538', 'Morena'], PAN: ['#0B4EA2', 'Partido Acción Nacional'], PRI: ['#D9232E', 'Partido Revolucionario Institucional'],
  PRD: ['#F2B800', 'Partido de la Revolución Democrática'], PVEM: ['#3E9B45', 'Partido Verde Ecologista de México'],
  PT: ['#B4161F', 'Partido del Trabajo'], MC: ['#F28C28', 'Movimiento Ciudadano'], NA: ['#00A0A6', 'Nueva Alianza'],
  NAP: ['#00A0A6', 'Nueva Alianza Puebla'], ES: ['#6A3D9A', 'Encuentro Social'], PES: ['#6A3D9A', 'Encuentro Solidario'],
  PSI: ['#3F7CC0', 'Pacto Social de Integración'], PCPP: ['#2F7A55', 'Compromiso por Puebla'], FXM: ['#E0207D', 'Fuerza por México'],
  RSP: ['#9C6B30', 'Redes Sociales Progresistas'], PH: ['#7E57C2', 'Partido Humanista'],
};
const IND = '#7C8585';
const VISTAS = [
  { k: 'seccion', l: 'Sección', id: 'seccion' },
  { k: 'colonia', l: 'Colonia', id: 'cid' },
  { k: 'ja', l: 'Junta aux.', id: 'ja' },
  { k: 'dl', l: 'Dist. local', id: 'distrito_l' },
  { k: 'df', l: 'Dist. federal', id: 'distrito_f' },
];
const CARGOS = ['Presidencia municipal', 'Diputación local', 'Diputación federal', 'Gubernatura', 'Senaduría', 'Presidencia de la República'];
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('es-MX');
const pct = (a, b) => b ? a / b * 100 : 0;
const p1 = v => v.toFixed(1).replace('.', '.') + ' %';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const LOW = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'el', 'en']);
const title = s => String(s).toLowerCase().split(/(\s+|-)/).map((w, i) => (i && LOW.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('')
  .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi)\b/g, m => m.toUpperCase()).replace(/\bInfonavit\b/g, 'INFONAVIT').replace(/\bFovissste\b/g, 'FOVISSSTE');

const S = { el: '2024-AYU', vista: 'seccion', modo: 'win', sel: null, partes: 'cand' };
let IDX = [], RES = {}, GEO = {}, map, AGG = {}, SECINFO = {}, COLS_OF_SEC = {};

/* ---------- utilidades de candidaturas ---------- */
function candLabel(c) { return c.startsWith('CAND_IND') ? 'Candidatura independiente' : c.split('-').join(' · '); }
function candColor(c) { if (c.startsWith('CAND_IND')) return IND; const p = c.split('-')[0]; return (PARTY[p] || [IND])[0]; }
function candTitle(c) { return c.startsWith('CAND_IND') ? 'Candidatura independiente' : c.split('-').map(p => (PARTY[p] || [0, p])[1]).join(', '); }
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join(''); }

/* ---------- agregación ---------- */
function sumSecs(eid, list) {
  const R = RES[eid], m = R.meta, nC = m.cand.length, nP = m.part.length;
  const o = { ln: 0, t: 0, nu: 0, nr: 0, c: new Array(nC).fill(0), p: new Array(nP).fill(0), n: 0, nx: 0, tx: 0, faltan: 0 };
  for (const s of list) {
    const r = R.s[s];
    if (!r) { o.faltan++; continue; }
    o.ln += r.ln; o.t += r.t; o.nu += r.nu; o.nr += r.nr; o.n++;
    if (r.x) { o.nx++; o.tx += r.t; }
    for (let i = 0; i < nC; i++) o.c[i] += r.c[i];
    for (let i = 0; i < nP; i++) o.p[i] += r.p[i];
  }
  return o;
}
function ranking(eid, a) {
  const m = RES[eid].meta;
  return m.cand.map((c, i) => ({ c, i, v: a.c[i] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v);
}
function verdict(eid, a) {
  const r = ranking(eid, a);
  if (!a.n || !a.t || !r.length) return null;
  const v1 = r[0].v, v2 = r[1] ? r[1].v : 0;
  return { c: r[0].c, i: r[0].i, share: pct(v1, a.t), margin: pct(v1 - v2, a.t), tie: v1 === v2, second: r[1] && r[1].c };
}
/* secciones de cada unidad */
function unitSecs(vista, key, eid) {
  if (vista === 'mun') return Object.keys(RES[eid].s).map(Number);
  if (vista === 'seccion') return [key];
  if (vista === 'colonia') return GEO.colonia.byId[key].properties.secs;
  const prop = { ja: 'ja', dl: 'distrito_l', df: 'distrito_f' }[vista];
  const out = GEO.seccion.features.filter(f => f.properties[prop] === key).map(f => f.properties.seccion);
  if (vista === 'ja') for (const [s, r] of Object.entries(RES[eid].s)) if (r.x && r.ja === key) out.push(Number(s));
  return out;
}
function unitName(vista, key) {
  if (vista === 'mun') return 'Municipio de Puebla';
  if (vista === 'seccion') return 'Sección ' + key;
  if (vista === 'colonia') return title(GEO.colonia.byId[key].properties.nombre);
  if (vista === 'ja') return key === 'Zona Centro' ? 'Zona Centro' : 'Junta auxiliar ' + key;
  if (vista === 'dl') return 'Distrito local ' + key;
  if (vista === 'df') return 'Distrito federal ' + key;
}
function computeAgg() {
  const v = VISTAS.find(x => x.k === S.vista), out = {};
  for (const f of GEO[S.vista].features) {
    const key = f.properties[v.id];
    const a = sumSecs(S.el, unitSecs(S.vista, key, S.el));
    out[key] = { a, w: verdict(S.el, a) };
  }
  AGG = out;
}

/* ---------- color ---------- */
const BINS_P = [40, 50, 60, 70];
const BINS_C = [20, 35, 50, 65];
function binIdx(v, bins) { let i = 0; while (i < bins.length && v >= bins[i]) i++; return i; }
function rampColor(base, i) { const bg = cssVar('--mapbg') || '#eeeeee'; return mix(base, bg, [0.82, 0.62, 0.42, 0.2, 0][i]); }
function colorFor(u) {
  const nores = cssVar('--nores');
  if (!u || !u.w) return nores;
  if (S.modo === 'win') {
    if (u.w.tie) return '#9AA3A3';
    const bg = cssVar('--mapbg');
    const t = u.w.margin < 5 ? 0.55 : u.w.margin < 15 ? 0.28 : 0;
    return mix(candColor(u.w.c), bg, t);
  }
  if (S.modo === 'part') return rampColor('#1F8A84', binIdx(pct(u.a.t, u.a.ln), BINS_P));
  const m = RES[S.el].meta, i = m.cand.indexOf(S.modo);
  if (i < 0) return nores;
  return rampColor(candColor(S.modo), binIdx(pct(u.a.c[i], u.a.t), BINS_C));
}
function paint() {
  computeAgg();
  const src = 'u-' + S.vista;
  for (const [k, u] of Object.entries(AGG)) map.setFeatureState({ source: src, id: k }, { c: colorFor(u) });
  legend();
}

/* ---------- leyenda ---------- */
function legend() {
  const L = $('#legend'), m = RES[S.el].meta;
  let h = '';
  if (S.modo === 'win') {
    const won = {};
    for (const u of Object.values(AGG)) if (u.w && !u.w.tie) won[u.w.c] = (won[u.w.c] || 0) + 1;
    const items = Object.entries(won).sort((a, b) => b[1] - a[1]);
    const unidad = { seccion: 'secciones', colonia: 'colonias', ja: 'juntas', dl: 'distritos', df: 'distritos' }[S.vista];
    h += `<h4>Quién ganó · ${unidad} ganadas</h4><div class="items">${items.map(([c, n]) => `<span class="it" title="${esc(candTitle(c))}"><span class="sw" style="background:${candColor(c)}"></span>${esc(candLabel(c))} <b>${n}</b></span>`).join('')}</div>`;
    const g = cssVar('--fg'), bg = cssVar('--mapbg');
    h += `<div class="items"><span class="it"><span class="sw" style="background:${mix(g, bg, .55)}"></span>Ventaja &lt;5 pts</span><span class="it"><span class="sw" style="background:${mix(g, bg, .28)}"></span>5–15</span><span class="it"><span class="sw" style="background:${g}"></span>&gt;15</span></div>`;
  } else {
    const isP = S.modo === 'part', base = isP ? '#1F8A84' : candColor(S.modo), bins = isP ? BINS_P : BINS_C;
    h += `<h4>${isP ? 'Participación (% de la lista nominal)' : 'Votación de ' + esc(candLabel(S.modo)) + ' (% de votos)'}</h4>`;
    h += `<div class="ramp">${[0, 1, 2, 3, 4].map(i => `<span style="background:${rampColor(base, i)}"></span>`).join('')}</div>`;
    h += `<div class="rampl"><span>0</span>${bins.map(b => `<span>${b}</span>`).join('')}<span>100</span></div>`;
  }
  const nores = Object.values(AGG).filter(u => !u.w).length;
  if (nores) h += `<div class="items"><span class="it"><span class="sw" style="background:${cssVar('--nores')}"></span>Sin resultados en ${m.anio} (${nores})</span></div>`;
  L.innerHTML = h;
}

/* ---------- panel ---------- */
function bars(eid, a) {
  const m = RES[eid].meta;
  let rows;
  if (S.partes === 'cand') rows = ranking(eid, a).map(x => ({ l: candLabel(x.c), t: candTitle(x.c), col: candColor(x.c), v: x.v }));
  else rows = m.part.map((p, i) => ({ l: p, t: (PARTY[p] || [0, p])[1], col: (PARTY[p] || [IND])[0], v: a.p[i] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v);
  rows.push({ l: 'Votos nulos', t: 'Votos nulos', col: cssVar('--muted'), v: a.nu, minor: true });
  if (a.nr) rows.push({ l: 'Candidaturas no registradas', t: '', col: cssVar('--muted'), v: a.nr, minor: true });
  const max = Math.max(...rows.map(r => r.v), 1);
  return `<div class="bars">${rows.map(r => `<div class="b${r.minor ? ' minor' : ''}" title="${esc(r.t)}">
    <span class="n">${esc(r.l)}</span><span class="vv">${fmt(r.v)}</span><span class="pp">${p1(pct(r.v, a.t))}</span>
    <span class="track"><i style="width:${(r.v / max * 100).toFixed(1)}%;background:${r.col}"></i></span></div>`).join('')}</div>`;
}
function history(vista, key) {
  const m0 = RES[S.el].meta;
  const rows = IDX.slice().sort((a, b) => b.anio - a.anio || CARGOS.indexOf(a.cargo.replace(' (extraordinaria)', '')) - CARGOS.indexOf(b.cargo.replace(' (extraordinaria)', '')));
  return `<div class="histwrap"><table class="hist"><tbody>${rows.map(e => {
    const a = sumSecs(e.id, unitSecs(vista, key, e.id)), w = verdict(e.id, a);
    const short = c => c.startsWith('CAND_IND') ? 'Independiente' : c.split('-')[0] + (c.includes('-') ? ' y aliados' : '');
    const cell = w ? `<span class="w" title="${esc(candLabel(w.c))}"><span class="sw" style="background:${candColor(w.c)}"></span>${esc(short(w.c))}</span>` : '<span class="w" style="color:var(--muted)">Sin resultados</span>';
    return `<tr data-el="${e.id}" class="${e.id === m0.id ? 'on' : ''}"><td class="y">${e.anio}</td><td>${esc(e.cargo.replace('Presidencia de la República', 'Presidencia').replace('Presidencia municipal', 'Pres. municipal').replace('Diputación', 'Dip.').replace(' (extraordinaria)', ' extr.'))}</td><td>${cell}</td><td class="r">${w ? p1(w.share) : ''}</td><td class="r" style="color:var(--muted)">${w ? p1(pct(a.t, a.ln)) : ''}</td></tr>`;
  }).join('')}</tbody></table></div><div class="src">Columnas: elección, quién ganó, su % de votos y la participación.</div>`;
}
function context(vista, key) {
  if (vista === 'seccion') {
    const p = SECINFO[key]; if (!p) return '';
    const cols = (COLS_OF_SEC[key] || []).slice(0, 14);
    return `<div class="chips"><button class="chip" data-go="df:${p.distrito_f}">Distrito federal ${p.distrito_f}</button><button class="chip" data-go="dl:${p.distrito_l}">Distrito local ${p.distrito_l}</button><button class="chip" data-go="ja:${esc(p.ja)}">${esc(p.ja)}</button></div>`
      + (cols.length ? `<div class="sec"><h3>Colonias en esta sección</h3><div class="chips">${cols.map(c => `<button class="chip" data-go="colonia:${c}">${esc(title(GEO.colonia.byId[c].properties.nombre))}</button>`).join('')}${(COLS_OF_SEC[key] || []).length > 14 ? `<span class="chip static">y ${COLS_OF_SEC[key].length - 14} más</span>` : ''}</div></div>` : '')
      + (p.ja_aprox ? '<div class="note">La junta auxiliar de esta sección se asignó por cercanía.</div>' : '');
  }
  if (vista === 'colonia') {
    const p = GEO.colonia.byId[key].properties;
    return `<div class="chips"><span class="chip static">CP ${esc(p.cp)}</span><button class="chip" data-go="ja:${esc(p.ja)}">${esc(p.ja)}</button></div>
      <div class="sec"><h3>Secciones que la cubren</h3><div class="chips">${p.secs.map(s => `<button class="chip" data-go="seccion:${s}">${s}</button>`).join('')}</div></div>`;
  }
  return '';
}
function notes(vista, a) {
  const m = RES[S.el].meta, out = [];
  if (vista === 'mun' && m.baja) out.push(`Incluye ${fmt(m.votos_baja)} votos de ${m.baja} secciones que el INE dividió después de ${m.anio}; no aparecen en el mapa porque ya no existen con ese trazo.`);
  if (vista === 'ja' && a.nx) out.push(`Incluye ${fmt(a.tx)} votos de ${a.nx} secciones que el INE dividió después de ${m.anio}.`);
  if ((vista === 'dl' || vista === 'df') ) out.push(`Solo la parte del distrito dentro del municipio, con el trazo vigente (INE, dic-2025).${m.baja ? ` No incluye ${m.baja} secciones que el INE dividió después de ${m.anio}.` : ''}`);
  if (vista === 'colonia') out.push('Una colonia no es una unidad electoral: estas cifras son la suma de las secciones que la cubren, completas.');
  if (vista === 'seccion' && !a.n) out.push(`Esta sección se creó después de ${m.anio}. Sus votos de esa elección están contados en el total del municipio, en la sección de la que se separó.`);
  return out.map(t => `<div class="note">${esc(t)}</div>`).join('');
}
function renderPanel() {
  const vista = S.sel ? S.vista : 'mun', key = S.sel;
  const m = RES[S.el].meta;
  const a = sumSecs(S.el, unitSecs(vista, key, S.el)), w = verdict(S.el, a);
  const crumb = S.sel ? `<div class="crumb"><button id="back">Municipio de Puebla</button><span>›</span><span>${esc(VISTAS.find(v => v.k === S.vista).l)}</span></div>` : `<div class="crumb">${esc(m.cargo)} · ${m.anio}</div>`;
  let h = `<div class="ph">${crumb}<h2>${esc(unitName(vista, key))}</h2><div class="meta">${S.sel ? esc(m.cargo) + ' · ' + m.anio : 'Toca el mapa para ver el detalle de cada zona'}</div></div>`;
  if (a.n) {
    h += `<div class="kpis"><div class="kpi"><div class="v">${fmt(a.ln)}</div><div class="k">Lista nominal</div></div><div class="kpi"><div class="v">${fmt(a.t)}</div><div class="k">Votos</div></div><div class="kpi"><div class="v">${p1(pct(a.t, a.ln))}</div><div class="k">Participación</div></div></div>`;
    if (w) h += `<div class="win"><span class="bar" style="background:${candColor(w.c)}"></span><div>${w.tie ? '<b>Empate</b>' : `Ganó <b title="${esc(candTitle(w.c))}">${esc(candLabel(w.c))}</b> con ${p1(w.share)}`}<small>${w.tie ? '' : `Ventaja de ${w.margin.toFixed(1)} puntos sobre ${esc(candLabel(w.second || ''))}`}</small></div></div>`;
    h += `<div class="sec"><h3><span>Votos</span><span class="seg" id="partes"><button data-p="cand" class="${S.partes === 'cand' ? 'on' : ''}">Candidaturas</button><button data-p="part" class="${S.partes === 'part' ? 'on' : ''}">Partidos</button></span></h3>${bars(S.el, a)}</div>`;
    if (S.partes === 'part') h += '<div class="src">Por partido: votos marcados solo con su logo. Los votos que marcaron varios logos de una coalición cuentan para la candidatura, no para un partido.</div>';
  }
  h += notes(vista, a);
  h += context(vista, key);
  h += `<div class="sec"><h3>Cómo ha votado · 2015–2024</h3>${history(vista, key)}</div>`;
  h += `<div class="src">Fuente: ${esc(m.fuente)}. Cartografía: INE, Base Geográfica Digital (dic-2025). Juntas auxiliares según el mapa PILOTO 5.</div>`;
  $('#pbody').innerHTML = h;
  $('#pbody').scrollTop = 0;
  const back = $('#back'); if (back) back.onclick = () => select(null);
  document.querySelectorAll('#partes button').forEach(b => b.onclick = () => { S.partes = b.dataset.p; renderPanel(); });
  document.querySelectorAll('.hist tr').forEach(tr => tr.onclick = () => setEl(tr.dataset.el));
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { const [v, k] = b.dataset.go.split(/:(.*)/s); goTo(v, k); });
  peekSize();
}

/* ---------- selección y navegación ---------- */
function keyOf(vista, k) { return vista === 'seccion' || vista === 'colonia' || vista === 'dl' || vista === 'df' ? Number(k) : k; }
function select(key) {
  S.sel = key;
  const v = VISTAS.find(x => x.k === S.vista);
  map.setFilter('sel', key == null ? ['==', ['get', 'seccion'], -1] : ['==', ['get', v.id], key]);
  map.setLayoutProperty('sel', 'visibility', key == null ? 'none' : 'visible');
  renderPanel();
  if (key != null && isMobile()) $('#panel').dataset.state = 'open';
}
function goTo(vista, k) {
  const key = keyOf(vista, k);
  if (S.vista !== vista) setVista(vista, true);
  select(key);
  const f = GEO[vista].features.find(f => f.properties[VISTAS.find(x => x.k === vista).id] === key);
  if (f) fit(f.geometry);
}
function fit(geom) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = c => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); };
  walk(geom.coordinates);
  const mob = isMobile();
  map.fitBounds([[x0, y0], [x1, y1]], { padding: { top: 40, left: 40, right: 40, bottom: mob ? window.innerHeight * 0.45 : 40 }, maxZoom: 15.5, duration: 600 });
}
function setVista(k, keepSel) {
  for (const v of VISTAS) {
    const vis = v.k === k ? 'visible' : 'none';
    map.setLayoutProperty('f-' + v.k, 'visibility', vis); map.setLayoutProperty('l-' + v.k, 'visibility', vis);
  }
  S.vista = k; if (!keepSel) S.sel = null;
  map.moveLayer('sel'); map.moveLayer('mun-line');
  const src = 'u-' + k;
  map.removeLayer('sel'); map.addLayer({ id: 'sel', type: 'line', source: src, paint: { 'line-color': cssVar('--fg'), 'line-width': 3 }, layout: { visibility: 'none' }, filter: ['==', ['get', 'seccion'], -1] });
  document.querySelectorAll('#vistas button').forEach(b => b.classList.toggle('on', b.dataset.v === k));
  $('#sub').textContent = 'Municipio de Puebla · resultados por ' + VISTAS.find(v => v.k === k).l.toLowerCase().replace('aux.', 'auxiliar').replace('dist.', 'distrito');
  paint();
  if (!keepSel) { select(null); fit(GEO.municipio.features[0].geometry); }
}
function setEl(eid) {
  const prevMode = S.modo, prevLead = prevMode.split('-')[0];
  S.el = eid;
  const m = RES[eid].meta;
  if (prevMode !== 'win' && prevMode !== 'part') S.modo = m.cand.find(c => c.split('-')[0] === prevLead) || 'win';
  syncElControls(); fillModo(); paint(); renderPanel();
}

/* ---------- controles ---------- */
function syncElControls() {
  const m = RES[S.el].meta, cargo = m.cargo.replace(' (extraordinaria)', '');
  $('#cargo').value = cargo;
  const years = IDX.filter(e => e.cargo.replace(' (extraordinaria)', '') === cargo);
  $('#anios').innerHTML = years.map(e => `<button data-el="${e.id}" class="${e.id === S.el ? 'on' : ''}" title="${esc(e.cargo)}">${e.anio}${e.cargo.includes('extra') ? '*' : ''}</button>`).join('');
  document.querySelectorAll('#anios button').forEach(b => b.onclick = () => setEl(b.dataset.el));
}
function fillModo() {
  const m = RES[S.el].meta;
  const tops = m.cand.filter(c => !c.startsWith('CAND_IND')).slice(0, 6);
  $('#modo').innerHTML = `<option value="win">Quién ganó</option><option value="part">Participación</option><optgroup label="Votación de…">${tops.map(c => `<option value="${c}">${esc(candLabel(c))}</option>`).join('')}</optgroup>`;
  if (!['win', 'part', ...tops].includes(S.modo)) S.modo = 'win';
  $('#modo').value = S.modo;
}
function buildControls() {
  const cargos = CARGOS.filter(c => IDX.some(e => e.cargo.replace(' (extraordinaria)', '') === c));
  $('#cargo').innerHTML = cargos.map(c => `<option>${c}</option>`).join('');
  $('#cargo').onchange = e => { const last = IDX.filter(x => x.cargo.replace(' (extraordinaria)', '') === e.target.value).sort((a, b) => b.anio - a.anio)[0]; setEl(last.id); };
  $('#vistas').innerHTML = VISTAS.map(v => `<button data-v="${v.k}" class="${v.k === S.vista ? 'on' : ''}">${v.l}</button>`).join('');
  document.querySelectorAll('#vistas button').forEach(b => b.onclick = () => setVista(b.dataset.v));
  $('#modo').onchange = e => { S.modo = e.target.value; paint(); };
  syncElControls(); fillModo();
}

/* ---------- búsqueda ---------- */
let SEARCH = [];
function buildSearch() {
  for (const f of GEO.seccion.features) SEARCH.push({ t: 'Sección ' + f.properties.seccion, s: String(f.properties.seccion), k: 'seccion', id: f.properties.seccion, h: f.properties.ja });
  for (const f of GEO.colonia.features) SEARCH.push({ t: title(f.properties.nombre), s: norm(f.properties.nombre) + ' ' + f.properties.cp, k: 'colonia', id: f.properties.cid, h: 'CP ' + f.properties.cp });
  for (const f of GEO.ja.features) SEARCH.push({ t: f.properties.ja, s: norm(f.properties.ja), k: 'ja', id: f.properties.ja, h: 'Junta auxiliar' });
  for (const f of GEO.dl.features) SEARCH.push({ t: 'Distrito local ' + f.properties.distrito_l, s: 'distrito local ' + f.properties.distrito_l, k: 'dl', id: f.properties.distrito_l, h: '' });
  for (const f of GEO.df.features) SEARCH.push({ t: 'Distrito federal ' + f.properties.distrito_f, s: 'distrito federal ' + f.properties.distrito_f, k: 'df', id: f.properties.distrito_f, h: '' });
  const q = $('#q'), ul = $('#qres');
  let hits = [], on = 0;
  const show = () => {
    ul.innerHTML = hits.map((x, i) => `<li><button data-i="${i}" class="${i === on ? 'on' : ''}"><span>${esc(x.t)}</span><small>${esc(x.h || '')}</small></button></li>`).join('');
    ul.hidden = !hits.length;
    ul.querySelectorAll('button').forEach(b => b.onmousedown = e => { e.preventDefault(); pick(hits[+b.dataset.i]); });
  };
  const pick = x => { ul.hidden = true; q.value = ''; q.blur(); goTo(x.k, x.id); };
  q.oninput = () => {
    const v = norm(q.value.trim());
    if (!v) { hits = []; show(); return; }
    const isNum = /^\d+$/.test(v);
    hits = SEARCH.filter(x => isNum ? (x.k === 'seccion' ? x.s.startsWith(v) : x.s.includes(v)) : x.s.includes(v))
      .sort((a, b) => (a.s.startsWith(v) ? 0 : 1) - (b.s.startsWith(v) ? 0 : 1) || a.t.length - b.t.length).slice(0, 12);
    on = 0; show();
  };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown') { on = Math.min(on + 1, hits.length - 1); show(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { on = Math.max(on - 1, 0); show(); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[on]) pick(hits[on]);
    else if (e.key === 'Escape') { ul.hidden = true; }
  };
  q.onblur = () => setTimeout(() => ul.hidden = true, 120);
}

/* ---------- hoja inferior (celular) ---------- */
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
function peekSize() {
  if (!isMobile()) return;
  const P = $('#panel'), ph = P.querySelector('.ph'), k = P.querySelector('.kpis'), w = P.querySelector('.win');
  let hgt = 22 + (ph ? ph.offsetHeight : 60) + 8;
  if (w) hgt += w.offsetHeight + 14;
  document.documentElement.style.setProperty('--peek', Math.min(hgt, 220) + 'px');
}
function sheet() {
  const P = $('#panel'), g = $('#grip');
  g.onclick = () => { P.dataset.state = P.dataset.state === 'open' ? 'peek' : 'open'; };
  let y0 = null;
  g.addEventListener('pointerdown', e => { y0 = e.clientY; });
  window.addEventListener('pointerup', e => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null;
    if (Math.abs(dy) > 30) P.dataset.state = dy < 0 ? 'open' : 'peek';
  });
  P.querySelector('.pbody').addEventListener('click', e => {
    if (isMobile() && P.dataset.state === 'peek' && !e.target.closest('button')) P.dataset.state = 'open';
  });
  window.addEventListener('resize', peekSize);
}

/* ---------- mapa ---------- */
function initMap() {
  map = new maplibregl.Map({
    container: 'map', attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
    style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': cssVar('--mapbg') } }] },
    center: [-98.2, 19.03], zoom: 10.5, minZoom: 9.5, maxZoom: 17,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.touchZoomRotate.disableRotation();
  return new Promise(r => map.on('load', r));
}
function addLayers() {
  map.addSource('mun', { type: 'geojson', data: GEO.municipio });
  map.addLayer({ id: 'mun-fill', type: 'fill', source: 'mun', paint: { 'fill-color': cssVar('--munfill') } });
  for (const v of VISTAS) {
    map.addSource('u-' + v.k, { type: 'geojson', data: GEO[v.k], promoteId: v.id });
    map.addLayer({ id: 'f-' + v.k, type: 'fill', source: 'u-' + v.k, layout: { visibility: 'none' },
      paint: { 'fill-color': ['coalesce', ['feature-state', 'c'], cssVar('--nores')], 'fill-opacity': ['case', ['boolean', ['feature-state', 'h'], false], 0.75, 0.92] } });
    map.addLayer({ id: 'l-' + v.k, type: 'line', source: 'u-' + v.k, layout: { visibility: 'none' },
      paint: { 'line-color': cssVar('--mapbg'), 'line-width': v.k === 'seccion' || v.k === 'colonia' ? ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 1.2] : 1.5 } });
  }
  map.addLayer({ id: 'sel', type: 'line', source: 'u-seccion', paint: { 'line-color': cssVar('--fg'), 'line-width': 3 }, layout: { visibility: 'none' }, filter: ['==', ['get', 'seccion'], -1] });
  map.addLayer({ id: 'mun-line', type: 'line', source: 'mun', paint: { 'line-color': cssVar('--muted'), 'line-width': 1.2 } });

  let hov = null; const tip = $('#tip');
  const clearHov = () => { if (hov) map.setFeatureState(hov, { h: false }); hov = null; };
  for (const v of VISTAS) {
    map.on('mousemove', 'f-' + v.k, e => {
      const f = e.features[0]; if (!f) return;
      const id = f.properties[v.id];
      if (!hov || hov.id !== id) { clearHov(); hov = { source: 'u-' + v.k, id }; map.setFeatureState(hov, { h: true }); }
      map.getCanvas().style.cursor = 'pointer';
      if (isMobile()) return;
      const u = AGG[id], w = u && u.w;
      tip.innerHTML = `<b>${esc(unitName(v.k, id))}</b>${w ? (w.tie ? 'Empate' : `${esc(candLabel(w.c))} · ${p1(w.share)}`) + `<br><span style="color:var(--muted)">Participación ${p1(pct(u.a.t, u.a.ln))}</span>` : '<span style="color:var(--muted)">Sin resultados en esta elección</span>'}`;
      tip.hidden = false;
      const W = map.getContainer().clientWidth;
      tip.style.left = Math.min(e.point.x + 14, W - 250) + 'px'; tip.style.top = (e.point.y + 14) + 'px';
    });
    map.on('mouseleave', 'f-' + v.k, () => { clearHov(); tip.hidden = true; map.getCanvas().style.cursor = ''; });
    map.on('click', 'f-' + v.k, e => { const f = e.features[0]; if (f) select(f.properties[v.id]); });
  }
  map.on('click', e => { if (!map.queryRenderedFeatures(e.point, { layers: ['f-' + S.vista] }).length) select(null); });
  fit(GEO.municipio.features[0].geometry);
}
function retheme() {
  if (!map) return;
  map.setPaintProperty('bg', 'background-color', cssVar('--mapbg'));
  map.setPaintProperty('mun-fill', 'fill-color', cssVar('--munfill'));
  map.setPaintProperty('mun-line', 'line-color', cssVar('--muted'));
  for (const v of VISTAS) map.setPaintProperty('l-' + v.k, 'line-color', cssVar('--mapbg'));
  map.setPaintProperty('sel', 'line-color', cssVar('--fg'));
  paint(); renderPanel();
}

/* ---------- arranque ---------- */
async function load() {
  const j = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  const geoP = Promise.all(['municipio', 'seccion', 'colonia', 'ja', 'dl', 'df'].map(k => j(`data/geo/${k}.geojson`).then(g => GEO[k] = g)));
  IDX = await j('data/res/indice.json');
  await Promise.all([geoP, ...IDX.map(e => j(`data/res/${e.id}.json`).then(d => RES[e.id] = d)), initMap()]);
  GEO.colonia.byId = {}; for (const f of GEO.colonia.features) GEO.colonia.byId[f.properties.cid] = f;
  for (const f of GEO.seccion.features) SECINFO[f.properties.seccion] = f.properties;
  for (const f of GEO.colonia.features) for (const s of f.properties.secs) (COLS_OF_SEC[s] = COLS_OF_SEC[s] || []).push(f.properties.cid);
}
load().then(() => {
  buildControls(); addLayers(); buildSearch(); sheet();
  setVista(S.vista);
  $('#loading').hidden = true;
  const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}).catch(err => { $('#loading').textContent = 'No se pudieron cargar los datos: ' + err.message; console.error(err); });
})();
