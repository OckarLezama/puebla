/* Puebla Electoral — resultados 2000–2024 del estado de Puebla con Puebla capital al centro.
   Datos públicos: cartografía (data/geo) y catálogo. Resultados, padrón y afiliados cifrados por paquete (data/seguro),
   abiertos con la clave de cada usuario (data/acceso.json). Sin servidor. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const fmt = n => Math.round(n).toLocaleString('es-MX');
const pct = (a, b) => b ? a / b * 100 : 0;
const p1 = v => v.toFixed(1) + ' %';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const sess = { get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { sessionStorage.removeItem(k); } catch {} } };
const ICON_ZOOM = '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
const ICON_DECK = '<svg viewBox="0 0 24 24"><path d="M3 4h18v12H3zM8 20h8M12 16v4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

/* ---------- partidos ---------- */
const PARTY = {
  MORENA: ['#8A1538', 'Morena'], PAN: ['#0B4EA2', 'Partido Acción Nacional'], PRI: ['#D9232E', 'Partido Revolucionario Institucional'],
  PRD: ['#F2B800', 'Partido de la Revolución Democrática'], PVEM: ['#3E9B45', 'Partido Verde Ecologista de México'], PT: ['#B4161F', 'Partido del Trabajo'],
  MC: ['#F28C28', 'Movimiento Ciudadano'], CONV: ['#F28C28', 'Convergencia'], NA: ['#00A0A6', 'Nueva Alianza'], NAP: ['#00A0A6', 'Nueva Alianza Puebla'],
  ES: ['#6A3D9A', 'Encuentro Social'], PES: ['#6A3D9A', 'Encuentro Solidario'], PSI: ['#3F7CC0', 'Pacto Social de Integración'],
  PCPP: ['#2F7A55', 'Compromiso por Puebla'], FXM: ['#E0207D', 'Fuerza por México'], RSP: ['#9C6B30', 'Redes Sociales Progresistas'],
  PH: ['#7E57C2', 'Partido Humanista'], PSN: ['#5B8C3A', 'Partido de la Sociedad Nacionalista'], PAS: ['#8E44AD', 'Partido Alianza Social'],
  PCD: ['#C2185B', 'Partido de Centro Democrático'], PARM: ['#795548', 'Partido Auténtico de la Revolución Mexicana'],
  DSPPN: ['#6D4C41', 'Democracia Social'], PASC: ['#8E24AA', 'Alternativa Socialdemócrata y Campesina'], PSD: ['#AD1457', 'Partido Socialdemócrata'],
  MP: ['#607D8B', 'México Posible'], PLM: ['#607D8B', 'Partido Liberal Mexicano'], FC: ['#607D8B', 'Fuerza Ciudadana'],
};
const IND = '#7C8585';
const pcol = p => (PARTY[p] || [IND])[0];
const candLabel = c => c.startsWith('CAND_IND') ? 'Independiente' : c.split('-').join(' · ');
const candColor = c => c.startsWith('CAND_IND') ? IND : pcol(c.split('-')[0]);
const candTitle = c => c.startsWith('CAND_IND') ? 'Candidatura independiente' : c.split('-').map(p => (PARTY[p] || [0, p])[1]).join(', ');
const shortCand = c => c.startsWith('CAND_IND') ? 'Independiente' : c.split('-')[0] + (c.includes('-') ? ' y aliados' : '');
const leadOf = c => c.startsWith('CAND_IND') ? 'IND' : c.split('-')[0];
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join(''); }

/* ---------- estado de la aplicación ---------- */
const CARGOS = ['Presidencia municipal', 'Diputación local', 'Diputación federal', 'Gubernatura', 'Senaduría', 'Presidencia de la República'];
const cargoBase = c => c.replace(' (extraordinaria)', '');
const VISTAS = [
  { k: 'sec', l: 'Sección', geo: 'secciones', id: 'seccion', det: true },
  { k: 'col', l: 'Colonia', geo: 'colonias', id: 'cid', det: true },
  { k: 'ja', l: 'Junta aux.', geo: 'juntas', id: 'ja', det: true },
  { k: 'mun', l: 'Municipio', geo: 'municipios', id: 'municipio' },
  { k: 'dl', l: 'Dist. local', geo: 'dl', id: 'distrito_l' },
  { k: 'df', l: 'Dist. federal', geo: 'df', id: 'distrito_f' },
];
const VK = k => VISTAS.find(v => v.k === k);
const S = { el: '2024-AYU', vista: 'sec', modo: 'win', sel: null, foco: null, cmp: null, partes: 'cand' };
let CAT, ELS = {}, EST, MB = {}, GEO = {}, PERFIL, map, AGG = {}, MUNAGG = {}, MUNN = {}, SECMUN = {}, COLS_OF_SEC = {}, DETOK = [], HOME;
const CAPAS_DEF = [
  ['base', 'Mapa de calles', true, null], ['estado', 'Municipios del estado', true, null], ['zm', 'Contorno zona metropolitana', true, 'zm'],
  ['conurb', 'Contorno Puebla y conurbados', true, 'det'], ['dl', 'Distritos locales', false, 'dl'], ['df', 'Distritos federales', false, 'df'],
];
const LINE_COL = { zm: '#8E8462', det: '#BFB591', dl: '#2B6E8F', df: '#6B3F8F' };
let CAPAS = Object.assign(Object.fromEntries(CAPAS_DEF.map(c => [c[0], c[2]])), { alcance: 'foco' }, store.get('pe_capas2') || {});
const BASE_STYLE = 'https://tiles.openfreemap.org/styles/positron';
let FIRST_SYMBOL, BASE_IDS = [], BASE_OK = false;
const addL = (layer, before) => map.addLayer(layer, before || FIRST_SYMBOL);

/* =================== ACCESO =================== */
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = b => btoa(String.fromCharCode(...new Uint8Array(b)));
async function aesOpen(rawKey, buf) { const k = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']); return crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12)); }
async function gunzipJSON(buf) { return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json(); }
async function login(usuario, clave) {
  const A = await fetch('data/acceso.json', { cache: 'no-cache' }).then(r => r.json());
  const u = usuario.trim().toLowerCase();
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(A.sal + '|' + u)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const e = A.u[h]; if (!e) throw new Error('auth');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(e.s), iterations: A.it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  let perfil;
  try { const p = b64d(e.p); perfil = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: p.slice(0, 12) }, kek, p.slice(12)))); } catch { throw new Error('auth'); }
  const keys = {};
  for (const cab in e.k) { const b = b64d(e.k[cab]); keys[cab] = b64e(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, kek, b.slice(12))); }
  return { perfil, keys };
}
async function openBundle(cab, key) {
  const r = await fetch('data/seguro/' + cab + '.txt', { cache: 'no-cache' }); if (!r.ok) throw new Error(cab + ' ' + r.status);
  return gunzipJSON(await aesOpen(b64d(key), b64d((await r.text()).trim())));
}
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }

