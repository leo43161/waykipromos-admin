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
app/panel/page.tsx       inicio según el rol                           → /waykipromos/admin/panel/
app/canjear/page.tsx     canjear un cupón (empleado, encargado, superadmin) → /waykipromos/admin/canjear/
app/globals.css          tokens + base (COMPARTIDO con turista/)
components/Brand.tsx     logo Wayki | PROMO (COMPARTIDO)
components/Login.tsx     formulario + usuarios de prueba (mientras `sesion` esté simulada)
components/Panel.tsx     inicio por rol; valida la sesión con GET /panel/sesion; sin sesión vuelve al login
components/Encabezado.tsx barra de arriba del panel (logo + Salir)
components/Canjear.tsx   canje: escanear o escribir → ver el cupón (validar) → canjear; errores con su detalle
components/Camara.tsx    cámara trasera + recuadro; lee el QR con BarcodeDetector o jsQR (se descarga solo si hace falta)
lib/api.ts               cliente de la API + tipos del contrato + etapas (NEXT_PUBLIC_API_ETAPAS)
lib/simulador.ts         backend simulado de los 35 endpoints del panel (conectado al simulador del turista)
lib/roles.ts             roles (códigos del contrato) y qué puede cada uno
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

1. Layout de panel (barra lateral en escritorio, navegación inferior en celular) con las secciones del rol.
2. ~~Canjear cupón~~ (hecho 2026-11-20). Falta "Mis canjes" (GET /panel/canjes) para el empleado.
3. Prestador: mis promociones (crear, publicar, pausar) + mi equipo.
4. Creador: prestadores, usuarios, visitantes, reportes, actividad.
