"""Capas del municipio de Puebla (INE municipio 115).
Secciones, distritos y colonias: BGD INE (corte dic-2025).
Juntas auxiliares: asignadas a cada sección según el mapa PILOTO 5 (campo Name_2), por mayor superficie.
uso: python geografia.py <carpeta_bgd> <doc.kml del PILOTO> <salida>
"""
import sys, json, re, collections
import geopandas as gpd, pandas as pd
from shapely.geometry import shape, Polygon, MultiPolygon
import xml.etree.ElementTree as ET

BGD, KML, OUT = sys.argv[1:4]
MUN = 115
JA_NOMBRES = {  # corrige acentos rotos de origen
 'San Sebasti?n De Aparicio':'San Sebastián de Aparicio','La Resurrecci?n':'La Resurrección',
 'Santa Mar?a Xonacatepec':'Santa María Xonacatepec','San Francisco Totimehuac?n':'San Francisco Totimehuacán',
 'San Jer?nimo Calera':'San Jerónimo Caleras','San Pablo Xochimehuac?n':'San Pablo Xochimehuacan',
 'San Andr?s Azumiatla':'San Andrés Azumiatla','Santo Tom?s Chautla':'Santo Tomás Chautla',
 'Sta. Ma. Guadalupe Tecola':'Santa María Guadalupe Tecola'}
TOL = 6  # metros de simplificación

def rd(n): return gpd.read_file(f'{BGD}/{n}.shp')
sec = rd('SECCION'); sec = sec[sec.municipio == MUN][['seccion','distrito_f','distrito_l','geometry']].copy()
mun = rd('MUNICIPIO'); mun = mun[mun.municipio == MUN][['geometry']]
col = rd('COLONIA'); col = col[col.MUNICIPIO == MUN][['NOMBRE','CP','CLASIFICAC','geometry']].copy()
col['geometry'] = col.geometry.make_valid()

# --- juntas auxiliares desde el PILOTO ---
ns = {'k':'http://www.opengis.net/kml/2.2'}
d = ET.parse(KML).getroot().find('k:Document', ns)
rows = []
for f in d.findall('k:Folder', ns):
    if not f.findtext('k:name', namespaces=ns).startswith('Interseccion'): continue
    for p in f.findall('k:Placemark', ns):
        a = {x.get('name'): x.findtext('k:value', namespaces=ns) for x in p.findall('.//k:Data', ns)}
        polys = []
        for pg in p.findall('.//k:Polygon', ns):
            c = [tuple(map(float, t.split(',')[:2])) for t in pg.find('k:outerBoundaryIs//k:coordinates', ns).text.split()]
            if len(c) >= 4: polys.append(Polygon(c))
        if polys:
            rows.append({'ja': JA_NOMBRES.get(a['Name_2'], a['Name_2']), 'geometry': MultiPolygon(polys).buffer(0)})
pil = gpd.GeoDataFrame(rows, crs=4326).to_crs(sec.crs)
x = gpd.overlay(sec[['seccion','geometry']], pil, how='intersection', keep_geom_type=True)
x['a'] = x.area
best = x.groupby(['seccion','ja']).a.sum().reset_index().sort_values('a').groupby('seccion').tail(1).set_index('seccion').ja
sec['ja'] = sec.seccion.map(best)
sin = sec[sec.ja.isna()]
if len(sin):  # sin colonias del PILOTO: junta de la sección vecina más cercana
    con = sec[sec.ja.notna()]
    near = gpd.sjoin_nearest(sin[['seccion','geometry']], con[['ja','geometry']], how='left').drop_duplicates('seccion').set_index('seccion').ja
    sec.loc[sec.ja.isna(), 'ja'] = sec.loc[sec.ja.isna(), 'seccion'].map(near)
sec['ja_aprox'] = sec.seccion.isin(sin.seccion)

# --- colonias: sección(es) que cubren cada colonia (≥5 % de su superficie) ---
col = col.reset_index(drop=True); col['cid'] = col.index
y = gpd.overlay(col[['cid','geometry']], sec[['seccion','ja','geometry']], how='intersection', keep_geom_type=True)
y['a'] = y.area
tot = y.groupby('cid').a.sum()
y['p'] = y.a / y.cid.map(tot)
cs = y[y.p >= .05].sort_values('p', ascending=False).groupby('cid').seccion.apply(lambda s: [int(v) for v in s])
cja = y.sort_values('a').groupby('cid').tail(1).set_index('cid').ja
col['secs'] = col.cid.map(cs); col['ja'] = col.cid.map(cja)
col = col[col.secs.notna()]

