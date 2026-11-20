'use client';

// Cupones guardados y canjes por día (serie de GET /panel/resumen o /panel/reportes).
// Líneas de 2 px, un solo eje, leyenda + cursor que muestra los dos valores del día (mouse, dedo o flechas)
// y la tabla con todos los datos. Colores validados con el validador de dataviz (daltonismo y contraste).

import { useEffect, useRef, useState } from 'react';
import { dia, numero } from '@/lib/formato';
import s from './GraficoDiario.module.css';

export type Punto = { fecha: string; emitidos: number; canjeados: number };
const SERIES = [
  { clave: 'emitidos', nombre: 'Cupones guardados', color: '#0a8a70' },
  { clave: 'canjeados', nombre: 'Canjes', color: '#dd6912' },
] as const;
const ALTO = 200;
const M = { arriba: 12, derecha: 12, abajo: 26, izquierda: 34 };

/** Todos los días entre desde y hasta (la API solo manda los días con movimiento). */
function completar(desde: string, hasta: string, serie: Punto[]): Punto[] {
  const hay = new Map(serie.map((p) => [p.fecha, p]));
  const dias: Punto[] = [];
  for (let t = Date.parse(`${desde}T12:00:00Z`); t <= Date.parse(`${hasta}T12:00:00Z`); t += 86400_000) {
    const f = new Date(t).toISOString().slice(0, 10);
    dias.push(hay.get(f) ?? { fecha: f, emitidos: 0, canjeados: 0 });
  }
  return dias;
}

/** Tope "redondo" del eje: 1, 2, 5, 10, 20, 50… */
function tope(max: number) {
  if (max <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 5, 10].map((k) => k * p).find((v) => v >= max)!;
}

export default function GraficoDiario({ desde, hasta, serie }: { desde: string; hasta: string; serie: Punto[] }) {
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  const [i, setI] = useState<number | null>(null);

  useEffect(() => {
    const el = caja.current!;
    const ro = new ResizeObserver(([e]) => setAncho(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dias = completar(desde, hasta, serie);
  const totales = { emitidos: dias.reduce((a, p) => a + p.emitidos, 0), canjeados: dias.reduce((a, p) => a + p.canjeados, 0) };
  const max = tope(Math.max(...dias.map((p) => Math.max(p.emitidos, p.canjeados))));
  const w = Math.max(0, ancho - M.izquierda - M.derecha);
  const h = ALTO - M.arriba - M.abajo;
  const x = (k: number) => M.izquierda + (dias.length > 1 ? (k / (dias.length - 1)) * w : w / 2);
  const y = (v: number) => M.arriba + h - (v / max) * h;
  const marcas = [0, max / 2, max];
  const etiquetasX = [0, Math.floor((dias.length - 1) / 2), dias.length - 1];

  function mover(clientX: number) {
    const r = caja.current!.getBoundingClientRect();
    const k = Math.round(((clientX - r.left - M.izquierda) / (w || 1)) * (dias.length - 1));
    setI(Math.min(dias.length - 1, Math.max(0, k)));
  }
  function teclas(e: React.KeyboardEvent) {
    const paso = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[e.key];
    if (paso === undefined) return;
    e.preventDefault();
    setI((v) => Math.min(dias.length - 1, Math.max(0, (v ?? dias.length - 1) + paso)));
  }
  const p = i === null ? null : dias[i];

  return (
    <figure className={s.figura}>
      <ul className={s.leyenda}>
        {SERIES.map((x_) => (
          <li key={x_.clave}><span className={s.clave} style={{ background: x_.color }} />{x_.nombre} <strong>{numero(totales[x_.clave])}</strong></li>
        ))}
      </ul>
      <div
        ref={caja}
        className={s.lienzo}
        tabIndex={0}
        role="group"
        aria-label="Gráfico por día. Usá las flechas para recorrer los días."
        onPointerMove={(e) => mover(e.clientX)}
        onPointerDown={(e) => mover(e.clientX)}
        onPointerLeave={() => setI(null)}
        onKeyDown={teclas}
        onFocus={() => setI((v) => v ?? dias.length - 1)}
        onBlur={() => setI(null)}
      >
        {ancho > 0 && (
          <svg width={ancho} height={ALTO} aria-hidden="true">
            {marcas.map((v) => (
              <g key={v}>
                <line x1={M.izquierda} x2={ancho - M.derecha} y1={y(v)} y2={y(v)} className={s.grilla} />
                <text x={M.izquierda - 8} y={y(v)} className={s.eje} textAnchor="end" dominantBaseline="middle">{numero(v)}</text>
              </g>
            ))}
            {etiquetasX.map((k, n) => (
              <text key={n} x={x(k)} y={ALTO - 6} className={s.eje} textAnchor={n === 0 ? 'start' : n === 2 ? 'end' : 'middle'}>{dia(dias[k].fecha)}</text>
            ))}
            {SERIES.map((x_) => (
              <polyline key={x_.clave} fill="none" stroke={x_.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                points={dias.map((d, k) => `${x(k)},${y(d[x_.clave])}`).join(' ')} />
            ))}
            {p && (
              <g>
                <line x1={x(i!)} x2={x(i!)} y1={M.arriba} y2={M.arriba + h} className={s.cursor} />
                {SERIES.map((x_) => <circle key={x_.clave} cx={x(i!)} cy={y(p[x_.clave])} r={5} fill={x_.color} stroke="#fff" strokeWidth={2} />)}
              </g>
            )}
          </svg>
        )}
        {p && (
          <div className={s.globo} style={{ left: Math.min(Math.max(x(i!), 70), ancho - 70) }} aria-live="polite">
            <b>{dia(p.fecha)}</b>
            {SERIES.map((x_) => (
              <span key={x_.clave}><i style={{ background: x_.color }} /><strong>{numero(p[x_.clave])}</strong> {x_.nombre.toLowerCase()}</span>
            ))}
          </div>
        )}
      </div>
      <details className={s.tabla}>
        <summary>Ver los datos en una tabla</summary>
        <table>
          <thead><tr><th>Día</th>{SERIES.map((x_) => <th key={x_.clave}>{x_.nombre}</th>)}</tr></thead>
          <tbody>{dias.filter((d) => d.emitidos || d.canjeados).map((d) => (
            <tr key={d.fecha}><td>{dia(d.fecha)}</td><td>{numero(d.emitidos)}</td><td>{numero(d.canjeados)}</td></tr>
          ))}</tbody>
        </table>
      </details>
    </figure>
  );
}
