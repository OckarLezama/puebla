/* Puebla Electoral — resultados 2000–2024 del estado de Puebla, con Puebla capital y conurbados al detalle.
   Datos públicos sin cifrar: cartografía (data/geo) y catálogo. Resultados cifrados por paquete (data/seguro) y abiertos
   con la clave de cada usuario (data/acceso.json). Sin servidor. */
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
const candLabel = c => c.startsWith('CAND_IND') ? 'Independiente' : c.split('-').join(' · ');
const candColor = c => c.startsWith('CAND_IND') ? IND : (PARTY[c.split('-')[0]] || [IND])[0];
const candTitle = c => c.startsWith('CAND_IND') ? 'Candidatura independiente' : c.split('-').map(p => (PARTY[p] || [0, p])[1]).join(', ');
const shortCand = c => c.startsWith('CAND_IND') ? 'Independiente' : c.split('-')[0] + (c.includes('-') ? ' y aliados' : '');
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join(''); }
const titleCase = s => String(s).toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Del|La|Las|Los|Y|El)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase());

/* ---------- estado ---------- */
const CARGOS = ['Presidencia municipal', 'Diputación local', 'Diputación federal', 'Gubernatura', 'Senaduría', 'Presidencia de la República'];
const CARGO_CORTO = { 'Presidencia municipal': 'Pres. municipal', 'Diputación local': 'Dip. local', 'Diputación federal': 'Dip. federal', Gubernatura: 'Gubernatura', 'Senaduría': 'Senaduría', 'Presidencia de la República': 'Presidencia' };
const cargoBase = c => c.replace(' (extraordinaria)', '');
const VISTAS = [
  { k: 'sec', l: 'Sección', geo: 'secciones', id: 'seccion', det: true },
  { k: 'col', l: 'Colonia', geo: 'colonias', id: 'cid', det: true },
  { k: 'ja', l: 'Junta aux.', geo: 'juntas', id: 'ja', det: true },
  { k: 'mun', l: 'Municipio', geo: 'municipios', id: 'municipio' },
  { k: 'dl', l: 'Dist. local', geo: 'dl', id: 'distrito_l' },
  { k: 'df', l: 'Dist. federal', geo: 'df', id: 'distrito_f' },
];
const UNIDAD = { sec: ['sección', 'secciones'], col: ['colonia', 'colonias'], ja: ['junta', 'juntas'], mun: ['municipio', 'municipios'], dl: ['distrito', 'distritos'], df: ['distrito', 'distritos'] };
const S = { el: '2024-AYU', vista: 'sec', modo: 'win', sel: null, partes: 'cand' };
let CAT, ELS = {}, EST, MB = {}, GEO = {}, PERFIL, map, AGG = {}, MUNN = {}, SECMUN = {}, COLS_OF_SEC = {}, DETOK = [];
const CAPAS_DEF = [
  ['estado', 'Municipios del estado', true, null], ['zm', 'Zona metropolitana', true, 'dash'], ['conurb', 'Puebla y conurbados', true, 'solid'],
  ['dl', 'Distritos locales', false, 'dash2'], ['df', 'Distritos federales', false, 'dash3'], ['carr', 'Carreteras', true, null], ['calles', 'Calles, ríos y presas', true, null],
];
let CAPAS = Object.assign(Object.fromEntries(CAPAS_DEF.map(c => [c[0], c[2]])), store.get('pe_capas') || {});

/* =================== ACCESO =================== */
const b64d = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const b64e = b => btoa(String.fromCharCode(...new Uint8Array(b)));
async function aesOpen(rawKey, buf) {
  const k = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, k, buf.slice(12));
}
async function gunzipJSON(buf) { return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json(); }
async function login(usuario, clave) {
  const A = await fetch('data/acceso.json', { cache: 'no-cache' }).then(r => r.json());
  const u = usuario.trim().toLowerCase();
  const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(A.sal + '|' + u)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const e = A.u[h]; if (!e) throw new Error('auth');
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveKey']);
  const kek = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64d(e.s), iterations: A.it, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  let perfil;
  try { const p = b64d(e.p); perfil = JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: p.slice(0, 12) }, kek, p.slice(12)))); }
  catch { throw new Error('auth'); }
  const keys = {};
  for (const cab in e.k) { const b = b64d(e.k[cab]); keys[cab] = b64e(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, kek, b.slice(12))); }
  return { perfil, keys };
}
async function openBundle(cab, key) {
  const r = await fetch('data/seguro/' + cab + '.bin', { cache: 'no-cache' }); if (!r.ok) throw new Error(cab + ' ' + r.status);
  return gunzipJSON(await aesOpen(b64d(key), new Uint8Array(await r.arrayBuffer())));
}

