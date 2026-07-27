# PrestaControl

Control financiero personal en Lempiras. Aplicación web instalable (PWA) alojada en GitHub Pages,
con datos en Firebase Firestore y funcionamiento sin conexión.

## Módulos

| Archivo | Módulo | Colección en Firestore |
|---|---|---|
| `index.html` | Menú principal | — |
| `ahorro.html` | Ahorros: fondos y metas | `savings_funds`, `savings_plans` |
| `presta.html` | Préstamos | `loans` |
| `ronda.html` | Rondas de ahorro | `savings_rounds` |

## Archivos de apoyo

- `theme.css` — hoja de estilo compartida. **Obligatoria en las cuatro páginas**; sin ella el sitio se ve sin formato.
- `sw.js` — service worker (caché para uso sin conexión). Al publicar cambios grandes, sube el número de `CACHE_NAME`.
- `manifest.json` — configuración de instalación de la PWA.
- `firestore.rules` — reglas de seguridad de la base de datos.

## Interfaz

Patrón de banca móvil: barra de marca, saludo según la hora, tarjetas agrupadas con filas
y saldo a la derecha, y botón central flotante para registrar un movimiento.

El color de toda la plataforma sale de dos variables en `theme.css`:

- `--brand` — barra superior, botones principales
- `--brand-text` — acentos sobre fondo claro (flechas, enlaces, barras de progreso)
- `--accent` — botón circular central

Están definidas dos veces: en `:root` para el tema claro y en `[data-theme="dark"]` para el oscuro.
Cambiando esas seis líneas cambia toda la plataforma.

La marca es propia a propósito. Reproducir el logo, el nombre o la identidad completa de un banco
en una aplicación que maneja dinero es un problema legal y de confusión, aunque sea de uso personal.

El saludo usa el nombre guardado en **Más → Tu nombre** (queda en el dispositivo, no en la nube).

## Logros

14 logros que se calculan en el momento a partir de los movimientos: no hay campos nuevos en
Firestore ni nada que mantener sincronizado. Las fechas de desbloqueo se guardan en el navegador.

Cubren cuatro ejes: constancia de registro, montos acumulados, meses cerrados en verde y metas
cumplidas. La campana marca los que aún no has visto.

## Fondos

Un fondo es una bolsa de dinero con saldo propio. Cada movimiento guarda tipo (entrada o salida),
monto, categoría, concepto y fecha; el saldo nunca se almacena, siempre se recalcula sumando los
movimientos, así que corregir o borrar uno deja las cuentas cuadradas.

Los traspasos entre fondos se escriben con `writeBatch`: o entran las dos partes o no entra ninguna.

## Publicar

Sube los archivos a la raíz del repositorio. GitHub Pages los sirve directamente; no hay
paso de compilación ni dependencias que instalar.

## Pendiente

Las reglas de Firestore permiten lectura y escritura sin autenticación hasta 2035. Antes de usar
esto con cantidades reales conviene migrar a login con correo y contraseña y atar las reglas al UID.
