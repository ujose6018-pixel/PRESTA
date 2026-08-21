# Caudal

Control financiero personal en Lempiras. Aplicación web instalable (PWA) sobre GitHub Pages,
con datos en Firebase Firestore y funcionamiento sin conexión. Sin paso de compilación.

## Páginas

| Archivo | Módulo | Colección |
|---|---|---|
| `index.html` | Panel de control | — |
| `ahorro.html` | Fondos, metas y logros | `savings_funds`, `savings_plans` |
| `fiado.html` | Crédito en pulpería | `credit_accounts` |
| `financiacion.html` | Artículos en cuotas | `financed_items` |
| `presupuesto.html` | Ingresos, gastos y situación laboral | `budget_profile/main` |
| `analisis.html` | Evaluación financiera | lee todas |
| `presta.html` | Préstamos otorgados | `loans` |
| `ronda.html` | Rondas de ahorro | `rounds` |

## Nombre e ícono

El nombre está en una sola constante: `APP` en `core.js`. Cambiándola ahí y en `manifest.json`
se renombra toda la aplicación.

Los íconos están en `icons/` y se generan desde `icons/mark.svg` (anillo con un segmento
desprendido — la composición del patrimonio, que es lo que la app muestra). Ya no se depende
de ningún CDN externo, así que el ícono funciona sin conexión. Incluye versiones `maskable`
para Android, `apple-touch-icon` para iOS y accesos directos en el manifiesto.

## Dónde está el dinero

Cada fondo lleva un campo `place` con cuatro valores: `efectivo`, `banca`, `ahorro`,
`billetera`. Los fondos creados antes de este cambio no tienen el campo y se tratan como
efectivo, así que nada se rompe.

El reparto se muestra en el panel y en ahorros. El análisis lo usa para avisar si tienes
demasiado en físico: más del 60% del ahorro en efectivo, con más de L 3,000, dispara una
recomendación. Los cuatro lugares cuentan igual para el colchón de emergencia — todos son
dinero disponible; la diferencia es el riesgo de pérdida o robo, no la liquidez.

## Rondas: ahorro que se vuelve deuda

Una ronda cambia de naturaleza a mitad de camino y el modelo lo refleja:

| Estado | Cuándo | Qué representa |
|---|---|---|
| `ahorrando` | Antes de cobrar el bote | **Activo.** Lo aportado se recupera en tu turno |
| `pagando` | Ya cobraste el bote | **Pasivo.** Lo que falta por aportar es deuda |
| `terminada` | Todas las semanas pagadas | Saldada en cero: aportaste y cobraste lo mismo |

El cambio lo dispara la fecha del turno, y el campo `received` permite forzarlo a mano desde el
botón "Ya cobré el bote".

**Aporte parcial.** El campo `share` (0 a 1) guarda qué fracción de la cuota pagás. Si pagás la
mitad, aportás la mitad cada semana y recibís la mitad del bote — las dos cosas se escalan juntas.
El último valor usado queda promediado en `localStorage` como sugerencia para las próximas rondas.

**Cómo se conecta con Financiación.** Las cuotas de ronda **no se copian** a `financed_items`.
`financiacion.html` lee la colección `rounds` y las muestra derivadas, solo cuando el estado es
`pagando`. Marcar una semana desde ahí escribe en el mismo documento de la ronda, así que las dos
páginas nunca pueden desincronizarse. Duplicar los datos habría sido más simple de escribir y
mucho peor de mantener.

El cálculo vive completo en `rondaInfo()` dentro de `core.js`, y lo usan `ronda.html`,
`financiacion.html`, `analisis.js` y el panel. Una sola fuente de verdad.

## Criptomonedas

Es un **tipo de fondo más**, no una sección aparte: `Ahorros › Fondos › Nuevo fondo › Criptomoneda`.
El formulario pide billetera, moneda y cantidad, y a partir de ahí los depósitos y retiros funcionan
igual que en cualquier otro fondo.

