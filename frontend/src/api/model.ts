import { apiGet } from './client';
import type { ModelSummary } from './types';

export function getModelSummary(): Promise<ModelSummary> {
  return apiGet<ModelSummary>('/api/model/summary');
}
