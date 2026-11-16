import type { ReactNode } from 'react';
import { MarketScene } from '../illustrations/MarketDoodles';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  /** Shown as the page heading and in the browser tab ("Panorama | Mercao"). */
  title: string;
  description: string;
  /** Selectors of the page (product, market, horizon), shown inside the band. */
  children?: ReactNode;
}

/** Band at the top of every page: title, subtitle, the selectors and the market illustration. */
export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <header className={styles.band}>
      {/* React moves <title> to the document head. */}
      <title>{`${title} | Mercao`}</title>
      <div className={`${styles.inner} ${children ? styles.withControls : ''}`}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        {children && <div className={styles.controls}>{children}</div>}
        <MarketScene className={styles.scene} />
      </div>
    </header>
  );
}
