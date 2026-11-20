// Backend SIMULADO del panel, en el navegador, para las etapas que todavía no usan la API real (ver lib/api.ts).
// Responde con las formas, reglas y códigos de error del contrato (api-doc/contrato-api.html): las pantallas no notan
// la diferencia. ⚠️ No es seguridad: las contraseñas de prueba van en claro y el token no se firma.
//
// CONEXIÓN CON LA APP DEL TURISTA. En producción las dos apps comparten dominio (tucumanturismo.gob.ar), así que
// comparten el almacenamiento del navegador:
//   · los cupones que un turista guardó en la app simulada (`wayki-sim-<sub>`, turista/lib/simulador.ts) se validan y
//     se canjean acá, y sus encuestas aparecen en Visitantes y en los reportes;
//   · los canjes se guardan en `wayki-canjes-sim`, que la app del turista lee para mostrar el cupón como usado.
// Para eso los comercios (10 a 17) y las promociones del catálogo usan los MISMOS ids que turista/lib/simulador.ts:
// si cambian allá, cambian acá. En desarrollo no anda (3015 y 3001 son orígenes distintos).

import type {
  ActividadApi, CanjeApi, ComercioApi, CuponEnMostradorApi, EstadoComercio, EstadoPromocion, EstadoUsuario, Horario,
  ItemReporte, Meta, Metodo, ModalidadApi, Opcion, Pedido, PromocionCuerpo, PromocionGestionApi, ReporteApi, Respuesta,
  Rol, UsuarioApi, UsuarioSesionApi, VisitanteApi,
} from '@/lib/api';

// ================================================================== claves del navegador
const K_PANEL = 'wayki-panel-sim';
/** Canjes de todos los cupones (los del panel y los del turista): { [codigo]: CanjeGuardado }. */
export const K_CANJES = 'wayki-canjes-sim';
const ES_TURISTA = /^wayki-sim-\d+$/;
const VERSION = 2; // subirla cuando cambian los datos de ejemplo: la base guardada se rehace

// ================================================================== tipos internos
type ComercioFila = {
  id: number; nombre: string; categoria_id: number; direccion: string; localidad_id: number;
  email_contacto: string | null; telefono_contacto: string | null; logo_url: string | null;
  estado: EstadoComercio; motivo_estado: string | null; autorizado_el: string | null; creado_el: string;
};
type UsuarioFila = {
  id: number; usuario: string; password: string; nombre: string; email: string | null; telefono: string | null;
  rol: Rol; estado: EstadoUsuario; comercio_id: number | null; ultimo_acceso: string | null; creado_el: string;
};
type PromoFila = {
  id: number; comercio_id: number; titulo: string; descripcion: string | null; condiciones: string | null;
  categoria_id: number; modalidad_id: number; modalidad_personalizada: string | null;
  fecha_desde: string; fecha_hasta: string; dias_validos: string[] | null; horario: Horario;
  cupos_totales: number; entregados_antes: number; estado: EstadoPromocion; destacada: boolean;
  imagen_url: string | null; creado_por: number; creado_el: string; actualizado_el: string;
};
type Respuestas = { rango_edad_id: number; duracion_id: number; motivo_id: number; compania_id: number; medio_id: number; provincia_id: number | null; pais_id: number | null };
type VisitanteFila = { id: number; nombre: string; apellido: string; creado_el: string; ultimo_acceso: string | null; encuesta: Respuestas | null };
type CuponFila = { codigo: string; promocion_id: number; turista_id: number; emitido_el: string; vence_el?: string; anulado?: boolean };
type ActividadFila = { id: number; ocurrido_el: string; accion: string; descripcion: string; usuario_id: number | null; comercio_id: number | null; entidad: { tipo: string; id: number } | null };
type Base = {
  version: number; comercios: ComercioFila[]; usuarios: UsuarioFila[]; promociones: PromoFila[];
  visitantes: VisitanteFila[]; cupones: CuponFila[]; actividad: ActividadFila[];
  intentos: { usuario: string; el: number; exito: boolean }[];
};
type CanjeGuardado = { id: number; canjeado_el: string; usuario_id: number; usuario_nombre: string; observaciones: string | null };
/** Un cupón, venga del panel o de la app del turista, como lo ven las reglas. */
type Cupon = {
  codigo: string; promo: PromoFila; turista: { id: number; nombre: string }; emitido_el: string; vence_el: string;
  estado: 'EMITIDO' | 'CANJEADO' | 'VENCIDO' | 'ANULADO'; canje: CanjeGuardado | null;
};
/** Quién hace el pedido, leído del token y confirmado contra la base (como RoleMiddleware). */
type Yo = { id: number; nombre: string; rol: Rol; comercio_id: number | null };

// ================================================================== listas fijas (las de db/propuesta_contrato_api.sql)
const CATEGORIAS: Opcion[] = [{ id: 1, nombre: 'Alojamiento' }, { id: 2, nombre: 'Gastronomía' }, { id: 3, nombre: 'Actividades y experiencias' }];
const MODALIDADES: ModalidadApi[] = [
  { id: 1, nombre: '2x1', tipo: 'PROMOCION', valor: null }, { id: 2, nombre: '3x2', tipo: 'PROMOCION', valor: null },
  { id: 3, nombre: '10%', tipo: 'PORCENTAJE', valor: 10 }, { id: 4, nombre: '15%', tipo: 'PORCENTAJE', valor: 15 },
  { id: 5, nombre: '20%', tipo: 'PORCENTAJE', valor: 20 }, { id: 6, nombre: 'Personalizado', tipo: 'PERSONALIZADO', valor: null },
];
const CIRCUITOS: Opcion[] = [{ id: 1, nombre: 'Ciudad' }, { id: 2, nombre: 'Yungas' }, { id: 3, nombre: 'Valles Calchaquíes' }];
const LOCALIDADES: { id: number; nombre: string; circuito_id: number | null }[] = [
  { id: 7, nombre: 'Amaicha del Valle', circuito_id: 3 }, { id: 20, nombre: 'Colalao del Valle', circuito_id: 3 },
  { id: 26, nombre: 'El Cadillal', circuito_id: 1 }, { id: 30, nombre: 'El Mollar', circuito_id: 3 },
  { id: 60, nombre: 'Lules', circuito_id: 1 }, { id: 76, nombre: 'San Miguel de Tucumán', circuito_id: 1 },
  { id: 77, nombre: 'San Pedro de Colalao', circuito_id: 3 }, { id: 83, nombre: 'Simoca', circuito_id: null },
  { id: 86, nombre: 'Tafí del Valle', circuito_id: 3 }, { id: 87, nombre: 'Tafí Viejo', circuito_id: 1 },
  { id: 103, nombre: 'Yerba Buena - Marcos Paz', circuito_id: 2 },
];
// Nombres de las opciones de la encuesta (mismos ids que la app del turista).
const lista = (nombres: string[]) => Object.fromEntries(nombres.map((n, i) => [i + 1, n])) as Record<number, string>;
const RANGOS = lista(['Menor de 18 años', '18 a 29 años', '30 a 44 años', '45 a 59 años', '60 años o más']);
const DURACIONES = lista(['No me quedo a dormir (voy y vuelvo en el día / soy local)', '1 a 2 noches', '3 a 5 noches', '6 noches o más']);
const MOTIVOS = lista(['Vacaciones / Ocio / Recreación', 'Visita a familiares o amigos', 'Trabajo / Negocios / Congresos', 'Deporte / Eventos culturales', 'Soy residente local']);
const COMPANIAS = lista(['Solo/a', 'En pareja', 'En familia (con niños/as)', 'En familia (solo adultos)', 'Con amigos/as', 'En grupo organizado / excursión']);
const MEDIOS = lista(['Redes sociales (Instagram, TikTok, Facebook)', 'Recomendación de amigos o familiares', 'Cartelería / Vía pública / Oficinas de turismo', 'Medios tradicionales (radio, TV, diarios)', 'Buscadores de internet (Google)', 'En el propio prestador']);
const PROVINCIAS: Record<number, string> = {
  1: 'Tucumán', 2: 'Catamarca', 3: 'Salta', 4: 'Jujuy', 5: 'Buenos Aires', 6: 'Santa Cruz', 7: 'Ciudad Autónoma de Buenos Aires',
  8: 'Chaco', 9: 'Chubut', 10: 'Córdoba', 11: 'Corrientes', 12: 'Entre Ríos', 13: 'Formosa', 14: 'La Pampa', 15: 'La Rioja',
  16: 'Mendoza', 17: 'Misiones', 18: 'Neuquén', 19: 'Río Negro', 20: 'San Juan', 21: 'San Luis', 22: 'Santa Fe',
  23: 'Santiago del Estero', 24: 'Tierra del Fuego',
};
const PAISES: Record<number, string> = {
  42: 'Bolivia', 43: 'Brasil', 53: 'Chile', 60: 'Colombia', 70: 'Alemania', 80: 'España', 86: 'Francia', 122: 'Italia',
  153: 'México', 186: 'Perú', 194: 'Paraguay', 244: 'Uruguay', 245: 'Estados Unidos',
};

// ================================================================== usuarios de prueba (los muestra el login)
export const CLAVE_DE_PRUEBA = 'wayki2026';
/** Cupones de prueba (base de abajo) para la pantalla de canje. Son de Patio del Jardín (comercio 10): probalos con martin.rios o lucia.suarez. */
export const CODIGOS_DE_PRUEBA: [string, string][] = [
  ['WAYKI25', 'Se puede canjear'], ['USADO01', 'Ya usado'], ['VENC001', 'Vencido'], ['AJENO01', 'De otro comercio'], ['PENIA01', 'Con días y horario'],
];
export const USUARIOS_DE_PRUEBA: { usuario: string; quien: string }[] = [
  { usuario: 'admin', quien: 'Administrador (equipo técnico)' },
  { usuario: 'carla.ente', quien: 'Creador (Ente Tucumán Turismo)' },
  { usuario: 'martin.rios', quien: 'Prestador de Patio del Jardín' },
  { usuario: 'lucia.suarez', quien: 'Empleada de Patio del Jardín' },
  { usuario: 'sofia.valle', quien: 'Prestadora de Casa del Valle' },
];

// ================================================================== fechas (hora de Tucumán, UTC-3)
const tucuman = (ms = Date.now()) => new Date(ms - 3 * 3600_000).toISOString();
const ahora = () => `${tucuman().slice(0, 19)}-03:00`;
const hoy = () => tucuman().slice(0, 10);
const diaMenos = (fecha: string, dias: number) => new Date(Date.parse(`${fecha}T12:00:00Z`) - dias * 86400_000).toISOString().slice(0, 10);
const diaDe = (iso: string) => tucuman(Date.parse(iso)).slice(0, 10);
const DIAS = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

