import type { Product } from '../../api/types';

export interface ProductGroup {
  family: string;
  label: string;
  products: Product[];
}

/** Lowercase without accents, so "platano" finds "Plátano". */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// The API family is a plain key ("platano"). The readable name is the product name without its
// variety: "Plátano hartón verde" minus "hartón verde" gives "Plátano".
function familyLabel(product: Product): string {
  const { canonical_name: name, variety, family } = product;
  if (variety && name.endsWith(variety)) {
    const label = name.slice(0, -variety.length).trim();
    if (label) return label;
  }
  if (!variety) return name;
  return family.charAt(0).toUpperCase() + family.slice(1);
}

/** Filters by name or family and groups by family, keeping the order of the API. */
export function groupProducts(products: Product[], query = ''): ProductGroup[] {
  const needle = normalizeText(query);
  const groups = new Map<string, ProductGroup>();
  for (const product of products) {
    const haystack = normalizeText(`${product.canonical_name} ${product.family}`);
    if (needle && !haystack.includes(needle)) continue;
    let group = groups.get(product.family);
    if (!group) {
      group = { family: product.family, label: familyLabel(product), products: [] };
      groups.set(product.family, group);
    }
    group.products.push(product);
  }
  return [...groups.values()];
}
