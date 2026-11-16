import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ErrorState } from '../states/ErrorState';
import { LoadingState } from '../states/LoadingState';

interface QueryBoundaryProps<T> {
  query: UseQueryResult<T>;
  loadingMessage?: string;
  children: (data: T) => ReactNode;
}

/** Shows the loading and error states of a query and renders the children once there is data. */
export function QueryBoundary<T>({ query, loadingMessage, children }: QueryBoundaryProps<T>) {
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />;
  }
  if (query.data === undefined) {
    return <LoadingState message={loadingMessage} />;
  }
  return <>{children(query.data)}</>;
}
