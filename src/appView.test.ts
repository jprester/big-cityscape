import { describe, expect, it } from 'vitest';
import { resolveAppView } from './appView';

describe('resolveAppView', () => {
  it('opens the full synthetic city by default', () => {
    expect(resolveAppView('')).toBe('synthetic');
    expect(resolveAppView('?seed=20260805')).toBe('synthetic');
  });

  it('preserves explicit inspection routes', () => {
    expect(resolveAppView('?view=assets')).toBe('assets');
    expect(resolveAppView('?view=legacy')).toBe('legacy');
  });

  it('falls back to the product view for obsolete or unknown view values', () => {
    expect(resolveAppView('?view=unknown')).toBe('synthetic');
    expect(resolveAppView('?view=synthetic')).toBe('synthetic');
  });
});
