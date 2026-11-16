import { render, screen } from '@testing-library/react';
import { ChangeBadge } from './ChangeBadge';

const plain = (text: string | null) => (text ?? '').replace(/\u00a0/g, ' ');

describe('ChangeBadge', () => {
  it('shows a rise with a plus sign, the up style and a text description', () => {
    const { container } = render(<ChangeBadge value={12.5} />);
    const badge = container.firstElementChild!;
    expect(plain(badge.textContent)).toBe('Subió+12,5 %');
    expect(badge).toHaveAttribute('data-trend', 'up');
    expect(badge).toHaveClass('up');
    expect(badge.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('shows a fall with the down style', () => {
    const { container } = render(<ChangeBadge value={-10.4} />);
    const badge = container.firstElementChild!;
    expect(plain(badge.textContent)).toBe('Bajó\u221210,4 %');
    expect(badge).toHaveAttribute('data-trend', 'down');
    expect(badge).toHaveClass('down');
  });

  it('treats a change that rounds to zero as neutral', () => {
    const { container } = render(<ChangeBadge value={0.02} />);
    const badge = container.firstElementChild!;
    expect(plain(badge.textContent)).toBe('Sin cambio0,0 %');
    expect(badge).toHaveClass('flat');
  });

  it('says there is no data when the change is unknown', () => {
    render(<ChangeBadge value={null} />);
    expect(screen.getByText('Sin dato')).toBeInTheDocument();
  });
});
