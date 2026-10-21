import {
  create,
  addDependencies,
  acosDependencies,
  asinDependencies,
  atanDependencies,
  complexDependencies,
  cosDependencies,
  detDependencies,
  divideDependencies,
  eDependencies,
  evaluateDependencies,
  factorialDependencies,
  formatDependencies,
  iDependencies,
  invDependencies,
  log10Dependencies,
  logDependencies,
  matrixDependencies,
  modDependencies,
  multiplyDependencies,
  piDependencies,
  powDependencies,
  sinDependencies,
  sqrtDependencies,
  subtractDependencies,
  tanDependencies,
  transposeDependencies,
  typeOfDependencies,
  unaryMinusDependencies,
  unaryPlusDependencies,
  type Complex,
  type MathType,
} from 'mathjs';

const math = create({
  addDependencies: addDependencies!,
  acosDependencies: acosDependencies!,
  asinDependencies: asinDependencies!,
  atanDependencies: atanDependencies!,
  complexDependencies: complexDependencies!,
  cosDependencies: cosDependencies!,
  detDependencies: detDependencies!,
  divideDependencies: divideDependencies!,
  eDependencies: eDependencies!,
  evaluateDependencies: evaluateDependencies!,
  factorialDependencies: factorialDependencies!,
  formatDependencies: formatDependencies!,
  iDependencies: iDependencies!,
  invDependencies: invDependencies!,
  log10Dependencies: log10Dependencies!,
  logDependencies: logDependencies!,
  matrixDependencies: matrixDependencies!,
  modDependencies: modDependencies!,
  multiplyDependencies: multiplyDependencies!,
  piDependencies: piDependencies!,
  powDependencies: powDependencies!,
  sinDependencies: sinDependencies!,
  sqrtDependencies: sqrtDependencies!,
  subtractDependencies: subtractDependencies!,
  tanDependencies: tanDependencies!,
  transposeDependencies: transposeDependencies!,
  typeOfDependencies: typeOfDependencies!,
  unaryMinusDependencies: unaryMinusDependencies!,
  unaryPlusDependencies: unaryPlusDependencies!,
}, {});

export type AngleMode = 'DEG' | 'RAD';
export type CalculatorMode = 'COMP' | 'CMPLX';
export type StatisticsResult = {
  count: number;
  mean: number;
  median: number;
  modes: number[];
  range: number;
  populationVariance: number;
  sampleVariance: number | null;
  populationStdDev: number;
  sampleStdDev: number | null;
};
export type MatrixOperation = 'add' | 'multiply' | 'det' | 'inverse' | 'transpose';

function isComplex(value: unknown): value is Complex {
  return math.typeOf(value) === 'Complex';
}

function degreeScopes(angleMode: AngleMode): Record<string, (value: MathType) => MathType> {
  const toRadians = (value: MathType) => angleMode === 'DEG' ? math.multiply(value, Math.PI / 180) as MathType : value;
  const toDegrees = (value: MathType) => angleMode === 'DEG' ? math.multiply(value, 180 / Math.PI) as MathType : value;
  return {
    sin: (value) => math.sin(toRadians(value) as never) as MathType,
    cos: (value) => math.cos(toRadians(value) as never) as MathType,
    tan: (value) => math.tan(toRadians(value) as never) as MathType,
    asin: (value) => toDegrees(math.asin(value as never) as MathType),
    acos: (value) => toDegrees(math.acos(value as never) as MathType),
    atan: (value) => toDegrees(math.atan(value as never) as MathType),
  };
}

export function evaluateExpression(expression: string, angleMode: AngleMode = 'DEG', calculatorMode: CalculatorMode = 'COMP'): unknown {
  const normalized = expression
    .replace(/π/g, 'pi')
    .replace(/[×·]/g, '*')
    .replace(/[÷]/g, '/')
    .replace(/[−–]/g, '-')
    .trim();
  if (!normalized) throw new Error('أدخل عملية حسابية أولًا.');
  if (normalized.length > 500) throw new Error('العملية أطول من الحد المسموح.');
  if (/[;{}]/u.test(normalized)) throw new Error('تحتوي العملية على رموز غير مسموح بها.');

  const result = math.evaluate(normalized, degreeScopes(angleMode));
  if (isComplex(result)) {
    if (calculatorMode === 'COMP' && Math.abs(result.im) > 1e-12) {
      throw new Error('النتيجة مركبة. بدّل إلى وضع CMPLX لاستخدام i.');
    }
    if (Math.abs(result.im) <= 1e-12) return result.re;
  }
  return result;
}

