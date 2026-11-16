import { useHealth } from '../../api/hooks';
import { formatWeekRange } from '../../lib/format';
import styles from './Footer.module.css';

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
    </footer>
  );
}
