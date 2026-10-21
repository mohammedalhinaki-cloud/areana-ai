import { useMemo, useState, type FormEvent } from 'react';
import { Calculator, Copy, Delete, History, RotateCcw, Sparkles } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';
import { copyTextToClipboard } from '../services/fileUtils';
import {
  approximateFraction,
  calculateMatrix,
  calculateStatistics,
  combinations,
  evaluateExpression,
  formatCalculatorResult,
  permutations,
  type AngleMode,
  type CalculatorMode,
  type MatrixOperation,
  type StatisticsResult,
} from '../services/calculatorService';

type Panel = 'calculate' | 'stat' | 'matrix';
type HistoryEntry = { expression: string; result: string };
const KEYS: { label: string; value?: string; action?: 'clear' | 'delete' | 'equals'; type?: 'function' | 'operator' | 'number' | 'utility' }[] = [
  { label: 'sin', value: 'sin(', type: 'function' }, { label: 'cos', value: 'cos(', type: 'function' }, { label: 'tan', value: 'tan(', type: 'function' }, { label: '√', value: 'sqrt(', type: 'function' },
  { label: 'ln', value: 'log(', type: 'function' }, { label: 'log₁₀', value: 'log10(', type: 'function' }, { label: 'xʸ', value: '^', type: 'function' }, { label: 'x!', value: '!', type: 'function' },
  { label: '(', value: '(', type: 'utility' }, { label: ')', value: ')', type: 'utility' }, { label: 'π', value: 'pi', type: 'function' }, { label: 'i', value: 'i', type: 'function' },
  { label: '7', value: '7', type: 'number' }, { label: '8', value: '8', type: 'number' }, { label: '9', value: '9', type: 'number' }, { label: '÷', value: '/', type: 'operator' },
  { label: '4', value: '4', type: 'number' }, { label: '5', value: '5', type: 'number' }, { label: '6', value: '6', type: 'number' }, { label: '×', value: '*', type: 'operator' },
  { label: '1', value: '1', type: 'number' }, { label: '2', value: '2', type: 'number' }, { label: '3', value: '3', type: 'number' }, { label: '−', value: '-', type: 'operator' },
  { label: 'AC', action: 'clear', type: 'utility' }, { label: '0', value: '0', type: 'number' }, { label: '.', value: '.', type: 'number' }, { label: '+', value: '+', type: 'operator' },
];
const MATRIX_OPERATIONS: { id: MatrixOperation; label: string }[] = [
  { id: 'add', label: 'A + B' }, { id: 'multiply', label: 'A × B' }, { id: 'det', label: 'det(A)' }, { id: 'inverse', label: 'A⁻¹' }, { id: 'transpose', label: 'Aᵀ' },
];

function parseStatValues(input: string): number[] {
  const tokens = input.trim().split(/[،,;\s]+/u).filter(Boolean);
  if (tokens.length === 0) throw new Error('أدخل مجموعة أرقام مفصولة بفواصل أو مسافات.');
  const values = tokens.map(Number);
  if (values.some((value) => !Number.isFinite(value))) throw new Error('تحتوي القائمة على قيمة غير رقمية.');
  return values;
}

function makeMatrix(size: number): string[][] {
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => row === column ? '1' : '0'));
}

function parseMatrix(input: string[][]): number[][] {
  return input.map((row) => row.map((cell) => {
    if (!cell.trim()) throw new Error('أكمل جميع خلايا المصفوفة.');
    const value = Number(cell);
    if (!Number.isFinite(value)) throw new Error('أدخل أرقامًا صالحة في المصفوفة.');
    return value;
  }));
}

function formatStat(value: number | null) {
  return value === null ? 'غير متاح' : formatCalculatorResult(value);
}

