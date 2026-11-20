import type { Metadata } from 'next';
import { Suspense } from 'react';
import Visitantes from '@/components/Visitantes';

export const metadata: Metadata = { title: 'Visitantes' };

// Suspense: la ficha lee ?id= en el cliente (export estático).
export default function VisitantesPage() {
  return <Suspense><Visitantes /></Suspense>;
}
