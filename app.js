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
  ['base', 'Mapa de calles', true, null], ['estado', 'Municipios del estado', true, null], ['nombres', 'Nombres de municipios', true, null], ['dl', 'Distritos locales', false, 'dl'], ['df', 'Distritos federales', false, 'df'],
];
const LINE_COL = { zm: '#8E8462', det: '#BFB591', dl: '#2EC4D6', df: '#F2B134' };
let CAPAS = Object.assign(Object.fromEntries(CAPAS_DEF.map(c => [c[0], c[2]])), { alcance: 'foco' }, store.get('pe_capas3') || {});
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
  if (S.modo === 'win') return u.w.tie ? '#9AA3A3' : candColor(u.w.c);
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
  const h = S.sel || S.foco, v = VK(S.vista), VIV = BASE_OK ? .58 : .85, DIM = BASE_OK ? .08 : .13;
  const munOf = h.u === 'mun' ? h.key : munOfUnit(h.u, h.key);
  let e;
  if (v.det) {
    if (h.u === 'dl' || h.u === 'df') e = v.k === 'sec' ? ['==', ['get', h.u === 'dl' ? 'distrito_l' : 'distrito_f'], h.key] : false;
    else e = v.k === 'ja' ? (munOf === 115) : ['==', ['get', 'municipio'], munOf ?? -1];
  } else if (S.sel && S.sel.u === S.vista) e = ['==', ['get', v.id], S.sel.key];
  else if (S.sel && v.k === 'mun' && munOf != null) e = ['==', ['get', 'municipio'], munOf];
  else e = true;
  // alcance a color: solo el foco, la zona metropolitana o todo el estado
  if (e !== true && v.det && CAPAS.alcance !== 'foco' && !(S.sel && S.sel.u !== 'mun')) e = CAPAS.alcance === 'todo' ? true : ['any', e === false ? false : e, ['in', ['get', 'municipio'], ['literal', CAPAS.alcance === 'zm' ? CAT.zm : CAT.detalle]]];
  const hov = ['boolean', ['feature-state', 'h'], false];
  const op = e === true ? ['case', hov, .85, VIV] : e === false ? ['case', hov, .35, DIM] : ['case', hov, ['case', e, .85, .4], ['case', e, VIV, DIM]];
  map.setPaintProperty('f-' + v.geo, 'fill-opacity', op);
  map.setPaintProperty('l-' + v.geo, 'line-opacity', e === true ? 1 : e === false ? .3 : ['case', e, 1, .25]);
  if (v.k !== 'mun') map.setPaintProperty('f-municipios', 'fill-opacity', v.det ? .1 : .08);
  const fm = S.foco.u === 'mun' && !(S.foco.key === 115 && !S.sel) ? S.foco.key : (S.sel && S.sel.u === 'mun' ? S.sel.key : -1);
  for (const id of ['foco-sh', 'foco-c', 'foco-l']) if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'municipio'], fm]);
  if (map.getLayer('cap-l')) { const other = fm !== -1 && fm !== 115; map.setPaintProperty('cap-l', 'line-opacity', other ? .35 : 1); map.setPaintProperty('cap-glow', 'line-opacity', other ? 0 : .18); }
  focoLabel(fm);
  if (map.getLayer('mask')) { const keep = activeMuns(munOf); map.setFilter('mask', keep ? ['!', ['in', ['get', 'municipio'], ['literal', keep]]] : ['==', ['get', 'municipio'], -1]); }
  const home = S.foco.u === HOME.u && S.foco.key === HOME.key && !S.sel && S.vista === HOME.vista && CAPAS.alcance === 'foco';
  $('#btn-home').hidden = home; placeHome();
}
/* municipios que quedan a color; el resto lleva velo. null = todo el estado a color */
function activeMuns(munOf) {
  if (CAPAS.alcance === 'todo' || (S.vista === 'mun' && !S.sel && CAPAS.alcance === 'foco')) return null;
  if (CAPAS.alcance === 'zm') return CAT.zm;
  if (CAPAS.alcance === 'conurb') return CAT.detalle;
  const h = S.sel || S.foco;
  if (h.u === 'dl' || h.u === 'df') { const p = h.u === 'dl' ? 'distrito_l' : 'distrito_f'; return [...new Set(GEO.secciones.features.filter(f => f.properties[p] === h.key).map(f => f.properties.municipio))]; }
  return munOf != null ? [munOf] : null;
}
/* lo que se está consultando, en la vista actual del mapa: expresión para el mapa y prueba en JS */
function scope() {
  const v = VK(S.vista), s = S.sel && S.sel.u !== S.vista ? S.sel : S.foco, all = { e: true, t: () => true };
  if (!v.det) return all;
  const eq = (p, k) => ({ e: ['==', ['get', p], k], t: q => q[p] === k });
  if (s.u === 'mun') return v.k === 'ja' ? all : eq('municipio', s.key);
  if (s.u === 'dl' || s.u === 'df') return v.k === 'sec' ? eq(s.u === 'dl' ? 'distrito_l' : 'distrito_f', s.key) : all;
  if (s.u === 'ja') return v.k === 'col' ? eq('municipio', 115) : eq('ja', s.key);
  if (s.u === 'col') { if (v.k === 'col') return eq('cid', s.key); const ss = GEO.colonias.byId[s.key].properties.secs; return { e: ['in', ['get', 'seccion'], ['literal', ss]], t: q => ss.includes(q.seccion) }; }
  return all;
}
/* al pasar el cursor por una columna: el mapa muestra, solo en lo consultado, qué tanto votó cada parte por ella */
let HC = [];
function mapShare(kind, id) {
  clearShare();
  const v = VK(S.vista), m = ELS[S.el], src = 'g-' + v.geo, sc = scope(), A = v.k === 'mun' ? MUNAGG : AGG;
  const idx = kind === 'part' ? m.part.indexOf(id) : m.cand.indexOf(id); if (idx < 0) return;
  const vals = [];
  for (const f of GEO[v.geo].features) { const q = f.properties; if (!sc.t(q)) continue; const k = q[v.id], u = A[k]; if (!u || !u.a.t) continue;
    const arr = kind === 'part' ? u.a.p : u.a.c; vals.push([k, pct(arr ? arr[idx] : 0, u.a.t)]); }
  if (!vals.length) return;
  const mx = Math.max(...vals.map(x => x[1]), 1), base = kind === 'part' ? pcol(id) : candColor(id);
  for (const [k, s] of vals) { map.setFeatureState({ source: src, id: k }, { hc: rampColor(base, Math.min(4, Math.floor(s / mx * 4.999))) }); HC.push({ source: src, id: k }); }
  map.setPaintProperty('f-' + v.geo, 'fill-opacity', ['case', sc.e, .95, .04]);
  const L = $('#legend'); L.dataset.prev = '1';
  L.innerHTML = `<h4>Votación de ${kind === 'part' ? chip(id, 1) : chips(id)} en lo que consultas</h4><div class="ramp">${[0, 1, 2, 3, 4].map(i => `<span style="background:${rampColor(base, i)}"></span>`).join('')}</div><div class="rampl"><span>0</span><span>${(mx / 2).toFixed(0)}</span><span>${mx.toFixed(0)} %</span></div>`;
}
function clearShare() { for (const t of HC) map.removeFeatureState(t, 'hc'); HC = []; const L = $('#legend'); if (L.dataset.prev) { delete L.dataset.prev; legend(); } }
let FOCO_MK = null, FOCO_K = null;
function focoLabel(k) {
  if (k === FOCO_K) return; FOCO_K = k; if (FOCO_MK) { FOCO_MK.remove(); FOCO_MK = null; }
  if (k === -1 || k == null) return; const g = geomOf('mun', k); if (!g) return;
  const b = bbox(g), el = document.createElement('div'); el.className = 'foco-tag'; el.textContent = k === 115 ? 'Puebla capital' : MUNN[k];
  FOCO_MK = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -6] }).setLngLat([(b[0][0] + b[1][0]) / 2, b[1][1]]).addTo(map);
}
function paint() {
  AGG = computeAgg(S.vista);
  MUNAGG = S.vista === 'mun' ? AGG : computeAgg('mun');
  for (const [k, u] of Object.entries(MUNAGG)) map.setFeatureState({ source: 'g-municipios', id: k }, { c: colorFor(u, +k, 'mun'), wl: ELS[S.el].cand.indexOf(u.w ? u.w.c : ''), wp: u.w && !u.w.tie ? leadOf(u.w.c) : '' });
  const v = VK(S.vista);
  if (S.vista !== 'mun') for (const [k, u] of Object.entries(AGG)) map.setFeatureState({ source: 'g-' + v.geo, id: k }, { c: colorFor(u, S.vista === 'ja' ? k : +k, S.vista), wl: ELS[S.el].cand.indexOf(u.w ? u.w.c : '') });
  if (v.det) map.setFilter('t-' + v.geo, ['in', ['get', v.id], ['literal', Object.keys(AGG).filter(k => !AGG[k].w).map(k => S.vista === 'ja' ? k : +k)]]);
  highlight(); legend(); hero(); renderPanel();
}

/* =================== LEYENDA Y RESUMEN =================== */
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
const chip = (p, sm) => `<span class="pch${sm ? ' sm' : ''}" style="background:${pcol(p)}" title="${esc((PARTY[p] || [0, p])[1])}">${esc(p === 'IND' ? 'IND' : p)}</span>`;
const chips = c => c.startsWith('CAND_IND') ? chip('IND') : c.split('-').map(p => chip(p)).join('');
/* resumen sobre el mapa */
function hero() {
  const F = S.foco, m = ELS[S.el], a = agg(F.u, F.key, S.el), r = ranking(S.el, a), w = verdict(S.el, a), v = VK(S.vista);
  const who = w ? personFor(S.el, F.u, F.key, w.c) : null, top = r.slice(0, 3), rest = a.t - top.reduce((s, x) => s + x.v, 0);
  let won = null, tot = 0;
  if (v.det && F.u === 'mun') { won = {}; for (const f of GEO[v.geo].features) { const p = f.properties; if ((v.k === 'ja' ? 115 : p.municipio) !== F.key) continue; tot++; const u = AGG[p[v.id]]; if (u && u.w && !u.w.tie) won[u.w.c] = (won[u.w.c] || 0) + 1; } }
  $('#hero').innerHTML = `<div class="eyebrow"><svg><use href="#i-rombo"/></svg>${esc(unitName(F.u, F.key))} · ${m.anio}</div><h2>${esc(cargoBase(m.cargo))}<small>${a.t ? (a.ln ? p1(pct(a.t, a.ln)) + ' de participación' : fmt(a.t) + ' votos') : 'Sin elección en ' + m.anio}</small></h2>
    ${a.t ? `<div class="stack">${top.map(x => `<i style="width:${pct(x.v, a.t)}%;background:${candColor(x.c)}"></i>`).join('')}<i style="width:${pct(rest, a.t)}%;background:var(--nores)"></i></div>
    ${w && !w.tie ? `<div class="who-won">Ganó <b>${esc(who || shortCand(w.c))}</b>${who ? ` <span>(${esc(shortCand(w.c))})</span>` : ''}</div>` : ''}
    <div class="rows">${top.map(x => `<div class="r" data-cand="${x.c}"><span class="sw" style="background:${candColor(x.c)}"></span><span class="nm">${esc(shortCand(x.c))}</span><span class="pc">${p1(pct(x.v, a.t))}</span>${won ? `<span class="wn">${won[x.c] || 0} de ${tot}</span>` : ''}</div>`).join('')}</div>` : ''}`;
  linkRows($('#hero')); placeHome();
}

/* =================== GRÁFICAS =================== */
function trendData(u, key) {
  const cargo = cargoBase(ELS[S.el].cargo);
  return CAT.elecciones.filter(e => cargoBase(e.cargo) === cargo && !e.cargo.includes('extra')).sort((a, b) => a.anio - b.anio).map(e => {
    const a = agg(u, key, e.id); return { e, a, by: blocs(e.id, a), part: a.ln ? pct(a.t, a.ln) : null };
  }).filter(p => p.a.t);
}
/* =================== COMPARAR =================== */
/* =================== GRÁFICAS (v7) =================== */
/* votos de cada partido dentro de una candidatura; lo marcado con varios logos va aparte */
function candParts(eid, a, c) {
  const m = ELS[eid], tot = a.c[m.cand.indexOf(c)];
  if (c.startsWith('CAND_IND')) return [{ p: 'IND', v: tot }];
  const ps = c.split('-').map(p => ({ p, v: a.p ? (a.p[m.part.indexOf(p)] || 0) : 0 })).filter(x => x.v > 0).sort((x, y) => y.v - x.v);
  const sh = tot - ps.reduce((s, x) => s + x.v, 0);
  if (sh >= 1) ps.push({ p: c.split('-')[0], v: sh, sh: true });
  return ps.length ? ps : [{ p: leadOf(c), v: tot }];
}
const segBg = s => s.sh ? `background:repeating-linear-gradient(135deg,${pcol(s.p)} 0 3px,${mix(pcol(s.p), '#ffffff', .5)} 3px 6px)` : s.p === '_o' ? 'background:var(--gris)' : `background:${pcol(s.p)}`;
const pname = p => p === 'IND' ? 'Independiente' : (PARTY[p] || [0, p])[1];
const tipA = html => `data-tip="${esc(html)}"`;
function bindTips(root) {
  let T = $('#ctip'); if (!T) { T = document.createElement('div'); T.id = 'ctip'; T.className = 'ctip'; T.hidden = true; document.body.appendChild(T); }
  root.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', () => { T.innerHTML = el.getAttribute('data-tip'); T.hidden = false; });
    el.addEventListener('mousemove', e => { const w = T.offsetWidth, h = T.offsetHeight; let x = e.clientX + 16, y = e.clientY + 16; if (x + w > innerWidth - 8) x = e.clientX - w - 16; if (y + h > innerHeight - 8) y = e.clientY - h - 16; T.style.left = Math.max(8, x) + 'px'; T.style.top = Math.max(8, y) + 'px'; });
    el.addEventListener('mouseleave', () => { T.hidden = true; });
  });
}
const hideTip = () => { const T = $('#ctip'); if (T) T.hidden = true; };

