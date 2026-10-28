"""Cifra los resultados y genera los accesos de la plataforma a partir de un Excel de usuarios.

Excel (primera hoja, con encabezados): usuario | nombre | nivel | ambito | clave
  nivel 1  Administrador   todo, más la lista de usuarios
  nivel 2  Estatal         todo el estado y el detalle de la zona metropolitana
  nivel 3  Metropolitano   estado (por municipio) + detalle de Puebla capital y conurbados
  nivel 4  Municipal       estado (por municipio) + detalle de su municipio      ambito: clave INE del municipio (115 = Puebla)
  nivel 5  Distrital       estado (por municipio) + detalle de su distrito       ambito: DL10, DF6…
Todos los niveles ven el resultado por municipio del estado (dato público); el detalle por sección se reparte por nivel.

Cada paquete de datos se cifra con su propia llave (AES-256-GCM). La llave se guarda cifrada para cada usuario con una
llave derivada de su clave (PBKDF2-SHA256). En el repositorio no queda ninguna clave ni dato legible.
uso: python acceso.py <usuarios.xlsx> <carpeta_de_construir.py> <carpeta data/ de la plataforma>
"""
import sys, os, json, gzip, base64, hashlib, secrets, glob, shutil
import openpyxl
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

XLSX, SRC, DATA = sys.argv[1:4]
IT = 210000
b64 = lambda b: base64.b64encode(b).decode()
def enc(key, raw): iv = secrets.token_bytes(12); return iv + AESGCM(key).encrypt(iv, raw, None)

cat = json.load(open(f'{SRC}/catalogo.json'))
DET = cat['detalle']
# qué municipios de detalle toca cada distrito
secs = json.load(open(f'{SRC}/geo/secciones.geojson'))['features']
DIST = {}
for f in secs:
    p = f['properties']
    DIST.setdefault(f"DL{p['distrito_l']}", set()).add(p['municipio']); DIST.setdefault(f"DF{p['distrito_f']}", set()).add(p['municipio'])

wb = openpyxl.load_workbook(XLSX, read_only=True); ws = wb.worksheets[0]
rows = list(ws.iter_rows(values_only=True)); h = [str(x).strip().lower() for x in rows[0]]
users = [dict(zip(h, r)) for r in rows[1:] if r and r[0]]

paquetes = {'estado': f'{SRC}/_claro/estado.json', **{f'm{m}': f'{SRC}/_claro/m{m}.json' for m in DET}}
NIV = {1: 'Administrador', 2: 'Estatal', 3: 'Metropolitano', 4: 'Municipal', 5: 'Distrital'}
lista = [{'usuario': str(u['usuario']).strip().lower(), 'nombre': str(u.get('nombre') or ''), 'nivel': NIV.get(int(u['nivel']), '?'),
          'ambito': str(u.get('ambito') or '')} for u in users]
claro_admin = json.dumps({'usuarios': lista}, ensure_ascii=False).encode()

out = f'{DATA}/seguro'; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
K = {}
for cab, fn in paquetes.items():
    K[cab] = secrets.token_bytes(32)
    open(f'{out}/{cab}.txt', 'w').write(b64(enc(K[cab], gzip.compress(open(fn, 'rb').read(), 9))))
K['admin'] = secrets.token_bytes(32); open(f'{out}/admin.txt', 'w').write(b64(enc(K['admin'], gzip.compress(claro_admin, 9))))

sal = secrets.token_hex(16); U = {}
for u in users:
    usr = str(u['usuario']).strip().lower(); clave = str(u['clave']); nivel = int(u['nivel']); amb = str(u.get('ambito') or '').strip().upper()
    if nivel in (1, 2, 3): det = DET
    elif nivel == 4: det = [int(amb)] if amb.isdigit() and int(amb) in DET else []
    elif nivel == 5: det = sorted(DIST.get(amb.replace(' ', ''), set()))
    else: raise SystemExit(f'nivel inválido para {usr}')
    cabs = ['estado'] + [f'm{m}' for m in det] + (['admin'] if nivel == 1 else [])
    s = secrets.token_bytes(16)
    kek = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=s, iterations=IT).derive(clave.encode())
    perfil = {'usuario': usr, 'nombre': str(u.get('nombre') or usr), 'nivel': nivel, 'nivel_n': NIV[nivel], 'ambito': amb, 'det': det}
    U[hashlib.sha256(f'{sal}|{usr}'.encode()).hexdigest()] = {
        's': b64(s), 'p': b64(enc(kek, json.dumps(perfil, ensure_ascii=False).encode())),
        'k': {c: b64(enc(kek, K[c])) for c in cabs}}
    print(f'  {usr:16} {NIV[nivel]:14} {amb or "-":6} → {", ".join(cabs)}')
json.dump({'sal': sal, 'it': IT, 'u': U}, open(f'{DATA}/acceso.json', 'w'), separators=(',', ':'))
for f in sorted(glob.glob(f'{out}/*.txt')): print(f'  seguro/{os.path.basename(f)}: {os.path.getsize(f) // 1024} KB')
