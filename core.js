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
export { signInAnonymously, onAuthStateChanged };

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
/* Puede lanzar de forma síncrona si Firestore ya arrancó, por eso el try. */
try { enableIndexedDbPersistence(db).catch(() => {}); } catch { /* ya estaba activa */ }

export const COL = {
    fondos:      'savings_funds',
    metas:       'savings_plans',
    prestamos:   'loans',
    rondas:      'rounds',
    fiado:       'credit_accounts',
    financiado:  'financed_items',
    personales:  'personal_debts',
    presupuesto: 'budget_profile'
};
export const MASTER_KEY = '2026';

/* ---- Identidad. Cambiar aquí para renombrar toda la aplicación ---- */
export const APP = { nombre: 'Caudal', corto: 'Caudal' };

/* ---- Dónde está guardado el dinero de cada fondo ---- */
export const LUGARES = {
    efectivo:  { label: 'Efectivo',        desc: 'En físico, en casa',        color: '#8A5A1E',
                 ico: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 10v4M18 10v4"/>' },
    banca:     { label: 'Banca digital',   desc: 'App del banco',             color: '#1F3A5F',
                 ico: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 5.5h3M12 18.2h.01"/>' },
    ahorro:    { label: 'Cuenta de ahorro',desc: 'Cuenta en el banco',        color: '#1C6544',
                 ico: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18"/>' },
    billetera: { label: 'Billetera digital', desc: 'Tigo Money u otra',       color: '#7B2D38',
                 ico: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3"/><path d="M3 7.5V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/><path d="M21 9v4h-4a2 2 0 0 1 0-4Z"/>' },
    cripto:    { label: 'Criptomoneda',    desc: 'Binance, Trust Wallet…',    color: '#6D28A8',
                 ico: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5h4a2.2 2.2 0 0 1 0 4.4h-4Zm0 4.4h4.3a2.2 2.2 0 0 1 0 4.4H9.5Zm0-4.4V17M11 6.5v2M14 6.5v2M11 17v2M14 17v2"/>' }
};

/** Los fondos de cripto guardan la cantidad en monedas, no en lempiras. */
export const esCripto = (f) => f?.place === 'cripto';
export const lugarDe = (f) => LUGARES[f?.place] || LUGARES.efectivo;

/* ============================================================
   Titularidad
   Hay cuentas de fiado y préstamos que no son tuyos: los
   administrás para otra persona. Ese dinero NO entra en tu
   patrimonio ni en tu salud financiera, pero se sigue viendo
   y gestionando igual.

   Los registros creados antes de esta función no traen el campo,
   así que se tratan como propios y nada se rompe.
   ============================================================ */
export const esTercero = (x) => x?.fondeo === 'tercero';
export const esPropio  = (x) => !esTercero(x);
export const duenoDe   = (x) => (x?.fondeoNombre || '').trim() || 'otra persona';

export const TITULAR = {
    fiado: {
        mio:     { label: 'Es mi deuda',      desc: 'Lo que saco lo pago yo' },
        tercero: { label: 'De otra persona',  desc: 'Solo le llevo el control' }
    },
    prestamo: {
        mio:     { label: 'Mi capital',       desc: 'El dinero prestado es mío' },
        tercero: { label: 'Capital de otro',  desc: 'Alguien más pone el dinero' }
    }
};

/** Insignia para marcar lo que se administra sin ser propio. */
export const badgeTercero = (x) => esTercero(x)
    ? `<span class="badge" style="background:var(--accent-soft);color:var(--accent)">de ${escapeHtml(duenoDe(x))}</span>`
    : '';
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/** Selector de titularidad para los formularios. */
export function selectorTitular(tipo, valor = 'mio', nombre = '') {
    const opts = TITULAR[tipo];
    return `
    <div>
        <span class="label">${tipo === 'fiado' ? '¿De quién es esta cuenta?' : '¿De quién es el capital?'}</span>
        <div class="flex gap-2" id="tTitular" data-v="${valor}">
            ${Object.entries(opts).map(([k, o]) => `
            <button type="button" class="chip" style="flex:1;padding:11px 10px;text-align:left"
                    aria-pressed="${k === valor}" data-act="pick-titular" data-v="${k}">
                <span style="display:block;font-weight:800;font-size:13px">${o.label}</span>
                <span style="display:block;font-size:11px;opacity:.75;font-weight:500">${o.desc}</span>
            </button>`).join('')}
        </div>
    </div>
    <div id="tNombreCaja" class="${valor === 'tercero' ? '' : 'hidden'}">
        <label class="label" for="tNombre">${tipo === 'fiado' ? '¿Quién debe?' : '¿Quién puso el capital?'}</label>
        <input id="tNombre" class="field" maxlength="40" placeholder="Nombre de la persona" value="${escapeHtml(nombre)}">
    </div>`;
}

/** Lee el selector. Devuelve los dos campos listos para guardar. */
export function leerTitular() {
    const v = document.querySelector('#tTitular')?.dataset.v || 'mio';
    const n = (document.querySelector('#tNombre')?.value || '').trim();
    return { fondeo: v, fondeoNombre: v === 'tercero' ? n : '' };
}

/** Manejo del clic en el selector. Devuelve true si lo atendió. */
export function clicTitular(el) {
    if (el?.dataset?.act !== 'pick-titular') return false;
    const v = el.dataset.v;
    const cont = document.querySelector('#tTitular');
    cont.dataset.v = v;
    cont.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
    document.querySelector('#tNombreCaja')?.classList.toggle('hidden', v !== 'tercero');
    if (v === 'tercero') setTimeout(() => document.querySelector('#tNombre')?.focus(), 60);
    return true;
}

/* ============================================================
   Rondas de ahorro
   Una ronda cambia de naturaleza a mitad de camino: antes del
   turno lo aportado es AHORRO; después de cobrar el bote, lo que
   falta por aportar es DEUDA. Este cálculo es la única fuente de
   verdad y lo usan ronda.html, financiacion.html y el análisis.
   ============================================================ */
export const SHARE_KEY = 'mf-ronda-share';
export const shareSugerido = () => { const v = Number(localStorage.getItem(SHARE_KEY)); return v > 0 && v <= 1 ? v : 1; };
export function recordarShare(v) {
    const prev = Number(localStorage.getItem(SHARE_KEY));
    const nuevo = (prev > 0 && prev <= 1) ? (prev + v) / 2 : v;   // promedio con lo anterior
    try { localStorage.setItem(SHARE_KEY, String(Math.round(nuevo * 100) / 100)); } catch {}
}

export function rondaInfo(r) {
    const weeks   = Array.isArray(r?.weeks) ? r.weeks : [];
    const n       = Number(r?.numWeeks) || weeks.length;
    const share   = (Number(r?.share) > 0 && Number(r?.share) <= 1) ? Number(r.share) : 1;
    const cuotaFull = Number(r?.weeklyAmount) || 0;
    const cuota   = cuotaFull * share;                 // lo que YO aporto por semana
    const turno   = Math.max(0, Math.min(n, Number(r?.payoutWeek) || 0));
    const monto   = cuota * n;                         // el bote que me toca recibir

    const fechaTurno = turno > 0 && weeks[turno - 1] ? weeks[turno - 1].date : null;
    const recibido = typeof r?.received === 'boolean'
        ? r.received
        : (fechaTurno ? diasEntre(new Date(), new Date(fechaTurno + 'T12:00:00')) < 0 : false);

    const pagadas   = weeks.filter(w => w.status === 'paid').length;
    const pendientes = Math.max(0, n - pagadas);
    const aportado  = pagadas * cuota;
    const terminada = n > 0 && pagadas >= n;

    /* El estado define la naturaleza del dinero:
       - ahorrando: todo lo aportado es un activo, lo vas a recuperar en tu turno
       - pagando:   ya cobraste el bote, así que lo que falta por aportar es deuda
       - terminada: aportaste y cobraste lo mismo, la ronda queda saldada en cero */
    const estado = terminada ? 'terminada' : recibido ? 'pagando' : 'ahorrando';

    const ahorrado = estado === 'ahorrando' ? aportado : 0;
    const deuda    = estado === 'pagando'   ? pendientes * cuota : 0;

    /* Próxima semana sin pagar, con su estado de vencimiento */
    let prox = null;
    for (let i = 0; i < weeks.length; i++) {
        if (weeks[i].status === 'paid') continue;
        const dias = diasEntre(new Date(), new Date(weeks[i].date + 'T12:00:00'));
        prox = { n: i + 1, date: weeks[i].date, dias,
                 estado: dias < 0 ? 'late' : dias <= 5 ? 'soon' : 'ok',
                 esDeuda: estado === 'pagando' };
        break;
    }

    return { share, cuota, cuotaFull, n, turno, monto, fechaTurno, recibido, terminada, estado,
             pagadas, pendientes, ahorrado, deuda, aportado, prox,
             totalAportar: cuota * n,
             progreso: n > 0 ? (pagadas / n) * 100 : 0,
             nombre: r?.roundName || 'Ronda' };
}

/** Valor neto de una ronda para el patrimonio: positivo si ahorra, negativo si debe. */
export function rondaNeto(r) {
    const i = rondaInfo(r);
    if (i.estado === 'pagando')   return -i.deuda;   // pasivo
    if (i.estado === 'terminada') return 0;          // saldada
    return i.ahorrado;                               // activo
}

export const ESTADO_RONDA = {
    ahorrando: { label: 'Ahorrando', color: 'var(--pos)',   soft: 'var(--pos-soft)',  desc: 'Aportando hacia tu turno' },
    pagando:   { label: 'Pagando',   color: 'var(--neg)',   soft: 'var(--neg-soft)',  desc: 'Ya cobraste, te toca pagar' },
    terminada: { label: 'Terminada', color: 'var(--ink-3)', soft: 'var(--sunk)',      desc: 'Completada' }
};

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

/* ============================================================
   Criptomonedas
   Los precios NUNCA se guardan en Firestore: solo se guarda
   cuánto tenés de cada moneda y en qué billetera. El valor se
   consulta en vivo y se cachea en el teléfono, para que si te
   quedás sin señal al menos veas el último dato conocido.

   Las dos APIs son gratis y no piden llave:
     precios  -> CoinGecko (respaldo: Binance)
     dólar    -> exchange-api por jsDelivr (respaldo: open.er-api)
   ============================================================ */
const CACHE_CRIPTO = 'mf-cripto-cache';
export const CRIPTO_REFRESCO = 60_000;   // un minuto

/** Monedas comunes. `estable` marca las que valen ~1 dólar. */
export const MONEDAS = [
    { id: 'bitcoin',     sym: 'BTC',   nombre: 'Bitcoin',     bin: 'BTCUSDT'  },
    { id: 'ethereum',    sym: 'ETH',   nombre: 'Ethereum',    bin: 'ETHUSDT'  },
    { id: 'tether',      sym: 'USDT',  nombre: 'Tether',      bin: null, estable: true },
    { id: 'usd-coin',    sym: 'USDC',  nombre: 'USD Coin',    bin: 'USDCUSDT', estable: true },
    { id: 'binancecoin', sym: 'BNB',   nombre: 'BNB',         bin: 'BNBUSDT'  },
    { id: 'solana',      sym: 'SOL',   nombre: 'Solana',      bin: 'SOLUSDT'  },
    { id: 'ripple',      sym: 'XRP',   nombre: 'XRP',         bin: 'XRPUSDT'  },
    { id: 'cardano',     sym: 'ADA',   nombre: 'Cardano',     bin: 'ADAUSDT'  },
    { id: 'dogecoin',    sym: 'DOGE',  nombre: 'Dogecoin',    bin: 'DOGEUSDT' },
    { id: 'tron',        sym: 'TRX',   nombre: 'TRON',        bin: 'TRXUSDT'  },
    { id: 'litecoin',    sym: 'LTC',   nombre: 'Litecoin',    bin: 'LTCUSDT'  },
    { id: 'avalanche-2', sym: 'AVAX',  nombre: 'Avalanche',   bin: 'AVAXUSDT' },
    { id: 'chainlink',   sym: 'LINK',  nombre: 'Chainlink',   bin: 'LINKUSDT' },
    { id: 'polkadot',    sym: 'DOT',   nombre: 'Polkadot',    bin: 'DOTUSDT'  },
    { id: 'the-open-network', sym: 'TON', nombre: 'Toncoin',  bin: 'TONUSDT'  },
    { id: 'shiba-inu',   sym: 'SHIB',  nombre: 'Shiba Inu',   bin: 'SHIBUSDT' },
    { id: 'pepe',        sym: 'PEPE',  nombre: 'Pepe',        bin: 'PEPEUSDT' },
    { id: 'near',        sym: 'NEAR',  nombre: 'NEAR',        bin: 'NEARUSDT' },
    { id: 'bitcoin-cash',sym: 'BCH',   nombre: 'Bitcoin Cash',bin: 'BCHUSDT'  },
    { id: 'dai',         sym: 'DAI',   nombre: 'Dai',         bin: null, estable: true }
];
export const monedaPorId = (id) => MONEDAS.find(m => m.id === id) || null;
export const esEstable   = (id) => !!monedaPorId(id)?.estable;

/** Billeteras y casas de cambio comunes en Honduras. */
export const BILLETERAS = ['Binance', 'Trust Wallet', 'MetaMask', 'Coinbase', 'Bybit', 'OKX', 'Ledger', 'Otra'];

export const leerCacheCripto = () => leer(CACHE_CRIPTO, null);

/** Precios en dólares. Devuelve { [id]: { usd, cambio24 } }. */
async function desdeCoinGecko(ids) {
    const url = 'https://api.coingecko.com/api/v3/simple/price'
              + `?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd&include_24hr_change=true`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('CoinGecko ' + r.status);
    const j = await r.json();
    const out = {};
    for (const id of ids) {
        const v = j[id];
        if (v && typeof v.usd === 'number') out[id] = { usd: v.usd, cambio24: Number(v.usd_24h_change) || 0 };
    }
    if (!Object.keys(out).length) throw new Error('CoinGecko sin datos');
    return out;
}

/** Respaldo: Binance. Solo cubre las monedas que lista. */
async function desdeBinance(ids) {
    const pares = ids.map(monedaPorId).filter(m => m?.bin);
    const out = {};
    /* Las estables valen ~1 dólar; Binance no las cotiza contra sí mismas. */
    ids.filter(esEstable).forEach(id => { out[id] = { usd: 1, cambio24: 0 }; });
    if (pares.length) {
        const simbolos = JSON.stringify(pares.map(m => m.bin));
        const r = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(simbolos)}`);
        if (!r.ok) throw new Error('Binance ' + r.status);
        const j = await r.json();
        (Array.isArray(j) ? j : []).forEach(t => {
            const m = pares.find(x => x.bin === t.symbol);
            if (m) out[m.id] = { usd: parseFloat(t.lastPrice) || 0, cambio24: parseFloat(t.priceChangePercent) || 0 };
        });
    }
    if (!Object.keys(out).length) throw new Error('Binance sin datos');
    return out;
}

/** Cuántos lempiras vale un dólar. */
async function tipoCambioHNL() {
    try {
        const r = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
        if (!r.ok) throw new Error('jsdelivr ' + r.status);
        const j = await r.json();
        const v = Number(j?.usd?.hnl);
        if (v > 0) return v;
        throw new Error('sin hnl');
    } catch {
        const r = await fetch('https://open.er-api.com/v6/latest/USD');
        if (!r.ok) throw new Error('er-api ' + r.status);
        const j = await r.json();
        const v = Number(j?.rates?.HNL);
        if (v > 0) return v;
        throw new Error('sin HNL');
    }
}

/**
 * Trae precios y tipo de cambio. Nunca lanza: si todo falla devuelve
 * el último cache con `fresco: false`, para que la pantalla siga sirviendo.
 */
export async function cotizar(ids) {
    const cache = leerCacheCripto();
    if (!ids.length) return { usd: {}, hnl: cache?.hnl || 0, ts: cache?.ts || 0, fresco: true, error: null };

    let usd = null, error = null;
    try { usd = await desdeCoinGecko(ids); }
    catch (e1) {
        try { usd = await desdeBinance(ids); error = 'respaldo'; }
        catch (e2) { error = e1.message; }
    }

    let hnl = 0;
    try { hnl = await tipoCambioHNL(); }
    catch { hnl = cache?.hnl || 0; }

    if (!usd) {
        return cache
            ? { ...cache, fresco: false, error: error || 'sin conexión' }
            : { usd: {}, hnl, ts: 0, fresco: false, error: error || 'sin conexión' };
    }
    /* Se conservan precios viejos de monedas que esta vez no vinieron. */
    const combinado = { ...(cache?.usd || {}), ...usd };
    const dato = { usd: combinado, hnl, ts: Date.now() };
    guardar(CACHE_CRIPTO, dato);
    return { ...dato, fresco: true, error: error === 'respaldo' ? null : error };
}

/** Busca monedas fuera del catálogo, usando el buscador de CoinGecko. */
export async function buscarMoneda(texto) {
    const r = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(texto)}`);
    if (!r.ok) throw new Error('No se pudo buscar');
    const j = await r.json();
    return (j?.coins || []).slice(0, 8).map(c => ({
        id: c.id, sym: (c.symbol || '').toUpperCase(), nombre: c.name, bin: null
    }));
}

/**
 * Convierte el saldo de un fondo a lempiras.
 * Los fondos normales ya están en lempiras; los de cripto se valoran
 * con el precio cacheado. Si no hay precio, vale 0 (y se puede detectar
 * con `criptoSinPrecio`).
 */
export function fondoEnLempiras(f, saldo, cot) {
    if (!esCripto(f)) return saldo;
    const usd = Number(cot?.usd?.[f.coinId]?.usd) || 0;
    const hnl = Number(cot?.hnl) || 0;
    return saldo * usd * hnl;
}

/** Valor en dólares del saldo de un fondo de cripto. */
export function fondoEnDolares(f, saldo, cot) {
    if (!esCripto(f)) return 0;
    return saldo * (Number(cot?.usd?.[f.coinId]?.usd) || 0);
}

/** Cantidad de cripto: hasta 8 decimales, sin ceros de relleno. */
export const cantCripto = (n) => {
    const v = Number(n) || 0;
    if (v === 0) return '0';
    const dec = v >= 1000 ? 2 : v >= 1 ? 4 : 8;
    return v.toFixed(dec).replace(/\.?0+$/, '');
};

/** Precio unitario en dólares, con decimales según la escala. */
export const precioUSD = (n) => {
    const v = Number(n) || 0;
    if (v === 0) return '$0';
    if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (v >= 1)    return '$' + v.toFixed(2);
    if (v >= 0.01) return '$' + v.toFixed(4);
    return '$' + v.toFixed(8).replace(/0+$/, '');
};

export const usdMoney = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "hace 3 min" para el sello de actualización. */
export const haceCuanto = (ts) => {
    if (!ts) return 'nunca';
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 10) return 'ahora mismo';
    if (s < 60) return `hace ${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `hace ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
};

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
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="close-dialog"]')) closeDialog();
        const mas = e.target.closest('[data-act="nav-mas"]');
        if (mas) { e.preventDefault(); dialogMas(); }
    });
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