/* columnas verticales: cada candidatura es una columna formada por sus partidos; la trama son los votos con varios logos */
const partesTabs = (cur, id = 'partes') => `<span class="tabs" id="${id}"><button data-p="cand" class="${cur === 'cand' ? 'on' : ''}">Coalición</button><button data-p="part" class="${cur === 'part' ? 'on' : ''}">Partido</button></span>`;

/* cómo se ha repartido el voto: una columna por elección y cintas que unen a cada partido entre años */
function ribbonData(u, key, cargo, mode) {
  const pts = CAT.elecciones.filter(e => cargoBase(e.cargo) === cargo && !e.cargo.includes('extra')).sort((a, b) => a.anio - b.anio)
    .map(e => { const a = agg(u, key, e.id); const by = {};
      if (a.t) { if (mode === 'part') ELS[e.id].part.forEach((p, i) => { if (a.p && a.p[i] > 0) by[p] = pct(a.p[i], a.t); }); else Object.assign(by, blocs(e.id, a)); }
      return { e, a, by, w: verdict(e.id, a) }; }).filter(p => p.a.t);
  const tot = {}; pts.forEach(p => Object.entries(p.by).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v));
  const keys = Object.entries(tot).sort((a, b) => b[1] - a[1]).map(x => x[0]).slice(0, 6);
  return { pts, keys };
}
/* tendencia lineal: % de votos de cada partido (o coalición) en cada elección del mismo cargo */
/* =================== VENTANA DE EXPLORACIÓN =================== */
/* =================== v10: TARJETAS Y GRÁFICAS (estilo de referencia) =================== */
const ICO = {
  res: '<svg viewBox="0 0 24 24"><rect x="4" y="10" width="4" height="10" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="13" width="4" height="7" rx="1"/></svg>',
  tr: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dat: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1.5"/><rect x="3" y="10" width="11" height="4" rx="1.5"/><rect x="3" y="16" width="15" height="4" rx="1.5"/></svg>',
  cong: '<svg viewBox="0 0 24 24"><path d="M3 20h18v-2H3zM5 16h2V9H5zm4 0h2V9H9zm4 0h2V9h-2zm4 0h2V9h-2zM2 7l10-5 10 5z"/></svg>',
  ayu: '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>',
  afi: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.6"/><path d="M2 20c0-3.9 3.1-6 7-6s7 2.1 7 6zm14.5 0c0-2-.6-3.6-1.7-4.8 3.4-.3 6.2 1.3 6.2 4.8z"/></svg>',
};
function card(id, title, body, o = {}) {
  return `<section class="card k2${o.cls ? ' ' + o.cls : ''}" id="c-${id}"><div class="k2-h"><span class="k2-i">${ICO[o.icon || id] || ICO.res}</span><div class="k2-t"><h3>${title}</h3>${o.sub ? `<small>${o.sub}</small>` : ''}</div><div class="acts">${o.extra || ''}${o.zoom === false ? '' : `<button class="amp" data-zoom="${id}">${ICON_ZOOM}<span>Ampliar</span></button>`}</div></div>${body}</section>`;
}
const candShort = c => c.startsWith('CAND_IND') ? 'Independiente' : (ps => ps.length <= 3 ? ps.join('-') : ps.slice(0, 2).join('-') + ' +' + (ps.length - 2))(c.split('-'));
const plusName = c => c.startsWith('CAND_IND') ? 'Ind.' : leadOf(c) + (c.includes('-') ? '+' : '');
const allyName = (eid, p) => p + (ELS[eid].cand.some(c => leadOf(c) === p && c.includes('-')) ? ' y aliados' : '');
const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1);
const dBadge = (d, sfx = '') => `<span class="db2 ${Math.abs(d) < .5 ? 'eq' : d > 0 ? 'up' : 'dn'}">${sgn(d)}${sfx}</span>`;
const compLvl = m => m < 5 ? ['alta', 'competencia alta'] : m < 15 ? ['media', 'competencia media'] : ['baja', 'competencia baja'];
/* agrupa candidaturas por la fuerza que las encabeza: en un distrito o en todo el estado cada municipio tuvo coaliciones distintas */
function rankB(eid, a) { const by = {}; for (const x of ranking(eid, a)) { const k = x.c.startsWith('CAND_IND') ? x.c : leadOf(x.c); (by[k] = by[k] || { k, v: 0, cs: [] }); by[k].v += x.v; by[k].cs.push(x.c); }
  return Object.values(by).sort((p, q) => q.v - p.v).map(g => Object.assign(g, { one: g.cs.length === 1 ? g.cs[0] : null, col: g.cs.length === 1 ? candColor(g.cs[0]) : pcol(g.k), name: g.cs.length === 1 ? candShort(g.cs[0]) : g.k + (g.cs.some(c => c.includes('-')) ? ' y aliados' : ''), short: g.cs.length === 1 ? plusName(g.cs[0]) : g.k + (g.cs.some(c => c.includes('-')) ? '+' : '') })); }
function topB(eid, a, u, key) { const g = rankB(eid, a); if (!g.length || !a.t) return null; const g0 = g[0], g1 = g[1];
  return { g0, g1, share: pct(g0.v, a.t), margin: pct(g0.v - (g1 ? g1.v : 0), a.t), tie: g1 && g1.v === g0.v, who: g0.one ? personFor(eid, u, key, g0.one) : null, many: g.some(x => x.cs.length > 1) }; }
