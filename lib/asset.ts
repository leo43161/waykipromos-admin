// Antepone el basePath (/waykipromos… en producción) a una ruta de public/.
// next/link lo agrega solo; <img src> no. Usar siempre: <img src={asset('/wayki-promo/…')} />
export const asset = (ruta: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}${ruta}`;
