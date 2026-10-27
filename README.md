# Puebla Electoral

Resultados electorales 2015–2024 del municipio de Puebla, por sección, colonia, junta auxiliar, distrito local y distrito federal. Funciona en celular, tablet, laptop y pantallas grandes. Es una página estática: no necesita servidor.

## Qué contiene

| Capa | Fuente |
|---|---|
| Secciones, distritos locales y federales | INE, Base Geográfica Digital (corte dic-2025) |
| Colonias (con código postal) | INE, Base Geográfica Digital (corte dic-2025) |
| Juntas auxiliares | Mapa PILOTO 5: cada sección se asigna a la junta donde cae la mayor parte de sus colonias |
| Resultados por sección | INE (Presidencia, Senado, Diputación federal) e IEE Puebla (Gubernatura, Diputación local, Ayuntamiento), datos abiertos |

Elecciones: 2015 DF · 2016 GOB · 2018 PRE, SEN, DF, GOB, DL, AYU · 2019 GOB (extraordinaria) · 2021 DF, DL, AYU · 2024 PRE, SEN, DF, GOB, DL, AYU.

## Reglas de los datos

- **Candidaturas**: suman los votos de cada partido y de todas las combinaciones de su coalición. Las coaliciones se detectan por lugar (municipio o distrito): partidos unidos por una combinación con votos compitieron juntos.
- **Secciones dadas de baja**: las que el INE dividió después de una elección no existen en el mapa vigente. Sus votos se conservan en el total del municipio y de su junta auxiliar, pero no se dibujan ni se reparten entre las secciones nuevas.
- **Secciones nuevas**: aparecen en gris en las elecciones anteriores a su creación.
- **Colonias**: no son unidades electorales; sus cifras son la suma completa de las secciones que las cubren.
- **Distritos**: trazo vigente y solo la parte dentro del municipio.

## Regenerar los datos

```
python pipeline/geografia.py "<BGD 21 PUEBLA>" "<doc.kml del PILOTO 5>" data/geo
python pipeline/resultados.py "<carpeta con *_SEC.csv de Puebla>" data/geo/seccion.geojson <ja_baja.json> data/res
```

## Publicar

GitHub Pages desde la rama `main`, carpeta raíz.