// ================================================================== datos de ejemplo
const FOTO = (f: string) => `https://tucumanturismo.gob.ar/waykipromo/fotos/${f}.webp`;

function semilla(): Base {
  const creado = '2026-11-01T09:00:00-03:00';
  const comercio = (id: number, nombre: string, categoria_id: number, direccion: string, localidad_id: number, telefono: string | null, estado: EstadoComercio = 'AUTORIZADO', motivo: string | null = null): ComercioFila =>
    ({ id, nombre, categoria_id, direccion, localidad_id, email_contacto: null, telefono_contacto: telefono, logo_url: null, estado, motivo_estado: motivo, autorizado_el: estado === 'AUTORIZADO' ? creado : null, creado_el: creado });
  const usuario = (id: number, u: string, nombre: string, rol: Rol, comercio_id: number | null, estado: EstadoUsuario = 'ACTIVO'): UsuarioFila =>
    ({ id, usuario: u, password: CLAVE_DE_PRUEBA, nombre, email: null, telefono: null, rol, estado, comercio_id, ultimo_acceso: null, creado_el: creado });
  // Catálogo: mismos ids, títulos, beneficios y cupos que turista/lib/simulador.ts ("entregados_antes" = los que ya se llevaron).
  const promo = (id: number, comercio_id: number, titulo: string, descripcion: string, beneficio: string, categoria_id: number, foto: string | null, fecha_hasta: string, quedan: number, destacada = false, estado: EstadoPromocion = 'PUBLICADA'): PromoFila => {
    const modalidad = MODALIDADES.find((m) => m.nombre === beneficio.replace('×', 'x')) ?? MODALIDADES[5];
    return {
      id, comercio_id, titulo, descripcion, condiciones: 'No acumulable con otras promociones.', categoria_id,
      modalidad_id: modalidad.id, modalidad_personalizada: modalidad.tipo === 'PERSONALIZADO' ? beneficio : null,
      fecha_desde: '2026-11-01', fecha_hasta, dias_validos: null, horario: null, cupos_totales: 100, entregados_antes: 100 - quedan,
      estado, destacada, imagen_url: foto && FOTO(foto), creado_por: 2, creado_el: creado, actualizado_el: creado,
    };
  };
  const visitante = (id: number, nombre: string, apellido: string, encuesta: Respuestas | null): VisitanteFila =>
    ({ id, nombre, apellido, creado_el: '2026-11-12T11:00:00-03:00', ultimo_acceso: '2026-11-18T20:00:00-03:00', encuesta });

  const penias = promo(31, 10, 'Noche de peñas', 'Entrada a la peña de los viernes y sábados', 'Personalizado', 2, null, '2027-02-28', 80);
  penias.modalidad_personalizada = 'Empanada de regalo';
  penias.dias_validos = ['VIE', 'SAB'];
  penias.horario = { desde: '21:00', hasta: '02:00' };

  const merienda = promo(2, 10, 'La merienda se comparte', 'Dos meriendas, una invitación', '2×1', 2, 'merienda', '2027-01-15', 54);
  merienda.dias_validos = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE']; // igual que en turista/lib/simulador.ts
  merienda.horario = { desde: '16:00', hasta: '20:00' };

  return {
    version: VERSION,
    comercios: [
      comercio(10, 'Patio del Jardín', 2, 'Av. Aconquija 1450', 76, '381 555-0101'),
      comercio(11, 'Casa del Valle', 1, 'Av. San Martín 320', 86, '3867 42-1234'),
      comercio(12, 'Cumbres del Aconquija', 3, 'Ruta 307 km 61', 86, null),
      comercio(13, 'Rutas de la Historia', 3, '24 de Septiembre 500', 76, null),
      comercio(14, 'Agua y Montaña', 3, 'Dique El Cadillal', 26, null),
      comercio(15, 'Aire de Yungas', 3, 'Av. Aconquija 2100', 103, null),
      comercio(16, 'Almacén Raíces', 2, 'Av. Alem 850', 87, null),
      comercio(17, 'Sabores de Amaicha', 2, 'Ruta 307 km 118', 7, null),
      comercio(18, 'Bodega del Valle', 2, 'Ruta 40 km 4320', 20, null, 'SUSPENDIDO', 'Falta renovar la habilitación municipal'),
    ],
    usuarios: [
      usuario(1, 'admin', 'Equipo técnico', 'superadmin', null),
      usuario(2, 'carla.ente', 'Carla Ente', 'admin_ente', null),
      usuario(3, 'martin.rios', 'Martín Ríos', 'encargado', 10),
      usuario(4, 'lucia.suarez', 'Lucía Suárez', 'empleado', 10),
      usuario(5, 'pablo.mozo', 'Pablo Mozo', 'empleado', 10, 'BLOQUEADO'),
      usuario(6, 'sofia.valle', 'Sofía Valle', 'encargado', 11),
      usuario(7, 'diego.valle', 'Diego Valle', 'empleado', 11),
    ],
    promociones: [
      promo(1, 10, 'Empanadas que cuentan historias', 'En una docena de empanadas tucumanas', '20%', 2, 'empanadas', '2027-01-31', 37, true),
      promo(6, 11, 'Tu refugio en el valle', 'En dos noches con desayuno casero', '25%', 1, 'alojamiento', '2027-02-15', 12, true),
      merienda,
      promo(9, 12, 'Senderos para desconectar', 'En trekking guiado por el valle', '20%', 3, 'montana', '2027-03-01', 8, true),
      promo(14, 13, 'Historias a cada paso', 'En el recorrido guiado por el casco histórico', '2×1', 3, 'cultura', '2027-02-28', 61),
      promo(26, 14, 'El dique desde otra mirada', 'En paseo en kayak con equipo incluido', '25%', 3, 'dique', '2027-02-15', 40),
      promo(17, 15, 'Tu pausa entre las Yungas', 'En el circuito de relax de 60 minutos', '20%', 3, 'bienestar', '2027-01-31', 19),
      promo(20, 16, 'Llevate un pedacito de Tucumán', 'En la caja de sabores regionales', '15%', 2, 'regionales', '2027-03-15', 44),
      promo(12, 17, 'Sabores del corazón del valle', 'En el menú regional del mediodía', '20%', 2, 'vino', '2027-02-28', 29),
      // Solo del panel (no están en el catálogo simulado del turista): estados y restricciones para probar.
      promo(30, 10, 'Brunch de domingo', 'Brunch completo para dos', '15%', 2, null, '2027-03-31', 50, false, 'BORRADOR'),
      penias,
      promo(32, 18, 'Cata de vinos de altura', 'Cata de tres vinos con quesos', '10%', 2, null, '2027-01-31', 30),
    ],
    visitantes: [
      visitante(900, 'Ana', 'Gómez', { rango_edad_id: 3, duracion_id: 4, motivo_id: 1, compania_id: 2, medio_id: 1, provincia_id: 5, pais_id: null }),
      visitante(901, 'Juan', 'Pérez', { rango_edad_id: 2, duracion_id: 2, motivo_id: 1, compania_id: 5, medio_id: 2, provincia_id: null, pais_id: 53 }),
      visitante(902, 'Eva', 'Ruiz', { rango_edad_id: 4, duracion_id: 1, motivo_id: 5, compania_id: 3, medio_id: 5, provincia_id: 1, pais_id: null }),
    ],
    // Códigos de prueba del panel (projects/admin/CLAUDE.md).
    cupones: [
      { codigo: 'WAYKI25', promocion_id: 1, turista_id: 900, emitido_el: '2026-11-15T13:20:00-03:00' },
      { codigo: 'USADO01', promocion_id: 2, turista_id: 901, emitido_el: '2026-11-16T17:05:00-03:00' },
      { codigo: 'VENC001', promocion_id: 1, turista_id: 902, emitido_el: '2026-11-02T12:00:00-03:00', vence_el: '2026-11-10T23:59:59-03:00' },
      { codigo: 'AJENO01', promocion_id: 6, turista_id: 900, emitido_el: '2026-11-17T10:40:00-03:00' },
      { codigo: 'PENIA01', promocion_id: 31, turista_id: 902, emitido_el: '2026-11-18T19:00:00-03:00' },
    ],
    actividad: [
      { id: 2, ocurrido_el: '2026-11-17T21:10:00-03:00', accion: 'CUPON_CANJEADO', descripcion: 'Lucía Suárez canjeó USADO01 (La merienda se comparte)', usuario_id: 4, comercio_id: 10, entidad: { tipo: 'cupon', id: 2 } },
      { id: 1, ocurrido_el: '2026-11-05T10:00:00-03:00', accion: 'COMERCIO_ESTADO', descripcion: 'Carla Ente pasó Bodega del Valle a SUSPENDIDO (Falta renovar la habilitación municipal)', usuario_id: 2, comercio_id: 18, entidad: { tipo: 'comercio', id: 18 } },
    ],
    intentos: [],
  };
}
const CANJES_SEMILLA: Record<string, CanjeGuardado> = {
  USADO01: { id: 1, canjeado_el: '2026-11-17T21:10:00-03:00', usuario_id: 4, usuario_nombre: 'Lucía Suárez', observaciones: 'Mesa 3' },
};

// ================================================================== almacenamiento
let memoria: Base | null = null; // si el navegador no deja guardar, la base vive mientras dure la pestaña
const almacen = (): Storage | null => { try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; } };
function leerJson<T>(clave: string): T | null {
  try { return JSON.parse(almacen()?.getItem(clave) ?? 'null') as T | null; } catch { return null; }
}
function escribirJson(clave: string, valor: unknown) {
  try { almacen()?.setItem(clave, JSON.stringify(valor)); } catch { /* lleno o bloqueado: queda en memoria */ }
}
function base(): Base {
  if (memoria) return memoria;
  const guardada = leerJson<Base>(K_PANEL);
  memoria = guardada?.version === VERSION ? guardada : semilla();
  if (!guardada) { escribirJson(K_PANEL, memoria); if (!leerJson(K_CANJES)) escribirJson(K_CANJES, CANJES_SEMILLA); }
  return memoria;
}
const guardar = () => escribirJson(K_PANEL, base());
const canjes = (): Record<string, CanjeGuardado> => leerJson<Record<string, CanjeGuardado>>(K_CANJES) ?? {};

/** Vuelve a los datos de ejemplo (borra lo creado en el panel y los canjes; los cupones del turista quedan). */
export function reiniciarSimulador() {
  memoria = semilla();
  escribirJson(K_PANEL, memoria);
  escribirJson(K_CANJES, CANJES_SEMILLA);
}

