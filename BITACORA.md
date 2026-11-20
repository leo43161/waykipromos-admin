# Bitácora · Admin

Registro de sesiones de trabajo. Lo más nuevo arriba. Formato: fecha, qué se hizo, decisiones, pendientes.

---

## 2026-11-20 (noche, 3) — Visitantes + revisión contra la API y la base

**Hecho**
- `/visitantes/` (solo Ente): búsqueda, procedencia (provincias de Argentina y otros países), edad y fecha de registro;
  tabla con estadía, compañía y cupones/canjes; ficha (`?id=`) con el perfil de viaje (la encuesta). Sin correo:
  datos personales, lo justo.
- "Exportar CSV" con los mismos filtros que se ven (`lib/descargar.ts`, `GET /panel/exportar/visitantes`).
- Simulador: `GET /encuesta/opciones` (las listas de la encuesta, que ya define el contrato para el turista).
- Contrato: el ejemplo de `/encuesta/opciones` tenía ids de países que no son los de la base (Chile 43 → 53,
  Uruguay 225 → 244). Corregido en `datos.mjs` (falta republicar el artefacto, junto con `imagen_url`).

**Revisión contra la base real (`db/huakipromo.sql`)**
- Los estados del panel son los de la base: comercios `estado_autorizacion` (PENDIENTE, AUTORIZADO, RECHAZADO,
  SUSPENDIDO), promociones (BORRADOR, PUBLICADA, PAUSADA, FINALIZADA, BAJA), cupones (EMITIDO, CANJEADO, VENCIDO,
  ANULADO), usuarios (PENDIENTE, ACTIVO, BLOQUEADO, BAJA). Los ids de países y provincias del simulador son los de la base.
- La encuesta del visitante sale de `encuestas_turisticas` (edad, provincia o país, estadía, compañía, motivo, medio).
- Lo que el panel usa y la base todavía no tiene lo agrega `db/propuesta_contrato_api.sql` (no aplicado):
  `usuarios.nombre/email/ultimo_acceso`, `promociones.imagen_url`, `comercios.logo_url`, tablas `actividad` y
  `login_intentos`, la vista `vw_promociones` y los procedimientos.

---

## 2026-11-20 (noche, 2) — Usuarios y "Mi equipo"

**Hecho**
- `/usuarios/`: el Ente ve a todos (filtros por rol, estado y comercio) y crea encargados y empleados (el superadmin,
  también gente del Ente); el encargado ve "Mi equipo" y agrega empleados de su comercio.
- Alta en un diálogo: usuario sugerido a partir del nombre ("Ana Torres" → `ana.torres`), rol y comercio según quién
  crea. La contraseña temporal la genera la API y se muestra **una sola vez**, con "Copiar usuario y contraseña".
- "Gestionar": datos, editar (nombre, correo, teléfono, rol dentro del mismo ámbito), bloquear, activar, dar de baja y
  contraseña nueva, cada acción con su confirmación. A uno mismo y a quien no administra no se lo puede tocar.
- Ficha del comercio: botón "Agregar persona" → `/usuarios/?nuevo&comercio_id=N` (circuito alta de comercio → su encargado).
- `lib/roles.ts`: `ADMINISTRA` (quién crea a quién) y `nombrePara` en `SECCIONES` ("Mi equipo" para el encargado).
- **Corregido**: los `<select>` con valor inicial perdían la opción si la lista llegaba después de abrir el formulario
  (el alta podía quedar para otro comercio). Usuarios usa un valor controlado; los formularios de comercio y promoción
  esperan a tener las listas.
- Verificado en el navegador: alta desde la ficha del comercio, usuario repetido, bloquear/activar, cambiar rol,
  contraseña nueva, **ingreso del usuario creado con su contraseña temporal**, y "Mi equipo" del encargado. 42 chequeos.

---

## 2026-11-20 (noche) — Promociones (Ente y encargado)

**Hecho**
- `/promociones/`: el Ente ve las de todos (filtro por comercio); el encargado, "Mis promociones". Búsqueda, estado,
  categoría y paginado.
