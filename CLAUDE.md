# Admin — panel del personal de Wayki Promo

Leé también `../../CLAUDE.md` (reglas generales: export estático, seguridad, marca, cómo leer el demo).

Un solo panel para todo el personal, publicado en **`/waykipromos/admin/`**. Ingreso con usuario y
contraseña (tabla `USUARIO`, campo `nombreu`); lo que se ve depende del **rol** (`lib/roles.ts`):

| Nombre en pantalla | Código en la API/JWT | Quién | Referencia en el demo |
|---|---|---|---|
| Administrador | `superadmin` | Equipo técnico, acceso total | (superadmin del mockup anterior) |
| Creador | `admin_ente` | Equipo del Ente | rol `ente` (`window.WaykiBusiness`, buscar `isEnte`) |
| Prestador | `encargado` | Encargado del comercio | rol `prestador` |
| Empleado | `empleado` | Personal que canjea en el mostrador | rol `operador` (`renderScanner`, `validateCode`, `confirmRedeem`) |

**Contrato con la API** (qué manda y qué recibe cada pantalla): `../../api-doc/contrato-api.html` (fuente:
`api-doc/contrato/datos.mjs`). `lib/roles.ts` usa los códigos como claves.

## Datos: la API por etapas (como en el turista)

- Todo pedido pasa por `api()`/`apiLista()`/`apiCsv()` de `lib/api.ts`, con su **etapa** (`sesion`, `catalogos`,
  `canje`, `promociones`, `comercios`, `usuarios`, `ente`: los grupos del contrato). Si está en
  `NEXT_PUBLIC_API_ETAPAS`, va a la API real; si no, la responde `lib/simulador.ts` con las mismas formas, reglas y
  códigos de error. Los tipos `*Api` copian los objetos del contrato.
- **Simulador**: base de ejemplo en `localStorage` (`wayki-panel-sim`): 9 comercios, 7 usuarios, las promociones del
  catálogo del turista (mismos ids) y cupones de prueba. Usuarios de prueba en el login (contraseña `wayki2026`) y
  botón para reiniciar los datos. Mientras la etapa `sesion` esté simulada, el login los muestra también en producción.
- **Conexión con el turista**: en producción las dos apps comparten dominio y almacenamiento. El panel lee los cupones
  y encuestas del turista simulado (`wayki-sim-<sub>`) y guarda los canjes en `wayki-canjes-sim`, que la app del
  turista lee para mostrar "Usado". Por eso los ids de comercios (10–17) y promociones tienen que coincidir con
  `turista/lib/simulador.ts`. En desarrollo no anda (3015 y 3001 son orígenes distintos).

## Comandos

```bash
npm install
npm run dev                   # http://localhost:3001  (login con los usuarios de prueba del simulador)
npm run build                 # out/ + chequeo de tipos
node pruebas/simulador.mjs    # 42 chequeos del simulador, conectado al del turista (permisos, canje, reportes, CSV)
```

## Estructura

```
app/layout.tsx           metadata (noindex, nofollow), fuentes Montserrat + Anton, skip-link
app/page.tsx             login (escena oscura del kit + formulario)   → /waykipromos/admin/
app/(panel)/layout.tsx   todas las pantallas con sesión van en el grupo (panel) (no cambia la URL) → components/Marco.tsx
app/(panel)/panel/       inicio según el rol (resumen del período)     → /waykipromo/admin/panel/
app/(panel)/canjear/     canjear un cupón (empleado, encargado, superadmin)
app/(panel)/comercios/   comercios del Ente: listado, ficha (?id=), alta, edición, suspensión, logo
app/(panel)/usuarios/    usuarios (Ente: todos; encargado: "Mi equipo"); ?nuevo&comercio_id= abre el alta para un comercio
app/(panel)/promociones/ promociones (Ente: todas; encargado: las suyas): listado, ficha (?id=), ?nueva, ?id=&editar
app/globals.css          tokens + base (COMPARTIDO con turista/)
components/Brand.tsx     logo Wayki | PROMO (COMPARTIDO)
components/Login.tsx     formulario + usuarios de prueba (mientras `sesion` esté simulada)
components/Panel.tsx     inicio por rol; valida la sesión con GET /panel/sesion; sin sesión vuelve al login
components/Marco.tsx     sesión (useSesion), barra de arriba y menú por rol; corta las secciones que el rol no tiene
components/Gestion.module.css estilos comunes de las pantallas de gestión (filtros, tabla, ficha, diálogos)
components/Dialogo.tsx   ventana modal con <dialog> nativo
components/GraficoDiario.tsx cupones y canjes por día (colores validados con dataviz; cursor, flechas y tabla)
components/Comercios.tsx comercios (Ente)
components/Promociones.tsx listado, ficha y cambios de estado (pasos del contrato, con confirmación y motivo)
components/Usuarios.tsx  alta (usuario sugerido, contraseña temporal una sola vez), editar, bloquear, baja, contraseña nueva
components/FormPromocion.tsx crear/editar (beneficio, fechas, cupos, días, horario, categoría, foto, destacada)
components/Canjear.tsx   canje: escanear o escribir → ver el cupón (validar) → canjear; errores con su detalle
components/Camara.tsx    cámara trasera + recuadro; lee el QR con BarcodeDetector o jsQR (se descarga solo si hace falta)
lib/api.ts               cliente de la API + tipos del contrato + etapas (NEXT_PUBLIC_API_ETAPAS)
lib/simulador.ts         backend simulado de los 35 endpoints del panel (conectado al simulador del turista)
lib/roles.ts             roles (códigos del contrato) y SECCIONES: el menú y qué rol entra a cada ruta
lib/useCarga.ts          carga de datos de una pantalla (cargando, error, recargar; 401 → login)
lib/formato.ts           fechas (hora de Tucumán) y números
lib/sesion.ts            ingresar (POST /auth/login), getToken, getSesion, validarSesion, salir
lib/asset.ts             antepone el basePath (COMPARTIDO)
pruebas/simulador.mjs    prueba del simulador (node, sin dependencias)
```

