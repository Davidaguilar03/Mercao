import { Card } from '../components/Card/Card';
import { PageHeader } from '../components/layout/PageHeader';
import styles from './PlaceholderPage.module.css';

interface PlaceholderPageProps {
  title: string;
  description: string;
  /** What the page will show once it is built. */
  contents: string[];
}

/** Temporary content for the pages that are built in the next stage. */
export function PlaceholderPage({ title, description, contents }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card title="Estamos preparando esta página">
        <p>Aquí va a encontrar:</p>
        <ul className={styles.list}>
          {contents.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Card>
    </>
  );
}
