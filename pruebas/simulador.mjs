// Prueba del simulador del panel, conectado al del turista (como en producción, donde comparten el almacenamiento).
// Uso, desde projects/admin:   node pruebas/simulador.mjs      (Node 22.18+ o 24: importa los .ts directo)
// Sale con código 1 si algún chequeo falla.

const memoria = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoria.has(k) ? memoria.get(k) : null),
  setItem: (k, v) => void memoria.set(k, String(v)),
  removeItem: (k) => void memoria.delete(k),
  key: (i) => [...memoria.keys()][i] ?? null,
  get length() { return memoria.size; },
};

const panel = await import('../lib/simulador.ts');
const turista = await import('../../turista/lib/simulador.ts');

const resultados = [];
const chequear = (nombre, condicion) => resultados.push([nombre, !!condicion]);
const P = (metodo, ruta, cuerpo, token) => panel.simular(metodo, ruta, { cuerpo, token });
const T = (metodo, ruta, cuerpo, token) => turista.simular(metodo, ruta, { cuerpo, token });
const codigo = (r) => r.cuerpo?.error?.codigo;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const entrar = async (usuario) => (await P('POST', '/auth/login', { usuario, password: panel.CLAVE_DE_PRUEBA })).cuerpo.data?.token;

// ---- 1. El turista guarda un cupón en su app ----
const google = `${b64({ alg: 'RS256' })}.${b64({ sub: '109876543210987654321', given_name: 'Mara', family_name: 'López', name: 'Mara López', email: 'mara@example.com' })}.firma`;
const tt = (await T('POST', '/auth/google', { id_token: google })).cuerpo.data.token;
await T('POST', '/turista/encuesta', { rango_edad_id: 2, duracion_id: 3, motivo_id: 1, compania_id: 5, medio_id: 6, provincia_id: null, pais_id: 53 }, tt);
const deTurista = (await T('POST', '/turista/cupones', { promocion_id: 1 }, tt)).cuerpo.data.codigo; // Empanadas, de Patio del Jardín (10)
chequear('el turista guarda un cupón', /^W[A-Z2-9]{6}$/.test(deTurista));

// ---- 2. Ingreso del personal ----
const lucia = await entrar('lucia.suarez'); // empleada de Patio del Jardín
const sofia = await entrar('sofia.valle'); // encargada de Casa del Valle
const martin = await entrar('martin.rios'); // encargado de Patio del Jardín
const carla = await entrar('carla.ente'); // Ente
chequear('ingresan los usuarios de prueba', lucia && sofia && martin && carla);
const loginLucia = await P('POST', '/auth/login', { usuario: 'Lucia.Suarez', password: panel.CLAVE_DE_PRUEBA });
chequear('login devuelve UsuarioSesion con su comercio', loginLucia.cuerpo.data.usuario.rol === 'empleado' && loginLucia.cuerpo.data.usuario.comercio.nombre === 'Patio del Jardín');
chequear('usuario bloqueado: 403 USUARIO_BLOQUEADO', codigo(await P('POST', '/auth/login', { usuario: 'pablo.mozo', password: panel.CLAVE_DE_PRUEBA })) === 'USUARIO_BLOQUEADO');
for (let i = 0; i < 5; i++) await P('POST', '/auth/login', { usuario: 'diego.valle', password: 'mal' });
chequear('5 intentos fallidos: 429', codigo(await P('POST', '/auth/login', { usuario: 'diego.valle', password: panel.CLAVE_DE_PRUEBA })) === 'DEMASIADOS_INTENTOS');
chequear('sin token: 401 TOKEN_REQUERIDO', codigo(await P('GET', '/panel/sesion')) === 'TOKEN_REQUERIDO');
chequear('token del turista no entra al panel', codigo(await P('GET', '/panel/sesion', undefined, tt)) === 'SESION_INVALIDA');

