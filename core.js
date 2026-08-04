/* ============================================================
   Mis Finanzas — núcleo compartido
   Firebase, utilidades, diálogos, avisos, tema y navegación.
   Todas las páginas importan desde aquí.
   ============================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, getDoc, onSnapshot, updateDoc,
         deleteDoc, query, enableIndexedDbPersistence, arrayUnion, writeBatch }
       from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

export { collection, doc, addDoc, setDoc, getDoc, onSnapshot, updateDoc, deleteDoc, query, arrayUnion, writeBatch };

const firebaseConfig = {
    apiKey: "AIzaSyAnLru6yhw9huXN25LV4kGmCfXL843o4TA",
    authDomain: "presta-57302.firebaseapp.com",
    projectId: "presta-57302",
    storageBucket: "presta-57302.firebasestorage.app",
    messagingSenderId: "636802344217",
    appId: "1:636802344217:web:46fa0418609d69eb841188"
};

const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
export const db = getFirestore(fbApp);
enableIndexedDbPersistence(db).catch(() => {});

export const COL = {
    fondos:      'savings_funds',
    metas:       'savings_plans',
    prestamos:   'loans',
    rondas:      'savings_rounds',
    fiado:       'credit_accounts',
    financiado:  'financed_items',
    presupuesto: 'budget_profile'
};
export const MASTER_KEY = '2026';

/* ---------------- Utilidades ---------------- */
export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function money(n, opts = {}) {
    const v = Number(n) || 0;
    const s = Math.abs(v).toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const sign = opts.signed ? (v > 0 ? '+' : v < 0 ? '−' : '') : (v < 0 ? '−' : '');
    return `${sign}L ${s}`;
}
export const money0 = (n) => 'L ' + Math.round(Number(n) || 0).toLocaleString('es-HN');
export const monogram = (name) => {
    const w = String(name || '?').trim().split(/\s+/).filter(Boolean);
    return ((w[0]?.[0] || '?') + (w[1]?.[0] || '')).toUpperCase();
};
export const tint = (hex, a) => {
    const h = hex.replace('#', '');
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
};

