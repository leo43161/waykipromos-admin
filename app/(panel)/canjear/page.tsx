import type { Metadata } from 'next';
import Canjear from '@/components/Canjear';

export const metadata: Metadata = { title: 'Canjear cupón' };

export default function CanjearPage() {
  return <Canjear />;
}
