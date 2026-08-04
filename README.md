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
de fondo o pulpería, ninguna fecha, ningún movimiento individual. En el plan gratuito de Google los
datos enviados pueden usarse para entrenar sus modelos; por eso el resumen va anonimizado y el
análisis principal no depende de la IA.

## Colores

Tres variables en `theme.css`, definidas dos veces (`:root` para claro, `[data-theme="dark"]` para oscuro):

- `--brand` — barra superior y botones principales
- `--brand-text` — acentos sobre fondo claro
- `--accent` — botón circular central

## Pendiente

Las reglas de Firestore permiten lectura y escritura sin autenticación hasta 2035. Ahora que hay
más datos personales — ingresos, gastos, deudas — conviene migrar a login con correo y contraseña
y atar las reglas al UID.
