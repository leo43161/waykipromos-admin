'use client';

// Comercios (solo el Ente): listado con filtros, ficha (?id=…) y alta, edición, suspensión y logo.
// Contrato: GET/POST /panel/comercios, GET/PUT /panel/comercios/{id}, PATCH …/estado, POST/DELETE …/logo.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Dialogo from '@/components/Dialogo';
import { api, apiLista, ErrorApi, type ComercioApi, type EstadoComercio, type Opcion, type UsuarioApi } from '@/lib/api';
import { fecha, fechaHora, numero } from '@/lib/formato';
import { ROLES } from '@/lib/roles';
import { getToken } from '@/lib/sesion';
import { mensajeDe, useCarga } from '@/lib/useCarga';
import s from './Gestion.module.css';

type Localidad = Opcion & { circuito_id: number | null };
const ESTADOS: Record<EstadoComercio, [string, string]> = {
  AUTORIZADO: ['Activo', s.bien], SUSPENDIDO: ['Suspendido', s.mal], PENDIENTE: ['Pendiente', s.aviso], RECHAZADO: ['Rechazado', s.neutro],
};
export const EstadoComercioBadge = ({ estado }: { estado: EstadoComercio }) => <span className={`${s.estado} ${ESTADOS[estado][1]}`}>{ESTADOS[estado][0]}</span>;

/** Categorías y localidades para filtros y formularios (etapa catalogos). */
function useCatalogos() {
  return useCarga(async () => {
    const [categorias, localidades] = await Promise.all([
      api<Opcion[]>('catalogos', 'GET', '/categorias'),
      api<Localidad[]>('catalogos', 'GET', '/localidades'),
    ]);
    return { categorias, localidades };
  }, []).dato;
}

export default function Comercios() {
  const id = Number(useSearchParams().get('id'));
  return id ? <Ficha id={id} key={id} /> : <Lista />;
}

