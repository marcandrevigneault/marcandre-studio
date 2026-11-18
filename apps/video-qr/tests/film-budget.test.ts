import { describe, expect, it } from 'vitest';
import { estimateBytes, fitEstimate, nextSmaller, VIDEO_BUDGET, type FilmSettings } from '../src/film-budget';
describe('single QR fitting', () => {
  it('adjusts competing sliders within estimated capacity', () => {
    for (const key of ['duration', 'width', 'fps', 'audioKbps'] as const) {
      const fit = fitEstimate({ duration: 6, width: 96, fps: 8, audioKbps: 8 }, key);
      expect(estimateBytes(fit)).toBeLessThanOrEqual(VIDEO_BUDGET * .9);
      expect(fit.width % 2).toBe(0);
    }
  });
  it('leaves fitting settings unchanged', () => {
    const small = {duration: 1,width: 24,fps: 2,audioKbps: 4};
    expect(fitEstimate(small, 'width')).toEqual(small);
  });
  it('reduces monotonically and terminates within the retry limit', () => {
    let s: FilmSettings | null = {duration: 6,width:96,fps:8,audioKbps:8};
    let count = 0;
    while (s) { const next = nextSmaller(s); if(next) expect(estimateBytes(next)).toBeLessThan(estimateBytes(s)); s = next; count++; }
    expect(count).toBeLessThanOrEqual(20);
  });
});

it('retains image and sound choices through fitting', () => {
  const requested = {duration:6,width:96,fps:8,audioKbps:8,colorMode:'grayscale' as const,colorLevels:4 as const,volume:.5,saturation:1.8};
  for (const result of [fitEstimate(requested, 'colorLevels'), nextSmaller(requested)]) {
    expect(result).toMatchObject({colorMode:'grayscale',colorLevels:4,volume:.5,saturation:1.8});
  }
  expect(estimateBytes({...requested,volume:0})).toBeLessThan(estimateBytes(requested));
});
