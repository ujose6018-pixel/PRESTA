/* ============================================================
   Motor de análisis financiero
   Puntúa 0-100 en cinco áreas usando los datos de todos los
   módulos. Es determinista: mismos datos, mismo resultado.
   ============================================================ */
import { money, money0, cuotaDue, diasEntre, monthKey, isoToDate } from './core.js';

const cl = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
/** Interpola lineal entre dos puntos y recorta a 0-100. */
const escala = (v, malo, bueno) => cl(((v - malo) / (bueno - malo)) * 100);

export function analizar(D) {
    const { fondos = [], metas = [], fiado = [], financiado = [], presupuesto = {}, prestamos = [] } = D;

    /* --- Bases --- */
    const movs = (f) => Array.isArray(f?.movements) ? f.movements : [];
    const saldoFondo = (f) => movs(f).reduce((a, m) => a + (m.type === 'out' ? -Number(m.amount || 0) : Number(m.amount || 0)), 0);
    const ahorroTotal = fondos.reduce((a, f) => a + saldoFondo(f), 0)
        + metas.reduce((a, p) => a + (p.type === 'challenge'
            ? (p.savedItems || []).reduce((x, n) => x + Number(n), 0)
            : (p.deposits || []).reduce((x, d) => x + Number(d.amount || 0), 0)), 0);

    const deudaFiado = fiado.reduce((a, c) =>
        a + (c.entries || []).reduce((x, e) => x + (e.type === 'payment' ? -Number(e.amount || 0) : Number(e.amount || 0)), 0), 0);

    const nCuotas = (i) => Number(i.installments) || 1;
    const montoCuota = (i) => Number(i.installmentAmount) || (Number(i.total) || 0) / nCuotas(i);
    const pagadas = (i) => Array.isArray(i.paid) ? i.paid : [];
    const terminado = (i) => pagadas(i).length >= nCuotas(i);
    const activos = financiado.filter(i => !terminado(i));
    const deudaCuotas = activos.reduce((a, i) => a + Math.max(0, (Number(i.total) || 0) - pagadas(i).reduce((x, p) => x + Number(p.amount || montoCuota(i)), 0)), 0);
    const cuotaMes = activos.reduce((a, i) => a + montoCuota(i), 0);

    const deudaTotal = deudaFiado + deudaCuotas;

    /* --- Presupuesto --- */
    const aMes = (m, f) => { const v = Number(m) || 0; return f === 'semanal' ? v * 4.33 : f === 'quincenal' ? v * 2 : f === 'anual' ? v / 12 : v; };
    const ingresos = (presupuesto.ingresos || []).reduce((a, i) => a + aMes(i.amount, i.freq), 0);
    const gastos   = (presupuesto.gastos   || []).reduce((a, g) => a + aMes(g.amount, g.freq), 0);
    const disponible = ingresos - gastos;
    const empleo = presupuesto.empleo || 'independiente';
    const inestable = empleo === 'independiente' || empleo === 'sin';
    const hayPresupuesto = ingresos > 0 || gastos > 0;

    /* --- Cuotas atrasadas --- */
    let vencidas = 0, aTiempo = 0, totalMarcadas = 0;
    financiado.forEach(i => {
        for (let n = 1; n <= nCuotas(i); n++) {
            const pg = pagadas(i).find(p => Number(p.n) === n);
            const due = cuotaDue(i, n);
            if (pg) { totalMarcadas++; if (diasEntre(new Date(pg.date), due) >= 0) aTiempo++; }
            else if (diasEntre(new Date(), due) < 0) vencidas++;
        }
    });

    /* --- Meses en verde --- */
    const neto = {};
    fondos.forEach(f => movs(f).forEach(m => {
        const k = monthKey(m.date);
        neto[k] = (neto[k] || 0) + (m.type === 'out' ? -Number(m.amount || 0) : Number(m.amount || 0));
    }));
    const meses = Object.keys(neto).sort();
    const verdes = meses.filter(k => neto[k] > 0).length;
    const ultimos6 = meses.slice(-6);
    const verdes6 = ultimos6.filter(k => neto[k] > 0).length;

    /* --- Colchón: meses que aguantaría sin ingresos --- */
    const gastoRef = gastos > 0 ? gastos : (cuotaMes > 0 ? cuotaMes * 2 : 0);
    const colchon = gastoRef > 0 ? ahorroTotal / gastoRef : (ahorroTotal > 0 ? 6 : 0);

    /* ============ Puntuación ============ */
    const areas = [];

    // 1. Colchón. Con ingreso inestable se exige más.
    const metaColchon = inestable ? 6 : 3;
    areas.push({
        id: 'colchon', nombre: 'Colchón de emergencia', peso: 25,
        puntos: escala(colchon, 0, metaColchon),
        detalle: gastoRef > 0
            ? `Tu ahorro cubre ${colchon.toFixed(1)} ${colchon === 1 ? 'mes' : 'meses'} de gastos. La meta para tu caso es ${metaColchon}.`
            : 'Agrega tus gastos en el módulo de ingresos y gastos para medir esto.',
        dato: colchon
    });

    // 2. Endeudamiento sobre ingreso mensual
    const cargaDeuda = ingresos > 0 ? (deudaTotal / ingresos) : (deudaTotal > 0 ? 3 : 0);
    areas.push({
        id: 'deuda', nombre: 'Nivel de deuda', peso: 25,
        puntos: deudaTotal === 0 ? 100 : escala(cargaDeuda, 3, 0),
        detalle: deudaTotal === 0 ? 'No debes nada. Excelente.'
            : ingresos > 0
                ? `Debes ${money0(deudaTotal)}, equivalente a ${cargaDeuda.toFixed(1)} ${cargaDeuda < 2 ? 'meses' : 'meses'} de tus ingresos.`
                : `Debes ${money0(deudaTotal)}. Agrega tus ingresos para saber si es mucho o poco.`,
        dato: deudaTotal
    });

    // 3. Puntualidad de pagos
    const puntualidad = totalMarcadas + vencidas === 0 ? null : (aTiempo / (totalMarcadas + vencidas)) * 100;
    areas.push({
        id: 'puntual', nombre: 'Puntualidad en pagos', peso: 20,
        puntos: puntualidad === null ? 75 : cl(puntualidad - vencidas * 12),
        detalle: puntualidad === null ? 'Todavía no hay cuotas registradas para evaluar.'
            : vencidas > 0 ? `Tienes ${vencidas} cuota${vencidas === 1 ? '' : 's'} vencida${vencidas === 1 ? '' : 's'} sin marcar.`
            : `Pagaste ${aTiempo} de ${totalMarcadas} cuotas a tiempo. Sin atrasos.`,
        dato: vencidas
    });

    // 4. Capacidad de ahorro
    const tasa = ingresos > 0 ? (disponible / ingresos) * 100 : null;
    areas.push({
        id: 'ahorro', nombre: 'Capacidad de ahorro', peso: 20,
        puntos: tasa === null ? 50 : escala(tasa, -10, 20),
        detalle: tasa === null ? 'Agrega ingresos y gastos para calcular cuánto te queda.'
            : disponible >= 0 ? `Te sobran ${money0(disponible)} al mes, el ${Math.round(tasa)}% de lo que ganas.`
            : `Gastas ${money0(Math.abs(disponible))} más de lo que entra cada mes.`,
        dato: disponible
    });

    // 5. Constancia en el registro
    areas.push({
        id: 'constancia', nombre: 'Constancia', peso: 10,
        puntos: meses.length === 0 ? 0 : cl((verdes6 / Math.max(1, ultimos6.length)) * 70 + Math.min(30, meses.length * 5)),
        detalle: meses.length === 0 ? 'Empieza a registrar movimientos para construir tu historial.'
            : `${verdes} de ${meses.length} meses cerraron con más entradas que salidas.`,
        dato: verdes
    });

    const total = Math.round(areas.reduce((a, x) => a + x.puntos * x.peso, 0) / areas.reduce((a, x) => a + x.peso, 0));

    /* ============ Nivel ============ */
    const nivel = total >= 80 ? { txt: 'Sólidas', color: 'pos', desc: 'Tus finanzas están en buen estado.' }
                : total >= 60 ? { txt: 'Estables', color: 'pos', desc: 'Vas bien, con espacio para mejorar.' }
                : total >= 40 ? { txt: 'Ajustadas', color: 'soon', desc: 'Se sostienen, pero sin margen de error.' }
                : total >= 20 ? { txt: 'Frágiles', color: 'neg', desc: 'Hay señales que conviene atender pronto.' }
                :               { txt: 'En riesgo', color: 'neg', desc: 'Necesitas actuar sobre tu deuda y tu ahorro.' };

    /* ============ Recomendaciones ============ */
    const rec = [];
    if (vencidas > 0)
        rec.push({ p: 1, t: 'Ponte al día con las cuotas vencidas', d: `Tienes ${vencidas} cuota${vencidas === 1 ? '' : 's'} pasada${vencidas === 1 ? '' : 's'} de fecha. Los recargos por mora son el dinero más caro que vas a pagar.`, link: 'financiacion.html' });
    if (deudaFiado > 0 && ingresos > 0 && deudaFiado > ingresos * 0.15)
        rec.push({ p: 2, t: 'El fiado está creciendo', d: `Debes ${money0(deudaFiado)} en la pulpería, más del 15% de lo que ganas al mes. Conviene bajarlo antes de que se vuelva costumbre.`, link: 'fiado.html' });
    if (disponible < 0 && hayPresupuesto)
        rec.push({ p: 1, t: 'Gastas más de lo que entra', d: `Cada mes te faltan ${money0(Math.abs(disponible))}. Revisa qué gasto puedes recortar o de dónde sacar un ingreso extra.`, link: 'presupuesto.html' });
    if (colchon < 1 && gastoRef > 0)
        rec.push({ p: 2, t: 'Arma un colchón de emergencia', d: `Tu ahorro no cubre ni un mes de gastos. Empieza por juntar ${money0(gastoRef)}, aunque sea de a poco.`, link: 'ahorro.html' });
    else if (colchon < metaColchon && gastoRef > 0)
        rec.push({ p: 3, t: 'Sigue creciendo tu colchón', d: `Vas por ${colchon.toFixed(1)} meses. ${inestable ? 'Como tus ingresos varían, apunta a ' + metaColchon + ' meses.' : 'La meta son ' + metaColchon + ' meses.'} Te faltan ${money0(Math.max(0, gastoRef * metaColchon - ahorroTotal))}.`, link: 'ahorro.html' });
    if (!hayPresupuesto)
        rec.push({ p: 1, t: 'Registra tus ingresos y gastos', d: 'Sin eso no puedo medir si tu deuda es manejable ni cuánto deberías ahorrar. Es lo que más cambia el análisis.', link: 'presupuesto.html' });
    if (cuotaMes > 0 && ingresos > 0 && cuotaMes / ingresos > 0.3)
        rec.push({ p: 2, t: 'Las cuotas pesan mucho', d: `Entre todas las cuotas se van ${money0(cuotaMes)} al mes, más del 30% de tus ingresos. Evita financiar algo nuevo hasta bajar eso.`, link: 'financiacion.html' });
    if (inestable && colchon >= metaColchon && deudaTotal === 0)
        rec.push({ p: 3, t: 'Estás bien parado', d: 'Con ingresos variables, tener colchón y cero deuda es exactamente donde querés estar. Mantenlo.', link: 'ahorro.html' });
    if (ahorroTotal > 0 && metas.length === 0)
        rec.push({ p: 4, t: 'Ponle nombre a tu ahorro', d: 'Una meta concreta hace más fácil no tocar el dinero. Define para qué es lo que estás juntando.', link: 'ahorro.html' });

    rec.sort((a, b) => a.p - b.p);

    return {
        total, nivel, areas, rec: rec.slice(0, 5),
        cifras: { ahorroTotal, deudaTotal, deudaFiado, deudaCuotas, cuotaMes, ingresos, gastos, disponible,
                  colchon, metaColchon, vencidas, verdes, mesesRegistrados: meses.length, empleo, patrimonio: ahorroTotal - deudaTotal }
    };
}

/** Resumen anónimo para enviar a la IA: solo totales, sin nombres ni detalles. */
export function resumenParaIA(r) {
    const c = r.cifras;
    return {
        moneda: 'Lempiras hondureños',
        situacion_laboral: { fijo: 'trabajo fijo', independiente: 'trabaja por su cuenta, ingresos variables',
                             mixto: 'sueldo fijo más trabajos extra', sin: 'sin trabajo en este momento' }[c.empleo],
        ingreso_mensual: Math.round(c.ingresos),
        gastos_mensuales: Math.round(c.gastos),
        disponible_mensual: Math.round(c.disponible),
        ahorro_total: Math.round(c.ahorroTotal),
        deuda_fiado_pulperia: Math.round(c.deudaFiado),
        deuda_cuotas_financiadas: Math.round(c.deudaCuotas),
        cuotas_mensuales: Math.round(c.cuotaMes),
        cuotas_vencidas: c.vencidas,
        meses_de_colchon: Number(c.colchon.toFixed(1)),
        meses_registrados: c.mesesRegistrados,
        meses_cerrados_en_positivo: c.verdes,
        puntuacion_calculada: r.total
    };
}
