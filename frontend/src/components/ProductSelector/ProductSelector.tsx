import { Check, ChevronDown } from 'lucide-react';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useProducts } from '../../api/hooks';
import { groupProducts } from './groupProducts';
import styles from './ProductSelector.module.css';

interface ProductSelectorProps {
  /** Selected product id, usually from useSelectedProductId (the URL). */
  value: number | null;
  onChange: (productId: number) => void;
  label?: string;
}

/** Searchable select with the products of /api/products grouped by family. */
export function ProductSelector({ value, onChange, label = 'Producto' }: ProductSelectorProps) {
  const { data: products = [], isPending, isError, refetch } = useProducts();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (productId: number) => `${id}-option-${productId}`;

  const selected = products.find((product) => product.product_id === value) ?? null;
  const groups = groupProducts(products, query);
  const options = groups.flatMap((group) => group.products);
  const activeOption = open ? options[activeIndex] : undefined;

  function openList() {
    setQuery('');
    // Start on the selected product so the arrow keys continue from it.
    setActiveIndex(
      Math.max(
        0,
        products.findIndex((product) => product.product_id === value),
      ),
    );
    setOpen(true);
  }

  function closeList() {
    setOpen(false);
    setQuery('');
  }

  function select(productId: number) {
    onChange(productId);
    closeList();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        openList();
      } else if (options.length > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((activeIndex + step + options.length) % options.length);
      }
    } else if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      select(activeOption.product_id);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeList();
    }
  }

  let placeholder = 'Busque un producto';
  if (isPending) placeholder = 'Cargando productos…';
  else if (selected) placeholder = selected.canonical_name;

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <div className={styles.control}>
        <input
          ref={inputRef}
          id={id}
          className={styles.input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeOption ? optionId(activeOption.product_id) : undefined}
          autoComplete="off"
          spellCheck={false}
          disabled={isPending || isError}
          placeholder={placeholder}
          value={open ? query : (selected?.canonical_name ?? '')}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onClick={() => !open && openList()}
          onKeyDown={handleKeyDown}
          onBlur={closeList}
        />
        <ChevronDown className={styles.chevron} size={18} aria-hidden="true" />
      </div>

      {isError && (
        <p className={styles.error} role="alert">
          No pudimos cargar los productos.{' '}
          <button type="button" className={styles.retry} onClick={() => refetch()}>
            Reintentar
          </button>
        </p>
      )}

      {/* preventDefault on mousedown keeps the focus in the input while an option is clicked. */}
      <div
        id={listId}
        role="listbox"
        aria-label={label}
        className={styles.list}
        hidden={!open}
        onMouseDown={(event) => event.preventDefault()}
      >
        {groups.map((group) => (
          <div
            key={group.family}
            role="group"
            aria-labelledby={`${id}-group-${group.family}`}
            className={styles.group}
          >
            <div id={`${id}-group-${group.family}`} className={styles.groupLabel}>
              {group.label}
            </div>
            {group.products.map((product) => {
              const isSelected = product.product_id === value;
              const isActive = product.product_id === activeOption?.product_id;
              return (
                <div
                  key={product.product_id}
                  id={optionId(product.product_id)}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.option} ${isActive ? styles.active : ''}`}
                  ref={
                    isActive ? (node) => node?.scrollIntoView?.({ block: 'nearest' }) : undefined
                  }
                  onClick={() => select(product.product_id)}
                >
                  <span className={styles.optionText}>
                    <span className={styles.optionName}>{product.canonical_name}</span>
                    {product.variety && (
                      <span className={styles.variety}>Variedad: {product.variety}</span>
                    )}
                  </span>
                  {isSelected && <Check className={styles.check} size={16} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        ))}
        {options.length === 0 && (
          <p className={styles.noResults}>Ningún producto coincide con «{query}».</p>
        )}
      </div>
    </div>
  );
}
