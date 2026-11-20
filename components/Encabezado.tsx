'use client';

// Barra de arriba de todas las pantallas del panel.

import { useRouter } from 'next/navigation';
import Brand from '@/components/Brand';
import { salir } from '@/lib/sesion';
import s from './Panel.module.css';

export default function Encabezado() {
  const router = useRouter();
  return (
    <header className={s.header}>
      <div className={`${s.headerIn} content-width`}>
        <Brand label="Panel" />
        <button type="button" className="btn ghost" onClick={() => { salir(); router.replace('/'); }}>Salir</button>
      </div>
    </header>
  );
}
