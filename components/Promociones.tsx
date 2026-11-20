'use client';

// Promociones: el Ente ve las de todos los comercios; el encargado, las suyas. Mismas pantallas, la API filtra.
// Rutas: /promociones/ (listado) · ?id= (ficha) · ?id=&editar · ?nueva (formulario, FormPromocion.tsx).
// Estados (contrato): BORRADOR → PUBLICADA ⇄ PAUSADA → FINALIZADA; cualquiera → BAJA. Sin aprobación del Ente.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Dialogo from '@/components/Dialogo';
import FormPromocion from '@/components/FormPromocion';
import { useSesion } from '@/components/Marco';
import { api, apiLista, ErrorApi, type ComercioApi, type EstadoPromocion, type Opcion, type PromocionGestionApi } from '@/lib/api';
import { asset } from '@/lib/asset';
import { dias, fecha, fechaCorta, numero } from '@/lib/formato';
import { getToken } from '@/lib/sesion';
import { mensajeDe, useCarga } from '@/lib/useCarga';
import s from './Gestion.module.css';

const ESTADOS: Record<EstadoPromocion, [string, string]> = {
  BORRADOR: ['Borrador', s.neutro], PUBLICADA: ['Publicada', s.bien], PAUSADA: ['Pausada', s.aviso], FINALIZADA: ['Finalizada', s.neutro], BAJA: ['De baja', s.mal],
};
const EstadoBadge = ({ estado }: { estado: EstadoPromocion }) => <span className={`${s.estado} ${ESTADOS[estado][1]}`}>{ESTADOS[estado][0]}</span>;

/** A qué estados puede pasar cada uno (la API lo vuelve a controlar). */
const PASOS: Record<EstadoPromocion, EstadoPromocion[]> = {
  BORRADOR: ['PUBLICADA', 'BAJA'], PUBLICADA: ['PAUSADA', 'FINALIZADA', 'BAJA'], PAUSADA: ['PUBLICADA', 'FINALIZADA', 'BAJA'], FINALIZADA: ['BAJA'], BAJA: [],
};
const ACCION: Record<EstadoPromocion, { boton: string; texto: string }> = {
  PUBLICADA: { boton: 'Publicar', texto: 'Se va a ver en la app y los visitantes van a poder guardar cupones (si está dentro de sus fechas y le quedan cupos).' },
  PAUSADA: { boton: 'Pausar', texto: 'Deja de verse en la app y no se guardan cupones nuevos. Los cupones ya guardados se pueden seguir canjeando. Se puede volver a publicar.' },
  FINALIZADA: { boton: 'Finalizar', texto: 'Se cierra antes de su fecha de fin y no se puede volver a publicar. Los cupones ya guardados se pueden canjear hasta que venzan.' },
  BAJA: { boton: 'Dar de baja', texto: 'Desaparece de la app y de los listados. No se puede deshacer. Los cupones ya guardados se pueden canjear hasta que venzan.' },
  BORRADOR: { boton: '', texto: '' },
};

export default function Promociones() {
  const q = useSearchParams();
  const id = Number(q.get('id'));
  if (q.has('nueva')) return <FormPromocion />;
  if (id && q.has('editar')) return <Editar id={id} key={`e${id}`} />;
  return id ? <Ficha id={id} key={id} /> : <Lista />;
}

function Editar({ id }: { id: number }) {
  const { dato, error } = useCarga(() => api<PromocionGestionApi>('promociones', 'GET', `/panel/promociones/${id}`, { token: getToken() }), [id]);
  if (error) return <main id="contenido" className={`${s.main} content-width`}><p className="form-error" role="alert">{error}</p></main>;
  return dato ? <FormPromocion actual={dato} /> : null;
}

