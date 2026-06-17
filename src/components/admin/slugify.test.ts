import { describe, it, expect } from 'vitest';
import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('A Morning in the Alps')).toBe('a-morning-in-the-alps');
  });
  it('strips accents and punctuation', () => {
    expect(slugify('Café & Lumière!')).toBe('cafe-lumiere');
  });
  it('collapses repeated separators', () => {
    expect(slugify('  hello   world  ')).toBe('hello-world');
  });
});