// ---- 3. Canje del cupón del turista ----
const v = await P('POST', '/panel/canjes/validar', { codigo: deTurista.toLowerCase() }, lucia);
chequear('validar trae la foto de la promoción (imagen_url)', 'imagen_url' in v.cuerpo.data.promocion);
chequear('el panel valida el cupón del turista (nombre e inicial)', v.http === 200 && v.cuerpo.data.turista.nombre === 'Mara L.' && v.cuerpo.data.cupon.estado === 'EMITIDO');
chequear('otro comercio: 403 CUPON_OTRO_COMERCIO', codigo(await P('POST', '/panel/canjes/validar', { codigo: deTurista }, sofia)) === 'CUPON_OTRO_COMERCIO');
chequear('el Ente no canjea: 403', codigo(await P('POST', '/panel/canjes', { codigo: deTurista }, carla)) === 'ROL_NO_AUTORIZADO');
const canje = await P('POST', '/panel/canjes', { codigo: deTurista, observaciones: 'Mesa 7' }, lucia);
chequear('canje 201 con el cupón en CANJEADO', canje.http === 201 && canje.cuerpo.data.cupon.estado === 'CANJEADO');
const otraVez = await P('POST', '/panel/canjes', { codigo: deTurista }, lucia);
chequear('canje doble: 409 con quién y cuándo', codigo(otraVez) === 'CUPON_YA_CANJEADO' && otraVez.cuerpo.error.detalles.canjeado_por.nombre === 'Lucía Suárez');
const enLaApp = (await T('GET', '/turista/cupones', undefined, tt)).cuerpo.data.find((c) => c.codigo === deTurista);
chequear('la app del turista lo ve CANJEADO', enLaApp.estado === 'CANJEADO' && enLaApp.canjeado_el);

// ---- 4. Códigos de prueba del panel ----
chequear('WAYKI25 se puede canjear', (await P('POST', '/panel/canjes/validar', { codigo: 'WAYKI25' }, lucia)).http === 200);
chequear('USADO01 ya canjeado', codigo(await P('POST', '/panel/canjes/validar', { codigo: 'USADO01' }, lucia)) === 'CUPON_YA_CANJEADO');
chequear('VENC001 vencido', codigo(await P('POST', '/panel/canjes/validar', { codigo: 'VENC001' }, lucia)) === 'CUPON_VENCIDO');
chequear('AJENO01 de otro comercio', codigo(await P('POST', '/panel/canjes/validar', { codigo: 'AJENO01' }, lucia)) === 'CUPON_OTRO_COMERCIO');
chequear('código inexistente: 404', codigo(await P('POST', '/panel/canjes/validar', { codigo: 'NOEXISTE' }, lucia)) === 'CUPON_INEXISTENTE');
const penia = await P('POST', '/panel/canjes/validar', { codigo: 'PENIA01' }, lucia);
chequear('PENIA01 respeta días y horario', penia.http === 200 || ['FUERA_DE_DIA', 'FUERA_DE_HORARIO'].includes(codigo(penia)));

// ---- 5. Promociones ----
chequear('el empleado no gestiona promociones', codigo(await P('GET', '/panel/promociones', undefined, lucia)) === 'ROL_NO_AUTORIZADO');
const mias = (await P('GET', '/panel/promociones?limite=100', undefined, martin)).cuerpo.data;
chequear('el encargado ve solo las de su comercio', mias.length > 0 && mias.every((p) => p.comercio.id === 10));
const mala = await P('POST', '/panel/promociones', { titulo: 'x', modalidad_id: 6, fecha_desde: '2026-12-01', fecha_hasta: '2026-11-01', cupos_totales: 0 }, martin);
chequear('validación con un mensaje por campo', codigo(mala) === 'VALIDACION_FALLIDA' && mala.cuerpo.error.detalles.titulo && mala.cuerpo.error.detalles.modalidad_personalizada && mala.cuerpo.error.detalles.cupos_totales);
const nueva = await P('POST', '/panel/promociones', { titulo: 'Té de la tarde', modalidad_id: 1, fecha_desde: '2026-11-01', fecha_hasta: '2027-01-31', cupos_totales: 50, dias_validos: ['LUN', 'MAR'], horario: { desde: '16:00', hasta: '19:30' }, estado: 'PUBLICADA' }, martin);
chequear('crear y publicar: 201 PUBLICADA, 2×1', nueva.http === 201 && nueva.cuerpo.data.estado === 'PUBLICADA' && nueva.cuerpo.data.descuento_visual === '2×1' && nueva.cuerpo.data.comercio.id === 10);
const id = nueva.cuerpo.data.id;
chequear('PUBLICADA → BORRADOR: 409 con los permitidos', codigo(await P('PATCH', `/panel/promociones/${id}/estado`, { estado: 'BORRADOR' }, martin)) === 'TRANSICION_INVALIDA');
chequear('el Ente la pausa', (await P('PATCH', `/panel/promociones/${id}/estado`, { estado: 'PAUSADA', motivo: 'Revisar condiciones' }, carla)).cuerpo.data.estado === 'PAUSADA');
chequear('promoción de otro comercio: 404', codigo(await P('PATCH', '/panel/promociones/6/estado', { estado: 'PAUSADA' }, martin)) === 'NO_ENCONTRADO');
chequear('el encargado no destaca: 403', codigo(await P('PUT', `/panel/promociones/${id}`, { destacada: true }, martin)) === 'ROL_NO_AUTORIZADO');
chequear('editar no baja cupos debajo de lo entregado', codigo(await P('PUT', '/panel/promociones/1', { cupos_totales: 10 }, martin)) === 'VALIDACION_FALLIDA');

