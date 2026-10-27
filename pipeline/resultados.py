"""Resultados por sección del municipio de Puebla, 2015–2024 (INE / IEE Puebla, datos abiertos SEE).
Por cada elección: votos por partido, votos por candidatura (partido o coalición, sumando las combinaciones),
nulos, no registrados, total y lista nominal. Las coaliciones se detectan por lugar (municipio o distrito):
partidos unidos por una combinación con votos compitieron juntos.
Secciones que el INE dio de baja después de la elección (reseccionamiento): sus votos se conservan en los totales
de municipio, distrito y junta auxiliar (campo x=1), pero no se dibujan ni se reparten entre secciones nuevas.
uso: python resultados.py <carpeta_csv> <secciones.geojson> <ja_baja.json> <salida>
"""
import sys, csv, json, glob, os, re, collections
SRC, SECJ, JAB, OUT = sys.argv[1:5]
SECS = {f['properties']['seccion'] for f in json.load(open(SECJ))['features']}
JA_BAJA = {int(k): v for k, v in json.load(open(JAB)).items()}
EL = [  # archivo, id, año, cargo, unidad de coalición
 ('2015_SEE_DIP_FED_MR_NAL_SEC.csv','2015-DF',2015,'Diputación federal','DIS'),
 ('2016_SEE_GOB_PUE_SEC.csv','2016-GOB',2016,'Gubernatura',None),
 ('2018_SEE_PRE_NAL_SEC.csv','2018-PRE',2018,'Presidencia de la República',None),
 ('2018_SEE_SEN_MR_NAL_SEC.csv','2018-SEN',2018,'Senaduría',None),
 ('2018_SEE_DIP_FED_MR_NAL_SEC.csv','2018-DF',2018,'Diputación federal','DIS'),
 ('2018_SEE_GOB_PUE_SEC.csv','2018-GOB',2018,'Gubernatura',None),
 ('2018_SEE_DIP_LOC_MR_PUE_SEC.csv','2018-DL',2018,'Diputación local','DIS'),
 ('2018_SEE_AYUN_PUE_SEC.csv','2018-AYU',2018,'Presidencia municipal',None),
 ('2019_SEE_GOB_PUE_SEC_EXT.csv','2019-GOB',2019,'Gubernatura (extraordinaria)',None),
 ('2021_SEE_DIP_FED_MR_NAL_SEC.csv','2021-DF',2021,'Diputación federal','DIS'),
 ('2021_SEE_DIP_LOC_MR_PUE_SEC.csv','2021-DL',2021,'Diputación local','DIS'),
 ('2021_SEE_AYUN_PUE_SEC.csv','2021-AYU',2021,'Presidencia municipal',None),
 ('2024_SEE_PRE_NAL_SEC.csv','2024-PRE',2024,'Presidencia de la República',None),
 ('2024_SEE_SEN_FED_MR_NAL_SEC.csv','2024-SEN',2024,'Senaduría',None),
 ('2024_SEE_DIP_FED_MR_NAL_SEC.csv','2024-DF',2024,'Diputación federal','DIS'),
 ('2024_SEE_GOB_PUE_SEC.csv','2024-GOB',2024,'Gubernatura',None),
 ('2024_SEE_DIP_LOC_MR_PUE_SEC.CSV','2024-DL',2024,'Diputación local','DIS'),
 ('2024_SEE_AYUN_PUE_SEC.csv','2024-AYU',2024,'Presidencia municipal',None),
]
FUENTE = {'DF':'INE','PRE':'INE','SEN':'INE','GOB':'IEE Puebla','DL':'IEE Puebla','AYU':'IEE Puebla'}
ALIAS = {'NVA_ALIANZA':'NA','C_COMUN':'','PES':'PES','ES':'PES'}
META = re.compile(r'^(CIRCUNSCRIPCION|ID_|NOMBRE_|CABECERA|MUNICIPIO|SECCION|CASILLAS|ACTAS|NUM_VOTOS_VALIDOS)')
def num(v):
    try: return int(float(v))
    except: return 0
def partes(col, parties):
    """Partidos que forman una columna de combinación (nombres con guion bajo)."""
    c = col.replace('C_COMUN_','').replace('NVA_ALIANZA','NA')
    out, toks = [], c.split('_')
    i = 0
    while i < len(toks):
        out.append(toks[i]); i += 1
    return out
