import styles from './PageHeader.module.css';

interface PageHeaderProps {
  /** Shown as the page heading and in the browser tab ("Panorama | Mercao"). */
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {/* React moves <title> to the document head. */}
      <title>{`${title} | Mercao`}</title>
      <h1>{title}</h1>
      <p className={styles.description}>{description}</p>
    </header>
  );
}
