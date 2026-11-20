// Roles del personal. La clave es el CÓDIGO del contrato (el que va en la base y en el JWT); `nombre` es cómo se
// muestra en el panel. El turista no entra acá: usa la app pública.
// La UI solo MUESTRA según el rol; cada permiso lo valida el backend en cada pedido.

import type { Rol } from './api';

export type { Rol };

export const ROLES: Record<Rol, { nombre: string; quien: string; puede: string[] }> = {
  superadmin: {
    nombre: 'Administrador',
    quien: 'Equipo técnico de Wayki Promo, con acceso total.',
    puede: ['Todo lo que hace el Ente', 'Crear usuarios del Ente y otros administradores', 'Canjear cupones para probar'],
  },
  admin_ente: {
    nombre: 'Creador',
    quien: 'Equipo del Ente Tucumán Turismo.',
    puede: ['Dar de alta comercios y crear sus usuarios', 'Ver, pausar o dar de baja cualquier promoción', 'Ver visitantes, reportes y actividad'],
  },
  encargado: {
    nombre: 'Prestador',
    quien: 'Encargado de un comercio adherido.',
    puede: ['Crear y publicar las promociones de su comercio', 'Crear y administrar a sus empleados', 'Canjear cupones y ver los canjes de su comercio'],
  },
  empleado: {
    nombre: 'Empleado',
    quien: 'Personal del comercio que atiende al turista.',
    puede: ['Canjear cupones en el mostrador', 'Ver sus canjes'],
  },
};