- Ficha (`?id=`): foto con el beneficio encima, si se ve o no en la app, cifras (cupos, guardados, canjes, quedan),
  detalle y foto. Botones según los pasos del contrato (publicar, pausar, volver a publicar, finalizar, dar de baja),
  cada uno con su explicación y confirmación; el Ente puede dejar un motivo y destacar.
- Crear/editar (`?nueva`, `?id=&editar`): beneficio (modalidad o personalizado), fechas, cupos, días, horario,
  categoría, foto y destacada (Ente). "Guardar como borrador" o "Publicar". Errores por campo de la API.
- `dias()` en `lib/formato.ts` ("de lunes a viernes"), también en Canjear.
- Verificado en el navegador como Ente (pausar con motivo, volver a publicar, destacar, crear con errores y publicada con
  días y horario) y como encargado (solo las suyas, sin comercio ni destacar, la ajena da "no existe", Comercios
  lo devuelve al inicio). 42 chequeos. Build ok.

---

## 2026-11-20 (tarde) — Marco del panel, inicio con resumen y Comercios (Ente)

**Hecho**
- `app/(panel)/layout.tsx` + `components/Marco.tsx`: sesión una sola vez (`useSesion()`), barra con quién está y
  "Salir", menú por rol (a la izquierda en escritorio, franja deslizable en el celular) y corte de las rutas que el
  rol no tiene. Las secciones salen de `SECCIONES` en `lib/roles.ts`. Se borró `Encabezado.tsx`.
- Inicio (`GET /panel/resumen`): Ente y encargado ven el período (7/30/90 días): cifras, gráfico diario de cupones y
  canjes (`GraficoDiario.tsx`: colores validados con el validador de dataviz, cursor con el valor del día, flechas
  del teclado y tabla), categorías, promociones más elegidas y últimos movimientos. El empleado, sus canjes de hoy.
- Comercios (`/comercios/`, `?id=` para la ficha): búsqueda, filtros por estado y categoría, paginado; ficha con
  cifras, datos, logo y equipo; alta y edición con los errores por campo de la API; suspender (con motivo) y reactivar.
- Comunes: `lib/useCarga.ts` (carga + 401 → login), `lib/formato.ts`, `Dialogo.tsx`, `Gestion.module.css`.
- Verificado en el navegador (build servido estático): inicio, gráfico, comercios, alta con errores, suspender y
  reactivar. 42 chequeos. Build ok.

**Estado de la API del backend** (pull del 2026-11-20, `cde3961`)
- Tiene rutas propias (`/admin/*`, `/comercio/*`, `/canjes/validar|confirmar`), todavía no las `/panel/*` del contrato,
  y sigue con aprobación de promociones (PENDIENTE/RECHAZADA), que el contrato sacó.
- Las rutas `/admin/*` solo piden token (no controlan el rol).
- Por eso el panel sigue 100 % con el simulador: se puede mostrar completo aunque el backend no llegue.

**Plan al 3 de diciembre**
- 21–24/11: Promociones (Ente: todas, ver, pausar, dar de baja; prestador: crear, editar, publicar, foto) y Usuarios.
- 25–27/11: Visitantes (listado y ficha), Reportes (observatorio con filtros y CSV) y Actividad.
- 28–30/11: Prestador (sus promociones, su equipo, historial de canjes) y "Mis canjes" del empleado.
- 1–2/12: pulido, prueba de punta a punta en producción y lo que el backend tenga listo encendido por etapas.

---

## 2026-11-20 — Canjear un cupón

**Hecho**
- `/canjear/` (`components/Canjear.tsx` + `Camara.tsx`): cámara trasera con recuadro para centrar el QR → valida
  (`POST /panel/canjes/validar`) → muestra el cupón con la foto arriba, beneficio, visitante, vencimiento, días, horario y
  condiciones + observaciones opcionales → **Canjear** / Cancelar (botones fijos abajo) → "¡Listo! Entregá el beneficio".
- Código a mano siempre visible (cámara sin permiso, sin https, QR dañado). Botones con los códigos de prueba mientras
  `canje` esté simulada.