function prevShares(eid, u, key, mode) { const p = prevOf(eid); if (!p) return null; const a = agg(u, key, p.id); if (!a.t) return null; return { e: p, a, by: sharesOf(p.id, a, mode) }; }
function spark(vals, col, W = 110, H = 28, dotLast = true) {
  const v = vals.filter(x => x != null); if (v.length < 2) return '';
  const mn = Math.min(...v), mx = Math.max(...v), r = mx - mn || 1, X = i => 4 + i * (W - 8) / (vals.length - 1), Y = x => H - 4 - (x - mn) / r * (H - 8);
  const pts = vals.map((x, i) => x == null ? null : [X(i), Y(x)]).filter(Boolean);
  return `<svg class="spk" viewBox="0 0 ${W} ${H}"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linejoin="round"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 && dotLast ? 3.2 : 1.8}" fill="${col}"/>`).join('')}</svg>`;
}

/* ---------- columnas de resultados: aporte de cada partido, raya de la elección anterior y diferencia ---------- */
function vcols(eid, a, u, key, mode, big) {
  const m = ELS[eid], w = verdict(eid, a); if (!a.t) return '';
  let items = mode === 'part'
    ? m.part.map((p, i) => ({ id: p, k: p, v: a.p ? a.p[i] : 0, segs: [{ p, v: a.p ? a.p[i] : 0 }] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v)
    : rankB(eid, a).map(g => { const sg = {}; g.cs.forEach(c => candParts(eid, a, c).forEach(s => { const kk = (s.sh ? '~' : '') + s.p; (sg[kk] = sg[kk] || { p: s.p, v: 0, sh: s.sh }).v += s.v; }));
        return { id: g.one || g.k, cand: g.one, grp: g, k: g.one ? leadOf(g.one) : g.k, v: g.v, segs: Object.values(sg).sort((x, y) => (x.sh ? 1 : 0) - (y.sh ? 1 : 0) || y.v - x.v) }; });
  const N = big ? 9 : 5;
  if (items.length > N) { const rest = items.slice(N - 1), v = rest.reduce((s, x) => s + x.v, 0); items = items.slice(0, N - 1); items.push({ id: '_o', v, segs: [{ p: '_o', v }], otros: rest }); }
  if (!items.length) return '';
  const pv = prevShares(eid, u, key, mode);
  const vals = items.map(x => pct(x.v, a.t)).concat(pv ? items.map(x => (x.k && pv.by[x.k]) || 0) : []);
  const vmax = Math.max(...vals), step = vmax > 60 ? 20 : 10, top = Math.ceil(vmax * 1.12 / step) * step, H = big ? 300 : 190;
  const grid = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step).map(t => `<div class="vg" style="bottom:${t / top * 100}%"><span>${t}%</span></div>`).join('');
  const cols = items.map((x, i) => {
    const p = pct(x.v, a.t), lead = mode !== 'part' && i === 0 && (!items[1] || items[1].v < x.v), who = x.cand ? personFor(eid, u, key, x.cand) : null, pr = pv && x.k ? pv.by[x.k] : null;
    const head = x.otros ? 'Otros' : x.cand ? (who || candTitle(x.cand)) : x.grp ? x.grp.name + ` (${x.grp.cs.length} candidaturas distintas)` : pname(x.id);
    const brk = x.otros ? x.otros.map(o => `<div><span class="sw" style="background:${o.grp ? o.grp.col : pcol(o.id)}"></span>${esc(o.grp ? o.grp.name : o.id)}<b>${fmt(o.v)}</b></div>`).join('')
      : (x.segs.length > 1 ? x.segs.map(s => `<div><span class="sw" style="${segBg(s)}"></span>${s.sh ? 'Con varios logos' : esc(s.p)}<b>${p1(pct(s.v, a.t))}</b></div>`).join('') : '');
    const tip = `<b>${esc(head)}</b>${who ? `<span class="m">${esc(candTitle(x.cand))}</span>` : ''}<div class="tv"><strong>${p1(p)}</strong> ${fmt(x.v)} votos</div>${brk ? `<div class="tl">${brk}</div>` : ''}${pr ? `<span class="m">En ${pv.e.anio}: ${p1(pr)} (${sgn(p - pr)} pts)</span>` : ''}${!x.otros ? '<span class="m">En el mapa: dónde votaron más</span>' : ''}`;
    const segs = x.segs.map(s => { const px = (H - 10) * pct(s.v, a.t) / top; return `<i style="flex:${s.v} 0 0;${segBg(s)}">${x.segs.length > 1 && px >= 16 ? `<span>${s.sh ? 'Varios' : esc(s.p)}</span>` : ''}</i>`; }).join('');
    const nm = x.otros ? 'Otros' : x.grp ? x.grp.short : x.id, col = x.otros ? 'var(--gris)' : x.grp ? x.grp.col : pcol(x.id);
    return `<div class="vc2-c${lead ? ' lead' : ''}" ${x.cand ? `data-cand="${x.cand}"` : mode === 'part' && !x.otros ? `data-part="${x.id}"` : ''} ${tipA(tip)} style="--d:${i * 70}ms;--c:${col}">
      ${lead ? '<span class="vc2-tag">1er lugar</span>' : '<span></span>'}
      <div class="vc2-a"><div class="vc2-bar" style="height:${(p / top * 100).toFixed(2)}%">${segs}</div><b class="vc2-v" style="bottom:calc(${(p / top * 100).toFixed(2)}% + 4px)">${p1(p).replace(' ', '')}</b>${pr ? `<span class="vc2-ref" style="bottom:${(pr / top * 100).toFixed(2)}%"></span>` : ''}</div>
      <div class="vc2-n"><b>${esc(nm)}</b>${big && who ? `<small class="who">${esc(who)}</small>` : ''}<small>${fmt(x.v)} votos</small>${pr ? dBadge(p - pr) : pv && !x.otros ? '<span class="db2 na">nuevo</span>' : ''}</div></div>`;
  }).join('');
  return `<div class="vc2${big ? ' big' : ''}" style="--h:${H}px;--n:${items.length}"><div class="vc2-g">${grid}</div><div class="vc2-p">${cols}</div></div>
    <div class="vc2-lg">${mode === 'part' ? '' : '<span><i class="sw hatch"></i>colores: aporte de cada partido</span>'}${pv ? `<span><i class="ref"></i>raya: ${pv.e.anio}</span>` : ''}</div>`;
}
function resHead(eid, a, u, key) {
  const t = topB(eid, a, u, key); if (!t) return '';
  return `<div class="hl"><span class="hl-d" style="background:${t.g0.col}"></span><b class="hl-v" style="color:${t.g0.col}" data-n="${t.share.toFixed(1)}" data-d="1" data-s="%">0%</b><span class="hl-n">${esc(t.g0.name)}${t.who ? `<small>${esc(t.who)}</small>` : t.many ? '<small>Suma de las candidaturas que encabezó en cada municipio</small>' : ''}</span></div>
    ${t.g1 ? `<span class="pill">${t.margin.toFixed(1)} pts de ventaja sobre ${esc(t.g1.short)}</span>` : ''}`;
}
function resSummary(eid, a, u, key) {
  const m = ELS[eid], t = topB(eid, a, u, key); if (!t) return '';
  const p = prevOf(eid), ap = p ? agg(u, key, p.id) : null, part = a.ln ? pct(a.t, a.ln) : null, pp = ap && ap.ln && ap.t ? pct(ap.t, ap.ln) : null;
  return `<p class="sum"><b style="color:${t.g0.col}">${esc(t.g0.name)}</b> ${t.many ? 'sumó más votos' : 'ganó'} en ${esc(cargoBase(m.cargo).toLowerCase())} ${m.anio} con <b>${t.margin.toFixed(1)} pts</b> de ventaja${t.g1 ? ` sobre ${esc(t.g1.name)}` : ''}${part != null ? `; votó ${part.toFixed(0)} %${pp != null ? `, ${Math.abs(part - pp).toFixed(1)} pts ${part >= pp ? 'más' : 'menos'} que en ${p.anio}` : ''}` : ''}.</p>`;
}

/* ---------- evolución del voto: curvas suaves, el líder destacado, ganador arriba ---------- */
let TRF = null;
function trendLine(u, key, cargo, mode, W, H, selEl, big) {
  const { pts, keys: k0 } = ribbonData(u, key, cargo, mode); if (pts.length < 2) return '';
  const keys = k0.slice(0, big ? 6 : 4), n = pts.length;
  const lastW = (pts.find(p => p.e.id === selEl) || pts[n - 1]).w, lead = TRF && keys.includes(TRF) ? TRF : (lastW ? leadOf(lastW.c) : keys[0]);
  const vmax = Math.max(...pts.flatMap(p => keys.map(k => p.by[k] || 0)), 10), step = vmax > 56 ? 20 : vmax > 28 ? 14 : 7, top = Math.ceil(vmax * 1.08 / step) * step;
  const L = big ? 64 : 34, R = big ? 120 : 86, T = 40, B = big ? 40 : 36, X = i => L + (W - L - R) * i / (n - 1), Y = v => T + (H - T - B) * (1 - v / top);
  const ally = k => mode !== 'part' && pts.some(p => ranking(p.e.id, p.a).some(r => leadOf(r.c) === k && r.c.includes('-')));
  const curve = P => P.reduce((s, [x, y], i, A) => { if (!i) return `M${x},${y}`; const [px, py] = A[i - 1], cx = (px + x) / 2; return s + ` C${cx},${py} ${cx},${y} ${x},${y}`; }, '');
  let g = `<defs><linearGradient id="tga${W}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${pcol(lead)}" stop-opacity=".22"/><stop offset="1" stop-color="${pcol(lead)}" stop-opacity="0"/></linearGradient></defs>`;
  for (let v = 0; v <= top; v += step) g += `<line class="tg" x1="${L}" x2="${W - R + 8}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tyl" x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${v}%</text>`;
  const si = pts.findIndex(p => p.e.id === selEl);
  if (si >= 0) g += `<rect class="tsel" x="${X(si) - 20}" y="${T - 4}" width="40" height="${H - T - B + 8}" rx="9"/>`;
  pts.forEach((p, i) => {
    if (p.w && !p.w.tie) { const lab = leadOf(p.w.c), wd = Math.max(big ? 70 : 52, lab.length * 7.6 + 18); g += `<rect x="${X(i) - wd / 2}" y="8" width="${wd}" height="19" rx="9.5" fill="${candColor(p.w.c)}"/><text class="twin" x="${X(i)}" y="21.5" text-anchor="middle">${esc(lab)}</text>`; }
    g += `<text class="ty${i === si ? ' sel' : ''}" x="${X(i)}" y="${H - B + 18}" text-anchor="middle">${p.e.anio}</text>`; });
  const order = keys.filter(k => k !== lead).concat(keys.includes(lead) ? [lead] : []), ends = [];
  order.forEach((k, j) => { const c = pcol(k), isL = k === lead, segs = []; let cur = [];
    pts.forEach((p, i) => { const v = p.by[k]; if (v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([+X(i).toFixed(1), +Y(v).toFixed(1), v, i]); }); if (cur.length) segs.push(cur);
    segs.forEach(sg => { const d = curve(sg);
      if (isL && sg.length > 1) g += `<path d="${d} L${sg[sg.length - 1][0]},${Y(0)} L${sg[0][0]},${Y(0)} Z" fill="url(#tga${W})" class="tl-a"/><path d="${d}" fill="none" stroke="${c}" stroke-width="10" stroke-opacity=".14" stroke-linecap="round"/>`;
      g += `<path class="tl-l${isL ? ' lead' : ''}" d="${d}" stroke="${isL ? c : mix(c, '#ffffff', .25)}" pathLength="1" style="--d:${j * 100}ms"/>`;
      sg.forEach(([x, y, v, i]) => { g += `<circle class="tl-p" cx="${x}" cy="${y}" r="${isL ? (i === si ? 7 : 5.5) : 3.4}" fill="${isL ? 'var(--surface)' : c}" stroke="${c}" stroke-width="${isL ? 3 : 1.5}" style="--d:${j * 100 + 500}ms"/>`;
        if (isL || (big && v >= 8 && i === si)) g += `<text class="tl-v" x="${x}" y="${y - 12}" text-anchor="middle" style="fill:${c}">${v.toFixed(0)}%</text>`; }); });
    const lst = segs.length ? segs[segs.length - 1] : null; if (lst) { const z = lst[lst.length - 1]; ends.push({ k, y: z[1], x: z[0], v: z[2], c, isL }); } });
  ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 20) ends[i].y = ends[i - 1].y + 20;
  ends.forEach(e => { const t = `${e.k} ${e.v.toFixed(0)}%`, wd = t.length * 6.6 + 16;
    g += `<g class="tl-e"><rect x="${W - R + 14}" y="${e.y - 10}" width="${wd}" height="20" rx="10" fill="${e.isL ? e.c : 'var(--surface)'}" stroke="${e.c}" stroke-width="1.4"/><text x="${W - R + 14 + wd / 2}" y="${e.y + 4}" text-anchor="middle" style="fill:${e.isL ? '#fff' : e.c}">${esc(t)}</text></g>`; });
  pts.forEach((p, i) => { const w = (W - L - R) / (n - 1), x0 = i === 0 ? L - 12 : X(i) - w / 2, x1 = i === n - 1 ? W - R + 10 : X(i) + w / 2;
    const prev = pts[i - 1], rows = keys.filter(k => p.by[k] != null).sort((a, b) => p.by[b] - p.by[a]).map(k => `<div><span class="sw" style="background:${pcol(k)}"></span>${esc(k)}${ally(k) ? '+' : ''}<b>${p1(p.by[k])}</b>${prev && prev.by[k] != null ? `<em>${sgn(p.by[k] - prev.by[k])}</em>` : ''}</div>`).join('');
    const tip = `<b>${p.e.anio} · ganador: ${p.w && !p.w.tie ? esc(plusName(p.w.c)) : '—'}</b><div class="tl">${rows}</div>${p.a.ln ? `<span class="m">Participación ${p1(pct(p.a.t, p.a.ln))}</span>` : ''}<span class="m">Clic: ver ${p.e.anio}</span>`;
    g += `<g class="th" data-el="${p.e.id}" ${tipA(tip)}><rect x="${x0}" y="${T - 8}" width="${x1 - x0}" height="${H - T - B + 16}" fill="transparent"/><line x1="${X(i)}" x2="${X(i)}" y1="${T - 4}" y2="${H - B}"/></g>`; });
  return `<div class="tln"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del voto">${g}</svg></div>
    <div class="trk">${keys.map(k => `<button data-trf="${k}" class="${k === lead ? 'on' : ''}" style="--c:${pcol(k)}"><i></i>${esc(k)}${ally(k) ? ' y aliados' : ''}</button>`).join('')}</div>`;
}
function trendHead(u, key, cargo, mode, selEl) {
  const { pts } = ribbonData(u, key, cargo, mode); if (pts.length < 2) return '';
  const i = Math.max(0, pts.findIndex(p => p.e.id === selEl)), p = pts[i] || pts[pts.length - 1], k = TRF || (p.w ? leadOf(p.w.c) : null); if (!k || p.by[k] == null) return '';
  const prev = pts.slice(0, i).reverse().find(q => q.by[k] != null);
  return `<div class="hl"><span class="hl-d" style="background:${pcol(k)}"></span><b class="hl-v" style="color:${pcol(k)}">${p1(p.by[k]).replace(' ', '')}</b><span class="hl-n">${esc(k)} en ${p.e.anio}</span></div>${prev ? `<span class="pill ${p.by[k] >= prev.by[k] ? 'up' : 'dn'}">${sgn(p.by[k] - prev.by[k])} pts vs ${prev.e.anio}</span>` : ''}`;
}
function trendKpis(u, key, cargo, mode) {
  const { pts, keys } = ribbonData(u, key, cargo, mode); if (pts.length < 2) return '';
  const last = pts[pts.length - 1], k = TRF || (last.w ? leadOf(last.w.c) : keys[0]), ser = pts.map(p => p.by[k] ?? null), c = pcol(k);
  const vs = ser.map((v, i) => [v, i]).filter(x => x[0] != null), f = vs[0], l = vs[vs.length - 1], best = vs.reduce((a, b) => b[0] > a[0] ? b : a, vs[0]);
  const r = ranking(last.e.id, last.a), w = last.w, part = pts.map(p => p.a.ln ? pct(p.a.t, p.a.ln) : null), pl = part[part.length - 1], pp = part[part.length - 2];
  const wins = pts.map(p => p.w && !p.w.tie ? leadOf(p.w.c) : null), cambios = wins.slice(1).filter((x, i) => x && wins[i] && x !== wins[i]).length;
  const tile = (lbl, big, sub, extra = '') => `<div class="tk"><span class="tk-l">${lbl}</span><b class="tk-v">${big}</b><small>${sub}</small>${extra}</div>`;
  return `<div class="tks">${f && l ? tile(`${esc(k)}: variación ${pts[f[1]].e.anio}–${pts[l[1]].e.anio}`, `<span class="${l[0] >= f[0] ? 'up' : 'dn'}">${sgn(l[0] - f[0])} pts</span>`, `de ${p1(f[0])} a ${p1(l[0])}`, spark(ser, c)) : ''}
    ${best ? tile(`Mejor resultado de ${esc(k)}`, p1(best[0]), `${pts[best[1]].e.anio}${best[1] === pts.length - 1 ? ' · es el más reciente' : ''}`, spark(ser, c)) : ''}
    ${w && r[1] ? tile(`Ventaja en ${last.e.anio}`, `${w.margin.toFixed(1)} pts`, `${esc(plusName(w.c))} sobre ${esc(plusName(r[1].c))}`, `<div class="tk-bar"><i style="flex:${r[0].v};background:${candColor(r[0].c)}"></i><i style="flex:${r[1].v};background:${candColor(r[1].c)}"></i></div>`) : ''}
    ${pl != null ? tile('Participación (lista nominal)', p1(pl), pp != null ? `${sgn(pl - pp)} pts vs ${pts[pts.length - 2].e.anio}` : '', spark(part, '#5F6664')) : ''}
    ${tile('Ganador por elección', `${cambios} ${cambios === 1 ? 'cambio' : 'cambios'}`, cambios ? 'hubo alternancia' : 'sin alternancia', `<div class="tk-dots">${wins.map((x, i) => `<i style="background:${x ? pcol(x) : 'var(--nores)'}" title="${pts[i].e.anio}: ${x || '—'}"></i>`).join('')}</div>`)}</div>`;
}

/* ---------- datos generales del lugar ---------- */
function secsOfUnit(u, key) {
  const F = GEO.secciones.features;
  if (u === 'est') return F.map(f => f.properties.seccion);
  if (u === 'mun') return F.filter(f => f.properties.municipio === key).map(f => f.properties.seccion);
  if (u === 'dl' || u === 'df') { const p = u === 'dl' ? 'distrito_l' : 'distrito_f'; return F.filter(f => f.properties[p] === key).map(f => f.properties.seccion); }
  return unitSecs(u, key);
}
function datosGen(u, key) {
  const P = padron(u, key); if (!P) return '';
  const ss = secsOfUnit(u, key), props = ss.map(s => GEO.secciones.byId[s] && GEO.secciones.byId[s].properties).filter(Boolean);
  const uniq = k => new Set(props.map(q => q[k])).size, G = CAT.padron.grupos, tot = P[1];
  const age = G.map((g, i) => ({ g, v: P[5][i] + P[6][i] })), y = age.slice(0, 3).reduce((s, x) => s + x.v, 0), o = age[age.length - 1].v;
  const kp = (v, l) => `<div class="dg-k"><b>${v}</b><span>${l}</span></div>`;
  const big = v => v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e4 ? (v / 1e3).toFixed(0) + 'k' : fmt(v);
  return `<div class="dg">${kp(fmt(props.length), props.length === 1 ? 'sección' : 'secciones')}${kp(big(P[1]), 'lista nominal')}${kp(big(P[0]), 'padrón')}
    ${u === 'est' || u === 'dl' || u === 'df' ? kp(uniq('municipio'), 'municipios') : ''}${u !== 'dl' ? kp(uniq('distrito_l'), uniq('distrito_l') === 1 ? 'distrito local' : 'distritos locales') : ''}${u !== 'df' ? kp(uniq('distrito_f'), uniq('distrito_f') === 1 ? 'distrito federal' : 'distritos federales') : ''}</div>
    <div class="dg-s">Lista nominal por sexo y edad</div>
    <div class="dg-bar"><i style="flex:${P[3]};background:#7D2447" ${tipA(`<b>Mujeres</b><div class="tv"><strong>${p1(pct(P[3], tot))}</strong> ${fmt(P[3])}</div>`)}></i><i style="flex:${P[2]};background:#4A5350" ${tipA(`<b>Hombres</b><div class="tv"><strong>${p1(pct(P[2], tot))}</strong> ${fmt(P[2])}</div>`)}></i></div>
    <div class="dg-lg"><span><i style="background:#7D2447"></i>Mujeres <b>${p1(pct(P[3], tot))}</b></span><span><i style="background:#4A5350"></i>Hombres <b>${p1(pct(P[2], tot))}</b></span><span>18–29 años <b>${pct(y, tot).toFixed(0)}%</b></span><span>65 y más <b>${pct(o, tot).toFixed(0)}%</b></span></div>
    <div class="dg-age">${age.map((x, i) => `<i style="flex:${x.v};background:${mix('#4A5350', '#ffffff', i / 12)}" ${tipA(`<b>${x.g} años</b><div class="tv"><strong>${p1(pct(x.v, tot))}</strong> ${fmt(x.v)}</div><div class="tl"><div>Mujeres<b>${fmt(P[6][i])}</b></div><div>Hombres<b>${fmt(P[5][i])}</b></div></div>`)}></i>`).join('')}</div>
    <div class="dg-al"><span>18</span><span>edad</span><span>65+</span></div>
    <div class="dg-note"><b>${p1(pct(P[1], P[0]))}</b> del padrón está en la lista nominal (credencial vigente).</div>`;
}

/* ---------- congreso y ayuntamientos ---------- */
function seatsBody(s) {
  const nmb = b => s.t === 'AYU' ? allyName(s.eid, b) : s.nm(b), c0 = pcol(s.order[0]), n0 = s.bl[s.order[0]].n;
  if (s.t === 'AYU') {
    return `<div class="hl"><span class="hl-d" style="background:${c0}"></span><b class="hl-v" style="color:${c0}" data-n="${n0}">0</b><span class="hl-n">de ${s.total} municipios<small>${esc(nmb(s.order[0]))}</small></span></div>
      <div class="fz">${s.order.map((b, i) => { const n = s.bl[b].n, co = s.list.filter(x => x.b === b && x.co).length;
        return `<div class="fz-r" data-bloc="${b}" ${tipA(`<b>${esc(nmb(b))}</b><div class="tv"><strong>${n}</strong> de ${s.total} municipios</div><span class="m">${co ? `${co} en coalición · ${n - co} sin coalición` : 'Sin coalición'}</span><span class="m">En el mapa: dónde ganó</span>`)} style="--d:${i * 40}ms"><span class="fz-n"><i style="background:${pcol(b)}"></i>${esc(nmb(b))}</span><span class="fz-b"><i style="width:${(n / n0 * 100).toFixed(1)}%;background:${pcol(b)}"></i></span><b>${n}</b><small>${pct(n, s.total).toFixed(0)}%</small></div>`; }).join('')}</div>
      <div class="src">Presidencias municipales ganadas, contadas para el partido que encabezó la candidatura. Fuente: registro de candidaturas ganadoras INE / IEE Puebla.</div>`;
  }
  const tag = s.t === 'DL' ? (n0 >= s.cal ? 'Mayoría calificada' : n0 >= s.may ? 'Mayoría absoluta' : 'Sin mayoría') : s.t === 'SEN' ? 'Senado' : 'De mayoría relativa';
  const seats = s.list.map((x, i) => `<i class="${x.k}" style="background:${x.k === 'rp' ? `repeating-linear-gradient(135deg,${pcol(x.p)} 0 3px,${mix(pcol(x.p), '#ffffff', .55)} 3px 5px)` : pcol(x.p)};--d:${i * 15}ms" ${tipA(`<b>${esc(pname(x.p))}</b><span class="m">${x.k === 'rp' ? 'Plurinominal' : 'Mayoría relativa'} · bloque ${esc(s.nm(x.b))}</span>`)}></i>`).join('');
  const mk = (n, l, cls) => `<span class="cg-m ${cls}" style="left:${(n / s.total * 100).toFixed(2)}%"><em>${l} · ${n}</em></span>`;
  return `<div class="hl"><span class="hl-d" style="background:${c0}"></span><b class="hl-v" style="color:${c0}" data-n="${n0}">0</b><span class="hl-n">de ${s.total} ${s.t === 'SEN' ? 'escaños' : 'diputaciones'}<small>${esc(s.nm(s.order[0]))}</small></span></div><span class="pill">${tag}</span>
    <div class="cgs"><div class="cgs-s">${seats}</div>${s.t === 'DL' ? mk(s.may, 'Mayoría', 'm1') + mk(s.cal, 'Calificada', 'm2') : ''}</div>${s.t === 'DL' ? '<div class="cg-lg"><span><i class="mr"></i>Mayoría relativa</span><span><i class="rp"></i>Plurinominal</span></div>' : ''}
    <div class="fz">${s.order.map((b, i) => { const B = s.bl[b], mr = s.list.filter(x => x.b === b && x.k === 'mr').length, parts = Object.entries(B.parts).sort((x, y) => y[1] - x[1]);
      return `<div class="fz-r cg-r" style="--d:${i * 40}ms" ${tipA(`<b>${esc(s.nm(b))}</b><div class="tv"><strong>${B.n}</strong> ${s.t === 'SEN' ? 'escaños' : 'diputaciones'}</div><div class="tl">${parts.map(([p, k]) => `<div><span class="sw" style="background:${pcol(p)}"></span>${esc(p)}<b>${k}</b></div>`).join('')}</div>${s.t === 'DL' ? `<span class="m">${mr} de mayoría · ${B.n - mr} plurinominales</span>` : ''}`)}>
        <span class="fz-n"><i style="background:${pcol(b)}"></i>${esc(s.nm(b))}</span><span class="fz-b"><i style="width:${(B.n / n0 * 100).toFixed(1)}%;display:flex">${parts.map(([p, k]) => `<b style="flex:${k};background:${pcol(p)}"></b>`).join('')}</i></span><b>${B.n}</b><small>${parts.length > 1 ? parts.map(([p, k]) => `${p} ${k}`).join(' · ') : (s.t === 'DL' ? `${mr} MR · ${B.n - mr} RP` : '')}</small></div>`; }).join('')}</div>
    <div class="src">${esc(s.sub)}. Fuente: registro de candidaturas ganadoras INE / IEE Puebla.</div>`;
}
function afiliados() {
  const A = EST._afi, P = EST._pad && EST._pad.est; if (!A) return '';
  const rows = Object.entries(A).map(([p, d]) => ({ p, v: d.t })).sort((a, b) => b.v - a.v), max = rows[0].v;
  return `<div class="fz af">${rows.map((x, i) => `<div class="fz-r" style="--d:${i * 40}ms" ${tipA(`<b>${esc(pname(x.p))}</b><div class="tv"><strong>${fmt(x.v)}</strong> afiliados</div>${P ? `<span class="m">${p1(pct(x.v, P[1]))} de la lista nominal del estado</span>` : ''}`)}><span class="fz-n"><i style="background:${pcol(x.p)}"></i>${esc(x.p)}</span><span class="fz-b"><i style="width:${(x.v / max * 100).toFixed(1)}%;background:${pcol(x.p)}"></i></span><b>${fmt(x.v)}</b><small>${P ? p1(pct(x.v, P[1])) : ''}</small></div>`).join('')}</div>`;
}

/* ---------- desglose por unidad ---------- */
function subLevels(u) { return u === 'est' ? [['mun', 'Municipio'], ['dl', 'Distrito local'], ['df', 'Distrito federal'], ['sec', 'Sección']] : u === 'mun' ? [['sec', 'Sección']].concat(MS.key === 115 ? [['ja', 'Junta auxiliar']] : []) : (u === 'dl' || u === 'df') ? (new Set(secsOfUnit(u, MS.key).map(s => SECMUN[s])).size > 1 ? [['mun', 'Municipio'], ['sec', 'Sección']] : [['sec', 'Sección']]) : (u === 'ja' || u === 'col') ? [['sec', 'Sección']] : []; }
function subUnits(lvl, u, key, eid) {
  const out = [], E = EST[eid]; if (!E) return out;
  const push = (k, a, name) => { if (!a.t || !a.n) return; const w = verdict(eid, a); out.push({ k, a, w, name, r: ranking(eid, a) }); };
  if (u === 'est' && lvl !== 'sec') { for (const k of Object.keys(E[lvl] || {})) push(lvl === 'mun' ? +k : +k, agg(lvl, +k, eid), unitName(lvl, +k)); return out; }
  if (lvl === 'ja') { for (const f of GEO.juntas.features) push(f.properties.ja, agg('ja', f.properties.ja, eid), unitName('ja', f.properties.ja)); return out; }
  const ss = secsOfUnit(u, key);
  if (lvl === 'sec') { for (const s of ss) push(s, agg('sec', s, eid), 'Sección ' + s); return out; }
  if (lvl === 'mun') { const by = {}; for (const s of ss) { const m = SECMUN[s]; (by[m] = by[m] || EMPTY()); addPack(by[m], secPack(eid, s)); } for (const [m, a] of Object.entries(by)) push(+m, a, MUNN[m]); }
  return out;
}

/* =================== VENTANA DE EXPLORACIÓN (v10) =================== */
const MS = {};
const CSHORT = { 'Presidencia municipal': 'Ayuntamientos', 'Diputación local': 'Dip. locales', 'Diputación federal': 'Dip. federales', 'Gubernatura': 'Gubernatura', 'Senaduría': 'Senado', 'Presidencia de la República': 'Presidencia' };
function placeOpts(u, key) {
  const o = [[u, key]], add = (a, b) => { if (!o.some(x => x[0] === a && x[1] === b)) o.push([a, b]); };
  const mm = munOfUnit(u, key); if (mm != null) add('mun', mm); add('est', 0); return o;
}
function distsOf(u0, k0, t) { const p = t === 'dl' ? 'distrito_l' : 'distrito_f'; if (u0 === 'est') return [];
  return [...new Set(secsOfUnit(u0 === 'sec' || u0 === 'col' || u0 === 'ja' ? 'mun' : u0, u0 === 'mun' || u0 === 'dl' || u0 === 'df' ? k0 : munOfUnit(u0, k0)).map(s => GEO.secciones.byId[s].properties[p]))].sort((a, b) => a - b); }
function openExplore(kind) { const { u, key } = current(); Object.assign(MS, { kind, u0: u, k0: key, u, key, el: S.el, partes: S.partes || 'cand', lvl: null, sort: 'comp' }); openModal('<div id="xp"></div>'); drawExplore(); }
function drawExplore() {
  const { kind, u, key, el } = MS, m = ELS[el], a = agg(u, key, el), w = verdict(el, a), name = unitName(u, key), cargo = cargoBase(m.cargo), r = ranking(el, a);
  const dl = distsOf(MS.u0, MS.k0, 'dl'), df = distsOf(MS.u0, MS.k0, 'df');
  const _sel = (t, list, lbl) => `<select data-pick="${t}" aria-label="${lbl}"><option value="">${lbl}…</option>${list.map(x => `<option value="${x}" ${u === t && key === x ? 'selected' : ''}>${t === 'mun' ? esc(MUNN[x]) : lbl + ' ' + x}</option>`).join('')}</select>`;
  const years = CAT.elecciones.filter(x => cargoBase(x.cargo) === cargo);
  let h = `<div class="xp-top"><div><h3 id="mtitle">${kind === 'res' ? 'Resultados por partido / coalición' : 'Evolución del voto'}</h3><small>${esc(name)}${kind === 'res' && a.t ? (n => ` · ${fmt(n)} ${n === 1 ? 'sección' : 'secciones'} · ${fmt(a.t)} votos emitidos`)(secsOfUnit(u, key).length) : ` · ${esc(cargo)}, ${years.map(x => x.anio).filter((v, i, A) => A.indexOf(v) === i).join(', ')}`}</small></div>
    <div class="tabs xp-kind"><button data-k="res" class="${kind === 'res' ? 'on' : ''}">Resultados</button><button data-k="tr" class="${kind === 'tr' ? 'on' : ''}">Evolución</button></div></div>
    <div class="xp-bar"><div class="xp-places"><span class="xp-lbl">Lugar</span><div class="tabs">${placeOpts(MS.u0, MS.k0).map(([pu, pk]) => `<button data-pu="${pu}" data-pk="${pk}" class="${pu === u && pk === key ? 'on' : ''}">${esc(unitName(pu, pk))}</button>`).join('')}</div>
      ${u !== 'est' && (dl.length || df.length) ? `<span class="xp-lbl">Sus distritos</span><div class="tabs">${dl.map(d => `<button data-pu="dl" data-pk="${d}" class="${u === 'dl' && key === d ? 'on' : ''}">Local ${d}</button>`).join('')}</div><div class="tabs">${df.map(d => `<button data-pu="df" data-pk="${d}" class="${u === 'df' && key === d ? 'on' : ''}">Federal ${d}</button>`).join('')}</div>` : ''}</div>
    <div class="xp-els"><div class="tabs">${CARGOS.map(c => `<button data-cg="${c}" class="${c === cargo ? 'on' : ''}">${CSHORT[c]}</button>`).join('')}</div>
      ${kind === 'res' ? `<div class="tabs">${years.map(x => `<button data-xe="${x.id}" class="${x.id === el ? 'on' : ''}">${x.anio}${x.cargo.includes('extra') ? '*' : ''}</button>`).join('')}</div>` : ''}
      <span class="tabs" id="xp-partes"><button data-p="cand" class="${MS.partes === 'cand' ? 'on' : ''}">Por coalición</button><button data-p="part" class="${MS.partes === 'part' ? 'on' : ''}">Por partido</button></span></div></div>`;
  if (kind === 'res') {
    if (!a.t) h += `<div class="note">No hay resultados de ${esc(m.cargo.toLowerCase())} ${m.anio} en ${esc(name)}.</div>`;
    else { const p = prevOf(el), ap = p ? agg(u, key, p.id) : null, pa = a.ln ? pct(a.t, a.ln) : null, pp = ap && ap.ln && ap.t ? pct(ap.t, ap.ln) : null, t = topB(el, a, u, key), cl = t ? compLvl(t.margin) : null;
      h += `<div class="xk">${t ? `<div class="xk-c" style="--c:${t.g0.col}"><span>${t.many ? 'Fuerza con más votos' : 'Primer lugar'}</span><b style="color:${t.g0.col}">${esc(t.g0.name)}</b><small>${t.who ? esc(t.who) + ' · ' : ''}${p1(t.share)} · ${fmt(t.g0.v)} votos</small></div>` : ''}
        ${t && t.g1 ? `<div class="xk-c" style="--c:#BFB591"><span>Ventaja sobre el 2º lugar</span><b>${t.margin.toFixed(1)} puntos</b><small>${fmt(t.g0.v - t.g1.v)} votos más que ${esc(t.g1.name)}</small><em class="cmpt ${cl[0]}">${cl[1]}</em></div>` : ''}
        <div class="xk-c" style="--c:#4A5350"><span>Participación</span><b>${pa != null ? p1(pa) : '—'}</b><small>${pa != null ? 'de la lista nominal' : 'sin lista nominal en el cómputo'}${pa != null && pp != null ? ` · ${sgn(pa - pp)} pts vs ${p.anio}` : ''}</small></div>
        <div class="xk-c" style="--c:#828386"><span>Votos nulos y no registrados</span><b>${p1(pct(a.nu + a.nr, a.t))}</b><small>${fmt(a.nu + a.nr)} votos del total emitido</small></div></div>`;
      const lvls = subLevels(u), lvl = MS.lvl && lvls.some(x => x[0] === MS.lvl) ? MS.lvl : (lvls[0] || [])[0];
      const fine = u === 'est' ? 'mun' : lvls.length ? (lvls.find(x => x[0] === 'sec') || lvls[0])[0] : null, FU = fine ? subUnits(fine, u, key, el) : [];
      const fl = { sec: ['secciones', 'Secciones ganadas'], mun: ['municipios', 'Municipios ganados'], ja: ['juntas auxiliares', 'Juntas auxiliares ganadas'], dl: ['distritos locales', 'Distritos locales ganados'], df: ['distritos federales', 'Distritos federales ganados'] }[fine] || ['', ''];
      let side = '';
      if (FU.length > 1) { const cc = { alta: 0, media: 0, baja: 0 }, fz = {}; FU.forEach(x => { if (!x.w) return; cc[compLvl(x.w.margin)[0]]++; const k = x.w.tie ? 'Empate' : allyName(el, leadOf(x.w.c)); fz[k] = fz[k] || { n: 0, c: x.w.tie ? '#9AA3A3' : candColor(x.w.c) }; fz[k].n++; });
        const nn = FU.filter(x => x.w).length, pred = Object.entries(cc).sort((x, y) => y[1] - x[1])[0][0], mx = Math.max(...Object.values(fz).map(x => x.n));
        side = `<div class="xs"><div class="xs-b"><h4>Competencia en ${fl[0]}</h4><p>Margen entre 1º y 2º lugar en ${fmt(nn)} ${fl[0]} con resultado. Predomina la competencia <b>${pred}</b>.</p>
          ${[['alta', 'Alta', 'menos de 5 pts', '#7D2447'], ['media', 'Media', 'de 5 a 15 pts', '#BFB591'], ['baja', 'Baja', 'más de 15 pts', '#828386']].map(([k, l, d, c]) => `<div class="xs-r"><span>${l}<small>${d}</small></span><span class="fz-b"><i style="width:${pct(cc[k], nn).toFixed(1)}%;background:${c}"></i></span><b>${fmt(cc[k])}</b><small>${pct(cc[k], nn).toFixed(0)}%</small></div>`).join('')}</div>
          <div class="xs-b"><h4>${fl[1]} por fuerza</h4>${Object.entries(fz).sort((x, y) => y[1].n - x[1].n).slice(0, 6).map(([k, v]) => `<div class="xs-r"><span>${esc(k)}</span><span class="fz-b"><i style="width:${(v.n / mx * 100).toFixed(1)}%;background:${v.c}"></i></span><b>${fmt(v.n)}</b><small>${pct(v.n, nn).toFixed(0)}%</small></div>`).join('')}</div></div>`; }
      h += `<div class="xg${side ? '' : ' one'}"><div class="xg-c">${vcols(el, a, u, key, MS.partes, true)}</div>${side}</div>`;
      if (lvls.length) { const rows = subUnits(lvl, u, key, el), srt = MS.sort;
        rows.sort(srt === 'peso' ? (x, y) => y.a.ln - x.a.ln : srt === 'az' ? (x, y) => String(x.name).localeCompare(String(y.name), 'es', { numeric: true }) : (x, y) => (x.w ? x.w.margin : 999) - (y.w ? y.w.margin : 999));
        const mxl = Math.max(...rows.map(x => x.a.ln), 1), LIM = 150;
        h += `<details class="dz"${MS.dz ? ' open' : ''} id="dz-d"><summary><span class="xp-lbl">Desglose por ${esc(subLevels(u).find(x => x[0] === lvl)[1].toLowerCase())}</span><em>${fmt(rows.length)} · ver tabla</em></summary><div class="dz-bar"><span class="xp-lbl">Desglose por</span><div class="tabs">${lvls.map(([k, l]) => `<button data-lv="${k}" class="${k === lvl ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="tabs">${[['comp', 'Más competidos'], ['peso', 'Mayor peso electoral'], ['az', 'A–Z']].map(([k, l]) => `<button data-so="${k}" class="${k === srt ? 'on' : ''}">${l}</button>`).join('')}</div><input id="dz-q" type="search" placeholder="Buscar en ${fmt(rows.length)}…"></div>
          <table class="dzt"><thead><tr><th></th><th>${esc(subLevels(u).find(x => x[0] === lvl)[1])}</th><th>Reparto del voto</th><th>Ganador</th><th>Ventaja</th><th>Electores</th></tr></thead><tbody>
          ${rows.slice(0, LIM).map((x, i) => { const t3 = x.r.slice(0, 3), rest = x.a.t - t3.reduce((s, y) => s + y.v, 0), cl2 = x.w ? compLvl(x.w.margin)[0] : '';
            return `<tr data-go2="${lvl}:${x.k}" data-nm="${esc(norm(x.name))}"><td class="n">${i + 1}</td><td><b>${esc(x.name)}</b></td><td><div class="dz-rep">${t3.map(y => `<i style="flex:${y.v};background:${candColor(y.c)}" ${tipA(`<b>${esc(candShort(y.c))}</b><div class="tv"><strong>${p1(pct(y.v, x.a.t))}</strong> ${fmt(y.v)} votos</div>`)}></i>`).join('')}<i style="flex:${Math.max(rest, 0)};background:var(--nores)"></i></div></td>
              <td>${x.w ? `<span class="dz-w"><i style="background:${x.w.tie ? '#9AA3A3' : candColor(x.w.c)}"></i>${x.w.tie ? 'Empate' : esc(plusName(x.w.c))}</span>` : '—'}</td>
              <td>${x.w ? `<span class="dz-v ${cl2}"><b>${x.w.margin.toFixed(1)} pts</b><small>${fmt(x.r[0].v - (x.r[1] ? x.r[1].v : 0))} votos</small></span>` : ''}</td>
              <td><span class="dz-e"><i style="width:${(x.a.ln / mxl * 100).toFixed(1)}%"></i></span><small>${x.a.ln >= 1000 ? (x.a.ln / 1000).toFixed(0) + 'k' : fmt(x.a.ln)}</small></td></tr>`; }).join('')}</tbody></table>
          ${rows.length > LIM ? `<p class="xp-hint">Se muestran ${LIM} de ${fmt(rows.length)}. Usa el buscador para encontrar el resto.</p>` : ''}</details>`; }
    }
  } else {
    const rb = trendLine(u, key, cargo, MS.partes, 940, 420, el, true);
    h += rb ? trendKpis(u, key, cargo, MS.partes) + rb + `<p class="xp-hint">Pasa el cursor para ver el detalle de cada elección · clic en un partido para destacarlo · franja superior: partido ganador · clic en un año para ver sus resultados.</p>` : `<div class="note">Hace falta más de una elección de ${esc(cargo.toLowerCase())} con resultados aquí.</div>`;
  }
  const mapa = el !== S.el || !(u === current().u && key === current().key);
  h += `<div class="xp-foot"><span class="src">Fuente: ${esc(m.fuente)}. ${MS.partes === 'cand' ? 'Votos de coalición asignados a la candidatura.' : 'Votación propia de cada partido.'}</span>${mapa && u !== 'est' ? `<button class="btn pri" id="xp-map">Ver esto en el mapa</button>` : ''}</div>`;
  const X = $('#xp'); X.innerHTML = h; animate(X); bindTips(X); linkRows(X);
  $$('#xp [data-k]').forEach(b => b.onclick = () => { MS.kind = b.dataset.k; drawExplore(); });
  $$('#xp [data-pu]').forEach(b => b.onclick = () => { MS.u = b.dataset.pu; MS.key = MS.u === 'ja' ? b.dataset.pk : +b.dataset.pk; MS.lvl = null; drawExplore(); });
  $$('#xp [data-pick]').forEach(s => s.onchange = () => { if (!s.value) return; MS.u = s.dataset.pick; MS.key = +s.value; MS.lvl = null; drawExplore(); });
  $$('#xp [data-xe]').forEach(b => b.onclick = () => { MS.el = b.dataset.xe; drawExplore(); });
  $$('#xp [data-cg]').forEach(b => b.onclick = () => { const es = CAT.elecciones.filter(x => cargoBase(x.cargo) === b.dataset.cg && !x.cargo.includes('extra')).sort((a, b) => b.anio - a.anio); MS.el = es[0].id; TRF = null; drawExplore(); });
  $$('#xp-partes button').forEach(b => b.onclick = () => { MS.partes = b.dataset.p; TRF = null; drawExplore(); });
  $$('#xp [data-lv]').forEach(b => b.onclick = () => { MS.lvl = b.dataset.lv; drawExplore(); });
  $$('#xp [data-so]').forEach(b => b.onclick = () => { MS.sort = b.dataset.so; MS.lvl = MS.lvl || (subLevels(MS.u)[0] || [])[0]; drawExplore(); });
  $$('#xp [data-trf]').forEach(b => b.onclick = () => { TRF = b.dataset.trf; drawExplore(); });
  const dd = $('#dz-d'); if (dd) dd.ontoggle = () => { MS.dz = dd.open; };
  const q = $('#dz-q'); if (q) q.oninput = () => { const v = norm(q.value.trim()); $$('#xp .dzt tbody tr').forEach(tr => tr.hidden = v && !tr.dataset.nm.includes(v)); };
  $$('#xp [data-go2]').forEach(tr => tr.onclick = e => { if (e.target.closest('[data-tip]') && e.target.closest('.dz-rep')) return; const [lv, k] = tr.dataset.go2.split(':'); $('#modal').hidden = true; hideTip(); if (MS.el !== S.el) setEl(MS.el); goTo(lv, k); });
  $$('#xp .th').forEach(g => g.onclick = () => { hideTip(); MS.el = g.dataset.el; MS.kind = 'res'; drawExplore(); });
  const xm = $('#xp-map'); if (xm) xm.onclick = () => { $('#modal').hidden = true; hideTip(); if (MS.el !== S.el) setEl(MS.el); if (!(MS.u === current().u && MS.key === current().key)) goTo(MS.u, MS.key); };
}

