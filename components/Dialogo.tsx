'use client';

// Ventana modal con <dialog> nativo: atrapa el foco, cierra con Escape y devuelve el foco al botón que la abrió.

import { useEffect, useRef } from 'react';
import s from './Gestion.module.css';

export default function Dialogo({ abierto, onCerrar, titulo, children }: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog ref={ref} className={s.dialogo} aria-labelledby="dialogo-titulo" onClose={onCerrar}
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      {abierto && (
        <div className={s.dialogoCuerpo}>
          <div className={s.dialogoCabecera}>
            <h2 id="dialogo-titulo">{titulo}</h2>
            <button type="button" className={s.cerrar} onClick={onCerrar} aria-label="Cerrar">×</button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
