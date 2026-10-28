"""Construye los datos de la plataforma Puebla Electoral.

Entradas
  <bgd>        carpeta "21 PUEBLA" de la Base Geográfica Digital del INE (corte dic-2025)
  <kml>        doc.kml del mapa PILOTO 5 (solo para asignar juntas auxiliares de Puebla capital)
  <resultados> carpeta con los *_SEC.csv de Puebla (INE e IEE, datos abiertos) y ganadores_pue.csv
Salida (<salida>)
  geo/*.geojson, geo/calles.json        capas públicas (cartografía INE)
  catalogo.json                          elecciones, partidos y municipios (sin resultados)
  _claro/estado.json, _claro/m<id>.json  resultados sin cifrar; acceso.py los cifra en seguro/

Reglas
  * Unidad base: sección. Municipio = suma de todas sus secciones del cómputo (incluye secciones dadas de baja).
  * Distritos: trazo vigente; suma de las secciones vigentes que caen en cada distrito (reconstrucción).
  * Candidaturas: partido + todas las combinaciones de su coalición. La coalición se detecta por lugar de la
    elección (municipio en ayuntamientos, distrito en diputaciones, estado en gubernatura/senado/presidencia):
    partidos unidos por una combinación con votos compitieron juntos.
uso: python construir.py <bgd> <kml> <resultados> <salida>
"""
import sys, os, re, csv, json, glob, collections, unicodedata, warnings
import geopandas as gpd, pandas as pd
from shapely.geometry import Polygon, MultiPolygon
import xml.etree.ElementTree as ET
warnings.filterwarnings('ignore')

BGD, KML, RES, OUT = sys.argv[1:5]
PADRON = sys.argv[5] if len(sys.argv) > 5 else None      # padron_pue.json (filas de Puebla del padrón por sección)
AFILIADOS = sys.argv[6] if len(sys.argv) > 6 else None   # afiliados_conteos.json (totales por entidad)
os.makedirs(f'{OUT}/geo', exist_ok=True); os.makedirs(f'{OUT}/_claro', exist_ok=True)
CAPITAL = 115
DETALLE = [115, 120, 141, 42, 15, 35, 107]  # capital y conurbados (INE)
ZM = ['PUEBLA', 'SAN ANDRES CHOLULA', 'SAN PEDRO CHOLULA', 'CUAUTLANCINGO', 'AMOZOC', 'CORONANGO', 'OCOYUCAN', 'CHIAUTZINGO',
      'DOMINGO ARENAS', 'HUEJOTZINGO', 'JUAN C. BONILLA', 'SAN FELIPE TEOTLALCINGO', 'SAN GREGORIO ATZOMPA', 'SAN MARTIN TEXMELUCAN',
      'SAN MIGUEL XOXTLA', 'SAN SALVADOR EL VERDE', 'TEPATLAXCO DE HIDALGO', 'TLALTENANGO']
JA_FIX = {'San Sebasti?n De Aparicio': 'San Sebastián de Aparicio', 'La Resurrecci?n': 'La Resurrección',
          'Santa Mar?a Xonacatepec': 'Santa María Xonacatepec', 'San Francisco Totimehuac?n': 'San Francisco Totimehuacán',
          'San Jer?nimo Calera': 'San Jerónimo Caleras', 'San Pablo Xochimehuac?n': 'San Pablo Xochimehuacan',
          'San Andr?s Azumiatla': 'San Andrés Azumiatla', 'Santo Tom?s Chautla': 'Santo Tomás Chautla',
          'Sta. Ma. Guadalupe Tecola': 'Santa María Guadalupe Tecola'}
