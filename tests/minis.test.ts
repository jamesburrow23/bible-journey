import { describe, it, expect } from 'vitest';
import { buildMini, SITE_TYPES, MINI_SIZE } from '../src/services/minis';

describe('miniature models', () => {
  it('builds a non-empty group for every site type, each with a defined size', () => {
    for (const t of SITE_TYPES) {
      const g = buildMini(t);
      expect(g.children.length, t).toBeGreaterThan(0);
      expect(MINI_SIZE[t]).toBeGreaterThan(0);
    }
  });
  it('distinct types produce distinct models', () => {
    expect(buildMini('city').children.length).not.toBe(buildMini('mountain').children.length);
  });
});
