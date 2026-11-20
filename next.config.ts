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
  // Solo `npm run dev`: deja abrir el servidor desde otra PC o el celular de la red local (ej. http://10.20.20.5:3001).
  // Sin esto Next bloquea su JavaScript de desarrollo: la página se ve pero los botones no responden.
  allowedDevOrigins: ['10.*.*.*', '192.168.*.*'],
};

export default nextConfig;