norm = lambda s: unicodedata.normalize('NFD', str(s)).encode('ascii', 'ignore').decode().upper().strip()
LOW = {'DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'EL'}
def titulo(s):
    w = str(s).strip().split()
    return ' '.join(x.capitalize() if i == 0 or x.upper() not in LOW else x.lower() for i, x in enumerate(w))

def rd(n, **kw): return gpd.read_file(f'{BGD}/{n}.shp', **kw)
def save(g, name, tol):
    g = g.copy(); g['geometry'] = g.geometry.simplify(tol, preserve_topology=True); g = g.to_crs(4326)
    g.to_file(f'{OUT}/geo/{name}.geojson', driver='GeoJSON', COORDINATE_PRECISION=5)
    print(f'  geo/{name}: {len(g)} · {os.path.getsize(f"{OUT}/geo/{name}.geojson") // 1024} KB')

# ======================= GEOGRAFÍA =======================
print('Geografía')
mun = rd('MUNICIPIO')[['municipio', 'nombre', 'geometry']]
mun['nombre'] = mun.nombre.map(titulo)
zmset = {norm(x) for x in ZM}
mun['zm'] = mun.nombre.map(lambda n: norm(n) in zmset)
mun['det'] = mun.municipio.isin(DETALLE)
assert mun.zm.sum() == len(ZM), 'zona metropolitana incompleta'
sec = rd('SECCION')[['seccion', 'municipio', 'distrito_f', 'distrito_l', 'geometry']]
dl = rd('DISTRITO_LOCAL')[['distrito_l', 'geometry']]
df = rd('DISTRITO_FEDERAL')[[c for c in rd('DISTRITO_FEDERAL').columns if c in ('distrito_f', 'distrito', 'geometry')]]
if 'distrito' in df: df = df.rename(columns={'distrito': 'distrito_f'})
SEC_ALL = {int(r.seccion): (int(r.municipio), int(r.distrito_l), int(r.distrito_f)) for r in sec.itertuples()}
MUNNAME = dict(zip(mun.municipio, mun.nombre))
NAME2ID = {norm(n): int(i) for i, n in zip(mun.municipio, mun.nombre)}

# juntas auxiliares de la capital (PILOTO 5)
ns = {'k': 'http://www.opengis.net/kml/2.2'}
d = ET.parse(KML).getroot().find('k:Document', ns); rows = []
for f in d.findall('k:Folder', ns):
    if not f.findtext('k:name', namespaces=ns).startswith('Interseccion'): continue
    for p in f.findall('k:Placemark', ns):
        a = {x.get('name'): x.findtext('k:value', namespaces=ns) for x in p.findall('.//k:Data', ns)}
        polys = [Polygon([tuple(map(float, t.split(',')[:2])) for t in pg.find('k:outerBoundaryIs//k:coordinates', ns).text.split()])
                 for pg in p.findall('.//k:Polygon', ns)]
        polys = [q for q in polys if len(q.exterior.coords) >= 4]
        if polys: rows.append({'ja': JA_FIX.get(a['Name_2'], a['Name_2']), 'sec_pil': int(a['InterseccionSECCION']), 'geometry': MultiPolygon(polys).buffer(0)})
pil = gpd.GeoDataFrame(rows, crs=4326).to_crs(sec.crs)
cap = sec[sec.municipio == CAPITAL]
x = gpd.overlay(cap[['seccion', 'geometry']], pil[['ja', 'geometry']], how='intersection', keep_geom_type=True); x['a'] = x.area
JA = x.groupby(['seccion', 'ja']).a.sum().reset_index().sort_values('a').groupby('seccion').tail(1).set_index('seccion').ja.to_dict()
for s in cap.seccion:
    if s not in JA:
        g0 = cap[cap.seccion == s].geometry.iloc[0]; con = cap[cap.seccion.isin(JA)]
        JA[s] = JA[con.iloc[con.distance(g0).argmin()].seccion]
pa = pil.copy(); pa['a'] = pa.area
JA_BAJA = pa.groupby(['sec_pil', 'ja']).a.sum().reset_index().sort_values('a').groupby('sec_pil').tail(1).set_index('sec_pil').ja.to_dict()

secd = sec[sec.municipio.isin(DETALLE)].copy()
secd['ja'] = secd.seccion.map(JA).fillna('')
col = rd('COLONIA'); col = col[col.MUNICIPIO.isin(DETALLE)][['NOMBRE', 'CP', 'MUNICIPIO', 'geometry']].copy()
col['geometry'] = col.geometry.make_valid(); col = col.reset_index(drop=True); col['cid'] = col.index
y = gpd.overlay(col[['cid', 'geometry']], secd[['seccion', 'geometry']], how='intersection', keep_geom_type=True); y['a'] = y.area
y['p'] = y.a / y.cid.map(y.groupby('cid').a.sum())
col['secs'] = col.cid.map(y[y.p >= .05].sort_values('p', ascending=False).groupby('cid').seccion.apply(lambda s: [int(v) for v in s]))
col = col[col.secs.notna()]
col['ja'] = col.secs.map(lambda s: JA.get(s[0], ''))
col = col.rename(columns={'NOMBRE': 'nombre', 'CP': 'cp', 'MUNICIPIO': 'municipio'})
col['nombre'] = col.nombre.map(titulo); col['cp'] = col.cp.fillna(0).astype(int).astype(str)

save(mun, 'municipios', 35)
save(dl, 'dl', 35); save(df, 'df', 35)
save(mun[mun.zm].dissolve()[['geometry']].assign(n='Zona metropolitana'), 'zm', 25)
secall = sec.copy(); secall['ja'] = secall.seccion.map(JA).fillna('')
# tolerancia según importancia: zona de detalle fina, zona metropolitana media, resto del estado gruesa
zmids = set(mun[mun.zm].municipio)
tol = secall.municipio.map(lambda m: 7 if m in DETALLE else (25 if m in zmids else 70))
secall['geometry'] = [g.simplify(t, preserve_topology=True) for g, t in zip(secall.geometry, tol)]
save(secall[['seccion', 'municipio', 'distrito_l', 'distrito_f', 'ja', 'geometry']], 'secciones', 0.1)
save(col[['cid', 'nombre', 'cp', 'municipio', 'ja', 'secs', 'geometry']], 'colonias', 6)
save(secd[secd.municipio == CAPITAL][['ja', 'geometry']].dissolve(by='ja').reset_index(), 'juntas', 8)

# contexto: carreteras del estado; vías principales, ríos y lagos de la zona de detalle; calles compactas
zona = mun[mun.det].dissolve().geometry.iloc[0]
def clip(n, g):
    t = rd(n, mask=g); t = t.clip(g); return t[t.geometry.notna() & ~t.geometry.is_empty]
est_geom = mun.dissolve().geometry.iloc[0]
car = pd.concat([clip('AUTOPISTA', est_geom).assign(k='autopista'), clip('PAVIMENTADA', est_geom).assign(k='carretera')])[['k', 'geometry']]
save(gpd.GeoDataFrame(car, crs=sec.crs), 'carreteras', 30)
via = clip('VIALIDAD', zona)
ctx = pd.concat([via[via.CATEGORIA == 1].assign(k='principal')[['k', 'geometry']],
                 clip('RIOS', zona).assign(k='rio')[['k', 'geometry']], clip('LAGOS', zona).assign(k='lago')[['k', 'geometry']]])
save(gpd.GeoDataFrame(ctx, crs=sec.crs), 'contexto', 4)
cal = via[via.CATEGORIA != 1][['geometry']].copy(); cal['geometry'] = cal.geometry.simplify(3)
L = []
for gm in cal.to_crs(4326).geometry.explode(index_parts=False):
    if gm.geom_type != 'LineString' or len(gm.coords) < 2: continue
    q = [(round(a * 1e5), round(b * 1e5)) for a, b in gm.coords]
    o = [q[0][0] + 9800000, q[0][1] - 1900000]
    for i in range(1, len(q)): o += [q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]]
    L.append(o)
