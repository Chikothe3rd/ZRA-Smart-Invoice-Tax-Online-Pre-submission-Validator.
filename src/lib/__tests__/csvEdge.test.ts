/// <reference types="jest" />
import { processFile, type FileLike } from '../fileProcessing';

describe('CSV edge cases', () => {
  test('handles CSV with missing header and extra commas', async () => {
    const csv = `Quantity,UnitPrice,LineTotal\n1,10,10\n,5,5`;
  const file: FileLike = { name: 'bad.csv', async text() { return csv; } };
    const res = await processFile(file);
    // Should detect that a line item has missing quantity
    expect(res.result.issues.length).toBeGreaterThan(0);
  });

  test('flags negative amounts in CSV', async () => {
    const csv = `Quantity,UnitPrice,LineTotal\n1,-10,-10`;
  const file: FileLike = { name: 'bad2.csv', async text() { return csv; } };
    const res = await processFile(file);
    // Expect at least one error (negative unit price or related amount error)
    const errors = res.result.issues.filter(i => i.severity === 'error');
    expect(errors.length).toBeGreaterThan(0);
  });
});
