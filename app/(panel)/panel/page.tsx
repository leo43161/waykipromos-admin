import type { Metadata } from 'next';
import Panel from '@/components/Panel';

export const metadata: Metadata = { title: 'Inicio' };

export default function PanelPage() {
  return <Panel />;
}
