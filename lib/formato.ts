// Formatos que se repiten en el panel. La hora es siempre la de Tucumán (la API manda ISO con -03:00).

const TZ = 'America/Argentina/Tucuman';

export const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: TZ });
export const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: TZ });
export const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ });
export const fechaHora = (iso: string) => `${fechaCorta(iso)}, ${hora(iso)}`;
export const numero = (n: number) => n.toLocaleString('es-AR');
export const porcentaje = (x: number) => `${Math.round(x * 100)} %`;

/** "2026-11-20" en Tucumán, n días antes de hoy (0 = hoy). */
export const diaTucuman = (n = 0) => new Date(Date.now() - 3 * 3600_000 - n * 86400_000).toISOString().slice(0, 10);

/** Fecha corta de un día "AAAA-MM-DD" (sin correrse de día por la zona horaria). */
export const dia = (d: string) => fechaCorta(`${d}T12:00:00-03:00`);
