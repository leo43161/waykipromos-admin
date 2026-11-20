'use client';

// Canje en el mostrador (contrato: POST /panel/canjes/validar y POST /panel/canjes, etapa "canje").
// Escanear o escribir el código → ver el cupón (validar no cambia nada) → canjear (definitivo).
// Qué se puede canjear lo decide la API: la pantalla nunca da un canje por hecho sin su respuesta.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Camara from '@/components/Camara';
import { useSesion } from '@/components/Marco';
import { api, conApi, ErrorApi, type CanjeHechoApi, type CuponEnMostradorApi } from '@/lib/api';
import { asset } from '@/lib/asset';
import { dias, fecha, hora } from '@/lib/formato';
import { getToken, salir } from '@/lib/sesion';
import { CODIGOS_DE_PRUEBA } from '@/lib/simulador';
import s from './Canjear.module.css';

type Hecho = CuponEnMostradorApi & { canjeado_el: string };
/** Lo que traen los errores 409 en `detalles` (contrato). */
type Detalles = Partial<Hecho> & { canjeado_por?: { id: number; nombre: string } | null };
type Paso =
  | { tipo: 'escanear' }
  | { tipo: 'buscando' }
  | { tipo: 'cupon'; codigo: string; datos: CuponEnMostradorApi }
  | { tipo: 'problema'; titulo: string; detalle: string | null; datos: CuponEnMostradorApi | null; reintentar: (() => void) | null }
  | { tipo: 'hecho'; datos: Hecho };

const SIMULADO = !conApi('canje');
/** Enfoca el título de cada paso cuando aparece (el lector de pantalla y el teclado siguen el cambio). */
const enfocar = (el: HTMLElement | null) => el?.focus();

/** Una línea más sobre el error, con lo que trae `detalles`. El título es el mensaje de la API. */
function detalleDe(e: ErrorApi): string | null {
  const d = e.detalles as Detalles | null;
  switch (e.codigo) {
    case 'CUPON_INEXISTENTE': return 'Revisalo con el visitante: son 7 letras y números.';
    case 'CUPON_OTRO_COMERCIO': return 'Solo se canjea en el comercio de la promoción.';
    case 'CUPON_YA_CANJEADO': return d?.canjeado_el ? `Lo canjeó ${d.canjeado_por?.nombre ?? 'alguien del comercio'} el ${fecha(d.canjeado_el)} a las ${hora(d.canjeado_el)}.` : null;
    case 'CUPON_VENCIDO': return d?.cupon ? `Venció el ${fecha(d.cupon.vence_el)}.` : null;
    case 'FUERA_DE_DIA': return d?.promocion?.dias_validos ? `Vale ${dias(d.promocion.dias_validos)}.` : null;
    case 'FUERA_DE_HORARIO': return d?.promocion?.horario ? `Vale de ${d.promocion.horario.desde} a ${d.promocion.horario.hasta}.` : null;
    default: return null;
  }
}

