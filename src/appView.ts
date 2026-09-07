export type AppView = 'assets' | 'legacy' | 'synthetic' | 'reviewed';

/**
 * The synthetic city is the product view. The geodata implementation remains
 * available only as an explicit legacy inspection route.
 */
export function resolveAppView(search: string): AppView {
  const requestedView = new URLSearchParams(search).get('view');

  if (requestedView === 'assets' || requestedView === 'legacy' || requestedView === 'reviewed') {
    return requestedView;
  }

  return 'synthetic';
}
