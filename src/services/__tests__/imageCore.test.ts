import { describe, expect, it } from 'vitest';
import { clampCrop, fitDimensions, normalizeRotation } from '../imageCore';

describe('image processing helpers', () => {
  it('keeps the aspect ratio when fitting resized dimensions', () => {
    expect(fitDimensions(1200, 800, 600, 600, true)).toEqual({ width: 600, height: 400 });
    expect(fitDimensions(1200, 800, 600, 300, false)).toEqual({ width: 600, height: 300 });
  });

  it('clamps crop coordinates and dimensions to the source image', () => {
    expect(clampCrop({ x: -5, y: 40, width: 1000, height: 1000 }, 320, 200)).toEqual({ x: 0, y: 40, width: 320, height: 160 });
  });

  it('normalizes rotation to quarter turns', () => {
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(-90)).toBe(270);
  });
});
