#!/usr/bin/env python3
"""
Prepara una versión para publicar.

Le pone ?v=N a core.js, analisis.js y theme.css en todos lados, y deja
sw.js con el mismo número. Como la URL cambia, el navegador no puede
servir la versión anterior aunque quiera.

    python3 publicar.py 7

IMPORTANTE: la versión debe ser la misma en TODOS los archivos. Si una
página pide core.js?v=7 y otra core.js?v=6, el navegador carga core.js
dos veces como módulos distintos y Firebase se inicializa dos veces.
"""
import re, sys, glob, pathlib

VER = sys.argv[1] if len(sys.argv) > 1 else None
if not VER or not VER.isdigit():
    sys.exit('Uso: python3 publicar.py <numero>')

MODULOS = ['core.js', 'analisis.js']
ESTILOS = ['theme.css']

def versionar(txt):
    for m in MODULOS + ESTILOS:
        base = re.escape(m)
        # './core.js' o './core.js?v=5' -> './core.js?v=N'
        txt = re.sub(rf"(['\"])\./{base}(\?v=\d+)?\1", rf"\g<1>./{m}?v={VER}\g<1>", txt)
        # href="theme.css" sin ./
        txt = re.sub(rf'(href=")({base})(\?v=\d+)?(")', rf'\g<1>\g<2>?v={VER}\g<4>', txt)
    return txt

tocados = 0
for f in sorted(glob.glob('*.html')) + ['analisis.js']:
    p = pathlib.Path(f)
    antes = p.read_text(encoding='utf-8')
    despues = versionar(antes)
    if antes != despues:
        p.write_text(despues, encoding='utf-8')
        tocados += 1
    print(f'  {f}')

# sw.js con la misma versión y los activos versionados
sw = pathlib.Path('sw.js').read_text(encoding='utf-8')
sw = re.sub(r"const VER = '[^']*';", f"const VER = 'caudal-v{VER}';", sw)
sw = re.sub(r"'\./(core\.js|analisis\.js|theme\.css)(\?v=\d+)?'",
            lambda m: f"'./{m.group(1)}?v={VER}'", sw)
pathlib.Path('sw.js').write_text(sw, encoding='utf-8')
print(f'\nVersión v{VER} aplicada a {tocados} archivos + sw.js')
