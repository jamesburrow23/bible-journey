import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs tests with DOM + localStorage available', () => {
    localStorage.setItem('x', '1');
    expect(localStorage.getItem('x')).toBe('1');
  });
});
