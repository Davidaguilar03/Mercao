import { useProducts } from '../../api/hooks';
import { SearchSelect } from '../SearchSelect/SearchSelect';
import styles from '../SearchSelect/SearchSelect.module.css';
import { groupProducts } from './groupProducts';

interface ProductSelectorProps {
  /** Selected product id, usually from useProductSelection (the URL). */
  value: number | null;
  onChange: (productId: number) => void;
  label?: string;
}

/** Searchable select with the products of /api/products grouped by family. */
export function ProductSelector({ value, onChange, label = 'Producto' }: ProductSelectorProps) {
  const { data: products = [], isPending, isError, refetch } = useProducts();
  const groups = groupProducts(products).map((group) => ({
    key: group.family,
    label: group.label,
    options: group.products.map((product) => ({
      id: product.product_id,
      name: product.canonical_name,
      detail: product.variety ? `Variedad: ${product.variety}` : undefined,
      keywords: product.family,
    })),
  }));

  return (
    <SearchSelect
      label={label}
      groups={groups}
      value={value}
      onChange={onChange}
      placeholder={isPending ? 'Cargando productos…' : 'Busque un producto'}
      disabled={isPending || isError}
      noResults={(query) => `Ningún producto coincide con «${query}».`}
    >
      {isError && (
        <p className={styles.error} role="alert">
          No pudimos cargar los productos.{' '}
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            Reintentar
          </button>
        </p>
      )}
    </SearchSelect>
  );
}