json.dump({'b': [-9800000, 1900000], 'l': L}, open(f'{OUT}/geo/calles.json', 'w'), separators=(',', ':'))
print(f'  geo/calles: {len(L)} tramos · {os.path.getsize(f"{OUT}/geo/calles.json") // 1024} KB')

# ======================= RESULTADOS =======================
print('Resultados')
EL = [  # archivo, id, año, cargo, unidad de coalición, fuente
 ('2000_SEE_PRE_NAL_SEC', '2000-PRE', 2000, 'Presidencia de la República', 'EST', 'INE'),
 ('2000_SEE_SEN_MR_NAL_SEC', '2000-SEN', 2000, 'Senaduría', 'EST', 'INE'),
 ('2000_SEE_DIP_FED_MR_NAL_SEC', '2000-DF', 2000, 'Diputación federal', 'DIS', 'INE'),
 ('2003_SEE_DIP_FED_MR_NAL_SEC', '2003-DF', 2003, 'Diputación federal', 'DIS', 'INE'),
 ('2006_SEE_PRE_NAL_SEC', '2006-PRE', 2006, 'Presidencia de la República', 'EST', 'INE'),
 ('2006_SEE_SEN_MR_NAL_SEC', '2006-SEN', 2006, 'Senaduría', 'EST', 'INE'),
 ('2006_SEE_DIP_FED_MR_NAL_SEC', '2006-DF', 2006, 'Diputación federal', 'DIS', 'INE'),
 ('2009_SEE_DIP_FED_MR_NAL_SEC', '2009-DF', 2009, 'Diputación federal', 'DIS', 'INE'),
 ('2012_SEE_PRE_NAL_SEC', '2012-PRE', 2012, 'Presidencia de la República', 'EST', 'INE'),
 ('2012_SEE_SEN_MR_NAL_SEC', '2012-SEN', 2012, 'Senaduría', 'EST', 'INE'),
 ('2012_SEE_DIP_FED_MR_NAL_SEC', '2012-DF', 2012, 'Diputación federal', 'DIS', 'INE'),
 ('2015_SEE_DIP_FED_MR_NAL_SEC', '2015-DF', 2015, 'Diputación federal', 'DIS', 'INE'),
 ('2016_SEE_GOB_PUE_SEC', '2016-GOB', 2016, 'Gubernatura', 'EST', 'IEE Puebla'),
 ('2018_SEE_PRE_NAL_SEC', '2018-PRE', 2018, 'Presidencia de la República', 'EST', 'INE'),
 ('2018_SEE_SEN_MR_NAL_SEC', '2018-SEN', 2018, 'Senaduría', 'EST', 'INE'),
 ('2018_SEE_DIP_FED_MR_NAL_SEC', '2018-DF', 2018, 'Diputación federal', 'DIS', 'INE'),
 ('2018_SEE_GOB_PUE_SEC', '2018-GOB', 2018, 'Gubernatura', 'EST', 'IEE Puebla'),
 ('2018_SEE_DIP_LOC_MR_PUE_SEC', '2018-DL', 2018, 'Diputación local', 'DIS', 'IEE Puebla'),
 ('2018_SEE_AYUN_PUE_SEC', '2018-AYU', 2018, 'Presidencia municipal', 'MUN', 'IEE Puebla'),
 ('2019_SEE_GOB_PUE_SEC_EXT', '2019-GOB', 2019, 'Gubernatura (extraordinaria)', 'EST', 'IEE Puebla'),
 ('2019_SEE_AYUN_PUE_SEC_EXT', '2019-AYU', 2019, 'Presidencia municipal (extraordinaria)', 'MUN', 'IEE Puebla'),
 ('2021_SEE_DIP_FED_MR_NAL_SEC', '2021-DF', 2021, 'Diputación federal', 'DIS', 'INE'),
 ('2021_SEE_DIP_LOC_MR_PUE_SEC', '2021-DL', 2021, 'Diputación local', 'DIS', 'IEE Puebla'),
 ('2021_SEE_AYUN_PUE_SEC', '2021-AYU', 2021, 'Presidencia municipal', 'MUN', 'IEE Puebla'),
 ('2024_SEE_PRE_NAL_SEC', '2024-PRE', 2024, 'Presidencia de la República', 'EST', 'INE'),
 ('2024_SEE_SEN_FED_MR_NAL_SEC', '2024-SEN', 2024, 'Senaduría', 'EST', 'INE'),
 ('2024_SEE_DIP_FED_MR_NAL_SEC', '2024-DF', 2024, 'Diputación federal', 'DIS', 'INE'),
 ('2024_SEE_GOB_PUE_SEC', '2024-GOB', 2024, 'Gubernatura', 'EST', 'IEE Puebla'),
 ('2024_SEE_DIP_LOC_MR_PUE_SEC', '2024-DL', 2024, 'Diputación local', 'DIS', 'IEE Puebla'),
 ('2024_SEE_AYUN_PUE_SEC', '2024-AYU', 2024, 'Presidencia municipal', 'MUN', 'IEE Puebla'),
]
# columnas que en elecciones viejas ya son una coalición registrada
COAL = {'AC': 'PAN-PVEM', 'AM': 'PRD-PT-CONV-PSN-PAS', 'APM': 'PRI-PVEM', 'PBT': 'PRD-PT-CONV', 'PRIMERO_MEXICO': 'PRI-PVEM',
        'SALVEMOS_MEXICO': 'PT-CONV'}
