import { Outlet } from 'react-router-dom';
import styles from './AppLayout.module.css';
import { Footer } from './Footer';
import { Header } from './Header';

export function AppLayout() {
  return (
    <div className={styles.layout}>
      <a href="#main-content" className={styles.skipLink}>
        Saltar al contenido
      </a>
      <Header />
      <main id="main-content" className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
