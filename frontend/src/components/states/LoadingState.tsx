import styles from './states.module.css';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Cargando datos…' }: LoadingStateProps) {
  return (
    <div className={styles.state} role="status">
      <span className={styles.spinner} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
