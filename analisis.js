/* ============================================================
   Motor de análisis financiero
   Puntúa 0-100 en cinco áreas usando los datos de todos los
   módulos. Es determinista: mismos datos, mismo resultado.
   ============================================================ */
import { money, money0, cuotaDue, diasEntre, monthKey, isoToDate, rondaInfo, esTercero } from './core.js';

const cl = (v, a = 0, b = 100) => Math.min(b, Math.max(a, v));
/** Interpola lineal entre dos puntos y recorta a 0-100. */
const escala = (v, malo, bueno) => cl(((v - malo) / (bueno - malo)) * 100);

export function analizar(D) {
    const { fondos = [], metas = [], fiado = [], financiado = [], presupuesto = {}, prestamos = [], rondas = [] } = D;

    /* --- Bases --- */
    const movs = (f) => Array.isArray(f?.movements) ? f.movements : [];
    const saldoFondo = (f) => movs(f).reduce((a, m) => a + (m.type === 'out' ? -Number(m.amount || 0) : Number(m.amount || 0)), 0);
    /* --- Rondas: cambian de naturaleza al cobrar el bote --- */
    const infoRondas = rondas.map(rondaInfo);
    const rondasAhorro = infoRondas.filter(i => i.estado === 'ahorrando');
    const rondasDeuda  = infoRondas.filter(i => i.estado === 'pagando');
    const ahorroRondas = rondasAhorro.reduce((a, i) => a + i.ahorrado, 0);
    const deudaRondas  = rondasDeuda.reduce((a, i) => a + i.deuda, 0);
    const cuotaRondas  = rondasDeuda.reduce((a, i) => a + i.cuota * 4.33, 0);   // semanal -> mensual
    const rondasAtrasadas = infoRondas.filter(i => !i.terminada && i.prox && i.prox.estado === 'late').length;

    /* Reparto por lugar: efectivo, banca, cuenta de ahorro, billetera */
    const porLugar = {};
    fondos.forEach(f => { const k = f.place || 'efectivo'; porLugar[k] = (porLugar[k] || 0) + saldoFondo(f); });
    const enFondos = fondos.reduce((a, f) => a + saldoFondo(f), 0);
    const enEfectivo = porLugar.efectivo || 0;
    const bancarizado = enFondos > 0 ? 1 - enEfectivo / enFondos : 0;

    const ahorroTotal = ahorroRondas
        + fondos.reduce((a, f) => a + saldoFondo(f), 0)
        + metas.reduce((a, p) => a + (p.type === 'challenge'
            ? (p.savedItems || []).reduce((x, n) => x + Number(n), 0)
            : (p.deposits || []).reduce((x, d) => x + Number(d.amount || 0), 0)), 0);

    /* Las cuentas de otras personas se administran pero no son deuda propia. */
    const saldoCuenta = (c) => (c.entries || []).reduce((x, e) => x + (e.type === 'payment' ? -Number(e.amount || 0) : Number(e.amount || 0)), 0);
    const deudaFiado    = fiado.filter(c => !esTercero(c)).reduce((a, c) => a + saldoCuenta(c), 0);
    const fiadoAjeno    = fiado.filter(esTercero).reduce((a, c) => a + saldoCuenta(c), 0);
    const nFiadoAjeno   = fiado.filter(esTercero).length;

    const nCuotas = (i) => Number(i.installments) || 1;
    const montoCuota = (i) => Number(i.installmentAmount) || (Number(i.total) || 0) / nCuotas(i);
    const pagadas = (i) => Array.isArray(i.paid) ? i.paid : [];
    const terminado = (i) => pagadas(i).length >= nCuotas(i);
    const activos = financiado.filter(i => !terminado(i));
    const deudaCuotas = activos.reduce((a, i) => a + Math.max(0, (Number(i.total) || 0) - pagadas(i).reduce((x, p) => x + Number(p.amount || montoCuota(i)), 0)), 0);
    const cuotaMes = activos.reduce((a, i) => a + montoCuota(i), 0) + cuotaRondas;

    const deudaTotal = deudaFiado + deudaCuotas + deudaRondas;

    /* --- Cartera de préstamos (dinero que me deben) --- */
    const perMes = (f) => f === 'quincenal' ? 2 : 4.33;   // periodos por mes
    const todosVivos = prestamos.filter(p => Number(p.currentCapital || 0) > 0);
    /* Solo el capital propio es un activo tuyo. El de terceros se administra. */
    const vivos = todosVivos.filter(p => !esTercero(p));
    const vivosAjenos = todosVivos.filter(esTercero);
    const capitalPrestado    = vivos.reduce((a, p) => a + Number(p.currentCapital || 0), 0);
    const capitalAdministrado = vivosAjenos.reduce((a, p) => a + Number(p.currentCapital || 0), 0);

    let interesMensual = 0, cuotasVencidasP = 0, cuotasPagadasP = 0, capitalEnMora = 0, proxCobro = 0;

    /* De los préstamos ajenos solo entra tu comisión, si es que cobrás alguna. */
    vivosAjenos.forEach(p => {
        const base = (Number(p.currentCapital || 0) * Number(p.interestRate || 0)) / 100;
        interesMensual += base * (Number(p.commissionRate || 0) / 100) * perMes(p.frequency);
    });

    vivos.forEach(p => {
        const cap = Number(p.currentCapital || 0);
        const tasa = Number(p.interestRate || 0);
        const base = (cap * tasa) / 100;                  // interés de un periodo
        interesMensual += base * (1 - Number(p.commissionRate || 0) / 100) * perMes(p.frequency);

        const qs = Array.isArray(p.quotas) ? p.quotas : [];
        const pend = qs.filter(q => q.status === 'pending');
        if (pend.length) proxCobro += base * (Number(pend[0].interestMultiplier) || 1);

        let venc = 0;
        qs.forEach(q => {
            if (q.status === 'paid') { cuotasPagadasP++; return; }
            if (diasEntre(new Date(), new Date(q.date + 'T12:00:00')) < 0) { venc++; cuotasVencidasP++; }
        });
        if (venc > 0) capitalEnMora += cap;
    });

    /* Los atrasos de préstamos ajenos se muestran, pero no bajan tu nota:
       el riesgo del capital no es tuyo. */
    let vencidasAjenas = 0;
    vivosAjenos.forEach(p => (Array.isArray(p.quotas) ? p.quotas : []).forEach(q => {
        if (q.status !== 'paid' && diasEntre(new Date(), new Date(q.date + 'T12:00:00')) < 0) vencidasAjenas++;
    }));

    const totalCuotasP = cuotasPagadasP + cuotasVencidasP;
    /* Salud de cobro: 1 = todos pagan puntual, 0 = nadie paga */
    const saludCobro = totalCuotasP === 0 ? (vivos.length ? 0.7 : 1) : cuotasPagadasP / totalCuotasP;
    /* Concentración: qué tanto de la cartera está en un solo deudor */
    const mayor = vivos.length ? Math.max(...vivos.map(p => Number(p.currentCapital || 0))) : 0;
    const concentracion = capitalPrestado > 0 ? mayor / capitalPrestado : 0;
    const hayCartera = vivos.length > 0;

    /* El capital prestado NO es dinero disponible: no se puede usar mañana
       en una emergencia y hay riesgo de que no lo devuelvan. Para el colchón
       cuenta con descuento, ajustado por qué tan bien le están pagando. */
    const factorLiquidez = 0.35 * saludCobro;
    const ahorroEfectivo = ahorroTotal + capitalPrestado * factorLiquidez;

    /* --- Presupuesto --- */
    const aMes = (m, f) => { const v = Number(m) || 0; return f === 'semanal' ? v * 4.33 : f === 'quincenal' ? v * 2 : f === 'anual' ? v / 12 : v; };
    const ingresosDeclarados = (presupuesto.ingresos || []).reduce((a, i) => a + aMes(i.amount, i.freq), 0);
    const gastos   = (presupuesto.gastos   || []).reduce((a, g) => a + aMes(g.amount, g.freq), 0);
    const ingresos = ingresosDeclarados + interesMensual;   // el interés es ingreso pasivo real
    const disponible = ingresos - gastos;
    const empleo = presupuesto.empleo || 'independiente';
    const inestable = empleo === 'independiente' || empleo === 'sin';
    const hayPresupuesto = ingresosDeclarados > 0 || gastos > 0 || interesMensual > 0;

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
    const colchonLiquido = gastoRef > 0 ? ahorroTotal / gastoRef : 0;
    const colchon = gastoRef > 0 ? ahorroEfectivo / gastoRef : (ahorroEfectivo > 0 ? 6 : 0);

    /* ============ Puntuación ============ */
    const areas = [];

    // 1. Colchón. Con ingreso inestable se exige más.
    const metaColchon = inestable ? 6 : 3;
    areas.push({
        id: 'colchon', nombre: 'Colchón de emergencia', peso: 25,
        puntos: escala(colchon, 0, metaColchon),
        detalle: gastoRef === 0 ? 'Agrega tus gastos en el módulo de ingresos y gastos para medir esto.'
            : hayCartera
                ? `Cubres ${colchon.toFixed(1)} de ${metaColchon} meses. En efectivo son ${colchonLiquido.toFixed(1)}: lo prestado suma poco aquí porque no lo tienes a mano.`
                : `Tu ahorro cubre ${colchon.toFixed(1)} ${colchon === 1 ? 'mes' : 'meses'} de gastos. La meta para tu caso es ${metaColchon}.`,
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
    const atrasos = vencidas + rondasAtrasadas;
    const puntualidad = totalMarcadas + vencidas === 0 ? null : (aTiempo / (totalMarcadas + vencidas)) * 100;
    areas.push({
        id: 'puntual', nombre: 'Puntualidad en pagos', peso: 20,
        puntos: puntualidad === null ? (atrasos > 0 ? cl(75 - atrasos * 15) : 75) : cl(puntualidad - atrasos * 12),
        detalle: atrasos > 0
            ? `Tienes ${atrasos} pago${atrasos === 1 ? '' : 's'} atrasado${atrasos === 1 ? '' : 's'}${rondasAtrasadas ? ` (${rondasAtrasadas} de rondas)` : ''}.`
            : puntualidad === null ? 'Todavía no hay cuotas registradas para evaluar.'
            : `Pagaste ${aTiempo} de ${totalMarcadas} cuotas a tiempo. Sin atrasos.`,
        dato: atrasos
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

    // 6. Cartera de préstamos. Solo aparece si prestas dinero.
    if (hayCartera) {
        const pCobro = saludCobro * 100;
        const pConc  = escala(concentracion, 1, 0.34);   // repartido entre 3+ deudores = ideal
        const pMora  = capitalPrestado > 0 ? escala(capitalEnMora / capitalPrestado, 1, 0) : 100;
        areas.push({
            id: 'cartera', nombre: 'Cartera de préstamos', peso: 15,
            puntos: cl(pCobro * 0.5 + pMora * 0.3 + pConc * 0.2),
            detalle: cuotasVencidasP > 0
                ? `${cuotasVencidasP} cuota${cuotasVencidasP === 1 ? '' : 's'} sin cobrar. Hay ${money0(capitalEnMora)} en manos de quien no está pagando al día.`
                : concentracion > 0.7 && vivos.length > 1
                    ? `Te pagan puntual, pero el ${Math.round(concentracion * 100)}% de tu capital está en un solo deudor.`
                    : vivos.length === 1
                        ? `Todo tu capital prestado está en un solo deudor. Si falla, falla todo.`
                        : `${vivos.length} préstamos activos, al día. Generan ${money0(interesMensual)} al mes.`,
            dato: capitalPrestado
        });
        // Se reajustan los pesos para que sigan sumando 100
        const otros = areas.filter(a => a.id !== 'cartera');
        const sobra = 85 / otros.reduce((a, x) => a + x.peso, 0);
        otros.forEach(a => a.peso = Math.round(a.peso * sobra * 10) / 10);
    }

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
    if (rondasAtrasadas > 0)
        rec.push({ p: 1, t: 'Semanas de ronda atrasadas', d: `${rondasAtrasadas} ronda${rondasAtrasadas === 1 ? '' : 's'} con semanas sin pagar. En una ronda el atraso afecta a todo el grupo, no solo a vos.`, link: 'ronda.html' });
    if (deudaRondas > 0 && ingresos > 0 && deudaRondas > ingresos)
        rec.push({ p: 2, t: 'Las rondas cobradas pesan', d: `Debés ${money0(deudaRondas)} en rondas que ya cobraste, más de un mes de ingresos. Evitá entrar a otra hasta terminar estas.`, link: 'ronda.html' });
    if (!hayPresupuesto)
        rec.push({ p: 1, t: 'Registra tus ingresos y gastos', d: 'Sin eso no puedo medir si tu deuda es manejable ni cuánto deberías ahorrar. Es lo que más cambia el análisis.', link: 'presupuesto.html' });
    if (cuotaMes > 0 && ingresos > 0 && cuotaMes / ingresos > 0.3)
        rec.push({ p: 2, t: 'Las cuotas pesan mucho', d: `Entre todas las cuotas se van ${money0(cuotaMes)} al mes, más del 30% de tus ingresos. Evita financiar algo nuevo hasta bajar eso.`, link: 'financiacion.html' });
    if (inestable && colchon >= metaColchon && deudaTotal === 0)
        rec.push({ p: 3, t: 'Estás bien parado', d: 'Con ingresos variables, tener colchón y cero deuda es exactamente donde querés estar. Mantenlo.', link: 'ahorro.html' });
    if (enEfectivo > 3000 && enFondos > 0 && enEfectivo / enFondos > 0.6)
        rec.push({ p: 3, t: 'Mucho dinero en efectivo', d: `${money0(enEfectivo)} guardados en físico, el ${Math.round(enEfectivo / enFondos * 100)}% de tu ahorro. En el banco o en billetera digital corre menos riesgo de robo o pérdida.`, link: 'ahorro.html' });
    if (ahorroTotal > 0 && metas.length === 0)
        rec.push({ p: 4, t: 'Ponle nombre a tu ahorro', d: 'Una meta concreta hace más fácil no tocar el dinero. Define para qué es lo que estás juntando.', link: 'ahorro.html' });

    if (cuotasVencidasP > 0)
        rec.push({ p: 1, t: 'Tienes cobros atrasados', d: `${cuotasVencidasP} cuota${cuotasVencidasP === 1 ? '' : 's'} de tus préstamos pasó de fecha, con ${money0(capitalEnMora)} de capital comprometido. Cobrar hoy es más barato que cobrar en tres meses.`, link: 'presta.html' });
    if (hayCartera && vivos.length === 1 && capitalPrestado > ahorroTotal)
        rec.push({ p: 2, t: 'Todo el capital en un solo deudor', d: `Tienes ${money0(capitalPrestado)} prestados a una sola persona, más de lo que tienes ahorrado. Si esa persona deja de pagar, te quedas sin nada disponible.`, link: 'presta.html' });
    else if (hayCartera && concentracion > 0.7 && vivos.length > 1)
        rec.push({ p: 3, t: 'Reparte más tu capital', d: `El ${Math.round(concentracion * 100)}% de lo que prestas está en un solo deudor. Repartirlo entre más personas baja el riesgo sin bajar el interés.`, link: 'presta.html' });
    if (hayCartera && colchonLiquido < 1 && gastoRef > 0)
        rec.push({ p: 1, t: 'Prestas más de lo que tienes a mano', d: `Tienes ${money0(capitalPrestado)} en la calle pero menos de un mes de gastos en efectivo. Si surge una emergencia no vas a poder esperar a que te paguen.`, link: 'ahorro.html' });
    if (hayCartera && interesMensual > 0 && gastos > 0 && interesMensual >= gastos)
        rec.push({ p: 4, t: 'El interés ya cubre tus gastos', d: `Los ${money0(interesMensual)} mensuales que generan tus préstamos alcanzan para tus gastos del mes. Eso es independencia, cuídala cobrando puntual.`, link: 'presta.html' });

    if (vencidasAjenas > 0)
        rec.push({ p: 2, t: 'Cobros atrasados que administrás', d: `${vencidasAjenas} cuota${vencidasAjenas === 1 ? '' : 's'} sin cobrar en préstamos de capital ajeno. No es tu plata, pero sí tu responsabilidad frente a quien la puso.`, link: 'presta.html' });

    rec.sort((a, b) => a.p - b.p);

    return {
        total, nivel, areas, rec: rec.slice(0, 5),
        cifras: { ahorroTotal, ahorroEfectivo, porLugar, enEfectivo, bancarizado, deudaTotal, deudaFiado, deudaCuotas, cuotaMes,
                  ingresos, ingresosDeclarados, gastos, disponible,
                  colchon, colchonLiquido, metaColchon, vencidas, verdes, mesesRegistrados: meses.length, empleo,
                  ahorroRondas, deudaRondas, cuotaRondas, rondasAtrasadas,
                  nRondasAhorro: rondasAhorro.length, nRondasDeuda: rondasDeuda.length,
                  capitalPrestado, capitalAdministrado, fiadoAjeno, nFiadoAjeno, vencidasAjenas,
                  nPrestamosAjenos: vivosAjenos.length,
                  administraAlgo: capitalAdministrado > 0 || fiadoAjeno > 0,
                  interesMensual, proxCobro, cuotasVencidasP, capitalEnMora,
                  concentracion, saludCobro, nPrestamos: vivos.length, hayCartera,
                  patrimonio: ahorroTotal + capitalPrestado - deudaTotal }
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
        porcentaje_del_ahorro_en_efectivo_fisico: Math.round((1 - c.bancarizado) * 100),
        capital_propio_prestado: Math.round(c.capitalPrestado),
        capital_de_otros_que_administra: Math.round(c.capitalAdministrado),
        fiado_de_otros_que_administra: Math.round(c.fiadoAjeno),
        interes_mensual_por_prestamos: Math.round(c.interesMensual),
        cuotas_de_prestamos_sin_cobrar: c.cuotasVencidasP,
        numero_de_deudores: c.nPrestamos,
        ahorro_en_rondas_antes_de_cobrar: Math.round(c.ahorroRondas),
        deuda_en_rondas_ya_cobradas: Math.round(c.deudaRondas),
        semanas_de_ronda_atrasadas: c.rondasAtrasadas,
        deuda_fiado_pulperia: Math.round(c.deudaFiado),
        deuda_cuotas_financiadas: Math.round(c.deudaCuotas),
        cuotas_mensuales: Math.round(c.cuotaMes),
        cuotas_vencidas: c.vencidas,
        meses_de_colchon_total: Number(c.colchon.toFixed(1)),
        meses_de_colchon_solo_efectivo: Number(c.colchonLiquido.toFixed(1)),
        meses_registrados: c.mesesRegistrados,
        meses_cerrados_en_positivo: c.verdes,
        puntuacion_calculada: r.total
    };
}