```js
// dentro de savings_funds
{ name: 'BTC en Binance', place: 'cripto',
  coinId: 'bitcoin', symbol: 'BTC', wallet: 'Binance',
  movements: [ { type: 'in', amount: 0.005, ... } ] }   // ¡en MONEDAS, no en lempiras!
```

**Cuidado con esto:** en un fondo de cripto los `movements` están en cantidad de monedas.
Sumarlos junto a los demás fondos daría que 0.005 BTC son L 0.005. Por eso todo lo que agregue
saldos pasa por `fondoEnLempiras(f, saldo, cot)`, que valora solo si `place === 'cripto'`.

**APIs, gratis y sin llave:**

| Dato | Principal | Respaldo |
|---|---|---|
| Precios | CoinGecko `simple/price` | Binance `ticker/24hr` |
| Dólar a lempira | exchange-api por jsDelivr | `open.er-api.com` |
| Buscar monedas | CoinGecko `search` | — |

Una sola llamada por minuto con todas las monedas juntas, y se detiene si la pestaña no está a la
vista. Si falla la red, `cotizar()` devuelve el último precio guardado marcado `fresco: false`.

**En el análisis:** la cripto queda fuera del ahorro estable (`ahorroTotal`) pero entra completa en
el patrimonio. Como colchón de emergencia, las estables cuentan enteras y las volátiles a la mitad.

## Dos clases de deuda

El módulo de Deudas maneja cosas que se comportan distinto:

| | Artículo financiado | Deuda personal |
|---|---|---|
| Colección | `financed_items` | `personal_debts` |
| Estructura | Cuotas fijas numeradas | Monto abierto con abonos |
| Fechas | Día de corte mensual | Una fecha acordada, opcional |
| Pagos | Marcar cuota N | Abonar lo que se pueda |
| Cuota mensual | Suma | No suma (no tiene cuota fija) |

La deuda personal se modela así:

```js
{
  person: 'Mi mamá',
  concept: 'Para la moto',      // opcional
  amount: 5000,
  date: '2026-06-01',
  dueDate: '2026-12-01',        // opcional; si está, avisa 5 días antes
  payments: [{ id, amount, date, note }]
}
```

El saldo nunca se guarda: se recalcula restando los abonos del monto. Un abono mayor al saldo pide
confirmación pero se permite, y el saldo queda en cero, nunca negativo.

Ambas suman a la deuda total y al patrimonio. La diferencia está en la cuota mensual: un artículo
financiado tiene cuota fija y entra en el cálculo; una deuda personal no, porque abonás lo que
podés. Un compromiso con fecha vencida sí baja la puntuación de puntualidad.

## Titularidad: lo que administrás para otros

No todo el dinero que pasa por la app es tuyo. Dos casos reales:

- Una cuenta de **fiado** abierta a nombre de otra persona, donde solo llevás el control de lo que
  esa persona debe.
- Un **préstamo** hecho con capital que puso un tercero, donde el rédito es de esa persona y vos
  solo administrás.

Ambos documentos llevan dos campos:

```js
fondeo: 'mio' | 'tercero'   // ausente = 'mio', así los registros viejos no se rompen
fondeoNombre: 'Don Beto'    // de quién es, solo cuando es de tercero
```

**Qué cambia cuando es de tercero:**

| | Propio | De tercero |
|---|---|---|
| Patrimonio | Suma / resta | Queda fuera |
| Deuda total | Suma | Queda fuera |
| Ingreso por interés | Rédito menos comisión | Solo tu comisión (normalmente 0) |
| Cuotas atrasadas | Bajan tu puntuación | Solo avisan, no puntúan |
| Área de cartera | Se evalúa | No aplica |

La comisión cambia de sentido según el caso, y por eso el cálculo es uno solo:

```js
const factorMio = (p) => esTercero(p) ? comision(p)/100 : 1 - comision(p)/100;
```

Con capital propio, la comisión es lo que se lleva el intermediario y se descuenta. Con capital
ajeno, la comisión es lo único que te queda a vos. El resto va para quien puso el dinero.

