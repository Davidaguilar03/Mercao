import { Link } from 'react-router-dom';
import { EmptyState } from '../components/states/EmptyState';

export function NotFoundPage() {
  return (
    <>
      <title>Página no encontrada | Mercao</title>
      <h1 className="visually-hidden">Página no encontrada</h1>
      <EmptyState title="No encontramos esta página">
        <p>Puede que la dirección esté mal escrita o que la página ya no exista.</p>
        <p>
          <Link to="/">Volver al panorama de precios</Link>
        </p>
      </EmptyState>
    </>
  );
}