REN = {'NVA_ALIANZA': 'NA', 'C_COMUN_': '', 'ASDC': 'PASC'}
META = re.compile(r'^(CIRCUNSCRIPCION|ID_|NOMBRE_|CABECERA|MUNICIPIO|SECCION|CASILLAS|ACTAS|NUM_VOTOS_VALIDOS|TIPO_|EXT)')
SPEC = {'NUM_VOTOS_CAN_NREG': 'nr', 'NUM_VOTOS_NULOS': 'nu', 'TOTAL_VOTOS': 't', 'LISTA_NOMINAL': 'ln'}
num = lambda v: int(float(v)) if str(v).strip() not in ('', '-', 'N/A') else 0

def clean(c):
    c = c.strip().lstrip('﻿')
    for a, b in REN.items(): c = c.replace(a, b)
    return c.strip('_')

# ganadores
G = collections.defaultdict(list)
for r in csv.DictReader(open(f'{RES}/ganadores_pue.csv', encoding='utf-8')):
    G[(int(r['anio']), r['cargo'])].append(r)
NAC = {2000: ('VICENTE FOX QUESADA', 'PAN-PVEM'), 2006: ('FELIPE CALDERÓN HINOJOSA', 'PAN'), 2012: ('ENRIQUE PEÑA NIETO', 'PRI-PVEM'),
       2018: ('ANDRÉS MANUEL LÓPEZ OBRADOR', 'MORENA-PT-PES'), 2024: ('CLAUDIA SHEINBAUM PARDO', 'MORENA-PT-PVEM')}