// ================================================================== lo que viene de la app del turista
type DatosTurista = {
  turista?: { id?: number; nombre?: string | null; apellido?: string | null; creado_el?: string } | null;
  encuesta?: (Respuestas & { respondida_el?: string }) | null;
  cupones?: { codigo: string; promocion_id: number; emitido_el: string }[];
};
function datosTuristas(): DatosTurista[] {
  const a = almacen();
  if (!a) return [];
  const claves = Array.from({ length: a.length }, (_, i) => a.key(i) ?? '').filter((k) => ES_TURISTA.test(k));
  return claves.map((k) => leerJson<DatosTurista>(k)).filter((d): d is DatosTurista => !!d?.turista?.id);
}
function visitantes(): VisitanteFila[] {
  const deLaApp = datosTuristas().map((d): VisitanteFila => ({
    id: d.turista!.id!, nombre: d.turista!.nombre ?? 'Turista', apellido: d.turista!.apellido ?? '',
    creado_el: d.turista!.creado_el ?? ahora(), ultimo_acceso: null, encuesta: d.encuesta ?? null,
  }));
  return [...deLaApp, ...base().visitantes];
}
function todosLosCupones(): Cupon[] {
  const b = base();
  const hechos = canjes();
  const nombreDe = (id: number) => { const v = visitantes().find((x) => x.id === id); return v ? `${v.nombre} ${v.apellido.slice(0, 1)}.`.trim() : 'Turista'; };
  const crudos: CuponFila[] = [
    ...datosTuristas().flatMap((d) => (d.cupones ?? []).map((c) => ({ ...c, turista_id: d.turista!.id! }))),
    ...b.cupones,
  ];
  return crudos.flatMap((c) => {
    const promo = b.promociones.find((p) => p.id === c.promocion_id);
    if (!promo) return [];
    const vence_el = c.vence_el ?? `${promo.fecha_hasta}T23:59:59-03:00`;
    const canje = hechos[c.codigo] ?? null;
    const estado = canje ? 'CANJEADO' : c.anulado ? 'ANULADO' : Date.parse(vence_el) < Date.now() ? 'VENCIDO' : 'EMITIDO';
    return [{ codigo: c.codigo, promo, turista: { id: c.turista_id, nombre: nombreDe(c.turista_id) }, emitido_el: c.emitido_el, vence_el, estado, canje }];
  });
}

// ================================================================== errores y respuestas
class Falla extends Error {
  http: number; codigo: string; detalles: Record<string, unknown> | null;
  constructor(http: number, codigo: string, mensaje: string, detalles: Record<string, unknown> | null = null) {
    super(mensaje); this.http = http; this.codigo = codigo; this.detalles = detalles;
  }
}
const ok = (data: unknown, http = 200, meta?: Meta): Respuesta => ({ http, cuerpo: { ok: true, data, ...(meta && { meta }) } });
const NO_ENCONTRADO = (mensaje = 'No existe o no es de tu comercio.') => new Falla(404, 'NO_ENCONTRADO', mensaje);
const validacion = (mensaje: string, detalles: Record<string, string>, codigo = 'VALIDACION_FALLIDA') => new Falla(400, codigo, mensaje, detalles);

// ================================================================== token y permisos
const b64url = (o: unknown) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function payload(jwt: string): Record<string, unknown> | null {
  try {
    const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));
  } catch { return null; }
}
/** Como JwtAuthMiddleware + RoleMiddleware: el token dice quién es; la base, qué puede. */
function quienEs(token: string | null | undefined): Yo {
  if (!token) throw new Falla(401, 'TOKEN_REQUERIDO', 'Ingresá para continuar.');
  const p = payload(token);
  if (!p || Number(p.exp) * 1000 < Date.now() || p.rol === 'turista') throw new Falla(401, 'SESION_INVALIDA', 'Tu sesión terminó. Ingresá de nuevo.');
  const id = Number(p.usuario_id);
  const u = base().usuarios.find((x) => x.id === id);
  // Token de la API real (si la etapa "sesion" ya está encendida) con un usuario que el simulador no conoce: se confía en el token.
  if (!u) return { id, nombre: String(p.nombre ?? 'Usuario'), rol: p.rol as Rol, comercio_id: p.comercio_id == null ? null : Number(p.comercio_id) };
  if (u.estado !== 'ACTIVO') throw new Falla(401, 'SESION_INVALIDA', 'Tu sesión terminó. Ingresá de nuevo.');
  return { id: u.id, nombre: u.nombre, rol: u.rol, comercio_id: u.comercio_id };
}
function exigirRol(yo: Yo, roles: Rol[]) {
  if (yo.rol !== 'superadmin' && !roles.includes(yo.rol)) throw new Falla(403, 'ROL_NO_AUTORIZADO', 'Tu usuario no puede hacer esto.');
}
const esEnte = (yo: Yo) => yo.rol === 'admin_ente' || yo.rol === 'superadmin';
/** Comercio para filtrar: el propio, o el pedido por el Ente (null = todos). */
function comercioDe(yo: Yo, pedido: unknown): number | null {
  if (esEnte(yo)) return Number(pedido) > 0 ? Number(pedido) : null;
  if (!yo.comercio_id) throw new Falla(403, 'SIN_COMERCIO', 'Tu usuario no tiene un comercio asignado.');
  if (Number(pedido) > 0 && Number(pedido) !== yo.comercio_id) throw new Falla(403, 'SIN_ACCESO_AL_COMERCIO', 'No tenés acceso a ese comercio.');
  return yo.comercio_id;
}
function delComercio<T extends { comercio_id: number | null }>(yo: Yo, fila: T | undefined, mensaje?: string): T {
  if (!fila || (!esEnte(yo) && fila.comercio_id !== yo.comercio_id)) throw NO_ENCONTRADO(mensaje);
  return fila;
}
function registrar(yo: Yo, accion: string, descripcion: string, comercio_id: number | null, tipo: string, id: number) {
  const b = base();
  const nuevo = { id: Math.max(0, ...b.actividad.map((a) => a.id)) + 1, ocurrido_el: ahora(), accion, descripcion, usuario_id: yo.id, comercio_id, entidad: { tipo, id } };
  b.actividad = [nuevo, ...b.actividad].slice(0, 300); // ponytail: tope de 300 para no llenar el almacenamiento
}

// ================================================================== formatos del contrato
const nombreDeUsuario = (id: number | null) => base().usuarios.find((u) => u.id === id)?.nombre ?? 'Usuario';
const comercioFila = (id: number) => base().comercios.find((c) => c.id === id);
const localidad = (id: number) => LOCALIDADES.find((l) => l.id === id);
const opcion = (l: Opcion[], id: number | null | undefined) => l.find((o) => o.id === id) ?? null;
const modalidad = (p: PromoFila) => MODALIDADES.find((m) => m.id === p.modalidad_id) ?? MODALIDADES[5];
const beneficio = (p: PromoFila) => (modalidad(p).tipo === 'PERSONALIZADO' && p.modalidad_personalizada ? p.modalidad_personalizada : modalidad(p).nombre.replace('x', '×'));
function publica(p: PromoFila) {
  const c = comercioFila(p.comercio_id);
  return p.estado === 'PUBLICADA' && c?.estado === 'AUTORIZADO' && p.fecha_desde <= hoy() && hoy() <= p.fecha_hasta;
}
function numerosPromo(p: PromoFila) {
  const suyos = todosLosCupones().filter((c) => c.promo.id === p.id);
  return { emitidos: p.entregados_antes + suyos.length, canjeados: suyos.filter((c) => c.estado === 'CANJEADO').length };
}
function aPromocion(p: PromoFila): PromocionGestionApi {
  const c = comercioFila(p.comercio_id)!;
  const n = numerosPromo(p);
  return {
    id: p.id, titulo: p.titulo, descripcion_corta: (p.descripcion ?? '').slice(0, 140),
    comercio: { id: c.id, nombre: c.nombre, lugar: localidad(c.localidad_id)?.nombre ?? '' },
    categoria: opcion(CATEGORIAS, p.categoria_id)!, descuento_visual: beneficio(p),
    fecha_desde: p.fecha_desde, fecha_hasta: p.fecha_hasta, dias_validos: p.dias_validos, horario: p.horario,
    cupos_disponibles: Math.max(0, p.cupos_totales - n.emitidos), cupos_totales: p.cupos_totales,
    imagen_url: p.imagen_url, destacada: p.destacada,
    estado: p.estado, publica: publica(p), descripcion: p.descripcion, condiciones: p.condiciones,
    modalidad: modalidad(p), modalidad_personalizada: p.modalidad_personalizada,
    cupos_emitidos: n.emitidos, cupos_canjeados: n.canjeados,
    creado_por: { id: p.creado_por, nombre: nombreDeUsuario(p.creado_por) }, creado_el: p.creado_el, actualizado_el: p.actualizado_el,
  };
}
function aComercio(c: ComercioFila): ComercioApi {
  const loc = localidad(c.localidad_id);
  const suyos = todosLosCupones().filter((x) => x.promo.comercio_id === c.id);
  return {
    id: c.id, nombre: c.nombre, categoria: opcion(CATEGORIAS, c.categoria_id)!, direccion: c.direccion,
    localidad: { id: c.localidad_id, nombre: loc?.nombre ?? '' }, circuito: opcion(CIRCUITOS, loc?.circuito_id),
    email_contacto: c.email_contacto, telefono_contacto: c.telefono_contacto, logo_url: c.logo_url,
    estado: c.estado, motivo_estado: c.motivo_estado, autorizado_el: c.autorizado_el, creado_el: c.creado_el,
    numeros: {
      promociones_publicadas: base().promociones.filter((p) => p.comercio_id === c.id && publica(p)).length,
      usuarios_activos: base().usuarios.filter((u) => u.comercio_id === c.id && u.estado === 'ACTIVO').length,
      cupones_emitidos: suyos.length, cupones_canjeados: suyos.filter((x) => x.estado === 'CANJEADO').length,
    },
  };
}
function aUsuario(u: UsuarioFila): UsuarioApi {
  const c = u.comercio_id ? comercioFila(u.comercio_id) : null;
  return {
    id: u.id, usuario: u.usuario, nombre: u.nombre, email: u.email, telefono: u.telefono, rol: u.rol, estado: u.estado,
    comercio: c ? { id: c.id, nombre: c.nombre } : null, ultimo_acceso: u.ultimo_acceso, creado_el: u.creado_el,
  };
}
function aSesion(u: UsuarioFila): UsuarioSesionApi {
  const c = u.comercio_id ? comercioFila(u.comercio_id) : null;
  return { id: u.id, usuario: u.usuario, nombre: u.nombre, email: u.email, rol: u.rol, comercio: c ? { id: c.id, nombre: c.nombre, estado: c.estado } : null, ultimo_acceso: u.ultimo_acceso };
}
function enMostrador(c: Cupon): CuponEnMostradorApi {
  return {
    cupon: { codigo: c.codigo, estado: c.estado, emitido_el: c.emitido_el, vence_el: c.vence_el },
    promocion: { id: c.promo.id, titulo: c.promo.titulo, descuento_visual: beneficio(c.promo), condiciones: c.promo.condiciones, dias_validos: c.promo.dias_validos, horario: c.promo.horario, imagen_url: c.promo.imagen_url },
    turista: { nombre: c.turista.nombre },
  };
}
function aCanje(c: Cupon): CanjeApi {
  const com = comercioFila(c.promo.comercio_id)!;
  return {
    id: c.canje!.id, canjeado_el: c.canje!.canjeado_el, codigo: c.codigo,
    promocion: { id: c.promo.id, titulo: c.promo.titulo, descuento_visual: beneficio(c.promo) },
    comercio: { id: com.id, nombre: com.nombre }, turista: { nombre: c.turista.nombre },
    usuario: { id: c.canje!.usuario_id, nombre: c.canje!.usuario_nombre }, observaciones: c.canje!.observaciones,
  };
}
function aVisitante(v: VisitanteFila): VisitanteApi {
  const e = v.encuesta;
  const suyos = todosLosCupones().filter((c) => c.turista.id === v.id);
  const provincia = e?.provincia_id ? { id: e.provincia_id, nombre: PROVINCIAS[e.provincia_id] ?? '' } : null;
  const pais = e?.pais_id ? { id: e.pais_id, nombre: PAISES[e.pais_id] ?? '' } : null;
  return {
    id: v.id, nombre: `${v.nombre} ${v.apellido}`.trim(), procedencia: provincia?.nombre ?? pais?.nombre ?? null, provincia, pais,
    rango_edad: e ? RANGOS[e.rango_edad_id] ?? null : null, duracion: e ? DURACIONES[e.duracion_id] ?? null : null,
    motivo: e ? MOTIVOS[e.motivo_id] ?? null : null, compania: e ? COMPANIAS[e.compania_id] ?? null : null,
    medio: e ? MEDIOS[e.medio_id] ?? null : null,
    cupones_emitidos: suyos.length, cupones_canjeados: suyos.filter((c) => c.estado === 'CANJEADO').length,
    registrado_el: v.creado_el, ultimo_acceso: v.ultimo_acceso,
  };
}
function aActividad(a: ActividadFila): ActividadApi {
  const u = base().usuarios.find((x) => x.id === a.usuario_id);
  const c = a.comercio_id ? comercioFila(a.comercio_id) : null;
  return {
    id: a.id, ocurrido_el: a.ocurrido_el, accion: a.accion, descripcion: a.descripcion,
    usuario: u ? { id: u.id, nombre: u.nombre, rol: u.rol } : null, comercio: c ? { id: c.id, nombre: c.nombre } : null, entidad: a.entidad,
  };
}

