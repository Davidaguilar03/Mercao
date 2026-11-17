import type { ReactNode } from 'react';
import styles from './states.module.css';

interface EmptyStateProps {
  title: string;
  /** Explanation or next step; the API "message" field fits here. */
  children?: ReactNode;
}

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className={styles.state}>
      <p className={styles.title}>{title}</p>
      {children && <div>{children}</div>}
    </div>
  );
}