/* =================== AGREGACIÓN =================== */
const EMPTY = () => ({ ln: 0, t: 0, nu: 0, nr: 0, c: null, p: null, n: 0, nx: 0, tx: 0 });
function addPack(o, pk) {
  if (!pk) return;
  if (!o.c) { o.c = pk[4].slice(); o.p = pk[5].slice(); } else { for (let i = 0; i < pk[4].length; i++) o.c[i] += pk[4][i]; for (let i = 0; i < pk[5].length; i++) o.p[i] += pk[5][i]; }
  o.ln += pk[0]; o.t += pk[1]; o.nu += pk[2]; o.nr += pk[3]; o.n++;
  if (pk[6]) { o.nx++; o.tx += pk[1]; }
}
const secPack = (eid, s) => { const m = SECMUN[s]; return m && MB[m] && MB[m][eid] ? MB[m][eid][s] : null; };
function unitSecs(u, key) {
  if (u === 'sec') return [key];
  if (u === 'col') return GEO.colonias.byId[key].properties.secs;
  if (u === 'ja') return GEO.secciones.features.filter(f => f.properties.ja === key).map(f => f.properties.seccion);
  return [];
}
function agg(u, key, eid) {
  const o = EMPTY(), E = EST[eid]; if (!E) return o;
  if (u === 'est') addPack(o, E.est);
  else if (u === 'mun') addPack(o, E.mun[key]);
  else if (u === 'dl' || u === 'df') addPack(o, E[u][key]);
  else {
    for (const s of unitSecs(u, key)) addPack(o, secPack(eid, s));
    if (u === 'ja' && MB[115] && MB[115][eid]) for (const pk of Object.values(MB[115][eid])) if (pk[6] && pk[7] === key) addPack(o, pk);
  }
  return o;
}
function ranking(eid, a) { const m = ELS[eid]; return a.c ? m.cand.map((c, i) => ({ c, i, v: a.c[i] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v) : []; }
function verdict(eid, a) {
  const r = ranking(eid, a); if (!a.n || !a.t || !r.length) return null;
  const v1 = r[0].v, v2 = r[1] ? r[1].v : 0;
  return { c: r[0].c, share: pct(v1, a.t), margin: pct(v1 - v2, a.t), tie: v1 === v2, second: r[1] && r[1].c };
}
function blocs(eid, a) { const by = {}; if (a.t) for (const x of ranking(eid, a)) { const p = leadOf(x.c); by[p] = (by[p] || 0) + pct(x.v, a.t); } return by; }
function munOfUnit(u, key) { if (u === 'mun') return key; if (u === 'sec') return SECMUN[key]; if (u === 'col') return GEO.colonias.byId[key].properties.municipio; if (u === 'ja') return 115; return null; }
function personFor(eid, u, key, cand) {
  const E = EST[eid], g = E && E.g; if (!g) return null;
  const t = ELS[eid].tipo, lead = leadOf(cand), match = w => w && w[1].split(/[_-]/).includes(lead) ? w[0] : null;
  if (t === 'AYU') { const mm = munOfUnit(u, key); return mm ? match(g['m' + mm]) : null; }
  if (t === 'GOB' || t === 'PRE') { if (g.est && !g.est[1]) { const w = verdict(eid, agg('est', 0, eid)); return w && w.c === cand ? g.est[0] : null; } return match(g.est); }
  if ((t === 'DL' || t === 'DF') && u === t.toLowerCase()) return match(g[u + key]);
  if (t === 'SEN' && g.est_sen) { const n = g.est_sen.filter(w => match(w)).map(w => w[0]); return n.length ? n.join(' y ') : null; }
  return null;
}
function padron(u, key) {
  const P = EST._pad; if (!P) return null;
  let r = null;
  const add = b => { if (!b) return; if (!r) { r = [b[0], b[1], b[2], b[3], b[4], b[5].slice(), b[6].slice()]; return; } for (let i = 0; i < 5; i++) r[i] += b[i]; for (let i = 0; i < b[5].length; i++) { r[5][i] += b[5][i]; r[6][i] += b[6][i]; } };
  if (u === 'est') add(P.est); else if (u === 'mun' || u === 'dl' || u === 'df') add(P[u][key]);
  else for (const s of unitSecs(u, key)) { const m = SECMUN[s]; add(MB[m] && MB[m]._pad && MB[m]._pad[s]); }
  return r;
}
const prevOf = eid => { const e = ELS[eid]; return CAT.elecciones.filter(x => cargoBase(x.cargo) === cargoBase(e.cargo) && !x.cargo.includes('extra') && x.anio < e.anio).sort((a, b) => b.anio - a.anio)[0]; };
const cmpEl = () => (S.cmp && ELS[S.cmp] && S.cmp !== S.el) ? ELS[S.cmp] : prevOf(S.el);

/* =================== COLOR DEL MAPA =================== */
const BINS_P = [40, 50, 60, 70], BINS_C = [20, 35, 50, 65];
const binIdx = (v, bins) => { let i = 0; while (i < bins.length && v >= bins[i]) i++; return i; };
const rampColor = (base, i) => mix(base, cssVar('--mapbg') || '#eeeeee', [0.82, 0.62, 0.42, 0.2, 0][i]);
function colorFor(u, key, vk) {
  const nores = cssVar('--nores');
  if (!u || !u.w) return nores;
  if (S.modo === 'win') return u.w.tie ? '#9AA3A3' : mix(candColor(u.w.c), cssVar('--mapbg'), u.w.margin < 5 ? 0.5 : u.w.margin < 15 ? 0.25 : 0);
  if (S.modo === 'part') return u.a.ln ? rampColor('#4C6B66', binIdx(pct(u.a.t, u.a.ln), BINS_P)) : nores;
  if (S.modo === 'cambio') {
    const c = cmpEl(); if (!c) return nores;
    const w0 = verdict(c.id, agg(vk, key, c.id));
    if (!w0) return nores;
    return leadOf(w0.c) !== leadOf(u.w.c) ? candColor(u.w.c) : mix(candColor(u.w.c), cssVar('--mapbg'), .8);
  }
  const i = ELS[S.el].cand.indexOf(S.modo);
  return i < 0 ? nores : rampColor(candColor(S.modo), binIdx(pct(u.a.c[i], u.a.t), BINS_C));
}
function computeAgg(vk) {
  const v = VK(vk), out = {};
  for (const f of GEO[v.geo].features) { const key = f.properties[v.id]; const a = agg(vk, key, S.el); out[key] = { a, w: verdict(S.el, a) }; }
  return out;
}
/* qué se ve nítido: la selección o el foco; lo demás se difumina */
function highlight() {
  const h = S.sel || S.foco, v = VK(S.vista), VIV = BASE_OK ? .78 : .93, DIM = BASE_OK ? .1 : .13;
  const munOf = h.u === 'mun' ? h.key : munOfUnit(h.u, h.key);
  let e;
  if (v.det) {
    if (h.u === 'dl' || h.u === 'df') e = v.k === 'sec' ? ['==', ['get', h.u === 'dl' ? 'distrito_l' : 'distrito_f'], h.key] : false;
    else e = v.k === 'ja' ? (munOf === 115) : ['==', ['get', 'municipio'], munOf ?? -1];
  } else if (S.sel && S.sel.u === S.vista) e = ['==', ['get', v.id], S.sel.key];
  else if (S.sel && v.k === 'mun' && munOf != null) e = ['==', ['get', 'municipio'], munOf];
  else e = true;
  // alcance a color: solo el foco, la zona metropolitana o todo el estado
  if (e !== true && v.det && CAPAS.alcance !== 'foco' && !(S.sel && S.sel.u !== 'mun')) e = CAPAS.alcance === 'todo' ? true : ['any', e === false ? false : e, ['in', ['get', 'municipio'], ['literal', CAT.zm]]];
  const hov = ['boolean', ['feature-state', 'h'], false];
  const op = e === true ? ['case', hov, 1, VIV] : e === false ? ['case', hov, .4, DIM] : ['case', hov, ['case', e, 1, .45], ['case', e, VIV, DIM]];
  map.setPaintProperty('f-' + v.geo, 'fill-opacity', op);
  map.setPaintProperty('l-' + v.geo, 'line-opacity', e === true ? 1 : e === false ? .3 : ['case', e, 1, .25]);
  if (v.k !== 'mun') map.setPaintProperty('f-municipios', 'fill-opacity', v.det ? .1 : .08);
  const home = S.foco.u === HOME.u && S.foco.key === HOME.key && !S.sel && S.vista === HOME.vista && CAPAS.alcance === 'foco';
  $('#btn-home').hidden = home; placeHome();
}
function paint() {
  AGG = computeAgg(S.vista);
  MUNAGG = S.vista === 'mun' ? AGG : computeAgg('mun');
  for (const [k, u] of Object.entries(MUNAGG)) map.setFeatureState({ source: 'g-municipios', id: k }, { c: colorFor(u, +k, 'mun') });
  const v = VK(S.vista);
  if (S.vista !== 'mun') for (const [k, u] of Object.entries(AGG)) map.setFeatureState({ source: 'g-' + v.geo, id: k }, { c: colorFor(u, S.vista === 'ja' ? k : +k, S.vista) });
  if (v.det) map.setFilter('t-' + v.geo, ['in', ['get', v.id], ['literal', Object.keys(AGG).filter(k => !AGG[k].w).map(k => S.vista === 'ja' ? k : +k)]]);
  highlight(); legend(); hero(); renderPanel();
}

/* =================== LEYENDA Y RESUMEN =================== */
function legend() {
  const L = $('#legend'), m = ELS[S.el]; let h = '';
  const g = cssVar('--fg'), bg = cssVar('--mapbg');
  if (S.modo === 'win') h += `<h4>Ventaja de quien ganó</h4><div class="items"><span class="it"><span class="sw" style="background:${mix(g, bg, .5)}"></span>Menos de 5 pts</span><span class="it"><span class="sw" style="background:${mix(g, bg, .25)}"></span>5 a 15</span><span class="it"><span class="sw" style="background:${g}"></span>Más de 15</span></div>`;
  else if (S.modo === 'cambio') { const c = cmpEl(); const n = Object.entries(AGG).filter(([k, u]) => u.w && c && (w0 => w0 && leadOf(w0.c) !== leadOf(u.w.c))(verdict(c.id, agg(S.vista, S.vista === 'ja' ? k : +k, c.id)))).length;
    h += `<h4>Cambio de ganador respecto a ${c ? c.anio : '—'}</h4><div class="items"><span class="it"><span class="sw" style="background:${g}"></span>Cambió (${n})</span><span class="it"><span class="sw" style="background:${mix(g, bg, .8)}"></span>Mismo partido</span></div>`; }
  else { const isP = S.modo === 'part', base = isP ? '#4C6B66' : candColor(S.modo), bins = isP ? BINS_P : BINS_C;
    h += `<h4>${isP ? 'Participación (% de la lista nominal)' : 'Votación de ' + esc(candLabel(S.modo)) + ' (%)'}</h4><div class="ramp">${[0, 1, 2, 3, 4].map(i => `<span style="background:${rampColor(base, i)}"></span>`).join('')}</div><div class="rampl"><span>0</span>${bins.map(b => `<span>${b}</span>`).join('')}<span>100</span></div>`;
    if (isP && !m.ln) h += `<div class="items"><span class="it">El cómputo de ${m.anio} no trae lista nominal.</span></div>`; }
  const v = VK(S.vista), nores = Object.values(AGG).filter(u => !u.w).length;
  if (nores && v.k === 'sec') h += `<div class="items"><span class="it"><span class="sw" style="background:${cssVar('--nores')};background-image:repeating-linear-gradient(135deg,rgba(110,120,115,.6) 0 1px,transparent 1px 4px)"></span>Secciones creadas después de ${m.anio}</span></div>`;
  L.innerHTML = h;
}
function homeFoco() {
  if (PERFIL.nivel === 5) { const t = PERFIL.ambito.slice(0, 2).toLowerCase(); return { u: t, key: +PERFIL.ambito.slice(2) }; }
  if (PERFIL.nivel === 4 && PERFIL.ambito) return { u: 'mun', key: +PERFIL.ambito };
  return { u: 'mun', key: 115 };
}
function unitName(u, key) {
  if (u === 'est') return 'Estado de Puebla';
  if (u === 'mun') return key === 115 ? 'Puebla capital' : MUNN[key];
  if (u === 'sec') return 'Sección ' + key;
  if (u === 'col') return GEO.colonias.byId[key].properties.nombre;
  if (u === 'ja') return key === 'Zona Centro' ? 'Zona Centro' : 'Junta auxiliar ' + key;
  if (u === 'dl') return 'Distrito local ' + key;
  if (u === 'df') return 'Distrito federal ' + key;
}
function placeHome() { const H = $('#hero'), B = $('#btn-home'); if (!isMobile()) B.style.top = (H.offsetTop + H.offsetHeight + 10) + 'px'; else B.style.top = ''; }
function hero() {
  const F = S.foco, m = ELS[S.el], a = agg(F.u, F.key, S.el), r = ranking(S.el, a), w = verdict(S.el, a);
  const top = r.slice(0, 4), rest = a.t - top.reduce((s, x) => s + x.v, 0), who = w ? personFor(S.el, F.u, F.key, w.c) : null;
  $('#hero').innerHTML = `<div class="eyebrow"><svg><use href="#i-rombo"/></svg>${esc(unitName(F.u, F.key))} · ${esc(cargoBase(m.cargo))} ${m.anio}</div>
    ${w ? `<div class="hw"><b>${w.tie ? 'Empate' : esc(who || shortCand(w.c))}</b><span class="pc" style="color:${candColor(w.c)}">${p1(w.share)}</span></div>
    <div class="stack">${top.map(x => `<i style="width:${pct(x.v, a.t)}%;background:${candColor(x.c)}" title="${esc(candLabel(x.c))} ${p1(pct(x.v, a.t))}"></i>`).join('')}<i style="width:${pct(rest, a.t)}%;background:var(--nores)"></i></div>
    <div class="hs"><span>${who ? esc(shortCand(w.c)) : 'Ventaja ' + w.margin.toFixed(1) + ' pts'}</span><span>${a.ln ? 'Participación ' + p1(pct(a.t, a.ln)) : fmt(a.t) + ' votos'}</span></div>`
    : `<div class="hs"><span>No hubo esta elección en ${m.anio}.</span></div>`}`;
  placeHome();
}

/* =================== GRÁFICAS =================== */
function barRows(eid, a, u, key, mode) {
  const m = ELS[eid];
  return mode === 'cand' ? ranking(eid, a).map(x => ({ l: mode === 'cand' && barRows.short ? shortCand(x.c) : candLabel(x.c), s: personFor(eid, u, key, x.c), t: candLabel(x.c) + ' · ' + candTitle(x.c), col: candColor(x.c), v: x.v }))
    : m.part.map((p, i) => ({ l: p, t: (PARTY[p] || [0, p])[1], col: pcol(p), v: a.p[i] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v);
}
function bars(eid, a, u, key, mode, opts = {}) {
  barRows.short = !!opts.short; const rows = barRows(eid, a, u, key, mode); barRows.short = false;
  if (opts.hideWin && rows[0]) rows[0].s = null;
  if (!opts.noNulos) { rows.push({ l: 'Votos nulos', col: cssVar('--muted'), v: a.nu, minor: true }); if (a.nr) rows.push({ l: 'No registradas', col: cssVar('--muted'), v: a.nr, minor: true }); }
  const max = Math.max(...rows.map(r => r.v), 1);
  return `<div class="bars">${rows.map(r => `<div class="b${r.minor ? ' minor' : ''}" title="${esc(r.t || '')}"><span class="n">${esc(r.l)}${r.s ? `<small>${esc(r.s)}</small>` : ''}</span><span class="vv">${fmt(r.v)}</span><span class="pp">${p1(pct(r.v, a.t))}</span><span class="track"><i data-w="${(r.v / max * 100).toFixed(1)}" style="background:${r.col}"></i></span></div>`).join('')}</div>`;
}
/* columnas por partido (votos con su logo) */
function columns(eid, a, W = 380, H = 190) {
  const m = ELS[eid], rows = m.part.map((p, i) => ({ p, v: a.p[i] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v).slice(0, 10);
  if (!rows.length) return '';
  const max = Math.max(...rows.map(r => r.v)), L = 6, B = 34, T = 22, bw = (W - L * 2) / rows.length;
  let g = `<line class="ax" x1="0" x2="${W}" y1="${H - B}" y2="${H - B}"/>`;
  rows.forEach((r, i) => { const h = (H - B - T) * r.v / max, x = L + i * bw + bw * .14, w = bw * .72, y = H - B - h;
    g += `<rect class="col" style="animation-delay:${i * .05}s" x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${pcol(r.p)}"><title>${esc((PARTY[r.p] || [0, r.p])[1])}: ${fmt(r.v)}</title></rect>`
      + `<text class="lbl-v" x="${x + w / 2}" y="${y - 6}" text-anchor="middle">${pct(r.v, a.t).toFixed(1)}</text><text x="${x + w / 2}" y="${H - B + 15}" text-anchor="middle">${esc(r.p)}</text>`; });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Votos por partido">${g}</svg></div>`;
}
function trendData(u, key) {
  const cargo = cargoBase(ELS[S.el].cargo);
  return CAT.elecciones.filter(e => cargoBase(e.cargo) === cargo && !e.cargo.includes('extra')).sort((a, b) => a.anio - b.anio).map(e => {
    const a = agg(u, key, e.id); return { e, a, by: blocs(e.id, a), part: a.ln ? pct(a.t, a.ln) : null };
  }).filter(p => p.a.t);
}
function trend(u, key, W = 380, H = 190) {
  const pts = trendData(u, key); if (pts.length < 2) return '';
  const tot = {}; pts.forEach(p => Object.entries(p.by).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v));
  const lead = Object.entries(tot).filter(([k]) => k !== 'IND').sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
  const L = 30, R = 30, T = 12, B = 24, xs = i => L + i * (W - L - R) / (pts.length - 1), ys = v => T + (1 - v / 100) * (H - T - B);
  const path = vals => vals.map((v, i) => [xs(i), ys(v)]).reduce((s, [x, y], i, arr) => { if (!i) return `M${x},${y}`; const [px, py] = arr[i - 1], cx = (px + x) / 2; return s + ` C${cx},${py} ${cx},${y} ${x},${y}`; }, '');
  let g = [0, 25, 50, 75, 100].map(v => `<line class="ax" x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}"/><text x="${L - 6}" y="${ys(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  g += pts.map((p, i) => `<text x="${xs(i)}" y="${H - 6}" text-anchor="middle" ${p.e.id === S.el ? 'class="lbl-v"' : ''}>${p.e.anio}</text>`).join('');
  const sel = pts.findIndex(p => p.e.id === S.el); if (sel >= 0) g += `<line x1="${xs(sel)}" x2="${xs(sel)}" y1="${T}" y2="${H - B}" stroke="${cssVar('--oro')}" stroke-width="1.5" stroke-dasharray="3 3"/>`;
  const part = pts.map(p => p.part);
  if (part.every(v => v != null)) g += `<path d="${path(part)}" fill="none" stroke="${cssVar('--muted')}" stroke-width="2" stroke-dasharray="4 4"/>`;
  lead.forEach((p, j) => { const vals = pts.map(x => x.by[p] || 0), d = path(vals), c = pcol(p);
    const gid = 'gr' + p + W; g += `<defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity="${j === 0 ? .28 : .12}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><path class="ar" d="${d} L${xs(vals.length - 1)},${ys(0)} L${xs(0)},${ys(0)} Z" fill="url(#${gid})"/>`;
    g += `<text x="${xs(vals.length - 1) + 6}" y="${ys(vals[vals.length - 1]) + 4}" class="lbl-v" style="fill:${c}">${vals[vals.length - 1].toFixed(0)}</text>`;
    g += `<path class="ln" style="animation-delay:${j * .15}s" d="${d}" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>` + vals.map((v, i) => `<circle cx="${xs(i)}" cy="${ys(v)}" r="${i === sel ? 4.5 : 3}" fill="${c}"><title>${pts[i].e.anio} · ${p}: ${p1(v)}</title></circle>`).join(''); });
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tendencia">${g}</svg></div><div class="lgd">${lead.map(p => `<span><i style="background:${pcol(p)}"></i>${p}${pts.some(x => ranking(x.e.id, x.a).some(r => leadOf(r.c) === p && r.c.includes('-'))) ? ' y aliados' : ''}</span>`).join('')}${part.every(v => v != null) ? `<span><i style="background:${cssVar('--muted')}"></i>Participación</span>` : ''}</div>`;
}
/* ¿qué cambió? gráfica de pendiente entre dos elecciones, con una frase que lo resume */
function compare(u, key, W = 380, H = 230) {
  const c = cmpEl(); if (!c) return null;
  const e1 = ELS[S.el], a1 = agg(u, key, S.el), a0 = agg(u, key, c.id);
  if (!a1.t || !a0.t) return { c, html: `<div class="note">No hay resultados aquí en ${c.anio}.</div>` };
  const b1 = blocs(S.el, a1), b0 = blocs(c.id, a0);
  const parts = [...new Set([...Object.keys(b1), ...Object.keys(b0)])].filter(p => p !== 'IND').sort((x, y) => Math.max(b1[y] || 0, b0[y] || 0) - Math.max(b1[x] || 0, b0[x] || 0)).slice(0, 5);
  const allR = ranking(S.el, a1).concat(ranking(c.id, a0)), nm = p => p + (allR.some(r => leadOf(r.c) === p && r.c.includes('-')) ? ' y aliados' : '');
  const w1 = verdict(S.el, a1), w0 = verdict(c.id, a0);
  const big = parts.map(p => ({ p, d: (b1[p] || 0) - (b0[p] || 0) })).sort((x, y) => Math.abs(y.d) - Math.abs(x.d))[0];
  const frase = !w1 || !w0 ? '' : leadOf(w1.c) === leadOf(w0.c)
    ? `<b>${esc(nm(leadOf(w1.c)))}</b> volvió a ganar. ${big ? `El mayor cambio fue de <b>${esc(nm(big.p))}</b>: ${big.d > 0 ? 'subió' : 'bajó'} ${Math.abs(big.d).toFixed(1)} puntos.` : ''}`
    : `<b>Cambió el ganador</b>: en ${c.anio} ganó ${esc(nm(leadOf(w0.c)))} y en ${e1.anio} ${esc(nm(leadOf(w1.c)))}.`;
  const max = Math.max(60, ...parts.map(p => Math.max(b1[p] || 0, b0[p] || 0))) * 1.08;
  const L = 50, R = 96, T = 26, B = 18, x0 = L, x1 = W - R, y = v => T + (1 - v / max) * (H - T - B);
  let g = `<text x="${x0}" y="14" text-anchor="middle" class="lbl-v">${c.anio}</text><text x="${x1}" y="14" text-anchor="middle" class="lbl-v">${e1.anio}</text><line class="ax" x1="${x0}" x2="${x0}" y1="${T - 4}" y2="${H - B}"/><line class="ax" x1="${x1}" x2="${x1}" y1="${T - 4}" y2="${H - B}"/>`;
  const spread = vals => { const o = vals.map((v, i) => ({ i, y: y(v) })).sort((a, b) => a.y - b.y); for (let k = 1; k < o.length; k++) if (o[k].y - o[k - 1].y < 15) o[k].y = o[k - 1].y + 15; const r = []; o.forEach(x => r[x.i] = x.y); return r; };
  const Y0 = spread(parts.map(p => b0[p] || 0)), Y1 = spread(parts.map(p => b1[p] || 0));
  parts.forEach((p, i) => { const v0 = b0[p] || 0, v1 = b1[p] || 0, col = pcol(p), d = v1 - v0;
    g += `<line class="sl" style="animation-delay:${i * .08}s" x1="${x0}" y1="${y(v0)}" x2="${x1}" y2="${y(v1)}" stroke="${col}" stroke-width="3" stroke-linecap="round"/>`
      + `<circle cx="${x0}" cy="${y(v0)}" r="5.5" fill="#fff" stroke="${col}" stroke-width="3"/><circle cx="${x1}" cy="${y(v1)}" r="6.5" fill="${col}"/>`
      + `<text x="${x0 - 10}" y="${Y0[i] + 4}" text-anchor="end">${v0.toFixed(1)}</text><text x="${x1 + 10}" y="${Y1[i] + 4}"><tspan class="lbl-v">${v1.toFixed(1)}</tspan><tspan dx="5" style="fill:${d >= 0 ? '#2E7D4F' : '#B03A2E'};font-weight:700">${d > 0 ? '+' : ''}${d.toFixed(1)}</tspan></text>`; });
  const pa1 = a1.ln ? pct(a1.t, a1.ln) : null, pa0 = a0.ln ? pct(a0.t, a0.ln) : null;
  const html = `<p class="frase">${frase}</p><div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparación">${g}</svg></div>
    <div class="lgd">${parts.map(p => `<span><i style="background:${pcol(p)}"></i>${esc(nm(p))}</span>`).join('')}</div>
    ${pa1 != null && pa0 != null ? `<div class="src">Participación: ${p1(pa0)} en ${c.anio} y ${p1(pa1)} en ${e1.anio} (${pa1 - pa0 > 0 ? '+' : ''}${(pa1 - pa0).toFixed(1)} puntos). Porcentaje de votos de cada partido y sus aliados.</div>` : ''}`;
  return { c, html };
}
/* anillo de resultados con el ganador al centro */
function donut(eid, a, u, key, size = 190) {
  const r = ranking(eid, a), top = r.slice(0, 5), rest = a.t - top.reduce((s, x) => s + x.v, 0), w = verdict(eid, a);
  const R = size / 2 - 12, C = 2 * Math.PI * R, segs = top.map(x => ({ v: x.v, col: candColor(x.c), t: candLabel(x.c) })).concat(rest > 0 ? [{ v: rest, col: cssVar('--nores'), t: 'Otros y nulos' }] : []);
  let off = 0, g = `<circle cx="${size / 2}" cy="${size / 2}" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="22"/>`;
  segs.forEach((s, i) => { const len = C * s.v / a.t; g += `<circle class="seg-d" style="--len:${len.toFixed(2)};--C:${C.toFixed(2)};animation-delay:${i * .08}s" cx="${size / 2}" cy="${size / 2}" r="${R}" fill="none" stroke="${s.col}" stroke-width="22" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"><title>${esc(s.t)}: ${p1(pct(s.v, a.t))}</title></circle>`; off += len; });
  if (w) g += `<text x="${size / 2}" y="${size / 2 - 2}" text-anchor="middle" class="d-big" style="fill:${candColor(w.c)}">${w.share.toFixed(1)}%</text><text x="${size / 2}" y="${size / 2 + 18}" text-anchor="middle" class="d-sm">${esc(shortCand(w.c))}</text>`;
  return `<div class="donut"><svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Reparto de votos">${g}</svg></div>`;
}
/* composición: escaños del Congreso, distritos o ayuntamientos ganados en todo el estado */
function blocOfSeat(eid, partido, actor) {
  const m = ELS[eid], ps = (partido || '').split(/[_-]/).filter(Boolean), as = (actor || '').replace(/^C_COMUN_|^COM_MEXICO$/, x => x === 'COM_MEXICO' ? 'PRI_PVEM' : '').split(/[_-]/).filter(Boolean);
  const pool = ps.length ? ps : as, cand = m.cand.find(c => !c.startsWith('CAND_IND') && pool.some(p => c.split('-').includes(p)));
  return cand ? leadOf(cand) : (pool[0] || '?');
}
function seats() {
  const m = ELS[S.el], t = m.tipo, CG = EST._cong || {};
  let list = [], title = '', total = 0, note = '';
  if (t === 'DL' && CG.DL && CG.DL[m.anio]) { const d = CG.DL[m.anio]; list = (d.mr || []).map(s => ({ b: blocOfSeat(S.el, s[0], s[1]), k: 'mr' })).concat((d.rp || []).map(s => ({ b: blocOfSeat(S.el, s[0], s[1]), k: 'rp' }))); title = `Congreso del Estado · ${list.length} diputaciones`; note = `${(d.mr || []).length} de mayoría y ${(d.rp || []).length} plurinominales`; }
  else if (t === 'DF' && CG.DF && CG.DF[m.anio]) { list = CG.DF[m.anio].mr.map(s => ({ b: blocOfSeat(S.el, s[0], s[1]), k: 'mr' })); title = `Diputaciones federales de Puebla · ${list.length} distritos`; note = 'Solo los distritos de mayoría de Puebla'; }
  else if (t === 'SEN' && CG.SEN && CG.SEN[m.anio]) { list = CG.SEN[m.anio].mr.map(s => ({ b: blocOfSeat(S.el, s[0], s[1]), k: 'mr' })); title = `Senado por Puebla · ${list.length} escaños`; note = 'Dos de mayoría y uno de primera minoría'; }
  else if (t === 'AYU') { for (const [k, pk] of Object.entries(EST[S.el].mun)) { const o = EMPTY(); addPack(o, pk); const w = verdict(S.el, o); if (w && !w.tie) list.push({ b: leadOf(w.c), k: 'mr', m: +k }); } title = `Ayuntamientos · ${list.length} municipios`; note = 'Partido o coalición que ganó cada presidencia municipal'; }
  if (!list.length) return null;
  total = list.length;
  const cnt = {}; list.forEach(s => cnt[s.b] = (cnt[s.b] || 0) + 1);
  const order = Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  list.sort((x, y) => order.indexOf(x.b) - order.indexOf(y.b));
  const may = Math.floor(total / 2) + 1, cal = Math.ceil(total * 2 / 3), lead = order[0], nl = cnt[lead];
  const quien = p => p + (m.cand.some(c => leadOf(c) === p && c.includes('-')) ? ' y aliados' : '');
  const veredicto = t === 'AYU' ? `<b>${esc(quien(lead))}</b> ganó ${nl} de ${total} municipios.`
    : nl >= cal ? `<b>${esc(quien(lead))}</b> tiene ${nl} de ${total}: <b>mayoría calificada</b> (dos tercios).` : nl >= may ? `<b>${esc(quien(lead))}</b> tiene ${nl} de ${total}: <b>mayoría</b>.` : `Nadie tiene mayoría: ${esc(quien(lead))} tiene ${nl} de ${total} y se necesitan ${may}.`;
  return { title, total, list, cnt, order, may, veredicto, note, t };
}
function seatsChart(S_, W = 380) {
  if (S_.t === 'AYU') {   // cuadrícula de municipios
    const cols = 22, sz = (W - 4) / cols, H = Math.ceil(S_.total / cols) * sz;
    const g = S_.list.map((s, i) => `<rect class="wf" style="animation-delay:${(i * 3) % 400}ms" data-mun="${s.m}" x="${(i % cols) * sz + 1}" y="${Math.floor(i / cols) * sz + 1}" width="${sz - 2.5}" height="${sz - 2.5}" rx="2.5" fill="${pcol(s.b)}"><title>${esc(MUNN[s.m])}: ${esc(s.b)}</title></rect>`).join('');
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Municipios ganados">${g}</svg></div>`;
  }
  // hemiciclo
  const n = S_.total, rows = n > 30 ? 4 : n > 12 ? 3 : n > 5 ? 2 : 1, H = W / 2 + 10, cx = W / 2, cy = H - 6, r0 = W * .2, r1 = W / 2 - 14;
  const radii = Array.from({ length: rows }, (_, i) => rows === 1 ? (r0 + r1) / 2 : r0 + (r1 - r0) * i / (rows - 1));
  const tot = radii.reduce((s, r) => s + r, 0), per = radii.map(r => Math.round(n * r / tot)); per[per.length - 1] += n - per.reduce((s, x) => s + x, 0);
  const pts = []; radii.forEach((r, i) => { const k = per[i]; for (let j = 0; j < k; j++) { const a = Math.PI * (k === 1 ? .5 : j / (k - 1)); pts.push({ a, x: cx - r * Math.cos(a), y: cy - r * Math.sin(a) }); } });
  pts.sort((p, q) => p.a - q.a);
  const rad = Math.min(14, (r1 - r0) / (rows * 1.6) + 4, W / (n * .9 + 8));
  let g = pts.map((p, i) => { const s = S_.list[i]; return `<circle class="seat" style="animation-delay:${i * 18}ms" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${pcol(s.b)}" ${s.k === 'rp' ? `stroke="#fff" stroke-width="2"` : ''}><title>${esc(s.b)}${s.k === 'rp' ? ' · plurinominal' : ''}</title></circle>`; }).join('');
  g += `<text x="${cx}" y="${cy - 8}" text-anchor="middle" class="d-big">${S_.cnt[S_.order[0]]}</text><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="d-sm">de ${n} · mayoría ${S_.may}</text>`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Composición">${g}</svg></div>`;
}
function seatsCard(big) {
  const s = seats(); if (!s) return '';
  const body = `<p class="frase">${s.veredicto}</p>${seatsChart(s, big ? 720 : 380)}<div class="lgd">${s.order.map(p => `<span><i style="background:${pcol(p)}"></i>${esc(p)} ${s.cnt[p]}</span>`).join('')}</div><div class="src">${esc(s.note)}${s.t === 'DL' ? '. Los plurinominales llevan borde blanco' : ''}.</div>`;
  return big ? `<h4 class="src">${esc(s.title)}</h4>${body}` : card('seats', `En todo el estado · ${esc(s.title)}`, body);
}
function pyramid(P) {
  if (!P) return '';
  const G = CAT.padron.grupos, mx = Math.max(...P[5], ...P[6], 1);
  return `<div class="pyr">${G.map((g, i) => `<span class="h" data-w="${(P[5][i] / mx * 100).toFixed(1)}" title="Hombres ${g}: ${fmt(P[5][i])}"></span><span class="g">${g}</span><span class="m" data-w="${(P[6][i] / mx * 100).toFixed(1)}" title="Mujeres ${g}: ${fmt(P[6][i])}"></span>`).reverse().join('')}</div>
    <div class="pyr-lg"><span>Hombres ${p1(pct(P[2], P[1]))}</span><span>Mujeres ${p1(pct(P[3], P[1]))}</span></div>`;
}
function afiliados() {
  const A = EST._afi; if (!A) return '';
  const rows = Object.entries(A).map(([p, d]) => ({ p, v: d.t })).sort((a, b) => b.v - a.v), max = rows[0].v, tot = rows.reduce((s, r) => s + r.v, 0);
  return `<div class="bars">${rows.map(r => `<div class="b"><span class="n">${esc(r.p)}</span><span class="vv">${fmt(r.v)}</span><span class="pp">${p1(pct(r.v, tot))}</span><span class="track"><i data-w="${(r.v / max * 100).toFixed(1)}" style="background:${pcol(r.p)}"></i></span></div>`).join('')}</div>`;
}
function animate(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('[data-w]').forEach(el => el.style.width = el.dataset.w + '%');
    root.querySelectorAll('[data-n]').forEach(el => { const to = +el.dataset.n, dec = +(el.dataset.d || 0), suf = el.dataset.s || '', t0 = performance.now();
      const step = t => { const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3), v = to * e; el.textContent = (dec ? v.toFixed(dec) : fmt(v)) + suf; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
  }));
}

/* =================== FICHA =================== */
function current() { const s = S.sel || S.foco; return { u: s.u, key: s.key }; }
function card(id, title, body, opts = {}) {
  return `<section class="card" id="c-${id}"><div class="card-h"><h3>${title}</h3><div class="acts">${opts.extra || ''}<button class="zoom" data-zoom="${id}" title="Ampliar">${ICON_ZOOM}</button></div></div>${body}</section>`;
}
function context(u, key) {
  const chip = (go, t) => `<button class="chip" data-go="${go}">${esc(t)}</button>`;
  if (u === 'sec') { const p = GEO.secciones.byId[key].properties, cols = COLS_OF_SEC[key] || [];
    return `<div class="chips">${chip('mun:' + p.municipio, unitName('mun', p.municipio))}${p.ja ? chip('ja:' + p.ja, p.ja) : ''}${chip('dl:' + p.distrito_l, 'Distrito local ' + p.distrito_l)}${chip('df:' + p.distrito_f, 'Distrito federal ' + p.distrito_f)}</div>`
      + (cols.length ? `<div class="chips">${cols.slice(0, 10).map(c => chip('col:' + c, GEO.colonias.byId[c].properties.nombre)).join('')}${cols.length > 10 ? `<span class="chip static">y ${cols.length - 10} colonias más</span>` : ''}</div>` : ''); }
  if (u === 'col') { const p = GEO.colonias.byId[key].properties;
    return `<div class="chips"><span class="chip static">CP ${esc(p.cp)}</span>${chip('mun:' + p.municipio, unitName('mun', p.municipio))}${p.ja ? chip('ja:' + p.ja, p.ja) : ''}${p.secs.map(s => chip('sec:' + s, 'Sección ' + s)).join('')}</div>`; }
  if (u === 'mun') { const mm = CAT.municipios.find(x => x.id === key), tags = [];
    if (key === 115) tags.push('Capital'); else if (mm && mm.det) tags.push('Conurbado'); if (mm && mm.zm) tags.push('Zona metropolitana');
    return `<div class="chips">${tags.map(t => `<span class="chip static">${t}</span>`).join('')}${DETOK.includes(key) && S.vista !== 'sec' ? `<button class="chip" data-secs="${key}">Ver sus secciones</button>` : ''}</div>`; }
  return '';
}
function notes(u, a) {
  const m = ELS[S.el], out = [];
  if (u === 'sec' && !a.n) out.push(`Esta sección se creó después de ${m.anio}. Sus votos de esa elección están en el total del municipio, en la sección de la que se separó.`);
  if (u === 'col') out.push('Una colonia no es unidad electoral: la cifra suma completas las secciones que la cubren.');
  if (u === 'ja' && a.nx) out.push(`Incluye ${fmt(a.tx)} votos de ${a.nx} secciones que el INE dividió después de ${m.anio}.`);
  if ((u === 'dl' || u === 'df') && m.cobertura_distritos < .99) out.push(`Distrito con su trazo vigente; cubre ${Math.round(m.cobertura_distritos * 100)} % de los votos de ${m.anio}, el resto fue en secciones que ya no existen.`);
  return out.map(t => `<div class="note">${esc(t)}</div>`).join('');
}
function renderPanel() {
  const { u, key } = current(), m = ELS[S.el], a = agg(u, key, S.el), w = verdict(S.el, a);
  const crumb = S.sel ? `<div class="crumb"><button id="back">${esc(unitName(S.foco.u, S.foco.key))}</button><span>›</span><span>${esc(VK(S.sel.u).l)}</span></div>` : `<div class="crumb">${esc(m.cargo)} · ${m.anio}</div>`;
  let h = `<div class="ph">${crumb}<h2>${esc(unitName(u, key))}</h2><div class="acts-top"><button class="btn pri" id="btn-deck">${ICON_DECK}Presentación</button></div></div>`;
  if (a.n && a.t) {
    h += `<div class="kpis"><div class="kpi"><div class="v" ${a.ln ? `data-n="${a.ln}"` : ''}>${a.ln ? '0' : '—'}</div><div class="k">Lista nominal ${m.anio}</div></div><div class="kpi"><div class="v" data-n="${a.t}">0</div><div class="k">Votos</div></div><div class="kpi"><div class="v" ${a.ln ? `data-n="${pct(a.t, a.ln).toFixed(1)}" data-d="1" data-s=" %"` : ''}>${a.ln ? '0' : '—'}</div><div class="k">Participación</div></div></div>`;
    if (w) { const who = personFor(S.el, u, key, w.c);
      h += `<div class="win"><span class="bar" style="background:${candColor(w.c)}"></span><div>${w.tie ? '<div class="who-n">Empate</div>' : `<small>Ganó</small><div class="who-n">${esc(who || candLabel(w.c))}</div><small>${who ? esc(candLabel(w.c)) + ' · ' : ''}${p1(w.share)} · ventaja de ${w.margin.toFixed(1)} puntos sobre ${esc(shortCand(w.second || ''))}</small>`}</div></div>`; }
    h += card('res', 'Resultados', (S.partes === 'cand' ? `<div class="res-grid">${donut(S.el, a, u, key, 170)}${bars(S.el, a, u, key, 'cand', { hideWin: true, short: true })}</div>` : columns(S.el, a)) + (S.partes === 'part' ? '<div class="src">Votos marcados solo con el logo de cada partido. Los votos a varios logos de una coalición cuentan para la candidatura.</div>' : ''),
      { extra: `<span class="tabs" id="partes"><button data-p="cand" class="${S.partes === 'cand' ? 'on' : ''}">Candidatura</button><button data-p="part" class="${S.partes === 'part' ? 'on' : ''}">Partido</button></span>` });
    const cm = compare(u, key);
    if (!cm) h += seatsCard();
    if (cm) { const opts = CAT.elecciones.filter(e => e.id !== S.el).sort((x, y) => (cargoBase(x.cargo) === cargoBase(m.cargo) ? 0 : 1) - (cargoBase(y.cargo) === cargoBase(m.cargo) ? 0 : 1) || y.anio - x.anio);
      h += seatsCard();
      h += card('cmp', '¿Qué cambió?', cm.html, { extra: `<select class="cmp-sel" id="cmp-sel" aria-label="Elección para comparar">${opts.map(e => `<option value="${e.id}" ${e.id === cm.c.id ? 'selected' : ''}>${e.anio} · ${esc(cargoBase(e.cargo))}</option>`).join('')}</select>` }); }
  } else if (u !== 'sec') h += `<div class="note">No hubo elección de ${esc(m.cargo.toLowerCase())} en ${m.anio} aquí.</div>`;
  h += notes(u, a) + context(u, key);
  const tr = trend(u, key); if (tr) h += card('tr', `${esc(cargoBase(m.cargo))} · cómo ha cambiado`, tr);
  const P = padron(u, key); if (P) h += card('pad', `Lista nominal hoy · ${fmt(P[1])}`, pyramid(P) + `<div class="src">Padrón ${fmt(P[0])} · corte ${esc(CAT.padron.corte)}</div>`);
  if (!S.sel && EST._afi) h += card('afi', 'Afiliados a partidos en Puebla', afiliados() + '<div class="src">Total estatal; no hay desglose por municipio.</div>');
  h += `<div class="src">Fuente: ${esc(m.fuente)}, ${m.anio}. ${esc(CAT.fuentes.cartografia)}.${P ? ' ' + esc(CAT.padron.fuente) + '.' : ''}${!S.sel && EST._afi ? ' ' + esc(CAT.afiliados.fuente) + '.' : ''}</div>`;
  const B = $('#pbody'); B.innerHTML = h; B.scrollTop = 0; animate(B);
  const back = $('#back'); if (back) back.onclick = () => select(null);
  $$('#partes button').forEach(b => b.onclick = () => { S.partes = b.dataset.p; renderPanel(); });
  $$('[data-go]').forEach(b => b.onclick = () => { const [v, k] = b.dataset.go.split(/:(.*)/s); goTo(v, k); });
  $$('[data-secs]').forEach(b => b.onclick = () => { const k = +b.dataset.secs; S.foco = { u: 'mun', key: k }; setVista('sec', true); select({ u: 'mun', key: k }); fitGeom(geomOf('mun', k)); });
  $$('[data-zoom]').forEach(b => b.onclick = () => expand(b.dataset.zoom));
  $$('#pbody [data-mun]').forEach(r => r.onclick = () => goTo('mun', r.dataset.mun));
  const cs = $('#cmp-sel'); if (cs) cs.onchange = () => { S.cmp = cs.value; if (S.modo === 'cambio') paint(); else renderPanel(); };
  $('#btn-deck').onclick = openDeck;
  peekSize();
}
function expand(id) {
  const { u, key } = current(), m = ELS[S.el], a = agg(u, key, S.el), name = unitName(u, key);
  let t = '', b = '';
  if (id === 'res') { t = 'Resultados'; b = `<div class="mgrid"><div><h4 class="src">Por candidatura</h4>${donut(S.el, a, u, key, 240)}${bars(S.el, a, u, key, 'cand')}</div><div><h4 class="src">Por partido (votos con su logo)</h4>${columns(S.el, a, 460, 260)}</div></div>`; }
  if (id === 'cmp') { const c = compare(u, key, 760, 380); t = `¿Qué cambió entre ${c.c.anio} y ${m.anio}?`; b = c.html; }
  if (id === 'seats') { t = 'En todo el estado'; b = seatsCard(true); }
  if (id === 'tr') { t = `${cargoBase(m.cargo)} · cómo ha cambiado`; b = trend(u, key, 760, 340); }
  if (id === 'pad') { const P = padron(u, key); t = 'Lista nominal por edad y sexo'; b = `<div class="kpis"><div class="kpi"><div class="v" data-n="${P[0]}">0</div><div class="k">Padrón</div></div><div class="kpi"><div class="v" data-n="${P[1]}">0</div><div class="k">Lista nominal</div></div><div class="kpi"><div class="v" data-n="${pct(P[3], P[1]).toFixed(1)}" data-d="1" data-s=" %">0</div><div class="k">Mujeres</div></div></div>${pyramid(P)}<div class="src">Corte ${esc(CAT.padron.corte)}. ${esc(CAT.padron.fuente)}.</div>`; }
  if (id === 'afi') { t = 'Afiliados a partidos en Puebla'; b = afiliados() + `<div class="src">${esc(CAT.afiliados.fuente)}.</div>`; }
  openModal(`<h3 id="mtitle">${esc(t)}</h3><p class="msub">${esc(name)} · ${esc(m.cargo)} ${m.anio}</p>${b}`);
}
function openModal(html) { const M = $('#modal'); $('#mbody').innerHTML = html; M.hidden = false; animate(M); const close = () => M.hidden = true; $('#mclose').onclick = close; M.onclick = e => { if (e.target === M) close(); }; }
function showUsers() {
  const U = MB.admin.usuarios;
  openModal(`<h3 id="mtitle">Usuarios</h3><p class="msub">Se administran en el Excel de usuarios; al correr pipeline/acceso.py se vuelven a cifrar los accesos.</p><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Nivel</th><th>Ámbito</th></tr></thead><tbody>${U.map(u => `<tr><td>${esc(u.usuario)}</td><td>${esc(u.nombre)}</td><td>${esc(u.nivel)}</td><td>${esc(u.ambito || 'Todo')}</td></tr>`).join('')}</tbody></table>`);
}

/* =================== PRESENTACIÓN =================== */
let DECK = 0, DECK_KEY = null, DECK_FIT = null;
function openDeck() {
  const { u, key } = current(), m = ELS[S.el], a = agg(u, key, S.el), w = verdict(S.el, a), name = unitName(u, key), P = padron(u, key), cm = a.t ? compare(u, key) : null;
  let snap = ''; try { snap = map.getCanvas().toDataURL('image/jpeg', .85); } catch {}
  const who = w ? personFor(S.el, u, key, w.c) : null, foot = `<div class="s-foot">Fuente: ${esc(m.fuente)}, ${m.anio}. ${esc(CAT.fuentes.cartografia)}.</div>`;
  const head = (eb, t) => `<div><div class="s-eyebrow">${esc(eb)}</div><h2>${esc(t)}</h2></div>`;
  const sl = [];
  sl.push(`<div class="slide cover"><div class="cv-img" style="background-image:url(${snap})"></div><div class="cv-txt"><div class="s-eyebrow">${esc(m.cargo)} · ${m.anio}</div><h1>${esc(name)}</h1>${w ? `<div class="big-win">Ganó <b>${esc(who || candLabel(w.c))}</b>${who ? ' · ' + esc(shortCand(w.c)) : ''} con ${p1(w.share)}</div>` : ''}</div></div>`);
  if (a.t) sl.push(`<div class="slide">${head(name, 'Datos generales')}<div class="s-body"><div class="kpis"><div class="kpi"><div class="v">${a.ln ? fmt(a.ln) : '—'}</div><div class="k">Lista nominal ${m.anio}</div></div><div class="kpi"><div class="v">${fmt(a.t)}</div><div class="k">Votos emitidos</div></div><div class="kpi"><div class="v">${a.ln ? p1(pct(a.t, a.ln)) : '—'}</div><div class="k">Participación</div></div><div class="kpi"><div class="v">${w ? w.margin.toFixed(1) + ' pts' : '—'}</div><div class="k">Ventaja del primer lugar</div></div></div>
    ${P ? `<div class="two"><div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><div class="v">${fmt(P[1])}</div><div class="k">Lista nominal hoy</div></div><div class="kpi"><div class="v">${p1(pct(P[3], P[1]))}</div><div class="k">Mujeres en la lista</div></div></div>${pyramid(P)}</div>` : ''}</div>${foot}</div>`);
  if (a.t) sl.push(`<div class="slide">${head(name + ' · ' + m.anio, 'Resultados por candidatura')}<div class="s-body"><div class="two" style="grid-template-columns:360px 1fr">${donut(S.el, a, u, key, 340)}${bars(S.el, a, u, key, 'cand')}</div></div>${foot}</div>`);
  const st = seats(); if (st) sl.push(`<div class="slide">${head('Estado de Puebla · ' + m.anio, st.title)}<div class="s-body"><div class="two"><div>${seatsChart(st, 560)}</div><div><p class="frase" style="font-size:24px">${st.veredicto}</p><div class="lgd" style="font-size:18px">${st.order.map(p => `<span><i style="background:${pcol(p)};width:22px;height:8px"></i>${esc(p)} ${st.cnt[p]}</span>`).join('')}</div></div></div></div>${foot}</div>`);
  if (a.t) sl.push(`<div class="slide">${head(name + ' · ' + m.anio, 'Votos por partido')}<div class="s-body">${columns(S.el, a, 1160, 440)}</div>${foot}</div>`);
  const cmb = a.t ? compare(u, key, 1160, 400) : null; if (cmb) sl.push(`<div class="slide">${head(name, `¿Qué cambió entre ${cmb.c.anio} y ${m.anio}?`)}<div class="s-body">${cmb.html}</div>${foot}</div>`);
  const tr = trend(u, key, 1160, 430); if (tr) sl.push(`<div class="slide">${head(name, cargoBase(m.cargo) + ' · cómo ha cambiado')}<div class="s-body">${tr}</div>${foot}</div>`);
  if (EST._afi && (u === 'mun' || u === 'est')) sl.push(`<div class="slide">${head('Estado de Puebla', 'Afiliados a partidos')}<div class="s-body">${afiliados()}</div><div class="s-foot">${esc(CAT.afiliados.fuente)}.</div></div>`);
  const D = $('#deck'), ST = $('#deck-stage'); ST.innerHTML = sl.join(''); D.hidden = false; DECK = 0;
  const slides = [...ST.querySelectorAll('.slide')];
  const fitS = () => { const r = ST.getBoundingClientRect(), k = Math.min((r.width - 24) / 1280, (r.height - 24) / 720); slides.forEach(s => s.style.transform = `translate(-50%,-50%) scale(${k})`); };
  const go = i => { DECK = Math.max(0, Math.min(slides.length - 1, i)); slides.forEach((s, j) => s.classList.toggle('on', j === DECK)); $('#deck-n').textContent = `${DECK + 1} / ${slides.length}`; animate(slides[DECK]); };
  fitS(); go(0);
  $('#deck-prev').onclick = () => go(DECK - 1); $('#deck-next').onclick = () => go(DECK + 1);
  if (DECK_KEY) window.removeEventListener('keydown', DECK_KEY); if (DECK_FIT) window.removeEventListener('resize', DECK_FIT);
  DECK_KEY = e => { if (D.hidden) return; if (e.key === 'ArrowRight' || e.key === ' ') go(DECK + 1); else if (e.key === 'ArrowLeft') go(DECK - 1); else if (e.key === 'Escape') D.hidden = true; };
  DECK_FIT = fitS; window.addEventListener('keydown', DECK_KEY); window.addEventListener('resize', fitS);
  $('#deck-x').onclick = () => { D.hidden = true; };
  $('#deck-pdf').onclick = () => { slides.forEach(s => s.querySelectorAll('[data-w]').forEach(el => el.style.width = el.dataset.w + '%')); window.print(); };
  let x0 = null; ST.ontouchstart = e => x0 = e.touches[0].clientX; ST.ontouchend = e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(DECK + (dx < 0 ? 1 : -1)); x0 = null; };
}

/* =================== NAVEGACIÓN =================== */
const keyOf = (u, k) => u === 'ja' ? k : Number(k);
function select(sel) {
  S.sel = sel;
  const v = VK(S.vista), on = sel && sel.u === S.vista;
  for (const id of ['sel-sh', 'sel']) if (map.getLayer(id)) map.removeLayer(id);
  const flt = ['==', ['get', v.id], on ? sel.key : '__none__'];
  addL({ id: 'sel-sh', type: 'line', source: 'g-' + v.geo, filter: flt, paint: { 'line-color': '#000000', 'line-width': 11, 'line-opacity': .35, 'line-blur': 7, 'line-translate': [0, 2] } });
  addL({ id: 'sel', type: 'line', source: 'g-' + v.geo, filter: flt, layout: { 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': 4.5 } });
  highlight(); renderPanel();
  if (sel && isMobile()) $('#panel').dataset.state = 'open';
}
function geomOf(u, key) { const v = VK(u); const f = GEO[v.geo].features.find(f => f.properties[v.id] === key); return f && f.geometry; }
function bbox(geom) { let x0 = 180, y0 = 90, x1 = -180, y1 = -90; const walk = c => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); }; walk(geom.coordinates || geom); return [[x0, y0], [x1, y1]]; }
function fitGeom(geom, dur = 700) {
  if (!geom) return;
  const mob = isMobile(), wide = map.getContainer().clientWidth > 900;
  map.fitBounds(bbox(geom), { padding: { top: mob ? 90 : 40, left: wide ? 340 : 40, right: 40, bottom: mob ? window.innerHeight * 0.3 : 40 }, maxZoom: 15.5, duration: dur });
}
function focusMun(k) { S.foco = { u: 'mun', key: k }; syncVistaAvail(); hero(); }
function goTo(u, k) {
  const key = keyOf(u, k);
  if (u === 'mun') { focusMun(key); if (VK(S.vista).det && !DETOK.includes(key)) setVista('mun', true); select({ u: 'mun', key }); fitGeom(geomOf('mun', key)); return; }
  if (u === 'dl' || u === 'df') { if (S.vista !== u) setVista(u, true); select({ u, key }); fitGeom(geomOf(u, key)); return; }
  const m = munOfUnit(u, key); if (m != null) focusMun(m);
  if (S.vista !== u) setVista(u, true);
  select({ u, key }); fitGeom(geomOf(u, key));
}
function goHome() { CAPAS.alcance = 'foco'; store.set('pe_capas2', CAPAS); $$('[data-alc]').forEach(x => x.classList.toggle('on', x.dataset.alc === 'foco')); S.foco = { u: HOME.u, key: HOME.key }; S.sel = null; setVista(HOME.vista, true); select(null); fitGeom(geomOf(HOME.u, HOME.key)); }
function setVista(k, keepSel) {
  S.vista = k; if (!keepSel) S.sel = null;
  for (const x of VISTAS) { if (x.k === 'mun') continue; const on = x.k === k; for (const p of ['f-', 'l-', 't-']) if (map.getLayer(p + x.geo)) map.setLayoutProperty(p + x.geo, 'visibility', on ? 'visible' : 'none'); }
  map.setLayoutProperty('f-municipios', 'visibility', CAPAS.estado || k === 'mun' ? 'visible' : 'none');
  $$('#vistas button').forEach(b => b.classList.toggle('on', b.dataset.v === k));
  syncVistaAvail();
  paint(); labels();
  if (!keepSel) select(null); else select(S.sel);
}
function syncVistaAvail() {
  const m = S.foco.u === 'mun' ? S.foco.key : null;
  $$('#vistas button').forEach(b => { const v = b.dataset.v; b.disabled = (v === 'ja' && !(m === 115 && DETOK.includes(115))) || (v === 'col' && !(m != null && CAT.detalle.includes(m) && DETOK.includes(m))) || (v === 'sec' && !DETOK.length); });
}
function setEl(eid) {
  const prev = S.modo; S.el = eid; S.cmp = null;
  if (!['win', 'part', 'cambio'].includes(prev)) S.modo = ELS[eid].cand.find(c => leadOf(c) === leadOf(prev)) || 'win';
  syncElControls(); fillModo(); paint();
}

/* =================== CONTROLES =================== */
function syncElControls() {
  const m = ELS[S.el], cargo = cargoBase(m.cargo);
  $('#cargo').value = cargo;
  const years = [...new Set(CAT.elecciones.map(e => e.anio))].sort((a, b) => a - b);
  $('#anios').innerHTML = years.map(y => { const es = CAT.elecciones.filter(e => e.anio === y && cargoBase(e.cargo) === cargo); if (!es.length) return `<button disabled title="No hubo elección de ${esc(cargo.toLowerCase())} en ${y} o no hay datos">${y}</button>`;
    return es.map(e => `<button data-el="${e.id}" class="${e.id === S.el ? 'on' : ''}" title="${esc(e.cargo)} ${e.anio}">${e.anio}${e.cargo.includes('extra') ? '*' : ''}</button>`).join(''); }).join('');
  $$('#anios button').forEach(b => b.onclick = () => setEl(b.dataset.el));
  const on = $('#anios .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function fillModo() {
  const m = ELS[S.el], tops = m.cand.filter(c => !c.startsWith('CAND_IND')).slice(0, 6), p = prevOf(S.el);
  $('#modo').innerHTML = `<option value="win">Quién ganó</option><option value="part">Participación</option>${p ? `<option value="cambio">Cambio de ganador vs ${p.anio}</option>` : ''}<optgroup label="Votación de…">${tops.map(c => `<option value="${c}">${esc(candLabel(c))}</option>`).join('')}</optgroup>`;
  if (!['win', 'part', ...(p ? ['cambio'] : []), ...tops].includes(S.modo)) S.modo = 'win';
  $('#modo').value = S.modo;
}
function buildControls() {
  $('#cargo').innerHTML = CARGOS.map(c => { const ys = CAT.elecciones.filter(e => cargoBase(e.cargo) === c).map(e => e.anio); return `<option value="${c}">${c} · ${Math.min(...ys)}–${Math.max(...ys)}</option>`; }).join('');
  $('#cargo').onchange = e => { const last = CAT.elecciones.filter(x => cargoBase(x.cargo) === e.target.value && !x.cargo.includes('extra')).sort((a, b) => b.anio - a.anio)[0]; setEl(last.id); };
  $('#vistas').innerHTML = VISTAS.map(v => `<button data-v="${v.k}" class="${v.k === S.vista ? 'on' : ''}">${v.l}</button>`).join('');
  $$('#vistas button').forEach(b => b.onclick = () => { const k = b.dataset.v; setVista(k); if (VK(k).det) fitGeom(geomOf(S.foco.u, S.foco.key)); });
  $('#modo').onchange = e => { S.modo = e.target.value; paint(); };
  syncElControls(); fillModo();
  const C = $('#capas'), btn = $('#btn-capas');
  C.innerHTML = `<div class="grp"><h4>Ver a color</h4><div class="tabs alc" id="alcance">${[['foco', unitName(HOME.u, HOME.key)], ['zm', 'Zona metropolitana'], ['todo', 'Todo el estado']].map(([k, l]) => `<button data-alc="${k}" class="${CAPAS.alcance === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div></div>
    <div class="grp"><h4>Capas</h4>${CAPAS_DEF.map(([k, l, , sw]) => `<label class="tg"><input type="checkbox" data-capa="${k}" ${CAPAS[k] ? 'checked' : ''}>${l}${sw ? `<span class="sw-line" style="border-color:${LINE_COL[sw]}"></span>` : ''}</label>`).join('')}</div>`;
  $$('[data-alc]').forEach(b => b.onclick = () => { CAPAS.alcance = b.dataset.alc; store.set('pe_capas2', CAPAS); $$('[data-alc]').forEach(x => x.classList.toggle('on', x === b));
    if (CAPAS.alcance === 'foco') goHome(); else { S.sel = null; select(null); fitGeom(CAPAS.alcance === 'zm' ? GEO.zm.features[0].geometry : GEO.estado_bbox); } labels(); });
  btn.onclick = () => { const o = C.hidden; C.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
  $$('[data-capa]').forEach(i => i.onchange = () => { CAPAS[i.dataset.capa] = i.checked; store.set('pe_capas2', CAPAS); applyCapas(); });
  $('#who').innerHTML = `<b>${esc(PERFIL.nombre)}</b> · ${esc(PERFIL.nivel_n)}${PERFIL.ambito ? ' ' + esc(PERFIL.ambito) : ''}`;
  $('#btn-out').onclick = () => { sess.del('pe_s'); location.reload(); };
  if (MB.admin) { $('#btn-users').hidden = false; $('#btn-users').onclick = showUsers; }
  $('#home-l').textContent = 'Volver a ' + unitName(HOME.u, HOME.key);
  $('#btn-home').onclick = goHome;
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#deck').hidden) { if (!$('#modal').hidden) $('#modal').hidden = true; else if (S.sel) select(null); } });
}
function applyCapas() {
  const vis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  vis('f-municipios', CAPAS.estado || S.vista === 'mun'); vis('l-municipios', CAPAS.estado || S.vista === 'mun');
  vis('zm-l', CAPAS.zm); vis('det-l', CAPAS.conurb); vis('cap-l', CAPAS.conurb); vis('cap-glow', CAPAS.conurb);
  vis('dl-o', CAPAS.dl); vis('df-o', CAPAS.df);
  for (const id of BASE_IDS) if (!/label|place|poi|name|road_shield|housenumber/.test(id) || true) vis(id, CAPAS.base);
  labels();
}

/* =================== BÚSQUEDA =================== */
let SEARCH = [];
function buildSearch() {
  for (const m of CAT.municipios) SEARCH.push({ t: m.n, s: norm(m.n), k: 'mun', id: m.id, h: m.id === 115 ? 'Capital' : m.det ? 'Conurbado' : m.zm ? 'Zona metropolitana' : 'Municipio' });
  for (const f of GEO.secciones.features) SEARCH.push({ t: 'Sección ' + f.properties.seccion, s: String(f.properties.seccion), k: 'sec', id: f.properties.seccion, h: MUNN[f.properties.municipio] });
  for (const f of GEO.colonias.features) SEARCH.push({ t: f.properties.nombre, s: norm(f.properties.nombre) + ' ' + f.properties.cp, k: 'col', id: f.properties.cid, h: MUNN[f.properties.municipio] + ' · CP ' + f.properties.cp });
  for (const f of GEO.juntas.features) SEARCH.push({ t: f.properties.ja, s: norm(f.properties.ja), k: 'ja', id: f.properties.ja, h: 'Junta auxiliar' });
  for (const f of GEO.dl.features) SEARCH.push({ t: 'Distrito local ' + f.properties.distrito_l, s: 'distrito local ' + f.properties.distrito_l + ' dl' + f.properties.distrito_l, k: 'dl', id: f.properties.distrito_l, h: '' });
  for (const f of GEO.df.features) SEARCH.push({ t: 'Distrito federal ' + f.properties.distrito_f, s: 'distrito federal ' + f.properties.distrito_f + ' df' + f.properties.distrito_f, k: 'df', id: f.properties.distrito_f, h: '' });
  const q = $('#q'), ul = $('#qres'); let hits = [], on = 0;
  const show = () => { ul.innerHTML = hits.map((x, i) => `<li><button data-i="${i}" class="${i === on ? 'on' : ''}"><span>${esc(x.t)}</span><small>${esc(x.h || '')}</small></button></li>`).join(''); ul.hidden = !hits.length; ul.querySelectorAll('button').forEach(b => b.onmousedown = e => { e.preventDefault(); pick(hits[+b.dataset.i]); }); };
  const pick = x => { ul.hidden = true; q.value = ''; q.blur(); goTo(x.k, x.id); };
  q.oninput = () => { const v = norm(q.value.trim()); if (!v) { hits = []; show(); return; } const isNum = /^\d+$/.test(v);
    hits = SEARCH.filter(x => isNum ? (x.k === 'sec' ? x.s.startsWith(v) : x.s.includes(v)) : x.s.includes(v)).sort((a, b) => (a.s.startsWith(v) ? 0 : 1) - (b.s.startsWith(v) ? 0 : 1) || (a.k === 'mun' ? -1 : 0) - (b.k === 'mun' ? -1 : 0) || a.t.length - b.t.length).slice(0, 12); on = 0; show(); };
  q.onkeydown = e => { if (e.key === 'ArrowDown') { on = Math.min(on + 1, hits.length - 1); show(); e.preventDefault(); } else if (e.key === 'ArrowUp') { on = Math.max(on - 1, 0); show(); e.preventDefault(); } else if (e.key === 'Enter' && hits[on]) pick(hits[on]); else if (e.key === 'Escape') ul.hidden = true; };
  q.onblur = () => setTimeout(() => ul.hidden = true, 120);
}

/* =================== HOJA INFERIOR (CELULAR) =================== */
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
function peekSize() { if (!isMobile()) return; const P = $('#panel'), ph = P.querySelector('.ph'), w = P.querySelector('.win'); let hgt = 22 + (ph ? ph.offsetHeight : 60) + 8; if (w) hgt += w.offsetHeight + 14; document.documentElement.style.setProperty('--peek', Math.min(hgt, 240) + 'px'); }
function sheet() {
  const P = $('#panel'), g = $('#grip'); g.onclick = () => { P.dataset.state = P.dataset.state === 'open' ? 'peek' : 'open'; };
  let y0 = null; g.addEventListener('pointerdown', e => { y0 = e.clientY; });
  window.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (Math.abs(dy) > 30) P.dataset.state = dy < 0 ? 'open' : 'peek'; });
  P.querySelector('.pbody').addEventListener('click', e => { if (isMobile() && P.dataset.state === 'peek' && !e.target.closest('button,select')) P.dataset.state = 'open'; });
  window.addEventListener('resize', peekSize);
}

/* =================== MAPA =================== */
let LABELS = [];
function centroid(geom) { const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates; let best = null, ba = -1;
  for (const p of polys) { const r = p[0]; let a = 0, cx = 0, cy = 0; for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const f = r[k][0] * r[i][1] - r[i][0] * r[k][1]; a += f; cx += (r[k][0] + r[i][0]) * f; cy += (r[k][1] + r[i][1]) * f; } if (Math.abs(a) > ba) { ba = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } }
  return { c: best, a: ba }; }
function labels() {
  LABELS.forEach(L => L.m.remove()); LABELS = [];
  const add = (c, text, cls, a) => { const el = document.createElement('div'); el.className = 'mlabel ' + cls; el.textContent = text; LABELS.push({ m: new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map), a, el }); };
  if (S.vista === 'ja') for (const f of GEO.juntas.features) { const { c, a } = centroid(f.geometry); add(c, f.properties.ja, '', a); }
  const dist = S.vista === 'dl' || S.vista === 'df' ? S.vista : (CAPAS.dl ? 'dl' : CAPAS.df ? 'df' : null);
  if (dist) for (const f of GEO[dist].features) { const k = f.properties[dist === 'dl' ? 'distrito_l' : 'distrito_f']; const { c, a } = centroid(f.geometry); add(c, (dist === 'dl' ? 'DL ' : 'DF ') + k, 'big dist', a + 1); }
  if (S.vista !== 'ja') for (const f of GEO.municipios.features) { const p = f.properties; const { c, a } = centroid(f.geometry); add(c, p.municipio === 115 ? 'Puebla' : p.nombre, p.det ? 'big' : '', a + (p.municipio === 115 ? 3 : p.det ? 1 : 0)); }
  LABELS.sort((x, y) => y.a - x.a); declutter();
}
function declutter() {
  const placed = [], z = map.getZoom();
  for (const L of LABELS) { const el = L.el; el.style.visibility = 'visible';
    const small = !el.classList.contains('big') && z < (CAPAS.alcance === 'todo' ? 7 : 9.6), r = el.getBoundingClientRect(), pad = 6;
    if (small || r.width === 0 || placed.some(p => r.left < p.right + pad && r.right > p.left - pad && r.top < p.bottom + pad && r.bottom > p.top - pad)) el.style.visibility = 'hidden'; else placed.push(r); }
}
function initMap() {
  const blank = { version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': cssVar('--mapbg') } }] };
  const make = style => {
    map = new maplibregl.Map({ container: 'map', style, center: [-98.2, 19.04], zoom: 10, minZoom: 6.5, maxZoom: 17.5, dragRotate: false, pitchWithRotate: false, touchPitch: false, preserveDrawingBuffer: true,
      attributionControl: { compact: true, customAttribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · Cartografía electoral INE' } });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.touchZoomRotate.disableRotation();
  };
  return new Promise(res => {
    let done = false;
    const ok = base => { if (done) return; done = true; BASE_OK = base; const L = map.getStyle().layers; FIRST_SYMBOL = (L.find(l => l.type === 'symbol') || {}).id; BASE_IDS = base ? L.map(l => l.id) : []; res(); };
    let fell = false;
    const fallback = () => { if (done || fell) return; fell = true; try { map.remove(); } catch {} make(blank); map.once('load', () => ok(false)); };
    make(BASE_STYLE); map.once('load', () => ok(true));
    // sin acceso al mapa base: fondo liso, todo lo demás funciona igual
    map.once('error', () => { if (!map.isStyleLoaded()) fallback(); });
    setTimeout(fallback, 8000);
  });
}
function addLayers() {
  const nores = cssVar('--nores'), src = (id, data, promote) => map.addSource(id, Object.assign({ type: 'geojson', data }, promote ? { promoteId: promote } : {}));
  for (const v of VISTAS) src('g-' + v.geo, GEO[v.geo], v.id);
  src('g-zm', GEO.zm);
  const fillPaint = () => ({ 'fill-color': ['coalesce', ['feature-state', 'c'], nores], 'fill-color-transition': { duration: 500 }, 'fill-opacity-transition': { duration: 450 }, 'fill-opacity': .85 });
  const W = (a, b, c) => ['interpolate', ['linear'], ['zoom'], 8, a, 11, b, 15, c];
  addL({ id: 'f-municipios', type: 'fill', source: 'g-municipios', paint: fillPaint() });
  for (const v of VISTAS.filter(v => v.k !== 'mun')) addL({ id: 'f-' + v.geo, type: 'fill', source: 'g-' + v.geo, layout: { visibility: 'none' }, paint: fillPaint() });
  const cv = document.createElement('canvas'); cv.width = cv.height = 8; const cx = cv.getContext('2d');
  cx.strokeStyle = 'rgba(110,120,115,.6)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(0, 8); cx.lineTo(8, 0); cx.moveTo(-2, 2); cx.lineTo(2, -2); cx.moveTo(6, 10); cx.lineTo(10, 6); cx.stroke();
  map.addImage('trama', { width: 8, height: 8, data: cx.getImageData(0, 0, 8, 8).data });
  for (const v of VISTAS.filter(v => v.det)) addL({ id: 't-' + v.geo, type: 'fill', source: 'g-' + v.geo, layout: { visibility: 'none' }, filter: ['==', ['get', v.id], '__none__'], paint: { 'fill-pattern': 'trama', 'fill-opacity': .7 } });
  // divisiones: líneas sólidas; blancas entre unidades, gris institucional entre municipios
  for (const v of VISTAS.filter(v => v.k !== 'mun')) addL({ id: 'l-' + v.geo, type: 'line', source: 'g-' + v.geo, layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': v.det ? W(.3, 1, 2) : W(1.4, 2.2, 3.2), 'line-opacity-transition': { duration: 450 } } });
  addL({ id: 'l-municipios', type: 'line', source: 'g-municipios', layout: { 'line-join': 'round' }, paint: { 'line-color': '#828386', 'line-width': W(.8, 1.6, 2.6), 'line-opacity-transition': { duration: 450 } } });
  addL({ id: 'dl-o', type: 'line', source: 'g-dl', layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL.dl, 'line-width': W(1.6, 2.6, 3.6) } });
  addL({ id: 'df-o', type: 'line', source: 'g-df', layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL.df, 'line-width': W(1.6, 2.6, 3.6) } });
  addL({ id: 'zm-l', type: 'line', source: 'g-zm', layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL.zm, 'line-width': W(1.6, 2.4, 3.2) } });
  addL({ id: 'det-l', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'det'], true], layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL.det, 'line-width': W(1.4, 2.4, 3.2) } });
  addL({ id: 'cap-glow', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'municipio'], 115], paint: { 'line-color': '#000000', 'line-width': W(6, 10, 14), 'line-opacity': .18, 'line-blur': 6 } });
  addL({ id: 'cap-l', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'municipio'], 115], layout: { 'line-join': 'round' }, paint: { 'line-color': '#4A5350', 'line-width': W(2, 3.2, 4.2) } });
  map.on('moveend', declutter);
  let hov = null; const tip = $('#tip');
  const clearHov = () => { if (hov) map.setFeatureState(hov, { h: false }); hov = null; };
  const hit = e => { const v = VK(S.vista); let f = map.queryRenderedFeatures(e.point, { layers: ['f-' + v.geo] })[0]; if (f) return { v, f };
    if (map.getLayoutProperty('f-municipios', 'visibility') !== 'none') { f = map.queryRenderedFeatures(e.point, { layers: ['f-municipios'] })[0]; if (f) return { v: VK('mun'), f }; } return null; };
  map.on('mousemove', e => {
    const h = hit(e); if (!h) { clearHov(); tip.hidden = true; map.getCanvas().style.cursor = ''; return; }
    const { v, f } = h, id = f.properties[v.id];
    if (!hov || hov.id !== id || hov.source !== 'g-' + v.geo) { clearHov(); hov = { source: 'g-' + v.geo, id }; map.setFeatureState(hov, { h: true }); }
    map.getCanvas().style.cursor = 'pointer'; if (isMobile()) return;
    const u = v.k === 'mun' ? MUNAGG[id] : AGG[id], w = u && u.w, mm = v.k === 'sec' ? f.properties.municipio : null;
    tip.innerHTML = `<b>${esc(unitName(v.k, id))}</b>${mm && mm !== S.foco.key ? `<span class="m">${esc(MUNN[mm])} · toca para ver sus secciones</span><br>` : v.k === 'mun' && S.vista !== 'mun' ? '<span class="m">Toca para ver sus secciones</span><br>' : ''}${w ? (w.tie ? 'Empate' : `${esc(candLabel(w.c))} · ${p1(w.share)}`) + (u.a.ln ? `<br><span class="m">Participación ${p1(pct(u.a.t, u.a.ln))}</span>` : '') : `<span class="m">${v.k === 'sec' ? 'Sección creada después de esta elección' : 'Sin resultados en esta elección'}</span>`}`;
    tip.hidden = false; const Wd = map.getContainer().clientWidth; tip.style.left = Math.min(e.point.x + 14, Wd - 270) + 'px'; tip.style.top = (e.point.y + 14) + 'px';
  });
  map.on('mouseout', () => { clearHov(); tip.hidden = true; });
  map.on('click', e => {
    const h = hit(e); if (!h) { select(null); return; }
    const { v, f } = h, id = f.properties[v.id];
    const openMun = mm => { focusMun(mm); if (DETOK.includes(mm) && S.vista !== 'sec' && !(S.vista === 'col' && CAT.detalle.includes(mm))) setVista('sec', true); select({ u: 'mun', key: mm }); fitGeom(geomOf('mun', mm)); };
    if (v.det) { const mm = v.k === 'sec' ? f.properties.municipio : munOfUnit(v.k, id);
      // primer toque en otro municipio: se acerca y muestra sus secciones; el siguiente abre la sección
      if (S.foco.u === 'mun' && mm !== S.foco.key) { openMun(mm); return; }
      select({ u: v.k, key: id }); return; }
    if (v.k === 'mun') { openMun(id); return; }
    select({ u: v.k, key: id });
  });
}
function retheme() { if (!map) return; paint(); select(S.sel); }

/* =================== ENTRADA =================== */
async function drawLoginMap() {
  try {
    const g = await fetch('data/geo/municipios.geojson').then(r => r.json()); GEO.municipios = g;
    const cv = $('#login-map'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
    const draw = () => { const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const [[x0, y0], [x1, y1]] = bbox({ coordinates: g.features.map(f => f.geometry.coordinates) }), k = Math.cos(19 * Math.PI / 180);
      const s = Math.min((W * .86) / ((x1 - x0) * k), (H * .82) / (y1 - y0)), ox = (W - (x1 - x0) * k * s) / 2, oy = (H - (y1 - y0) * s) / 2, P = (x, y) => [ox + (x - x0) * k * s, oy + (y1 - y) * s];
      for (const f of g.features) { const p = f.properties, polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        ctx.beginPath(); for (const poly of polys) for (const ring of poly) ring.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
        ctx.fillStyle = p.municipio === 115 ? 'rgba(191,181,145,.95)' : p.det ? 'rgba(191,181,145,.5)' : p.zm ? 'rgba(191,181,145,.2)' : 'rgba(255,255,255,.04)'; ctx.fill('evenodd'); ctx.strokeStyle = 'rgba(191,181,145,.32)'; ctx.lineWidth = .6; ctx.stroke(); } };
    draw(); window.addEventListener('resize', draw);
  } catch {}
}

/* =================== ARRANQUE =================== */
async function loadPublic() {
  const j = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  CAT = await j('data/catalogo.json'); CAT.elecciones.forEach(e => ELS[e.id] = e); CAT.municipios.forEach(m => MUNN[m.id] = m.n);
  await Promise.all(['secciones', 'colonias', 'juntas', 'dl', 'df', 'zm'].concat(GEO.municipios ? [] : ['municipios']).map(k => j(`data/geo/${k}.geojson`).then(g => GEO[k] = g)));
}
async function start(session) {
  PERFIL = session.perfil; $('#login').hidden = true; $('#app').hidden = false;
  const geoP = loadPublic(), mapP = initMap();
  const bundles = await pool(Object.entries(session.keys), 12, ([cab, k]) => openBundle(cab, k).then(d => [cab, d]));
  await geoP;
  for (const [cab, d] of bundles) { if (cab === 'estado') EST = d; else if (cab === 'admin') MB.admin = d; else MB[+cab.slice(1)] = d; }
  DETOK = PERFIL.det.filter(m => MB[m]);
  GEO.secciones.features = GEO.secciones.features.filter(f => DETOK.includes(f.properties.municipio));
  GEO.colonias.features = GEO.colonias.features.filter(f => DETOK.includes(f.properties.municipio));
  if (!DETOK.includes(115)) GEO.juntas.features = [];
  GEO.secciones.byId = {}; for (const f of GEO.secciones.features) { GEO.secciones.byId[f.properties.seccion] = f; SECMUN[f.properties.seccion] = f.properties.municipio; }
  for (const m of DETOK) for (const eid in MB[m]) if (eid[0] !== '_') for (const s in MB[m][eid]) if (!SECMUN[s]) SECMUN[s] = m;
  GEO.colonias.byId = {}; for (const f of GEO.colonias.features) { GEO.colonias.byId[f.properties.cid] = f; for (const s of f.properties.secs) (COLS_OF_SEC[s] = COLS_OF_SEC[s] || []).push(f.properties.cid); }
  GEO.estado_bbox = { coordinates: GEO.municipios.features.map(f => f.geometry.coordinates) };
  const hf = homeFoco(); HOME = { ...hf, vista: DETOK.length ? 'sec' : (hf.u === 'mun' ? 'mun' : hf.u) };
  S.foco = { u: hf.u, key: hf.key }; S.vista = HOME.vista;
  await mapP;
  buildControls(); addLayers(); buildSearch(); sheet();
  setVista(S.vista); applyCapas(); fitGeom(geomOf(HOME.u, HOME.key), 0);
  $('#loading').hidden = true;
  if (!store.get('pe_hint')) { const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = 'Toca cualquier municipio para acercarte y ver sus secciones. Con <b>Volver</b> regresas al inicio.'; $('.stage').appendChild(t);
    setTimeout(() => t.classList.add('out'), 7000); setTimeout(() => t.remove(), 7600); store.set('pe_hint', 1); }
  const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
async function boot() {
  const saved = sess.get('pe_s');
  if (saved) { try { await start(saved); return; } catch (e) { console.error(e); sess.del('pe_s'); location.reload(); return; } }
  drawLoginMap();
  $('#login-form').onsubmit = async e => {
    e.preventDefault(); const btn = $('#lg-btn'), err = $('#lg-err'); err.hidden = true; btn.disabled = true; btn.textContent = 'Verificando…';
    try { const s = await login($('#lg-user').value, $('#lg-pass').value); sess.set('pe_s', s); await start(s); }
    catch (x) { console.error(x); err.textContent = x.message === 'auth' ? 'Usuario o clave incorrectos.' : 'No se pudo abrir la plataforma. Revisa tu conexión e intenta otra vez.'; err.hidden = false; $('#login').hidden = false; $('#app').hidden = true; }
    finally { btn.disabled = false; btn.textContent = 'Entrar'; }
  };
}
boot();
})();
