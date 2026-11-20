// Sesión del personal (contrato: POST /auth/login y GET /panel/sesion, etapa "sesion" de lib/api.ts).
// Mientras esa etapa no use la API real, la responde lib/simulador.ts con los usuarios de prueba.
// El token (12 h) vive en sessionStorage: se borra al cerrar la pestaña. El rol y el comercio que se muestran salen
// de la API; los permisos de verdad los valida el backend en cada pedido.

import { api, ErrorApi, type LoginApi, type Rol, type UsuarioSesionApi } from './api';

export type SesionStaff = {
  id: number;
  usuario: string;
  nombre: string;
  rol: Rol;
  prestador?: string; // nombre del comercio (prestador y empleado)
  comercioId: number | null;
};

const K_TOKEN = 'wayki-admin-token';
const K_SESION = 'wayki-admin-sesion';

const aSesion = (u: UsuarioSesionApi): SesionStaff => ({
  id: u.id,
  usuario: u.usuario,
  nombre: u.nombre,
  rol: u.rol,
  prestador: u.comercio?.nombre,
  comercioId: u.comercio?.id ?? null,
});

/** Vencimiento (ms) leído del claim `exp` del propio JWT. */
function venceEn(token: string): number {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const exp = JSON.parse(atob(b + '='.repeat((4 - (b.length % 4)) % 4))).exp;
    return typeof exp === 'number' ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

function guardar(token: string | null, sesion: SesionStaff | null) {
  try {
    if (token && sesion) {
      sessionStorage.setItem(K_TOKEN, token);
      sessionStorage.setItem(K_SESION, JSON.stringify(sesion));
    } else {
      sessionStorage.removeItem(K_TOKEN);
      sessionStorage.removeItem(K_SESION);
    }
  } catch {
    // storage bloqueado: la sesión no se recuerda
  }
}

/** Token vigente (o null). Va en Authorization: Bearer de cada pedido. */
export function getToken(): string | null {
  try {
    const token = sessionStorage.getItem(K_TOKEN);
    return token && venceEn(token) > Date.now() ? token : null;
  } catch {
    return null;
  }
}

/** Sesión guardada, sin preguntar a la API (para pintar en el acto). */
export function getSesion(): SesionStaff | null {
  if (!getToken()) return null;
  try {
    return JSON.parse(sessionStorage.getItem(K_SESION) ?? 'null');
  } catch {
    return null;
  }
}

/** POST /auth/login. Tira ErrorApi con el mensaje ya escrito (credenciales, bloqueado, demasiados intentos…). */
export async function ingresar(usuario: string, password: string): Promise<SesionStaff> {
  const r = await api<LoginApi>('sesion', 'POST', '/auth/login', { cuerpo: { usuario, password } });
  const sesion = aSesion(r.usuario);
  guardar(r.token, sesion);
  return sesion;
}

/** GET /panel/sesion: confirma la sesión con la API (un bloqueo o un cambio de rol se ven al instante). */
export async function validarSesion(): Promise<SesionStaff | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const sesion = aSesion(await api<UsuarioSesionApi>('sesion', 'GET', '/panel/sesion', { token }));
    guardar(token, sesion);
    return sesion;
  } catch (e) {
    if (e instanceof ErrorApi && (e.http === 401 || e.http === 403)) {
      guardar(null, null);
      return null;
    }
    return getSesion(); // sin conexión: seguimos con lo guardado
  }
}

/** Con un JWT sin estado no hace falta endpoint: se borra el token. */
export function salir() {
  guardar(null, null);
}
