'use client';

// Visitantes (solo el Ente): turistas registrados y su perfil de viaje (la encuesta). Son datos personales: se
// muestra lo necesario (nombre y perfil, sin correo) y se exportan solo con el filtro que se está viendo.
// Contrato: GET /panel/visitantes (q, provincia_id | pais_id, rango_edad_id, desde, hasta), GET …/{id},
// GET /panel/exportar/visitantes. Listas de filtros: GET /encuesta/opciones (ids de la base).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api, apiLista, type OpcionesEncuestaApi, type VisitanteApi } from '@/lib/api';
import { descargarCsv } from '@/lib/descargar';
import { diaTucuman, fecha, fechaCorta, fechaHora, numero } from '@/lib/formato';
import { getToken } from '@/lib/sesion';
import { mensajeDe, useCarga } from '@/lib/useCarga';
import s from './Gestion.module.css';

/** "No me quedo a dormir (voy y vuelvo en el día / soy local)" → "No me quedo a dormir". */
const corto = (x: string | null) => x?.replace(/\s*\(.*\)$/, '') ?? '—';

export default function Visitantes() {
  const id = Number(useSearchParams().get('id'));
  return id ? <Ficha id={id} key={id} /> : <Lista />;
}

function Lista() {
  const opciones = useCarga(() => api<OpcionesEncuestaApi>('catalogos', 'GET', '/encuesta/opciones'), []).dato;
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [origen, setOrigen] = useState(''); // "p5" = provincia 5 · "x53" = país 53
  const [edad, setEdad] = useState('');
  const [dias, setDias] = useState('');
  const [pagina, setPagina] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [errorCsv, setErrorCsv] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setQ(texto.trim()); setPagina(1); }, 300);
    return () => clearTimeout(t);
  }, [texto]);

  const p = new URLSearchParams({ pagina: String(pagina), limite: '20' });
  if (q) p.set('q', q);
  if (origen) p.set(origen[0] === 'p' ? 'provincia_id' : 'pais_id', origen.slice(1));
  if (edad) p.set('rango_edad_id', edad);
  if (dias) { p.set('desde', diaTucuman(Number(dias) - 1)); p.set('hasta', diaTucuman()); }
  const ruta = `/panel/visitantes?${p}`;
  const { dato, error, cargando } = useCarga(() => apiLista<VisitanteApi>('ente', ruta, getToken()), [ruta]);
  const total = dato?.meta.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / 20));
  const cambiar = (f: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { f(e.target.value); setPagina(1); };

  async function exportar() {
    setExportando(true); setErrorCsv(null);
    try { await descargarCsv('visitantes', p); } catch (e) { setErrorCsv(mensajeDe(e)); } finally { setExportando(false); }
  }

  return (
    <main id="contenido" className={`${s.main} content-width`}>
      <div className={s.cabecera}>
        <div>
          <h1>Visitantes</h1>
          <p>Quiénes guardaron cupones y cómo viajan, según la encuesta que responden al registrarse.</p>
        </div>
        <button type="button" className="btn secondary" onClick={exportar} disabled={exportando || !total}>{exportando ? 'Preparando…' : 'Exportar CSV'}</button>
      </div>
      {errorCsv && <p className="form-error" role="alert">{errorCsv}</p>}

      <div className={s.filtros} role="search">
        <label className="field">Buscar
          <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre o procedencia" />
        </label>
        <label className="field">Procedencia
          <select value={origen} onChange={cambiar(setOrigen)}>
            <option value="">Todas</option>
            <optgroup label="Argentina">{opciones?.provincias.map((o) => <option key={o.id} value={`p${o.id}`}>{o.nombre}</option>)}</optgroup>
            <optgroup label="Otros países">{opciones?.paises.map((o) => <option key={o.id} value={`x${o.id}`}>{o.nombre}</option>)}</optgroup>
          </select>
        </label>
        <label className="field">Edad
          <select value={edad} onChange={cambiar(setEdad)}>
            <option value="">Todas</option>
            {opciones?.rangos_edad.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </label>
        <label className="field">Se registraron
          <select value={dias} onChange={cambiar(setDias)}>
            <option value="">Siempre</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option>
          </select>
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      <p className={s.contador} aria-live="polite">{cargando ? 'Cargando…' : `${numero(total)} ${total === 1 ? 'visitante' : 'visitantes'}`}</p>

      <div className={s.tablaCaja}>
        <table className={s.tabla}>
          <thead><tr><th>Visitante</th><th>Procedencia</th><th>Edad</th><th>Estadía</th><th>Viaja</th><th className={s.num}>Cupones / canjes</th></tr></thead>
          <tbody>
            {dato?.datos.map((v) => (
              <tr key={v.id}>
                <td><div className={s.nombre}><Link href={`/visitantes/?id=${v.id}`}>{v.nombre}</Link><small>Registro: {fechaCorta(v.registrado_el)}</small></div></td>
                <td>{v.procedencia ?? <span className="muted">Sin encuesta</span>}</td>
                <td>{v.rango_edad ?? '—'}</td>
                <td>{corto(v.duracion)}</td>
                <td>{v.compania ?? '—'}</td>
                <td className={s.num}>{numero(v.cupones_emitidos)} / {numero(v.cupones_canjeados)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {dato && !dato.datos.length && <p className={s.vacio}>{q || origen || edad || dias ? 'No encontramos visitantes con esos filtros.' : 'Todavía no se registró ningún visitante.'}</p>}
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
      <p className="small-note">Son datos personales: usalos solo para el programa y exportá únicamente lo que necesites.</p>
    </main>
  );
}

function Ficha({ id }: { id: number }) {
  const { dato: v, error } = useCarga(() => api<VisitanteApi>('ente', 'GET', `/panel/visitantes/${id}`, { token: getToken() }), [id]);
  if (error) return <main id="contenido" className={`${s.main} content-width`}><Link href="/visitantes/" className={s.volver}>← Visitantes</Link><p className="form-error" role="alert">{error}</p></main>;
  if (!v) return <main id="contenido" className={`${s.main} content-width`}><p className={s.contador}>Cargando…</p></main>;
  const conEncuesta = !!(v.rango_edad || v.procedencia);

  return (
    <main id="contenido" className={`${s.main} ${s.ficha} content-width`}>
      <Link href="/visitantes/" className={s.volver}>← Visitantes</Link>
      <div className={s.fichaCabecera}>
        <div className={s.logo}>{v.nombre.split(' ').map((x) => x[0]).slice(0, 2).join('')}</div>
        <div>
          <h1>{v.nombre}</h1>
          <span className="muted">Se registró el {fecha(v.registrado_el)}{v.ultimo_acceso && ` · Último ingreso: ${fechaHora(v.ultimo_acceso)}`}</span>
        </div>
      </div>

      <ul className={s.cifras}>
        <li><small>Cupones guardados</small><strong>{numero(v.cupones_emitidos)}</strong></li>
        <li><small>Canjes</small><strong>{numero(v.cupones_canjeados)}</strong></li>
      </ul>

      <section className="panel" aria-labelledby="perfil-titulo">
        <h2 id="perfil-titulo" className={s.titulito}>Perfil de viaje</h2>
        {conEncuesta ? (
          <dl className={s.datos}>
            <div><dt>Procedencia</dt><dd>{v.procedencia ?? '—'}</dd></div>
            <div><dt>Edad</dt><dd>{v.rango_edad ?? '—'}</dd></div>
            <div><dt>Estadía</dt><dd>{v.duracion ?? '—'}</dd></div>
            <div><dt>Viaja</dt><dd>{v.compania ?? '—'}</dd></div>
            <div><dt>Motivo del viaje</dt><dd>{v.motivo ?? '—'}</dd></div>
            <div><dt>Cómo conoció Wayki Promo</dt><dd>{v.medio ?? '—'}</dd></div>
          </dl>
        ) : <p className="muted">Todavía no respondió la encuesta (se la pedimos antes de su primer cupón).</p>}
      </section>
    </main>
  );
}
