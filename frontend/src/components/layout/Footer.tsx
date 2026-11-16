import { useHealth } from '../../api/hooks';
import logo from '../../assets/brand/logo.png';
import { formatWeekRange } from '../../lib/format';
import { MarketScene } from '../illustrations/MarketDoodles';
import styles from './Footer.module.css';

const REPOSITORY_URL = 'https://github.com/Davidaguilar03/Mercao';

const AUTHORS = [
  'David Aguilar Castillo',
  'Valeria Tocarruncho Mosquera',
  'Andrés Santiago Daza Quintana',
];

function LatestWeek() {
  const { data, isPending, isError } = useHealth();
  if (isPending) return <>Consultando la última semana con datos…</>;
  if (isError) return <>No pudimos consultar la última semana con datos.</>;
  if (!data.latest_week) return <>Todavía no hay boletines de precios cargados.</>;
  const { iso_week, iso_year, week_start, week_end } = data.latest_week;
  return (
    <>
      Datos hasta la semana {iso_week} de {iso_year} ({formatWeekRange(week_start, week_end)}).
    </>
  );
}

/** The GitHub mark. The icon library does not include brand logos. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" width={18} height={18} fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.about}>
          <div className={styles.brand}>
            {/* The logo needs a light surface under it; it is not shown directly on green. */}
            <span className={styles.logoChip}>
              <img src={logo} alt="" width={36} height={39} />
            </span>
            <span className={styles.brandText}>
              <span className={styles.wordmark}>Mercao</span>
              <span className={styles.tagline}>Precios de plaza, claros.</span>
            </span>
          </div>
          <p>
            Mercao convierte los boletines de precios mayoristas del DANE en comparaciones entre
            plazas, la historia de cada producto y pronósticos a cuatro semanas.
          </p>
          <a className={styles.repository} href={REPOSITORY_URL} target="_blank" rel="noreferrer">
            <GitHubMark />
            Ver el código en GitHub
          </a>
        </div>

        <div className={styles.block}>
          <h2 className={styles.heading}>Datos</h2>
          <p>
            <strong>Fuente:</strong> Sistema de Información de Precios y Abastecimiento del Sector
            Agropecuario (SIPSA), DANE.
          </p>
          <p className="tabular">
            <LatestWeek />
          </p>
          <p className={styles.note}>
            Los pronósticos son estimaciones a partir de precios pasados, no precios garantizados.
          </p>
        </div>

        <div className={styles.block}>
          <h2 className={styles.heading}>Autores</h2>
          <ul className={styles.authors}>
            {AUTHORS.map((author) => (
              <li key={author}>{author}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className={styles.bottom}>
        <div className={styles.bottomContent}>
          <p>
            Proyecto de Inteligencia Computacional, Universidad Pedagógica y Tecnológica de Colombia
          </p>
          <MarketScene className={styles.scene} />
        </div>
      </div>
    </footer>
  );
}
