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
