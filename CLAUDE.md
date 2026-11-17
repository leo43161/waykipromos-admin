# Admin — panel del personal de Wayki Promo

Leé también `../../CLAUDE.md` (reglas generales: export estático, seguridad, marca, cómo leer el demo).

Un solo panel para todo el personal, publicado en **`/waykipromos/admin/`**. Ingreso con usuario y
contraseña (tabla `USUARIO`, campo `nombreu`); lo que se ve depende del **rol** (`lib/roles.ts`):

| Rol | Quién | Referencia en el demo |
|---|---|---|
| `admin` | Equipo técnico, acceso total | (superadmin del mockup anterior) |
| `creador` | Equipo del Ente | rol `ente` (`window.WaykiBusiness`, buscar `isEnte`) |
| `prestador` | Encargado del comercio | rol `prestador` |
| `empleado` | Personal que canjea en el mostrador | rol `operador` (`renderScanner`, `validateCode`, `confirmRedeem`) |

## Comandos

```bash
npm install
npm run dev     # http://localhost:3001  (en desarrollo aparecen botones para entrar con cada rol sin servidor)
npm run build   # out/ + chequeo de tipos
```

## Estructura

```
app/layout.tsx           metadata (noindex, nofollow), fuentes Montserrat + Anton, skip-link
app/page.tsx             login (escena oscura del kit + formulario)   → /waykipromos/admin/
app/panel/page.tsx       inicio según el rol                           → /waykipromos/admin/panel/
app/globals.css          tokens + base (COMPARTIDO con turista/)
components/Brand.tsx     logo Wayki | PROMO (COMPARTIDO)
components/Login.tsx     formulario + accesos de prueba (solo `npm run dev`)
components/Panel.tsx     inicio por rol; sin sesión vuelve al login
lib/roles.ts             roles y qué puede cada uno
lib/sesion.ts            sesión del personal + contrato TODO(backend) del login
lib/asset.ts             antepone el basePath (COMPARTIDO)
```

## Reglas de este proyecto

- Panel interno: **siempre `noindex`**; no agregar sitemap ni robots indexables.
- **La UI solo muestra según el rol.** Cada pedido lo autoriza el backend (rol y prestador salen de la
  sesión en el servidor, nunca de lo que mande el cliente). Un prestador/empleado opera **solo su comercio**.
- Cada sección = una ruta estática (`app/cupones/page.tsx`, etc.). Detalle por id: query string
  (`/cupones/?id=…`) leída en el cliente.
- Acciones sensibles (aprobar/rechazar cupón, suspender prestador, autopublicación, crear usuarios o
  cambiar roles) se ejecutan y validan en el **backend**, quedan auditadas y piden confirmación en la UI.
- Ciclo de un cupón: BORRADOR → PENDIENTE → PUBLICADA / RECHAZADA → INACTIVA / FINALIZADA.
- **Canje (empleado)**: ingresar/escanear código → verificar → confirmar (definitivo). Resultados: válido ·
  ya utilizado · vencido · de otro comercio · inexistente · sin conexión. Transacción atómica e idempotente en
  el backend; la UI nunca marca un canje por su cuenta ni reintenta a ciegas. Cámara: `getUserMedia` (HTTPS)
  y `BarcodeDetector` primero; una librería de QR solo si hace falta para iOS.
  Códigos de prueba del demo: `WAYKI25` disponible, `USADO01` canjeado, `VENC001` vencido, `AJENO01` de otro comercio.
- Exportar CSV: neutralizar fórmulas (`=`, `+`, `-`, `@` al inicio de celda), como el demo.
- Datos de visitantes = datos personales: mostrar solo lo necesario.

## Decisiones pendientes

- "Un solo empleado por cupón" (pedido del 2026-11-16): ¿cada canje lo registra un empleado
  (`ADQUIERE.idusuariocanje`, ya está en el modelo) o cada cupón se asigna a un empleado que es el único que
  puede canjearlo? Confirmar antes de armar "Mi equipo".
- ¿Quién crea usuarios `creador`? Hoy: solo `admin`.

## Próximos pasos sugeridos

1. Layout de panel (barra lateral en escritorio, navegación inferior en celular) con las secciones del rol.
2. Empleado: pantalla "Canjear cupón" (lo más usado, celular primero).
3. Prestador: mis cupones (crear/editar, enviar a revisión) + mi equipo.
4. Creador: cola de aprobación, prestadores, usuarios.
