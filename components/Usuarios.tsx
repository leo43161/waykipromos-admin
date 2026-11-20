'use client';

// Usuarios del panel. El Ente ve a todos y crea encargados y empleados (el superadmin, también gente del Ente);
// el encargado ve y crea a los empleados de su comercio ("Mi equipo"). La contraseña temporal la genera la API
// y se muestra una sola vez. Contrato: GET/POST /panel/usuarios, PUT …/{id}, PATCH …/estado, POST …/password.
// ?nuevo&comercio_id=N abre el alta para ese comercio (botón "Agregar persona" de la ficha del comercio).

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Dialogo from '@/components/Dialogo';
import { useSesion } from '@/components/Marco';
import { api, apiLista, ErrorApi, type ComercioApi, type EstadoUsuario, type Rol, type UsuarioApi } from '@/lib/api';
import { fecha, fechaHora, numero } from '@/lib/formato';
import { ADMINISTRA, ROLES } from '@/lib/roles';
import { getToken } from '@/lib/sesion';
import { mensajeDe, useCarga } from '@/lib/useCarga';
import s from './Gestion.module.css';

const ESTADOS: Record<EstadoUsuario, [string, string]> = { ACTIVO: ['Activo', s.bien], BLOQUEADO: ['Bloqueado', s.mal], BAJA: ['De baja', s.neutro] };
const COMERCIO: Rol[] = ['encargado', 'empleado']; // roles que pertenecen a un comercio

/** "Lucía Suárez" → "lucia.suarez" (el usuario con el que va a entrar). */
const sugerirUsuario = (nombre: string) => nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  .replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');

