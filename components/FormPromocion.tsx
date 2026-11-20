'use client';

// Crear o editar una promoción (POST /panel/promociones, PUT /panel/promociones/{id}).
// El Ente elige el comercio y puede destacarla; el encargado crea para su comercio. La foto se sube al final
// (POST …/imagen necesita el id). Las reglas las valida la API: acá solo se muestran sus errores por campo.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSesion } from '@/components/Marco';
import { api, apiLista, ErrorApi, type ComercioApi, type ModalidadApi, type Opcion, type PromocionCuerpo, type PromocionGestionApi } from '@/lib/api';
import { diaTucuman } from '@/lib/formato';
import { getToken } from '@/lib/sesion';
import { mensajeDe, useCarga } from '@/lib/useCarga';
import s from './Gestion.module.css';

export const DIAS: [string, string][] = [['LUN', 'Lun'], ['MAR', 'Mar'], ['MIE', 'Mié'], ['JUE', 'Jue'], ['VIE', 'Vie'], ['SAB', 'Sáb'], ['DOM', 'Dom']];

export default function FormPromocion({ actual }: { actual?: PromocionGestionApi }) {
  const router = useRouter();
  const sesion = useSesion();
  const esEnte = sesion.rol === 'admin_ente' || sesion.rol === 'superadmin';
  const opciones = useCarga(async () => {
    const [modalidades, categorias, comercios] = await Promise.all([
      api<ModalidadApi[]>('catalogos', 'GET', '/modalidades'),
      api<Opcion[]>('catalogos', 'GET', '/categorias'),
      esEnte && !actual ? apiLista<ComercioApi>('comercios', '/panel/comercios?estado=AUTORIZADO&limite=100', getToken()).then((r) => r.datos) : [],
    ]);
    return { modalidades, categorias, comercios };
  }, []).dato;

  const [modalidad, setModalidad] = useState(actual?.modalidad.id ?? 0);
  const [dias, setDias] = useState<string[]>(actual?.dias_validos ?? []);
  const [conHorario, setConHorario] = useState(!!actual?.horario);
  const [foto, setFoto] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const personalizada = opciones?.modalidades.find((m) => m.id === modalidad)?.tipo === 'PERSONALIZADO';

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const publicar = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publicar';
    const f = new FormData(e.currentTarget);
    const texto = (k: string) => String(f.get(k) ?? '').trim() || null;
    const cuerpo: PromocionCuerpo = {
      titulo: String(f.get('titulo') ?? '').trim(),
      descripcion: texto('descripcion'),
      condiciones: texto('condiciones'),
      modalidad_id: modalidad,
      modalidad_personalizada: personalizada ? texto('modalidad_personalizada') : null,
      fecha_desde: String(f.get('fecha_desde')),
      fecha_hasta: String(f.get('fecha_hasta')),
      cupos_totales: Number(f.get('cupos_totales')),
      dias_validos: dias.length && dias.length < 7 ? dias : null,
      horario: conHorario ? { desde: String(f.get('desde')), hasta: String(f.get('hasta')) } : null,
      ...(f.get('categoria_id') && { categoria_id: Number(f.get('categoria_id')) }),
      ...(esEnte && { destacada: f.get('destacada') === 'on' }),
      ...(!actual && esEnte && { comercio_id: Number(f.get('comercio_id')) || undefined }),
      ...(!actual && { estado: publicar ? 'PUBLICADA' : 'BORRADOR' }),
    };
    setEnviando(true); setError(null); setCampos({});
    let guardada: PromocionGestionApi | null = null;
    try {
      guardada = actual
        ? await api<PromocionGestionApi>('promociones', 'PUT', `/panel/promociones/${actual.id}`, { cuerpo, token: getToken() })
        : await api<PromocionGestionApi>('promociones', 'POST', '/panel/promociones', { cuerpo, token: getToken() });
      if (foto) {
        const fd = new FormData();
        fd.append('imagen', foto);
        await api('promociones', 'POST', `/panel/promociones/${guardada.id}/imagen`, { cuerpo: fd, token: getToken() });
      }
      router.push(`/promociones/?id=${guardada.id}`);
    } catch (err) {
      if (guardada) { setError(`La promoción se guardó, pero la foto no: ${mensajeDe(err)} Probá subirla desde su ficha.`); return; }
      setError(mensajeDe(err));
      if (err instanceof ErrorApi && err.detalles) {
        const d = err.detalles as Record<string, unknown>;
        setCampos(Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === 'string')) as Record<string, string>);
        if (Array.isArray(d.motivos)) setError(`${err.message} ${d.motivos.join(' ')}`); // NO_SE_PUEDE_PUBLICAR al crear publicada
      }
    } finally {
      setEnviando(false);
    }
  }

  const err = (k: string) => campos[k] && <span className={s.errorCampo}>{campos[k]}</span>;
  const volver = actual ? `/promociones/?id=${actual.id}` : '/promociones/';
  // Sin las listas, los <select> con defaultValue no encuentran su opción: esperamos a tenerlas.
  if (!opciones) return <main id="contenido" className={`${s.main} content-width`}><p className={s.contador}>Cargando…</p></main>;

  return (
    <main id="contenido" className={`${s.main} content-width`}>
      <Link href={volver} className={s.volver}>← {actual ? actual.titulo : 'Promociones'}</Link>
      <div className={s.cabecera}><div><h1>{actual ? 'Editar promoción' : 'Crear una promoción'}</h1>
        <p>{actual ? `${actual.comercio.nombre} · ${actual.comercio.lugar}` : 'Un beneficio concreto, con cupos y fechas claras, para que los visitantes elijan el comercio.'}</p></div></div>

      <form className={`${s.form} ${s.formAncho}`} onSubmit={enviar} noValidate>
        <section className="panel">
          <h2 className={s.titulito}>El beneficio</h2>
          <div className={s.form}>
            {esEnte && !actual && (
              <label className="field">Comercio
                <select name="comercio_id" defaultValue="" required aria-invalid={!!campos.comercio_id}>
                  <option value="" disabled>Elegí el comercio</option>
                  {opciones?.comercios.map((c) => <option key={c.id} value={c.id}>{c.nombre} ({c.localidad.nombre})</option>)}
                </select>{err('comercio_id')}
              </label>
            )}
            <label className="field">Título <small>Lo primero que lee el visitante. Ej.: &quot;2x1 en la merienda&quot;</small>
              <input name="titulo" defaultValue={actual?.titulo} required maxLength={180} aria-invalid={!!campos.titulo} />{err('titulo')}
            </label>
            <div className={s.dosCol}>
              <label className="field">Tipo de descuento
                <select value={modalidad || ''} onChange={(e) => setModalidad(Number(e.target.value))} required aria-invalid={!!campos.modalidad_id}>
                  <option value="" disabled>Elegí uno</option>
                  {opciones?.modalidades.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>{err('modalidad_id')}
              </label>
              {personalizada && (
                <label className="field">Beneficio <small>Ej.: &quot;Postre de regalo&quot;</small>
                  <input name="modalidad_personalizada" defaultValue={actual?.modalidad_personalizada ?? ''} maxLength={60} aria-invalid={!!campos.modalidad_personalizada} />{err('modalidad_personalizada')}
                </label>
              )}
            </div>
            <label className="field">Descripción <small>Opcional. Qué incluye.</small>
              <textarea name="descripcion" defaultValue={actual?.descripcion ?? ''} maxLength={2000} />{err('descripcion')}
            </label>
            <label className="field">Condiciones <small>Opcional. Ej.: &quot;No acumulable con otras promociones&quot;</small>
              <textarea name="condiciones" defaultValue={actual?.condiciones ?? ''} maxLength={2000} />{err('condiciones')}
            </label>
          </div>
        </section>

        <section className="panel">
          <h2 className={s.titulito}>Cuándo y cuántos</h2>
          <div className={s.form}>
            <div className={s.tresCol}>
              <label className="field">Desde
                <input name="fecha_desde" type="date" defaultValue={actual?.fecha_desde ?? diaTucuman()} required aria-invalid={!!campos.fecha_desde} />{err('fecha_desde')}
              </label>
              <label className="field">Hasta
                <input name="fecha_hasta" type="date" defaultValue={actual?.fecha_hasta} required aria-invalid={!!campos.fecha_hasta} />{err('fecha_hasta')}
              </label>
              <label className="field">Cupos <small>Cupones disponibles en total</small>
                <input name="cupos_totales" type="number" inputMode="numeric" min={1} max={100000} defaultValue={actual?.cupos_totales ?? 50} required aria-invalid={!!campos.cupos_totales} />{err('cupos_totales')}
              </label>
            </div>
            <fieldset className={s.dias}>
              <legend>Días en que vale <small>Sin marcar = todos los días</small></legend>
              <div>
                {DIAS.map(([k, nombre]) => (
                  <label key={k} className={s.chip}>
                    <input type="checkbox" checked={dias.includes(k)} onChange={(e) => setDias(e.target.checked ? [...dias, k] : dias.filter((x) => x !== k))} />
                    <span>{nombre}</span>
                  </label>
                ))}
              </div>
              {err('dias_validos')}
            </fieldset>
            <label className={s.check}><input type="checkbox" checked={conHorario} onChange={(e) => setConHorario(e.target.checked)} /> Vale solo en un horario</label>
            {conHorario && (
              <div className={s.dosCol}>
                <label className="field">De <input name="desde" type="time" defaultValue={actual?.horario?.desde ?? '16:00'} required /></label>
                <label className="field">A <input name="hasta" type="time" defaultValue={actual?.horario?.hasta ?? '20:00'} required /></label>
                {err('horario')}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <h2 className={s.titulito}>Cómo se muestra</h2>
          <div className={s.form}>
            <div className={s.dosCol}>
              <label className="field">Categoría <small>Por defecto, la del comercio</small>
                <select name="categoria_id" defaultValue={actual?.categoria.id ?? ''}>
                  <option value="">La del comercio</option>
                  {opciones?.categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </label>
              <label className="field">{actual?.imagen_url ? 'Cambiar la foto' : 'Foto'} <small>JPG, PNG o WebP, hasta 2 MB</small>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            {esEnte && (
              <label className={s.check}><input type="checkbox" name="destacada" defaultChecked={actual?.destacada} /> Destacada: aparece primero en la app del turista</label>
            )}
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className={s.botones}>
          <Link href={volver} className="btn ghost">Cancelar</Link>
          {actual ? (
            <button className="btn primary" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</button>
          ) : (
            <>
              <button className="btn secondary" disabled={enviando} value="borrador">Guardar como borrador</button>
              <button className="btn accent" disabled={enviando} value="publicar">{enviando ? 'Guardando…' : 'Publicar'}</button>
            </>
          )}
        </div>
      </form>
    </main>
  );
}
