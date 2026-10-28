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
  if (e !== true && v.det && CAPAS.alcance !== 'foco' && !(S.sel && S.sel.u !== 'mun')) e = CAPAS.alcance === 'todo' ? true : ['any', e === false ? false : e, ['in', ['get', 'municipio'], ['literal', CAPAS.alcance === 'zm' ? CAT.zm : CAT.detalle]]];
  const hov = ['boolean', ['feature-state', 'h'], false];
  const op = e === true ? ['case', hov, 1, VIV] : e === false ? ['case', hov, .4, DIM] : ['case', hov, ['case', e, 1, .45], ['case', e, VIV, DIM]];
  map.setPaintProperty('f-' + v.geo, 'fill-opacity', op);
  map.setPaintProperty('l-' + v.geo, 'line-opacity', e === true ? 1 : e === false ? .3 : ['case', e, 1, .25]);
  if (v.k !== 'mun') map.setPaintProperty('f-municipios', 'fill-opacity', v.det ? .1 : .08);
  const fm = S.foco.u === 'mun' && !(S.foco.key === 115 && !S.sel) ? S.foco.key : (S.sel && S.sel.u === 'mun' ? S.sel.key : -1);
  for (const id of ['foco-sh', 'foco-c', 'foco-l']) if (map.getLayer(id)) map.setFilter(id, ['==', ['get', 'municipio'], fm]);
  if (map.getLayer('cap-l')) { const other = fm !== -1 && fm !== 115; map.setPaintProperty('cap-l', 'line-opacity', other ? .35 : 1); map.setPaintProperty('cap-glow', 'line-opacity', other ? 0 : .18); }
  focoLabel(fm);
  const home = S.foco.u === HOME.u && S.foco.key === HOME.key && !S.sel && S.vista === HOME.vista && CAPAS.alcance === 'foco';
  $('#btn-home').hidden = home; placeHome();
}
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
function vcols(eid, a, u, key, mode, big) {
  const m = ELS[eid], w = verdict(eid, a); if (!a.t) return '';
  let items = mode === 'part'
    ? m.part.map((p, i) => ({ id: p, v: a.p ? a.p[i] : 0, segs: [{ p, v: a.p ? a.p[i] : 0 }], lab: [p] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v)
    : ranking(eid, a).map(x => ({ id: x.c, cand: x.c, v: x.v, segs: candParts(eid, a, x.c), lab: x.c.startsWith('CAND_IND') ? ['IND'] : x.c.split('-') }));
  const N = big ? 11 : 6;
  if (items.length > N) { const rest = items.slice(N - 1), v = rest.reduce((s, x) => s + x.v, 0); items = items.slice(0, N - 1); items.push({ id: '_o', v, segs: [{ p: '_o', v }], lab: [], otros: rest }); }
  if (!items.length) return '';
  const max = items[0].v;
  const cols = items.map((x, i) => {
    const p = pct(x.v, a.t), win = mode !== 'part' && i === 0 && w && !w.tie, who = x.cand ? personFor(eid, u, key, x.cand) : null;
    const head = x.otros ? 'Otros' : x.cand ? (who || candTitle(x.cand)) : pname(x.id);
    const brk = x.otros ? x.otros.map(o => `<div><span class="sw" style="background:${x.cand !== undefined || o.cand ? candColor(o.cand || o.id) : pcol(o.id)}"></span>${esc(o.cand ? shortCand(o.cand) : o.id)}<b>${fmt(o.v)}</b></div>`).join('')
      : (x.segs.length > 1 ? x.segs.map(s => `<div><span class="sw" style="${segBg(s)}"></span>${s.sh ? 'Con varios logos' : esc(s.p)}<b>${fmt(s.v)}</b></div>`).join('') : '');
    const tip = `<b>${esc(head)}</b>${who ? `<span class="m">${esc(candTitle(x.cand))}</span>` : ''}<div class="tv"><strong>${p1(p)}</strong> ${fmt(x.v)} votos</div>${brk ? `<div class="tl">${brk}</div>` : ''}${x.cand && !x.cand.startsWith('CAND_IND') ? '<span class="m">Pasa el cursor: dónde ganó · Clic: colorear el mapa</span>' : ''}`;
    return `<div class="vc-col${win ? ' lead' : ''}" ${x.cand ? `data-cand="${x.cand}"` : ''} ${tipA(tip)} style="--d:${i * 70}ms">
      <div class="vc-top">${win ? '<span class="vc-badge">Ganó</span>' : ''}<b data-n="${p.toFixed(1)}" data-d="1" data-s="%">0%</b></div>
      <div class="vc-bar" style="height:calc((100% - ${win ? 44 : 26}px) * ${(x.v / max).toFixed(4)})">${x.segs.map(s => `<i style="flex:${s.v} 0 0;${segBg(s)}"></i>`).join('')}</div></div>`;
  }).join('');
  const xs = items.map(x => `<div class="vc-x">${x.otros ? '<span class="pch sm" style="background:var(--gris)">Otros</span>' : x.lab.map(p => chip(p, 1)).join('')}${big && x.cand ? (n => n ? `<small>${esc(n)}</small>` : '')(personFor(eid, u, key, x.cand)) : ''}</div>`).join('');
  return `<div class="vc${big ? ' big' : ''}" style="--n:${items.length}"><div class="vc-plot">${cols}</div><div class="vc-xs">${xs}</div></div>`;
}
function resNote(eid, a, mode) {
  const w = verdict(eid, a);
  return `<div class="src">${mode === 'part' ? 'Votos con el logo de un solo partido.' : '<span class="sw hatch"></span> Votos que marcaron varios logos de la coalición.'} Nulos ${p1(pct(a.nu, a.t))}${w && !w.tie ? ` · Ventaja del primer lugar: <b>${w.margin.toFixed(1)} pts</b>` : ''}</div>`;
}
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
function ribbon(u, key, cargo, mode, W, H, selEl) {
  const { pts, keys } = ribbonData(u, key, cargo, mode); if (pts.length < 2) return '';
  const L = 8, R = 8, T = 22, B = 40, n = pts.length, slot = (W - L - R) / n, cw = Math.min(70, slot * .52), ys = v => (H - T - B) * v / 100;
  const xc = i => L + slot * (i + .5);
  const stacks = pts.map(p => { let acc = 0; const seg = {}; keys.forEach(k => { const v = p.by[k] || 0; seg[k] = [acc, acc + v]; acc += v; }); seg._r = [acc, 100]; return seg; });
  const Y = v => H - B - ys(v);
  let g = '';
  // cintas
  for (let i = 0; i < n - 1; i++) { const x0 = xc(i) + cw / 2, x1 = xc(i + 1) - cw / 2, mx = (x0 + x1) / 2;
    keys.forEach(k => { const [a0, a1] = stacks[i][k], [b0, b1] = stacks[i + 1][k]; if (a1 - a0 <= 0 && b1 - b0 <= 0) return;
      g += `<path class="rb" style="--d:${i * 90 + 300}ms" d="M${x0},${Y(a1)} C${mx},${Y(a1)} ${mx},${Y(b1)} ${x1},${Y(b1)} L${x1},${Y(b0)} C${mx},${Y(b0)} ${mx},${Y(a0)} ${x0},${Y(a0)} Z" fill="${pcol(k)}"/>`; }); }
  const ally = k => mode !== 'part' && pts.some(p => ranking(p.e.id, p.a).some(r => leadOf(r.c) === k && r.c.includes('-')));
  pts.forEach((p, i) => { const sel = p.e.id === selEl, x = xc(i) - cw / 2;
    g += `<g class="rc${sel ? ' sel' : ''}" data-el="${p.e.id}" style="--d:${i * 90}ms">`;
    keys.forEach(k => { const [a0, a1] = stacks[i][k], h = ys(a1 - a0); if (h <= 0) return; const v = a1 - a0;
      const tip = `<b>${esc(k)}${ally(k) ? ' y aliados' : ''}</b><span class="m">${esc(cargo)} ${p.e.anio}</span><div class="tv"><strong>${p1(v)}</strong> ${fmt(v * p.a.t / 100)} votos</div>${p.w && leadOf(p.w.c) === k ? '<span class="m">Ganó esta elección</span>' : ''}<span class="m">Clic: ver ${p.e.anio}</span>`;
      g += `<rect ${tipA(tip)} x="${x.toFixed(1)}" y="${Y(a1).toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(h - 1.5, .5).toFixed(1)}" rx="3" fill="${pcol(k)}"/>`;
      if (h > 17) g += `<text class="rv" x="${xc(i).toFixed(1)}" y="${(Y(a1) + h / 2 + 4).toFixed(1)}" text-anchor="middle">${v.toFixed(0)}</text>`; });
    const r = stacks[i]._r; g += `<rect x="${x.toFixed(1)}" y="${Y(100).toFixed(1)}" width="${cw.toFixed(1)}" height="${ys(100 - r[0]).toFixed(1)}" rx="3" fill="var(--nores)" ${tipA(`<b>Otros y nulos</b><span class="m">${p.e.anio}</span><div class="tv"><strong>${p1(100 - r[0])}</strong></div>`)}/>`;
    if (p.w && !p.w.tie) g += `<circle cx="${xc(i)}" cy="${T - 9}" r="5" fill="${candColor(p.w.c)}" stroke="var(--surface)" stroke-width="2"/>`;
    g += `<text class="ry" x="${xc(i)}" y="${H - B + 17}" text-anchor="middle">${p.e.anio}</text>`;
    if (p.a.ln) g += `<text class="rp" x="${xc(i)}" y="${H - B + 32}" text-anchor="middle">${pct(p.a.t, p.a.ln).toFixed(0)}% part.</text>`;
    g += `</g>`; });
  return `<div class="rbn"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Reparto del voto por elección">${g}</svg></div>
    <div class="lgd">${keys.map(k => `<span>${chip(k, 1)}${ally(k) ? ' y aliados' : ''}</span>`).join('')}<span><i class="dot"></i>Ganador</span></div>`;
}

/* =================== VENTANA DE EXPLORACIÓN =================== */
const MS = {};
function placeOpts(u, key) {
  const o = [[u, key]], add = (a, b) => { if (!o.some(x => x[0] === a && x[1] === b)) o.push([a, b]); };
  const mm = munOfUnit(u, key); if (mm != null) add('mun', mm);
  if (u === 'sec') { const p = GEO.secciones.byId[key].properties; add('dl', p.distrito_l); add('df', p.distrito_f); }
  add('est', 0); return o;
}
function elPicker(eid, cargoOnly) {
  const e = ELS[eid], cargo = cargoBase(e.cargo);
  return `<div class="xp-el"><select id="xp-cargo" aria-label="Elección">${CARGOS.map(c => `<option ${c === cargo ? 'selected' : ''}>${c}</option>`).join('')}</select>
    ${cargoOnly ? '' : `<div class="tabs">${CAT.elecciones.filter(x => cargoBase(x.cargo) === cargo).map(x => `<button data-xe="${x.id}" class="${x.id === eid ? 'on' : ''}">${x.anio}${x.cargo.includes('extra') ? '*' : ''}</button>`).join('')}</div>`}</div>`;
}
function openExplore(kind) { const { u, key } = current(); Object.assign(MS, { kind, u0: u, k0: key, u, key, el: S.el, partes: S.partes || 'cand' }); openModal('<div id="xp"></div>'); drawExplore(); }
function drawExplore() {
  const { kind, u, key, el } = MS, m = ELS[el], a = agg(u, key, el), w = verdict(el, a), name = unitName(u, key), cargo = cargoBase(m.cargo);
  const places = placeOpts(MS.u0, MS.k0);
  let h = `<div class="xp-head"><div class="tabs xp-kind"><button data-k="res" class="${kind === 'res' ? 'on' : ''}">Resultados</button><button data-k="tr" class="${kind === 'tr' ? 'on' : ''}">Elección por elección</button></div>
    <h3 id="mtitle">${esc(name)}</h3>
    <div class="xp-pick"><div class="xp-lbl">Lugar</div><div class="tabs">${places.map(([pu, pk]) => `<button data-pu="${pu}" data-pk="${pk}" class="${pu === u && pk === key ? 'on' : ''}">${esc(unitName(pu, pk))}</button>`).join('')}</div>
    <div class="xp-lbl">Elección</div>${elPicker(el, kind === 'tr')}<div class="xp-lbl">Ver por</div>${partesTabs(MS.partes, 'xp-partes')}</div></div>`;
  if (kind === 'res') {
    if (!a.t) h += `<div class="note">No hay resultados de ${esc(m.cargo.toLowerCase())} ${m.anio} en ${esc(name)}.</div>`;
    else { const who = w ? personFor(el, u, key, w.c) : null;
      h += `<div class="xp-kpis"><div><b>${a.ln ? fmt(a.ln) : '—'}</b><span>Lista nominal</span></div><div><b>${fmt(a.t)}</b><span>Votos</span></div><div><b>${a.ln ? p1(pct(a.t, a.ln)) : '—'}</b><span>Participación</span></div>${w && !w.tie ? `<div class="wk" style="--c:${candColor(w.c)}"><b>${esc(who || shortCand(w.c))}</b><span>Ganó con ${p1(w.share)} · ventaja ${w.margin.toFixed(1)} pts</span></div>` : ''}</div>`;
      h += vcols(el, a, u, key, MS.partes, true) + resNote(el, a, MS.partes);
      if (MS.partes !== 'part') h += `<table class="dt"><thead><tr><th>Candidatura</th><th>Cómo se formó</th><th class="n">Votos</th><th class="n">%</th></tr></thead><tbody>${ranking(el, a).map(x => { const who = personFor(el, u, key, x.c); return `<tr data-cand="${x.c}"><td><span class="chips">${chips(x.c)}</span>${who ? `<div class="pn">${esc(who)}</div>` : ''}</td><td class="br">${candParts(el, a, x.c).map(s => `<span><span class="sw" style="${segBg(s)}"></span>${s.sh ? 'varios logos' : esc(s.p)} ${fmt(s.v)}</span>`).join('')}</td><td class="n">${fmt(x.v)}</td><td class="n"><b>${p1(pct(x.v, a.t))}</b></td></tr>`; }).join('')}</tbody></table>`; }
  } else {
    const rb = ribbon(u, key, cargo, MS.partes, 860, 380, el);
    h += rb ? `<p class="xp-hint">Cada columna es una elección; la altura es el % de votos. Pasa el cursor para ver el dato y haz clic en un año para ver su resultado.</p>${rb}` : `<div class="note">Hace falta más de una elección de ${esc(cargo.toLowerCase())} con resultados aquí.</div>`;
  }
  const mapa = el !== S.el || !(u === current().u && key === current().key);
  h += `<div class="xp-foot"><span class="src">Fuente: ${esc(m.fuente)}, ${m.anio}.</span>${mapa ? `<button class="btn pri" id="xp-map">Ver esto en el mapa</button>` : ''}</div>`;
  const X = $('#xp'); X.innerHTML = h; animate(X); bindTips(X); linkRows(X);
  $$('#xp [data-k]').forEach(b => b.onclick = () => { MS.kind = b.dataset.k; drawExplore(); });
  $$('#xp [data-pu]').forEach(b => b.onclick = () => { MS.u = b.dataset.pu; MS.key = MS.u === 'ja' ? b.dataset.pk : +b.dataset.pk; drawExplore(); });
  $$('#xp [data-xe]').forEach(b => b.onclick = () => { MS.el = b.dataset.xe; drawExplore(); });
  $('#xp-cargo').onchange = e => { const es = CAT.elecciones.filter(x => cargoBase(x.cargo) === e.target.value && !x.cargo.includes('extra')).sort((a, b) => b.anio - a.anio); MS.el = es[0].id; drawExplore(); };
  $$('#xp-partes button').forEach(b => b.onclick = () => { MS.partes = b.dataset.p; drawExplore(); });
  $$('#xp .rc').forEach(g => g.onclick = () => { hideTip(); MS.el = g.dataset.el; MS.kind = 'res'; drawExplore(); });
  const xm = $('#xp-map'); if (xm) xm.onclick = () => { $('#modal').hidden = true; hideTip(); if (MS.el !== S.el) setEl(MS.el); if (MS.u !== 'est' && !(MS.u === current().u && MS.key === current().key)) goTo(MS.u, MS.key); };
}

/* =================== COMPARAR (v7) =================== */
const CMP = { a: null, b: null, mode: 'cand' };
function sharesOf(eid, a, mode) { const by = {}; if (!a.t) return by; if (mode === 'part') ELS[eid].part.forEach((p, i) => { if (a.p && a.p[i] > 0) by[p] = pct(a.p[i], a.t); }); else Object.assign(by, blocs(eid, a)); return by; }
function cmpView(u, key, ea, eb, big, mode = 'cand') {
  const A = ELS[ea], B = ELS[eb], aa = agg(u, key, ea), ab = agg(u, key, eb);
  if (!aa.t || !ab.t) return `<div class="note">No hay resultados aquí en ${!aa.t ? A.anio + ' (' + cargoBase(A.cargo) + ')' : B.anio + ' (' + cargoBase(B.cargo) + ')'}.</div>`;
  const ba = sharesOf(ea, aa, mode), bb = sharesOf(eb, ab, mode), wa = verdict(ea, aa), wb = verdict(eb, ab);
  const ks = [...new Set([...Object.keys(ba), ...Object.keys(bb)])].filter(p => p !== 'IND').sort((x, y) => Math.max(bb[y] || 0, ba[y] || 0) - Math.max(bb[x] || 0, ba[x] || 0)).slice(0, 8);
  const ally = p => mode !== 'part' && ranking(ea, aa).concat(ranking(eb, ab)).some(r => leadOf(r.c) === p && r.c.includes('-'));
  const nm = p => p + (ally(p) ? ' y aliados' : '');
  const top = Math.min(100, Math.ceil(Math.max(...ks.map(p => Math.max(ba[p] || 0, bb[p] || 0)), 10) / 10) * 10);
  const card = (E, a, w, tag) => { const who = w ? personFor(E.id, u, key, w.c) : null;
    return `<div class="cc" style="--c:${w ? candColor(w.c) : 'var(--gris)'}"><div class="cc-t"><span class="cc-tag">${tag}</span><span class="cc-y">${E.anio}${E.cargo.includes('extra') ? '*' : ''}</span></div><div class="cc-c">${esc(cargoBase(E.cargo))}</div>${w ? `<div class="cc-w">Ganó <b>${esc(who || shortCand(w.c))}</b></div><div class="cc-s">${chips(w.c)}<b>${p1(w.share)}</b></div>` : ''}<div class="cc-p">${a.ln ? 'Participación ' + p1(pct(a.t, a.ln)) : fmt(a.t) + ' votos'}</div></div>`; };
  const frase = wa && wb ? (leadOf(wa.c) === leadOf(wb.c) ? `<b>${esc(nm(leadOf(wb.c)))}</b> ganó en las dos elecciones.` : `<b>Cambió quien gana:</b> de ${esc(nm(leadOf(wa.c)))} (${A.anio}) a ${esc(nm(leadOf(wb.c)))} (${B.anio}).`) : '';
  const row = (label, x, y, col, tip, cls = '', sx = x.toFixed(1), sy = y.toFixed(1), dd = y - x) => { const d = y - x, lo = Math.min(x, y), hi = Math.max(x, y), X = v => (v / top * 100).toFixed(2), up = y >= x;
    return `<div class="db-r ${cls}" ${tipA(tip)}><div class="db-l">${label}</div><div class="db-t" style="--g:${(1000 / top).toFixed(3)}%">
      ${x > 0 && y > 0 ? '' : '<!--'}<i class="db-bar" style="left:${X(lo)}%;width:${(X(hi) - X(lo)).toFixed(2)}%;background:linear-gradient(90deg,${up ? mix(col, '#ffffff', .6) : col},${up ? col : mix(col, '#ffffff', .6)})"></i>${x > 0 && y > 0 ? '' : '-->'}
      ${x > 0 ? `<span class="db-a" style="left:${X(x)}%;border-color:${col}"></span><em class="db-va ${up ? 'l' : 'r'}" style="left:${X(x)}%">${sx}</em>` : ''}${y > 0 ? `<span class="db-b" style="left:${X(y)}%;background:${col}"></span><em class="db-vb ${up ? 'r' : 'l'}" style="left:${X(y)}%;color:${col}">${sy}</em>` : ''}</div>
      <span class="d ${Math.abs(dd) < .5 ? 'eq' : dd > 0 ? 'up' : 'dn'}">${dd > 0 ? '▲ +' : dd < 0 ? '▼ ' : ''}${dd.toFixed(1)}</span></div>`; };
  const solo = mode === 'part' ? 'Sin votos propios' : 'No encabezó candidatura (fue en coalición con otro)';
  const rows = ks.map(p => { const x = ba[p] || 0, y = bb[p] || 0;
    return row(`${chip(p)}${ally(p) ? '<small>y aliados</small>' : ''}`, x, y, pcol(p), `<b>${esc(nm(p))}</b><div class="tl"><div>${A.anio} ${esc(cargoBase(A.cargo))}<b>${x ? p1(x) : '—'}</b></div><div>${B.anio} ${esc(cargoBase(B.cargo))}<b>${y ? p1(y) : '—'}</b></div></div>${!x || !y ? `<span class="m">— ${solo}</span>` : `<span class="m">Diferencia: ${(y - x) > 0 ? '+' : ''}${(y - x).toFixed(1)} puntos</span>`}`); }).join('');
  const pa = aa.ln ? pct(aa.t, aa.ln) : null, pb = ab.ln ? pct(ab.t, ab.ln) : null;
  return `<div class="cv${big ? ' big' : ''}"><div class="cc-row">${card(A, aa, wa, 'A')}<div class="cc-vs">vs</div>${card(B, ab, wb, 'B')}</div>
    ${frase ? `<p class="frase">${frase}</p>` : ''}
    <div class="db-lg"><span><i class="lg-a"></i>A · ${A.anio} ${esc(cargoBase(A.cargo))}</span><span><i class="lg-b"></i>B · ${B.anio} ${esc(cargoBase(B.cargo))}</span><span class="db-sc">% de votos, escala 0–${top}</span></div>
    <div class="db">${rows}${pa != null && pb != null ? row('<b class="db-pt">Participación</b>', Math.min(pa, 100) * top / 100, Math.min(pb, 100) * top / 100, '#6F7472', `<b>Participación</b><div class="tl"><div>${A.anio}<b>${p1(pa)}</b></div><div>${B.anio}<b>${p1(pb)}</b></div></div>`, 'part', pa.toFixed(1), pb.toFixed(1), pb - pa) : ''}</div>
    <div class="src">${mode === 'part' ? 'Votos con el logo de un solo partido.' : 'Cada partido junto con sus aliados en esa elección.'} La última columna es la diferencia en puntos (B menos A).</div></div>`;
}
function openCompare() {
  const { u, key } = current();
  CMP.b = S.el; CMP.a = (cmpEl() || ELS[S.el]).id;
  const pick = side => { const e = ELS[CMP[side]], cargo = cargoBase(e.cargo);
    return `<div class="cp-side cp-${side}"><div class="cp-lbl"><span class="cc-tag">${side.toUpperCase()}</span>Elección ${side === 'a' ? 'anterior' : 'a comparar'}</div><select class="cmp-sel" data-side="${side}" aria-label="Cargo ${side.toUpperCase()}">${CARGOS.map(c => `<option ${c === cargo ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <div class="tabs">${CAT.elecciones.filter(x => cargoBase(x.cargo) === cargo).map(x => `<button data-side="${side}" data-e="${x.id}" class="${x.id === e.id ? 'on' : ''}">${x.anio}${x.cargo.includes('extra') ? '*' : ''}</button>`).join('')}</div></div>`; };
  const draw = () => { $('#cmp-body').innerHTML = `<div class="cp-pick">${pick('a')}${pick('b')}</div><div class="cp-mode"><span class="xp-lbl">Ver por</span>${partesTabs(CMP.mode, 'cmp-partes')}</div>${cmpView(u, key, CMP.a, CMP.b, true, CMP.mode)}`; animate($('#cmp-body')); bindTips($('#cmp-body'));
    $$('#cmp-body select[data-side]').forEach(s => s.onchange = () => { const es = CAT.elecciones.filter(x => cargoBase(x.cargo) === s.value).sort((a, b) => b.anio - a.anio); CMP[s.dataset.side] = es[0].id; draw(); });
    $$('#cmp-body button[data-side]').forEach(bt => bt.onclick = () => { CMP[bt.dataset.side] = bt.dataset.e; draw(); });
    $$('#cmp-partes button').forEach(b => b.onclick = () => { CMP.mode = b.dataset.p; draw(); }); };
  openModal(`<h3 id="mtitle">Comparar elecciones</h3><p class="msub">${esc(unitName(u, key))} · elige la elección A y la B</p><div id="cmp-body"></div>`);
  draw();
}

/* =================== LEYENDA Y MODO DE COLOR =================== */
function fillModo() { const m = ELS[S.el], p = prevOf(S.el); if (!['win', 'part', ...(p ? ['cambio'] : []), ...m.cand].includes(S.modo)) S.modo = 'win'; }
function legend() {
  const L = $('#legend'), m = ELS[S.el], p = prevOf(S.el); let h = '';
  const g = cssVar('--fg'), bg = cssVar('--mapbg'), isC = !['win', 'part', 'cambio'].includes(S.modo);
  h += `<div class="lg-modes">${[['win', 'Quién ganó'], ['part', 'Participación'], ...(p ? [['cambio', 'Cambio vs ' + p.anio]] : [])].map(([k, l]) => `<button data-modo="${k}" class="${S.modo === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  if (S.modo === 'win') h += `<div class="items"><span class="it"><span class="sw" style="background:${mix(g, bg, .5)}"></span>Ventaja &lt; 5 pts</span><span class="it"><span class="sw" style="background:${mix(g, bg, .25)}"></span>5 a 15</span><span class="it"><span class="sw" style="background:${g}"></span>&gt; 15</span></div>`;
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
  root.querySelectorAll('[data-cand]').forEach(el => {
    el.addEventListener('mouseenter', () => mapFocusCand(el.dataset.cand));
    el.addEventListener('mouseleave', () => highlight());
    el.addEventListener('click', e => { if (e.target.closest('button,select')) return; const c = el.dataset.cand; if (ELS[S.el].cand.includes(c) && !c.startsWith('CAND_IND')) { S.modo = S.modo === c ? 'win' : c; paint(); } });
  });
}
function mapFocusCand(c) { const v = VK(S.vista), i = ELS[S.el].cand.indexOf(c); if (i < 0) return;
  map.setPaintProperty('f-' + v.geo, 'fill-opacity', ['case', ['==', ['feature-state', 'wl'], i], .95, .07]); }
function mapFocusParty(p) { map.setPaintProperty('f-municipios', 'fill-opacity', ['case', ['==', ['feature-state', 'wp'], p], .95, .06]);
  const v = VK(S.vista); if (v.k !== 'mun') map.setPaintProperty('f-' + v.geo, 'fill-opacity', .04); }

/* =================== COMPOSICIÓN: CONGRESO Y AYUNTAMIENTOS =================== */
function blocOf(eid, party) { const c = ELS[eid].cand.find(x => !x.startsWith('CAND_IND') && x.split('-').includes(party)); return c ? leadOf(c) : party; }
function seatParty(eid, partido, actor) {
  const ps = (partido || '').split(/[_-]/).filter(Boolean); if (ps.length === 1) return ps[0];
  const as = (actor === 'COM_MEXICO' ? 'PRI_PVEM' : (actor || '').replace(/^C_COMUN_/, '')).split(/[_-]/).filter(Boolean);
  return blocOf(eid, (ps[0] || as[0] || '?'));
}
function seats() {
  const m = ELS[S.el], t = m.tipo, CG = EST._cong || {};
  let list = [], title = '', sub = '';
  const mk = (arr, k) => (arr || []).map(s => { const p = seatParty(S.el, s[0], s[1]); return { p, b: blocOf(S.el, p), k }; });
  if (t === 'DL' && CG.DL && CG.DL[m.anio]) { const d = CG.DL[m.anio]; list = mk(d.mr, 'mr').concat(mk(d.rp, 'rp')); title = `Congreso del Estado · ${m.anio}`; sub = `${list.length} diputaciones: ${(d.mr || []).length} de mayoría y ${(d.rp || []).length} plurinominales`; }
  else if (t === 'DF' && CG.DF && CG.DF[m.anio]) { list = mk(CG.DF[m.anio].mr, 'mr'); title = `Diputaciones federales de Puebla · ${m.anio}`; sub = `Los ${list.length} distritos de mayoría del estado`; }
  else if (t === 'SEN' && CG.SEN && CG.SEN[m.anio]) { list = mk(CG.SEN[m.anio].mr, 'mr'); title = `Senado por Puebla · ${m.anio}`; sub = 'Dos escaños de mayoría y uno de primera minoría'; }
  else if (t === 'AYU') { for (const [k, pk] of Object.entries(EST[S.el].mun)) { const o = EMPTY(); addPack(o, pk); const w = verdict(S.el, o); if (w && !w.tie) list.push({ p: leadOf(w.c), b: leadOf(w.c), k: 'mr', m: +k, co: w.c.includes('-') }); } title = `Ayuntamientos del estado · ${m.anio}`; sub = `${list.length} presidencias municipales`; }
  if (!list.length) return null;
  const bl = {}; list.forEach(s => { bl[s.b] = bl[s.b] || { n: 0, parts: {} }; bl[s.b].n++; bl[s.b].parts[s.p] = (bl[s.b].parts[s.p] || 0) + 1; });
  const order = Object.entries(bl).sort((a, b) => b[1].n - a[1].n).map(x => x[0]);
  list.sort((x, y) => order.indexOf(x.b) - order.indexOf(y.b) || (bl[y.b].parts[y.p] - bl[x.b].parts[x.p]) || x.p.localeCompare(y.p));
  const total = list.length, may = Math.floor(total / 2) + 1, cal = Math.ceil(total * 2 / 3), lead = order[0], nl = bl[lead].n;
  const nm = p => p + (m.cand.some(c => leadOf(c) === p && c.includes('-')) ? ' y aliados' : '');
  const ver = t === 'AYU' ? `<b>${esc(lead)}</b>, solo o encabezando coalición, ganó <b>${nl}</b> de ${total} municipios.` : t === 'SEN' ? `<b>${esc(nm(lead))}</b> obtuvo ${nl} de ${total} escaños.`
    : nl >= cal ? `<b>${esc(nm(lead))}</b> tiene <b>${nl}</b> de ${total}: <b>mayoría calificada</b>.` : nl >= may ? `<b>${esc(nm(lead))}</b> tiene <b>${nl}</b> de ${total}: <b>mayoría</b>.` : `Nadie tiene mayoría. ${esc(nm(lead))} tiene ${nl} y se necesitan ${may}.`;
  return { title, sub, total, list, bl, order, may, cal, ver, t, nm };
}
function hemicycle(s, W) {
  if (s.t === 'AYU') { const mx = s.bl[s.order[0]].n;
    return `<div class="vc ay${s.order.length > 7 ? ' narrow' : ''}" style="--n:${s.order.length}"><div class="vc-plot">${s.order.map((b, i) => { const n = s.bl[b].n, co = s.list.filter(x => x.b === b && x.co).length;
      const tip = `<b>${esc(pname(b))}</b><div class="tv"><strong>${n}</strong> municipios</div>${co ? `<span class="m">${co === n ? 'Todos' : co} en coalición, ${co === n ? 'ninguno' : n - co} solo</span>` : ''}<span class="m">Pasa el cursor: dónde ganó</span>`;
      return `<div class="vc-col${i === 0 ? ' lead' : ''}" data-bloc="${b}" ${tipA(tip)} style="--d:${i * 60}ms"><div class="vc-top"><b data-n="${n}">0</b></div><div class="vc-bar" style="height:calc((100% - 26px) * ${(n / mx).toFixed(4)})"><i style="flex:${n - co} 0 0;background:${pcol(b)}"></i>${co ? `<i style="flex:${co} 0 0;${segBg({ p: b, sh: true })}"></i>` : ''}</div></div>`; }).join('')}</div>
      <div class="vc-xs">${s.order.map(b => `<div class="vc-x">${chip(b, 1)}</div>`).join('')}</div></div>`; }
  const n = s.total, rows = n > 36 ? 4 : n > 16 ? 3 : n > 6 ? 2 : 1, H = W * .54, cx = W / 2, cy = H - 6, R1 = W / 2 - 12, R0 = R1 * (rows > 1 ? .5 : .72);
  const radii = Array.from({ length: rows }, (_, i) => rows === 1 ? R0 : R0 + (R1 - R0) * i / (rows - 1));
  const tot = radii.reduce((a, r) => a + r, 0), per = radii.map(r => Math.max(1, Math.round(n * r / tot))); per[rows - 1] += n - per.reduce((a, x) => a + x, 0);
  const pts = []; radii.forEach((r, i) => { const k = per[i]; for (let j = 0; j < k; j++) { const a = Math.PI * (1 - (k === 1 ? .5 : j / (k - 1))); pts.push({ a, x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }); } });
  pts.sort((p, q) => q.a - p.a);
  const rad = Math.min((R1 - R0) / Math.max(rows - 1, 1) * .42, Math.PI * R1 / per[rows - 1] * .42, 16);
  let g = pts.map((p, i) => { const x = s.list[i]; return `<g class="seat" style="animation-delay:${i * 22}ms" ${tipA(`<b>${esc(pname(x.p))}</b><span class="m">${x.k === 'rp' ? 'Plurinominal' : 'Mayoría relativa'}${x.b !== x.p ? ' · bloque ' + esc(x.b) : ''}</span>`)}><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${rad.toFixed(1)}" fill="${pcol(x.p)}"></circle>${x.k === 'rp' ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${(rad * .38).toFixed(1)}" fill="#fff" opacity=".9" pointer-events="none"/>` : ''}</g>`; }).join('');
  const fs = Math.max(22, W * .075);
  g += `<text x="${cx}" y="${cy - R0 * .38}" text-anchor="middle" class="h-big" style="fill:${pcol(s.order[0])};font-size:${fs}px">${s.bl[s.order[0]].n}</text><text x="${cx}" y="${cy - R0 * .38 + fs * .55}" text-anchor="middle" class="h-sm" style="font-size:${Math.max(11, fs * .32)}px">de ${n} · mayoría ${s.may}</text>`;
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Composición">${g}</svg></div>`;
}
function seatsBody(s, W) {
  if (s.t === 'AYU') return `<p class="frase">${s.ver}</p>${hemicycle(s, W)}<div class="src"><span class="sw hatch"></span> Municipios ganados en coalición, contados para el partido que la encabezó. ${esc(s.sub)}. Fuente: registro de candidaturas ganadoras INE / IEE Puebla.</div>`;
  return `<p class="frase">${s.ver}</p>${hemicycle(s, W)}
    <div class="blocs">${s.order.map(b => `<div class="bl"><div class="bl-h">${chip(b)}<span>${esc(s.nm(b).replace(b, '').trim() || '')}</span><b>${s.bl[b].n}</b></div>${Object.keys(s.bl[b].parts).length > 1 ? `<div class="bl-p">${Object.entries(s.bl[b].parts).sort((x, y) => y[1] - x[1]).map(([p, k]) => `${chip(p, 1)} ${k}`).join(' ')}</div>` : ''}</div>`).join('')}</div>
    <div class="src">${esc(s.sub)}${s.t === 'DL' ? '. Los plurinominales llevan un punto blanco' : ''}. Fuente: registro de candidaturas ganadoras INE / IEE Puebla.</div>`;
}

function pyramid(P) {
  if (!P) return '';
  const G = CAT.padron.grupos, mx = Math.max(...P[5], ...P[6], 1);
  return `<div class="pyr">${G.map((g, i) => `<span class="h" data-w="${(P[5][i] / mx * 100).toFixed(1)}" title="Hombres ${g}: ${fmt(P[5][i])}"></span><span class="g">${g}</span><span class="m" data-w="${(P[6][i] / mx * 100).toFixed(1)}" title="Mujeres ${g}: ${fmt(P[6][i])}"></span>`).reverse().join('')}</div>
    <div class="pyr-lg"><span>Hombres ${p1(pct(P[2], P[1]))}</span><span>Mujeres ${p1(pct(P[3], P[1]))}</span></div>`;
}
function afiliados() {
  const A = EST._afi; if (!A) return '';
  const rows = Object.entries(A).map(([p, d]) => ({ p, v: d.t })).sort((a, b) => b.v - a.v), max = rows[0].v;
  return `<div class="plist">${rows.map(x => `<div class="pr">${chip(x.p)}<div class="rr-b"><i data-w="${(x.v / max * 100).toFixed(1)}" style="background:${pcol(x.p)}"></i></div><span class="pp">${fmt(x.v)}</span></div>`).join('')}</div>`;
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
function card(id, title, body, opts = {}) {
  return `<section class="card${opts.cls ? ' ' + opts.cls : ''}" id="c-${id}"><div class="card-h"><h3>${title}</h3><div class="acts">${opts.extra || ''}${opts.zoom === false ? '' : `<button class="zoom" data-zoom="${id}" title="Ampliar">${ICON_ZOOM}</button>`}</div></div>${body}</section>`;
}
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
function renderPanel() {
  const { u, key } = current(), m = ELS[S.el], a = agg(u, key, S.el), w = verdict(S.el, a), name = unitName(u, key);
  const crumb = S.sel ? `<div class="crumb"><button id="back">${esc(unitName(S.foco.u, S.foco.key))}</button><span>›</span><span>${esc(VK(S.sel.u).l)}</span></div>` : `<div class="crumb">${esc(m.cargo)} · ${m.anio}</div>`;
  let h = `<div class="ph">${crumb}<h2>${esc(name)}</h2><div class="acts-top"><button class="btn pri" id="btn-deck">${ICON_DECK}Presentación</button><button class="btn" id="btn-cmp">⇄ Comparar elecciones</button></div></div>`;
  if (a.n && a.t) {
    h += `<div class="kpis"><div class="kpi"><div class="v" ${a.ln ? `data-n="${a.ln}"` : ''}>${a.ln ? '0' : '—'}</div><div class="k">Lista nominal ${m.anio}</div></div><div class="kpi"><div class="v" data-n="${a.t}">0</div><div class="k">Votos</div></div><div class="kpi"><div class="v" ${a.ln ? `data-n="${pct(a.t, a.ln).toFixed(1)}" data-d="1" data-s=" %"` : ''}>${a.ln ? '0' : '—'}</div><div class="k">Participación</div></div></div>`;
    h += card('res', `Resultados`, vcols(S.el, a, u, key, S.partes) + resNote(S.el, a, S.partes), { extra: partesTabs(S.partes) });
  } else if (u !== 'sec') h += `<div class="note">No hubo elección de ${esc(m.cargo.toLowerCase())} en ${m.anio} aquí.</div>`;
  h += notes(u, a) + context(u, key);
  const tr = ribbon(u, key, cargoBase(m.cargo), 'cand', 400, 250, S.el); if (tr) h += card('tr', `${esc(cargoBase(m.cargo))} · elección por elección`, tr);
  const P = padron(u, key); if (P) h += card('pad', `Lista nominal hoy · ${fmt(P[1])}`, pyramid(P) + `<div class="src">Padrón ${fmt(P[0])} · corte ${esc(CAT.padron.corte)}</div>`, { zoom: false });
  const st = seats(); if (st) h += card('seats', `<span class="tag">Todo el estado</span> ${esc(st.title)}`, seatsBody(st, 380), { cls: 'state' });
  if (!S.sel && EST._afi) h += card('afi', '<span class="tag">Todo el estado</span> Afiliados por partido', afiliados() + `<div class="src">El INE publica solo el total del estado de Puebla; no hay cifra por municipio ni de Puebla capital. ${esc(CAT.afiliados.fuente)}.</div>`, { zoom: false, cls: 'state' });
  h += `<div class="src">Fuente: ${esc(m.fuente)}, ${m.anio}. ${esc(CAT.fuentes.cartografia)}.${P ? ' ' + esc(CAT.padron.fuente) + '.' : ''}</div>`;
  const B = $('#pbody'); B.innerHTML = h; B.scrollTop = 0; animate(B); linkRows(B); bindTips(B); hideTip();
  $$('#pbody .rc').forEach(g => g.onclick = () => { hideTip(); setEl(g.dataset.el); });
  $$('#pbody [data-bloc]').forEach(c => { c.onmouseenter = () => mapFocusParty(c.dataset.bloc); c.onmouseleave = () => highlight(); });
  const back = $('#back'); if (back) back.onclick = () => select(null);
  $$('#partes button').forEach(b => b.onclick = () => { S.partes = b.dataset.p; renderPanel(); });
  $$('[data-go]').forEach(b => b.onclick = () => { const [v, k] = b.dataset.go.split(/:(.*)/s); goTo(v, k); });
  $$('[data-secs]').forEach(b => b.onclick = () => { const k = +b.dataset.secs; S.foco = { u: 'mun', key: k }; setVista('sec', true); select({ u: 'mun', key: k }); fitGeom(geomOf('mun', k)); });
  $$('[data-zoom]').forEach(b => b.onclick = () => expand(b.dataset.zoom));
  $$('#pbody [data-mun]').forEach(r => r.onclick = () => goTo('mun', r.dataset.mun));
  $('#btn-cmp').onclick = openCompare;
  $('#btn-deck').onclick = openDeck;
  peekSize();
}
function expand(id) {
  if (id === 'res' || id === 'tr') return openExplore(id);
  const m = ELS[S.el], st = seats(); if (!st) return;
  openModal(`<h3 id="mtitle">${esc(st.title)}</h3><p class="msub">${esc(m.cargo)} ${m.anio}</p>${seatsBody(st, 680)}`);
  bindTips($('#mbody')); $$('#mbody [data-bloc]').forEach(c => { c.onmouseenter = () => mapFocusParty(c.dataset.bloc); c.onmouseleave = () => highlight(); });
}
function openModal(html) { const M = $('#modal'); $('#mbody').innerHTML = html; M.hidden = false; animate(M); const close = () => { M.hidden = true; hideTip(); highlight(); }; $('#mclose').onclick = close; M.onclick = e => { if (e.target === M) close(); }; }
function showUsers() {
  const U = MB.admin.usuarios;
  openModal(`<h3 id="mtitle">Usuarios</h3><p class="msub">Se administran en el Excel de usuarios; al correr pipeline/acceso.py se vuelven a cifrar los accesos.</p><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Nivel</th><th>Ámbito</th></tr></thead><tbody>${U.map(u => `<tr><td>${esc(u.usuario)}</td><td>${esc(u.nombre)}</td><td>${esc(u.nivel)}</td><td>${esc(u.ambito || 'Todo')}</td></tr>`).join('')}</tbody></table>`);
}

/* =================== PRESENTACIÓN =================== */
let DECK = 0, DECK_KEY = null, DECK_FIT = null;
function openDeck() {
  const { u, key } = current(), m = ELS[S.el], a = agg(u, key, S.el), w = verdict(S.el, a), name = unitName(u, key), P = padron(u, key);
  let snap = ''; try { snap = map.getCanvas().toDataURL('image/jpeg', .85); } catch {}
  const who = w ? personFor(S.el, u, key, w.c) : null, foot = `<div class="s-foot">Fuente: ${esc(m.fuente)}, ${m.anio}. ${esc(CAT.fuentes.cartografia)}.</div>`;
  const head = (eb, t) => `<div><div class="s-eyebrow">${esc(eb)}</div><h2>${esc(t)}</h2></div>`;
  const sl = [];
  sl.push(`<div class="slide cover"><div class="cv-img" style="background-image:url(${snap})"></div><div class="cv-txt"><div class="s-eyebrow">${esc(m.cargo)} · ${m.anio}</div><h1>${esc(name)}</h1>${w ? `<div class="big-win">Ganó <b>${esc(who || shortCand(w.c))}</b>${who ? ' · ' + esc(shortCand(w.c)) : ''} con ${p1(w.share)}</div>` : ''}</div></div>`);
  if (a.t) sl.push(`<div class="slide">${head(name, 'Datos generales')}<div class="s-body"><div class="kpis"><div class="kpi"><div class="v">${a.ln ? fmt(a.ln) : '—'}</div><div class="k">Lista nominal ${m.anio}</div></div><div class="kpi"><div class="v">${fmt(a.t)}</div><div class="k">Votos emitidos</div></div><div class="kpi"><div class="v">${a.ln ? p1(pct(a.t, a.ln)) : '—'}</div><div class="k">Participación</div></div><div class="kpi"><div class="v">${w ? w.margin.toFixed(1) + ' pts' : '—'}</div><div class="k">Ventaja del primer lugar</div></div></div>
    ${P ? `<div class="two"><div class="kpis" style="grid-template-columns:1fr 1fr"><div class="kpi"><div class="v">${fmt(P[1])}</div><div class="k">Lista nominal hoy</div></div><div class="kpi"><div class="v">${p1(pct(P[3], P[1]))}</div><div class="k">Mujeres en la lista</div></div></div>${pyramid(P)}</div>` : ''}</div>${foot}</div>`);
  if (a.t) sl.push(`<div class="slide">${head(name + ' · ' + m.anio, 'Resultados')}<div class="s-body"><div class="two" style="grid-template-columns:1.25fr 1fr"><div><h4 class="mh">Por coalición</h4>${vcols(S.el, a, u, key, 'cand', true)}</div><div><h4 class="mh">Por partido</h4>${vcols(S.el, a, u, key, 'part', false)}</div></div>${resNote(S.el, a, 'cand')}</div>${foot}</div>`);
  const st = seats(); if (st) sl.push(`<div class="slide">${head('Todo el estado de Puebla', st.title)}<div class="s-body">${seatsBody(st, 700)}</div>${foot}</div>`);
  const p = prevOf(S.el); if (p && a.t) sl.push(`<div class="slide">${head(name, `${p.anio} frente a ${m.anio}`)}<div class="s-body">${cmpView(u, key, p.id, S.el, true)}</div>${foot}</div>`);
  const tr = ribbon(u, key, cargoBase(m.cargo), 'cand', 1160, 440, S.el); if (tr) sl.push(`<div class="slide">${head(name, cargoBase(m.cargo) + ' · elección por elección')}<div class="s-body">${tr}</div>${foot}</div>`);
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
  $('#deck-pdf').onclick = () => { slides.forEach(s => animate(s)); setTimeout(() => window.print(), 900); };
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
  paint(); if (map.getLayer('dl-o')) applyCapas(); else labels();
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
function buildControls() {
  $('#cargo').innerHTML = CARGOS.map(c => { const ys = CAT.elecciones.filter(e => cargoBase(e.cargo) === c).map(e => e.anio); return `<option value="${c}">${c} · ${Math.min(...ys)}–${Math.max(...ys)}</option>`; }).join('');
  $('#cargo').onchange = e => { const last = CAT.elecciones.filter(x => cargoBase(x.cargo) === e.target.value && !x.cargo.includes('extra')).sort((a, b) => b.anio - a.anio)[0]; setEl(last.id); };
  $('#vistas').innerHTML = VISTAS.map(v => `<button data-v="${v.k}" class="${v.k === S.vista ? 'on' : ''}">${v.l}</button>`).join('');
  $$('#vistas button').forEach(b => b.onclick = () => { const k = b.dataset.v; setVista(k); if (VK(k).det) fitGeom(geomOf(S.foco.u, S.foco.key)); });
  syncElControls(); fillModo();
  const C = $('#capas'), btn = $('#btn-capas');
  C.innerHTML = `<div class="grp"><h4>Ver a color</h4><div class="tabs alc" id="alcance">${[['foco', unitName(HOME.u, HOME.key)], ['conurb', 'Zona conurbada'], ['zm', 'Zona metropolitana'], ['todo', 'Todo el estado']].map(([k, l]) => `<button data-alc="${k}" class="${CAPAS.alcance === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div></div>
    <div class="grp"><h4>Capas</h4>${CAPAS_DEF.map(([k, l, , sw]) => `<label class="tg"><input type="checkbox" data-capa="${k}" ${CAPAS[k] ? 'checked' : ''}>${l}${sw ? `<span class="sw-line" style="border-color:${LINE_COL[sw]}"></span>` : ''}</label>`).join('')}</div>`;
  $$('[data-alc]').forEach(b => b.onclick = () => { CAPAS.alcance = b.dataset.alc; store.set('pe_capas2', CAPAS); $$('[data-alc]').forEach(x => x.classList.toggle('on', x === b));
    if (CAPAS.alcance === 'foco') goHome(); else { S.sel = null; select(null); fitGeom(CAPAS.alcance === 'zm' ? GEO.zm.features[0].geometry : CAPAS.alcance === 'conurb' ? { coordinates: GEO.municipios.features.filter(f => f.properties.det).map(f => f.geometry.coordinates) } : GEO.estado_bbox); } labels(); });
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
  addL({ id: 'l-municipios', type: 'line', source: 'g-municipios', layout: { 'line-join': 'round' }, paint: { 'line-color': '#FFFFFF', 'line-width': W(1, 2, 3), 'line-opacity-transition': { duration: 450 } } });
  for (const d of ['dl', 'df']) {
    addL({ id: d + '-c', type: 'line', source: 'g-' + d, layout: { 'line-join': 'round', visibility: 'none' }, paint: { 'line-color': '#FFFFFF', 'line-width': W(4, 6, 8) } });
    addL({ id: d + '-o', type: 'line', source: 'g-' + d, layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL[d], 'line-width': W(2, 3, 4) } });
  }
  addL({ id: 'zm-l', type: 'line', source: 'g-zm', layout: { 'line-join': 'round' }, paint: { 'line-color': LINE_COL.zm, 'line-width': W(1.6, 2.4, 3.2) } });
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
