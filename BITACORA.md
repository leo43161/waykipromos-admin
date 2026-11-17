# Bitácora · Admin

Registro de sesiones de trabajo. Lo más nuevo arriba. Formato: fecha, qué se hizo, decisiones, pendientes.

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