/* =================== FICHA (v10) =================== */
function renderPanel() {
  const { u, key } = current(), m = ELS[S.el], a = agg(u, key, S.el), name = unitName(u, key), cargo = cargoBase(m.cargo);
  const crumb = S.sel ? `<div class="crumb"><button id="back">${esc(unitName(S.foco.u, S.foco.key))}</button><span>›</span><span>${esc(VK(S.sel.u).l)}</span></div>` : `<div class="crumb">${esc(m.cargo)} · ${m.anio}</div>`;
  let h = `<div class="ph">${crumb}<h2>${esc(name)}</h2><div class="acts-top"><button class="btn pri" id="btn-cmp">⇄ Comparar elecciones</button></div></div>`;
  if (a.n && a.t) h += card('res', 'Resultados electorales', resHead(S.el, a, u, key) + `<div class="k2-tabs">${partesTabs(S.partes)}</div>` + vcols(S.el, a, u, key, S.partes) + resSummary(S.el, a, u, key), { sub: `${esc(CSHORT[cargo])} ${m.anio} · ${esc(name)}` });
  else if (u !== 'sec') h += `<div class="note">No hubo elección de ${esc(m.cargo.toLowerCase())} en ${m.anio} aquí.</div>`;
  h += notes(u, a) + context(u, key);
  const tr = trendLine(u, key, cargo, 'cand', 420, 250, S.el); if (tr) h += card('tr', 'Evolución del voto', trendHead(u, key, cargo, 'cand', S.el) + tr, { sub: `${esc(cargo)} · ${esc(name)}` });
  const dg = datosGen(u, key); if (dg) h += card('dat', 'Datos generales', dg, { sub: `${esc(name)} · corte ${esc(CAT.padron.corte)}`, zoom: false });
  const st = m.tipo === 'SEN' ? null : seats(); if (st) h += card('seats', esc(st.title), seatsBody(st), { sub: 'Todo el estado de Puebla', icon: st.t === 'AYU' ? 'ayu' : 'cong', cls: 'state', zoom: false });
  const ce = m.tipo !== 'DL' ? congEl() : null, sc2 = ce ? seats(ce) : null;
  if (sc2) h += card('cong', esc(sc2.title), seatsBody(sc2), { sub: 'Todo el estado de Puebla', cls: 'state', zoom: false });
  if (CAPAS.alcance === 'todo' && EST._afi) h += card('afi', 'Afiliados por partido', afiliados() + `<div class="src">${esc(CAT.afiliados.fuente)}.</div>`, { sub: 'Todo el estado · % de la lista nominal', zoom: false, cls: 'state' });
  h += `<div class="src">Fuente: ${esc(m.fuente)}, ${m.anio}. ${esc(CAT.fuentes.cartografia)}. ${esc(CAT.padron.fuente)}.</div>`;
  const B = $('#pbody'); B.innerHTML = h; B.scrollTop = 0; animate(B); linkRows(B); bindTips(B); hideTip();
  $$('#pbody .th').forEach(g => g.onclick = () => { hideTip(); setEl(g.dataset.el); });
  $$('#pbody [data-trf]').forEach(b => b.onclick = () => { TRF = TRF === b.dataset.trf ? null : b.dataset.trf; renderPanel(); });
  $$('#pbody [data-bloc]').forEach(c => { c.onmouseenter = () => mapFocusParty(c.dataset.bloc); c.onmouseleave = () => highlight(); });
  const back = $('#back'); if (back) back.onclick = () => select(null);
  $$('#partes button').forEach(b => b.onclick = () => { S.partes = b.dataset.p; renderPanel(); });
  $$('[data-go]').forEach(b => b.onclick = () => { const [v, k] = b.dataset.go.split(/:(.*)/s); goTo(v, k); });
  $$('[data-secs]').forEach(b => b.onclick = () => { const k = +b.dataset.secs; S.foco = { u: 'mun', key: k }; setVista('sec', true); select({ u: 'mun', key: k }); fitGeom(geomOf('mun', k)); });
  $$('[data-zoom]').forEach(b => b.onclick = () => expand(b.dataset.zoom));
  $('#btn-cmp').onclick = openCompare;
  peekSize();
}
function expand(id) {
  if (id === 'res' || id === 'tr') return openExplore(id);
  const st = id === 'cong' ? seats(congEl()) : seats(); if (!st) return;
  openModal(`<div class="xp-top"><div><h3 id="mtitle">${esc(st.title)}</h3><small>Todo el estado de Puebla</small></div></div><div class="k2 big">${seatsBody(st)}</div>`);
  bindTips($('#mbody')); $$('#mbody [data-bloc]').forEach(c => { c.onmouseenter = () => mapFocusParty(c.dataset.bloc); c.onmouseleave = () => highlight(); });
}