GOB16 = ('JOSÉ ANTONIO GALI FAYAD', 'PAN-PT-NA-PCPP-PSI')
nombre = lambda s: ' '.join(w.capitalize() if len(w) > 2 or i == 0 else w.lower() for i, w in enumerate(str(s).split()))

estado = {}; secb = {int(m): {} for m in mun.municipio}; cat = []
for fn, eid, anio, cargo, unidad, fuente in EL:
    rows = list(csv.reader(open(f'{RES}/{fn}.csv', encoding='utf-8-sig')))
    h = [clean(c) for c in rows[0]]; raw = [c.strip().lstrip('﻿') for c in rows[0]]
    iS, iM, iN = raw.index('SECCION'), raw.index('ID_MUNICIPIO'), raw.index('MUNICIPIO')
    iD = next((raw.index(c) for c in ('ID_DISTRITO_FEDERAL', 'ID_DISTRITO_LOCAL', 'ID_DISTRITO') if c in raw), None)
    spec = {k: raw.index(c) for c, k in SPEC.items() if c in raw}
    vcols = [i for i, c in enumerate(raw) if not META.match(c) and c not in SPEC]
    names = [h[i] for i in vcols]
    simple = sorted({n for n in names if '_' not in n and not n.startswith('CAND_IND')})
    def comp(n):
        if n.startswith('CAND_IND') or n in simple: return [n]
        return [p for p in n.split('_') if p]
    S = {}  # sección -> registro
    for r in rows[1:]:
        if len(r) < len(raw): continue
        s = num(r[iS]); m = NAME2ID.get(norm(r[iN]), num(r[iM]))  # algunos cómputos usan claves propias
        if s == 0: continue
        a = S.setdefault(s, {'m': m, 'd': num(r[iD]) if iD is not None else 0, 'v': [0] * len(vcols), **{k: 0 for k in spec}})
        for j, i in enumerate(vcols): a['v'][j] += num(r[i])
        for k, i in spec.items(): a[k] += num(r[i])
    # coaliciones por unidad
    unit = lambda a: a['m'] if unidad == 'MUN' else (a['d'] if unidad == 'DIS' else 0)
    tot = collections.defaultdict(lambda: [0] * len(vcols))
    for a in S.values():
        t = tot[unit(a)]
        for j in range(len(vcols)): t[j] += a['v'][j]
    candof = {}
    for u, t in tot.items():
        par = {p: p for p in simple}
        def f(q):
            while par.setdefault(q, q) != q: q = par[q]
            return q
        for j, n in enumerate(names):
            ps = comp(n)
            if len(ps) > 1 and t[j] > 0:
                for p in ps[1:]: par[f(p)] = f(ps[0])
        for j, n in enumerate(names):
            if n.startswith('CAND_IND'): candof[(u, j)] = n; continue
            base = sorted(q for q in simple if f(q) == f(comp(n)[0]))
            parts = sorted({x for q in base for x in COAL.get(q, q).split('-')})
            candof[(u, j)] = '-'.join(parts)
    # totales estatales por partido para ordenar
    ptot = collections.Counter()
    for t in tot.values():
        for j, n in enumerate(names):
            if n in simple: ptot[n] += t[j]
    party_w = collections.Counter()
    for k, v in ptot.items():
        for i, x in enumerate(COAL.get(k, k).split('-')): party_w[x] += v * (0.999 ** i)  # en coaliciones registradas manda el primero
    def lab(k):
        if k.startswith('CAND_IND'): return k
        return '-'.join(sorted(k.split('-'), key=lambda p: -party_w.get(p, 0)))
    candtot = collections.Counter()
    recs = {}
    for s, a in S.items():
        cv = collections.Counter()
        for j in range(len(vcols)): cv[lab(candof[(unit(a), j)])] += a['v'][j]
        recs[s] = (a, cv); candtot.update(cv)
    CAND = [k for k, v in candtot.most_common() if v > 0]
    PART = [p for p in sorted(simple, key=lambda p: -ptot[p]) if ptot[p] > 0]
    def pack(items):
        o = {'ln': 0, 't': 0, 'nu': 0, 'nr': 0, 'c': [0] * len(CAND), 'p': [0] * len(PART)}
        for a, cv in items:
            for k in ('ln', 't', 'nu', 'nr'): o[k] += a.get(k, 0)
            for i, c in enumerate(CAND): o['c'][i] += cv.get(c, 0)
            for i, p in enumerate(PART): o['p'][i] += a['v'][names.index(p)]
        return [o['ln'], o['t'], o['nu'], o['nr'], o['c'], o['p']]
    byM = collections.defaultdict(list); byDL = collections.defaultdict(list); byDF = collections.defaultdict(list)
    for s, (a, cv) in recs.items():
        byM[a['m']].append((a, cv))
        if s in SEC_ALL: _, l, f_ = SEC_ALL[s]; byDL[l].append((a, cv)); byDF[f_].append((a, cv))
    E = {'mun': {m: pack(v) for m, v in byM.items()}, 'dl': {k: pack(v) for k, v in byDL.items()}, 'df': {k: pack(v) for k, v in byDF.items()},
         'est': pack(recs.values())}
    # cobertura de la reconstrucción por distrito
    cov = sum(a['t'] for s, (a, cv) in recs.items() if s in SEC_ALL) / max(1, sum(a['t'] for a, cv in recs.values()))
    # ganadores
    gan = {}
    tipo = eid.split('-')[1]
    if tipo == 'AYU':
        for r in G[(anio, 'PRES_MUN')]:
            try: gan['m' + str(int(r['mid']))] = [nombre(r['nombre']), r['partido']]
            except ValueError: pass
    elif tipo in ('DL', 'DF'):
        same = sum(1 for s, (a, cv) in recs.items() if s in SEC_ALL and a['d'] == SEC_ALL[s][1 if tipo == 'DL' else 2]) / max(1, len(recs))
        if same > .97:
            for r in G[(anio, 'DIP_LOC_MR' if tipo == 'DL' else 'DIP_MR')]:
                k = r['dl'] if tipo == 'DL' else r['df']
                if k: gan[tipo.lower() + str(int(float(k)))] = [nombre(r['nombre']), r['partido']]
    elif tipo == 'GOB':
        rr = G[(anio, 'GOB')]
        if rr: gan['est'] = [nombre(rr[0]['nombre']), rr[0]['partido']]
        elif anio == 2016: gan['est'] = [nombre(GOB16[0]), GOB16[1]]
    elif tipo == 'PRE' and anio in NAC: gan['est'] = [nombre(NAC[anio][0]), NAC[anio][1]]
    elif tipo == 'SEN':
        seen = []
        for r in G[(anio, 'SEN_MR')]:
            n_ = nombre(r['nombre'])
            if n_ not in [x[0] for x in seen]: seen.append([n_, r['partido']])
        if seen: gan['est_sen'] = seen
    estado[eid] = {**E, 'g': gan}
    # secciones de la zona de detalle
    for s, (a, cv) in recs.items():
        if a['m'] in secb:
            p = pack([(a, cv)])
            if s not in SEC_ALL or SEC_ALL[s][0] != a['m']:
                p.append(1)  # dada de baja / fuera del trazo vigente
                if a['m'] == CAPITAL and s in JA_BAJA: p.append(JA_BAJA[s])
            secb[a['m']].setdefault(eid, {})[s] = p
    nbaja = sum(1 for s, (a, cv) in recs.items() if a['m'] in secb and (s not in SEC_ALL))
    cat.append({'id': eid, 'anio': anio, 'cargo': cargo, 'tipo': tipo, 'fuente': f'{fuente}, resultados por sección (datos abiertos)',
                'cand': CAND, 'part': PART, 'ln': 'ln' in spec, 'cobertura_distritos': round(cov, 3)})
    w = max(range(len(CAND)), key=lambda i: E['est'][4][i])
    print(f'  {eid:9} secciones {len(S):5} · municipios {len(byM):3} · ganó en el estado {CAND[w]:22} · cobertura distritos {cov:.0%} · ganadores {len(gan)}')

