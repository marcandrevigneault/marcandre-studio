import { describe, expect, it } from 'vitest';
import { resolveLanguage, translate, translateError } from '../src/i18n';

describe('language selection', () => {
  it('defaults to French and accepts only exact fr/en preferences', () => {
    expect(resolveLanguage('', null)).toBe('fr');
    expect(resolveLanguage('?lang=de', 'en')).toBe('en');
    expect(resolveLanguage('?lang=EN', 'invalid')).toBe('fr');
  });
  it('lets an explicit query override the shared site preference', () => {
    expect(resolveLanguage('?lang=fr', 'en')).toBe('fr');
    expect(resolveLanguage('?lang=en', 'fr')).toBe('en');
    expect(resolveLanguage('', 'en')).toBe('en');
  });
});
describe('runtime translations', () => {
  it('interpolates progress and retains English', () => {
    expect(translate('fr', '{received} of {total} frames collected.', { received: 2, total: 3 })).toBe('2 images sur 3 recueillies.');
    expect(translate('en', '{received} of {total} frames collected.', { received: 2, total: 3 })).toBe('2 of 3 frames collected.');
  });
  it('translates core errors and preserves unknown technical details with a French prefix', () => {
    expect(translateError('fr', new Error('Invalid packet size.'))).toBe('Taille de paquet invalide.');
    expect(translateError('fr', new Error('WASM trap'))).toBe('Erreur technique : WASM trap');
    expect(translateError('en', new Error('WASM trap'))).toBe('WASM trap');
  });
});