Las listas se muestran separadas: "Con mi capital" y "Préstamos que administro", "Mis pulperías" y
"Cuentas que administro". El análisis tiene un bloque aparte, "Lo que administro", que deja claro
que ese dinero no cuenta en tus números.

## Publicar una versión nueva

**No basta con subir los archivos.** El navegador puede quedarse con el JavaScript viejo y cargarlo
junto al HTML nuevo, lo que produce errores del tipo `does not provide an export named 'X'`.

Antes de subir, corré:

```bash
python3 publicar.py 8      # el número que siga
```

Eso le pone `?v=8` a `core.js`, `analisis.js` y `theme.css` en todas las páginas, y deja `sw.js`
con el mismo número. Como la URL cambia, servir la versión anterior es imposible.

**La versión tiene que ser la misma en todos lados.** Si una página pide `core.js?v=8` y otra
`core.js?v=7`, el navegador los trata como dos módulos distintos, carga `core.js` dos veces y
Firebase se inicializa dos veces — que es justo el error que deja la pantalla de carga colgada.
El script se encarga de eso, por eso conviene usarlo en vez de editar a mano.

El service worker además:

- Usa `skipWaiting()` y `clients.claim()`, para tomar control sin esperar a que cierres las pestañas.
- Pide los archivos propios con `cache: 'no-store'`, para que el caché HTTP del navegador no
  devuelva código viejo detrás de la estrategia de red primero.
- Cachea los archivos uno por uno en vez de con `addAll()`, que falla entera si falta uno solo.

## Regla importante

Ninguna página que importe `core.js` debe inicializar Firebase por su cuenta. `core.js` ya llama a
`initializeApp`, `getFirestore` y `enableIndexedDbPersistence`. Hacerlo dos veces lanza un error
**síncrono** (`Firestore ya arrancó`) que mata el módulo antes de que registre nada, y la pantalla
de carga se queda colgada para siempre.

Las páginas nuevas importan todo de `core.js`. `presta.html` y `ronda.html` son las únicas con su
propia inicialización, y por eso **no** deben importar `core.js`.

Todas las páginas con módulo llevan un script clásico de respaldo: si el módulo falla o la carga
pasa de 15 segundos, muestra un mensaje con botón de reintentar en vez de dejar el esqueleto girando.

## Archivos compartidos

- `core.js` — Firebase, formato de moneda y fechas, diálogos, avisos, tema, efectos. **Todas las páginas dependen de esto.**
- `analisis.js` — motor de puntuación financiera.
- `theme.css` — sistema de diseño. Sin él, el sitio se ve sin formato.
- `sw.js` — caché para uso sin conexión. Al publicar cambios, sube el número en `CACHE_NAME`.

## Cómo funcionan los módulos nuevos

**Fiado.** Cada pulpería es una cuenta con una lista de movimientos. Los cargos suman, los abonos
restan, y el total se recalcula siempre desde la lista — nunca se guarda un saldo. Eso significa que
corregir o borrar un movimiento deja las cuentas cuadradas solas. "Cancelar todo" registra un abono
por el saldo exacto y conserva el historial.

**Financiación.** Guardas el total, el número de cuotas, el día de pago y la fecha de la primera.
Las fechas de las demás se calculan: si el día de pago es 31 y el mes tiene 30, cae el último día del
mes. La alerta aparece 5 días antes (`AVISO_DIAS` en el archivo) y el aviso al abrir la aplicación
sale una vez al día por cuota.

**Presupuesto.** Todo se normaliza a monto mensual: quincenal ×2, semanal ×4.33, anual ÷12. La
situación laboral cambia el estándar del análisis — con ingresos variables se exigen 6 meses de
colchón en vez de 3.

## Análisis financiero

Se calcula en el teléfono, sin internet y sin costo. Puntúa 0–100 combinando cinco áreas:
colchón de emergencia (25%), nivel de deuda (25%), puntualidad en pagos (20%), capacidad de
ahorro (20%) y constancia en el registro (10%). Si hay préstamos activos aparece una sexta área,
cartera de préstamos (15%), y los pesos de las demás se reajustan para seguir sumando 100.

### Cómo entra el dinero prestado

