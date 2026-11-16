import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import logo from '../../assets/brand/logo.png';
import { PRODUCT_PARAM } from '../../hooks/useSelectedProductId';
import styles from './Header.module.css';

const NAV_ITEMS = [
  { to: '/', label: 'Panorama', keepsProduct: true },
  { to: '/producto', label: 'Producto', keepsProduct: true },
  { to: '/oportunidades', label: 'Oportunidades', keepsProduct: true },
  { to: '/como-funciona', label: 'Cómo funciona', keepsProduct: false },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const productId = searchParams.get(PRODUCT_PARAM);
  // The product pages keep the selected product when moving between them.
  const productSearch = productId ? `?${PRODUCT_PARAM}=${encodeURIComponent(productId)}` : '';

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Link
          to="/"
          className={styles.brand}
          aria-label="Mercao, ir al inicio"
          onClick={() => setMenuOpen(false)}
        >
          <img src={logo} alt="" className={styles.logo} width={44} height={47} />
          <span className={styles.brandText}>
            <span className={styles.wordmark}>Mercao</span>
            <span className={styles.tagline}>Precios de plaza, claros.</span>
          </span>
        </Link>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          <span className="visually-hidden">{menuOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
        </button>

        <nav
          id="main-navigation"
          aria-label="Principal"
          className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`}
        >
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={{ pathname: item.to, search: item.keepsProduct ? productSearch : '' }}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
