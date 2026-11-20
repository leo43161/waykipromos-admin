import type { Metadata } from 'next';
import { Suspense } from 'react';
import Usuarios from '@/components/Usuarios';

export const metadata: Metadata = { title: 'Usuarios' };

// Suspense: lee ?nuevo y ?comercio_id en el cliente (export estático).
export default function UsuariosPage() {
  return <Suspense><Usuarios /></Suspense>;
}
