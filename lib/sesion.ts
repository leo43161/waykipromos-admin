// Sesión del personal — todavía SIN backend.
//
// TODO(backend) — contrato esperado:
//   POST /staff/login   body { usuario, password }   (USUARIO.nombreu)
//     200 → SesionStaff (y cookie de sesión httpOnly, Secure, SameSite=Strict)
//     401 → usuario o contraseña incorrectos (mismo mensaje para ambos casos)
//     423 → usuario desactivado o bloqueado por intentos
//   POST /staff/logout  → 204
//   GET  /staff/sesion  → 200 SesionStaff | 401
//   Contraseñas con hash lento (argon2id o bcrypt): USUARIO.password VARCHAR(45) no alcanza, pasar a VARCHAR(255).
//   Limitar intentos por usuario e IP. El rol y el prestador salen SIEMPRE de la base, nunca del cliente.
// Cuando exista: ingresar() hace el fetch con credentials: 'include' y getSesion() consulta /staff/sesion.

import type { Rol } from './roles';

export type SesionStaff = {
  usuario: string;
  nombre: string;
  rol: Rol;
  prestador?: string; // nombre del comercio (prestador y empleado)
};

const KEY = 'wayki-admin-sesion';

export async function ingresar(_usuario: string, _password: string): Promise<SesionStaff> {
  throw new Error('sin-servidor');
}

/** Solo `npm run dev`: entra con un rol de prueba para diseñar las pantallas. El build lo elimina. */
export function ingresarDePrueba(rol: Rol): SesionStaff {
  const sesion: SesionStaff = {
    usuario: `prueba.${rol}`,
    nombre: { admin: 'Equipo técnico', creador: 'Carla Ente', prestador: 'Martín Ríos', empleado: 'Lucía Suárez' }[rol],
    rol,
    prestador: rol === 'prestador' || rol === 'empleado' ? 'Patio del Jardín' : undefined,
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(sesion));
  } catch {}
  return sesion;
}

export function getSesion(): SesionStaff | null {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function salir() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}
