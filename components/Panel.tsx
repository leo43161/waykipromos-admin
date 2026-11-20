'use client';

// Inicio del panel (GET /panel/resumen). El empleado ve sus canjes de hoy; el encargado, los números de su comercio;
// el Ente, los de todo el programa, en el período elegido.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import GraficoDiario from '@/components/GraficoDiario';
import { useSesion } from '@/components/Marco';
import { api, ErrorApi, type ResumenApi } from '@/lib/api';
import { asset } from '@/lib/asset';
import { diaTucuman, fechaHora, hora, numero, porcentaje } from '@/lib/formato';
import { CANJEAN, ROLES } from '@/lib/roles';
import { getToken } from '@/lib/sesion';
import s from './Panel.module.css';

const PERIODOS = [7, 30, 90];
type Resumen = Exclude<ResumenApi, { rol: 'empleado' }>;

export default function Panel() {
  const sesion = useSesion();
  const rol = ROLES[sesion.rol];
  const esEnte = sesion.rol === 'admin_ente' || sesion.rol === 'superadmin';
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<ResumenApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    const q = sesion.rol === 'empleado' ? '' : `?desde=${diaTucuman(dias - 1)}&hasta=${diaTucuman()}`;
    api<ResumenApi>('sesion', 'GET', `/panel/resumen${q}`, { token: getToken() })
      .then((r) => { if (vigente) { setDatos(r); setError(null); } })
      .catch((e) => { if (vigente) setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar el resumen.'); });
    return () => { vigente = false; };
  }, [dias, sesion.rol]);

  return (
    <main id="contenido" className={`${s.main} content-width`}>
      <section className={s.saludo}>
        <div>
          <p className={s.rol}>{esEnte ? 'Ente Tucumán Turismo' : `${rol.nombre}${sesion.prestador ? ` en ${sesion.prestador}` : ''}`}</p>
          <h1>Hola, {sesion.nombre.split(' ')[0]}</h1>
          <p className="muted">{esEnte ? 'Una mirada a los beneficios, los comercios y quienes nos visitan.' : rol.quien}</p>
        </div>
        <img src={asset('/wayki-promo/mascota/wayki-busto.png')} alt="" width={546} height={456} className={s.wayki} />
      </section>

      {CANJEAN.includes(sesion.rol) && <Link href="/canjear/" className={`btn accent ${s.canjear}`}>Canjear un cupón</Link>}

      {error && <p className="form-error" role="alert">{error}</p>}
      {datos?.rol === 'empleado' && <CanjesDeHoy datos={datos} />}
      {datos && datos.rol !== 'empleado' && <Resumen datos={datos} dias={dias} setDias={setDias} esEnte={esEnte} />}
    </main>
  );
}

function CanjesDeHoy({ datos }: { datos: Extract<ResumenApi, { rol: 'empleado' }> }) {
  return (
    <section className="panel" aria-labelledby="hoy-titulo">
      <h2 id="hoy-titulo" className={s.subtitulo}>Tus canjes de hoy: {numero(datos.canjes_hoy)}</h2>
      {datos.ultimos_canjes.length ? (
        <ul className={s.filas}>
          {datos.ultimos_canjes.map((c) => (
            <li key={c.id}>
              <span><strong>{c.promocion.titulo}</strong><small>{c.turista.nombre} · {c.codigo}</small></span>
              <span className={s.cifra}>{hora(c.canjeado_el)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted">Todavía no canjeaste cupones hoy.</p>}
    </section>
  );
}

function Resumen({ datos, dias, setDias, esEnte }: { datos: Resumen; dias: number; setDias: (n: number) => void; esEnte: boolean }) {
  const t = datos.totales;
  const maxCategoria = Math.max(1, ...datos.categorias.map((c) => c.cantidad));
  return (
    <>
      <div className={s.cabecera}>
        <h2 className={s.subtitulo}>{esEnte ? 'El programa en números' : 'Tu comercio en números'}</h2>
        <div className={s.periodos} role="group" aria-label="Período">
          {PERIODOS.map((n) => (
            <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)}>{n} días</button>
          ))}
        </div>
      </div>

      <ul className={s.cifras}>
        <li><small>Visitantes con cupón</small><strong>{numero(t.visitantes)}</strong></li>
        <li><small>Cupones guardados</small><strong>{numero(t.emitidos)}</strong></li>
        <li><small>Canjes</small><strong>{numero(t.canjeados)}</strong><span>{porcentaje(t.tasa_canje)} de los cupones</span></li>
        <li><small>Promociones activas</small><strong>{numero(t.promociones_activas)}</strong></li>
        {esEnte && <li><small>Comercios activos</small><strong>{numero(t.comercios_activos)}</strong></li>}
      </ul>

      <section className="panel" aria-labelledby="dia-titulo">
        <h3 id="dia-titulo" className={s.titulito}>Del cupón a la visita, día por día</h3>
        <GraficoDiario desde={datos.periodo.desde} hasta={datos.periodo.hasta} serie={datos.serie} />
      </section>

      <div className={s.dos}>
        <section className="panel" aria-labelledby="cat-titulo">
          <h3 id="cat-titulo" className={s.titulito}>Cupones guardados por categoría</h3>
          {datos.categorias.length ? (
            <ul className={s.barras}>
              {datos.categorias.map((c) => (
                <li key={c.etiqueta}>
                  <span>{c.etiqueta}</span>
                  <span className={s.barra}><i style={{ width: `${(c.cantidad / maxCategoria) * 100}%` }} /></span>
                  <strong>{numero(c.cantidad)}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="muted">Sin cupones en este período.</p>}
        </section>

        <section className="panel" aria-labelledby="top-titulo">
          <h3 id="top-titulo" className={s.titulito}>Las promociones más elegidas</h3>
          {datos.promociones_top.length ? (
            <table className={s.tabla}>
              <thead><tr><th>Promoción</th><th>Cupones</th><th>Canjes</th></tr></thead>
              <tbody>{datos.promociones_top.map((p) => (
                <tr key={p.id ?? p.etiqueta}><td>{p.etiqueta}</td><td>{numero(p.cantidad)}</td><td>{numero(p.canjeados ?? 0)}</td></tr>
              ))}</tbody>
            </table>
          ) : <p className="muted">Sin cupones en este período.</p>}
        </section>
      </div>

      <section className="panel" aria-labelledby="act-titulo">
        <h3 id="act-titulo" className={s.titulito}>Últimos movimientos</h3>
        {datos.actividad.length ? (
          <ul className={s.filas}>
            {datos.actividad.map((a) => (
              <li key={a.id}>
                <span><strong>{a.descripcion}</strong>{a.comercio && <small>{a.comercio.nombre}</small>}</span>
                <span className={s.cifra}>{fechaHora(a.ocurrido_el)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">Todavía no hay movimientos.</p>}
      </section>
    </>
  );
}