// ---- 6. Usuarios ----
const nuevoUsuario = await P('POST', '/panel/usuarios', { usuario: 'Nico.Mozo', nombre: 'Nico Mozo', rol: 'admin_ente' }, martin);
chequear('el encargado crea un empleado (el rol se fuerza) con contraseña temporal', nuevoUsuario.http === 201 && nuevoUsuario.cuerpo.data.rol === 'empleado' && nuevoUsuario.cuerpo.data.usuario === 'nico.mozo' && nuevoUsuario.cuerpo.data.password_temporal);
chequear('usuario repetido: 409', codigo(await P('POST', '/panel/usuarios', { usuario: 'nico.mozo', nombre: 'Otro' }, martin)) === 'USUARIO_REPETIDO');
chequear('el Ente no crea usuarios del Ente', codigo(await P('POST', '/panel/usuarios', { usuario: 'otra.ente', nombre: 'Otra Ente', rol: 'admin_ente' }, carla)) === 'ROL_NO_AUTORIZADO');
chequear('nadie se administra a sí mismo', codigo(await P('PATCH', '/panel/usuarios/3/estado', { estado: 'BAJA' }, martin)) === 'NO_ENCONTRADO');

// ---- 7. Ente: visitantes, reportes, CSV, resumen ----
const visitantes = (await P('GET', '/panel/visitantes?limite=100', undefined, carla)).cuerpo.data;
const mara = visitantes.find((x) => x.nombre === 'Mara López');
chequear('el turista de la app aparece en Visitantes con su encuesta', mara && mara.procedencia === 'Chile' && mara.cupones_canjeados === 1);
const r = (await P('GET', '/panel/reportes', undefined, carla)).cuerpo.data;
chequear('el reporte cuenta el cupón y el canje de hoy', r.totales.emitidos >= 1 && r.totales.canjeados >= 1 && r.grupos.procedencia.some((g) => g.etiqueta === 'Chile'));
chequear('el encargado no ve reportes', codigo(await P('GET', '/panel/reportes', undefined, martin)) === 'ROL_NO_AUTORIZADO');
const archivo = await P('GET', '/panel/exportar/canjes', undefined, lucia);
chequear('CSV con BOM, encabezado y el canje', archivo.csv?.texto.startsWith('﻿Fecha;Código;Promoción') && archivo.csv.texto.includes(deTurista) && archivo.csv.archivo.startsWith('wayki-canjes-'));
chequear('el empleado no exporta visitantes', codigo(await P('GET', '/panel/exportar/visitantes', undefined, lucia)) === 'ROL_NO_AUTORIZADO');
const resumen = (await P('GET', '/panel/resumen', undefined, lucia)).cuerpo.data;
chequear('resumen del empleado con sus canjes de hoy', resumen.rol === 'empleado' && resumen.canjes_hoy >= 1);
const actividad = (await P('GET', '/panel/actividad', undefined, martin)).cuerpo.data;
chequear('actividad del encargado: solo su comercio', actividad.length > 0 && actividad.every((a) => a.comercio?.id === 10));

// ---- 8. Bloqueos y suspensiones valen al instante ----
await P('PATCH', '/panel/comercios/10/estado', { estado: 'SUSPENDIDO', motivo: 'Inspección pendiente' }, carla);
chequear('comercio suspendido: no se canjea', codigo(await P('POST', '/panel/canjes/validar', { codigo: 'WAYKI25' }, lucia)) === 'COMERCIO_SUSPENDIDO');
await P('PATCH', '/panel/usuarios/4/estado', { estado: 'BLOQUEADO' }, martin);
chequear('usuario bloqueado: su token deja de valer', codigo(await P('GET', '/panel/sesion', undefined, lucia)) === 'SESION_INVALIDA');

let fallas = 0;
for (const [nombre, bien] of resultados) { if (!bien) fallas++; console.log(bien ? 'ok   ' : 'FALLA', nombre); }
console.log(`\n${resultados.length - fallas} de ${resultados.length} chequeos bien.`);
process.exit(fallas ? 1 : 0);
