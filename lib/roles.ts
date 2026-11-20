// Roles del personal. La clave es el CÓDIGO del contrato (el que va en la base y en el JWT); `nombre` es cómo se
// muestra en el panel. El turista no entra acá: usa la app pública.
// La UI solo MUESTRA según el rol; cada permiso lo valida el backend en cada pedido.

import type { Rol } from './api';

export type { Rol };

/** Pueden canjear en el mostrador (POST /panel/canjes). */
export const CANJEAN: Rol[] = ['superadmin', 'encargado', 'empleado'];

export const ROLES: Record<Rol, { nombre: string; quien: string }> = {
  superadmin: {
    nombre: 'Administrador',
    quien: 'Equipo técnico de Wayki Promo, con acceso total.',
  },
  admin_ente: {
    nombre: 'Creador',
    quien: 'Equipo del Ente Tucumán Turismo.',
  },
  encargado: {
    nombre: 'Prestador',
    quien: 'Encargado de un comercio adherido.',
  },
  empleado: {
    nombre: 'Empleado',
    quien: 'Personal del comercio que atiende al turista.',
  },
};

const ENTE: Rol[] = ['superadmin', 'admin_ente'];

/** Secciones del menú (cada una es una ruta estática). El menú y el acceso a cada ruta salen de acá. */
export const SECCIONES: { ruta: string; nombre: string; roles: Rol[]; nombrePara?: Partial<Record<Rol, string>> }[] = [
  { ruta: '/panel/', nombre: 'Inicio', roles: ['superadmin', 'admin_ente', 'encargado', 'empleado'] },
  { ruta: '/canjear/', nombre: 'Canjear cupón', roles: CANJEAN },
  { ruta: '/comercios/', nombre: 'Comercios', roles: ENTE },
  { ruta: '/promociones/', nombre: 'Promociones', roles: [...ENTE, 'encargado'] },
  { ruta: '/usuarios/', nombre: 'Usuarios', roles: [...ENTE, 'encargado'], nombrePara: { encargado: 'Mi equipo' } },
];

/** Qué roles puede crear y administrar cada uno (como ADMINISTRA en la API). La UI solo muestra; la API decide. */
export const ADMINISTRA: Partial<Record<Rol, Rol[]>> = {
  superadmin: ['superadmin', 'admin_ente', 'encargado', 'empleado'],
  admin_ente: ['encargado', 'empleado'],
  encargado: ['empleado'],
};