## Reglas de este proyecto

- Panel interno: **siempre `noindex`**; no agregar sitemap ni robots indexables.
- **La UI solo muestra según el rol.** Cada pedido lo autoriza el backend (rol y prestador salen de la
  sesión en el servidor, nunca de lo que mande el cliente). Un prestador/empleado opera **solo su comercio**.
- Cada sección = una ruta estática (`app/cupones/page.tsx`, etc.). Detalle por id: query string
  (`/cupones/?id=…`) leída en el cliente.
- Acciones sensibles (pausar o dar de baja una promoción, suspender prestador, crear usuarios o cambiar roles)
  se ejecutan y validan en el **backend**, quedan en el registro de actividad y piden confirmación en la UI.
- Ciclo de una promoción (**sin aprobación del Ente**, decidido 2026-11-19): BORRADOR → PUBLICADA ⇄ PAUSADA →
  FINALIZADA; cualquiera → BAJA. El prestador publica directo; el Ente puede pausar o dar de baja cualquiera.
- **Canje (empleado)**: ingresar/escanear código → verificar → confirmar (definitivo). Resultados: válido ·
  ya utilizado · vencido · de otro comercio · inexistente · sin conexión. Transacción atómica e idempotente en
  el backend; la UI nunca marca un canje por su cuenta ni reintenta a ciegas. Cámara: `getUserMedia` (HTTPS)
  y `BarcodeDetector` donde existe (Android); si no (iPhone, Chrome de escritorio), `jsqr` con import dinámico.
  Un reintento de "Canjear" que vuelve `CUPON_YA_CANJEADO` por el mismo usuario se muestra como hecho (contrato).
  Códigos de prueba (botones en la pantalla mientras `canje` esté simulada): `WAYKI25` disponible, `USADO01`
  canjeado, `VENC001` vencido, `AJENO01` de otro comercio, `PENIA01` con días y horario. Son de Patio del Jardín.
- Exportar CSV: neutralizar fórmulas (`=`, `+`, `-`, `@` al inicio de celda), como el demo.
- Datos de visitantes = datos personales: mostrar solo lo necesario.

## Decisiones pendientes

- "Un solo empleado por cupón" (pedido del 2026-11-16): el contrato tomó la primera opción (cualquier empleado
  del comercio canjea y el canje registra quién). Si se quiere asignar cada cupón a un empleado, cambia el contrato.
- ¿Quién crea usuarios `creador`? Solo `admin` (así quedó en el contrato).

## Próximos pasos sugeridos

Hechos: marco con menú por rol, canjear, inicio con resumen, comercios, promociones, usuarios. Una sección nueva = su ruta en
`app/(panel)/` + su línea en `SECCIONES` (`lib/roles.ts`) + estilos de `Gestion.module.css`.
Plan al 3 de diciembre (ver BITACORA): promociones → usuarios → visitantes → reportes → actividad → canjes
(historial) → prestador (sus promociones y su equipo, reusando las mismas pantallas).
