import Marco from '@/components/Marco';

// Todas las pantallas con sesión (el login, app/page.tsx, queda afuera). El grupo (panel) no cambia las URLs.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <Marco>{children}</Marco>;
}