// ------------------------------------------------------------------ listado
function Lista() {
  const sesion = useSesion();
  const esEnte = sesion.rol === 'admin_ente' || sesion.rol === 'superadmin';
  const opciones = useCarga(async () => ({
    categorias: await api<Opcion[]>('catalogos', 'GET', '/categorias'),
    comercios: esEnte ? (await apiLista<ComercioApi>('comercios', '/panel/comercios?limite=100', getToken())).datos : [],
  }), []).dato;
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [categoria, setCategoria] = useState('');
  const [comercio, setComercio] = useState('');
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setQ(texto.trim()); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  const params = new URLSearchParams({ pagina: String(pagina), limite: '20' });
  if (q) params.set('q', q);
  if (estado) params.set('estado', estado);
  if (categoria) params.set('categoria_id', categoria);
  if (comercio) params.set('comercio_id', comercio);
  const ruta = `/panel/promociones?${params}`;
  const { dato, error, cargando } = useCarga(() => apiLista<PromocionGestionApi>('promociones', ruta, getToken()), [ruta]);
  const total = dato?.meta.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / 20));
  const cambiar = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { f(e.target.value); setPagina(1); };

  return (
    <main id="contenido" className={`${s.main} content-width`}>
      <div className={s.cabecera}>
        <div>
          <h1>{esEnte ? 'Promociones' : 'Mis promociones'}</h1>
          <p>{esEnte ? 'Los beneficios de todos los comercios. Podés pausarlos o darlos de baja.' : 'Creá motivos para que los visitantes elijan tu comercio.'}</p>
        </div>
        <Link href="/promociones/?nueva" className="btn primary">Crear promoción</Link>
      </div>

      <div className={s.filtros} role="search">
        <label className="field">Buscar
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={esEnte ? 'Título, comercio o localidad' : 'Título'} />
        </label>
        <label className="field">Estado
          <select value={estado} onChange={cambiar(setEstado)}>
            <option value="">Todas</option>
            {(Object.keys(ESTADOS) as EstadoPromocion[]).map((e) => <option key={e} value={e}>{ESTADOS[e][0]}</option>)}
          </select>
        </label>
        <label className="field">Categoría
          <select value={categoria} onChange={cambiar(setCategoria)}>
            <option value="">Todas</option>
            {opciones?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        {esEnte && (
          <label className="field">Comercio
            <select value={comercio} onChange={cambiar(setComercio)}>
              <option value="">Todos</option>
              {opciones?.comercios.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <p className={s.contador} aria-live="polite">{cargando ? 'Cargando…' : `${numero(total)} ${total === 1 ? 'promoción' : 'promociones'}`}</p>

      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead><tr><th>Promoción</th><th>Beneficio</th><th className={s.num}>Cupos libres</th><th className={s.num}>Canjes</th><th>Hasta</th><th>Estado</th></tr></thead>
          <tbody>
            {dato?.datos.map((p) => (
              <tr key={p.id}>
                <td><div className={s.nombre}>
                  <Link href={`/promociones/?id=${p.id}`}>{p.titulo}</Link>
                  <small>{esEnte ? `${p.comercio.nombre} · ${p.comercio.lugar}` : p.categoria.nombre}{p.destacada && ' · ★ Destacada'}</small>
                </div></td>
                <td><strong>{p.descuento_visual}</strong></td>
                <td className={s.num}>{numero(p.cupos_disponibles)} de {numero(p.cupos_totales)}</td>
                <td className={s.num}>{numero(p.cupos_canjeados)}</td>
                <td>{fechaCorta(`${p.fecha_hasta}T12:00:00-03:00`)}</td>
                <td><EstadoBadge estado={p.estado} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {dato && !dato.datos.length && <p className={s.vacio}>{q || estado || categoria || comercio ? 'No encontramos promociones con esos filtros.' : 'Todavía no hay promociones. Creá la primera.'}</p>}
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
    </main>
  );
}

// ------------------------------------------------------------------ ficha
function Ficha({ id }: { id: number }) {
  const sesion = useSesion();
  const esEnte = sesion.rol === 'admin_ente' || sesion.rol === 'superadmin';
  const { dato: p, error, recargar } = useCarga(() => api<PromocionGestionApi>('promociones', 'GET', `/panel/promociones/${id}`, { token: getToken() }), [id]);
  const [destino, setDestino] = useState<EstadoPromocion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function foto(archivo: File | null) {
    setAviso(null);
    try {
      if (archivo) {
        const fd = new FormData();
        fd.append('imagen', archivo);
        await api('promociones', 'POST', `/panel/promociones/${id}/imagen`, { cuerpo: fd, token: getToken() });
      } else {
        await api('promociones', 'DELETE', `/panel/promociones/${id}/imagen`, { token: getToken() });
      }
      recargar();
    } catch (e) { setAviso(mensajeDe(e)); }
  }
  async function destacar(valor: boolean) {
    setAviso(null);
    try {
      await api('promociones', 'PUT', `/panel/promociones/${id}`, { cuerpo: { destacada: valor }, token: getToken() });
      recargar();
    } catch (e) { setAviso(mensajeDe(e)); }
  }

  if (error) return <main id="contenido" className={`${s.main} content-width`}><Link href="/promociones/" className={s.volver}>← Promociones</Link><p className="form-error" role="alert">{error}</p></main>;
  if (!p) return <main id="contenido" className={`${s.main} content-width`}><p className={s.contador}>Cargando…</p></main>;
  const editable = p.estado !== 'FINALIZADA' && p.estado !== 'BAJA';
  const cuando = [
    dias(p.dias_validos).replace(/^./, (l) => l.toUpperCase()),
    p.horario && `de ${p.horario.desde} a ${p.horario.hasta}`,
  ].filter(Boolean).join(', ');

  return (
    <main id="contenido" className={`${s.main} ${s.ficha} content-width`}>
      <Link href="/promociones/" className={s.volver}>← Promociones</Link>

      <div className={s.promoCabecera}>
        <div className={s.promoFoto}>
          {p.imagen_url ? <img src={p.imagen_url} alt="" width={600} height={300} />
            : <img src={asset('/wayki-promo/mascota/wayki-avatar-256.png')} alt="" width={256} height={256} className={s.promoSinFoto} />}
          <span className="display">{p.descuento_visual}</span>
        </div>
        <div className={s.promoTitulo}>
          <span><EstadoBadge estado={p.estado} /> {p.destacada && <span className={`${s.estado} ${s.aviso}`}>★ Destacada</span>}</span>
          <h1>{p.titulo}</h1>
          <p className="muted">{p.comercio.nombre} · {p.comercio.lugar} · {p.categoria.nombre}</p>
          <p className={s.contador}>{p.publica ? 'Se ve en la app del turista.' : 'No se ve en la app del turista.'}</p>
          <div className={s.acciones}>
            {editable && <Link href={`/promociones/?id=${p.id}&editar`} className="btn secondary">Editar</Link>}
            {PASOS[p.estado].map((e) => (
              <button key={e} type="button" className={`btn ${e === 'PUBLICADA' ? 'primary' : e === 'BAJA' ? 'ghost' : 'secondary'}`} onClick={() => setDestino(e)}>
                {e === 'PUBLICADA' && p.estado === 'PAUSADA' ? 'Volver a publicar' : ACCION[e].boton}
              </button>
            ))}
            {esEnte && editable && (
              <button type="button" className="btn ghost" onClick={() => destacar(!p.destacada)}>{p.destacada ? 'Quitar de destacadas' : 'Destacar'}</button>
            )}
          </div>
          {aviso && <p className="form-error" role="alert">{aviso}</p>}
        </div>
      </div>

      <ul className={s.cifras}>
        <li><small>Cupos</small><strong>{numero(p.cupos_totales)}</strong></li>
        <li><small>Cupones guardados</small><strong>{numero(p.cupos_emitidos)}</strong></li>
        <li><small>Canjes</small><strong>{numero(p.cupos_canjeados)}</strong></li>
        <li><small>Quedan</small><strong>{numero(p.cupos_disponibles)}</strong></li>
      </ul>

      <section className="panel" aria-labelledby="datos-titulo">
        <h2 id="datos-titulo" className={s.titulito}>Detalle</h2>
        <dl className={s.datos}>
          <div><dt>Beneficio</dt><dd>{p.modalidad_personalizada ?? p.modalidad.nombre}</dd></div>
          <div><dt>Vigencia</dt><dd>Del {fecha(`${p.fecha_desde}T12:00:00-03:00`)} al {fecha(`${p.fecha_hasta}T12:00:00-03:00`)}</dd></div>
          <div><dt>Cuándo vale</dt><dd>{cuando}</dd></div>
          <div><dt>Creada por</dt><dd>{p.creado_por.nombre}, el {fecha(p.creado_el)}</dd></div>
          {p.descripcion && <div className={s.ancho}><dt>Descripción</dt><dd>{p.descripcion}</dd></div>}
          {p.condiciones && <div className={s.ancho}><dt>Condiciones</dt><dd>{p.condiciones}</dd></div>}
        </dl>
        {editable && (
          <div className={s.acciones} style={{ marginTop: 16 }}>
            <label className="btn secondary">
              {p.imagen_url ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => foto(e.target.files?.[0] ?? null)} />
            </label>
            {p.imagen_url && <button type="button" className="btn ghost" onClick={() => foto(null)}>Sacar foto</button>}
          </div>
        )}
      </section>

      <Dialogo abierto={!!destino} onCerrar={() => setDestino(null)} titulo={destino ? `${ACCION[destino].boton}: ${p.titulo}` : ''}>
        {destino && <FormEstado promo={p} destino={destino} esEnte={esEnte} onListo={() => { setDestino(null); recargar(); }} onCancelar={() => setDestino(null)} />}
      </Dialogo>
    </main>
  );
}

function FormEstado({ promo, destino, esEnte, onListo, onCancelar }: {
  promo: PromocionGestionApi; destino: EstadoPromocion; esEnte: boolean; onListo: () => void; onCancelar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deOtro = esEnte && destino !== 'PUBLICADA';

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true); setError(null);
    try {
      await api('promociones', 'PATCH', `/panel/promociones/${promo.id}/estado`, { cuerpo: { estado: destino, motivo: motivo.trim() || null }, token: getToken() });
      onListo();
    } catch (err) {
      const motivos = err instanceof ErrorApi && Array.isArray((err.detalles as { motivos?: unknown })?.motivos) ? (err.detalles as { motivos: string[] }).motivos : [];
      setError([mensajeDe(err), ...motivos].join(' '));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className={s.form} onSubmit={enviar}>
      <p>{ACCION[destino].texto}</p>
      {deOtro && (
        <label className="field">Motivo <small>Opcional. Queda en la actividad y lo ve el comercio.</small>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={255} placeholder="Ej.: Revisar las condiciones" />
        </label>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className={s.botones}>
        <button type="button" className="btn ghost" onClick={onCancelar}>Cancelar</button>
        <button className={`btn ${destino === 'BAJA' ? s.peligro : 'primary'}`} disabled={enviando}>{enviando ? 'Guardando…' : ACCION[destino].boton}</button>
      </div>
    </form>
  );
}
