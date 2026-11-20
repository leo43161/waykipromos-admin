'use client';

// Marco de todas las pantallas del panel: sesión, barra de arriba y menú según el rol.
// Sin sesión vuelve al login; una sección que el rol no tiene vuelve al inicio. Es comodidad de UI:
// la protección real es que la API rechace cada pedido sin sesión o sin permiso.

import { createContext, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Brand from '@/components/Brand';
import { ROLES, SECCIONES } from '@/lib/roles';
import { getSesion, salir, validarSesion, type SesionStaff } from '@/lib/sesion';
import s from './Marco.module.css';

const SesionCtx = createContext<SesionStaff | null>(null);
/** La sesión del usuario del panel (dentro del Marco siempre existe). */
export const useSesion = () => use(SesionCtx)!;

const sinBarra = (r: string) => r.replace(/\/+$/, '');

export default function Marco({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const ruta = sinBarra(usePathname());
  const [sesion, setSesion] = useState<SesionStaff | null>(null);

  useEffect(() => {
    const guardada = getSesion();
    if (!guardada) return router.replace('/');
    setSesion(guardada);
    // GET /panel/sesion: si lo bloquearon o le cambiaron el rol, se ve al abrir.
    validarSesion().then((confirmada) => (confirmada ? setSesion(confirmada) : router.replace('/')));
  }, [router]);

  const seccion = SECCIONES.find((x) => sinBarra(x.ruta) === ruta);
  const permitida = !!sesion && (!seccion || seccion.roles.includes(sesion.rol));
  useEffect(() => {
    if (sesion && !permitida) router.replace('/panel/');
  }, [sesion, permitida, router]);

  if (!sesion || !permitida) return null;
  const menu = SECCIONES.filter((x) => x.roles.includes(sesion.rol));

  return (
    <SesionCtx value={sesion}>
      <header className={s.barra}>
        <Brand label="Panel" />
        <div className={s.quien}>
          <span><strong>{sesion.nombre}</strong><small>{ROLES[sesion.rol].nombre}{sesion.prestador && ` · ${sesion.prestador}`}</small></span>
          <button type="button" className="btn ghost" onClick={() => { salir(); router.replace('/'); }}>Salir</button>
        </div>
      </header>
      <div className={s.cuerpo}>
        {menu.length > 1 && (
          <nav className={s.menu} aria-label="Secciones del panel">
            {menu.map((x) => (
              <Link key={x.ruta} href={x.ruta} aria-current={x === seccion ? 'page' : undefined}>{x.nombrePara?.[sesion.rol] ?? x.nombre}</Link>
            ))}
          </nav>
        )}
        <div className={s.contenido}>{children}</div>
      </div>
    </SesionCtx>
  );
}