// ================================================================== consultas comunes
type Q = URLSearchParams;
function paginar<T>(filas: T[], q: Q): { datos: T[]; meta: Meta } {
  const pagina = Math.max(1, Number(q.get('pagina')) || 1);
  const limite = Math.min(100, Math.max(1, Number(q.get('limite')) || 20));
  return { datos: filas.slice((pagina - 1) * limite, pagina * limite), meta: { pagina, limite, total: filas.length } };
}
const lista_ = <T>(filas: T[], q: Q) => { const { datos, meta } = paginar(filas, q); return ok(datos, 200, meta); };
function periodo(q: Q): [string, string] {
  const valida = (f: string | null) => !!f && /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));
  const hasta = valida(q.get('hasta')) ? q.get('hasta')! : hoy();
  const desde = valida(q.get('desde')) ? q.get('desde')! : diaMenos(hasta, 29);
  if (desde > hasta || Date.parse(hasta) - Date.parse(desde) > 366 * 86400_000) {
    throw validacion('Elegí un período de hasta un año.', { desde: 'Inválido', hasta: 'Inválido' });
  }
  return [desde, hasta];
}
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const busca = (q: Q, ...textos: (string | null | undefined)[]) => { const t = sinTildes(q.get('q') ?? ''); return !t || sinTildes(textos.filter(Boolean).join(' ')).includes(t); };

// ================================================================== canje
const MENSAJE_PROBLEMA: Record<string, [number, string]> = {
  CUPON_OTRO_COMERCIO: [403, 'Este cupón es de otro comercio.'],
  CUPON_YA_CANJEADO: [409, 'Este cupón ya se usó.'],
  CUPON_VENCIDO: [409, 'Este cupón venció.'],
  CUPON_ANULADO: [409, 'Este cupón fue anulado.'],
  COMERCIO_SUSPENDIDO: [409, 'Tu comercio está suspendido: por ahora no se pueden canjear cupones.'],
  FUERA_DE_DIA: [409, 'Este cupón no vale hoy.'],
  FUERA_DE_HORARIO: [409, 'Este cupón no vale en este horario.'],
};
/** Las reglas del canje (como fn_cupon_problema): null = se puede canjear. */
function problema(c: Cupon, comercioId: number | null): string | null {
  if (comercioId !== null && c.promo.comercio_id !== comercioId) return 'CUPON_OTRO_COMERCIO';
  if (c.estado !== 'EMITIDO') return { CANJEADO: 'CUPON_YA_CANJEADO', ANULADO: 'CUPON_ANULADO', VENCIDO: 'CUPON_VENCIDO' }[c.estado];
  if (comercioFila(c.promo.comercio_id)?.estado !== 'AUTORIZADO') return 'COMERCIO_SUSPENDIDO';
  const ya = tucuman();
  const dia = DIAS[(new Date(ya).getUTCDay() + 6) % 7];
  if (c.promo.dias_validos?.length && !c.promo.dias_validos.includes(dia)) return 'FUERA_DE_DIA';
  if (c.promo.horario) {
    const h = ya.slice(11, 16);
    const { desde, hasta } = c.promo.horario;
    if (!(desde <= hasta ? h >= desde && h <= hasta : h >= desde || h <= hasta)) return 'FUERA_DE_HORARIO';
  }
  return null;
}
function buscarCupon(cuerpo: Record<string, unknown> | undefined): Cupon {
  const codigo = String(cuerpo?.codigo ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!codigo) throw validacion('Escribí o escaneá el código.', { codigo: 'Requerido' });
  const c = todosLosCupones().find((x) => x.codigo === codigo);
  if (!c) throw new Falla(404, 'CUPON_INEXISTENTE', 'No encontramos ese código. Revisalo con el visitante.');
  return c;
}
function fallaDeCanje(c: Cupon, codigo: string): Falla {
  const [http, mensaje] = MENSAJE_PROBLEMA[codigo];
  if (codigo === 'CUPON_OTRO_COMERCIO' || codigo === 'COMERCIO_SUSPENDIDO') return new Falla(http, codigo, mensaje);
  return new Falla(http, codigo, mensaje, {
    ...enMostrador(c),
    canjeado_el: c.canje?.canjeado_el ?? null,
    canjeado_por: c.canje ? { id: c.canje.usuario_id, nombre: c.canje.usuario_nombre } : null,
  });
}
const comercioDeCanje = (yo: Yo) => (yo.rol === 'superadmin' ? null : comercioDe(yo, null));

// ================================================================== promociones: validación (como PromocionesPanelController::datos)
const PASOS: Record<EstadoPromocion, EstadoPromocion[]> = {
  BORRADOR: ['PUBLICADA', 'BAJA'], PUBLICADA: ['PAUSADA', 'FINALIZADA', 'BAJA'], PAUSADA: ['PUBLICADA', 'FINALIZADA', 'BAJA'], FINALIZADA: ['BAJA'], BAJA: [],
};
function datosPromo(b: PromocionCuerpo, actual: PromoFila | null, yo: Yo): Partial<PromoFila> {
  const v = <K extends keyof PromocionCuerpo>(k: K, siFalta: unknown) => (k in b ? b[k] : siFalta);
  const err: Record<string, string> = {};
  const texto = (x: unknown) => (String(x ?? '').trim() || null);
  const titulo = String(v('titulo', actual?.titulo ?? '')).trim();
  const d: Partial<PromoFila> = {
    titulo, descripcion: texto(v('descripcion', actual?.descripcion)), condiciones: texto(v('condiciones', actual?.condiciones)),
    modalidad_id: Number(v('modalidad_id', actual?.modalidad_id ?? 0)), modalidad_personalizada: texto(v('modalidad_personalizada', actual?.modalidad_personalizada)),
    fecha_desde: String(v('fecha_desde', actual?.fecha_desde ?? '')), fecha_hasta: String(v('fecha_hasta', actual?.fecha_hasta ?? '')),
    cupos_totales: Number(v('cupos_totales', actual?.cupos_totales ?? 0)),
  };
  if (titulo.length < 3 || titulo.length > 180) err.titulo = 'Entre 3 y 180 caracteres';
  if ((d.descripcion ?? '').length > 2000) err.descripcion = 'Hasta 2000 caracteres';
  if ((d.condiciones ?? '').length > 2000) err.condiciones = 'Hasta 2000 caracteres';
  const m = MODALIDADES.find((x) => x.id === d.modalidad_id);
  if (!m) err.modalidad_id = 'Elegí una modalidad';
  else if (m.tipo === 'PERSONALIZADO' && !d.modalidad_personalizada) err.modalidad_personalizada = 'Escribí el beneficio (ej. "Postre de regalo")';
  else if (m.tipo !== 'PERSONALIZADO') d.modalidad_personalizada = null;
  const fecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && !Number.isNaN(Date.parse(f));
  if (!fecha(d.fecha_desde!)) err.fecha_desde = 'Formato yyyy-mm-dd';
  if (!fecha(d.fecha_hasta!)) err.fecha_hasta = 'Formato yyyy-mm-dd';
  else if (d.fecha_hasta! < d.fecha_desde!) err.fecha_hasta = 'Tiene que ser igual o posterior a la de inicio';
  else if (!actual && d.fecha_hasta! < hoy()) err.fecha_hasta = 'Ya pasó';
  if (!Number.isInteger(d.cupos_totales) || d.cupos_totales! < 1 || d.cupos_totales! > 100000) err.cupos_totales = 'Entre 1 y 100000';
  const dias = v('dias_validos', actual?.dias_validos ?? null) as unknown;
  if (dias === null || (Array.isArray(dias) && dias.length === 0)) d.dias_validos = null;
  else if (!Array.isArray(dias) || dias.some((x) => !DIAS.includes(x))) err.dias_validos = 'Lista de LUN, MAR, MIE, JUE, VIE, SAB, DOM';
  else d.dias_validos = DIAS.filter((x) => dias.includes(x));
  const horario = v('horario', actual?.horario ?? null) as Horario | unknown;
  const hora = (h: unknown) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  if (horario === null) d.horario = null;
  else if (typeof horario !== 'object' || !hora((horario as { desde?: unknown }).desde) || !hora((horario as { hasta?: unknown }).hasta)) err.horario = 'Objeto {desde: "HH:MM", hasta: "HH:MM"} o null';
  else d.horario = { desde: (horario as { desde: string }).desde, hasta: (horario as { hasta: string }).hasta };
  if ('categoria_id' in b) d.categoria_id = Number(b.categoria_id);
  if ('destacada' in b) {
    if (!esEnte(yo)) throw new Falla(403, 'ROL_NO_AUTORIZADO', 'Solo el Ente puede hacer esto.');
    d.destacada = !!b.destacada;
  }
  if (Object.keys(err).length) throw validacion('Revisá los datos de la promoción.', err);
  return d;
}
function pasarA(yo: Yo, p: PromoFila, estado: string, motivo: string) {
  const permitidos = PASOS[p.estado];
  if (!permitidos.includes(estado as EstadoPromocion)) {
    throw new Falla(409, 'TRANSICION_INVALIDA', `Una promoción ${p.estado} no puede pasar a ${estado || '(vacío)'}.`, { permitidos });
  }
  if (estado === 'PUBLICADA') {
    const motivos = [
      comercioFila(p.comercio_id)?.estado !== 'AUTORIZADO' && 'El comercio no está autorizado.',
      p.fecha_hasta < hoy() && 'La fecha de fin ya pasó.',
      aPromocion(p).cupos_disponibles <= 0 && 'No le quedan cupos.',
    ].filter(Boolean);
    if (motivos.length) throw new Falla(409, 'NO_SE_PUEDE_PUBLICAR', 'Todavía no se puede publicar.', { motivos });
  }
  p.estado = estado as EstadoPromocion;
  p.actualizado_el = ahora();
  registrar(yo, 'PROMOCION_ESTADO', `${yo.nombre} pasó "${p.titulo}" a ${estado}${motivo ? ` (${motivo})` : ''}`, p.comercio_id, 'promocion', p.id);
}

