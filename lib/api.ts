// Cliente de la API de Wayki Promo para el panel. El contrato es api-doc/contrato-api.html (fuente:
// api-doc/contrato/datos.mjs): los tipos *Api de abajo copian sus objetos. Si cambia el contrato, cambian juntos este
// archivo y lib/simulador.ts.
//
// Se activa POR ETAPAS, como en la app del turista: NEXT_PUBLIC_API_URL (termina en /v1) + NEXT_PUBLIC_API_ETAPAS.
// Lo que no está activado lo responde lib/simulador.ts con el MISMO formato y los mismos códigos de error.
// Etapas (los grupos del contrato) y lo que tiene que tener la API para encender cada una:
//   sesion       POST /auth/login · GET /panel/sesion · PUT /panel/password · GET /panel/resumen
//   catalogos    GET /categorias · /modalidades · /circuitos · /localidades
//   canje        POST /panel/canjes/validar · POST /panel/canjes · GET /panel/canjes
//   promociones  /panel/promociones (listar, ver, crear, editar, estado, imagen)
//   comercios    /panel/comercios (listar, ver, crear, editar, estado, logo)
//   usuarios     /panel/usuarios (listar, crear, editar, estado, contraseña nueva)
//   ente         /panel/visitantes · /panel/reportes · /panel/actividad · /panel/exportar/{recurso}

import { simular } from '@/lib/simulador';

export type Etapa = 'sesion' | 'catalogos' | 'canje' | 'promociones' | 'comercios' | 'usuarios' | 'ente';
export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const URL_API = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const ETAPAS = (process.env.NEXT_PUBLIC_API_ETAPAS ?? '').split(',').map((e) => e.trim());

/** true si la etapa la responde la API real; false si la simula el navegador. */
export const conApi = (e: Etapa) => URL_API !== '' && ETAPAS.includes(e);