export default function Usuarios() {
  const sesion = useSesion();
  const router = useRouter();
  const params = useSearchParams();
  const esEnte = sesion.rol === 'admin_ente' || sesion.rol === 'superadmin';
  const puedeCrear = ADMINISTRA[sesion.rol] ?? [];
  const comercios = useCarga(async () => esEnte ? (await apiLista<ComercioApi>('comercios', '/panel/comercios?limite=100', getToken())).datos : [], []).dato ?? [];

  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [estado, setEstado] = useState('');
  const [comercio, setComercio] = useState('');
  const [pagina, setPagina] = useState(1);
  const [alta, setAlta] = useState(params.has('nuevo'));
  const [elegido, setElegido] = useState<UsuarioApi | null>(null);
  const [clave, setClave] = useState<{ nombre: string; usuario: string; password: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(texto.trim()); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  const p = new URLSearchParams({ pagina: String(pagina), limite: '20' });
  if (q) p.set('q', q);
  if (rol) p.set('rol', rol);
  if (estado) p.set('estado', estado);
  if (comercio) p.set('comercio_id', comercio);
  const ruta = `/panel/usuarios?${p}`;
  const { dato, error, cargando, recargar } = useCarga(() => apiLista<UsuarioApi>('usuarios', ruta, getToken()), [ruta]);
  const total = dato?.meta.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / 20));
  const cambiar = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { f(e.target.value); setPagina(1); };
  const administra = (u: UsuarioApi) => u.id !== sesion.id && puedeCrear.includes(u.rol);
  const cerrarAlta = () => { setAlta(false); if (params.has('nuevo')) router.replace('/usuarios/'); };

  return (
    <main id="contenido" className={`${s.main} content-width`}>
      <div className={s.cabecera}>
        <div>
          <h1>{esEnte ? 'Usuarios' : 'Mi equipo'}</h1>
          <p>{esEnte ? 'Quién entra al panel: el equipo del Ente y el personal de cada comercio.' : 'Las personas que canjean cupones en tu comercio.'}</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setAlta(true)}>{esEnte ? 'Crear usuario' : 'Agregar empleado'}</button>
      </div>

      <div className={s.filtros} role="search">
        <label className="field">Buscar
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={esEnte ? 'Nombre, usuario, correo o comercio' : 'Nombre o usuario'} />
        </label>
        {esEnte && (
          <label className="field">Rol
            <select value={rol} onChange={cambiar(setRol)}>
              <option value="">Todos</option>
              {(Object.keys(ROLES) as Rol[]).map((r) => <option key={r} value={r}>{ROLES[r].nombre}</option>)}
            </select>
          </label>
        )}
        <label className="field">Estado
          <select value={estado} onChange={cambiar(setEstado)}>
            <option value="">Todos</option>
            {(Object.keys(ESTADOS) as EstadoUsuario[]).map((e) => <option key={e} value={e}>{ESTADOS[e][0]}</option>)}
          </select>
        </label>
        {esEnte && (
          <label className="field">Comercio
            <select value={comercio} onChange={cambiar(setComercio)}>
              <option value="">Todos</option>
              {comercios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <p className={s.contador} aria-live="polite">{cargando ? 'Cargando…' : `${numero(total)} ${total === 1 ? 'persona' : 'personas'}`}</p>

      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead><tr><th>Persona</th><th>Rol</th>{esEnte && <th>Comercio</th>}<th>Estado</th><th>Último ingreso</th><th><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>
            {dato?.datos.map((u) => (
              <tr key={u.id}>
                <td><div className={s.nombre}><strong>{u.nombre}</strong><small>{u.usuario}{u.email && ` · ${u.email}`}</small></div></td>
                <td>{ROLES[u.rol].nombre}</td>
                {esEnte && <td>{u.comercio?.nombre ?? 'Ente Tucumán Turismo'}</td>}
                <td><span className={`${s.estado} ${ESTADOS[u.estado][1]}`}>{ESTADOS[u.estado][0]}</span></td>
                <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca'}</td>
                <td className={s.num}>
                  {administra(u)
                    ? <button type="button" className="btn ghost" onClick={() => setElegido(u)} aria-label={`Gestionar a ${u.nombre}`}>Gestionar</button>
                    : u.id === sesion.id && <span className={s.contador}>Sos vos</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dato && !dato.datos.length && <p className={s.vacio}>{q || rol || estado || comercio ? 'No encontramos personas con esos filtros.' : 'Todavía no hay nadie. Agregá a la primera persona.'}</p>}
      </div>

      {paginas > 1 && (
        <nav className={s.paginas} aria-label="Páginas">
          <span>Página {pagina} de {paginas}</span>
          <div>
            <button type="button" className="btn secondary" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
            <button type="button" className="btn secondary" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
          </div>
        </nav>
      )}

      <Dialogo abierto={alta} onCerrar={cerrarAlta} titulo={esEnte ? 'Crear usuario' : 'Agregar empleado'}>
        <FormAlta roles={puedeCrear} comercios={esEnte ? comercios : null} comercioInicial={params.get('comercio_id') ?? ''}
          onListo={(u, password) => { cerrarAlta(); recargar(); if (password) setClave({ nombre: u.nombre, usuario: u.usuario, password }); }}
          onCancelar={cerrarAlta} />
      </Dialogo>

      <Dialogo abierto={!!elegido} onCerrar={() => setElegido(null)} titulo={elegido?.nombre ?? ''}>
        {elegido && <Gestionar usuario={elegido} roles={puedeCrear} onCambio={(u) => { setElegido(u); recargar(); }}
          onClave={(password) => { setClave({ nombre: elegido.nombre, usuario: elegido.usuario, password }); setElegido(null); }} />}
      </Dialogo>

      <Dialogo abierto={!!clave} onCerrar={() => setClave(null)} titulo="Contraseña temporal">
        {clave && <MostrarClave {...clave} onListo={() => setClave(null)} />}
      </Dialogo>
    </main>
  );
}

// ------------------------------------------------------------------ alta
function FormAlta({ roles, comercios, comercioInicial, onListo, onCancelar }: {
  roles: Rol[];
  comercios: ComercioApi[] | null; // null = encargado (su comercio lo pone la API)
  comercioInicial: string;
  onListo: (u: UsuarioApi, password: string | null) => void;
  onCancelar: () => void;
}) {
  const [rol, setRol] = useState<Rol>(roles.includes('encargado') && comercioInicial ? 'encargado' : roles[roles.length - 1] ?? 'empleado');
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [tocado, setTocado] = useState(false); // si escribió el usuario a mano, no se lo pisamos
  const [comercioId, setComercioId] = useState(comercioInicial); // controlado: la lista llega después de abrir
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const conComercio = comercios && COMERCIO.includes(rol);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setEnviando(true); setError(null); setCampos({});
    try {
      const r = await api<UsuarioApi & { password_temporal?: string }>('usuarios', 'POST', '/panel/usuarios', {
        cuerpo: {
          usuario, nombre: nombre.trim(), email: String(f.get('email') ?? '').trim() || null, telefono: String(f.get('telefono') ?? '').trim() || null,
          rol, ...(conComercio && { comercio_id: Number(comercioId) || null }),
        },
        token: getToken(),
      });
      onListo(r, r.password_temporal ?? null);
    } catch (err) {
      setError(mensajeDe(err));
      if (err instanceof ErrorApi && err.detalles) setCampos(Object.fromEntries(Object.entries(err.detalles).filter(([, v]) => typeof v === 'string')) as Record<string, string>);
    } finally {
      setEnviando(false);
    }
  }

  const err = (k: string) => campos[k] && <span className={s.errorCampo}>{campos[k]}</span>;
  return (
    <form className={s.form} onSubmit={enviar} noValidate>
      {roles.length > 1 && (
        <label className="field">Rol
          <select value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {roles.map((r) => <option key={r} value={r}>{ROLES[r].nombre}: {ROLES[r].quien}</option>)}
          </select>
        </label>
      )}
      {conComercio && (
        <label className="field">Comercio
          <select value={comercioId} onChange={(e) => setComercioId(e.target.value)} required aria-invalid={!!campos.comercio_id}>
            <option value="" disabled>Elegí el comercio</option>
            {comercios.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.localidad.nombre})</option>)}
          </select>{err('comercio_id')}
        </label>
      )}
      <label className="field">Nombre y apellido
        <input value={nombre} onChange={(e) => { setNombre(e.target.value); if (!tocado) setUsuario(sugerirUsuario(e.target.value)); }} required maxLength={120} aria-invalid={!!campos.nombre} />{err('nombre')}
      </label>
      <label className="field">Usuario <small>Con esto entra al panel. Letras, números, punto o guion.</small>
        <input value={usuario} onChange={(e) => { setTocado(true); setUsuario(e.target.value.toLowerCase().replace(/\s/g, '')); }} required maxLength={100} autoCapitalize="none" spellCheck={false} aria-invalid={!!campos.usuario} />{err('usuario')}
      </label>
      <div className={s.dosCol}>
        <label className="field">Correo <small>Opcional</small>
          <input name="email" type="email" maxLength={160} aria-invalid={!!campos.email} />{err('email')}
        </label>
        <label className="field">Teléfono <small>Opcional</small>
          <input name="telefono" type="tel" maxLength={40} />
        </label>
      </div>
      <p className="small-note">La contraseña la genera el sistema y te la mostramos una sola vez al crear el usuario.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className={s.botones}>
        <button type="button" className="btn ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn primary" disabled={enviando}>{enviando ? 'Creando…' : 'Crear usuario'}</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ gestionar una persona
function Gestionar({ usuario: u, roles, onCambio, onClave }: {
  usuario: UsuarioApi; roles: Rol[]; onCambio: (u: UsuarioApi) => void; onClave: (password: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmar, setConfirmar] = useState<'BLOQUEADO' | 'BAJA' | 'clave' | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hacer(pedido: () => Promise<void>) {
    setEnviando(true); setError(null);
    try { await pedido(); } catch (e) { setError(mensajeDe(e)); } finally { setEnviando(false); setConfirmar(null); }
  }
  const estado = (e: EstadoUsuario) => hacer(async () => onCambio(await api<UsuarioApi>('usuarios', 'PATCH', `/panel/usuarios/${u.id}/estado`, { cuerpo: { estado: e }, token: getToken() })));
  const nuevaClave = () => hacer(async () => onClave((await api<{ password_temporal: string }>('usuarios', 'POST', `/panel/usuarios/${u.id}/password`, { token: getToken() })).password_temporal));

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await hacer(async () => {
      onCambio(await api<UsuarioApi>('usuarios', 'PUT', `/panel/usuarios/${u.id}`, {
        cuerpo: { nombre: f.get('nombre'), email: f.get('email') || null, telefono: f.get('telefono') || null, ...(f.get('rol') && { rol: f.get('rol') }) },
        token: getToken(),
      }));
      setEditando(false);
    });
  }

  if (editando) {
    const rolesPosibles = roles.filter((r) => COMERCIO.includes(r) === COMERCIO.includes(u.rol)); // no se pasa de comercio a Ente
    return (
      <form className={s.form} onSubmit={guardar}>
        <label className="field">Nombre y apellido <input name="nombre" defaultValue={u.nombre} required maxLength={120} /></label>
        <div className={s.dosCol}>
          <label className="field">Correo <input name="email" type="email" defaultValue={u.email ?? ''} maxLength={160} /></label>
          <label className="field">Teléfono <input name="telefono" type="tel" defaultValue={u.telefono ?? ''} maxLength={40} /></label>
        </div>
        {rolesPosibles.length > 1 && (
          <label className="field">Rol
            <select name="rol" defaultValue={u.rol}>{rolesPosibles.map((r) => <option key={r} value={r}>{ROLES[r].nombre}</option>)}</select>
          </label>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className={s.botones}>
          <button type="button" className="btn ghost" onClick={() => setEditando(false)}>Cancelar</button>
          <button className="btn primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    );
  }

  const textos = {
    BLOQUEADO: ['Bloquear', `${u.nombre} no va a poder entrar al panel hasta que lo actives de nuevo. Si tiene la sesión abierta, se le corta.`],
    BAJA: ['Dar de baja', `${u.nombre} deja de tener acceso. Sus canjes y movimientos quedan registrados.`],
    clave: ['Generar contraseña nueva', `La contraseña actual de ${u.nombre} deja de servir. Vas a ver la nueva una sola vez para pasársela.`],
  } as const;

  return (
    <div className={s.form}>
      <dl className={s.datos}>
        <div><dt>Usuario</dt><dd>{u.usuario}</dd></div>
        <div><dt>Rol</dt><dd>{ROLES[u.rol].nombre}</dd></div>
        <div><dt>Comercio</dt><dd>{u.comercio?.nombre ?? 'Ente Tucumán Turismo'}</dd></div>
        <div><dt>Estado</dt><dd><span className={`${s.estado} ${ESTADOS[u.estado][1]}`}>{ESTADOS[u.estado][0]}</span></dd></div>
        <div><dt>Correo</dt><dd>{u.email ?? 'Sin cargar'}</dd></div>
        <div><dt>Teléfono</dt><dd>{u.telefono ?? 'Sin cargar'}</dd></div>
        <div><dt>Alta</dt><dd>{fecha(u.creado_el)}</dd></div>
        <div><dt>Último ingreso</dt><dd>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca'}</dd></div>
      </dl>

      {confirmar ? (
        <div className={s.confirmar} role="alert">
          <p>{textos[confirmar][1]}</p>
          <div className={s.botones}>
            <button type="button" className="btn ghost" onClick={() => setConfirmar(null)}>Cancelar</button>
            <button type="button" className={`btn ${confirmar === 'clave' ? 'primary' : s.peligro}`} disabled={enviando}
              onClick={() => (confirmar === 'clave' ? nuevaClave() : estado(confirmar))}>{enviando ? 'Un momento…' : textos[confirmar][0]}</button>
          </div>
        </div>
      ) : (
        <div className={s.acciones}>
          <button type="button" className="btn secondary" onClick={() => setEditando(true)}>Editar datos</button>
          <button type="button" className="btn secondary" onClick={() => setConfirmar('clave')}>Contraseña nueva</button>
          {u.estado === 'ACTIVO'
            ? <button type="button" className="btn ghost" onClick={() => setConfirmar('BLOQUEADO')}>Bloquear</button>
            : <button type="button" className="btn primary" disabled={enviando} onClick={() => estado('ACTIVO')}>Activar</button>}
          {u.estado !== 'BAJA' && <button type="button" className="btn ghost" onClick={() => setConfirmar('BAJA')}>Dar de baja</button>}
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ contraseña temporal (una sola vez)
function MostrarClave({ nombre, usuario, password, onListo }: { nombre: string; usuario: string; password: string; onListo: () => void }) {
  const [copiada, setCopiada] = useState(false);
  return (
    <div className={s.form}>
      <p>Pasásela a <strong>{nombre}</strong> por un medio privado (en persona o por mensaje directo). <strong>No la vas a poder ver de nuevo</strong>; si se pierde, generá otra.</p>
      <dl className={s.datos}>
        <div><dt>Usuario</dt><dd className={s.clave}>{usuario}</dd></div>
        <div><dt>Contraseña</dt><dd className={s.clave}>{password}</dd></div>
      </dl>
      <div className={s.botones}>
        <button type="button" className="btn secondary" onClick={async () => {
          try { await navigator.clipboard.writeText(`Usuario: ${usuario}\nContraseña: ${password}`); setCopiada(true); } catch { setCopiada(false); }
        }}>{copiada ? 'Copiado ✓' : 'Copiar usuario y contraseña'}</button>
        <button type="button" className="btn primary" onClick={onListo}>Listo</button>
      </div>
    </div>
  );
}
