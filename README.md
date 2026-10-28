# Puebla Electoral

Resultados electorales 2000–2024 del estado de Puebla, con Puebla capital al centro y su zona conurbada al detalle (sección, colonia y junta auxiliar). Funciona en celular, tablet, laptop y pantallas grandes. Es una página estática con acceso por usuario y clave.

## Qué contiene

| Capa | Fuente |
|---|---|
| Municipios, distritos locales y federales, secciones, colonias, carreteras, calles, ríos y presas | INE, Base Geográfica Digital (corte dic-2025) |
| Zona metropolitana (18 municipios de Puebla) | Delimitación INEGI/CONAPO de la ZM Puebla-Tlaxcala |
| Juntas auxiliares de Puebla capital | Mapa PILOTO 5: cada sección va a la junta donde cae la mayor parte de sus colonias |
| Resultados por sección | INE (Presidencia, Senado, Diputación federal 2000–2024) e IEE Puebla (Gubernatura, Diputación local y Ayuntamientos 2016–2024), datos abiertos |
| Quién ganó | Registro de candidaturas ganadoras del INE y del IEE Puebla |

Detalle por sección: Puebla, San Andrés Cholula, San Pedro Cholula, Cuautlancingo, Amozoc, Coronango y Ocoyucan. El resto del estado se consulta por municipio y por distrito.

## Acceso

Los resultados se guardan cifrados (`data/seguro/*.bin`, AES-256-GCM). Cada usuario abre solo los paquetes de su nivel con su clave (PBKDF2). En el repositorio no queda ninguna clave ni resultado legible.

| Nivel | Ve |
|---|---|
| 1 Administrador | Todo, más la lista de usuarios |
| 2 Estatal | Todo |
| 3 Metropolitano | Estado por municipio + detalle de Puebla y los 6 conurbados |
| 4 Municipal | Estado por municipio + detalle de su municipio (ámbito: clave INE, 115 = Puebla) |
| 5 Distrital | Estado por municipio + detalle de su distrito (ámbito: DL10, DF6…) |

Los usuarios se administran en un Excel (`usuario | nombre | nivel | ambito | clave`) que **nunca** se sube al repositorio.

## Actualizar datos o usuarios

```
python pipeline/construir.py "<BGD 21 PUEBLA>" "<doc.kml del PILOTO 5>" "<carpeta con *_SEC.csv y ganadores_pue.csv>" <salida>
python pipeline/acceso.py usuarios.xlsx <salida> data
```
Copiar `<salida>/geo` y `<salida>/catalogo.json` a `data/`. Para agregar una elección nueva basta con sumarla a la lista `EL` de `construir.py`.

## Reglas de los datos

- **Candidaturas**: suman los votos de cada partido y de todas las combinaciones de su coalición; la coalición se detecta en el lugar de cada elección (municipio, distrito o estado).
- **Municipios**: suma de todas las secciones del cómputo, incluidas las que el INE dividió después.
- **Distritos**: trazo vigente, armados con las secciones que hoy los forman; la ficha dice qué parte de los votos cubre.
- **Secciones nuevas**: aparecen con trama en las elecciones anteriores a su creación.
- **Colonias**: no son unidades electorales; suman completas las secciones que las cubren.
