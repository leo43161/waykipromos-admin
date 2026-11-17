import type { Metadata, Viewport } from 'next';
import { Anton, Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat', display: 'swap' });
// Sustituto libre de Gobold (títulos de campaña del manual) hasta tener la licencia. Ver --font-display en globals.css.
const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Wayki Promo · Panel', template: '%s · Wayki Promo Panel' },
  description: 'Panel de Wayki Promo para el Ente Tucumán Turismo, los comercios adheridos y sus empleados.',
  applicationName: 'Wayki Promo',
  authors: [{ name: 'Ente Autárquico Tucumán Turismo', url: 'https://www.tucumanturismo.gob.ar' }],
  // Panel interno: no debe aparecer en buscadores.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#0d3236', colorScheme: 'light', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${montserrat.variable} ${anton.variable}`}>
      <body>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        {children}
      </body>
    </html>
  );
}
