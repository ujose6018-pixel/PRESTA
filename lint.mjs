/* Busca identificadores usados en cada página que no estén importados,
   declarados localmente, ni sean globales del navegador. */
import { parse } from 'acorn';
import { readdirSync, readFileSync } from 'fs';

const GLOBALES = new Set(['window','document','console','Math','JSON','Date','Number','String','Boolean',
 'Array','Object','Promise','Set','Map','parseInt','parseFloat','isNaN','setTimeout','setInterval',
 'clearInterval','clearTimeout','fetch','localStorage','history','location','navigator','alert',
 'requestAnimationFrame','encodeURIComponent','decodeURIComponent','Intl','Error','RegExp','undefined',
 'NaN','Infinity','globalThis','performance','structuredClone','CustomEvent','Event','URL','crypto',
 'AbortController','TextEncoder','Blob','FileReader','IntersectionObserver','matchMedia','screen','self']);

function analizar(nombre, src) {
    let ast;
    try { ast = parse(src, { ecmaVersion: 2023, sourceType: 'module' }); }
    catch (e) { console.log(`  ${nombre}: NO PARSEA -> ${e.message}`); return 1; }

    const declarados = new Set(), usados = new Map();
    const declara = (n) => n && declarados.add(n);
    const patron = (p) => {
        if (!p) return;
        if (p.type === 'Identifier') declara(p.name);
        else if (p.type === 'ObjectPattern') p.properties.forEach(x => patron(x.value || x.argument));
        else if (p.type === 'ArrayPattern') p.elements.forEach(patron);
        else if (p.type === 'AssignmentPattern') patron(p.left);
        else if (p.type === 'RestElement') patron(p.argument);
    };
    const walk = (n, padre = null) => {
        if (!n || typeof n.type !== 'string') return;
        switch (n.type) {
            case 'ImportDeclaration': n.specifiers.forEach(s => declara(s.local.name)); return;
            case 'VariableDeclarator': patron(n.id); break;
            case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
                if (n.id) declara(n.id.name); n.params.forEach(patron); break;
            case 'ClassDeclaration': if (n.id) declara(n.id.name); break;
            case 'CatchClause': patron(n.param); break;
            case 'Identifier': {
                const esProp = padre && ((padre.type === 'MemberExpression' && padre.property === n && !padre.computed)
                             || (padre.type === 'Property' && padre.key === n && !padre.computed));
                if (!esProp && !usados.has(n.name)) usados.set(n.name, true);
                return;
            }
        }
        for (const k in n) {
            if (k === 'type' || k === 'loc' || k === 'range') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach(c => walk(c, n));
            else if (v && typeof v.type === 'string') walk(v, n);
        }
    };
    walk(ast);
    const faltan = [...usados.keys()].filter(u => !declarados.has(u) && !GLOBALES.has(u)).sort();
    if (faltan.length) { console.log(`  FALLA ${nombre}: ${faltan.join(', ')}`); return 1; }
    console.log(`  ok  ${nombre}`);
    return 0;
}

let bad = 0;
for (const f of readdirSync('.').filter(x => x.endsWith('.html')).sort()) {
    const m = readFileSync(f, 'utf-8').match(/<script type="module">([\s\S]*?)<\/script>/);
    if (m) bad += analizar(f, m[1]);
}
bad += analizar('analisis.js', readFileSync('analisis.js', 'utf-8'));
process.exit(bad ? 1 : 0);