export default function CalculatorTool() {
  const [panel, setPanel] = useState<Panel>('calculate');
  const [mode, setMode] = useState<CalculatorMode>('COMP');
  const [angle, setAngle] = useState<AngleMode>('DEG');
  const [skin, setSkin] = useState<'first' | 'second'>('first');
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<unknown>(null);
  const [resultText, setResultText] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [statValues, setStatValues] = useState('');
  const [statResult, setStatResult] = useState<StatisticsResult | null>(null);
  const [sampleDeviation, setSampleDeviation] = useState(false);
  const [permutationN, setPermutationN] = useState('5');
  const [permutationR, setPermutationR] = useState('2');
  const [permutationResult, setPermutationResult] = useState<{ npr: number; ncr: number } | null>(null);
  const [matrixSize, setMatrixSize] = useState(2);
  const [matrixA, setMatrixA] = useState<string[][]>(() => makeMatrix(2));
  const [matrixB, setMatrixB] = useState<string[][]>(() => makeMatrix(2));
  const [matrixResult, setMatrixResult] = useState<number | number[][] | null>(null);
  const [matrixError, setMatrixError] = useState('');
  const { notify } = useToast();

  const fraction = useMemo(() => typeof result === 'number' ? approximateFraction(result) : null, [result]);

  const calculate = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    try {
      const value = evaluateExpression(expression, angle, mode);
      const formatted = formatCalculatorResult(value);
      setResult(value);
      setResultText(formatted);
      setError('');
      setHistory((current) => [{ expression, result: formatted }, ...current].slice(0, 30));
      notify('تم حساب النتيجة.', 'success');
    } catch (calculationError) {
      const message = calculationError instanceof Error ? calculationError.message : 'تعذّر حساب العملية.';
      setError(message);
      setResult(null);
      setResultText('');
      notify(message, 'error');
    }
  };

  const appendKey = (value: string) => {
    setExpression((current) => `${current}${value}`);
    setError('');
  };

  const handleKey = (key: (typeof KEYS)[number]) => {
    if (key.action === 'clear') {
      setExpression(''); setResult(null); setResultText(''); setError('');
    } else if (key.action === 'delete') {
      setExpression((current) => current.slice(0, -1)); setError('');
    } else if (key.action === 'equals') {
      calculate();
    } else if (key.value) {
      appendKey(key.value);
    }
  };

  const copyResult = async () => {
    if (!resultText) return;
    try {
      const copied = await copyTextToClipboard(resultText);
      if (copied) notify('تم نسخ النتيجة.', 'success');
      else notify('تعذّر نسخ النتيجة.', 'error');
    } catch {
      notify('تعذّر نسخ النتيجة. تحقق من صلاحية الحافظة.', 'error');
    }
  };

  const calculateStats = () => {
    try {
      const statistics = calculateStatistics(parseStatValues(statValues));
      setStatResult(statistics);
      setError('');
      notify('تم تحليل البيانات الإحصائية.', 'success');
    } catch (statError) {
      const message = statError instanceof Error ? statError.message : 'تعذّر تحليل البيانات.';
      setError(message);
      setStatResult(null);
      notify(message, 'error');
    }
  };

  const calculateNPrNCr = () => {
    try {
      const n = Number(permutationN);
      const r = Number(permutationR);
      setPermutationResult({ npr: permutations(n, r), ncr: combinations(n, r) });
      setError('');
    } catch (statError) {
      const message = statError instanceof Error ? statError.message : 'تحقق من قيم n وr.';
      setError(message);
      setPermutationResult(null);
    }
  };

  const resizeMatrices = (size: number) => {
    setMatrixSize(size);
    const resize = (source: string[][]) => Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => source[row]?.[column] ?? (row === column ? '1' : '0')));
    setMatrixA((current) => resize(current));
    setMatrixB((current) => resize(current));
    setMatrixResult(null);
  };

  const updateMatrix = (which: 'a' | 'b', row: number, column: number, value: string) => {
    const update = (current: string[][]) => current.map((cells, rowIndex) => rowIndex === row ? cells.map((cell, columnIndex) => columnIndex === column ? value : cell) : cells);
    if (which === 'a') setMatrixA(update);
    else setMatrixB(update);
    setMatrixResult(null);
  };

  const calculateMatrixOperation = (operation: MatrixOperation) => {
    try {
      const first = parseMatrix(matrixA);
      const second = operation === 'add' || operation === 'multiply' ? parseMatrix(matrixB) : undefined;
      const calculated = calculateMatrix(operation, first, second);
      setMatrixResult(calculated);
      setMatrixError('');
      notify('تم تنفيذ عملية المصفوفة.', 'success');
    } catch (operationError) {
      const message = operationError instanceof Error ? operationError.message : 'تعذّر حساب المصفوفة.';
      setMatrixError(message);
      setMatrixResult(null);
      notify(message, 'error');
    }
  };

  const changeSkin = () => setSkin((current) => current === 'first' ? 'second' : 'first');

  return (
    <section className={`calculator-tool calculator-skin-${skin} tool-surface`} aria-label="الحاسبة العلمية">
      <div className="calculator-header">
        <div className="tool-intro-row"><span className="large-action-icon"><Calculator size={27} aria-hidden="true" /></span><div><h2>الحاسبة العلمية</h2><p>حسابات دقيقة بمحرك mathjs، مع الإحصاء والمصفوفات.</p></div></div>
        <button type="button" className="calculator-skin-toggle" onClick={changeSkin} aria-label={`تغيير تصميم الحاسبة إلى ${skin === 'first' ? 'fx-991ES PLUS 2nd' : 'fx-991ES PLUS 1st'}`}><span className="skin-switch-icon"><RotateCcw size={15} aria-hidden="true" /></span><span><small>تبديل التصميم</small><strong>fx-991ES PLUS {skin === 'first' ? '1st' : '2nd'}</strong></span></button>
      </div>

      <div className="calculator-panel-tabs" role="tablist" aria-label="أوضاع الحاسبة">
        {([['calculate', 'COMP'], ['stat', 'STAT'], ['matrix', 'MATRIX']] as [Panel, string][]).map(([key, label]) => <button type="button" role="tab" aria-selected={panel === key} className={panel === key ? 'is-active' : ''} key={key} onClick={() => setPanel(key)}>{label}</button>)}
      </div>

      {panel === 'calculate' && <div className="calculator-body">
        <div className="calculator-display">
          <div className="calculator-status-line"><span className="calc-mode-label">{mode}</span><span className="calc-angle-label">{angle}</span><span className="calc-status-spacer" /></div>
          <form onSubmit={calculate}>
            <label className="visually-hidden" htmlFor="calculator-expression">العملية الحسابية</label>
            <input id="calculator-expression" type="text" dir="ltr" value={expression} onChange={(event) => { setExpression(event.target.value); setError(''); }} placeholder="0" autoComplete="off" spellCheck={false} />
            <div className="calculator-result-line" aria-live="polite">
              {fraction ? <><div className="stacked-fraction" aria-label={`${fraction.numerator} على ${fraction.denominator}`}><span>{fraction.numerator}</span><span>{fraction.denominator}</span></div><small className="fraction-decimal">{resultText}</small></> : <strong>{resultText || ' '}</strong>}
              {resultText && <button type="button" className="copy-result-button" onClick={() => void copyResult()} aria-label="نسخ النتيجة"><Copy size={16} /></button>}
            </div>
          </form>
          {error && <p className="calculator-error" role="alert">{error}</p>}
        </div>

        <div className="calculator-modes">
          <div className="mode-switches" aria-label="إعدادات الحاسبة">
            <div className="mode-toggle-group" role="group" aria-label="نوع الحساب"><button type="button" className={mode === 'COMP' ? 'is-selected' : ''} onClick={() => setMode('COMP')}>COMP</button><button type="button" className={mode === 'CMPLX' ? 'is-selected' : ''} onClick={() => setMode('CMPLX')}>CMPLX</button></div>
            <div className="mode-toggle-group" role="group" aria-label="وحدة الزاوية"><button type="button" className={angle === 'DEG' ? 'is-selected' : ''} onClick={() => setAngle('DEG')}>DEG</button><button type="button" className={angle === 'RAD' ? 'is-selected' : ''} onClick={() => setAngle('RAD')}>RAD</button></div>
          </div>
          <div className="calculator-keypad">
            {KEYS.map((key, index) => <button type="button" key={`${key.label}-${index}`} className={`calc-key key-${key.type ?? 'number'}${key.action === 'clear' ? ' key-clear' : ''}`} onClick={() => handleKey(key)}>{key.label}</button>)}
            <button type="button" className="calc-key key-delete" onClick={() => setExpression((current) => current.slice(0, -1))} aria-label="حذف آخر رمز"><Delete size={17} aria-hidden="true" /></button>
            <button type="button" className="calc-key key-equals" onClick={() => calculate()} aria-label="يساوي">=</button>
          </div>
        </div>
        <aside className="calculator-history" aria-label="سجل العمليات">
          <div className="history-heading"><h3><History size={16} aria-hidden="true" /> السجل</h3><button type="button" className="text-button" onClick={() => setHistory([])} disabled={history.length === 0}>مسح</button></div>
          {history.length === 0 ? <p>تظهر هنا آخر العمليات.</p> : history.map((item, index) => <button type="button" className="history-entry" key={`${item.expression}-${index}`} onClick={() => { setExpression(item.expression); setResultText(item.result); setResult(null); setError(''); }}><span dir="ltr">{item.expression}</span><strong dir="ltr">= {item.result}</strong></button>)}
        </aside>
      </div>}

      {panel === 'stat' && <section className="calculator-mode-content" aria-label="الوضع الإحصائي">
        <div className="mode-content-heading"><Sparkles size={19} aria-hidden="true" /><div><h3>إحصاءات وصفية</h3><p>أدخل قيمًا مفصولة بفواصل أو مسافات.</p></div></div>
        <label className="stat-values-label" htmlFor="stat-values">القيم<input id="stat-values" type="text" dir="ltr" placeholder="مثال: 2, 3, 3, 5, 7" value={statValues} onChange={(event) => setStatValues(event.target.value)} /></label>
        <div className="stat-actions"><button type="button" className="primary-button" onClick={calculateStats}>احسب الإحصاءات</button><label className="toggle-setting"><input type="checkbox" checked={sampleDeviation} onChange={(event) => setSampleDeviation(event.target.checked)} /><span>عرض الانحراف والتباين للعينة</span></label></div>
        {error && <p className="calculator-error" role="alert">{error}</p>}
        {statResult && <div className="stat-results-grid">
          {[['n', String(statResult.count)], ['المتوسط', formatStat(statResult.mean)], ['الوسيط', formatStat(statResult.median)], ['المنوال', statResult.modes.length ? statResult.modes.map(formatStat).join('، ') : 'لا يوجد'], ['المدى', formatStat(statResult.range)], [sampleDeviation ? 'تباين العينة' : 'تباين المجتمع', formatStat(sampleDeviation ? statResult.sampleVariance : statResult.populationVariance)], [sampleDeviation ? 'انحراف العينة' : 'انحراف المجتمع', formatStat(sampleDeviation ? statResult.sampleStdDev : statResult.populationStdDev)]].map(([label, value]) => <article key={label}><span>{label}</span><strong dir="ltr">{value}</strong></article>)}
        </div>}
        <div className="npr-ncr-panel"><h3>التباديل والتوافيق</h3><label>n<input type="number" min={0} max={170} value={permutationN} onChange={(event) => setPermutationN(event.target.value)} /></label><label>r<input type="number" min={0} max={170} value={permutationR} onChange={(event) => setPermutationR(event.target.value)} /></label><button type="button" className="secondary-button" onClick={calculateNPrNCr}>احسب nPr و nCr</button>{permutationResult && <p dir="ltr">nPr = {formatStat(permutationResult.npr)} &nbsp; · &nbsp; nCr = {formatStat(permutationResult.ncr)}</p>}</div>
      </section>}

      {panel === 'matrix' && <section className="calculator-mode-content" aria-label="عمليات المصفوفات">
        <div className="mode-content-heading"><Calculator size={19} aria-hidden="true" /><div><h3>عمليات المصفوفات</h3><p>مصفوفات مربعة من 1×1 إلى 3×3.</p></div></div>
        <div className="matrix-size-picker" role="group" aria-label="حجم المصفوفة">{[1, 2, 3].map((size) => <button type="button" key={size} className={matrixSize === size ? 'is-selected' : ''} onClick={() => resizeMatrices(size)}>{size} × {size}</button>)}</div>
        <div className="matrix-input-pair"><div><h4>المصفوفة A</h4><div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${matrixSize}, minmax(45px, 72px))` }}>{matrixA.map((row, rowIndex) => row.map((value, columnIndex) => <input key={`a-${rowIndex}-${columnIndex}`} aria-label={`A صف ${rowIndex + 1} عمود ${columnIndex + 1}`} type="number" value={value} onChange={(event) => updateMatrix('a', rowIndex, columnIndex, event.target.value)} />))}</div></div><div><h4>المصفوفة B</h4><div className="matrix-grid" style={{ gridTemplateColumns: `repeat(${matrixSize}, minmax(45px, 72px))` }}>{matrixB.map((row, rowIndex) => row.map((value, columnIndex) => <input key={`b-${rowIndex}-${columnIndex}`} aria-label={`B صف ${rowIndex + 1} عمود ${columnIndex + 1}`} type="number" value={value} onChange={(event) => updateMatrix('b', rowIndex, columnIndex, event.target.value)} />))}</div></div></div>
        <div className="matrix-operation-buttons">{MATRIX_OPERATIONS.map((operation) => <button type="button" key={operation.id} className="secondary-button" onClick={() => calculateMatrixOperation(operation.id)}>{operation.label}</button>)}</div>
        {matrixError && <p className="calculator-error" role="alert">{matrixError}</p>}
        {matrixResult !== null && <div className="matrix-result"><h4>النتيجة</h4>{Array.isArray(matrixResult) ? <div className="matrix-result-grid" style={{ gridTemplateColumns: `repeat(${matrixResult.length}, minmax(45px, 80px))` }}>{matrixResult.flatMap((row, rowIndex) => row.map((value, columnIndex) => <span key={`${rowIndex}-${columnIndex}`} dir="ltr">{formatStat(value)}</span>))}</div> : <strong dir="ltr">{formatStat(matrixResult)}</strong>}</div>}
      </section>}
    </section>
  );
}
