// Roles del personal (tabla ROL). El turista ("usuario") no entra acá: usa la app pública.
// La UI solo MUESTRA según el rol; cada permiso lo valida el backend en cada pedido.

export type Rol = 'admin' | 'creador' | 'prestador' | 'empleado';

export const ROLES: Record<Rol, { nombre: string; quien: string; puede: string[] }> = {
  admin: {
    nombre: 'Administrador',
    quien: 'Equipo técnico de Wayki Promo, con acceso total.',
    puede: ['Todo lo que hace el Ente', 'Crear y dar de baja usuarios de cualquier rol', 'Configuración y registro de actividad'],
  },
  creador: {
    nombre: 'Creador',
    quien: 'Equipo del Ente Tucumán Turismo.',
    puede: ['Dar de alta prestadores y crear sus usuarios', 'Crear, editar y aprobar cupones', 'Ver visitantes y reportes'],
  },
  prestador: {
    nombre: 'Prestador',
    quien: 'Encargado de un comercio adherido.',
    puede: ['Crear y editar los cupones de su comercio', 'Crear y editar a sus empleados', 'Ver los canjes de su comercio'],
  },
  empleado: {
    nombre: 'Empleado',
    quien: 'Personal del comercio que atiende al turista.',
    puede: ['Canjear cupones en el mostrador', 'Ver sus canjes'],
  },
};