/* ============================================================
   Armazón compartido: cabecera + navegación inferior
   Todas las páginas montan lo mismo, por eso se sienten una sola app.
   ============================================================ */
const NAV = [
    { k: 'inicio', href: 'index.html',        label: 'Inicio',
      ico: '<path d="M4 20V10.2L12 4l8 6.2V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z"/>' },
    { k: 'ahorro', href: 'ahorro.html',       label: 'Ahorros',
      ico: '<path d="M18.5 10.5c0-3.3-2.9-6-6.5-6S5.5 7.2 5.5 10.5c0 1.7.8 3.2 2 4.3V19h2.5v-1.6c.8.2 1.6.3 2.5.3s1.7-.1 2.5-.3V19H17.5v-4.2c1-1.1 1-2.6 1-4.3Z"/><circle cx="15.5" cy="10" r=".9" fill="currentColor"/><path d="M9 5.5C9 4 10 3 11.5 3"/>' },
    { k: 'fiado',  href: 'fiado.html',        label: 'Fiado',
      ico: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H17v3.5"/><path d="M4 6.5V18a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6.5"/><circle cx="16.5" cy="14" r="1.3" fill="currentColor"/>' },
    { k: 'deudas', href: 'financiacion.html', label: 'Deudas',
      ico: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18M7 14.5h4"/>' },
    { k: 'mas',    href: '#mas',              label: 'Más', act: 'nav-mas',
      ico: '<circle cx="6" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18" cy="12" r="1.6" fill="currentColor"/>' }
];

/** Páginas que viven dentro de "Más". */
const EXTRAS = [
    { href: 'analisis.html',    titulo: 'Análisis',          sub: 'Cómo van tus finanzas',        color: 'var(--brand-text)', soft: 'var(--brand-soft)',
      ico: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5H12Z" fill="currentColor" stroke="none"/>' },
    { href: 'ronda.html',       titulo: 'Rondas de ahorro',  sub: 'Semanas y turnos',             color: 'var(--accent)',     soft: 'var(--accent-soft)',
      ico: '<circle cx="9" cy="7.5" r="3"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20"/><path d="M16.5 4.6a3 3 0 0 1 0 5.8M21 20v-1.5a4.5 4.5 0 0 0-3-4.2"/>' },
    { href: 'presta.html',      titulo: 'Préstamos',         sub: 'Dinero que me deben',          color: 'var(--pos)',        soft: 'var(--pos-soft)',
      ico: '<path d="M12 2.5v19"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    { href: 'presupuesto.html', titulo: 'Ingresos y gastos', sub: 'Lo que entra y lo que sale',   color: 'var(--warn)',       soft: 'var(--warn-soft)',
      ico: '<path d="M3 3v18h18"/><path d="m7 14 3-4 3 3 5-6"/>' }
];

/** Cabecera: barra de marca con degradado. */
export function shellHeader(titulo) {
    return `
    <header class="appbar">
        <div class="wrap appbar-in">
            <span class="flex items-center gap-2.5 min-w-0">
                <span class="mono-tile brandmark">
                    <svg width="17" height="17" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="11" aria-hidden="true">
                        <path d="M32 12.5a19.5 19.5 0 1 0 16.9 9.8"/><path d="M59.6 26.7A28 28 0 0 0 36.9 4.4"/>
                    </svg>
                </span>
                <span class="font-extrabold text-[16px] truncate" style="letter-spacing:-.02em">${esc(titulo)}</span>
            </span>
            <button class="appbar-btn" data-act="theme" aria-label="Cambiar tema">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9Z"/></svg>
            </button>
        </div>
    </header>`;
}

/** Navegación inferior fija, igual en todas las páginas. */
export function bottomNav(activo) {
    return `
    <nav class="bnav" role="navigation" aria-label="Secciones">
        <div class="bnav-in">
            ${NAV.map(n => `
            <a href="${n.href}" ${n.act ? `data-act="${n.act}"` : ''} ${n.k === activo ? 'aria-current="page"' : ''}>
                <span class="bico">
                    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${n.ico}</svg>
                </span>
                ${n.label}
            </a>`).join('')}
        </div>
    </nav>`;
}

/** Hoja de "Más": el resto de módulos. */
export function dialogMas() {
    openDialog(`
    <h2 class="text-[19px] font-extrabold mb-1">Más</h2>
    <p class="text-[13.5px] mb-5" style="color:var(--ink-3)">Otras secciones de Caudal</p>
    <div class="gcard" style="box-shadow:none;border:1px solid var(--rule)">
        ${EXTRAS.map(x => `
        <a class="grow" href="${x.href}" style="text-decoration:none;color:inherit">
            <span class="mono-tile" style="background:${x.soft};color:${x.color}">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${x.ico}</svg>
            </span>
            <span class="flex-1 min-w-0">
                <span class="block text-[15px] font-extrabold">${esc(x.titulo)}</span>
                <span class="block text-[12.5px] mt-0.5" style="color:var(--ink-3)">${esc(x.sub)}</span>
            </span>
            <svg class="grow-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
        </a>`).join('')}
    </div>
    <button class="btn btn-outline btn-block mt-4" data-act="close-dialog">Cerrar</button>`);
}

/** Monta cabecera y navegación de una vez. */
export function mountShell(titulo, activo) {
    const host = $('#shell');
    if (host) host.innerHTML = shellHeader(titulo);
    if (!document.querySelector('.bnav')) document.body.insertAdjacentHTML('beforeend', bottomNav(activo));
}
