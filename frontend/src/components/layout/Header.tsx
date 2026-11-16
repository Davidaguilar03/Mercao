import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import logo from '../../assets/brand/logo.png';
import { HORIZON_PARAM, PRODUCT_PARAM } from '../../hooks/urlSelection';
import styles from './Header.module.css';

const NAV_ITEMS = [
  { to: '/', label: 'Panorama', keepsSelection: true },
  { to: '/producto', label: 'Producto', keepsSelection: true },
  { to: '/oportunidades', label: 'Oportunidades', keepsSelection: true },
  { to: '/como-funciona', label: 'Cómo funciona', keepsSelection: false },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchParams] = useSearchParams();
  // The product and the horizon travel with the links, so they survive a change of page.
  const kept = new URLSearchParams();
  for (const name of [PRODUCT_PARAM, HORIZON_PARAM]) {
    const value = searchParams.get(name);
    if (value) kept.set(name, value);
  }
  const selectionSearch = kept.size > 0 ? `?${kept}` : '';

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
                  to={{ pathname: item.to, search: item.keepsSelection ? selectionSearch : '' }}
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
