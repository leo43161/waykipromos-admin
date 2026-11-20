import type { Metadata } from 'next';
import { Suspense } from 'react';
import Promociones from '@/components/Promociones';

export const metadata: Metadata = { title: 'Promociones' };

// Suspense: lee ?id=, ?editar y ?nueva en el cliente (export estático).
export default function PromocionesPage() {
  return <Suspense><Promociones /></Suspense>;
}