os.makedirs(OUT, exist_ok=True)
indice, excl = [], {}
for fn, eid, anio, cargo, unidad in EL:
    rows = list(csv.reader(open(f'{SRC}/{fn}', encoding='utf-8-sig')))
    h = [x.strip().lstrip('﻿').replace('ï»¿','') for x in rows[0]]; data = rows[1:]
    iS = h.index('SECCION'); iM = h.index('MUNICIPIO')
    iD = next((h.index(c) for c in ('ID_DISTRITO_FEDERAL','ID_DISTRITO_LOCAL','ID_DISTRITO') if c in h), None)
    special = {'NUM_VOTOS_CAN_NREG':'nreg','NUM_VOTOS_NULOS':'nulos','TOTAL_VOTOS':'total','LISTA_NOMINAL':'ln'}
    vcols = [i for i,c in enumerate(h) if not META.match(c) and c not in special]
    # partidos simples = columnas sin guion bajo (y CAND_IND)
    names = [h[i].replace('NVA_ALIANZA','NA') for i in vcols]
    simple = {n for n in names if '_' not in n and not n.startswith('CAND_IND')}
    def comp(n):
        if n.startswith('CAND_IND'): return [n]
        if n in simple: return [n]
        return [p for p in n.replace('C_COMUN_','').replace('NVA_ALIANZA','NA').split('_') if p]
    # filas del municipio (por sección vigente) — agrega por sección
    agg = collections.defaultdict(lambda: [0]*len(h)); dis = {}
    perdidas = set()
    for r in data:
        s = num(r[iS])
        if s not in SECS:
            if r[iM].strip().upper() != 'PUEBLA': continue
            perdidas.add(s)
        a = agg[s]
        for i in vcols + [h.index(c) for c in special if c in h]: a[i] += num(r[i])
        if iD is not None: dis[s] = num(r[iD])
    excl[eid] = sorted(perdidas)
    # coaliciones por unidad
    unidades = collections.defaultdict(list)
    for s in agg: unidades[dis.get(s) if unidad else 0].append(s)
    cand_of = {}  # (unidad, nombre col) -> candidatura
    for u, ss in unidades.items():
        par = {p: p for p in simple}
        def f(x):
            while par.setdefault(x, x) != x: x = par[x]
            return x
        tot = collections.Counter()
        for s in ss:
            for i, n in zip(vcols, names): tot[(i,n)] += agg[s][i]
        for (i, n), v in tot.items():
            ps = comp(n)
            if len(ps) > 1 and v > 0:
                for p in ps[1:]: par[f(p)] = f(ps[0])
        for (i, n) in tot:
            cand_of[(u, i)] = n if n.startswith('CAND_IND') else '-'.join(sorted(q for q in simple if f(q) == f(comp(n)[0])))
    # salida compacta
    PART = sorted(simple, key=lambda p: -sum(agg[s][vcols[names.index(p)]] for s in agg))
    candset = collections.Counter()
    sec_out = {}
    for s, a in agg.items():
        u = dis.get(s) if unidad else 0
        cv = collections.Counter()
        for i, n in zip(vcols, names): cv[cand_of[(u, i)]] += a[i]
        pv = [a[vcols[names.index(p)]] for p in PART]
        for k, v in cv.items(): candset[k] += v
        sec_out[s] = (cv, pv, a)
    CAND = [k for k, v in candset.most_common() if v > 0]
    # candidaturas con nombre de partidos ordenados por peso propio de cada partido
    ptot = {p: sum(o[1][PART.index(p)] for o in sec_out.values()) for p in PART}
    def lbl(k): return k if k.startswith('CAND_IND') else '-'.join(sorted(k.split('-'), key=lambda p: -ptot.get(p, 0)))
    gi = lambda a, c: a[h.index(c)] if c in h else 0
    S = {}
    for s, (cv, pv, a) in sorted(sec_out.items()):
        S[s] = {'d': dis.get(s), 'ln': gi(a,'LISTA_NOMINAL'), 't': gi(a,'TOTAL_VOTOS'), 'nu': gi(a,'NUM_VOTOS_NULOS'),
                'nr': gi(a,'NUM_VOTOS_CAN_NREG'), 'c': [cv.get(k, 0) for k in CAND], 'p': pv}
        if s in perdidas:
            S[s]['x'] = 1
            if s in JA_BAJA: S[s]['ja'] = JA_BAJA[s]
    tipo = eid.split('-')[1]
    vx = sum(v['t'] for v in S.values() if v.get('x'))
    meta = {'id': eid, 'anio': anio, 'cargo': cargo, 'fuente': FUENTE[tipo] + ', resultados por sección (datos abiertos)',
            'cand': [lbl(k) for k in CAND], 'part': PART, 'secs': len(S) - len(perdidas), 'baja': len(perdidas), 'votos_baja': vx}
    json.dump({'meta': meta, 's': S}, open(f'{OUT}/{eid}.json', 'w'), separators=(',', ':'))
    indice.append(meta)
    T = sum(v['t'] for v in S.values()); L = sum(v['ln'] for v in S.values())
    win = collections.Counter(meta['cand'][max(range(len(CAND)), key=lambda j: v['c'][j])] for v in S.values() if v['t'] and not v.get('x'))
    print(f"{eid:9} secs {len(S)-len(perdidas):4} baja {len(perdidas):3} ({vx/T:.1%} votos) LN {L:9,} votos {T:9,} part {T/L:.1%} | cands {meta['cand'][:5]} | ganadas {dict(win.most_common(3))}")
json.dump(indice, open(f'{OUT}/indice.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(excl, open(f'{OUT}/_secciones_no_vigentes.json', 'w'))