- Errores con el mensaje de la API y una línea más con sus `detalles` (quién y cuándo lo canjeó, cuándo venció, qué días
  y horario vale). Reintentar solo en cortes o fallas del servidor; un reintento que vuelve `CUPON_YA_CANJEADO` por el
  mismo usuario se muestra como hecho (`SesionStaff` ahora guarda el `id`).
- QR: `BarcodeDetector` donde existe; si no, `jsqr` 1.4.0 (nueva dependencia, la misma del demo) con import dinámico.
  La cámara se apaga al salir del paso y con la pestaña oculta.
- `components/Encabezado.tsx` (logo + Salir) compartido por el inicio y el canje; botón "Canjear un cupón" en el inicio
  para empleado, encargado y superadmin.
- **Contrato**: `CuponEnMostrador.promocion` suma `imagen_url` (`datos.mjs`, `CanjesController::cupon` y `sp_canjes_validar`).
- Verificado en el navegador: válido → canjeado, los 5 códigos de prueba, reintento propio y ajeno. 42 chequeos. Build ok.

**Pendiente**
- Probar la cámara en un celular real (Android e iPhone): necesita https; en la red local por http no abre.
- "Mis canjes" del empleado y el layout con navegación.

---

## 2026-11-19 (tarde) — Simulador del panel, conectado al turista

**Hecho**
- `lib/api.ts`: cliente por etapas (como el turista) con los tipos del contrato; soporta JSON, `FormData` (imágenes)
  y CSV (`apiCsv`).
- `lib/simulador.ts`: los 35 endpoints que usa el panel (31 del panel + 4 listas), con las reglas del contrato:
  - permisos por rol y por comercio (lo ajeno da 404);
  - estados de las promociones, validaciones con un mensaje por campo y cupos;
  - canje con todos sus casos (días, horarios, comercio suspendido), reportes, actividad y CSV;
  - límite de ingresos y bloqueos que valen al instante.
- **Conexión con la app del turista** por el almacenamiento compartido (mismo dominio en producción): el panel valida
  y canjea los cupones que guardó el turista y ve sus encuestas; el turista ve el cupón "Usado" (y se refresca solo
  si las dos están abiertas en pestañas).
- Login con usuarios de prueba (`wayki2026`) y "Reiniciar datos de prueba". `lib/roles.ts` con los códigos;
  `lib/sesion.ts` usa la API (token en `sessionStorage`, `validarSesion` con `GET /panel/sesion`).
- `pruebas/simulador.mjs`: 41 chequeos de punta a punta con los dos simuladores. Todos bien. Build ok.
- Deploy: `NEXT_PUBLIC_API_URL` (`/v1`) y `NEXT_PUBLIC_API_ETAPAS` (Variable del repo) en el yml.

**Decisiones**
- Los usuarios de prueba se muestran también en producción mientras la etapa `sesion` esté simulada: es la única
  forma de probar el circuito turista → panel, que solo anda con el mismo dominio.
- Las imágenes se achican a 600 px y se guardan como data URL (en la API real van a 1200 px a una carpeta).
- Lo que se crea en el panel no aparece en el catálogo simulado del turista (ese catálogo es fijo); solo se
  comparten los cupones y los canjes.

**Pendiente**
- Pantallas: layout del panel y "Canjear cupón" primero.

---

## 2026-11-19 — Contrato de la API (todo lo que el panel va a pedir)

**Hecho**
- `api-doc/contrato-api.html` (artefacto "Contrato API Wayki Promo") + `api-doc/openapi.yaml`: 46 endpoints de
  las 2 apps; 31 son del panel (`/auth/login` y `/panel/…`): sesión, resumen por rol, canje en 2 pasos, promociones,
  comercios, usuarios, visitantes, reportes, actividad y exportar CSV. Con ejemplos reales, roles y errores.
- Con PHP y SQL sugeridos para el backend, probados de punta a punta en local (copia de la base + la API con
  esos controladores + curl).