export function formatCalculatorResult(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return new Intl.NumberFormat('en-US', { maximumSignificantDigits: 13, useGrouping: false }).format(value);
  }
  if (isComplex(value)) {
    const real = formatCalculatorResult(value.re);
    const imaginary = Math.abs(value.im) === 1 ? '' : formatCalculatorResult(Math.abs(value.im));
    if (Math.abs(value.re) < 1e-13) return `${value.im < 0 ? '-' : ''}${imaginary}i`;
    return `${real}${value.im < 0 ? ' − ' : ' + '}${imaginary}i`;
  }
  try {
    return math.format(value as never, { precision: 13, lowerExp: -12, upperExp: 15 });
  } catch {
    return String(value);
  }
}

export function approximateFraction(value: number, tolerance = 1e-10, maxDenominator = 1000): { numerator: number; denominator: number } | null {
  if (!Number.isFinite(value) || Number.isInteger(value)) return null;
  const sign = value < 0 ? -1 : 1;
  let target = Math.abs(value);
  let previousNumerator = 0;
  let numerator = 1;
  let previousDenominator = 1;
  let denominator = 0;
  for (let iteration = 0; iteration < 32; iteration += 1) {
    const whole = Math.floor(target);
    const nextNumerator = whole * numerator + previousNumerator;
    const nextDenominator = whole * denominator + previousDenominator;
    if (nextDenominator > maxDenominator) break;
    previousNumerator = numerator;
    numerator = nextNumerator;
    previousDenominator = denominator;
    denominator = nextDenominator;
    if (Math.abs(sign * numerator / denominator - value) <= tolerance) {
      return denominator === 1 ? null : { numerator: sign * numerator, denominator };
    }
    const fractionalPart = target - whole;
    if (fractionalPart === 0) break;
    target = 1 / fractionalPart;
  }
  return null;
}

export function calculateStatistics(values: number[]): StatisticsResult {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) throw new Error('أدخل قائمة أرقام صالحة.');
  if (values.length > 10000) throw new Error('يمكن تحليل 10,000 قيمة كحد أقصى.');
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const mean = sorted.reduce((sum, value) => sum + value, 0) / count;
  const middle = Math.floor(count / 2);
  const median = count % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  const frequencies = new Map<number, number>();
  sorted.forEach((value) => frequencies.set(value, (frequencies.get(value) ?? 0) + 1));
  const highestFrequency = Math.max(...frequencies.values());
  const modes = highestFrequency <= 1 ? [] : [...frequencies.entries()].filter(([, frequency]) => frequency === highestFrequency).map(([value]) => value);
  const squaredDifferences = sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const populationVariance = squaredDifferences / count;
  const sampleVariance = count > 1 ? squaredDifferences / (count - 1) : null;
  return {
    count,
    mean,
    median,
    modes,
    range: sorted[count - 1]! - sorted[0]!,
    populationVariance,
    sampleVariance,
    populationStdDev: Math.sqrt(populationVariance),
    sampleStdDev: sampleVariance === null ? null : Math.sqrt(sampleVariance),
  };
}

function factorial(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 170) throw new Error('استخدم عددًا صحيحًا بين 0 و170.');
  let result = 1;
  for (let factor = 2; factor <= value; factor += 1) result *= factor;
  return result;
}

export function permutations(n: number, r: number): number {
  if (!Number.isInteger(r) || r < 0 || r > n) throw new Error('يجب أن يكون r عددًا صحيحًا بين 0 وn.');
  return factorial(n) / factorial(n - r);
}

export function combinations(n: number, r: number): number {
  if (!Number.isInteger(r) || r < 0 || r > n) throw new Error('يجب أن يكون r عددًا صحيحًا بين 0 وn.');
  return factorial(n) / (factorial(r) * factorial(n - r));
}

function validateMatrix(matrix: number[][]): number[][] {
  const size = matrix.length;
  if (size < 1 || size > 3 || matrix.some((row) => row.length !== size)) throw new Error('المصفوفة يجب أن تكون مربعة من 1×1 إلى 3×3.');
  if (matrix.some((row) => row.some((value) => !Number.isFinite(value)))) throw new Error('أدخل أرقامًا صالحة في جميع خلايا المصفوفة.');
  return matrix;
}

export function calculateMatrix(operation: MatrixOperation, matrixA: number[][], matrixB?: number[][]): number | number[][] {
  const a = validateMatrix(matrixA);
  const mathA = math.matrix(a);
  if (operation === 'det') return Number(math.det(mathA));
  if (operation === 'inverse') return math.inv(mathA).toArray() as number[][];
  if (operation === 'transpose') return math.transpose(mathA).toArray() as number[][];
  if (!matrixB) throw new Error('أدخل المصفوفة B لإجراء هذه العملية.');
  const b = validateMatrix(matrixB);
  if (b.length !== a.length) throw new Error('يجب أن يكون حجم المصفوفتين متساويًا.');
  return (operation === 'add' ? math.add(mathA, math.matrix(b)) : math.multiply(mathA, math.matrix(b))).toArray() as number[][];
}
