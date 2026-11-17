import Link from 'next/link';
import { asset } from '@/lib/asset';

/** Logo Wayki | PROMO, como en el demo. `label` muestra la sección (ej. "Panel"). */
export default function Brand({ label }: { label?: string }) {
  return (
    <Link href="/" className="brand" aria-label="Wayki Promo, inicio">
      <img src={asset('/wayki-promo/marca/logo-wayki-original-recorte.png')} alt="Wayki" width={75} height={34} />
      <span className="brand-divider" aria-hidden="true" />
      <span className="brand-word">PROMO</span>
      {label && <span className="badge">{label}</span>}
    </Link>
  );
}