# ======================= COMPOSICIÓN: CONGRESO, DIPUTACIONES Y SENADO =======================
# cada escaño: [partido de origen (si el registro lo trae), candidatura que lo postuló]
CONG = {}
for (anio, cargo), rows in G.items():
    k = {'DIP_LOC_MR': ('DL', 'mr'), 'DIP_LOC_RP': ('DL', 'rp'), 'DIP_MR': ('DF', 'mr'), 'SEN_MR': ('SEN', 'mr')}.get(cargo)
    if not k: continue
    seen, out = set(), []
    for r in rows:
        key = (r.get('nombre'), r.get('dl'), r.get('df'), r.get('lista'))
        if key in seen: continue
        seen.add(key); out.append([r.get('partido') or '', r.get('actor') or ''])
    CONG.setdefault(k[0], {}).setdefault(str(anio), {})[k[1]] = out
estado['_cong'] = CONG
print('Composición:', {c: sorted(v) for c, v in CONG.items()})

# ======================= PADRÓN Y AFILIADOS =======================
GR = ['18_19', '20_24', '25_29', '30_34', '35_39', '40_44', '45_49', '50_54', '55_59', '60_64', '65_Y_MAS']
pad_meta = None
if PADRON:
    P = json.load(open(PADRON)); h = [str(c).replace('\n', ' ').strip().upper() for c in P['h']]; ix = {c: i for i, c in enumerate(h)}
    def g(r, c): v = r[ix[c]] if c in ix else 0; return int(float(v)) if str(v).strip() not in ('', 'None') else 0
    def lpack(r):
        H = [g(r, f'LISTA_{a}_HOMBRES') + (g(r, 'LISTA_19_HOMBRES') if a == '18_19' else 0) for a in GR]
        M = [g(r, f'LISTA_{a}_MUJERES') + (g(r, 'LISTA_19_MUJERES') if a == '18_19' else 0) for a in GR]
        H[0] = g(r, 'LISTA_18_HOMBRES') + g(r, 'LISTA_19_HOMBRES'); M[0] = g(r, 'LISTA_18_MUJERES') + g(r, 'LISTA_19_MUJERES')
        return [g(r, 'PADRON ELECTORAL'), g(r, 'LISTA NOMINAL'), g(r, 'LISTA HOMBRES'), g(r, 'LISTA MUJERES'), g(r, 'LISTA NO BINARIO'), H, M]
    def addp(a, b):
        if a is None: return [b[0], b[1], b[2], b[3], b[4], b[5][:], b[6][:]]
        for i in range(5): a[i] += b[i]
        for k in (5, 6):
            for i in range(len(GR)): a[k][i] += b[k][i]
        return a
    PM, PL, PF, PE = {}, {}, {}, None
    for r in P['rows']:
        s = g(r, 'SECCION')
        if s == 0: continue
        p = lpack(r); m = g(r, 'CLAVE MUNICIPIO')
        PM[m] = addp(PM.get(m), p); PE = addp(PE, p)
        if s in SEC_ALL:
            _, l, f_ = SEC_ALL[s]; PL[l] = addp(PL.get(l), p); PF[f_] = addp(PF.get(f_), p)
            mm = SEC_ALL[s][0]
            if mm in secb: secb[mm].setdefault('_pad', {})[s] = p
    estado['_pad'] = {'mun': PM, 'dl': PL, 'df': PF, 'est': PE}
    pad_meta = {'corte': '8 de octubre de 2026', 'grupos': ['18-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65+'],
                'fuente': 'INE, DERFE, Padrón Electoral y Lista Nominal por sección, edad y sexo (datos abiertos)'}
    print(f'Padrón: {len(PM)} municipios · lista nominal estatal {PE[1]:,}')
