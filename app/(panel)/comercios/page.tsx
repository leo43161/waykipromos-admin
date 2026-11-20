import type { Metadata } from 'next';
import { Suspense } from 'react';
import Comercios from '@/components/Comercios';

export const metadata: Metadata = { title: 'Comercios' };

// Suspense: la ficha lee ?id= en el cliente (export estático).
export default function ComerciosPage() {
  return <Suspense><Comercios /></Suspense>;
}
