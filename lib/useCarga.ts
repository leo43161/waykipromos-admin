'use client';

// Carga datos de la API para una pantalla: estado de carga, error y "recargar" después de una acción.
// Si la sesión venció (401), vuelve al login.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorApi } from './api';
import { salir } from './sesion';

export const mensajeDe = (e: unknown) => (e instanceof ErrorApi ? e.message : 'Algo falló. Probá de nuevo en un rato.');

export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const router = useRouter();
  const [r, setR] = useState<{ dato: T | null; error: string | null; cargando: boolean }>({ dato: null, error: null, cargando: true });
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    let vigente = true;
    setR((x) => ({ ...x, cargando: true }));
    cargar().then(
      (dato) => { if (vigente) setR({ dato, error: null, cargando: false }); },
      (e) => {
        if (!vigente) return;
        if (e instanceof ErrorApi && e.http === 401) { salir(); router.replace('/'); return; }
        setR((x) => ({ ...x, error: mensajeDe(e), cargando: false }));
      },
    );
    return () => { vigente = false; };
  }, [...deps, vuelta]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ...r, recargar: () => setVuelta((v) => v + 1) };
}