// ================================================================== imágenes (se achican como en la API, a 600 px, y se guardan como data URL)
async function imagenSubida(cuerpo: unknown): Promise<string> {
  const archivo = cuerpo instanceof FormData ? cuerpo.get('imagen') : null;
  if (!(archivo instanceof Blob) || archivo.size === 0) throw validacion('Elegí una imagen.', { imagen: 'Requerida' });
  if (archivo.size > 2 * 1024 * 1024) throw new Falla(413, 'ARCHIVO_MUY_GRANDE', 'La imagen pesa más de 2 MB. Probá con una más liviana.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) throw new Falla(415, 'FORMATO_NO_SOPORTADO', 'Subí una imagen JPG, PNG o WebP.');
  try {
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, 600 / bmp.width);
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(bmp.width * escala);
    lienzo.height = Math.round(bmp.height * escala);
    lienzo.getContext('2d')!.drawImage(bmp, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/webp', 0.8);
  } catch {
    throw new Falla(415, 'FORMATO_NO_SOPORTADO', 'Subí una imagen JPG, PNG o WebP.');
  }
}

// ================================================================== CSV (como ReportesController::exportar)
function csv(recurso: string, columnas: [string, string][], filas: Record<string, unknown>[]): Respuesta {
  const celda = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // que no se ejecute como fórmula
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lineas = [columnas.map(([, t]) => t).join(';'), ...filas.map((f) => columnas.map(([k]) => celda(f[k])).join(';'))];
  return { http: 200, cuerpo: null, csv: { texto: `﻿${lineas.join('\r\n')}`, archivo: `wayki-${recurso}-${hoy()}.csv` } };
}

// ================================================================== reportes (como sp_reportes)
function reporte(desde: string, hasta: string, filtros: { comercio?: number | null; categoria?: number; localidad?: number }): ReporteApi {
  const entra = (p: PromoFila) => (!filtros.comercio || p.comercio_id === filtros.comercio) && (!filtros.categoria || p.categoria_id === filtros.categoria)
    && (!filtros.localidad || comercioFila(p.comercio_id)?.localidad_id === filtros.localidad);
  const cupones = todosLosCupones().filter((c) => entra(c.promo));
  const delPeriodo = cupones.filter((c) => { const d = diaDe(c.emitido_el); return d >= desde && d <= hasta; });
  const canjeados = cupones.filter((c) => c.canje && diaDe(c.canje.canjeado_el) >= desde && diaDe(c.canje.canjeado_el) <= hasta);
  const contar = (claves: [number | undefined, string][], conCanje?: boolean[]): ItemReporte[] => {
    const m = new Map<string, ItemReporte>();
    claves.forEach(([id, etiqueta], i) => {
      const it = m.get(etiqueta) ?? { ...(id !== undefined && { id }), etiqueta, cantidad: 0, ...(conCanje && { canjeados: 0 }) };
      it.cantidad++;
      if (conCanje?.[i]) it.canjeados!++;
      m.set(etiqueta, it);
    });
    return [...m.values()].sort((a, b) => b.cantidad - a.cantidad || a.etiqueta.localeCompare(b.etiqueta));
  };
  const deCupones = (f: (c: Cupon) => [number, string]) => contar(delPeriodo.map(f), delPeriodo.map((c) => c.estado === 'CANJEADO'));
  const ids = [...new Set(delPeriodo.map((c) => c.turista.id))];
  const encuestas = ids.map((id) => visitantes().find((v) => v.id === id)?.encuesta ?? null);
  const deVisitantes = (f: (e: Respuestas) => string | undefined) => contar(encuestas.map((e) => [undefined, (e && f(e)) || 'Sin responder']));
  const dias = [...new Set([...delPeriodo.map((c) => diaDe(c.emitido_el)), ...canjeados.map((c) => diaDe(c.canje!.canjeado_el))])].sort();
  const emitidos = delPeriodo.length;
  return {
    periodo: { desde, hasta },
    totales: {
      visitantes: ids.length, emitidos, canjeados: canjeados.length,
      promociones_activas: base().promociones.filter((p) => entra(p) && publica(p)).length,
      comercios_activos: base().comercios.filter((c) => c.estado === 'AUTORIZADO' && (!filtros.comercio || c.id === filtros.comercio)).length,
      tasa_canje: emitidos ? Math.round((canjeados.length / emitidos) * 1000) / 1000 : 0,
    },
    serie: dias.map((fecha) => ({ fecha, emitidos: delPeriodo.filter((c) => diaDe(c.emitido_el) === fecha).length, canjeados: canjeados.filter((c) => diaDe(c.canje!.canjeado_el) === fecha).length })),
    grupos: {
      procedencia: deVisitantes((e) => (e.provincia_id ? PROVINCIAS[e.provincia_id] : e.pais_id ? PAISES[e.pais_id] : undefined)),
      rango_edad: deVisitantes((e) => RANGOS[e.rango_edad_id]), duracion: deVisitantes((e) => DURACIONES[e.duracion_id]),
      motivo: deVisitantes((e) => MOTIVOS[e.motivo_id]), compania: deVisitantes((e) => COMPANIAS[e.compania_id]), medio: deVisitantes((e) => MEDIOS[e.medio_id]),
      categoria: deCupones((c) => [c.promo.categoria_id, opcion(CATEGORIAS, c.promo.categoria_id)?.nombre ?? '']),
      localidad: deCupones((c) => { const l = localidad(comercioFila(c.promo.comercio_id)!.localidad_id); return [l?.id ?? 0, l?.nombre ?? '']; }),
      comercio: deCupones((c) => [c.promo.comercio_id, comercioFila(c.promo.comercio_id)!.nombre]),
      promocion: deCupones((c) => [c.promo.id, c.promo.titulo]),
    },
  };
}

// ================================================================== rutas
type Ctx = { yo: () => Yo; q: Q; cuerpo: Record<string, unknown>; crudo: unknown; params: string[] };
type Manejador = (c: Ctx) => Respuesta | Promise<Respuesta>;
const PERSONAL: Rol[] = ['empleado', 'encargado', 'admin_ente'];
const MOSTRADOR: Rol[] = ['empleado', 'encargado'];
const GESTION: Rol[] = ['encargado', 'admin_ente'];
const ENTE: Rol[] = ['admin_ente'];
const conRol = (roles: Rol[], f: (c: Ctx, yo: Yo) => Respuesta | Promise<Respuesta>): Manejador => (c) => { const yo = c.yo(); exigirRol(yo, roles); return f(c, yo); };

const promoDe = (yo: Yo, id: string) => delComercio(yo, base().promociones.find((p) => p.id === Number(id)), 'No existe esa promoción o no es de tu comercio.');
const comercioPedido = (yo: Yo, id: string) => delComercio(yo, (() => { const c = comercioFila(Number(id)); return c && { ...c, comercio_id: c.id }; })(), 'No existe ese comercio.');
/** Usuario que el pedido puede administrar (como UsuariosPanelController::buscar). */
const ADMINISTRA: Partial<Record<Rol, Rol[]>> = { superadmin: ['superadmin', 'admin_ente', 'encargado', 'empleado'], admin_ente: ['encargado', 'empleado'], encargado: ['empleado'] };
function usuarioPedido(yo: Yo, id: string): UsuarioFila {
  const u = base().usuarios.find((x) => x.id === Number(id));
  const puede = u && u.id !== yo.id && (ADMINISTRA[yo.rol] ?? []).includes(u.rol) && (esEnte(yo) || u.comercio_id === yo.comercio_id);
  if (!puede) throw NO_ENCONTRADO('No existe ese usuario o no lo podés administrar.');
  return u!;
}
const claveTemporal = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (n) => 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n % 55]).join('');

