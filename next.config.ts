import type { NextConfig } from 'next';

// Export estático: `npm run build` genera la carpeta `out/` (HTML/CSS/JS puros).
// Prohibido todo lo que necesite servidor: API routes, Server Actions, middleware,
// cookies()/headers(), rutas dinámicas sin generateStaticParams. Ver CLAUDE.md.
const nextConfig: NextConfig = {
  // Subcarpeta donde se publica (ej. /waykipromos). Vacío en desarrollo; el deploy la define.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  output: 'export',
  trailingSlash: true, // /ingresar/ -> out/ingresar/index.html (sirve en Apache/Nginx sin reglas extra)
  images: { unoptimized: true }, // sin servidor de optimización de imágenes
};

export default nextConfig;
