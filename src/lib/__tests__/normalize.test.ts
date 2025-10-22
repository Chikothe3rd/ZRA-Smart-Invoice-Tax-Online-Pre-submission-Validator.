import { normalizeTpin, normalizeDate } from '../validation';

describe('normalizeTpin', () => {
  test('returns high confidence for valid 10-digit TPIN', () => {
    const res = normalizeTpin('1234567890');
    expect(res.normalized).toBe('1234567890');
    expect(res.confidence).toBe('high');
  });

  test('pads 9-digit TPIN with leading zero', () => {
    const res = normalizeTpin('123456789');
    expect(res.normalized).toBe('0123456789');
    expect(res.confidence).toBe('medium');
  });

  test('truncates long TPINs to 10 digits', () => {
    const res = normalizeTpin('1234567890123');
    expect(res.normalized).toBe('1234567890');
    expect(res.confidence).toBe('medium');
  });

  test('returns low confidence for non-numeric input', () => {
    const res = normalizeTpin('abc');
    expect(res.normalized).toBe('0000000000');
    expect(res.confidence).toBe('low');
  });
});

describe('normalizeDate', () => {
  test('parses YYYY-MM-DD correctly', () => {
    const res = normalizeDate('2023-05-01');
    expect(res.normalized).toBe('2023-05-01');
    expect(res.confidence).toBe('high');
  });

  test('parses DD/MM/YYYY correctly', () => {
    const res = normalizeDate('01/05/2023');
    expect(res.normalized).toBe('2023-05-01');
    expect(res.confidence).toBe('high');
  });

  test('parses timestamp (seconds) correctly', () => {
    const ts = Math.floor(new Date('2023-05-01T00:00:00Z').getTime() / 1000).toString();
    const res = normalizeDate(ts);
    expect(res.normalized).toBe('2023-05-01');
    expect(res.confidence).toBe('medium');
  });

  test('returns today for invalid dates with low confidence', () => {
    const res = normalizeDate('not-a-date');
    // Can't reliably assert exact ISO date here; just assert low confidence
    expect(res.confidence).toBe('low');
  });
});