/* =================== COMPARAR (v7) =================== */
const CMP = { a: null, b: null, mode: 'cand' };
function sharesOf(eid, a, mode) { const by = {}; if (!a.t) return by; if (mode === 'part') ELS[eid].part.forEach((p, i) => { if (a.p && a.p[i] > 0) by[p] = pct(a.p[i], a.t); }); else Object.assign(by, blocs(eid, a)); return by; }
function cmpView(u, key, ea, eb, big, mode = 'cand') {
  const A = ELS[ea], B = ELS[eb], aa = agg(u, key, ea), ab = agg(u, key, eb);
  if (!aa.t || !ab.t) return `<div class="note">No hay resultados aquí en ${!aa.t ? A.anio + ' (' + cargoBase(A.cargo) + ')' : B.anio + ' (' + cargoBase(B.cargo) + ')'}.</div>`;
  const ba = sharesOf(ea, aa, mode), bb = sharesOf(eb, ab, mode), wa = verdict(ea, aa), wb = verdict(eb, ab);
  const ks = [...new Set([...Object.keys(ba), ...Object.keys(bb)])].filter(p => p !== 'IND').sort((x, y) => Math.max(bb[y] || 0, ba[y] || 0) - Math.max(bb[x] || 0, ba[x] || 0)).slice(0, 7);
  const ally = p => mode !== 'part' && ranking(ea, aa).concat(ranking(eb, ab)).some(r => leadOf(r.c) === p && r.c.includes('-'));
  const nm = p => p + (ally(p) ? ' y aliados' : '');
  const tag = (E) => `${E.anio}${E.cargo.includes('extra') ? '*' : ''} · ${esc(CSHORT[cargoBase(E.cargo)])}`;
  const kc = (E, a, w, L) => { const who = w ? personFor(E.id, u, key, w.c) : null, c = w ? candColor(w.c) : '#828386';
    return `<div class="xk-c" style="--c:${c}"><span><b class="cc-tag">${L}</b>${tag(E)}</span><b style="color:${c}">${w ? esc(candShort(w.c)) : '—'}</b><small>${who ? esc(who) + ' · ' : ''}${w ? p1(w.share) + ' · ventaja ' + w.margin.toFixed(1) + ' pts' : ''}</small><small>${a.ln ? 'Participación ' + p1(pct(a.t, a.ln)) : fmt(a.t) + ' votos'}</small></div>`; };
  const pa = aa.ln ? pct(aa.t, aa.ln) : null, pb = ab.ln ? pct(ab.t, ab.ln) : null;
  const same = wa && wb && leadOf(wa.c) === leadOf(wb.c);
  const kd = `<div class="xk-c" style="--c:${same ? '#4A5350' : '#BFB591'}"><span>Resultado</span><b>${wa && wb ? (same ? 'Repitió' : 'Cambió quien gana') : '—'}</b><small>${wa && wb ? (same ? `${esc(nm(leadOf(wb.c)))} ganó las dos` : `de ${esc(plusName(wa.c))} a ${esc(plusName(wb.c))}`) : ''}</small>${pa != null && pb != null ? `<small>Participación ${dBadge(pb - pa, ' pts')}</small>` : ''}</div>`;
  // columnas agrupadas con escala
  const vmax = Math.max(...ks.map(p => Math.max(ba[p] || 0, bb[p] || 0)), 5), step = vmax > 60 ? 20 : 10, top = Math.ceil(vmax * 1.15 / step) * step, H = big ? 260 : 200;
  const grid = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step).map(t => `<div class="vg" style="bottom:${t / top * 100}%"><span>${t}%</span></div>`).join('');
  const solo = mode === 'part' ? 'sin votos propios' : 'fue dentro de la coalición de otro partido';
  const groups = ks.map((p, i) => { const x = ba[p] || 0, y = bb[p] || 0, d = y - x, c = pcol(p), both = x > 0 && y > 0;
    const tip = `<b>${esc(nm(p))}</b><div class="tl"><div>A · ${A.anio}<b>${x ? p1(x) : '—'}</b></div><div>B · ${B.anio}<b>${y ? p1(y) : '—'}</b></div></div><span class="m">${both ? `Diferencia: ${sgn(d)} puntos` : `— ${solo}`}</span>`;
    const bar = (v, cls) => `<div class="cb ${cls}">${v > 0 ? `<em style="bottom:calc(${(v / top * 100).toFixed(2)}% + 3px)">${v.toFixed(1)}</em><i style="height:${(v / top * 100).toFixed(2)}%;${cls === 'a' ? `background:repeating-linear-gradient(135deg,${mix(c, '#ffffff', .35)} 0 3px,${mix(c, '#ffffff', .7)} 3px 6px)` : `background:${c}`}"></i>` : ''}</div>`;
    return `<div class="cgx" ${tipA(tip)} style="--d:${i * 70}ms;--c:${c}"><div class="cgx-a">${bar(x, 'a')}${bar(y, 'b')}</div><div class="vc2-n"><b>${esc(p)}${ally(p) ? '+' : ''}</b>${both ? dBadge(d) : `<span class="db2 na">${x ? 'solo A' : 'solo B'}</span>`}</div></div>`; }).join('');
  // dónde cambió el ganador
  let ch = '';
  if (big) { const lvl = u === 'est' ? 'mun' : (u === 'mun' || u === 'dl' || u === 'df' || u === 'ja' || u === 'col') ? 'sec' : null;
    if (lvl) { const UA = Object.fromEntries(subUnits(lvl, u, key, ea).map(x => [x.k, x])), UB = subUnits(lvl, u, key, eb);
      const rows = UB.filter(x => UA[x.k] && UA[x.k].w && x.w && !x.w.tie && !UA[x.k].w.tie).map(x => ({ x, a: UA[x.k], c: leadOf(UA[x.k].w.c) !== leadOf(x.w.c) }));
      const nc = rows.filter(r => r.c).length, flows = {};
      rows.filter(r => r.c).forEach(r => { const f = leadOf(r.a.w.c) + '→' + leadOf(r.x.w.c); flows[f] = (flows[f] || 0) + 1; });
      const lw = lvl === 'mun' ? ['municipios', 'Municipio'] : ['secciones', 'Sección'];
      if (rows.length) ch = `<div class="dz"><div class="dz-bar"><span class="xp-lbl">Dónde cambió quien gana</span><span class="pill ${nc ? '' : 'up'}">${fmt(nc)} de ${fmt(rows.length)} ${lw[0]} cambiaron (${pct(nc, rows.length).toFixed(0)}%)</span></div>
        ${nc ? `<div class="flw">${Object.entries(flows).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([f, n]) => { const [p, q] = f.split('→'); return `<span class="fl">${chip(p, 1)}<em>→</em>${chip(q, 1)}<b>${fmt(n)}</b></span>`; }).join('')}</div>
        <details class="dz-in"${CMP.open ? ' open' : ''}><summary>${fmt(nc)} ${lw[0]} que cambiaron · ver tabla</summary><table class="dzt"><thead><tr><th>${lw[1]}</th><th>Ganó en ${A.anio}</th><th>Ganó en ${B.anio}</th><th>Ventaja ${B.anio}</th><th>Electores</th></tr></thead><tbody>
        ${rows.filter(r => r.c).sort((a, b) => b.x.a.ln - a.x.a.ln).slice(0, 60).map(r => `<tr data-go2="${lvl}:${r.x.k}"><td><b>${esc(r.x.name)}</b></td><td><span class="dz-w"><i style="background:${candColor(r.a.w.c)}"></i>${esc(plusName(r.a.w.c))} · ${r.a.w.share.toFixed(0)}%</span></td><td><span class="dz-w"><i style="background:${candColor(r.x.w.c)}"></i>${esc(plusName(r.x.w.c))} · ${r.x.w.share.toFixed(0)}%</span></td><td><span class="dz-v ${compLvl(r.x.w.margin)[0]}"><b>${r.x.w.margin.toFixed(1)} pts</b></span></td><td>${fmt(r.x.a.ln)}</td></tr>`).join('')}</tbody></table>
        ${nc > 60 ? '<p class="xp-hint">Se muestran las 60 con más electores.</p>' : ''}</details>` : ''}</div>`; } }
  return `<div class="cvx"><div class="xk three">${kc(A, aa, wa, 'A')}${kc(B, ab, wb, 'B')}${kd}</div>
    <div class="cgc2"><div class="cmp-lg"><span><i class="ia"></i>A · ${A.anio}</span><span><i class="ib"></i>B · ${B.anio}</span><span class="r">% de votos · debajo, diferencia en puntos</span></div>
    <div class="vc2" style="--h:${H}px;--n:${ks.length}"><div class="vc2-g" style="top:0">${grid}</div><div class="cgx-p">${groups}</div></div></div>
    <div class="src">${mode === 'part' ? 'Votación propia de cada partido.' : 'Cada partido junto con sus aliados en esa elección.'}</div>${ch}</div>`;
}
function openCompare() {
  const { u, key } = current();
  CMP.b = S.el; CMP.a = (cmpEl() || ELS[S.el]).id;
  const pick = side => { const e = ELS[CMP[side]], cargo = cargoBase(e.cargo);
    return `<div class="cpx"><b class="cc-tag">${side.toUpperCase()}</b><div class="tabs">${CARGOS.map(c => `<button data-side="${side}" data-cg="${c}" class="${c === cargo ? 'on' : ''}">${CSHORT[c]}</button>`).join('')}</div>
      <div class="tabs">${CAT.elecciones.filter(x => cargoBase(x.cargo) === cargo).map(x => `<button data-side="${side}" data-e="${x.id}" class="${x.id === e.id ? 'on' : ''}">${x.anio}${x.cargo.includes('extra') ? '*' : ''}</button>`).join('')}</div></div>`; };
  const draw = () => { $('#cmp-body').innerHTML = `<div class="xp-bar">${pick('a')}${pick('b')}<div class="cpx"><span class="xp-lbl">Ver</span>${partesTabs(CMP.mode, 'cmp-partes')}</div></div>${cmpView(u, key, CMP.a, CMP.b, true, CMP.mode)}`; animate($('#cmp-body')); bindTips($('#cmp-body'));
    $$('#cmp-body button[data-cg]').forEach(b => b.onclick = () => { const es = CAT.elecciones.filter(x => cargoBase(x.cargo) === b.dataset.cg && !x.cargo.includes('extra')).sort((a, b) => b.anio - a.anio); CMP[b.dataset.side] = (b.dataset.side === 'a' && es[1] ? es[1] : es[0]).id; draw(); });
    $$('#cmp-body button[data-e]').forEach(bt => bt.onclick = () => { CMP[bt.dataset.side] = bt.dataset.e; draw(); });
    $$('#cmp-partes button').forEach(b => b.onclick = () => { CMP.mode = b.dataset.p; draw(); });
    const di = $('#cmp-body .dz-in'); if (di) di.ontoggle = () => { CMP.open = di.open; };
    $$('#cmp-body [data-go2]').forEach(tr => tr.onclick = () => { const [lv, k] = tr.dataset.go2.split(':'); $('#modal').hidden = true; hideTip(); if (CMP.b !== S.el) setEl(CMP.b); goTo(lv, k); }); };
  openModal(`<div class="xp-top"><div><h3 id="mtitle">Comparar elecciones</h3><small>${esc(unitName(u, key))} · elige la elección A y la B</small></div></div><div id="cmp-body"></div>`);
  draw();
}

