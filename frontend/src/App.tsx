import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { HowItWorksPage } from './pages/HowItWorksPage/HowItWorksPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OpportunitiesPage } from './pages/OpportunitiesPage';
import { PanoramaPage } from './pages/PanoramaPage';
import { ProductPage } from './pages/ProductPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<PanoramaPage />} />
        <Route path="producto" element={<ProductPage />} />
        <Route path="oportunidades" element={<OpportunitiesPage />} />
        <Route path="como-funciona" element={<HowItWorksPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