afi_meta = None
if AFILIADOS:
    A = json.load(open(AFILIADOS)); AF = {}
    for p, d in A.items():
        y = {int(k.split('|')[1]): v for k, v in d.get('anio', {}).items() if k.startswith('PUEBLA|') and k.split('|')[1].isdigit()}
        AF[p] = {'t': d['ent'].get('PUEBLA', 0), 'y': y}
    estado['_afi'] = AF
    afi_meta = {'fuente': 'INE, padrones de personas afiliadas a partidos políticos nacionales (verificación 2026); solo hay total por entidad'}
    print('Afiliados en Puebla:', {p: v['t'] for p, v in AF.items()})

catalogo = {
    'elecciones': cat,
    'municipios': [{'id': int(r.municipio), 'n': r.nombre, 'zm': bool(r.zm), 'det': bool(r.det)} for r in mun.sort_values('nombre').itertuples()],
    'detalle': DETALLE, 'capital': CAPITAL, 'zm': sorted(int(x) for x in mun[mun.zm].municipio), 'padron': pad_meta, 'afiliados': afi_meta,
    'fuentes': {
        'cartografia': 'INE, Base Geográfica Digital, corte dic-2025',
        'zm': 'Zona metropolitana Puebla-Tlaxcala (delimitación INEGI/CONAPO), municipios del estado de Puebla',
        'juntas': 'Juntas auxiliares asignadas por sección según el mapa PILOTO 5',
    },
}
json.dump(catalogo, open(f'{OUT}/catalogo.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(estado, open(f'{OUT}/_claro/estado.json', 'w'), ensure_ascii=False, separators=(',', ':'))
for m, v in secb.items(): json.dump(v, open(f'{OUT}/_claro/m{m}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
tot = sum(os.path.getsize(f) for f in glob.glob(f'{OUT}/_claro/*.json'))
print(f'  _claro: {len(secb) + 1} paquetes · {tot // 1024} KB · estado {os.path.getsize(f"{OUT}/_claro/estado.json") // 1024} KB · capital {os.path.getsize(f"{OUT}/_claro/m115.json") // 1024} KB')
