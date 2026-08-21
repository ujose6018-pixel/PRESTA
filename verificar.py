#!/usr/bin/env python3
"""
Busca identificadores usados pero nunca definidos ni importados.

Node --check solo valida sintaxis: un `dialogFooter(...)` inexistente
pasa la revisión y revienta recién cuando el usuario toca el botón.
Este script atrapa justo eso.

    python3 verificar.py
"""
import re, glob, sys, json, subprocess, pathlib

GLOBALES = set("""
console document window history localStorage sessionStorage navigator location fetch
setTimeout clearTimeout setInterval clearInterval requestAnimationFrame queueMicrotask
Math JSON Object Array String Number Boolean Date RegExp Promise Map Set WeakMap Symbol
Error TypeError RangeError parseInt parseFloat isNaN isFinite encodeURIComponent
decodeURIComponent structuredClone Intl performance crypto alert confirm prompt
undefined null true false NaN Infinity globalThis URL URLSearchParams Response Request
Headers FormData Blob File FileReader AbortController TextEncoder TextDecoder
getComputedStyle CustomEvent Event MutationObserver IntersectionObserver ResizeObserver Notification
BigInt Proxy Reflect WeakSet ArrayBuffer Uint8Array atob btoa import
""".split())

def _es_regex(out):
    """Una barra abre expresión regular si lo anterior no es un valor.
    Después de un identificador, número, `)` o `]` es división."""
    txt = ''.join(out).rstrip()
    if not txt: return True
    c = txt[-1]
    if c in ')]}': return False
    if c.isalnum() or c in '_$':
        m = re.search(r'[A-Za-z_$][\w$]*$', txt)
        return bool(m) and m.group(0) in ('return','typeof','case','in','of','delete','void','instanceof','do','else','yield','await')
    return True

def limpiar(js):
    """Deja solo código ejecutable, en UNA pasada.

    Hacerlo en pasadas separadas (primero comentarios, luego comillas)
    desincroniza el analizador: un apóstrofo dentro de una plantilla se
    empareja con otro lejano y se traga código real. Por eso el recorrido
    es único y cada tipo de literal se cierra donde corresponde.
    """
    out, i, n = [], 0, len(js)
    while i < n:
        c = js[i]
        if c == '/' and i + 1 < n and js[i+1] == '*':
            j = js.find('*/', i + 2); i = n if j < 0 else j + 2; out.append(' ')
        elif c == '/' and i + 1 < n and js[i+1] == '/':
            j = js.find('\n', i); i = n if j < 0 else j; out.append(' ')
        elif c == '/' and _es_regex(out):
            # Literal de expresión regular. Puede contener comillas
            # (/[&<>"']/g) que si no se saltan desincronizan todo.
            i += 1
            clase = False
            while i < n:
                if js[i] == '\\': i += 2; continue
                if js[i] == '[': clase = True
                elif js[i] == ']': clase = False
                elif js[i] == '/' and not clase: break
                elif js[i] == '\n': break
                i += 1
            i += 1
            while i < n and js[i] in 'gimsuyvd': i += 1
            out.append('/x/')
        elif c in '"\'':
            q = c; i += 1
            while i < n and js[i] != q:
                i += 2 if js[i] == '\\' else 1
            i += 1; out.append('""')
        elif c == '`':
            i += 1
            while i < n and js[i] != '`':
                if js[i] == '\\': i += 2; continue
                if js[i] == '$' and i + 1 < n and js[i+1] == '{':
                    i += 2; prof, ini = 1, i
                    while i < n and prof:
                        if js[i] == '{': prof += 1
                        elif js[i] == '}': prof -= 1
                        if prof: i += 1
                    out.append(' ' + limpiar(js[ini:i]) + ' ')
                    i += 1; continue
                i += 1
            i += 1; out.append('""')
        else:
            out.append(c); i += 1
    return ''.join(out)

def analizar(archivo, js):
    js = limpiar(js)
    # Nombres que el módulo trae de core.js
    imports = set()
    for b in re.findall(r"import\s*\{([\s\S]*?)\}\s*from", js):
        for x in b.split(','):
            x = x.strip()
            if x: imports.add(x.split(' as ')[-1].strip())

    definidos = set(imports)
    definidos |= set(re.findall(r'\bfunction\s+([A-Za-z_$][\w$]*)', js))
    definidos |= set(re.findall(r'\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)', js))
    definidos |= set(re.findall(r'\bclass\s+([A-Za-z_$][\w$]*)', js))
    # desestructuración: const { a, b } = ... y const [a, b] = ...
    for b in re.findall(r'\b(?:const|let|var)\s*\{([^}]*)\}\s*=', js):
        for x in b.split(','):
            x = x.strip().split(':')[-1].split('=')[0].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', x): definidos.add(x)
    for b in re.findall(r'\b(?:const|let|var)\s*\[([^\]]*)\]\s*=', js):
        for x in b.split(','):
            x = x.strip().split('=')[0].strip()
            if re.fullmatch(r'[A-Za-z_$][\w$]*', x): definidos.add(x)
    # parámetros de función y arrow
    for b in re.findall(r'function\s*[\w$]*\s*\(([^)]*)\)', js):
        for x in re.findall(r'[A-Za-z_$][\w$]*', b): definidos.add(x)
    for b in re.findall(r'\(([^()]*)\)\s*=>', js):
        for x in re.findall(r'[A-Za-z_$][\w$]*', b): definidos.add(x)
    for x in re.findall(r'(?:^|[^.\w])([A-Za-z_$][\w$]*)\s*=>', js): definidos.add(x)
    for b in re.findall(r'catch\s*\(([^)]*)\)', js): definidos.add(b.strip())
    for b in re.findall(r'for\s*\(\s*(?:const|let|var)\s+([\w$]+)', js): definidos.add(b)

    # Solo se revisan las LLAMADAS: `algo(` que no venga precedido de punto.
    llamadas = set(re.findall(r'(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(', js))
    faltan = sorted(n for n in llamadas
                    if n not in definidos and n not in GLOBALES
                    and not n[0].isupper() and n not in ('if','for','while','switch','catch','return','typeof','function','await','new','do'))
    return faltan

problemas = 0
for f in sorted(glob.glob('*.html')):
    html = pathlib.Path(f).read_text(encoding='utf-8')
    m = re.search(r'<script type="module">([\s\S]*?)</script>', html)
    if not m: continue
    faltan = analizar(f, m.group(1))
    if faltan:
        print(f'  FALLA {f}: llama pero no existe -> {", ".join(faltan)}')
        problemas += 1
    else:
        print(f'  ok  {f}')

for f in ['core.js', 'analisis.js']:
    faltan = analizar(f, pathlib.Path(f).read_text(encoding='utf-8'))
    if faltan:
        print(f'  FALLA {f}: {", ".join(faltan)}'); problemas += 1
    else:
        print(f'  ok  {f}')

sys.exit(1 if problemas else 0)
