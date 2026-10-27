"""Capas de contexto del mapa (BGD INE, dic-2025), recortadas al municipio de Puebla:
vías principales (autopistas, carreteras y vialidades de 50 km/h o más), calles, ríos y cuerpos de agua.
uso: python contexto.py <carpeta_bgd> <salida>
"""
import sys, os, pandas as pd, geopandas as gpd
BGD, OUT = sys.argv[1:3]
rd = lambda n, **k: gpd.read_file(f'{BGD}/{n}.shp', **k)
m = rd('MUNICIPIO'); m = m[m.municipio == 115]
clip = lambda g: gpd.clip(g, m)
via = clip(rd('VIALIDAD', mask=m))
prin = pd.concat([clip(rd('AUTOPISTA', mask=m)).assign(k=1), clip(rd('PAVIMENTADA', mask=m)).assign(k=1),
                  via[via.VELOCIDAD_ >= 50].assign(k=2)])[['NOMBRE', 'k', 'geometry']]
calles = via[via.VELOCIDAD_ < 50][['geometry']]
agua = pd.concat([clip(rd('RIOS', mask=m)).assign(k='r'), clip(rd('LAGOS', mask=m)).assign(k='l')])[['k', 'geometry']]
os.makedirs(OUT, exist_ok=True)
for n, g, tol in [('vias', prin, 4), ('calles', calles, 3), ('agua', agua, 4)]:
    g = g.copy(); g['geometry'] = g.geometry.simplify(tol); g = g[~g.geometry.is_empty].to_crs(4326)
    if 'NOMBRE' in g: g = g.rename(columns={'NOMBRE': 'n'})
    g.to_file(f'{OUT}/{n}.geojson', driver='GeoJSON', COORDINATE_PRECISION=5)
    print(n, len(g), os.path.getsize(f'{OUT}/{n}.geojson') // 1024, 'KB')
