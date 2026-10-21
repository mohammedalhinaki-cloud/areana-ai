import { describe, expect, it } from 'vitest';
import {
  calculateMatrix,
  calculateStatistics,
  evaluateExpression,
  permutations,
  combinations,
} from '../calculatorService';

describe('scientific calculator', () => {
  it('evaluates PEMDAS using mathjs', () => {
    expect(evaluateExpression('2+3*4')).toBe(14);
  });

  it('converts degrees for trigonometric functions', () => {
    expect(Number(evaluateExpression('sin(30)', 'DEG'))).toBeCloseTo(0.5, 12);
  });

  it('evaluates factorial and rejects complex output in COMP mode', () => {
    expect(evaluateExpression('5!')).toBe(120);
    expect(() => evaluateExpression('sqrt(-1)', 'DEG', 'COMP')).toThrow('وضع CMPLX');
    expect(String(evaluateExpression('sqrt(-1)', 'DEG', 'CMPLX'))).toContain('i');
  });

  it('computes determinant, statistics, permutations, and combinations', () => {
    expect(calculateMatrix('det', [[1, 2], [3, 4]])).toBe(-2);
    const statistics = calculateStatistics([1, 2, 2, 5]);
    expect(statistics.mean).toBe(2.5);
    expect(statistics.median).toBe(2);
    expect(statistics.modes).toEqual([2]);
    expect(permutations(5, 2)).toBe(20);
    expect(combinations(5, 2)).toBe(10);
  });
});