/* =================== AGREGACIÓN =================== */
const EMPTY = () => ({ ln: 0, t: 0, nu: 0, nr: 0, c: null, p: null, n: 0, nx: 0, tx: 0 });
function addPack(o, pk) {
  if (!pk) return;
  if (!o.c) { o.c = pk[4].slice(); o.p = pk[5].slice(); } else { for (let i = 0; i < pk[4].length; i++) o.c[i] += pk[4][i]; for (let i = 0; i < pk[5].length; i++) o.p[i] += pk[5][i]; }
  o.ln += pk[0]; o.t += pk[1]; o.nu += pk[2]; o.nr += pk[3]; o.n++;
  if (pk[6]) { o.nx++; o.tx += pk[1]; }
}
function secPack(eid, s) { const m = SECMUN[s]; return m && MB[m] && MB[m][eid] ? MB[m][eid][s] : null; }
function unitSecs(u, key) {
  if (u === 'sec') return [key];
  if (u === 'col') return GEO.colonias.byId[key].properties.secs;
  if (u === 'ja') return GEO.secciones.features.filter(f => f.properties.ja === key).map(f => f.properties.seccion);
  return [];
}
function agg(u, key, eid) {
  const o = EMPTY(), E = EST[eid];
  if (!E) return o;
  if (u === 'est') addPack(o, E.est);
  else if (u === 'mun') addPack(o, E.mun[key]);
  else if (u === 'dl' || u === 'df') addPack(o, E[u][key]);
  else {
    for (const s of unitSecs(u, key)) addPack(o, secPack(eid, s));
    if (u === 'ja' && MB[115] && MB[115][eid]) for (const [s, pk] of Object.entries(MB[115][eid])) if (pk[6] && pk[7] === key) addPack(o, pk);
  }
  return o;
}
function ranking(eid, a) { const m = ELS[eid]; return a.c ? m.cand.map((c, i) => ({ c, i, v: a.c[i] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v) : []; }
function verdict(eid, a) {
  const r = ranking(eid, a); if (!a.n || !a.t || !r.length) return null;
  const v1 = r[0].v, v2 = r[1] ? r[1].v : 0;
  return { c: r[0].c, share: pct(v1, a.t), margin: pct(v1 - v2, a.t), tie: v1 === v2, second: r[1] && r[1].c };
}
function munOfUnit(u, key) {
  if (u === 'mun') return key;
  if (u === 'sec') return SECMUN[key];
  if (u === 'col') return GEO.colonias.byId[key].properties.municipio;
  if (u === 'ja') return 115;
  return null;
}
/* nombre de quien encabezó la candidatura, cuando el registro de ganadores lo permite */
function personFor(eid, u, key, cand) {
  const E = EST[eid], g = E && E.g; if (!g) return null;
  const t = ELS[eid].tipo;
  const lead = cand.split('-')[0], match = w => w && w[1].split(/[_-]/).includes(lead) ? w[0] : null;
  if (t === 'AYU') { const mm = munOfUnit(u, key); return mm ? match(g['m' + mm]) : null; }
  if (t === 'GOB' || t === 'PRE') { if (g.est && !g.est[1]) { const w = verdict(eid, agg('est', 0, eid)); return w && w.c === cand ? g.est[0] : null; } return match(g.est); }
  if ((t === 'DL' || t === 'DF') && u === t.toLowerCase()) return match(g[u + key]);
  if (t === 'SEN' && g.est_sen) { const n = g.est_sen.filter(w => match(w)).map(w => w[0]); return n.length ? n.join(' y ') : null; }
  return null;
}

/* =================== COLOR =================== */
const BINS_P = [40, 50, 60, 70], BINS_C = [20, 35, 50, 65];
const binIdx = (v, bins) => { let i = 0; while (i < bins.length && v >= bins[i]) i++; return i; };
const rampColor = (base, i) => mix(base, cssVar('--mapbg') || '#eeeeee', [0.82, 0.62, 0.42, 0.2, 0][i]);
function colorFor(u) {
  const nores = cssVar('--nores');
  if (!u || !u.w) return nores;
  if (S.modo === 'win') {
    if (u.w.tie) return '#9AA3A3';
    return mix(candColor(u.w.c), cssVar('--mapbg'), u.w.margin < 5 ? 0.55 : u.w.margin < 15 ? 0.28 : 0);
  }
  if (S.modo === 'part') return u.a.ln ? rampColor('#5E6B67', binIdx(pct(u.a.t, u.a.ln), BINS_P)) : nores;
  const i = ELS[S.el].cand.indexOf(S.modo);
  return i < 0 ? nores : rampColor(candColor(S.modo), binIdx(pct(u.a.c[i], u.a.t), BINS_C));
}
function computeAgg(vk) {
  const v = VISTAS.find(x => x.k === vk), out = {};
  for (const f of GEO[v.geo].features) { const key = f.properties[v.id]; const a = agg(vk, key, S.el); out[key] = { a, w: verdict(S.el, a) }; }
  return out;
}
let MUNAGG = {};
function paint() {
  AGG = computeAgg(S.vista);
  MUNAGG = S.vista === 'mun' ? AGG : computeAgg('mun');
  for (const [k, u] of Object.entries(MUNAGG)) map.setFeatureState({ source: 'g-municipios', id: k }, { c: colorFor(u) });
  if (S.vista !== 'mun') { const v = VISTAS.find(x => x.k === S.vista); for (const [k, u] of Object.entries(AGG)) map.setFeatureState({ source: 'g-' + v.geo, id: k }, { c: colorFor(u) }); }
  const v = VISTAS.find(x => x.k === S.vista);
  if (v.det) {
    const sin = Object.keys(AGG).filter(k => !AGG[k].w).map(k => keyOf(S.vista, k));
    map.setFilter('t-' + v.geo, ['in', ['get', v.id], ['literal', sin]]);
  }
  legend(); hero(); renderPanel();
}

/* =================== LEYENDA Y RESUMEN =================== */
function legend() {
  const L = $('#legend'), m = ELS[S.el]; let h = '';
  if (S.modo === 'win') {
    const g = cssVar('--fg'), bg = cssVar('--mapbg');
    h += `<h4>Ventaja de quien ganó</h4><div class="items"><span class="it"><span class="sw" style="background:${mix(g, bg, .55)}"></span>Menos de 5 pts</span><span class="it"><span class="sw" style="background:${mix(g, bg, .28)}"></span>5 a 15</span><span class="it"><span class="sw" style="background:${g}"></span>Más de 15</span></div>`;
  } else {
    const isP = S.modo === 'part', base = isP ? '#5E6B67' : candColor(S.modo), bins = isP ? BINS_P : BINS_C;
    h += `<h4>${isP ? 'Participación (% de la lista nominal)' : 'Votación de ' + esc(candLabel(S.modo)) + ' (% de votos)'}</h4><div class="ramp">${[0, 1, 2, 3, 4].map(i => `<span style="background:${rampColor(base, i)}"></span>`).join('')}</div><div class="rampl"><span>0</span>${bins.map(b => `<span>${b}</span>`).join('')}<span>100</span></div>`;
    if (isP && !m.ln) h += '<div class="items"><span class="it">El cómputo de ' + m.anio + ' no trae lista nominal.</span></div>';
  }
  const v = VISTAS.find(x => x.k === S.vista), nores = Object.values(AGG).filter(u => !u.w).length;
  if (nores && v.det) h += `<div class="items"><span class="it"><span class="sw" style="background:${cssVar('--nores')};background-image:repeating-linear-gradient(135deg,rgba(110,120,115,.6) 0 1px,transparent 1px 4px)"></span>${S.vista === 'sec' ? 'Secciones creadas después de ' + m.anio : 'Sin resultados en ' + m.anio} (${nores})</span></div>`;
  L.innerHTML = h;
}
function focus() {
  if (PERFIL.nivel === 5) { const t = PERFIL.ambito.slice(0, 2).toLowerCase(), k = +PERFIL.ambito.slice(2); return { u: t, key: k, name: (t === 'dl' ? 'Distrito local ' : 'Distrito federal ') + k }; }
  if (PERFIL.nivel === 4 && PERFIL.ambito) { const k = +PERFIL.ambito; return { u: 'mun', key: k, name: k === 115 ? 'Puebla capital' : MUNN[k] }; }
  return { u: 'mun', key: 115, name: 'Puebla capital' };
}
function hero() {
  const F = focus(), m = ELS[S.el], a = agg(F.u, F.key, S.el), r = ranking(S.el, a), w = verdict(S.el, a);
  // unidades ganadas dentro del foco (en vista de municipio o distrito, en todo el estado)
  const v = VISTAS.find(x => x.k === S.vista), won = {};
  const inFocus = f => { const p = f.properties; if (!v.det) return true;
    if (F.u === 'mun') return v.k === 'ja' ? F.key === 115 : (p.municipio === F.key);
    if (v.k === 'sec') return p[F.u === 'dl' ? 'distrito_l' : 'distrito_f'] === F.key;
    const ss = v.k === 'col' ? p.secs : unitSecs('ja', p.ja); return ss.some(s => { const q = GEO.secciones.byId[s]; return q && q.properties[F.u === 'dl' ? 'distrito_l' : 'distrito_f'] === F.key; }); };
  for (const f of GEO[v.geo].features) { const u = AGG[f.properties[v.id]]; if (u && u.w && !u.w.tie && inFocus(f)) won[u.w.c] = (won[u.w.c] || 0) + 1; }
  const un = UNIDAD[S.vista][1], top = r.slice(0, 3), rest = a.t - top.reduce((s, x) => s + x.v, 0);
  const H = $('#hero'), open = H.classList.contains('open');
  const who = w ? personFor(S.el, F.u, F.key, w.c) : null;
  H.innerHTML = `<button class="hero-toggle" aria-label="Ver resumen"></button>
    <div><div class="eyebrow"><svg><use href="#i-rombo"/></svg>${esc(F.name)} · ${m.anio}</div><h2>${esc(m.cargo)}<small>${a.t ? (a.ln ? p1(pct(a.t, a.ln)) + ' de participación' : fmt(a.t) + ' votos') : 'Sin elección en ' + m.anio}</small></h2></div>
    ${a.t ? `<div class="stack" title="Reparto de la votación">${top.map(x => `<i style="width:${pct(x.v, a.t)}%;background:${candColor(x.c)}" title="${esc(candLabel(x.c))} ${p1(pct(x.v, a.t))}"></i>`).join('')}<i style="width:${pct(rest, a.t)}%;background:var(--nores)"></i></div>
    ${w && !w.tie ? `<div class="who-won">Ganó <b>${esc(who || shortCand(w.c))}</b>${who ? ` <span style="color:var(--muted)">(${esc(shortCand(w.c))})</span>` : ''}</div>` : ''}
    <div class="rows">${top.map(x => `<div class="r"><span class="sw" style="background:${candColor(x.c)}"></span><span class="nm" title="${esc(candTitle(x.c))}">${esc(candLabel(x.c))}</span><span class="pc">${p1(pct(x.v, a.t))}</span><span class="wn">${won[x.c] || 0} ${un}</span></div>`).join('')}</div>` : ''}`;
  if (open) H.classList.add('open');
  H.querySelector('.hero-toggle').onclick = () => H.classList.toggle('open');
}

/* =================== FICHA =================== */
function unitName(u, key) {
  if (u === 'est') return 'Estado de Puebla';
  if (u === 'mun') return key === 115 ? 'Puebla capital' : MUNN[key];
  if (u === 'sec') return 'Sección ' + key;
  if (u === 'col') return GEO.colonias.byId[key].properties.nombre;
  if (u === 'ja') return key === 'Zona Centro' ? 'Zona Centro' : 'Junta auxiliar ' + key;
  if (u === 'dl') return 'Distrito local ' + key;
  if (u === 'df') return 'Distrito federal ' + key;
}
function bars(eid, a, u, key) {
  const m = ELS[eid]; let rows;
  if (S.partes === 'cand') rows = ranking(eid, a).map(x => ({ l: candLabel(x.c), s: personFor(eid, u, key, x.c), t: candTitle(x.c), col: candColor(x.c), v: x.v }));
  else rows = m.part.map((p, i) => ({ l: p, t: (PARTY[p] || [0, p])[1], col: (PARTY[p] || [IND])[0], v: a.p[i] })).filter(x => x.v > 0).sort((x, y) => y.v - x.v);
  rows.push({ l: 'Votos nulos', col: cssVar('--muted'), v: a.nu, minor: true });
  if (a.nr) rows.push({ l: 'Candidaturas no registradas', col: cssVar('--muted'), v: a.nr, minor: true });
  const max = Math.max(...rows.map(r => r.v), 1);
  return `<div class="bars">${rows.map(r => `<div class="b${r.minor ? ' minor' : ''}" title="${esc(r.t || '')}"><span class="n">${esc(r.l)}${r.s ? `<small>${esc(r.s)}</small>` : ''}</span><span class="vv">${fmt(r.v)}</span><span class="pp">${p1(pct(r.v, a.t))}</span><span class="track"><i style="width:${(r.v / max * 100).toFixed(1)}%;background:${r.col}"></i></span></div>`).join('')}</div>`;
}
function history(u, key) {
  const years = [...new Set(CAT.elecciones.map(e => e.anio))].sort((a, b) => a - b);
  let h = `<div class="grid-h"><table><thead><tr><th></th>${years.map(y => `<th>${String(y).slice(2)}</th>`).join('')}</tr></thead><tbody>`;
  for (const c of CARGOS) {
    h += `<tr><th>${CARGO_CORTO[c]}</th>`;
    for (const y of years) {
      const e = CAT.elecciones.find(x => x.anio === y && cargoBase(x.cargo) === c);
      if (!e) { h += '<td></td>'; continue; }
      const a = agg(u, key, e.id), w = verdict(e.id, a);
      h += w ? `<td><button data-el="${e.id}" class="${e.id === S.el ? 'on' : ''}" style="background:${w.tie ? '#9AA3A3' : candColor(w.c)}" title="${y} · ${esc(e.cargo)}: ${esc(w.tie ? 'empate' : candLabel(w.c) + ' ' + p1(w.share))}"></button></td>`
             : `<td><div class="none" title="${y} · ${esc(e.cargo)}: sin resultados aquí"></div></td>`;
    }
    h += '</tr>';
  }
  return h + '</tbody></table></div><div class="src">Cada cuadro es una elección pintada con el color de quien ganó aquí. Tócalo para verla.</div>';
}
function trend(u, key) {
  const cargo = cargoBase(ELS[S.el].cargo);
  const pts = CAT.elecciones.filter(e => cargoBase(e.cargo) === cargo && !e.cargo.includes('extra')).sort((a, b) => a.anio - b.anio).map(e => {
    const a = agg(u, key, e.id), by = {};
    if (a.t) for (const x of ranking(e.id, a)) { const p = x.c.startsWith('CAND_IND') ? 'IND' : x.c.split('-')[0]; by[p] = (by[p] || 0) + pct(x.v, a.t); }
    return { e, a, by, part: a.ln ? pct(a.t, a.ln) : null };
  }).filter(p => p.a.t);
  if (pts.length < 2) return '';
  const tot = {}; pts.forEach(p => Object.entries(p.by).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v));
  const lead = Object.entries(tot).filter(([k]) => k !== 'IND').sort((a, b) => b[1] - a[1]).slice(0, 4).map(x => x[0]);
  const W = 360, Hh = 160, L = 30, R = 10, T = 10, B = 22, xs = i => L + i * (W - L - R) / (pts.length - 1), ys = v => T + (1 - v / 100) * (Hh - T - B);
  let g = [0, 25, 50, 75, 100].map(v => `<line class="ax" x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}"/><text x="${L - 6}" y="${ys(v) + 3.5}" text-anchor="end">${v}</text>`).join('');
  g += pts.map((p, i) => `<text x="${xs(i)}" y="${Hh - 4}" text-anchor="middle">${p.e.anio}</text>`).join('');
  const line = (vals, col, dash) => `<polyline fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" ${dash ? 'stroke-dasharray="4 4"' : ''} points="${vals.map((v, i) => v == null ? '' : xs(i) + ',' + ys(v)).join(' ')}"/>` + vals.map((v, i) => v == null ? '' : `<circle cx="${xs(i)}" cy="${ys(v)}" r="${i === vals.length - 1 ? 4 : 2.8}" fill="${col}"><title>${pts[i].e.anio}: ${p1(v)}</title></circle>`).join('');
  if (pts.some(p => p.part != null)) g += line(pts.map(p => p.part), cssVar('--muted'), true);
  for (const p of lead) g += line(pts.map(x => x.by[p] || 0), (PARTY[p] || [IND])[0]);
  return `<div class="sec trend"><h3><span>${esc(cargo)} · cómo ha cambiado</span></h3><svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Tendencia de votación">${g}</svg>
    <div class="lg">${lead.map(p => `<span><i style="background:${(PARTY[p] || [IND])[0]}"></i>${p}${pts.some(x => ranking(x.e.id, x.a).some(r => r.c.split('-')[0] === p && r.c.includes('-'))) ? ' y aliados' : ''}</span>`).join('')}<span><i style="background:${cssVar('--muted')}"></i>Participación</span></div></div>`;
}
function context(u, key) {
  const chip = (go, t) => `<button class="chip" data-go="${go}">${esc(t)}</button>`;
  if (u === 'sec') {
    const p = GEO.secciones.byId[key].properties, cols = (COLS_OF_SEC[key] || []);
    return `<div class="chips">${chip('mun:' + p.municipio, unitName('mun', p.municipio))}${p.ja ? chip('ja:' + p.ja, p.ja) : ''}${chip('dl:' + p.distrito_l, 'Distrito local ' + p.distrito_l)}${chip('df:' + p.distrito_f, 'Distrito federal ' + p.distrito_f)}</div>`
      + (cols.length ? `<div class="sec"><h3>Colonias en esta sección</h3><div class="chips">${cols.slice(0, 14).map(c => chip('col:' + c, GEO.colonias.byId[c].properties.nombre)).join('')}${cols.length > 14 ? `<span class="chip static">y ${cols.length - 14} más</span>` : ''}</div></div>` : '');
  }
  if (u === 'col') {
    const p = GEO.colonias.byId[key].properties;
    return `<div class="chips"><span class="chip static">CP ${esc(p.cp)}</span>${chip('mun:' + p.municipio, unitName('mun', p.municipio))}${p.ja ? chip('ja:' + p.ja, p.ja) : ''}</div><div class="sec"><h3>Secciones que la cubren</h3><div class="chips">${p.secs.map(s => chip('sec:' + s, s)).join('')}</div></div>`;
  }
  if (u === 'mun') {
    const mm = CAT.municipios.find(x => x.id === key); const tags = [];
    if (key === 115) tags.push('Capital'); else if (mm && mm.det) tags.push('Conurbado'); if (mm && mm.zm) tags.push('Zona metropolitana');
    return tags.length ? `<div class="chips">${tags.map(t => `<span class="chip static">${t}</span>`).join('')}</div>` : '';
  }
  return '';
}
function notes(u, a) {
  const m = ELS[S.el], out = [];
  if (u === 'sec' && !a.n) out.push(`Esta sección se creó después de ${m.anio}. Sus votos de esa elección están en el total del municipio, en la sección de la que se separó.`);
  if (u === 'col') out.push('Una colonia no es unidad electoral: la cifra suma completas las secciones que la cubren.');
  if (u === 'ja' && a.nx) out.push(`Incluye ${fmt(a.tx)} votos de ${a.nx} secciones que el INE dividió después de ${m.anio}.`);
  if (u === 'dl' || u === 'df') out.push(`Distrito con su trazo vigente, armado con las secciones que hoy lo forman${m.cobertura_distritos < 0.99 ? ` (cubre ${Math.round(m.cobertura_distritos * 100)} % de los votos de ${m.anio}; el resto fue en secciones que ya no existen)` : ''}.`);
  if (m.tipo === 'AYU' && u === 'est') out.push('Suma de los 217 ayuntamientos: cada municipio eligió por separado.');
  return out.map(t => `<div class="note">${esc(t)}</div>`).join('');
}
function renderPanel() {
  const F = focus(), u = S.sel != null ? S.vista : F.u, key = S.sel != null ? S.sel : F.key, m = ELS[S.el];
  const a = agg(u, key, S.el), w = verdict(S.el, a);
  const crumb = S.sel != null ? `<div class="crumb"><button id="back">${esc(F.name)}</button><span>›</span><span>${esc(VISTAS.find(v => v.k === S.vista).l)}</span></div>` : `<div class="crumb">${esc(m.cargo)} · ${m.anio}</div>`;
  let h = `<div class="ph">${crumb}<h2>${esc(unitName(u, key))}</h2><div class="meta">${S.sel != null ? esc(m.cargo) + ' · ' + m.anio : 'Toca el mapa para ver cualquier zona'}</div></div>`;
  if (a.n && a.t) {
    h += `<div class="kpis"><div class="kpi"><div class="v">${a.ln ? fmt(a.ln) : '—'}</div><div class="k">Lista nominal</div></div><div class="kpi"><div class="v">${fmt(a.t)}</div><div class="k">Votos</div></div><div class="kpi"><div class="v">${a.ln ? p1(pct(a.t, a.ln)) : '—'}</div><div class="k">Participación</div></div></div>`;
    if (w) { const who = personFor(S.el, u, key, w.c);
      h += `<div class="win"><span class="bar" style="background:${candColor(w.c)}"></span><div>${w.tie ? '<div class="who-n">Empate</div>' : `<small>Ganó</small><div class="who-n">${esc(who || candLabel(w.c))}</div><small>${who ? esc(candLabel(w.c)) + ' · ' : ''}${p1(w.share)} · ventaja de ${w.margin.toFixed(1)} puntos sobre ${esc(shortCand(w.second || ''))}</small>`}</div></div>`; }
    h += `<div class="sec"><h3><span>Votos</span><span class="seg" id="partes"><button data-p="cand" class="${S.partes === 'cand' ? 'on' : ''}">Candidaturas</button><button data-p="part" class="${S.partes === 'part' ? 'on' : ''}">Partidos</button></span></h3>${bars(S.el, a, u, key)}</div>`;
    if (S.partes === 'part') h += '<div class="src">Por partido cuentan solo los votos con su logo. Los votos que marcaron varios logos de una coalición van a la candidatura.</div>';
  } else if (!(u === 'sec')) h += `<div class="note">No hubo elección de ${esc(m.cargo.toLowerCase())} en ${m.anio} aquí.</div>`;
  h += notes(u, a) + context(u, key) + trend(u, key);
  h += `<div class="sec"><h3>Todas las elecciones · 2000–2024</h3>${history(u, key)}</div>`;
  h += `<div class="src">Fuente: ${esc(m.fuente)}, ${m.anio}. ${esc(CAT.fuentes.cartografia)}.${u === 'ja' || (u === 'sec' && GEO.secciones.byId[key] && GEO.secciones.byId[key].properties.ja) ? ' ' + esc(CAT.fuentes.juntas) + '.' : ''}</div>`;
  $('#pbody').innerHTML = h; $('#pbody').scrollTop = 0;
  const back = $('#back'); if (back) back.onclick = () => select(null);
  $$('#partes button').forEach(b => b.onclick = () => { S.partes = b.dataset.p; renderPanel(); });
  $$('.grid-h button').forEach(b => b.onclick = () => setEl(b.dataset.el));
  $$('[data-go]').forEach(b => b.onclick = () => { const [v, k] = b.dataset.go.split(/:(.*)/s); goTo(v, k); });
  peekSize();
}

/* =================== NAVEGACIÓN =================== */
const keyOf = (u, k) => u === 'ja' ? k : Number(k);
function select(key) {
  S.sel = key;
  const v = VISTAS.find(x => x.k === S.vista);
  if (map.getLayer('sel')) map.removeLayer('sel');
  map.addLayer({ id: 'sel', type: 'line', source: 'g-' + v.geo, paint: { 'line-color': cssVar('--fg'), 'line-width': 3.2 }, filter: ['==', ['get', v.id], key == null ? '__none__' : key] });
  renderPanel();
  if (key != null && isMobile()) $('#panel').dataset.state = 'open';
}
function geomOf(u, key) { const v = VISTAS.find(x => x.k === u); const f = GEO[v.geo].features.find(f => f.properties[v.id] === key); return f && f.geometry; }
function goTo(u, k) { const key = keyOf(u, k); if (S.vista !== u) setVista(u, true); select(key); const g = geomOf(u, key); if (g) fit(g); }
function bbox(geom) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const walk = c => { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); };
  walk(geom.coordinates || geom); return [[x0, y0], [x1, y1]];
}
function fit(geom, dur = 650) {
  const mob = isMobile(), wide = map.getContainer().clientWidth > 900;
  map.fitBounds(bbox(geom), { padding: { top: mob ? 80 : 30, left: wide ? 400 : 40, right: wide ? 30 : 40, bottom: mob ? window.innerHeight * 0.3 : 30 }, maxZoom: 15.5, duration: dur });
}
function fitFocus(dur) { const F = focus(); const g = geomOf(F.u, F.key); if (g) fit(g, dur); }
function setVista(k, keepSel) {
  S.vista = k; if (!keepSel) S.sel = null;
  const v = VISTAS.find(x => x.k === k);
  for (const x of VISTAS) {
    const on = x.k === k && (x.k !== 'mun');
    if (x.k === 'mun') continue;
    for (const p of ['f-', 'l-', 't-']) if (map.getLayer(p + x.geo)) map.setLayoutProperty(p + x.geo, 'visibility', on ? 'visible' : 'none');
  }
  // municipios: llenos en vista municipio; tenues como contexto en las demás
  const ctx = v.det ? 0.42 : (k === 'mun' ? 0.93 : 0.18);
  map.setPaintProperty('f-municipios', 'fill-opacity', ['case', ['boolean', ['feature-state', 'h'], false], Math.min(ctx + .15, 1), ctx]);
  map.setLayoutProperty('f-municipios', 'visibility', CAPAS.estado || k === 'mun' ? 'visible' : 'none');
  $$('#vistas button').forEach(b => b.classList.toggle('on', b.dataset.v === k));
  paint(); labels();
  if (!keepSel) select(null);
}
function setEl(eid) {
  const prev = S.modo; S.el = eid;
  if (prev !== 'win' && prev !== 'part') S.modo = ELS[eid].cand.find(c => c.split('-')[0] === prev.split('-')[0]) || 'win';
  syncElControls(); fillModo(); paint();
}

