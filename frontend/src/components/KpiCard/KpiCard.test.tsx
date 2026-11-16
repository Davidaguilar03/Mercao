import { render, screen } from '@testing-library/react';
import { plain } from '../../test/utils';
import { RangeBar } from '../RangeBar/RangeBar';
import { KpiCard, KpiChangeCard, KpiGrid } from './KpiCard';

const explanations = {
  up: 'Más caro que hace 4 semanas',
  down: 'Más barato que hace 4 semanas',
  flat: 'Igual que hace 4 semanas',
};

describe('KpiCard', () => {
  it('shows a label, a large figure and a secondary line', () => {
    render(
      <KpiGrid label="Cifras clave">
        <KpiCard label="Último precio" value="$ 3.063">
          Semana del 9 al 15 de noviembre de 2026
        </KpiCard>
      </KpiGrid>,
    );

    const group = screen.getByRole('group', { name: 'Cifras clave' });
    expect(group).toHaveTextContent('Último precio$ 3.063Semana del 9 al 15 de noviembre de 2026');
    expect(screen.getByText('$ 3.063')).toHaveClass('value', 'neutral');
    // Longer explanations stay under the figure unless the group asks for the inline layout.
    expect(group).toHaveClass('stacked');
  });

  it('can place the explanation beside the figure', () => {
    render(
      <KpiGrid label="Cifras clave" layout="inline">
        <KpiCard label="Último precio" value="$ 3.063" title="Detalle">
          Semana del 9 al 15 de noviembre de 2026
        </KpiCard>
      </KpiGrid>,
    );

    const group = screen.getByRole('group', { name: 'Cifras clave' });
    expect(group).toHaveClass('inline');
    // Figure and explanation share one block, so they can sit side by side.
    const body = screen.getByText('$ 3.063').parentElement!;
    expect(body).toHaveClass('body');
    expect(body).toHaveTextContent('Semana del 9 al 15 de noviembre de 2026');
    expect(group.firstElementChild).toHaveAttribute('title', 'Detalle');
  });
});

describe('KpiChangeCard', () => {
  it('shows a rise as large as a price, with arrow, color, words and the reference', () => {
    render(
      <KpiChangeCard
        label="Frente a hace 4 semanas"
        value={4.8}
        explanations={explanations}
        missing="Sin precio para comparar."
      >
        Estaba en $ 2.923 /kg
      </KpiChangeCard>,
    );

    const figure = screen.getByText(/4,8/).closest('.value')!;
    // Same class, and so the same size, as the price figures.
    expect(figure).toHaveClass('value', 'up');
    expect(plain(figure.textContent)).toBe('Subió+4,8 %');
    expect(figure.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText(/Más caro que hace 4 semanas/)).toBeInTheDocument();
    expect(screen.getByText('Estaba en $ 2.923 /kg')).toBeInTheDocument();
  });

  it('shows a fall in the down color with its own explanation', () => {
    render(
      <KpiChangeCard label="x" value={-10.4} explanations={explanations} missing="Sin precio." />,
    );

    const figure = screen.getByText(/10,4/).closest('.value')!;
    expect(figure).toHaveClass('down');
    expect(plain(figure.textContent)).toBe('Bajó−10,4 %');
    expect(screen.getByText('Más barato que hace 4 semanas')).toBeInTheDocument();
  });

  it('treats a change that rounds to zero as no change', () => {
    render(
      <KpiChangeCard label="x" value={0.03} explanations={explanations} missing="Sin precio." />,
    );

    expect(screen.getByText(/0,0/).closest('.value')).toHaveClass('flat');
    expect(screen.getByText('Igual que hace 4 semanas')).toBeInTheDocument();
  });

  it('explains when there is nothing to compare with', () => {
    render(
      <KpiChangeCard
        label="Frente a hace un año"
        value={null}
        explanations={explanations}
        missing="No hay precio de hace un año para comparar."
      />,
    );

    expect(screen.getByText('Sin dato')).toHaveClass('value', 'neutral');
    expect(screen.getByText('No hay precio de hace un año para comparar.')).toBeInTheDocument();
  });
});

describe('RangeBar', () => {
  it('describes the range in words and places the expected price inside it', () => {
    const { container } = render(<RangeBar lower={2000} upper={4000} value={2500} />);

    const bar = screen.getByRole('img');
    expect(plain(bar.getAttribute('aria-label'))).toBe('Rango probable: de $ 2.000 a $ 4.000');
    expect(container.querySelector('.dot')).toHaveStyle({ left: '25%' });
  });

  it('keeps the marker inside the bar when the price is outside the range', () => {
    const { container } = render(<RangeBar lower={2000} upper={4000} value={5000} />);

    expect(container.querySelector('.dot')).toHaveStyle({ left: '100%' });
  });
});