const RUTAS: [Metodo, RegExp, Manejador][] = [
  // ---- listas (públicas) ----
  ['GET', /^\/categorias$/, () => ok(CATEGORIAS)],
  ['GET', /^\/modalidades$/, () => ok(MODALIDADES)],
  ['GET', /^\/circuitos$/, () => ok(CIRCUITOS)],
  ['GET', /^\/localidades$/, ({ q }) => ok(LOCALIDADES.filter((l) => !Number(q.get('circuito_id')) || l.circuito_id === Number(q.get('circuito_id'))))],

  // ---- sesión ----
  ['POST', /^\/auth\/login$/, ({ cuerpo }) => {
    const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase();
    const password = String(cuerpo.password ?? '');
    if (!usuario || !password) throw validacion('Completá usuario y contraseña.', { ...(!usuario && { usuario: 'Requerido' }), ...(!password && { password: 'Requerido' }) });
    const b = base();
    const desde = Date.now() - 15 * 60_000;
    const recientes = b.intentos.filter((i) => i.usuario === usuario && i.el > desde);
    const ultimoBueno = Math.max(0, ...recientes.filter((i) => i.exito).map((i) => i.el));
    if (recientes.filter((i) => !i.exito && i.el > ultimoBueno).length >= 5) throw new Falla(429, 'DEMASIADOS_INTENTOS', 'Demasiados intentos. Esperá 15 minutos y probá de nuevo.');
    const u = b.usuarios.find((x) => x.usuario === usuario);
    const anotar = (exito: boolean) => { b.intentos = [...b.intentos, { usuario, el: Date.now(), exito }].slice(-100); guardar(); };
    if (!u || u.password !== password) { anotar(false); throw new Falla(401, 'CREDENCIALES_INVALIDAS', 'Usuario o contraseña incorrectos.'); }
    if (u.estado !== 'ACTIVO') { anotar(false); throw new Falla(403, 'USUARIO_BLOQUEADO', 'Tu usuario está bloqueado. Pedile al Ente que lo habilite.'); }
    u.ultimo_acceso = ahora();
    anotar(true);
    const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
    const token = `${b64url({ alg: 'none', typ: 'JWT' })}.${b64url({ sub: `usr_${u.id}`, usuario_id: u.id, rol: u.rol, comercio_id: u.comercio_id, iat: Math.floor(Date.now() / 1000), exp })}.simulado`;
    return ok({ token, expira_el: `${tucuman(exp * 1000).slice(0, 19)}-03:00`, usuario: aSesion(u) });
  }],
  ['GET', /^\/panel\/sesion$/, conRol(PERSONAL, (_, yo) => {
    const u = base().usuarios.find((x) => x.id === yo.id);
    return ok(u ? aSesion(u) : { id: yo.id, usuario: '', nombre: yo.nombre, email: null, rol: yo.rol, comercio: null, ultimo_acceso: null });
  })],
  ['PUT', /^\/panel\/password$/, conRol(PERSONAL, ({ cuerpo }, yo) => {
    const nueva = String(cuerpo.nueva ?? '');
    if (nueva.length < 10) throw validacion('La contraseña nueva tiene que tener al menos 10 caracteres.', { nueva: 'Mínimo 10 caracteres' });
    const u = base().usuarios.find((x) => x.id === yo.id);
    if (!u || u.password !== String(cuerpo.actual ?? '')) throw validacion('La contraseña actual no es correcta.', { actual: 'Incorrecta' }, 'PASSWORD_ACTUAL_INCORRECTA');
    u.password = nueva;
    guardar();
    return ok({ mensaje: 'Cambiaste tu contraseña.' });
  })],
  ['GET', /^\/panel\/resumen$/, conRol(PERSONAL, ({ q }, yo) => {
    if (yo.rol === 'empleado') {
      const mios = todosLosCupones().filter((c) => c.canje?.usuario_id === yo.id && diaDe(c.canje.canjeado_el) === hoy())
        .sort((a, b) => b.canje!.canjeado_el.localeCompare(a.canje!.canjeado_el));
      return ok({ rol: 'empleado', canjes_hoy: mios.length, ultimos_canjes: mios.slice(0, 5).map(aCanje) });
    }
    const comercio = comercioDe(yo, q.get('comercio_id'));
    const [desde, hasta] = periodo(q);
    const r = reporte(desde, hasta, { comercio });
    const actividad = base().actividad.filter((a) => !comercio || a.comercio_id === comercio).slice(0, 6).map(aActividad);
    return ok({ rol: yo.rol, periodo: r.periodo, totales: r.totales, serie: r.serie, promociones_top: (r.grupos.promocion ?? []).slice(0, 5), categorias: r.grupos.categoria ?? [], actividad });
  })],

  // ---- canje ----
  ['POST', /^\/panel\/canjes\/validar$/, conRol(MOSTRADOR, ({ cuerpo }, yo) => {
    const c = buscarCupon(cuerpo);
    const p = problema(c, comercioDeCanje(yo));
    if (p) throw fallaDeCanje(c, p);
    return ok(enMostrador(c));
  })],
  ['POST', /^\/panel\/canjes$/, conRol(MOSTRADOR, ({ cuerpo }, yo) => {
    const c = buscarCupon(cuerpo);
    const p = problema(c, comercioDeCanje(yo));
    if (p) throw fallaDeCanje(c, p);
    const todos = canjes();
    const id = Math.max(0, ...Object.values(todos).map((x) => x.id)) + 1;
    const canje: CanjeGuardado = { id, canjeado_el: ahora(), usuario_id: yo.id, usuario_nombre: yo.nombre, observaciones: String(cuerpo.observaciones ?? '').trim().slice(0, 500) || null };
    escribirJson(K_CANJES, { ...todos, [c.codigo]: canje });
    registrar(yo, 'CUPON_CANJEADO', `${yo.nombre} canjeó ${c.codigo} (${c.promo.titulo})`, c.promo.comercio_id, 'cupon', id);
    guardar();
    const hecho = { ...c, estado: 'CANJEADO' as const, canje };
    return ok({ canje_id: id, canjeado_el: canje.canjeado_el, ...enMostrador(hecho) }, 201);
  })],
  ['GET', /^\/panel\/canjes$/, conRol(PERSONAL, ({ q }, yo) => {
    const comercio = comercioDe(yo, q.get('comercio_id'));
    const [desde, hasta] = periodo(q);
    const usuario = yo.rol === 'empleado' ? yo.id : Number(q.get('usuario_id')) || 0;
    const filas = todosLosCupones().filter((c) => c.canje && (!comercio || c.promo.comercio_id === comercio) && (!usuario || c.canje.usuario_id === usuario)
      && (!Number(q.get('promocion_id')) || c.promo.id === Number(q.get('promocion_id')))
      && diaDe(c.canje.canjeado_el) >= desde && diaDe(c.canje.canjeado_el) <= hasta)
      .sort((a, b) => b.canje!.canjeado_el.localeCompare(a.canje!.canjeado_el));
    return lista_(filas.map(aCanje), q);
  })],

  // ---- promociones ----
  ['GET', /^\/panel\/promociones$/, conRol(GESTION, ({ q }, yo) => {
    const comercio = comercioDe(yo, q.get('comercio_id'));
    const estado = (q.get('estado') ?? '').toUpperCase();
    const orden: EstadoPromocion[] = ['PUBLICADA', 'BORRADOR', 'PAUSADA', 'FINALIZADA', 'BAJA'];
    const filas = base().promociones.filter((p) => (!comercio || p.comercio_id === comercio) && (estado ? p.estado === estado : p.estado !== 'BAJA')
      && (!Number(q.get('categoria_id')) || p.categoria_id === Number(q.get('categoria_id')))
      && busca(q, p.titulo, comercioFila(p.comercio_id)?.nombre, localidad(comercioFila(p.comercio_id)?.localidad_id ?? 0)?.nombre))
      .sort((a, b) => orden.indexOf(a.estado) - orden.indexOf(b.estado) || Number(b.destacada) - Number(a.destacada) || b.fecha_hasta.localeCompare(a.fecha_hasta));
    return lista_(filas.map(aPromocion), q);
  })],
  ['GET', /^\/panel\/promociones\/(\d+)$/, conRol(GESTION, ({ params }, yo) => ok(aPromocion(promoDe(yo, params[0]))))],
  ['POST', /^\/panel\/promociones$/, conRol(GESTION, ({ cuerpo }, yo) => {
    const b = base();
    const comercioId = comercioDe(yo, cuerpo.comercio_id);
    if (!comercioId) throw validacion('Elegí el comercio.', { comercio_id: 'Requerido' });
    const comercio = comercioFila(comercioId);
    if (!comercio) throw validacion('Ese comercio no existe.', { comercio_id: 'Inválido' });
    const d = datosPromo(cuerpo as PromocionCuerpo, null, yo);
    const nueva: PromoFila = {
      id: Math.max(0, ...b.promociones.map((p) => p.id)) + 1, comercio_id: comercioId, categoria_id: d.categoria_id ?? comercio.categoria_id,
      titulo: d.titulo!, descripcion: d.descripcion ?? null, condiciones: d.condiciones ?? null, modalidad_id: d.modalidad_id!,
      modalidad_personalizada: d.modalidad_personalizada ?? null, fecha_desde: d.fecha_desde!, fecha_hasta: d.fecha_hasta!,
      dias_validos: d.dias_validos ?? null, horario: d.horario ?? null, cupos_totales: d.cupos_totales!, entregados_antes: 0,
      estado: 'BORRADOR', destacada: d.destacada ?? false, imagen_url: null, creado_por: yo.id, creado_el: ahora(), actualizado_el: ahora(),
    };
    b.promociones.push(nueva);
    registrar(yo, 'PROMOCION_CREADA', `${yo.nombre} creó "${nueva.titulo}"`, comercioId, 'promocion', nueva.id);
    if (String(cuerpo.estado ?? '').toUpperCase() === 'PUBLICADA') {
      try { pasarA(yo, nueva, 'PUBLICADA', ''); } catch (e) { guardar(); throw e; }
    }
    guardar();
    return ok(aPromocion(nueva), 201);
  })],
  ['PUT', /^\/panel\/promociones\/(\d+)$/, conRol(GESTION, ({ params, cuerpo }, yo) => {
    const p = promoDe(yo, params[0]);
    if (p.estado === 'FINALIZADA' || p.estado === 'BAJA') throw new Falla(409, 'PROMOCION_CERRADA', 'Una promoción finalizada o dada de baja no se puede editar.');
    const d = datosPromo(cuerpo as PromocionCuerpo, p, yo);
    const emitidos = numerosPromo(p).emitidos;
    if (d.cupos_totales! < emitidos) throw validacion('No podés bajar los cupos por debajo de los ya entregados.', { cupos_totales: `Mínimo ${emitidos}` });
    Object.assign(p, d, { actualizado_el: ahora() });
    registrar(yo, 'PROMOCION_EDITADA', `${yo.nombre} editó "${p.titulo}"`, p.comercio_id, 'promocion', p.id);
    guardar();
    return ok(aPromocion(p));
  })],
  ['PATCH', /^\/panel\/promociones\/(\d+)\/estado$/, conRol(GESTION, ({ params, cuerpo }, yo) => {
    const p = promoDe(yo, params[0]);
    pasarA(yo, p, String(cuerpo.estado ?? '').toUpperCase(), String(cuerpo.motivo ?? '').trim());
    guardar();
    return ok(aPromocion(p));
  })],
  ['POST', /^\/panel\/promociones\/(\d+)\/imagen$/, conRol(GESTION, async ({ params, crudo }, yo) => {
    const p = promoDe(yo, params[0]);
    p.imagen_url = await imagenSubida(crudo);
    registrar(yo, 'PROMOCION_IMAGEN', `${yo.nombre} cambió la imagen de "${p.titulo}"`, p.comercio_id, 'promocion', p.id);
    guardar();
    return ok({ imagen_url: p.imagen_url });
  })],
  ['DELETE', /^\/panel\/promociones\/(\d+)\/imagen$/, conRol(GESTION, ({ params }, yo) => {
    const p = promoDe(yo, params[0]);
    p.imagen_url = null;
    guardar();
    return ok({ imagen_url: null });
  })],

  // ---- comercios ----
  ['GET', /^\/panel\/comercios$/, conRol(ENTE, ({ q }) => {
    const estado = (q.get('estado') ?? '').toUpperCase();
    const filas = base().comercios.filter((c) => (!estado || c.estado === estado) && (!Number(q.get('categoria_id')) || c.categoria_id === Number(q.get('categoria_id')))
      && (!Number(q.get('localidad_id')) || c.localidad_id === Number(q.get('localidad_id'))) && busca(q, c.nombre, c.direccion, localidad(c.localidad_id)?.nombre, c.email_contacto))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
    return lista_(filas.map(aComercio), q);
  })],
  ['GET', /^\/panel\/comercios\/(\d+)$/, conRol(GESTION, ({ params }, yo) => ok(aComercio(comercioPedido(yo, params[0]))))],
  ['POST', /^\/panel\/comercios$/, conRol(ENTE, ({ cuerpo }, yo) => {
    const b = base();
    const d = datosComercio(cuerpo, null);
    const nuevo: ComercioFila = { id: Math.max(0, ...b.comercios.map((c) => c.id)) + 1, ...d, logo_url: null, estado: 'AUTORIZADO', motivo_estado: null, autorizado_el: ahora(), creado_el: ahora() };
    b.comercios.push(nuevo);
    registrar(yo, 'COMERCIO_CREADO', `${yo.nombre} dio de alta a ${nuevo.nombre}`, nuevo.id, 'comercio', nuevo.id);
    guardar();
    return ok(aComercio(nuevo), 201);
  })],
  ['PUT', /^\/panel\/comercios\/(\d+)$/, conRol(GESTION, ({ params, cuerpo }, yo) => {
    const c = comercioFila(comercioPedido(yo, params[0]).id)!;
    const permitido = esEnte(yo) ? cuerpo : Object.fromEntries(Object.entries(cuerpo).filter(([k]) => ['direccion', 'email_contacto', 'telefono_contacto'].includes(k)));
    Object.assign(c, datosComercio(permitido, c));
    registrar(yo, 'COMERCIO_EDITADO', `${yo.nombre} editó ${c.nombre}`, c.id, 'comercio', c.id);
    guardar();
    return ok(aComercio(c));
  })],
  ['PATCH', /^\/panel\/comercios\/(\d+)\/estado$/, conRol(ENTE, ({ params, cuerpo }, yo) => {
    const c = comercioFila(comercioPedido(yo, params[0]).id)!;
    const estado = String(cuerpo.estado ?? '').toUpperCase();
    const motivo = String(cuerpo.motivo ?? '').trim();
    if (estado !== 'AUTORIZADO' && estado !== 'SUSPENDIDO') throw validacion('Estado inválido.', { estado: 'AUTORIZADO o SUSPENDIDO' });
    if (estado === 'SUSPENDIDO' && motivo.length < 5) throw validacion('Contá por qué se suspende.', { motivo: 'Requerido al suspender' });
    c.estado = estado as EstadoComercio;
    c.motivo_estado = motivo || null;
    if (estado === 'AUTORIZADO') c.autorizado_el = ahora();
    registrar(yo, 'COMERCIO_ESTADO', `${yo.nombre} pasó ${c.nombre} a ${estado}${motivo ? ` (${motivo})` : ''}`, c.id, 'comercio', c.id);
    guardar();
    return ok(aComercio(c));
  })],
  ['POST', /^\/panel\/comercios\/(\d+)\/logo$/, conRol(GESTION, async ({ params, crudo }, yo) => {
    const c = comercioFila(comercioPedido(yo, params[0]).id)!;
    c.logo_url = await imagenSubida(crudo);
    guardar();
    return ok({ logo_url: c.logo_url });
  })],
  ['DELETE', /^\/panel\/comercios\/(\d+)\/logo$/, conRol(GESTION, ({ params }, yo) => {
    const c = comercioFila(comercioPedido(yo, params[0]).id)!;
    c.logo_url = null;
    guardar();
    return ok({ logo_url: null });
  })],

  // ---- usuarios ----
  ['GET', /^\/panel\/usuarios$/, conRol(GESTION, ({ q }, yo) => {
    const comercio = comercioDe(yo, q.get('comercio_id'));
    const rol = yo.rol === 'encargado' ? 'empleado' : q.get('rol') ?? '';
    const estado = (q.get('estado') ?? '').toUpperCase();
    const filas = base().usuarios.filter((u) => (!comercio || u.comercio_id === comercio) && (!rol || u.rol === rol) && (!estado || u.estado === estado)
      && busca(q, u.usuario, u.nombre, u.email, u.comercio_id ? comercioFila(u.comercio_id)?.nombre : null))
      .sort((a, b) => Number(b.estado === 'ACTIVO') - Number(a.estado === 'ACTIVO') || a.nombre.localeCompare(b.nombre));
    return lista_(filas.map(aUsuario), q);
  })],
  ['POST', /^\/panel\/usuarios$/, conRol(GESTION, ({ cuerpo }, yo) => {
    const b = base();
    const rol = (yo.rol === 'encargado' ? 'empleado' : String(cuerpo.rol ?? '')) as Rol;
    const permitidos = ADMINISTRA[yo.rol] ?? [];
    if (!permitidos.includes(rol)) throw new Falla(403, 'ROL_NO_AUTORIZADO', 'No podés asignar ese rol.', { permitidos });
    const comercioId = rol === 'admin_ente' || rol === 'superadmin' ? null : comercioDe(yo, cuerpo.comercio_id);
    if (rol !== 'admin_ente' && rol !== 'superadmin' && !comercioId) throw validacion('Elegí el comercio.', { comercio_id: 'Requerido' });
    const usuario = String(cuerpo.usuario ?? '').trim().toLowerCase();
    const nombre = String(cuerpo.nombre ?? '').trim();
    const email = String(cuerpo.email ?? '').trim();
    const err: Record<string, string> = {};
    if (!/^[a-z0-9._-]{3,100}$/.test(usuario)) err.usuario = 'De 3 a 100 caracteres: letras, números, punto, guion';
    if (nombre.length < 3) err.nombre = 'Requerido';
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err.email = 'Email inválido';
    if (cuerpo.password !== undefined && String(cuerpo.password).length < 10) err.password = 'Mínimo 10 caracteres';
    if (Object.keys(err).length) throw validacion('Revisá los datos del usuario.', err);
    if (b.usuarios.some((u) => u.usuario === usuario)) throw new Falla(409, 'USUARIO_REPETIDO', 'Ese nombre de usuario ya existe. Probá con otro.', { usuario: 'Ya existe' });
    const temporal = cuerpo.password === undefined ? claveTemporal() : null;
    const nuevo: UsuarioFila = {
      id: Math.max(0, ...b.usuarios.map((u) => u.id)) + 1, usuario, password: temporal ?? String(cuerpo.password), nombre, email: email || null,
      telefono: String(cuerpo.telefono ?? '').trim() || null, rol, estado: 'ACTIVO', comercio_id: comercioId, ultimo_acceso: null, creado_el: ahora(),
    };
    b.usuarios.push(nuevo);
    registrar(yo, 'USUARIO_CREADO', `${yo.nombre} creó a ${nombre} (${rol})`, comercioId, 'usuario', nuevo.id);
    guardar();
    return ok({ ...aUsuario(nuevo), ...(temporal && { password_temporal: temporal }) }, 201);
  })],
  ['PUT', /^\/panel\/usuarios\/(\d+)$/, conRol(GESTION, ({ params, cuerpo }, yo) => {
    const u = usuarioPedido(yo, params[0]);
    const rol = String(cuerpo.rol ?? '') as Rol;
    if (rol && rol !== u.rol && !(ADMINISTRA[yo.rol] ?? []).includes(rol)) throw new Falla(403, 'ROL_NO_AUTORIZADO', 'No podés asignar ese rol.', { permitidos: ADMINISTRA[yo.rol] ?? [] });
    if ('nombre' in cuerpo) u.nombre = String(cuerpo.nombre).trim() || u.nombre;
    if ('email' in cuerpo) u.email = String(cuerpo.email ?? '').trim() || null;
    if ('telefono' in cuerpo) u.telefono = String(cuerpo.telefono ?? '').trim() || null;
    if (rol) u.rol = rol;
    registrar(yo, 'USUARIO_EDITADO', `${yo.nombre} editó a ${u.nombre}`, u.comercio_id, 'usuario', u.id);
    guardar();
    return ok(aUsuario(u));
  })],
  ['PATCH', /^\/panel\/usuarios\/(\d+)\/estado$/, conRol(GESTION, ({ params, cuerpo }, yo) => {
    const u = usuarioPedido(yo, params[0]);
    const estado = String(cuerpo.estado ?? '').toUpperCase();
    if (!['ACTIVO', 'BLOQUEADO', 'BAJA'].includes(estado)) throw validacion('Estado inválido.', { estado: 'ACTIVO, BLOQUEADO o BAJA' });
    u.estado = estado as EstadoUsuario;
    registrar(yo, 'USUARIO_ESTADO', `${yo.nombre} pasó a ${u.nombre} a ${estado}`, u.comercio_id, 'usuario', u.id);
    guardar();
    return ok(aUsuario(u));
  })],
  ['POST', /^\/panel\/usuarios\/(\d+)\/password$/, conRol(GESTION, ({ params }, yo) => {
    const u = usuarioPedido(yo, params[0]);
    u.password = claveTemporal();
    registrar(yo, 'USUARIO_PASSWORD', `${yo.nombre} generó una contraseña nueva para ${u.nombre}`, u.comercio_id, 'usuario', u.id);
    guardar();
    return ok({ password_temporal: u.password });
  })],

  // ---- Ente ----
  ['GET', /^\/panel\/visitantes$/, conRol(ENTE, ({ q }) => {
    const [desde, hasta] = q.get('desde') || q.get('hasta') ? periodo(q) : ['', '9999'];
    const filas = visitantes().map(aVisitante).filter((v) => busca(q, v.nombre, v.procedencia)
      && (!Number(q.get('provincia_id')) || v.provincia?.id === Number(q.get('provincia_id')))
      && (!Number(q.get('pais_id')) || v.pais?.id === Number(q.get('pais_id')))
      && (!Number(q.get('rango_edad_id')) || visitantes().find((x) => x.id === v.id)?.encuesta?.rango_edad_id === Number(q.get('rango_edad_id')))
      && diaDe(v.registrado_el) >= desde && diaDe(v.registrado_el) <= hasta)
      .sort((a, b) => b.registrado_el.localeCompare(a.registrado_el));
    return lista_(filas, q);
  })],
  ['GET', /^\/panel\/visitantes\/(\d+)$/, conRol(ENTE, ({ params }) => {
    const v = visitantes().find((x) => x.id === Number(params[0]));
    if (!v) throw NO_ENCONTRADO('No existe ese visitante.');
    return ok(aVisitante(v));
  })],
  ['GET', /^\/panel\/reportes$/, conRol(ENTE, ({ q }) => {
    const [desde, hasta] = periodo(q);
    return ok(reporte(desde, hasta, { comercio: Number(q.get('comercio_id')) || null, categoria: Number(q.get('categoria_id')) || 0, localidad: Number(q.get('localidad_id')) || 0 }));
  })],
  ['GET', /^\/panel\/actividad$/, conRol(GESTION, ({ q }, yo) => {
    const comercio = comercioDe(yo, q.get('comercio_id'));
    const [desde, hasta] = q.get('desde') || q.get('hasta') ? periodo(q) : ['', '9999'];
    const filas = base().actividad.filter((a) => (!comercio || a.comercio_id === comercio) && (!Number(q.get('usuario_id')) || a.usuario_id === Number(q.get('usuario_id')))
      && (!q.get('accion') || a.accion === q.get('accion')) && diaDe(a.ocurrido_el) >= desde && diaDe(a.ocurrido_el) <= hasta);
    return lista_(filas.map(aActividad), q);
  })],
  ['GET', /^\/panel\/exportar\/([a-z]+)$/, conRol(PERSONAL, ({ params, q }, yo) => {
    const recurso = params[0];
    if (['reportes', 'visitantes', 'comercios'].includes(recurso) && !esEnte(yo)) throw new Falla(403, 'ROL_NO_AUTORIZADO', 'Solo el Ente puede hacer esto.');
    if (['promociones', 'actividad'].includes(recurso) && yo.rol === 'empleado') throw new Falla(403, 'ROL_NO_AUTORIZADO', 'Tu usuario no puede exportar esto.');
    const comercio = esEnte(yo) ? Number(q.get('comercio_id')) || null : comercioDe(yo, q.get('comercio_id'));
    const [desde, hasta] = periodo(q);
    /** El CSV junta todas las páginas del listado, con los mismos filtros. */
    const todas = <T>(ruta: string): T[] => {
      const r = RUTAS.find(([m, re]) => m === 'GET' && re.test(ruta))!;
      const sinPagina = new URLSearchParams(q); sinPagina.delete('pagina'); sinPagina.set('limite', '100');
      const salida: T[] = [];
      for (let pagina = 1; ; pagina++) {
        sinPagina.set('pagina', String(pagina));
        const res = r[2]({ yo: () => yo, q: sinPagina, cuerpo: {}, crudo: undefined, params: [] }) as Respuesta;
        const s = res.cuerpo as { data: T[]; meta: Meta };
        salida.push(...s.data);
        if (pagina * 100 >= s.meta.total) return salida;
      }
    };
    switch (recurso) {
      case 'canjes':
        return csv(recurso, [['canjeado_el', 'Fecha'], ['codigo', 'Código'], ['titulo', 'Promoción'], ['beneficio', 'Beneficio'], ['comercio', 'Comercio'], ['turista', 'Visitante'], ['usuario', 'Canjeó'], ['observaciones', 'Observaciones']],
          todas<CanjeApi>('/panel/canjes').map((c) => ({ canjeado_el: c.canjeado_el, codigo: c.codigo, titulo: c.promocion.titulo, beneficio: c.promocion.descuento_visual, comercio: c.comercio.nombre, turista: c.turista.nombre, usuario: c.usuario.nombre, observaciones: c.observaciones })));
      case 'promociones':
        return csv(recurso, [['titulo', 'Promoción'], ['comercio', 'Comercio'], ['localidad', 'Localidad'], ['categoria', 'Categoría'], ['beneficio', 'Beneficio'], ['estado', 'Estado'], ['desde', 'Desde'], ['hasta', 'Hasta'], ['cupos', 'Cupos'], ['entregados', 'Entregados'], ['canjeados', 'Canjeados']],
          todas<PromocionGestionApi>('/panel/promociones').map((p) => ({ titulo: p.titulo, comercio: p.comercio.nombre, localidad: p.comercio.lugar, categoria: p.categoria.nombre, beneficio: p.descuento_visual, estado: p.estado, desde: p.fecha_desde, hasta: p.fecha_hasta, cupos: p.cupos_totales, entregados: p.cupos_emitidos, canjeados: p.cupos_canjeados })));
      case 'actividad':
        return csv(recurso, [['ocurrido_el', 'Fecha'], ['accion', 'Acción'], ['descripcion', 'Detalle'], ['usuario', 'Usuario'], ['comercio', 'Comercio']],
          todas<ActividadApi>('/panel/actividad').filter((a) => diaDe(a.ocurrido_el) >= desde && diaDe(a.ocurrido_el) <= hasta).map((a) => ({ ocurrido_el: a.ocurrido_el, accion: a.accion, descripcion: a.descripcion, usuario: a.usuario?.nombre, comercio: a.comercio?.nombre })));
      case 'visitantes':
        return csv(recurso, [['registrado_el', 'Registro'], ['nombre', 'Visitante'], ['provincia', 'Provincia'], ['pais', 'País'], ['rango_edad', 'Edad'], ['duracion', 'Estadía'], ['motivo', 'Motivo'], ['compania', 'Viaja'], ['medio', 'Nos conoció por'], ['cupones', 'Cupones'], ['canjeados', 'Canjeados']],
          todas<VisitanteApi>('/panel/visitantes').map((v) => ({ registrado_el: v.registrado_el, nombre: v.nombre, provincia: v.provincia?.nombre, pais: v.pais?.nombre, rango_edad: v.rango_edad, duracion: v.duracion, motivo: v.motivo, compania: v.compania, medio: v.medio, cupones: v.cupones_emitidos, canjeados: v.cupones_canjeados })));
      case 'comercios':
        return csv(recurso, [['nombre', 'Comercio'], ['categoria', 'Categoría'], ['localidad', 'Localidad'], ['direccion', 'Dirección'], ['telefono', 'Teléfono'], ['email', 'Email'], ['estado', 'Estado'], ['publicadas', 'Promociones publicadas'], ['cupones', 'Cupones'], ['canjeados', 'Canjeados']],
          todas<ComercioApi>('/panel/comercios').map((c) => ({ nombre: c.nombre, categoria: c.categoria.nombre, localidad: c.localidad.nombre, direccion: c.direccion, telefono: c.telefono_contacto, email: c.email_contacto, estado: c.estado, publicadas: c.numeros.promociones_publicadas, cupones: c.numeros.cupones_emitidos, canjeados: c.numeros.cupones_canjeados })));
      case 'reportes': {
        const r = reporte(desde, hasta, { comercio, categoria: Number(q.get('categoria_id')) || 0, localidad: Number(q.get('localidad_id')) || 0 });
        const filas = [
          ...Object.entries(r.totales).map(([etiqueta, cantidad]) => ({ grupo: 'total', etiqueta, cantidad, canjeados: '' })),
          ...r.serie.map((d) => ({ grupo: 'dia', etiqueta: d.fecha, cantidad: d.emitidos, canjeados: d.canjeados })),
          ...Object.entries(r.grupos).flatMap(([grupo, items]) => (items ?? []).map((i) => ({ grupo, etiqueta: i.etiqueta, cantidad: i.cantidad, canjeados: i.canjeados ?? '' }))),
        ];
        return csv(recurso, [['grupo', 'Grupo'], ['etiqueta', 'Indicador'], ['cantidad', 'Cantidad'], ['canjeados', 'Canjeados']], filas);
      }
    }
    throw new Falla(404, 'RECURSO_INEXISTENTE', 'No se puede exportar eso.');
  })],
];

