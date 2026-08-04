# Mis Finanzas

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
| `ronda.html` | Rondas de ahorro | `savings_rounds` |

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
ahorro (20%) y constancia en el registro (10%).

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