def unir(g, by):
    u = g.dissolve(by=by).reset_index()
    u['geometry'] = u.geometry.buffer(0)
    return u

capas = {
 'municipio': mun.assign(nombre='Puebla'),
 'df': unir(sec[['distrito_f','geometry']], 'distrito_f'),
 'dl': unir(sec[['distrito_l','geometry']], 'distrito_l'),
 'ja': unir(sec[['ja','geometry']], 'ja'),
 'seccion': sec,
 'colonia': col[['cid','NOMBRE','CP','ja','secs','geometry']].rename(columns={'NOMBRE':'nombre','CP':'cp'}),
}
import os; os.makedirs(OUT, exist_ok=True)
for k, g in capas.items():
    g = g.copy(); g['geometry'] = g.geometry.simplify(TOL, preserve_topology=True)
    g = g.to_crs(4326)
    for c in g.columns:
        if c != 'geometry' and g[c].dtype.kind in 'if' and c not in ('ja_aprox',): g[c] = g[c].astype('Int64') if g[c].dtype.kind=='f' else g[c]
    g['cp'] = g['cp'].astype(str).str.replace('<NA>','') if 'cp' in g else None
    if 'cp' not in capas[k]: g = g.drop(columns='cp')
    g.to_file(f'{OUT}/{k}.geojson', driver='GeoJSON', COORDINATE_PRECISION=5)
    print(k, len(g), os.path.getsize(f'{OUT}/{k}.geojson')//1024, 'KB')
print('secciones con JA aproximada (sin colonias en PILOTO):', int(sec.ja_aprox.sum()))
print('JA:', sec.ja.value_counts().to_dict())
print('colonias INE en municipio:', len(col), '| sin CP:', int((col.CP.isna()|(col.CP==0)).sum()))

# --- contexto del mapa: vías principales, ríos y cuerpos de agua; calles para acercamiento ---
g0 = mun.geometry.iloc[0]
def clip(n, **kw):
    g = gpd.read_file(f'{BGD}/{n}.shp', mask=g0)
    g = g.clip(g0)
    return g[g.geometry.notna() & ~g.geometry.is_empty]
via = clip('VIALIDAD')
prin = pd.concat([
    via[via.CATEGORIA == 1].assign(k='principal'),
    clip('AUTOPISTA').assign(k='autopista'),
    clip('PAVIMENTADA').assign(k='principal'),
])[['k', 'NOMBRE', 'geometry']].rename(columns={'NOMBRE': 'n'})
agua = pd.concat([clip('RIOS').assign(k='rio'), clip('LAGOS').assign(k='lago')])[['k', 'geometry']]
ctx = gpd.GeoDataFrame(pd.concat([prin, agua]), crs=sec.crs)
ctx['geometry'] = ctx.geometry.simplify(4)
ctx.to_crs(4326).to_file(f'{OUT}/contexto.geojson', driver='GeoJSON', COORDINATE_PRECISION=5)
cal = via[via.CATEGORIA != 1][['geometry']].copy()
cal['geometry'] = cal.geometry.simplify(3)
cal = cal.dissolve().explode(index_parts=False)
# calles en formato compacto (enteros a 1e-5 grados, codificados por diferencias) para que pese ~1 MB
L = []
for gm in cal.to_crs(4326).geometry:
    if gm.geom_type != 'LineString' or len(gm.coords) < 2: continue
    q = [(round(x * 1e5), round(y * 1e5)) for x, y in gm.coords]
    o = [q[0][0] + 9800000, q[0][1] - 1900000]
    for i in range(1, len(q)): o += [q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]]
    L.append(o)
json.dump({'b': [-9800000, 1900000], 'l': L}, open(f'{OUT}/calles.json', 'w'), separators=(',', ':'))
print('contexto', os.path.getsize(f'{OUT}/contexto.geojson') // 1024, 'KB', '| calles', os.path.getsize(f'{OUT}/calles.json') // 1024, 'KB')