export default function Canjear() {
  const router = useRouter();
  const sesion = useSesion();
  const [paso, setPaso] = useState<Paso>({ tipo: 'escanear' });
  const [escrito, setEscrito] = useState('');
  const [obs, setObs] = useState('');
  const [enviando, setEnviando] = useState(false);

  const otro = () => { setEscrito(''); setPaso({ tipo: 'escanear' }); };

  function fallo(e: unknown, reintentar: () => void) {
    const err = e instanceof ErrorApi ? e : new ErrorApi(0, 'ERROR', 'Algo falló. Probá de nuevo.', null);
    if (err.http === 401) { salir(); router.replace('/'); return; }
    const d = err.detalles as Detalles | null;
    setPaso({
      tipo: 'problema', titulo: err.message, detalle: detalleDe(err),
      datos: d?.cupon && d.promocion && d.turista ? { cupon: d.cupon, promocion: d.promocion, turista: d.turista } : null,
      reintentar: err.http === 0 || err.http >= 500 ? reintentar : null, // solo cortes y fallas del servidor
    });
  }

  async function validar(texto: string) {
    const codigo = texto.toUpperCase().replace(/[\s-]/g, '');
    if (!/^[A-Z0-9]{1,32}$/.test(codigo)) {
      return setPaso({ tipo: 'problema', titulo: 'Ese QR no es de un cupón de Wayki Promo.', detalle: 'Pedile al visitante que abra el cupón en "Mis cupones", o escribí el código.', datos: null, reintentar: null });
    }
    setPaso({ tipo: 'buscando' });
    try {
      const datos = await api<CuponEnMostradorApi>('canje', 'POST', '/panel/canjes/validar', { cuerpo: { codigo }, token: getToken() });
      setObs('');
      setPaso({ tipo: 'cupon', codigo, datos });
    } catch (e) {
      fallo(e, () => validar(codigo));
    }
  }

  async function canjear(codigo: string, observaciones: string) {
    setEnviando(true);
    try {
      const r = await api<CanjeHechoApi>('canje', 'POST', '/panel/canjes', { cuerpo: { codigo, observaciones }, token: getToken() });
      setPaso({ tipo: 'hecho', datos: r });
      navigator.vibrate?.(120);
    } catch (e) {
      const d = e instanceof ErrorApi ? (e.detalles as Detalles | null) : null;
      // Reintento tras un corte: este paso viene de un cupón sin usar, así que si figura canjeado por mí, fue este
      // mismo pedido que llegó (el contrato lo prevé así).
      if (e instanceof ErrorApi && e.codigo === 'CUPON_YA_CANJEADO' && d?.cupon && d.promocion && d.turista && d.canjeado_el && d.canjeado_por?.id === sesion.id) {
        setPaso({ tipo: 'hecho', datos: { cupon: d.cupon, promocion: d.promocion, turista: d.turista, canjeado_el: d.canjeado_el } });
      } else {
        fallo(e, () => canjear(codigo, observaciones));
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <main id="contenido" className={`${s.main} content-width`}>
        <h1 className={s.titulo}>Canjear un cupón</h1>

        {paso.tipo === 'escanear' && (
          <>
            <Camara onLeido={validar} />
            <form className={s.manual} onSubmit={(e) => { e.preventDefault(); validar(escrito); }}>
              <label className="field">
                ¿No lee el QR? Escribí el código
                <input
                  value={escrito}
                  onChange={(e) => setEscrito(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  maxLength={32} required autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="W9BDSXB"
                />
              </label>
              <button className="btn primary">Ver cupón</button>
            </form>
            {SIMULADO && (
              <div className={s.prueba}>
                <p>Modo de prueba: cupones de Patio del Jardín (entrá como martin.rios o lucia.suarez).</p>
                <div>
                  {CODIGOS_DE_PRUEBA.map(([codigo, que]) => (
                    <button key={codigo} type="button" className="btn secondary" onClick={() => validar(codigo)}>{codigo} · {que}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {paso.tipo === 'buscando' && <p className={s.buscando} role="status">Buscando el cupón…</p>}

        {paso.tipo === 'cupon' && (
          <article className={s.cupon} aria-labelledby="cupon-titulo">
            <Foto key={paso.datos.promocion.imagen_url} url={paso.datos.promocion.imagen_url} />
            <div className={s.cuponCuerpo}>
              <span className={`badge ${s.estado}`}>✓ Se puede canjear</span>
              <p className={s.beneficio}><span className="display">{paso.datos.promocion.descuento_visual}</span></p>
              <h2 id="cupon-titulo" ref={enfocar} tabIndex={-1}>{paso.datos.promocion.titulo}</h2>
              <dl className={s.datos}>
                <div><dt>Visitante</dt><dd>{paso.datos.turista.nombre}</dd></div>
                <div><dt>Código</dt><dd>{paso.datos.cupon.codigo}</dd></div>
                <div><dt>Vence</dt><dd>{fecha(paso.datos.cupon.vence_el)}</dd></div>
                {!!paso.datos.promocion.dias_validos?.length && <div><dt>Días</dt><dd>{dias(paso.datos.promocion.dias_validos)}</dd></div>}
                {paso.datos.promocion.horario && <div><dt>Horario</dt><dd>{paso.datos.promocion.horario.desde} a {paso.datos.promocion.horario.hasta}</dd></div>}
              </dl>
              {paso.datos.promocion.condiciones && <p className={s.condiciones}><strong>Condiciones:</strong> {paso.datos.promocion.condiciones}</p>}
              <label className="field">
                Observaciones (opcional)
                <input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} placeholder="Mesa, n.º de factura…" />
              </label>
              <div className={`${s.acciones} ${s.fijas}`}>
                <p className="small-note">Al canjear, el cupón queda usado y no se puede deshacer.</p>
                <button type="button" className="btn accent" disabled={enviando} onClick={() => canjear(paso.codigo, obs)}>
                  {enviando ? 'Canjeando…' : 'Canjear'}
                </button>
                <button type="button" className="btn secondary" disabled={enviando} onClick={otro}>Cancelar</button>
              </div>
            </div>
          </article>
        )}

        {paso.tipo === 'problema' && (
          <section className={`${s.resultado} ${s.mal}`} aria-labelledby="resultado-titulo">
            <span className={s.icono} aria-hidden="true">✕</span>
            <p className={s.etiqueta}>No se puede canjear</p>
            <h2 id="resultado-titulo" ref={enfocar} tabIndex={-1}>{paso.titulo}</h2>
            {paso.detalle && <p>{paso.detalle}</p>}
            {paso.datos && <p className="muted">{paso.datos.promocion.titulo} · {paso.datos.turista.nombre} · {paso.datos.cupon.codigo}</p>}
            {!paso.reintentar && <p className="small-note">El cupón no cambió.</p>}
            <div className={s.acciones}>
              {paso.reintentar && <button type="button" className="btn primary" onClick={paso.reintentar}>Reintentar</button>}
              <button type="button" className={`btn ${paso.reintentar ? 'secondary' : 'primary'}`} onClick={otro}>Escanear otro</button>
            </div>
          </section>
        )}

        {paso.tipo === 'hecho' && (
          <section className={`${s.resultado} ${s.bien}`} aria-labelledby="resultado-titulo">
            <span className={s.icono} aria-hidden="true">✓</span>
            <p className={s.etiqueta}>Cupón canjeado</p>
            <h2 id="resultado-titulo" ref={enfocar} tabIndex={-1}>¡Listo! Entregá el beneficio</h2>
            <p className={s.beneficio}><span className="display">{paso.datos.promocion.descuento_visual}</span></p>
            <p><strong>{paso.datos.promocion.titulo}</strong></p>
            <p className="muted">{paso.datos.turista.nombre} · {paso.datos.cupon.codigo} · {hora(paso.datos.canjeado_el)}</p>
            <div className={s.acciones}>
              <button type="button" className="btn primary" onClick={otro}>Escanear otro</button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

/** Foto de la promoción; sin foto (o si no carga), el fondo de la marca. */
function Foto({ url }: { url: string | null }) {
  const [rota, setRota] = useState(false);
  if (url && !rota) return <img className={s.foto} src={url} alt="" width={1200} height={600} onError={() => setRota(true)} />;
  return (
    <div className={`${s.foto} ${s.sinFoto}`}>
      <img src={asset('/wayki-promo/mascota/wayki-avatar-256.png')} alt="" width={256} height={256} />
    </div>
  );
}
