import type { SupplyOrigins } from '../../api/types';
import { formatPlaceName } from '../../lib/format';
import type { ShareItem } from './ShareBars';

/**
 * Origin departments as bars: the main ones by name, the rest added up as "Otros departamentos"
 * and the imported part at the end, so the bars add up to 100 %.
 */
export function departmentItems(origins: SupplyOrigins, limit = 6): ShareItem[] {
  const main = origins.departments.slice(0, limit);
  const rest = origins.departments.slice(limit);
  const items: ShareItem[] = main.map((department) => ({
    key: department.code ?? department.name,
    label: formatPlaceName(department.name),
    kg: department.kg,
    sharePct: department.share_pct,
  }));
  if (rest.length > 0) {
    const kg = rest.reduce((total, department) => total + department.kg, 0);
    items.push({
      key: 'others',
      label: `Otros ${rest.length} departamentos`,
      kg,
      sharePct: origins.total_kg > 0 ? Math.round((kg / origins.total_kg) * 1000) / 10 : 0,
      muted: true,
    });
  }
  if (origins.imported_kg > 0) {
    items.push({
      key: 'imported',
      label: 'Importado',
      kg: origins.imported_kg,
      sharePct: origins.imported_share_pct,
      muted: true,
    });
  }
  return items;
}

export function municipalityItems(origins: SupplyOrigins): ShareItem[] {
  return origins.municipalities.map((municipality) => ({
    key: municipality.code,
    label: formatPlaceName(municipality.name ?? 'Municipio sin nombre'),
    detail: municipality.department ? formatPlaceName(municipality.department) : undefined,
    kg: municipality.kg,
    sharePct: municipality.share_pct,
  }));
}
