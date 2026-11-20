# Bitácora · Admin

Registro de sesiones de trabajo. Lo más nuevo arriba. Formato: fecha, qué se hizo, decisiones, pendientes.

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
