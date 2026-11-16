import { MarketScene } from '../illustrations/MarketDoodles';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  /** Shown as the page heading and in the browser tab ("Panorama | Mercao"). */
  title: string;
  description: string;
}

/** Band at the top of every page: title, subtitle and part of the market illustration. */
export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {/* React moves <title> to the document head. */}
      <title>{`${title} | Mercao`}</title>
      <MarketScene className={styles.scene} />
      <div className={styles.text}>
        <h1>{title}</h1>
        <p className={styles.description}>{description}</p>
      </div>
    </header>
  );
}