**Decisiones**
- Roles: los códigos de la API (`superadmin`, `admin_ente`, `encargado`, `empleado`) en la base y el JWT; el panel
  muestra Administrador, Creador, Prestador, Empleado.
- Promociones **sin aprobación**: el prestador publica; el Ente pausa o da de baja. No hay PENDIENTE ni RECHAZADA.
- Token del panel: 12 h, en `sessionStorage`; `GET /panel/sesion` al abrir. Contraseña temporal la genera la API.
- Solo superadmin crea usuarios del Ente.

**Pendiente**
- Simulador del panel con los ejemplos del contrato; después, las pantallas.
- `lib/roles.ts` y `lib/sesion.ts` todavía usan los nombres de pantalla y el contrato viejo (`/staff/login`).

---

## 2026-11-16 — Un solo panel para el personal + login

**Hecho**
- `administracion/` pasa a ser `admin/` y absorbe a `prestador/` y `empleado/` (borrados; eran portadas base).
  Sus reglas (canje, ciclo del cupón) quedaron en `CLAUDE.md`.
- Deploy a `/waykipromos/admin/`: `deploy.yml` (app `admin`) y `descomprimir.php` con 2 destinos.
- Roles `admin`, `creador`, `prestador`, `empleado` en `lib/roles.ts`.
- Login (`/`): escena oscura del kit (sol, lomas, Wayki) + formulario usuario/contraseña con "Mostrar".
- `/panel/`: saludo y lo que puede hacer cada rol (secciones "en construcción").
- Accesos de prueba por rol solo en `npm run dev` (verificado: el build no los incluye).
- Verificado: build con y sin `basePath` (/waykipromos/admin); login de prueba → panel en el navegador.

**Decisiones**
- Sin servidor, `ingresar()` falla con "el ingreso todavía no está habilitado"; el contrato está en `lib/sesion.ts`.
- Se ingresa con **usuario** (no correo) porque `USUARIO` solo tiene `nombreu`.
- Contraseña olvidada: la restablece quien creó la cuenta (no hay correo para recuperar).

**Pendientes**
- Backend de login (`POST /staff/login`) y `USUARIO.password` a `VARCHAR(255)` para el hash.
- Confirmar qué significa "un solo empleado por cupón" (ver `CLAUDE.md`).
- Layout del panel y secciones por rol.

---

## 2026-11-13 — Deploy a cPanel con GitHub Actions

**Hecho**
- Deploy automático a `/waykipromos/administracion/` dentro del sitio principal (tucumanturismo.gob.ar).
- `basePath` desde `NEXT_PUBLIC_BASE_PATH` en `next.config.ts` (vacío en desarrollo) y `lib/asset.ts` (compartido)
  para los `<img>` de `public/`.
- `.github/workflows/deploy.yml`: build → ZIP → FTP a `waykipromos/_deploy/<app>/` → `descomprimir.php` lo extrae.
  Basado en el yml del proyecto principal; el secreto viaja en una cabecera, no en la URL.
- Verificado: `npm run build` con el basePath de producción, sin rutas `/_next/` sueltas en el HTML.

**Pendientes**
- Crear el repo y cargar los secrets (ver `deploy/README.md` en la raíz).
- Subir `deploy/descomprimir.php` al servidor con el secreto (una sola vez para los 4 proyectos).

---

## 2026-11-12 — Base del proyecto

**Hecho**
- Proyecto Next.js 16.4.6 + React 19.3 + TypeScript con `output: 'export'`, `trailingSlash`, imágenes sin optimizar.
- Tokens y clases base del demo (`app/globals.css`) y componente `Brand` (compartidos con los otros 3 proyectos).
- Metadata con `noindex, nofollow` (panel interno), favicon de Wayki, fuente Montserrat.
- Portada provisoria con la ilustración del rol y las secciones del demo.
- Verificado: `npm run build` OK.

**Pendientes**
- Autenticación del personal (`USUARIO` + `ROL`) y backend.
- Decidir si el superadministrador vive acá o en un proyecto aparte.
- Construir las secciones (ver `CLAUDE.md` → Próximos pasos).