El capital que te deben es un **activo**, no un pasivo — un pasivo es lo que tú debes. Entra así:

- **Patrimonio neto**: cuenta completo. `efectivo + capital prestado − deudas`.
- **Colchón de emergencia**: cuenta solo al 35%, y ese porcentaje baja si hay cuotas sin cobrar.
  El motivo es que no puedes usar mañana un dinero que está en la calle. La página muestra
  el colchón total y el colchón solo en efectivo por separado.
- **Ingresos**: el interés esperado sí cuenta completo como ingreso pasivo mensual. Se normaliza
  según la frecuencia del préstamo (semanal ×4.33, quincenal ×2).

El área de cartera puntúa tres cosas: qué proporción de cuotas se pagan (50%), cuánto capital está
en manos de alguien atrasado (30%) y qué tan repartido está entre deudores (20%). Prestar todo a
una sola persona baja la nota aunque pague puntual.

**Capa de IA opcional.** Con una llave de Gemini se genera además una lectura escrita. La llave se
guarda en `localStorage`, nunca en el repositorio. Solo se envían totales redondeados: ningún nombre
de fondo, pulpería o deudor, ninguna fecha, ningún movimiento individual. En el plan gratuito de
Google los datos enviados pueden usarse para mejorar sus modelos; por eso el resumen va anonimizado
y el análisis principal no depende de la IA.

### Gemini · Interactions API

La llamada usa el **Interactions API**, que desde junio de 2026 reemplazó a `generateContent` como
interfaz principal de Gemini. Todo vive en `analisis.html`, en tres constantes al inicio del bloque
de IA:

```js
const GEMINI_URL      = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const GEMINI_REVISION = '2026-05-20';   // fija el esquema de la respuesta
const GEMINI_MODEL    = 'gemini-3.7-flash';
```

Diferencias frente al API anterior, por si hay que tocarlo:

| | `generateContent` (viejo) | Interactions (actual) |
|---|---|---|
| Endpoint | `/v1beta/models/{modelo}:generateContent` | `/v1beta/interactions` |
| Modelo | en la URL | campo `model` del cuerpo |
| Llave | `?key=` en la URL | header `x-goog-api-key` |
| Header extra | ninguno | `Api-Revision: 2026-05-20` |
| Respuesta | `candidates[0].content.parts[]` | `steps[]` |

La respuesta ya no trae `candidates` sino `steps`: una línea de tiempo con el razonamiento del
modelo, las herramientas que usó y la salida final. El texto está en los pasos de tipo
`model_output`, y lo extrae `textoDeInteraccion()` tomando la última tanda seguida de esos pasos.

Dos detalles importantes:

- **`store: false`.** Por defecto el API guarda cada interacción en los servidores de Google
  (1 día en el plan gratuito, 55 en el de pago). Como cada análisis es una sola pregunta sin
  seguimiento, se desactiva. Eso sí, `store: false` impide usar `previous_interaction_id` y
  `background: true` — si algún día se quiere una conversación de varios turnos, hay que
  reactivarlo o mandar el historial completo en cada llamada.
- **Sin `temperature`.** Los modelos Gemini 3.x dejaron de aceptar `temperature`, `top_p` y
  `top_k`. Si se agregan, la llamada falla.

Modelos válidos hoy: `gemini-3.7-flash` (el que usa la app), `gemini-3.5-flash-lite` (más barato),
`gemini-3.1-pro-preview` (razonamiento complejo). Los `gemini-2.x` y `gemini-1.5-x` están
deprecados y ya no funcionan.

## Colores

Tres variables en `theme.css`, definidas dos veces (`:root` para claro, `[data-theme="dark"]` para oscuro):

- `--brand` — barra superior y botones principales
- `--brand-text` — acentos sobre fondo claro
- `--accent` — botón circular central

## Pendiente

Las reglas de Firestore permiten lectura y escritura sin autenticación hasta 2035. Ahora que hay
más datos personales — ingresos, gastos, deudas — conviene migrar a login con correo y contraseña
y atar las reglas al UID.
