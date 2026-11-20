// GET /panel/exportar/{recurso}: baja el CSV que arma la API (con BOM y las fórmulas ya neutralizadas)
// con el nombre de archivo que sugiere. `filtros` = los mismos del listado que se está viendo.

import { apiCsv } from './api';
import { getToken } from './sesion';

export async function descargarCsv(recurso: string, filtros?: URLSearchParams) {
  const q = new URLSearchParams(filtros);
  q.delete('pagina');
  q.delete('limite');
  const { texto, archivo } = await apiCsv(`/panel/exportar/${recurso}${q.size ? `?${q}` : ''}`, getToken());
  const url = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: archivo });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