/** Error de negocio o de red. `message` ya está escrito para mostrarlo; `detalles` trae lo de cada campo o caso. */
export class ErrorApi extends Error {
  readonly http: number;
  readonly codigo: string;
  readonly detalles: Record<string, unknown> | null;
  constructor(http: number, codigo: string, mensaje: string, detalles: Record<string, unknown> | null = null) {
    super(mensaje);
    this.http = http;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

/** `cuerpo` puede ser JSON o un FormData (subir imágenes). */
export type Pedido = { cuerpo?: unknown; token?: string | null };
/** Lo que responde la API (o el simulador): el sobre JSON, o el texto de un CSV. */
export type Respuesta = { http: number; cuerpo: unknown; csv?: { texto: string; archivo: string } };
type Error_ = { codigo: string; mensaje: string; detalles?: Record<string, unknown> | null };
type Sobre<T> = { ok: true; data: T; meta?: Meta } | { ok: false; error: Error_ };

async function responder(etapa: Etapa, metodo: Metodo, ruta: string, pedido: Pedido): Promise<Respuesta> {
  return conApi(etapa) ? pedir(metodo, ruta, pedido) : simular(metodo, ruta, pedido);
}

function sobre<T>({ http, cuerpo }: Respuesta): { data: T; meta?: Meta } {
  const r = cuerpo as Sobre<T> | null;
  if (r?.ok) return r;
  throw new ErrorApi(http, r?.error.codigo ?? 'ERROR', r?.error.mensaje ?? 'Algo falló de nuestro lado. Probá de nuevo en un rato.', r?.error.detalles ?? null);
}

/** Un pedido: devuelve `data`. */
export async function api<T>(etapa: Etapa, metodo: Metodo, ruta: string, pedido: Pedido = {}): Promise<T> {
  return sobre<T>(await responder(etapa, metodo, ruta, pedido)).data;
}

/** Un listado paginado: devuelve `data` y `meta`. */
export async function apiLista<T>(etapa: Etapa, ruta: string, token: string | null): Promise<{ datos: T[]; meta: Meta }> {
  const { data, meta } = sobre<T[]>(await responder(etapa, 'GET', ruta, { token }));
  return { datos: data, meta: meta ?? { pagina: 1, limite: data.length, total: data.length } };
}

/** GET /panel/exportar/{recurso}: el CSV como texto y el nombre de archivo que sugiere la API. */
export async function apiCsv(ruta: string, token: string | null): Promise<{ texto: string; archivo: string }> {
  const r = await responder('ente', 'GET', ruta, { token });
  if (r.csv) return r.csv;
  sobre(r); // si no vino un CSV, es un error: lo tira con su mensaje
  throw new ErrorApi(r.http, 'ERROR', 'No llegó el archivo. Probá de nuevo.');
}

async function pedir(metodo: Metodo, ruta: string, { cuerpo, token }: Pedido): Promise<Respuesta> {
  try {
    const esArchivo = cuerpo instanceof FormData;
    const r = await fetch(URL_API + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && !esArchivo && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: cuerpo === undefined ? undefined : esArchivo ? cuerpo : JSON.stringify(cuerpo),
    });
    if ((r.headers.get('Content-Type') ?? '').includes('text/csv')) {
      const archivo = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? 'wayki.csv';
      return { http: r.status, cuerpo: null, csv: { texto: await r.text(), archivo } };
    }
    return { http: r.status, cuerpo: await r.json().catch(() => null) };
  } catch {
    return { http: 0, cuerpo: { ok: false, error: { codigo: 'SIN_CONEXION', mensaje: 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.' } } };
  }
}

// ---------- Contrato (objetos de api-doc/contrato-api.html) ----------

export type Rol = 'superadmin' | 'admin_ente' | 'encargado' | 'empleado';
export type Opcion = { id: number; nombre: string };
export type Meta = { pagina: number; limite: number; total: number };
export type Horario = { desde: string; hasta: string } | null;

/** POST /auth/login → data.usuario y GET /panel/sesion → data. */
export type UsuarioSesionApi = {
  id: number;
  usuario: string;
  nombre: string;
  email: string | null;
  rol: Rol;
  comercio: { id: number; nombre: string; estado: EstadoComercio } | null;
  ultimo_acceso: string | null;
};
export type LoginApi = { token: string; expira_el: string; usuario: UsuarioSesionApi };

export type EstadoUsuario = 'ACTIVO' | 'BLOQUEADO' | 'BAJA';
export type UsuarioApi = {
  id: number;
  usuario: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  rol: Rol;
  estado: EstadoUsuario;
  comercio: Opcion | null;
  ultimo_acceso: string | null;
  creado_el: string;
};

export type EstadoComercio = 'AUTORIZADO' | 'SUSPENDIDO' | 'PENDIENTE' | 'RECHAZADO';
export type ComercioApi = {
  id: number;
  nombre: string;
  categoria: Opcion;
  direccion: string;
  localidad: Opcion;
  circuito: Opcion | null;
  email_contacto: string | null;
  telefono_contacto: string | null;
  logo_url: string | null;
  estado: EstadoComercio;
  motivo_estado: string | null;
  autorizado_el: string | null;
  creado_el: string;
  numeros: { promociones_publicadas: number; usuarios_activos: number; cupones_emitidos: number; cupones_canjeados: number };
};

/** Promocion (catálogo): la base de PromocionGestion. */
export type PromocionApi = {
  id: number;
  titulo: string;
  descripcion_corta: string;
  comercio: { id: number; nombre: string; lugar: string };
  categoria: Opcion;
  descuento_visual: string;
  fecha_desde: string;
  fecha_hasta: string;
  dias_validos: string[] | null;
  horario: Horario;
  cupos_disponibles: number;
  cupos_totales: number;
  imagen_url: string | null;
  destacada: boolean;
};
export type EstadoPromocion = 'BORRADOR' | 'PUBLICADA' | 'PAUSADA' | 'FINALIZADA' | 'BAJA';
export type ModalidadApi = { id: number; nombre: string; tipo: 'PROMOCION' | 'PORCENTAJE' | 'IMPORTE' | 'PERSONALIZADO'; valor: number | null };
export type PromocionGestionApi = PromocionApi & {
  estado: EstadoPromocion;
  publica: boolean;
  descripcion: string | null;
  condiciones: string | null;
  modalidad: ModalidadApi;
  modalidad_personalizada: string | null;
  cupos_emitidos: number;
  cupos_canjeados: number;
  creado_por: Opcion;
  creado_el: string;
  actualizado_el: string;
};
/** POST /panel/promociones ← cuerpo (en PUT, lo que no se manda queda como estaba). */
export type PromocionCuerpo = {
  titulo?: string;
  descripcion?: string | null;
  condiciones?: string | null;
  modalidad_id?: number;
  modalidad_personalizada?: string | null;
  fecha_desde?: string;
  fecha_hasta?: string;
  dias_validos?: string[] | null;
  horario?: Horario;
  cupos_totales?: number;
  categoria_id?: number;
  comercio_id?: number;
  estado?: 'BORRADOR' | 'PUBLICADA';
  destacada?: boolean;
};

/** POST /panel/canjes/validar → data (y detalles de sus errores 409). */
export type CuponEnMostradorApi = {
  cupon: { codigo: string; estado: 'EMITIDO' | 'CANJEADO' | 'VENCIDO' | 'ANULADO'; emitido_el: string; vence_el: string };
  promocion: { id: number; titulo: string; descuento_visual: string; condiciones: string | null; dias_validos: string[] | null; horario: Horario; imagen_url: string | null };
  turista: { nombre: string };
};
/** POST /panel/canjes → data. */
export type CanjeHechoApi = CuponEnMostradorApi & { canje_id: number; canjeado_el: string };
export type CanjeApi = {
  id: number;
  canjeado_el: string;
  codigo: string;
  promocion: { id: number; titulo: string; descuento_visual: string };
  comercio: Opcion;
  turista: { nombre: string };
  usuario: Opcion;
  observaciones: string | null;
};

export type VisitanteApi = {
  id: number;
  nombre: string;
  procedencia: string | null;
  provincia: Opcion | null;
  pais: Opcion | null;
  rango_edad: string | null;
  duracion: string | null;
  motivo: string | null;
  compania: string | null;
  medio: string | null;
  cupones_emitidos: number;
  cupones_canjeados: number;
  registrado_el: string;
  ultimo_acceso: string | null;
};

export type ItemReporte = { id?: number; etiqueta: string; cantidad: number; canjeados?: number };
export type ReporteApi = {
  periodo: { desde: string; hasta: string };
  totales: { visitantes: number; emitidos: number; canjeados: number; promociones_activas: number; comercios_activos: number; tasa_canje: number };
  serie: { fecha: string; emitidos: number; canjeados: number }[];
  grupos: Partial<Record<'procedencia' | 'rango_edad' | 'duracion' | 'motivo' | 'compania' | 'medio' | 'categoria' | 'localidad' | 'comercio' | 'promocion', ItemReporte[]>>;
};
export type ActividadApi = {
  id: number;
  ocurrido_el: string;
  accion: string;
  descripcion: string;
  usuario: { id: number; nombre: string; rol: Rol } | null;
  comercio: Opcion | null;
  entidad: { tipo: string; id: number } | null;
};
/** GET /panel/resumen → data: una forma para el empleado y otra para el resto. */
export type ResumenApi =
  | { rol: 'empleado'; canjes_hoy: number; ultimos_canjes: CanjeApi[] }
  | {
      rol: Exclude<Rol, 'empleado'>;
      periodo: ReporteApi['periodo'];
      totales: ReporteApi['totales'];
      serie: ReporteApi['serie'];
      promociones_top: ItemReporte[];
      categorias: ItemReporte[];
      actividad: ActividadApi[];
    };