function datosComercio(b: Record<string, unknown>, actual: ComercioFila | null) {
  const v = (k: string) => String((k in b ? b[k] : (actual as Record<string, unknown> | null)?.[k]) ?? '').trim();
  const d = {
    nombre: v('nombre'), categoria_id: Number(v('categoria_id')), direccion: v('direccion'), localidad_id: Number(v('localidad_id')),
    email_contacto: v('email_contacto') || null, telefono_contacto: v('telefono_contacto') || null,
  };
  const err: Record<string, string> = {};
  if (d.nombre.length < 2 || d.nombre.length > 180) err.nombre = 'Entre 2 y 180 caracteres';
  if (!opcion(CATEGORIAS, d.categoria_id)) err.categoria_id = 'Requerido';
  if (!d.direccion) err.direccion = 'Requerido';
  if (!localidad(d.localidad_id)) err.localidad_id = 'Requerido';
  if (d.email_contacto && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email_contacto)) err.email_contacto = 'Email inválido';
  if (Object.keys(err).length) throw validacion('Revisá los datos del comercio.', err);
  return d;
}

// ================================================================== entrada
export async function simular(metodo: Metodo, ruta: string, { cuerpo, token }: Pedido): Promise<Respuesta> {
  if (typeof window !== 'undefined') await new Promise((r) => setTimeout(r, 300)); // que se vean los estados de carga
  const [camino, consulta = ''] = ruta.split('?');
  const q = new URLSearchParams(consulta);
  try {
    for (const [m, re, manejar] of RUTAS) {
      const params = m === metodo ? re.exec(camino) : null;
      if (!params) continue;
      const datos = cuerpo && typeof cuerpo === 'object' && !(cuerpo instanceof FormData) ? (cuerpo as Record<string, unknown>) : {};
      let yo: Yo | null = null;
      return await manejar({ yo: () => (yo ??= quienEs(token)), q, cuerpo: datos, crudo: cuerpo, params: params.slice(1) });
    }
    return { http: 404, cuerpo: { ok: false, error: { codigo: 'NO_ENCONTRADO', mensaje: `No existe ${metodo} ${camino}.`, detalles: null } } };
  } catch (e) {
    if (e instanceof Falla) return { http: e.http, cuerpo: { ok: false, error: { codigo: e.codigo, mensaje: e.message, detalles: e.detalles } } };
    console.error('[simulador del panel]', e);
    return { http: 500, cuerpo: { ok: false, error: { codigo: 'ERROR_INTERNO_SERVIDOR', mensaje: 'Ocurrió un error inesperado al procesar la solicitud.', detalles: null } } };
  }
}