/* =================== LEYENDA Y MODO DE COLOR =================== */
function fillModo() { const m = ELS[S.el], p = prevOf(S.el); if (!['win', 'part', ...(p ? ['cambio'] : []), ...m.cand].includes(S.modo)) S.modo = 'win'; }
function legend() {
  const L = $('#legend'), m = ELS[S.el], p = prevOf(S.el); let h = `<div class="lg-el">${esc(m.cargo)} <b>${m.anio}</b></div>`;
  const g = cssVar('--fg'), bg = cssVar('--mapbg'), isC = !['win', 'part', 'cambio'].includes(S.modo);
  h += `<div class="lg-modes">${[['win', 'Quién ganó'], ['part', 'Participación']].map(([k, l]) => `<button data-modo="${k}" class="${S.modo === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (S.modo === 'win') { const sc = scope(), A = VK(S.vista).k === 'mun' ? MUNAGG : AGG, cnt = {}, vv = VK(S.vista); let tot = 0;
    for (const f of GEO[vv.geo].features) { const q = f.properties; if (!sc.t(q)) continue; const u = A[q[vv.id]]; if (!u || !u.w) continue; tot++; const k = u.w.tie ? '_e' : leadOf(u.w.c); cnt[k] = (cnt[k] || 0) + 1; }
    h += `<div class="lg-win">${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<span class="it">${k === '_e' ? '<span class="sw" style="background:#9AA3A3"></span>Empate' : chip(k, 1)}<b>${n}</b></span>`).join('')}</div><div class="lg-n">${tot} ${({ sec: 'secciones', col: 'colonias', ja: 'juntas auxiliares', mun: 'municipios', dl: 'distritos locales', df: 'distritos federales' })[S.vista]} en total</div>`; }
  else if (S.modo === 'cambio') { const c = cmpEl(); const n = Object.entries(AGG).filter(([k, u]) => u.w && c && (w0 => w0 && leadOf(w0.c) !== leadOf(u.w.c))(verdict(c.id, agg(S.vista, S.vista === 'ja' ? k : +k, c.id)))).length;
    h += `<div class="items"><span class="it"><span class="sw" style="background:${g}"></span>Cambió de partido (${n})</span><span class="it"><span class="sw" style="background:${mix(g, bg, .8)}"></span>Repitió</span></div>`; }
  else { const isP = S.modo === 'part', base = isP ? '#4C6B66' : candColor(S.modo), bins = isP ? BINS_P : BINS_C;
    if (isC) h += `<div class="lg-cand">Votación de ${chips(S.modo)}<button data-modo="win" title="Quitar">✕</button></div>`;
    h += `<div class="ramp">${[0, 1, 2, 3, 4].map(i => `<span style="background:${rampColor(base, i)}"></span>`).join('')}</div><div class="rampl"><span>0</span>${bins.map(b => `<span>${b}</span>`).join('')}<span>100 %</span></div>`;
    if (isP && !m.ln) h += `<div class="items"><span class="it">El cómputo de ${m.anio} no trae lista nominal.</span></div>`; }
  const v = VK(S.vista), nores = Object.values(AGG).filter(u => !u.w).length;
  if (nores && v.k === 'sec') h += `<div class="items"><span class="it"><span class="sw" style="background:${cssVar('--nores')};background-image:repeating-linear-gradient(135deg,rgba(110,120,115,.6) 0 1px,transparent 1px 4px)"></span>Secciones creadas después de ${m.anio}</span></div>`;
  L.innerHTML = h;
  L.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => { S.modo = b.dataset.modo; paint(); });
}

/* pasar el cursor por una candidatura resalta en el mapa dónde ganó; el clic colorea por su votación */
function linkRows(root) {
  root.querySelectorAll('[data-part]').forEach(el => { el.addEventListener('mouseenter', () => mapShare('part', el.dataset.part)); el.addEventListener('mouseleave', () => { clearShare(); highlight(); }); });
  root.querySelectorAll('[data-cand]').forEach(el => {
    el.addEventListener('mouseenter', () => { if (root.id === 'hero') mapFocusCand(el.dataset.cand); else mapShare('cand', el.dataset.cand); });
    el.addEventListener('mouseleave', () => { clearShare(); highlight(); });
    el.addEventListener('click', e => { if (e.target.closest('button,select')) return; const c = el.dataset.cand; if (ELS[S.el].cand.includes(c) && !c.startsWith('CAND_IND')) { S.modo = S.modo === c ? 'win' : c; paint(); } });
  });
}
function mapFocusCand(c) { const v = VK(S.vista), i = ELS[S.el].cand.indexOf(c); if (i < 0) return;
  map.setPaintProperty('f-' + v.geo, 'fill-opacity', ['case', ['all', scope().e, ['==', ['feature-state', 'wl'], i]], .95, .07]); }
function mapFocusParty(p) { map.setPaintProperty('f-municipios', 'fill-opacity', ['case', ['==', ['feature-state', 'wp'], p], .95, .06]);
  const v = VK(S.vista); if (v.k !== 'mun') map.setPaintProperty('f-' + v.geo, 'fill-opacity', .04); }

/* =================== COMPOSICIÓN: CONGRESO Y AYUNTAMIENTOS =================== */
function blocOf(eid, party) { const c = ELS[eid].cand.find(x => !x.startsWith('CAND_IND') && x.split('-').includes(party)); return c ? leadOf(c) : party; }
function seatParty(eid, partido, actor) {
  const ps = (partido || '').split(/[_-]/).filter(Boolean); if (ps.length === 1) return ps[0];
  const as = (actor === 'COM_MEXICO' ? 'PRI_PVEM' : (actor || '').replace(/^C_COMUN_/, '')).split(/[_-]/).filter(Boolean);
  return blocOf(eid, (ps[0] || as[0] || '?'));
}
function seats(eid = S.el) {
  const m = ELS[eid], t = m.tipo, CG = EST._cong || {};
  let list = [], title = '', sub = '';
  const mk = (arr, k) => (arr || []).map(s => { const p = seatParty(eid, s[0], s[1]); return { p, b: blocOf(eid, p), k }; });
  if (t === 'DL' && CG.DL && CG.DL[m.anio]) { const d = CG.DL[m.anio]; list = mk(d.mr, 'mr').concat(mk(d.rp, 'rp')); title = `Congreso del Estado · ${m.anio}`; sub = `${list.length} diputaciones: ${(d.mr || []).length} de mayoría y ${(d.rp || []).length} plurinominales`; }
  else if (t === 'DF' && CG.DF && CG.DF[m.anio]) { list = mk(CG.DF[m.anio].mr, 'mr'); title = `Diputaciones federales de Puebla · ${m.anio}`; sub = `Los ${list.length} distritos de mayoría del estado`; }
  else if (t === 'SEN' && CG.SEN && CG.SEN[m.anio]) { list = mk(CG.SEN[m.anio].mr, 'mr'); title = `Senado por Puebla · ${m.anio}`; sub = 'Dos escaños de mayoría y uno de primera minoría'; }
  else if (t === 'AYU') { for (const [k, pk] of Object.entries(EST[eid].mun)) { const o = EMPTY(); addPack(o, pk); const w = verdict(eid, o); if (w && !w.tie) list.push({ p: leadOf(w.c), b: leadOf(w.c), k: 'mr', m: +k, co: w.c.includes('-') }); } title = `Ayuntamientos del estado · ${m.anio}`; sub = `${list.length} presidencias municipales`; }
  if (!list.length) return null;
  const bl = {}; list.forEach(s => { bl[s.b] = bl[s.b] || { n: 0, parts: {} }; bl[s.b].n++; bl[s.b].parts[s.p] = (bl[s.b].parts[s.p] || 0) + 1; });
  const order = Object.entries(bl).sort((a, b) => b[1].n - a[1].n).map(x => x[0]);
  list.sort((x, y) => order.indexOf(x.b) - order.indexOf(y.b) || (bl[y.b].parts[y.p] - bl[x.b].parts[x.p]) || x.p.localeCompare(y.p));
  const total = list.length, may = Math.floor(total / 2) + 1, cal = Math.ceil(total * 2 / 3), lead = order[0], nl = bl[lead].n;
  const nm = p => p + (m.cand.some(c => leadOf(c) === p && c.includes('-')) ? ' y aliados' : '');
  const ver = t === 'AYU' ? `<b>${esc(lead)}</b>, solo o encabezando coalición, ganó <b>${nl}</b> de ${total} municipios.` : t === 'SEN' ? `<b>${esc(nm(lead))}</b> obtuvo ${nl} de ${total} escaños.`
    : nl >= cal ? `<b>${esc(nm(lead))}</b> tiene <b>${nl}</b> de ${total}: <b>mayoría calificada</b>.` : nl >= may ? `<b>${esc(nm(lead))}</b> tiene <b>${nl}</b> de ${total}: <b>mayoría</b>.` : `Nadie tiene mayoría. ${esc(nm(lead))} tiene ${nl} y se necesitan ${may}.`;
  return { title, sub, total, list, bl, order, may, cal, ver, t, nm, eid };
}
function congEl() {
  const CG = EST._cong || {}, y = ELS[S.el].anio;
  const ds = CAT.elecciones.filter(e => ELS[e.id].tipo === 'DL' && CG.DL && CG.DL[e.anio] && e.anio <= y).sort((a, b) => b.anio - a.anio);
  return ds.length ? ds[0].id : null;
}
function animate(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.querySelectorAll('[data-w]').forEach(el => el.style.width = el.dataset.w + '%');
    root.querySelectorAll('.stk i').forEach(el => el.style.width = el.style.getPropertyValue('--w'));
    root.querySelectorAll('[data-n]').forEach(el => { const to = +el.dataset.n, dec = +(el.dataset.d || 0), suf = el.dataset.s || '', t0 = performance.now();
      const step = t => { const k = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - k, 3), v = to * e; el.textContent = (dec ? v.toFixed(dec) : fmt(v)) + suf; if (k < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); });
  }));
}
/* pasar el cursor por una candidatura resalta en el mapa dónde ganó; tocarla colorea por su votación */
/* =================== FICHA =================== */
function current() { const s = S.sel || S.foco; return { u: s.u, key: s.key }; }
function context(u, key) {
  const chp = (go, t) => `<button class="chip" data-go="${go}">${esc(t)}</button>`;
  if (u === 'sec') { const p = GEO.secciones.byId[key].properties, cols = COLS_OF_SEC[key] || [];
    return `<div class="chips">${chp('mun:' + p.municipio, unitName('mun', p.municipio))}${p.ja ? chp('ja:' + p.ja, p.ja) : ''}${chp('dl:' + p.distrito_l, 'Distrito local ' + p.distrito_l)}${chp('df:' + p.distrito_f, 'Distrito federal ' + p.distrito_f)}</div>`
      + (cols.length ? `<div class="chips">${cols.slice(0, 10).map(c => chp('col:' + c, GEO.colonias.byId[c].properties.nombre)).join('')}${cols.length > 10 ? `<span class="chip static">y ${cols.length - 10} colonias más</span>` : ''}</div>` : ''); }
  if (u === 'col') { const p = GEO.colonias.byId[key].properties;
    return `<div class="chips"><span class="chip static">CP ${esc(p.cp)}</span>${chp('mun:' + p.municipio, unitName('mun', p.municipio))}${p.ja ? chp('ja:' + p.ja, p.ja) : ''}${p.secs.map(s => chp('sec:' + s, 'Sección ' + s)).join('')}</div>`; }
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
function openModal(html) { const M = $('#modal'); $('#mbody').innerHTML = html; M.hidden = false; animate(M); const close = () => { M.hidden = true; hideTip(); highlight(); }; $('#mclose').onclick = close; M.onclick = e => { if (e.target === M) close(); }; }
function showUsers() {
  const U = MB.admin.usuarios;
  openModal(`<h3 id="mtitle">Usuarios</h3><p class="msub">Se administran en el Excel de usuarios; al correr pipeline/acceso.py se vuelven a cifrar los accesos.</p><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Nivel</th><th>Ámbito</th></tr></thead><tbody>${U.map(u => `<tr><td>${esc(u.usuario)}</td><td>${esc(u.nombre)}</td><td>${esc(u.nivel)}</td><td>${esc(u.ambito || 'Todo')}</td></tr>`).join('')}</tbody></table>`);
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
function goHome() { CAPAS.alcance = 'foco'; if (map.getLayer('z-zm-l')) applyCapas(); store.set('pe_capas3', CAPAS); $$('[data-alc]').forEach(x => x.classList.toggle('on', x.dataset.alc === 'foco')); S.foco = { u: HOME.u, key: HOME.key }; S.sel = null; setVista(HOME.vista, true); select(null); fitGeom(geomOf(HOME.u, HOME.key)); }
function setVista(k, keepSel) {
  S.vista = k; if (!keepSel) S.sel = null;
  for (const x of VISTAS) { if (x.k === 'mun') continue; const on = x.k === k; for (const p of ['f-', 'l-', 't-']) if (map.getLayer(p + x.geo)) map.setLayoutProperty(p + x.geo, 'visibility', on ? 'visible' : 'none'); }
  map.setLayoutProperty('f-municipios', 'visibility', CAPAS.estado || k === 'mun' ? 'visible' : 'none');
  $$('#vistas button').forEach(b => b.classList.toggle('on', b.dataset.v === k));
  syncVistaAvail();
  paint(); if (map.getLayer('dl-o')) applyCapas(); else labels();
  if (!keepSel) select(null); else select(S.sel);
}
function syncVistaAvail() {
  const m = S.foco.u === 'mun' ? S.foco.key : null;
  // junta auxiliar y colonia solo aparecen donde hay información
  $$('#vistas button').forEach(b => { const v = b.dataset.v, off = (v === 'ja' && !(m === 115 && DETOK.includes(115))) || (v === 'col' && !(m != null && CAT.detalle.includes(m) && DETOK.includes(m))) || (v === 'sec' && !DETOK.length); b.hidden = off; b.disabled = off; });
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
  $('#anios').innerHTML = years.map(y => { const es = CAT.elecciones.filter(e => e.anio === y && cargoBase(e.cargo) === cargo); if (!es.length) return '';
    return es.map(e => `<button data-el="${e.id}" class="${e.id === S.el ? 'on' : ''}" title="${esc(e.cargo)} ${e.anio}">${e.anio}${e.cargo.includes('extra') ? '*' : ''}</button>`).join(''); }).join('');
  $$('#anios button').forEach(b => b.onclick = () => setEl(b.dataset.el));
  const on = $('#anios .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function buildControls() {
  $('#cargo').innerHTML = CARGOS.map(c => { const ys = CAT.elecciones.filter(e => cargoBase(e.cargo) === c).map(e => e.anio); return `<option value="${c}">${c}</option>`; }).join('');
  $('#cargo').onchange = e => { const last = CAT.elecciones.filter(x => cargoBase(x.cargo) === e.target.value && !x.cargo.includes('extra')).sort((a, b) => b.anio - a.anio)[0]; setEl(last.id); };
  $('#vistas').innerHTML = VISTAS.map(v => `<button data-v="${v.k}" class="${v.k === S.vista ? 'on' : ''}">${v.l}</button>`).join('');
  $$('#vistas button').forEach(b => b.onclick = () => { const k = b.dataset.v; setVista(k); if (VK(k).det) fitGeom(geomOf(S.foco.u, S.foco.key)); });
  syncElControls(); fillModo();
  const C = $('#capas'), btn = $('#btn-capas');
  C.innerHTML = `<div class="grp"><h4>Ver a color</h4><div class="tabs alc" id="alcance">${[['foco', unitName(HOME.u, HOME.key)], ['conurb', 'Zona conurbada'], ['zm', 'Zona metropolitana'], ['todo', 'Todo el estado']].map(([k, l]) => `<button data-alc="${k}" class="${CAPAS.alcance === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div></div>
    <div class="grp"><h4>Capas</h4>${CAPAS_DEF.map(([k, l, , sw]) => `<label class="tg"><input type="checkbox" data-capa="${k}" ${CAPAS[k] ? 'checked' : ''}>${l}${sw ? `<span class="sw-line" style="border-color:${LINE_COL[sw]}"></span>` : ''}</label>`).join('')}</div>`;
  $$('[data-alc]').forEach(b => b.onclick = () => { CAPAS.alcance = b.dataset.alc; store.set('pe_capas3', CAPAS); $$('[data-alc]').forEach(x => x.classList.toggle('on', x === b));
    applyCapas(); if (CAPAS.alcance === 'foco') goHome(); else { S.sel = null; select(null); fitGeom(CAPAS.alcance === 'zm' ? GEO.zm.features[0].geometry : CAPAS.alcance === 'conurb' ? { coordinates: GEO.municipios.features.filter(f => f.properties.det).map(f => f.geometry.coordinates) } : GEO.estado_bbox); } labels(); });
  btn.onclick = () => { const o = C.hidden; C.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
  $$('[data-capa]').forEach(i => i.onchange = () => { CAPAS[i.dataset.capa] = i.checked; store.set('pe_capas3', CAPAS); applyCapas(); });
  $('#who').innerHTML = `<b>${esc(PERFIL.nombre)}</b> · ${esc(PERFIL.nivel_n)}${PERFIL.ambito ? ' ' + esc(PERFIL.ambito) : ''}`;
  $('#btn-out').onclick = () => { sess.del('pe_s'); location.reload(); };
  if (MB.admin) { $('#btn-users').hidden = false; $('#btn-users').onclick = showUsers; }
  $('#home-l').textContent = 'Volver a ' + unitName(HOME.u, HOME.key);
  $('#btn-home').onclick = goHome;
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) $('#modal').hidden = true; else if (S.sel) select(null); } });
}
function applyCapas() {
  const vis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  vis('f-municipios', CAPAS.estado || S.vista === 'mun'); vis('l-municipios', CAPAS.estado || S.vista === 'mun');
  vis('zm-l', false); vis('det-l', false);
  for (const z of ['conurb', 'zm']) { vis('z-' + z + '-c', CAPAS.alcance === z); vis('z-' + z + '-l', CAPAS.alcance === z); }
  vis('dl-o', CAPAS.dl || S.vista === 'dl'); vis('df-o', CAPAS.df || S.vista === 'df'); vis('dl-c', CAPAS.dl || S.vista === 'dl'); vis('df-c', CAPAS.df || S.vista === 'df');
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
  if (S.vista !== 'ja' && CAPAS.nombres !== false) for (const f of GEO.municipios.features) { const p = f.properties; const { c, a } = centroid(f.geometry); add(c, p.municipio === 115 ? 'Puebla' : p.nombre, p.det ? 'big' : '', a + (p.municipio === 115 ? 3 : p.det ? 1 : 0)); }
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
  src('g-zm', GEO.zm); src('g-conurb', GEO.conurb);
  const fillPaint = () => ({ 'fill-color': ['coalesce', ['feature-state', 'hc'], ['feature-state', 'c'], nores], 'fill-color-transition': { duration: 500 }, 'fill-opacity-transition': { duration: 450 }, 'fill-opacity': .85 });
  const W = (a, b, c) => ['interpolate', ['linear'], ['zoom'], 8, a, 11, b, 15, c];
  addL({ id: 'f-municipios', type: 'fill', source: 'g-municipios', paint: fillPaint() });
  for (const v of VISTAS.filter(v => v.k !== 'mun')) addL({ id: 'f-' + v.geo, type: 'fill', source: 'g-' + v.geo, layout: { visibility: 'none' }, paint: fillPaint() });
  const cv = document.createElement('canvas'); cv.width = cv.height = 8; const cx = cv.getContext('2d');
  cx.strokeStyle = 'rgba(110,120,115,.6)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(0, 8); cx.lineTo(8, 0); cx.moveTo(-2, 2); cx.lineTo(2, -2); cx.moveTo(6, 10); cx.lineTo(10, 6); cx.stroke();
  map.addImage('trama', { width: 8, height: 8, data: cx.getImageData(0, 0, 8, 8).data });
  for (const v of VISTAS.filter(v => v.det)) addL({ id: 't-' + v.geo, type: 'fill', source: 'g-' + v.geo, layout: { visibility: 'none' }, filter: ['==', ['get', v.id], '__none__'], paint: { 'fill-pattern': 'trama', 'fill-opacity': .7 } });
  // divisiones: líneas sólidas; blancas entre unidades, gris institucional entre municipios
  for (const v of VISTAS.filter(v => v.k !== 'mun')) addL({ id: 'l-' + v.geo, type: 'line', source: 'g-' + v.geo, layout: { visibility: 'none', 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': v.det ? W(.3, 1, 2) : W(1.4, 2.2, 3.2), 'line-opacity-transition': { duration: 450 } } });
  addL({ id: 'l-municipios', type: 'line', source: 'g-municipios', layout: { 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': W(1, 2, 3), 'line-opacity-transition': { duration: 450 } } });
  // velo: lo que queda fuera de lo consultado se desvanece (no desaparece)
  addL({ id: 'mask', type: 'fill', source: 'g-municipios', filter: ['==', ['get', 'municipio'], -1], paint: { 'fill-color': cssVar('--mapbg') || '#ECEAE3', 'fill-opacity': BASE_OK ? .62 : .55, 'fill-opacity-transition': { duration: 400 } } });
  for (const d of ['dl', 'df']) {
    // distritos: borde oscuro ancho + línea de color brillante; se distinguen sobre cualquier relleno
    addL({ id: d + '-c', type: 'line', source: 'g-' + d, layout: { 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#1E2422', 'line-width': W(5, 7, 9.5), 'line-opacity': .85 } });
    addL({ id: d + '-o', type: 'line', source: 'g-' + d, layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL[d], 'line-width': W(2.2, 3.2, 4.4) } });
  }
  addL({ id: 'zm-l', type: 'line', source: 'g-zm', layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL.zm, 'line-width': W(1.6, 2.4, 3.2) } });
  // contorno de la zona elegida (conurbada o metropolitana): mismo trazo que el municipio en foco
  for (const z of ['conurb', 'zm']) { addL({ id: 'z-' + z + '-c', type: 'line', source: 'g-' + z, layout: { 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#1E2422', 'line-width': W(5, 7.5, 10) } });
    addL({ id: 'z-' + z + '-l', type: 'line', source: 'g-' + z, layout: { 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#FFFFFF', 'line-width': W(1.6, 2.6, 3.4) } }); }
  addL({ id: 'det-l', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'det'], true], layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL.det, 'line-width': W(1.4, 2.4, 3.2) } });
  addL({ id: 'cap-glow', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'municipio'], 115], paint: { 'line-color': '#000000', 'line-width': W(6, 10, 14), 'line-opacity': .18, 'line-blur': 6 } });
  addL({ id: 'cap-l', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'municipio'], 115], layout: { 'line-join': 'round' }, paint: { 'line-color': '#4A5350', 'line-width': W(2, 3.2, 4.2) } });
  // contorno del municipio en foco: blanco grueso con sombra, se ve sobre cualquier color
  // contorno del municipio en foco: carbón grueso con filo blanco y sombra; contrasta sobre mapa claro y sobre cualquier color
  const NONE = ['==', ['get', 'municipio'], -1];
  addL({ id: 'foco-sh', type: 'line', source: 'g-municipios', filter: NONE, paint: { 'line-color': '#000000', 'line-width': W(10, 15, 20), 'line-opacity': .28, 'line-blur': 8 } });
  addL({ id: 'foco-c', type: 'line', source: 'g-municipios', filter: NONE, layout: { 'line-join': 'round' }, paint: { 'line-color': '#1E2422', 'line-width': W(5, 7.5, 10) } });
  addL({ id: 'foco-l', type: 'line', source: 'g-municipios', filter: NONE, layout: { 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': W(1.6, 2.6, 3.4) } });
  // municipio bajo el cursor (antes de entrar a él)
  addL({ id: 'hov-c', type: 'line', source: 'g-municipios', filter: NONE, layout: { 'line-join': 'round' }, paint: { 'line-color': '#1E2422', 'line-width': W(3.5, 5, 6.5), 'line-opacity': .85 } });
  addL({ id: 'hov-l', type: 'line', source: 'g-municipios', filter: NONE, layout: { 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': W(1.2, 1.8, 2.4) } });
  map.on('moveend', declutter);
  let hov = null; const tip = $('#tip');
  const setHovMun = k => { for (const id of ['hov-c', 'hov-l']) map.setFilter(id, ['==', ['get', 'municipio'], k]); };
  const clearHov = () => { if (hov) { if (hov.source === 'g-municipios') setHovMun(-1); else map.setFeatureState(hov, { h: false }); } hov = null; };
  // fuera del municipio en foco se pasa el cursor por municipio; sus secciones solo después de darle clic
  const hit = e => { const v = VK(S.vista); let f = map.queryRenderedFeatures(e.point, { layers: ['f-' + v.geo] })[0];
    if (f && v.det && S.foco.u === 'mun') { const mm = v.k === 'sec' ? f.properties.municipio : munOfUnit(v.k, f.properties[v.id]); if (mm !== S.foco.key) return { v: VK('mun'), f: { properties: { municipio: mm } } }; }
    if (f) return { v, f };
    if (map.getLayoutProperty('f-municipios', 'visibility') !== 'none') { f = map.queryRenderedFeatures(e.point, { layers: ['f-municipios'] })[0]; if (f) return { v: VK('mun'), f }; } return null; };
  map.on('mousemove', e => {
    const h = hit(e); if (!h) { clearHov(); tip.hidden = true; map.getCanvas().style.cursor = ''; return; }
    const { v, f } = h, id = f.properties[v.id];
    if (!hov || hov.id !== id || hov.source !== 'g-' + v.geo) { clearHov(); hov = { source: 'g-' + v.geo, id }; if (v.k === 'mun') setHovMun(id); else map.setFeatureState(hov, { h: true }); }
    map.getCanvas().style.cursor = 'pointer'; if (isMobile()) return;
    const u = v.k === 'mun' ? MUNAGG[id] : AGG[id], w = u && u.w, mm = v.k === 'sec' ? f.properties.municipio : null;
    tip.innerHTML = `<b>${esc(unitName(v.k, id))}</b>${mm ? `<span class="m">${esc(MUNN[mm])}</span><br>` : v.k === 'mun' && id !== S.foco.key ? '<span class="m">Clic para entrar y ver sus secciones</span><br>' : ''}${w ? (w.tie ? 'Empate' : `${esc(candLabel(w.c))} · ${p1(w.share)}`) + (u.a.ln ? `<br><span class="m">Participación ${p1(pct(u.a.t, u.a.ln))}</span>` : '') : `<span class="m">${v.k === 'sec' ? 'Sección creada después de esta elección' : 'Sin resultados en esta elección'}</span>`}`;
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
  await Promise.all(['secciones', 'colonias', 'juntas', 'dl', 'df', 'zm', 'conurb'].concat(GEO.municipios ? [] : ['municipios']).map(k => j(`data/geo/${k}.geojson`).then(g => GEO[k] = g)));
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