/* =================== CONTROLES =================== */
function syncElControls() {
  const m = ELS[S.el], cargo = cargoBase(m.cargo);
  $('#cargo').value = cargo;
  const years = CAT.elecciones.filter(e => cargoBase(e.cargo) === cargo);
  $('#anios').innerHTML = years.map(e => `<button data-el="${e.id}" class="${e.id === S.el ? 'on' : ''}" title="${esc(e.cargo)} ${e.anio}">${e.anio}${e.cargo.includes('extra') ? '*' : ''}</button>`).join('');
  $$('#anios button').forEach(b => b.onclick = () => setEl(b.dataset.el));
  const on = $('#anios .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function fillModo() {
  const m = ELS[S.el], tops = m.cand.filter(c => !c.startsWith('CAND_IND')).slice(0, 6);
  $('#modo').innerHTML = `<option value="win">Quién ganó</option><option value="part">Participación</option><optgroup label="Votación de…">${tops.map(c => `<option value="${c}">${esc(candLabel(c))}</option>`).join('')}</optgroup>`;
  if (!['win', 'part', ...tops].includes(S.modo)) S.modo = 'win';
  $('#modo').value = S.modo;
}
function buildControls() {
  $('#cargo').innerHTML = CARGOS.map(c => `<option>${c}</option>`).join('');
  $('#cargo').onchange = e => { const last = CAT.elecciones.filter(x => cargoBase(x.cargo) === e.target.value && !x.cargo.includes('extra')).sort((a, b) => b.anio - a.anio)[0]; setEl(last.id); };
  const vis = VISTAS.filter(v => !v.det || (v.k === 'ja' ? DETOK.includes(115) : DETOK.length));
  $('#vistas').innerHTML = vis.map(v => `<button data-v="${v.k}" class="${v.k === S.vista ? 'on' : ''}">${v.l}</button>`).join('');
  $$('#vistas button').forEach(b => b.onclick = () => setVista(b.dataset.v));
  $('#modo').onchange = e => { S.modo = e.target.value; paint(); };
  syncElControls(); fillModo();
  // capas
  const C = $('#capas'), btn = $('#btn-capas');
  C.innerHTML = `<div class="grp"><h4>Ir a</h4><div class="chips"><button class="chip" data-fly="foco">${esc(focus().name)}</button><button class="chip" data-fly="zm">Zona metropolitana</button><button class="chip" data-fly="est">Todo el estado</button></div></div>
    <div class="grp"><h4>Capas</h4>${CAPAS_DEF.map(([k, l, , sw]) => `<label class="tg"><input type="checkbox" data-capa="${k}" ${CAPAS[k] ? 'checked' : ''}>${l}${sw ? `<span class="sw-line ${sw === 'solid' ? '' : 'dash'}" style="border-color:${sw === 'solid' ? 'var(--oro)' : sw === 'dash' ? 'var(--oro-d)' : sw === 'dash2' ? '#2B6E8F' : '#6B3F8F'}"></span>` : ''}</label>`).join('')}</div>`;
  btn.onclick = () => { const o = C.hidden; C.hidden = !o; btn.setAttribute('aria-expanded', String(o)); };
  $$('[data-capa]').forEach(i => i.onchange = () => { CAPAS[i.dataset.capa] = i.checked; store.set('pe_capas', CAPAS); applyCapas(); });
  $$('[data-fly]').forEach(b => b.onclick = () => { const t = b.dataset.fly; if (t === 'foco') fitFocus(); else if (t === 'zm') fit(GEO.zm.features[0].geometry); else fit(GEO.estado_bbox); if (isMobile()) { C.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
  $('#who').innerHTML = `<b>${esc(PERFIL.nombre)}</b> · ${esc(PERFIL.nivel_n)}${PERFIL.ambito ? ' ' + esc(PERFIL.ambito) : ''}`;
  $('#btn-out').onclick = () => { sess.del('pe_s'); location.reload(); };
  if (MB.admin) { $('#btn-users').hidden = false; $('#btn-users').onclick = showUsers; }
}
function showUsers() {
  const U = MB.admin.usuarios;
  $('#mbody').innerHTML = `<h3 id="mtitle">Usuarios</h3><p class="src">Se administran en el Excel de usuarios; al correr <code>pipeline/acceso.py</code> se vuelven a cifrar los accesos.</p><table><thead><tr><th>Usuario</th><th>Nombre</th><th>Nivel</th><th>Ámbito</th></tr></thead><tbody>${U.map(u => `<tr><td>${esc(u.usuario)}</td><td>${esc(u.nombre)}</td><td>${esc(u.nivel)}</td><td>${esc(u.ambito || 'Todo')}</td></tr>`).join('')}</tbody></table>`;
  $('#modal').hidden = false; $('#mclose').onclick = () => $('#modal').hidden = true;
}
function applyCapas() {
  const vis = (id, on) => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none'); };
  vis('f-municipios', CAPAS.estado || S.vista === 'mun'); vis('l-municipios', CAPAS.estado || S.vista === 'mun');
  vis('zm-l', CAPAS.zm); vis('det-l', CAPAS.conurb); vis('cap-l', CAPAS.conurb); vis('cap-glow', CAPAS.conurb);
  vis('dl-o', CAPAS.dl); vis('df-o', CAPAS.df);
  vis('carr', CAPAS.carr); vis('carr-a', CAPAS.carr);
  for (const id of ['via', 'rio', 'lago', 'calles']) vis(id, CAPAS.calles);
  labels();
}

/* =================== BÚSQUEDA =================== */
let SEARCH = [];
function buildSearch() {
  for (const m of CAT.municipios) SEARCH.push({ t: m.n, s: norm(m.n), k: 'mun', id: m.id, h: m.id === 115 ? 'Capital' : m.det ? 'Conurbado' : 'Municipio' });
  for (const f of GEO.secciones.features) SEARCH.push({ t: 'Sección ' + f.properties.seccion, s: String(f.properties.seccion), k: 'sec', id: f.properties.seccion, h: MUNN[f.properties.municipio] });
  for (const f of GEO.colonias.features) SEARCH.push({ t: f.properties.nombre, s: norm(f.properties.nombre) + ' ' + f.properties.cp, k: 'col', id: f.properties.cid, h: MUNN[f.properties.municipio] + ' · CP ' + f.properties.cp });
  for (const f of GEO.juntas.features) SEARCH.push({ t: f.properties.ja, s: norm(f.properties.ja), k: 'ja', id: f.properties.ja, h: 'Junta auxiliar' });
  for (const f of GEO.dl.features) SEARCH.push({ t: 'Distrito local ' + f.properties.distrito_l, s: 'distrito local ' + f.properties.distrito_l + ' dl' + f.properties.distrito_l, k: 'dl', id: f.properties.distrito_l, h: '' });
  for (const f of GEO.df.features) SEARCH.push({ t: 'Distrito federal ' + f.properties.distrito_f, s: 'distrito federal ' + f.properties.distrito_f + ' df' + f.properties.distrito_f, k: 'df', id: f.properties.distrito_f, h: '' });
  const q = $('#q'), ul = $('#qres'); let hits = [], on = 0;
  const show = () => { ul.innerHTML = hits.map((x, i) => `<li><button data-i="${i}" class="${i === on ? 'on' : ''}"><span>${esc(x.t)}</span><small>${esc(x.h || '')}</small></button></li>`).join(''); ul.hidden = !hits.length; ul.querySelectorAll('button').forEach(b => b.onmousedown = e => { e.preventDefault(); pick(hits[+b.dataset.i]); }); };
  const pick = x => { ul.hidden = true; q.value = ''; q.blur(); goTo(x.k, x.id); };
  q.oninput = () => {
    const v = norm(q.value.trim()); if (!v) { hits = []; show(); return; }
    const isNum = /^\d+$/.test(v);
    hits = SEARCH.filter(x => isNum ? (x.k === 'sec' ? x.s.startsWith(v) : x.s.includes(v)) : x.s.includes(v)).sort((a, b) => (a.s.startsWith(v) ? 0 : 1) - (b.s.startsWith(v) ? 0 : 1) || (a.k === 'mun' ? -1 : 0) - (b.k === 'mun' ? -1 : 0) || a.t.length - b.t.length).slice(0, 12);
    on = 0; show();
  };
  q.onkeydown = e => { if (e.key === 'ArrowDown') { on = Math.min(on + 1, hits.length - 1); show(); e.preventDefault(); } else if (e.key === 'ArrowUp') { on = Math.max(on - 1, 0); show(); e.preventDefault(); } else if (e.key === 'Enter' && hits[on]) pick(hits[on]); else if (e.key === 'Escape') ul.hidden = true; };
  q.onblur = () => setTimeout(() => ul.hidden = true, 120);
}

/* =================== HOJA INFERIOR =================== */
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
function peekSize() {
  if (!isMobile()) return;
  const P = $('#panel'), ph = P.querySelector('.ph'), w = P.querySelector('.win');
  let hgt = 22 + (ph ? ph.offsetHeight : 60) + 8; if (w) hgt += w.offsetHeight + 14;
  document.documentElement.style.setProperty('--peek', Math.min(hgt, 230) + 'px');
}
function sheet() {
  const P = $('#panel'), g = $('#grip');
  g.onclick = () => { P.dataset.state = P.dataset.state === 'open' ? 'peek' : 'open'; };
  let y0 = null;
  g.addEventListener('pointerdown', e => { y0 = e.clientY; });
  window.addEventListener('pointerup', e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; if (Math.abs(dy) > 30) P.dataset.state = dy < 0 ? 'open' : 'peek'; });
  P.querySelector('.pbody').addEventListener('click', e => { if (isMobile() && P.dataset.state === 'peek' && !e.target.closest('button')) P.dataset.state = 'open'; });
  window.addEventListener('resize', peekSize);
}

/* =================== MAPA =================== */
let LABELS = [];
function centroid(geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates; let best = null, ba = -1;
  for (const p of polys) { const r = p[0]; let a = 0, cx = 0, cy = 0;
    for (let i = 0, k = r.length - 1; i < r.length; k = i++) { const f = r[k][0] * r[i][1] - r[i][0] * r[k][1]; a += f; cx += (r[k][0] + r[i][0]) * f; cy += (r[k][1] + r[i][1]) * f; }
    if (Math.abs(a) > ba) { ba = Math.abs(a); best = [cx / (3 * a), cy / (3 * a)]; } }
  return { c: best, a: ba };
}
function labels() {
  LABELS.forEach(L => L.m.remove()); LABELS = [];
  const add = (c, text, cls, a) => { const el = document.createElement('div'); el.className = 'mlabel ' + cls; el.textContent = text; LABELS.push({ m: new maplibregl.Marker({ element: el }).setLngLat(c).addTo(map), a, el }); };
  if (S.vista === 'ja') for (const f of GEO.juntas.features) { const { c, a } = centroid(f.geometry); add(c, f.properties.ja, '', a); }
  const dist = S.vista === 'dl' || S.vista === 'df' ? S.vista : (CAPAS.dl ? 'dl' : CAPAS.df ? 'df' : null);
  if (dist) for (const f of GEO[dist].features) { const k = f.properties[dist === 'dl' ? 'distrito_l' : 'distrito_f']; const { c, a } = centroid(f.geometry); add(c, (dist === 'dl' ? 'DL ' : 'DF ') + k, 'big dist', a + 1); }
  if (S.vista !== 'ja') for (const f of GEO.municipios.features) { const p = f.properties; if (!(p.det || S.vista === 'mun')) continue; const { c, a } = centroid(f.geometry); add(c, p.municipio === 115 ? 'Puebla' : p.nombre, p.det ? 'big' : '', a + (p.det ? 1 : 0)); }
  LABELS.sort((x, y) => y.a - x.a); declutter();
}
function declutter() {
  const placed = [], z = map.getZoom();
  for (const L of LABELS) {
    const el = L.el; el.style.visibility = 'visible';
    const r = el.getBoundingClientRect(), pad = 4;
    if (r.width === 0 || placed.some(p => r.left < p.right + pad && r.right > p.left - pad && r.top < p.bottom + pad && r.bottom > p.top - pad)) el.style.visibility = 'hidden';
    else placed.push(r);
  }
}
let streetsP = null;
function loadStreets() {
  if (streetsP || map.getZoom() < 12.5) return;
  streetsP = fetch('data/geo/calles.json').then(r => r.json()).then(d => {
    const feats = d.l.map(a => { let x = a[0] + d.b[0], y = a[1] + d.b[1]; const c = [[x / 1e5, y / 1e5]]; for (let i = 2; i < a.length; i += 2) { x += a[i]; y += a[i + 1]; c.push([x / 1e5, y / 1e5]); } return { type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {} }; });
    map.addSource('calles', { type: 'geojson', data: { type: 'FeatureCollection', features: feats } });
    map.addLayer({ id: 'calles', type: 'line', source: 'calles', minzoom: 12.5, layout: { visibility: CAPAS.calles ? 'visible' : 'none' }, paint: { 'line-color': cssVar('--road'), 'line-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0, 14, .45, 16, .7], 'line-width': ['interpolate', ['linear'], ['zoom'], 13, .3, 16, 1.6] } }, 'via');
  }).catch(() => { streetsP = null; });
}
function initMap() {
  map = new maplibregl.Map({ container: 'map', attributionControl: false, dragRotate: false, pitchWithRotate: false, touchPitch: false,
    style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': cssVar('--mapbg') } }] },
    center: [-98.2, 19.04], zoom: 10, minZoom: 6.5, maxZoom: 17 });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.touchZoomRotate.disableRotation();
  return new Promise(r => map.on('load', r));
}
function addLayers() {
  const nores = cssVar('--nores');
  const src = (id, data, promote) => map.addSource(id, Object.assign({ type: 'geojson', data }, promote ? { promoteId: promote } : {}));
  for (const v of VISTAS) src('g-' + v.geo, GEO[v.geo], v.id);
  src('g-zm', GEO.zm); src('g-carr', GEO.carreteras); src('g-ctx', GEO.contexto);
  const fillPaint = { 'fill-color': ['coalesce', ['feature-state', 'c'], nores], 'fill-color-transition': { duration: 450 }, 'fill-opacity': ['case', ['boolean', ['feature-state', 'h'], false], .75, .93] };
  map.addLayer({ id: 'f-municipios', type: 'fill', source: 'g-municipios', paint: { ...fillPaint } });
  map.addLayer({ id: 'l-municipios', type: 'line', source: 'g-municipios', paint: { 'line-color': cssVar('--mapbg'), 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .3, 11, 1.4] } });
  for (const v of VISTAS.filter(v => v.k !== 'mun')) {
    map.addLayer({ id: 'f-' + v.geo, type: 'fill', source: 'g-' + v.geo, layout: { visibility: 'none' }, paint: { ...fillPaint } });
    map.addLayer({ id: 'l-' + v.geo, type: 'line', source: 'g-' + v.geo, layout: { visibility: 'none' }, paint: { 'line-color': cssVar('--mapbg'), 'line-width': v.det ? ['interpolate', ['linear'], ['zoom'], 10, .25, 14, 1.2] : 1.6 } });
  }
  const cv = document.createElement('canvas'); cv.width = cv.height = 8; const cx = cv.getContext('2d');
  cx.strokeStyle = 'rgba(110,120,115,.6)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(0, 8); cx.lineTo(8, 0); cx.moveTo(-2, 2); cx.lineTo(2, -2); cx.moveTo(6, 10); cx.lineTo(10, 6); cx.stroke();
  map.addImage('trama', { width: 8, height: 8, data: cx.getImageData(0, 0, 8, 8).data });
  for (const v of VISTAS.filter(v => v.det)) map.addLayer({ id: 't-' + v.geo, type: 'fill', source: 'g-' + v.geo, layout: { visibility: 'none' }, filter: ['==', ['get', v.id], '__none__'], paint: { 'fill-pattern': 'trama' } }, 'l-' + v.geo);
  // contexto
  map.addLayer({ id: 'lago', type: 'fill', source: 'g-ctx', filter: ['==', ['get', 'k'], 'lago'], paint: { 'fill-color': cssVar('--water'), 'fill-opacity': .9 } });
  map.addLayer({ id: 'rio', type: 'line', source: 'g-ctx', filter: ['==', ['get', 'k'], 'rio'], paint: { 'line-color': cssVar('--water'), 'line-width': ['interpolate', ['linear'], ['zoom'], 10, .6, 15, 2.2] } });
  map.addLayer({ id: 'via', type: 'line', source: 'g-ctx', filter: ['==', ['get', 'k'], 'principal'], minzoom: 10.5, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--road'), 'line-opacity': .75, 'line-width': ['interpolate', ['linear'], ['zoom'], 10.5, .4, 13, 1.6, 16, 4] } });
  map.addLayer({ id: 'carr', type: 'line', source: 'g-carr', filter: ['==', ['get', 'k'], 'carretera'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--road'), 'line-opacity': .7, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .5, 12, 1.8, 16, 4] } });
  map.addLayer({ id: 'carr-a', type: 'line', source: 'g-carr', filter: ['==', ['get', 'k'], 'autopista'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': cssVar('--road'), 'line-opacity': .9, 'line-width': ['interpolate', ['linear'], ['zoom'], 7, .9, 12, 2.6, 16, 6] } });
  // territorio
  map.addLayer({ id: 'dl-o', type: 'line', source: 'g-dl', paint: { 'line-color': '#2B6E8F', 'line-width': 2, 'line-dasharray': [3, 2] } });
  map.addLayer({ id: 'df-o', type: 'line', source: 'g-df', paint: { 'line-color': '#6B3F8F', 'line-width': 2.2, 'line-dasharray': [1, 2] } });
  map.addLayer({ id: 'zm-l', type: 'line', source: 'g-zm', paint: { 'line-color': cssVar('--oro-d'), 'line-width': 2, 'line-dasharray': [2, 1.5] } });
  map.addLayer({ id: 'det-l', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'det'], true], paint: { 'line-color': cssVar('--oro'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 13, 2.6] } });
  map.addLayer({ id: 'cap-glow', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'municipio'], 115], paint: { 'line-color': cssVar('--oro'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 6, 13, 14], 'line-opacity': .28, 'line-blur': 4 } });
  map.addLayer({ id: 'cap-l', type: 'line', source: 'g-municipios', filter: ['==', ['get', 'municipio'], 115], paint: { 'line-color': cssVar('--carbon'), 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 13, 3.4] } });
  map.on('zoomend', loadStreets); map.on('moveend', declutter);
  // interacción
  let hov = null; const tip = $('#tip');
  const clearHov = () => { if (hov) map.setFeatureState(hov, { h: false }); hov = null; };
  const layerOf = () => { const v = VISTAS.find(x => x.k === S.vista); return { v, id: 'f-' + v.geo }; };
  const hit = e => { const { v, id } = layerOf(); let f = map.queryRenderedFeatures(e.point, { layers: [id] })[0]; if (f) return { v, f }; if (v.det && map.getLayoutProperty('f-municipios', 'visibility') !== 'none') { f = map.queryRenderedFeatures(e.point, { layers: ['f-municipios'] })[0]; if (f) return { v: VISTAS.find(x => x.k === 'mun'), f }; } return null; };
  map.on('mousemove', e => {
    const h = hit(e); if (!h) { clearHov(); tip.hidden = true; map.getCanvas().style.cursor = ''; return; }
    const { v, f } = h, id = f.properties[v.id];
    if (!hov || hov.id !== id || hov.source !== 'g-' + v.geo) { clearHov(); hov = { source: 'g-' + v.geo, id }; map.setFeatureState(hov, { h: true }); }
    map.getCanvas().style.cursor = 'pointer'; if (isMobile()) return;
    const u = v.k === 'mun' ? MUNAGG[id] : AGG[id], w = u && u.w;
    tip.innerHTML = `<b>${esc(unitName(v.k, id))}</b>${w ? (w.tie ? 'Empate' : `${esc(candLabel(w.c))} · ${p1(w.share)}`) + (u.a.ln ? `<br><span class="m">Participación ${p1(pct(u.a.t, u.a.ln))}</span>` : '') : `<span class="m">${v.k === 'sec' ? 'Sección creada después de esta elección' : 'Sin resultados en esta elección'}</span>`}`;
    tip.hidden = false; const W = map.getContainer().clientWidth; tip.style.left = Math.min(e.point.x + 14, W - 270) + 'px'; tip.style.top = (e.point.y + 14) + 'px';
  });
  map.on('mouseout', () => { clearHov(); tip.hidden = true; });
  map.on('click', e => { const h = hit(e); if (!h) { select(null); return; } if (h.v.k !== S.vista) { goTo('mun', h.f.properties.municipio); return; } select(h.f.properties[h.v.id]); });
}
function retheme() {
  if (!map) return;
  map.setPaintProperty('bg', 'background-color', cssVar('--mapbg'));
  for (const v of VISTAS) map.setPaintProperty('l-' + v.geo, 'line-color', cssVar('--mapbg'));
  for (const id of ['via', 'carr', 'carr-a']) map.setPaintProperty(id, 'line-color', cssVar('--road'));
  if (map.getLayer('calles')) map.setPaintProperty('calles', 'line-color', cssVar('--road'));
  map.setPaintProperty('lago', 'fill-color', cssVar('--water')); map.setPaintProperty('rio', 'line-color', cssVar('--water'));
  map.setPaintProperty('cap-l', 'line-color', cssVar('--carbon'));
  paint(); select(S.sel);
}

/* =================== PANTALLA DE ENTRADA =================== */
async function drawLoginMap() {
  try {
    const g = await fetch('data/geo/municipios.geojson').then(r => r.json()); GEO.municipios = g;
    const cv = $('#login-map'), ctx = cv.getContext('2d'), dpr = devicePixelRatio || 1;
    const draw = () => {
      const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const [[x0, y0], [x1, y1]] = bbox({ coordinates: g.features.map(f => f.geometry.coordinates) }), k = Math.cos(19 * Math.PI / 180);
      const s = Math.min((W * .86) / ((x1 - x0) * k), (H * .82) / (y1 - y0)), ox = (W - (x1 - x0) * k * s) / 2, oy = (H - (y1 - y0) * s) / 2;
      const P = (x, y) => [ox + (x - x0) * k * s, oy + (y1 - y) * s];
      for (const f of g.features) {
        const p = f.properties, polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
        ctx.beginPath(); for (const poly of polys) for (const ring of poly) ring.forEach(([x, y], i) => { const [a, b] = P(x, y); i ? ctx.lineTo(a, b) : ctx.moveTo(a, b); });
        ctx.fillStyle = p.municipio === 115 ? 'rgba(191,181,145,.95)' : p.det ? 'rgba(191,181,145,.55)' : p.zm ? 'rgba(191,181,145,.22)' : 'rgba(255,255,255,.05)';
        ctx.fill('evenodd'); ctx.strokeStyle = 'rgba(191,181,145,.35)'; ctx.lineWidth = .6; ctx.stroke();
      }
    };
    draw(); window.addEventListener('resize', draw);
  } catch {}
}

/* =================== ARRANQUE =================== */
async function loadPublic() {
  const j = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  CAT = await j('data/catalogo.json');
  CAT.elecciones.forEach(e => ELS[e.id] = e); CAT.municipios.forEach(m => MUNN[m.id] = m.n);
  const need = ['secciones', 'colonias', 'juntas', 'dl', 'df', 'zm', 'carreteras', 'contexto'].concat(GEO.municipios ? [] : ['municipios']);
  await Promise.all(need.map(k => j(`data/geo/${k}.geojson`).then(g => GEO[k] = g)));
}
async function start(session) {
  PERFIL = session.perfil;
  $('#login').hidden = true; $('#app').hidden = false;
  const geoP = loadPublic(), mapP = initMap();
  const bundles = await Promise.all(Object.entries(session.keys).map(([cab, k]) => openBundle(cab, k).then(d => [cab, d])));
  await geoP;
  for (const [cab, d] of bundles) { if (cab === 'estado') EST = d; else if (cab === 'admin') MB.admin = d; else MB[+cab.slice(1)] = d; }
  DETOK = PERFIL.det.filter(m => MB[m]);
  // solo se dibuja el detalle al que el usuario tiene acceso
  GEO.secciones.features = GEO.secciones.features.filter(f => DETOK.includes(f.properties.municipio));
  GEO.colonias.features = GEO.colonias.features.filter(f => DETOK.includes(f.properties.municipio));
  if (!DETOK.includes(115)) GEO.juntas.features = [];
  GEO.secciones.byId = {}; for (const f of GEO.secciones.features) { GEO.secciones.byId[f.properties.seccion] = f; SECMUN[f.properties.seccion] = f.properties.municipio; }
  for (const m of DETOK) for (const eid in MB[m]) for (const s in MB[m][eid]) if (!SECMUN[s]) SECMUN[s] = m;
  GEO.colonias.byId = {}; for (const f of GEO.colonias.features) { GEO.colonias.byId[f.properties.cid] = f; for (const s of f.properties.secs) (COLS_OF_SEC[s] = COLS_OF_SEC[s] || []).push(f.properties.cid); }
  GEO.estado_bbox = { coordinates: GEO.municipios.features.map(f => f.geometry.coordinates) };
  if (!DETOK.length) S.vista = 'mun';
  if (PERFIL.nivel === 5) S.vista = DETOK.length ? 'sec' : PERFIL.ambito.slice(0, 2).toLowerCase();
  await mapP;
  buildControls(); addLayers(); buildSearch(); sheet();
  setVista(S.vista); applyCapas(); fitFocus(0);
  $('#loading').hidden = true;
  const mq = window.matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener && mq.addEventListener('change', retheme);
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
async function boot() {
  const saved = sess.get('pe_s');
  if (saved) { try { await start(saved); return; } catch (e) { console.error(e); sess.del('pe_s'); location.reload(); return; } }
  drawLoginMap();
  $('#login-form').onsubmit = async e => {
    e.preventDefault();
    const btn = $('#lg-btn'), err = $('#lg-err'); err.hidden = true; btn.disabled = true; btn.textContent = 'Verificando…';
    try { const s = await login($('#lg-user').value, $('#lg-pass').value); sess.set('pe_s', s); await start(s); }
    catch (x) { console.error(x); err.textContent = x.message === 'auth' ? 'Usuario o clave incorrectos.' : 'No se pudo abrir la plataforma. Revisa tu conexión e intenta otra vez.'; err.hidden = false; $('#login').hidden = false; $('#app').hidden = true; }
    finally { btn.disabled = false; btn.textContent = 'Entrar'; }
  };
}
boot();
})();