/* ---------------- Fechas ---------------- */
export const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export const DIAS  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
export const fshort = (iso) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; };
export const flong  = (iso) => { const d = new Date(iso); return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; };
export const fmid   = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MESES[d.getMonth()].slice(0,3)} ${d.getFullYear()}`; };
export const ftime  = (iso) => new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' });
export const monthKey   = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
export const monthLabel = (k) => { const [y, m] = k.split('-'); return `${MESES[+m - 1]} ${y}`; };
export const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const isoToDate = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const dateToISO = (s) => s === todayStr() ? new Date().toISOString() : new Date(s + 'T12:00:00').toISOString();
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
export const diasEntre = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 86400000);

/** Fecha de la cuota n (1-indexada) de un artículo financiado. */
export function cuotaDue(item, n) {
    const base = new Date(item.firstDue + 'T12:00:00');
    const d = new Date(base.getFullYear(), base.getMonth() + (n - 1), 1);
    const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(Number(item.dueDay) || base.getDate(), ultimo));
    return d;
}

/* ---------------- Almacenamiento local ---------------- */
export const leer = (k, def = {}) => { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; } };
export const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------------- Avisos ---------------- */
export function notice(msg, kind = '') {
    let host = $('#notices');
    if (!host) { host = document.createElement('div'); host.id = 'notices'; host.className = 'notices'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = `notice ${kind}`;
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(() => { el.classList.add('gone'); setTimeout(() => el.remove(), 220); }, 2700);
}

/* ---------------- Diálogos ---------------- */
let dialogOpen = false;
export const isDialogOpen = () => dialogOpen;

function ensureDialog() {
    if ($('#dialog')) return;
    const scrim = document.createElement('div');
    scrim.id = 'scrim'; scrim.className = 'scrim'; scrim.dataset.act = 'close-dialog';
    const dlg = document.createElement('div');
    dlg.id = 'dialog'; dlg.className = 'dialog'; dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true');
    dlg.innerHTML = '<div class="dialog-grip"></div><div id="dialog-body"></div>';
    document.body.append(scrim, dlg);
}

export function openDialog(html) {
    ensureDialog();
    $('#dialog-body').innerHTML = html;
    $('#dialog').classList.add('open');
    $('#scrim').classList.add('open');
    if (!dialogOpen) { dialogOpen = true; history.pushState({ dialog: true }, ''); }
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('#dialog [data-autofocus]')?.focus(), 250);
}

export function closeDialog(fromPop = false) {
    if (!dialogOpen) return;
    dialogOpen = false;
    $('#dialog')?.classList.remove('open');
    $('#scrim')?.classList.remove('open');
    document.body.style.overflow = '';
    if (!fromPop && history.state && history.state.dialog) history.back();
}

export function askConfirm({ title, body, label = 'Confirmar', danger = false, key = false }) {
    return new Promise(resolve => {
        openDialog(`
            <h2 class="text-[17px] font-semibold mb-2">${esc(title)}</h2>
            <p class="text-[14px] mb-5" style="color: var(--ink-2); line-height:1.6">${body}</p>
            ${key ? `<div class="mb-5"><label class="label" for="ck">Clave maestra</label><input id="ck" type="password" inputmode="numeric" class="field field-num" data-autofocus></div>` : ''}
            <div class="flex gap-2.5 justify-end">
                <button class="btn btn-outline" data-confirm="0">Cancelar</button>
                <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm="1">${esc(label)}</button>
            </div>`);
        const h = (e) => {
            const btn = e.target.closest('[data-confirm]');
            if (!btn) return;
            const ok = btn.dataset.confirm === '1';
            if (ok && key && ($('#ck')?.value || '') !== MASTER_KEY) { notice('Clave incorrecta', 'neg'); return; }
            $('#dialog').removeEventListener('click', h);
            closeDialog();
            resolve(ok);
        };
        $('#dialog').addEventListener('click', h);
    });
}

export const num = (sel) => { const v = parseFloat(($(sel)?.value || '').replace(',', '.')); return isNaN(v) ? 0 : v; };
export const dialogFooter = (act, label, id = '') => `
    <div class="flex gap-2.5 justify-end pt-1">
        <button type="button" class="btn btn-outline" data-act="close-dialog">Cancelar</button>
        <button type="button" class="btn btn-primary" data-primary data-act="${act}" data-id="${id}">${label}</button>
    </div>`;

/* ---------------- Tema ---------------- */
export function initTheme() {
    const set = (t) => {
        document.documentElement.dataset.theme = t;
        $('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#7E1520' : '#C41E30');
    };
    const saved = localStorage.getItem('mf-theme');
    set(saved ? saved : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    document.addEventListener('click', (e) => {
        if (!e.target.closest('[data-act="theme"]')) return;
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('mf-theme', next);
        set(next);
    });
}

/* ---------------- Saludo ---------------- */
export function saludo() {
    const h = new Date().getHours();
    const nombre = localStorage.getItem('mf-nombre') || '';
    const txt = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    const el = $('#greet-text');
    if (el) el.textContent = nombre ? `${txt}, ${nombre}` : txt;
    const ico = $('#greet-ico');
    if (ico) ico.innerHTML = (h >= 6 && h < 19)
        ? '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C9962B" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="rgba(201,150,43,.18)"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4"/></svg>'
        : '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#5B6B8C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="rgba(91,107,140,.18)"/></svg>';
}

/* ---------------- Efectos ---------------- */
/** Anima un número de 0 al valor final. */
export function countUp(el, to, fmt = money) {
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { if (el) el.textContent = fmt(to); return; }
    const dur = 620, t0 = performance.now(), from = 0;
    const tick = (t) => {
        const p = clamp((t - t0) / dur, 0, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(from + (to - from) * e);
        if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

/** Reemplaza el contenido de una vista con transición suave. */
export function swapView(el, html) {
    if (!el) return;
    el.classList.remove('view-in');
    el.innerHTML = html;
    void el.offsetWidth;
    el.classList.add('view-in');
}

/** Onda al tocar (efecto material). */
export function initRipple() {
    document.addEventListener('pointerdown', (e) => {
        const t = e.target.closest('.btn, .grow, .tile, .chip, .bnav .tab');
        if (!t || t.disabled) return;
        const r = t.getBoundingClientRect();
        const s = Math.max(r.width, r.height);
        const i = document.createElement('span');
        i.className = 'ripple';
        i.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s/2}px;top:${e.clientY - r.top - s/2}px`;
        if (getComputedStyle(t).position === 'static') t.style.position = 'relative';
        t.appendChild(i);
        setTimeout(() => i.remove(), 620);
    });
}

/* ---------------- Arranque ---------------- */
export function bootShell({ onReady } = {}) {
    initTheme();
    initRipple();
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dialogOpen) closeDialog(); });
    window.addEventListener('popstate', () => { if (dialogOpen) closeDialog(true); });
    document.addEventListener('click', (e) => { if (e.target.closest('[data-act="close-dialog"]')) closeDialog(); });
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || !dialogOpen) return;
        if (!e.target.closest('#dialog') || e.target.tagName === 'TEXTAREA') return;
        const p = $('#dialog [data-primary]') || $('#dialog [data-confirm="1"]');
        if (p) { e.preventDefault(); p.click(); }
    });
    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
    onAuthStateChanged(auth, () => onReady?.());
    signInAnonymously(auth).catch(() => onReady?.());
    setTimeout(() => onReady?.(), 5000);
}

/** Cabecera común: barra de marca + saludo. */
export function shellHeader(titulo, { back = 'index.html' } = {}) {
    return `
    <header class="appbar">
        <div class="wrap appbar-in">
            <span class="flex items-center gap-2.5 min-w-0">
                <span class="mono-tile brandmark">MF</span>
                <span class="font-semibold text-[15.5px] truncate" style="font-family: var(--f-display); letter-spacing:-.01em;">${esc(titulo)}</span>
            </span>
            <span class="flex items-center gap-1">
                <button class="appbar-btn" data-act="theme" aria-label="Cambiar tema">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg>
                </button>
                <a href="${back}" class="appbar-btn" aria-label="Volver al panel">
                    Panel
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                </a>
            </span>
        </div>
    </header>`;
}