// ------------------------------------------------------------------ listado
function Lista() {
  const router = useRouter();
  const cat = useCatalogos();
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(1);
  const [alta, setAlta] = useState(false);

  useEffect(() => { // busca 300 ms después de dejar de escribir
    const t = setTimeout(() => { setQ(texto.trim()); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  const params = new URLSearchParams({ pagina: String(pagina), limite: '20' });
  if (q) params.set('q', q);
  if (estado) params.set('estado', estado);
  if (categoria) params.set('categoria_id', categoria);
  const ruta = `/panel/comercios?${params}`;
  const { dato, error, cargando } = useCarga(() => apiLista<ComercioApi>('comercios', ruta, getToken()), [ruta]);
  const total = dato?.meta.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / 20));

  return (
    <main id="contenido" className={`${s.main} content-width`}>
      <div className={s.cabecera}>
        <div>
          <h1>Comercios</h1>
          <p>Los comercios adheridos a Wayki Promo: sus datos, su estado y su equipo.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setAlta(true)}>Dar de alta un comercio</button>
      </div>

      <div className={s.filtros} role="search">
        <label className="field">Buscar
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, dirección, localidad o correo" />
        </label>
        <label className="field">Estado
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
            <option value="">Todos</option><option value="AUTORIZADO">Activos</option><option value="SUSPENDIDO">Suspendidos</option>
          </select>
        </label>
        <label className="field">Categoría
          <select value={categoria} onChange={(e) => { setCategoria(e.target.value); setPagina(1); }}>
            <option value="">Todas</option>
            {cat?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <p className={s.contador} aria-live="polite">{cargando ? 'Cargando…' : `${numero(total)} ${total === 1 ? 'comercio' : 'comercios'}`}</p>

      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead><tr><th>Comercio</th><th>Localidad</th><th className={s.num}>Promociones</th><th className={s.num}>Cupones / canjes</th><th>Estado</th></tr></thead>
          <tbody>
            {dato?.datos.map((c) => (
              <tr key={c.id}>
                <td><div className={s.nombre}><Link href={`/comercios/?id=${c.id}`}>{c.nombre}</Link><small>{c.categoria.nombre}</small></div></td>
                <td>{c.localidad.nombre}</td>
                <td className={s.num}>{numero(c.numeros.promociones_publicadas)}</td>
                <td className={s.num}>{numero(c.numeros.cupones_emitidos)} / {numero(c.numeros.cupones_canjeados)}</td>
                <td><EstadoComercioBadge estado={c.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {dato && !dato.datos.length && <p className={s.vacio}>No encontramos comercios con esos filtros.</p>}
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

      <Dialogo abierto={alta} onCerrar={() => setAlta(false)} titulo="Dar de alta un comercio">
        <FormComercio cat={cat} onListo={(c) => router.push(`/comercios/?id=${c.id}`)} onCancelar={() => setAlta(false)} />
      </Dialogo>
    </main>
  );
}

// ------------------------------------------------------------------ ficha
function Ficha({ id }: { id: number }) {
  const cat = useCatalogos();
  const { dato: c, error, recargar } = useCarga(() => api<ComercioApi>('comercios', 'GET', `/panel/comercios/${id}`, { token: getToken() }), [id]);
  const equipo = useCarga(() => apiLista<UsuarioApi>('usuarios', `/panel/usuarios?comercio_id=${id}&limite=100`, getToken()), [id]);
  const [dialogo, setDialogo] = useState<'editar' | 'estado' | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  async function logo(archivo: File | null) {
    setLogoError(null);
    try {
      if (archivo) {
        const fd = new FormData();
        fd.append('imagen', archivo);
        await api('comercios', 'POST', `/panel/comercios/${id}/logo`, { cuerpo: fd, token: getToken() });
      } else {
        await api('comercios', 'DELETE', `/panel/comercios/${id}/logo`, { token: getToken() });
      }
      recargar();
    } catch (e) {
      setLogoError(mensajeDe(e));
    }
  }

  if (error) return <main id="contenido" className={`${s.main} content-width`}><Link href="/comercios/" className={s.volver}>← Comercios</Link><p className="form-error" role="alert">{error}</p></main>;
  if (!c) return <main id="contenido" className={`${s.main} content-width`}><p className={s.contador}>Cargando…</p></main>;
  const suspendido = c.estado === 'SUSPENDIDO';

  return (
    <main id="contenido" className={`${s.main} ${s.ficha} content-width`}>
      <Link href="/comercios/" className={s.volver}>← Comercios</Link>
      <div className={s.fichaCabecera}>
        <div className={s.logo}>{c.logo_url ? <img src={c.logo_url} alt={`Logo de ${c.nombre}`} width={72} height={72} /> : c.nombre[0]}</div>
        <div>
          <h1>{c.nombre}</h1>
          <span><EstadoComercioBadge estado={c.estado} /> <span className="muted">{c.categoria.nombre} · {c.localidad.nombre}</span></span>
        </div>
        <div className={s.acciones}>
          <button type="button" className="btn secondary" onClick={() => setDialogo('editar')}>Editar datos</button>
          <button type="button" className={`btn ${suspendido ? 'primary' : 'secondary'}`} onClick={() => setDialogo('estado')}>
            {suspendido ? 'Reactivar' : 'Suspender'}
          </button>
        </div>
      </div>
      {suspendido && c.motivo_estado && <p className={s.motivo}><strong>Suspendido:</strong> {c.motivo_estado}. Sus promociones no se ven en el catálogo y no se pueden canjear cupones.</p>}

      <ul className={s.cifras}>
        <li><small>Promociones publicadas</small><strong>{numero(c.numeros.promociones_publicadas)}</strong></li>
        <li><small>Cupones guardados</small><strong>{numero(c.numeros.cupones_emitidos)}</strong></li>
        <li><small>Canjes</small><strong>{numero(c.numeros.cupones_canjeados)}</strong></li>
        <li><small>Usuarios activos</small><strong>{numero(c.numeros.usuarios_activos)}</strong></li>
      </ul>

      <section className="panel" aria-labelledby="datos-titulo">
        <h2 id="datos-titulo" className={s.titulito}>Datos del comercio</h2>
        <dl className={s.datos}>
          <div><dt>Dirección</dt><dd>{c.direccion}</dd></div>
          <div><dt>Localidad</dt><dd>{c.localidad.nombre}{c.circuito && ` (${c.circuito.nombre})`}</dd></div>
          <div><dt>Correo</dt><dd>{c.email_contacto ?? 'Sin cargar'}</dd></div>
          <div><dt>Teléfono</dt><dd>{c.telefono_contacto ?? 'Sin cargar'}</dd></div>
          <div><dt>Alta</dt><dd>{fecha(c.creado_el)}</dd></div>
          {c.autorizado_el && <div><dt>Activo desde</dt><dd>{fecha(c.autorizado_el)}</dd></div>}
        </dl>
        <div className={s.acciones} style={{ marginTop: 16 }}>
          <label className="btn secondary">
            {c.logo_url ? 'Cambiar logo' : 'Subir logo'}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => logo(e.target.files?.[0] ?? null)} />
          </label>
          {c.logo_url && <button type="button" className="btn ghost" onClick={() => logo(null)}>Sacar logo</button>}
        </div>
        {logoError && <p className={s.errorCampo} role="alert">{logoError}</p>}
      </section>

      <section className="panel" aria-labelledby="equipo-titulo">
        <h2 id="equipo-titulo" className={s.titulito}>Equipo del comercio</h2>
        {equipo.dato?.datos.length ? (
          <div className={s.tablaCaja}>
            <table className={s.tabla}>
              <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th>Último ingreso</th></tr></thead>
              <tbody>{equipo.dato.datos.map((u) => (
                <tr key={u.id}>
                  <td><div className={s.nombre}><strong>{u.nombre}</strong><small>{u.usuario}</small></div></td>
                  <td>{ROLES[u.rol].nombre}</td>
                  <td><span className={`${s.estado} ${u.estado === 'ACTIVO' ? s.bien : s.mal}`}>{u.estado === 'ACTIVO' ? 'Activo' : u.estado === 'BLOQUEADO' ? 'Bloqueado' : 'De baja'}</span></td>
                  <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="muted">{equipo.cargando ? 'Cargando…' : 'Este comercio todavía no tiene usuarios.'}</p>}
      </section>

      <Dialogo abierto={dialogo === 'editar'} onCerrar={() => setDialogo(null)} titulo={`Editar ${c.nombre}`}>
        <FormComercio cat={cat} actual={c} onListo={() => { setDialogo(null); recargar(); }} onCancelar={() => setDialogo(null)} />
      </Dialogo>
      <Dialogo abierto={dialogo === 'estado'} onCerrar={() => setDialogo(null)} titulo={suspendido ? `¿Reactivar ${c.nombre}?` : `Suspender ${c.nombre}`}>
        <FormEstado comercio={c} onListo={() => { setDialogo(null); recargar(); }} onCancelar={() => setDialogo(null)} />
      </Dialogo>
    </main>
  );
}

// ------------------------------------------------------------------ formularios
function FormComercio({ cat, actual, onListo, onCancelar }: {
  cat: { categorias: Opcion[]; localidades: Localidad[] } | null;
  actual?: ComercioApi;
  onListo: (c: ComercioApi) => void;
  onCancelar: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const cuerpo = {
      nombre: f.get('nombre'), categoria_id: Number(f.get('categoria_id')), direccion: f.get('direccion'),
      localidad_id: Number(f.get('localidad_id')), email_contacto: f.get('email_contacto'), telefono_contacto: f.get('telefono_contacto'),
    };
    setEnviando(true); setError(null); setCampos({});
    try {
      const c = actual
        ? await api<ComercioApi>('comercios', 'PUT', `/panel/comercios/${actual.id}`, { cuerpo, token: getToken() })
        : await api<ComercioApi>('comercios', 'POST', '/panel/comercios', { cuerpo, token: getToken() });
      onListo(c);
    } catch (err) {
      setError(mensajeDe(err));
      if (err instanceof ErrorApi && err.detalles) setCampos(err.detalles as Record<string, string>);
    } finally {
      setEnviando(false);
    }
  }

  const err = (k: string) => campos[k] && <span className={s.errorCampo}>{campos[k]}</span>;
  return (
    <form className={s.form} onSubmit={enviar} noValidate>
      <label className="field">Nombre del comercio
        <input name="nombre" defaultValue={actual?.nombre} required maxLength={180} aria-invalid={!!campos.nombre} />{err('nombre')}
      </label>
      <div className={s.dosCol}>
        <label className="field">Categoría
          <select name="categoria_id" defaultValue={actual?.categoria.id ?? ''} required aria-invalid={!!campos.categoria_id}>
            <option value="" disabled>Elegí una</option>
            {cat?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>{err('categoria_id')}
        </label>
        <label className="field">Localidad
          <select name="localidad_id" defaultValue={actual?.localidad.id ?? ''} required aria-invalid={!!campos.localidad_id}>
            <option value="" disabled>Elegí una</option>
            {[...(cat?.localidades ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre)).map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>{err('localidad_id')}
        </label>
      </div>
      <label className="field">Dirección
        <input name="direccion" defaultValue={actual?.direccion} required maxLength={255} aria-invalid={!!campos.direccion} />{err('direccion')}
      </label>
      <div className={s.dosCol}>
        <label className="field">Correo de contacto <small>Opcional</small>
          <input name="email_contacto" type="email" defaultValue={actual?.email_contacto ?? ''} maxLength={160} aria-invalid={!!campos.email_contacto} />{err('email_contacto')}
        </label>
        <label className="field">Teléfono <small>Opcional</small>
          <input name="telefono_contacto" type="tel" defaultValue={actual?.telefono_contacto ?? ''} maxLength={40} />
        </label>
      </div>
      {!actual && <p className="small-note">Queda activo al darlo de alta. Después, desde Usuarios, creale el acceso al encargado.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className={s.botones}>
        <button type="button" className="btn ghost" onClick={onCancelar}>Cancelar</button>
        <button className="btn primary" disabled={enviando}>{enviando ? 'Guardando…' : actual ? 'Guardar cambios' : 'Dar de alta'}</button>
      </div>
    </form>
  );
}

function FormEstado({ comercio, onListo, onCancelar }: { comercio: ComercioApi; onListo: () => void; onCancelar: () => void }) {
  const suspender = comercio.estado !== 'SUSPENDIDO';
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      await api('comercios', 'PATCH', `/panel/comercios/${comercio.id}/estado`, {
        cuerpo: { estado: suspender ? 'SUSPENDIDO' : 'AUTORIZADO', motivo: motivo.trim() || null }, token: getToken(),
      });
      onListo();
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className={s.form} onSubmit={enviar}>
      <p>{suspender
        ? 'Sus promociones salen del catálogo y no se pueden canjear cupones. Su personal puede seguir entrando al panel y ve el aviso.'
        : 'Sus promociones publicadas vuelven al catálogo y se pueden canjear cupones otra vez.'}</p>
      {suspender && (
        <label className="field">Motivo (lo ve el comercio)
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} required minLength={5} maxLength={255} placeholder="Ej.: Falta renovar la habilitación municipal" />
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className={s.botones}>
        <button type="button" className="btn ghost" onClick={onCancelar}>Cancelar</button>
        <button className={`btn ${suspender ? s.peligro : 'primary'}`} disabled={enviando || (suspender && motivo.trim().length < 5)}>
          {enviando ? 'Guardando…' : suspender ? 'Suspender comercio' : 'Reactivar comercio'}
        </button>
      </div>
    </form>
  );
}
