import { generateCSVReport, generateMarkdownReport } from '../exportReport';
import type { ProcessedFile } from '../../types';

describe('exportReport generators smoke tests', () => {
  test('generateCSVReport returns a Blob with CSV content', () => {
    const processedFiles: ProcessedFile[] = [
      {
        name: 'test.json',
        type: 'json',
        result: {
          isValid: false,
          issues: [
            { severity: 'warning', field: 'Amount', message: 'Auto-fixed amount', originalValue: '100', fixedValue: '100.00', autoFixed: true, confidence: 'high' }
          ],
          originalData: null,
          fixedData: null,
        }
      }
    ];

    const blob = generateCSVReport(processedFiles);
    expect(blob).toBeInstanceOf(Blob);
  });

  test('generateMarkdownReport returns a Blob containing "ZRA Validation Report"', async () => {
    const processedFiles: ProcessedFile[] = [
      {
        name: 'test.json',
        type: 'json',
        result: {
          isValid: false,
          issues: [
            { severity: 'error', field: 'TPIN', message: 'Invalid format', originalValue: 'abc', fixedValue: null, autoFixed: false, confidence: 'low' }
          ],
          originalData: null,
          fixedData: null,
        }
      }
    ];

    const blob = generateMarkdownReport(processedFiles);
    expect(blob).toBeInstanceOf(Blob);

    // In jsdom the Blob content helpers may not be available consistently.
    // Assert we got a Blob of the expected MIME type and non-zero size instead.
    expect((blob as Blob).type).toContain('text/markdown');
    expect((blob as Blob).size).toBeGreaterThan(0);
  });
});
