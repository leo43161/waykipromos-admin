'use client';

// Inicio del panel según el rol. Sin sesión vuelve al login. Esto es comodidad de UI:
// la protección real es que el backend rechace cada pedido sin sesión o sin permiso.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Encabezado from '@/components/Encabezado';
import { asset } from '@/lib/asset';
import { CANJEAN, ROLES } from '@/lib/roles';
import { getSesion, validarSesion, type SesionStaff } from '@/lib/sesion';
import s from './Panel.module.css';

export default function Panel() {
  const router = useRouter();
  const [sesion, setSesion] = useState<SesionStaff | null>(null);

  useEffect(() => {
    const actual = getSesion();
    if (!actual) return router.replace('/');
    setSesion(actual);
    // Confirma con la API (GET /panel/sesion): si lo bloquearon o le cambiaron el rol, se ve ya.
    validarSesion().then((confirmada) => (confirmada ? setSesion(confirmada) : router.replace('/')));
  }, [router]);

  if (!sesion) return null;
  const rol = ROLES[sesion.rol];

  return (
    <>
      <Encabezado />

      <main id="contenido" className={`${s.main} content-width`}>
        <section className={s.saludo}>
          <div>
            <p className={s.rol}>{rol.nombre}{sesion.prestador && <> en {sesion.prestador}</>}</p>
            <h1>Hola, {sesion.nombre}</h1>
            <p className="muted">{rol.quien}</p>
          </div>
          <img src={asset('/wayki-promo/mascota/wayki-busto.png')} alt="" width={546} height={456} className={s.wayki} />
        </section>

        {CANJEAN.includes(sesion.rol) && (
          <Link href="/canjear/" className={`btn accent ${s.canjear}`}>Canjear un cupón</Link>
        )}

        <section aria-labelledby="puede-title">
          <h2 id="puede-title" className={s.subtitulo}>Lo que vas a poder hacer desde acá</h2>
          <ul className={s.lista}>
            {rol.puede.map((x) => (
              <li key={x}>
                <span>{x}</span>
                <span className="badge orange">En construcción</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
