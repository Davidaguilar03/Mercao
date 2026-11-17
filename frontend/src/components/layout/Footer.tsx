import { useHealth } from '../../api/hooks';
import logo from '../../assets/brand/logo.png';
import { formatWeekRange } from '../../lib/format';
import { MarketScene } from '../illustrations/MarketDoodles';
import styles from './Footer.module.css';

const AUTHORS = [
  'David Aguilar Castillo',
  'Valeria Tocarruncho Mosquera',
  'Andrés Santiago Daza Quintana',
  'Oscar Alejandro Roa Doncel',
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
