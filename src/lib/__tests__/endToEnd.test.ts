import { processFile } from '../fileProcessing';
import { describe, test, expect } from 'vitest';

describe('End-to-end processing (JSON & XML)', () => {
  test('processes and corrects a malformed JSON invoice', async () => {
    const brokenJson = JSON.stringify({
      TPIN: '123456789', // 9 digits -> should be padded to 10
      InvoiceNumber: 'INV-JSON-001',
      InvoiceDate: '01/02/2025', // DD/MM/YYYY -> 2025-02-01
      Currency: 'usd', // should be normalized to ZMW
      LineItems: [
        { Quantity: '2', UnitPrice: '10', LineTotal: '20' }
      ],
      TaxableAmount: '20',
      VATAmount: '3.2',
      GrandTotal: '23.2'
    });

    // Create a File-like object with a text() method for the test environment
    const file: { name: string; text: () => Promise<string> } = {
      name: 'sample_bad.json',
      async text() {
        return brokenJson;
      }
    };

    const result = await processFile(file);

    // Expect issues to be present and some auto-fixes performed
    expect(result.result.issues.length).toBeGreaterThan(0);
    // cast fixedData to any to access dynamic properties
    const fixedData = result.result.fixedData as any;
    // TPIN should be normalized to 10 digits (padded)
    const fixedTPIN = fixedData.TPIN || fixedData.tpin || fixedData.TaxpayerTIN;
    expect(String(fixedTPIN).length).toBe(10);
    // Currency should be ZMW
    expect(fixedData.Currency || fixedData.currency).toBe('ZMW');
    // InvoiceDate should be ISO-format
    expect(fixedData.InvoiceDate).toBe('2025-02-01');
  });

  test('processes and corrects a simple XML invoice', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <Invoice>
      <InvoiceNumber>INV-XML-001</InvoiceNumber>
      <TPIN>987654321</TPIN>
      <InvoiceDate>2025-03-05</InvoiceDate>
      <Currency>gbp</Currency>
      <LineItems>
        <LineItem>
          <Quantity>1</Quantity>
          <UnitPrice>100</UnitPrice>
          <LineTotal>100</LineTotal>
        </LineItem>
      </LineItems>
      <TaxableAmount>100</TaxableAmount>
      <VATAmount>16</VATAmount>
      <GrandTotal>116</GrandTotal>
    </Invoice>`;

    const file: { name: string; text: () => Promise<string> } = {
      name: 'sample_bad.xml',
      async text() {
        return xml;
      }
    };

    const result = await processFile(file);

    expect(result.result.issues.length).toBeGreaterThan(0);
    const fixedData = result.result.fixedData as any;
    // TPIN should be normalized/padded to 10 digits
    const fixedTPIN = fixedData.TPIN || fixedData.tpin || fixedData.TaxpayerTIN;
    expect(String(fixedTPIN).length).toBe(10);
    // Currency normalized to ZMW
    expect(fixedData.Currency || fixedData.currency).toBe('ZMW');
    // InvoiceNumber should still be present
    expect(fixedData.InvoiceNumber || fixedData.InvoiceNo).toBeDefined();
    // InvoiceNumber should still be present
    expect(fixedData.InvoiceNumber || fixedData.InvoiceNo).toBeDefined();
  });
});
