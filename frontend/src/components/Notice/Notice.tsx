import { Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface NoticeProps {
  /** Line icon at the left; the information sign by default. */
  icon?: LucideIcon;
  /** Accent of the left edge: corn yellow for informative notes, brand green or gray otherwise. */
  tone?: 'info' | 'brand' | 'neutral';
  /** Short heading of the notice. */
  title?: ReactNode;
  /** "compact" uses smaller text and tighter padding, for notes inside a card. */
  size?: 'regular' | 'compact';
  role?: 'note' | 'status';
  className?: string;
  children: ReactNode;
}

/** The one style of every notice: light surface, thin border, slim accent and a line icon. */
export function Notice({
  icon: Icon = Info,
  tone = 'info',
  title,
  size = 'regular',
  role,
  className,
  children,
}: NoticeProps) {
  return (
    <div
      className={[styles.notice, styles[tone], styles[size], className].filter(Boolean).join(' ')}
      role={role}
    >
      <Icon className={styles.icon} size={18} strokeWidth={1.75} aria-hidden="true" />
      <div className={styles.body}>
        {title && <div className={styles.title}>{title}</div>}
        {children}
      </div>
    </div>
  );
}
