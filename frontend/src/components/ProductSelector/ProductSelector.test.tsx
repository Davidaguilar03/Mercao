import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { products } from '../../test/fixtures';
import { mockApi, renderWithProviders } from '../../test/utils';
import { ProductSelector } from './ProductSelector';

async function renderSelector(value: number | null = null) {
  mockApi({ '/api/products': products });
  const onChange = vi.fn();
  renderWithProviders(<ProductSelector value={value} onChange={onChange} />);
  const input = await screen.findByRole('combobox', { name: 'Producto' });
  await vi.waitFor(() => expect(input).toBeEnabled());
  return { input, onChange, user: userEvent.setup() };
}

describe('ProductSelector', () => {
  it('lists the products grouped by family and shows the variety', async () => {
    const { input, user } = await renderSelector();
    await user.click(input);

    expect(screen.getAllByRole('option')).toHaveLength(products.length);
    const onions = screen.getByRole('group', { name: 'Cebolla' });
    expect(within(onions).getAllByRole('option')).toHaveLength(2);
    expect(within(onions).getByText('Variedad: cabezona blanca')).toBeInTheDocument();
    // The family label keeps the accent of the product name even though the API key has none.
    expect(screen.getByRole('group', { name: 'Plátano' })).toBeInTheDocument();
    // A product without variety shows no variety line.
    const carrot = screen.getByRole('option', { name: 'Zanahoria' });
    expect(within(carrot).queryByText(/Variedad/)).not.toBeInTheDocument();
  });

  it('filters while typing, ignoring accents and case', async () => {
    const { input, user } = await renderSelector();
    await user.type(input, 'PLATANO');

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Plátano hartón verde');
  });

  it('says so when nothing matches', async () => {
    const { input, user } = await renderSelector();
    await user.type(input, 'yuca');

    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('Ningún producto coincide con «yuca».')).toBeInTheDocument();
  });

  it('selects with a click', async () => {
    const { input, onChange, user } = await renderSelector();
    await user.click(input);
    await user.click(screen.getByRole('option', { name: /Cebolla junca/ }));

    expect(onChange).toHaveBeenCalledWith(3);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('selects with the keyboard', async () => {
    const { input, onChange, user } = await renderSelector();
    await user.type(input, 'cebolla{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('shows the selected product and marks it in the list', async () => {
    const { input, user } = await renderSelector(1);
    expect(input).toHaveValue('Papa parda pastusa');

    await user.click(input);
    expect(screen.getByRole('option', { name: /Papa parda pastusa/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('explains the failure and offers a retry when the products cannot be loaded', async () => {
    mockApi({});
    renderWithProviders(<ProductSelector value={null} onChange={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los productos.');
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
