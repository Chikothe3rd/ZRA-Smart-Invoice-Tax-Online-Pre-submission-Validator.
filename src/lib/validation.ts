import { validateTPIN, validateVATRate, validateMandatoryFields, ZRA_CONSTANTS } from './zraValidationRules';
import type { ValidationIssue, ValidationResult, ValidationStats } from '../types';

type AnyRecord = Record<string, unknown>;

const isObject = (v: unknown): v is AnyRecord => v !== null && typeof v === 'object' && !Array.isArray(v);

// Many inputs to this module come from parsing XML/CSV/JSON where the exact
// runtime shape isn't known to TypeScript. We use `AnyRecord` and narrow with
// `isObject` at runtime. The small helper `toRecord` centralizes the common
// pattern of safely treating unknown values as records for lookup, returning
// an empty object for non-objects. This reduces repetitive `as AnyRecord`
// casts and makes intent clearer.
const toRecord = (v: unknown): AnyRecord => (isObject(v) ? v : {});

// Normalize TPIN to 10-digit format (ZRA Standard)
// TPIN is a unique 10-digit computer-generated number - ZRA Official Specification
export function normalizeTpin(value: unknown): { normalized: string; confidence: 'high' | 'medium' | 'low' } {
  if (value === null || value === undefined) return { normalized: '0000000000', confidence: 'low' };

  // Convert to string if not already
  const stringValue = typeof value === 'string' || typeof value === 'number' ? String(value) : JSON.stringify(value);
  const cleaned = stringValue.replace(/[^0-9]/g, '');
  
  // ZRA Standard: TPIN must be exactly 10 digits
  if (cleaned.length === 10) {
    return { normalized: cleaned, confidence: 'high' };
  } else if (cleaned.length === 9) {
    // Pad with leading zero if 9 digits provided
    return { normalized: `0${cleaned}`, confidence: 'medium' };
  } else if (cleaned.length > 10) {
    // Truncate if too long
    return { normalized: cleaned.substring(0, 10), confidence: 'medium' };
  } else if (cleaned.length >= 6) {
    // Pad with zeros if too short but has some digits
    return { normalized: cleaned.padEnd(10, '0'), confidence: 'low' };
  }
  
  return { normalized: '0000000000', confidence: 'low' };
}

// Normalize dates to YYYY-MM-DD (ISO 8601 format required by ZRA)
export function normalizeDate(value: unknown): { normalized: string; confidence: 'high' | 'medium' | 'low' } {
  if (value === null || value === undefined) return { normalized: new Date().toISOString().split('T')[0], confidence: 'low' };

  // Convert to string if not already
  const stringValue = (typeof value === 'string' || typeof value === 'number') ? String(value).trim() : JSON.stringify(value).trim();
  
  // Try various date formats
  const formats = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,           // YYYY-MM-DD or YYYY-M-D
    /^(\d{2})\/(\d{1,2})\/(\d{4})$/,           // DD/MM/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,           // DD-MM-YYYY or D-M-YYYY
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,         // YYYY/MM/DD
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,         // DD.MM.YYYY
  ];
  
  for (let i = 0; i < formats.length; i++) {
    const match = stringValue.match(formats[i]);
    if (match) {
      let year, month, day;
      
      if (i === 0 || i === 3) {
        // YYYY-MM-DD or YYYY/MM/DD
        [, year, month, day] = match;
      } else {
        // DD/MM/YYYY, DD-MM-YYYY, or DD.MM.YYYY
        [, day, month, year] = match;
      }
      
      const normalized = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      const date = new Date(normalized);
      
      // Validate date is real and not in future
      if (!isNaN(date.getTime()) && date <= new Date()) {
        const yearNum = parseInt(year);
        // Validate year is reasonable (between 2000 and current year + 1)
        if (yearNum >= 2000 && yearNum <= new Date().getFullYear() + 1) {
          return { normalized, confidence: 'high' };
        }
      }
    }
  }
  
  // Try timestamp format
  if (/^\d{10,13}$/.test(stringValue)) {
    const timestamp = parseInt(stringValue);
    const date = new Date(timestamp.toString().length === 10 ? timestamp * 1000 : timestamp);
    if (!isNaN(date.getTime())) {
      return { normalized: date.toISOString().split('T')[0], confidence: 'medium' };
    }
  }
  
  return { normalized: new Date().toISOString().split('T')[0], confidence: 'low' };
}

// Parse number with common formats
export function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return null;

  const cleaned = String(value).replace(/[^^\d.-]/g, '');
  const num = parseFloat(cleaned);

  return isNaN(num) ? null : num;
}

// Validate and fix invoice/return data per ZRA requirements
export function validateAndFix(data: unknown, fileType: 'xml' | 'csv' | 'json'): ValidationResult {
  const issues: ValidationIssue[] = [];

  // If XML produced a single top-level wrapper (e.g., { Invoice: { ... } }),
  // unwrap it so `fixedData` and returned value use the inner object shape.
  let workingData: unknown = data;
  if (!Array.isArray(workingData) && isObject(workingData)) {
    const keys = Object.keys(toRecord(workingData));
    // Unwrap only when the single child is an object (not an array)
    if (keys.length === 1 && isObject(toRecord(workingData)[keys[0]])) {
      workingData = toRecord(workingData)[keys[0]];
    }
  }

  const fixedData = JSON.parse(JSON.stringify(workingData)) as unknown; // Deep clone

  // Handle different data structures
  const records: unknown[] = Array.isArray(workingData) ? (workingData as unknown[]) : [workingData];
  const fixedRecords: unknown[] = Array.isArray(fixedData) ? (fixedData as unknown[]) : [fixedData];
  
  // Track invoice numbers for duplicate detection
  const invoiceNumbersSeen = new Map<string, number>();
  
  records.forEach((origRecord, index) => {
  let record: AnyRecord = isObject(origRecord) ? (origRecord as AnyRecord) : { value: origRecord };
  let fixedRecord: AnyRecord = isObject(fixedRecords[index]) ? (fixedRecords[index] as AnyRecord) : { value: fixedRecords[index] };

    // If XML parsing produced a single top-level wrapper (e.g. { Invoice: { ... } }),
    // unwrap it so validation logic can operate on the inner object directly.
    if (isObject(record)) {
      const keys = Object.keys(record);
      if (keys.length === 1 && isObject(record[keys[0]])) {
        const inner = keys[0];
        const maybeInner = record[inner];
        if (isObject(maybeInner)) {
          record = maybeInner;
        }
        if (isObject(fixedRecord)) {
          const maybeFixedInner = toRecord(fixedRecord)[inner];
          if (isObject(maybeFixedInner)) {
            fixedRecord = maybeFixedInner;
          }
        }
      }
    }
    
    // Helper to extract primitive text from XML parsed nodes (e.g., {"#text": "value"})
    function extractPrimitive(val: unknown): unknown {
      if (val === null || val === undefined) return val;
      if (isObject(val)) {
        const obj = val;
        // If XML parsed: element -> { '#text': 'value' }
        if ('#text' in obj) return obj['#text'];
        // If a single-child wrapper, unwrap it
        const keys = Object.keys(obj);
        if (keys.length === 1 && !isObject(obj[keys[0]])) return obj[keys[0]];
        // If it's an object representing nested elements, return as-is
        return val;
      }
      return val;
    }

    // Check mandatory fields first
  const mandatoryCheck = validateMandatoryFields(record as AnyRecord);
    if (!mandatoryCheck.valid) {
      mandatoryCheck.missing.forEach(field => {
        issues.push({
          severity: 'error',
          field: `${field} (Record ${index + 1})`,
          message: `Mandatory field missing per ZRA requirements`,
          originalValue: 'missing',
          fixedValue: 'REQUIRED',
          autoFixed: false,
          confidence: 'high',
          category: 'mandatory',
        });
      });
    }
    
    // Validate invoice number
  const invoiceNumberField = extractPrimitive((record as AnyRecord).InvoiceNumber) || extractPrimitive((record as AnyRecord).invoiceNumber) || extractPrimitive((record as AnyRecord).InvoiceNo);
    if (!invoiceNumberField) {
      issues.push({
        severity: 'error',
        field: `InvoiceNumber (Record ${index + 1})`,
        message: `Invoice number is mandatory per ZRA requirements`,
        originalValue: 'missing',
        fixedValue: 'REQUIRED',
        autoFixed: false,
        confidence: 'high',
        category: 'mandatory',
      });
    } else {
      // Check for duplicate invoices
      const invoiceNumStr = String(invoiceNumberField).trim();
      if (invoiceNumbersSeen.has(invoiceNumStr)) {
        const firstOccurrence = invoiceNumbersSeen.get(invoiceNumStr)!;
        issues.push({
          severity: 'error',
          field: `InvoiceNumber (Record ${index + 1})`,
          message: `Duplicate invoice number detected (first seen in Record ${firstOccurrence + 1}). Each invoice must have a unique number per ZRA regulations`,
          originalValue: invoiceNumStr,
          fixedValue: 'MANUAL_REVIEW_REQUIRED',
          autoFixed: false,
          confidence: 'high',
          category: 'duplicate',
        });
      } else {
        invoiceNumbersSeen.set(invoiceNumStr, index);
      }
    }
    
    // Validate currency (ZRA requires ZMW)
  const currencyField = extractPrimitive((record as AnyRecord).Currency) || extractPrimitive((record as AnyRecord).currency) || extractPrimitive((record as AnyRecord).CurrencyCode);
    if (currencyField) {
      const currencyStr = String(currencyField).toUpperCase().trim();
      if (currencyStr !== 'ZMW' && currencyStr !== 'ZK') {
        const fieldName = record.Currency !== undefined ? 'Currency' : record.currency !== undefined ? 'currency' : 'CurrencyCode';
        fixedRecord[fieldName] = 'ZMW';
        issues.push({
          severity: 'warning',
          field: `${fieldName} (Record ${index + 1})`,
          message: `Currency must be ZMW (Zambian Kwacha) per ZRA requirements`,
          originalValue: currencyStr,
          fixedValue: 'ZMW',
          autoFixed: true,
          confidence: 'high',
          category: 'currency',
        });
      }
    } else {
      // Add missing currency
      fixedRecord.Currency = 'ZMW';
      issues.push({
        severity: 'info',
        field: `Currency (Record ${index + 1})`,
        message: `Currency set to ZMW (Zambian Kwacha)`,
        originalValue: 'missing',
        fixedValue: 'ZMW',
        autoFixed: true,
        confidence: 'high',
        category: 'currency',
      });
    }
    
    // Validate and fix TPIN
    if (record.TPIN !== undefined || record.tpin !== undefined || record.TaxpayerTIN !== undefined) {
  const tpinField = (record as AnyRecord).TPIN !== undefined ? 'TPIN' : (record as AnyRecord).tpin !== undefined ? 'tpin' : 'TaxpayerTIN';
  const tpinValue = extractPrimitive((record as AnyRecord)[tpinField]);
      const { normalized, confidence } = normalizeTpin(tpinValue);
      
      if (normalized !== tpinValue) {
        fixedRecord[tpinField] = normalized;
        issues.push({
          severity: confidence === 'low' ? 'error' : 'warning',
          field: `${tpinField} (Record ${index + 1})`,
          message: `TPIN normalized to ZRA 10-digit format (${normalized})`,
          originalValue: tpinValue,
          fixedValue: normalized,
          autoFixed: true,
          confidence,
          category: 'tpin',
        });
      }
    }
    
    // Validate and fix dates
    ['Date', 'date', 'InvoiceDate', 'TransactionDate'].forEach(dateField => {
      if ((record as AnyRecord)[dateField]) {
        const { normalized, confidence } = normalizeDate(extractPrimitive((record as AnyRecord)[dateField]));

        if (normalized !== (record as AnyRecord)[dateField]) {
          fixedRecord[dateField] = normalized;
          issues.push({
            severity: confidence === 'low' ? 'error' : 'info',
            field: `${dateField} (Record ${index + 1})`,
            message: `Date normalized to ZRA standard YYYY-MM-DD format (${normalized})`,
            originalValue: (record as AnyRecord)[dateField],
            fixedValue: normalized,
            autoFixed: true,
            confidence,
            category: 'date',
          });
        }
      }
    });
    
    // Validate and fix VAT rate (ZRA Standard: 16% as of 2025)
  const vatField = (record as AnyRecord).VATRate !== undefined ? 'VATRate' : 'vatRate';
  const vatValue = parseNumber(extractPrimitive((record as AnyRecord)[vatField]));
    
    // ZRA accepts 0% (exempt), 16% (standard). Validate range 0-100
    if (vatValue === null || vatValue < 0 || vatValue > 100) {
      fixedRecord[vatField] = 16;
      issues.push({
        severity: 'warning',
        field: `${vatField} (Record ${index + 1})`,
        message: `VAT rate set to ZRA standard 16%`,
        originalValue: String(record[vatField] || 'missing'),
        fixedValue: '16',
        autoFixed: true,
        confidence: 'high',
        category: 'vat',
      });
    } else if (vatValue !== 0 && vatValue !== 16) {
      // Warn about non-standard rate but keep it
      issues.push({
        severity: 'info',
        field: `${vatField} (Record ${index + 1})`,
        message: `Non-standard VAT rate detected (${vatValue}%). ZRA standard is 16% or 0% for exempt items`,
        originalValue: String(vatValue),
        fixedValue: String(vatValue),
        autoFixed: false,
        confidence: 'high',
        category: 'vat',
      });
    }
    
    // Validate and fix line items
    if ((record as AnyRecord).LineItems || (record as AnyRecord).lineItems) {
      const lineItemsField = (record as AnyRecord).LineItems ? 'LineItems' : 'lineItems';
      let lineItems = (record as AnyRecord)[lineItemsField];
      // If XML parsing produced LineItems.LineItem wrapper, normalize to array
      if (lineItems && isObject(lineItems) && 'LineItem' in lineItems) {
        const li = (lineItems as AnyRecord).LineItem;
        lineItems = Array.isArray(li) ? li : [li];
        // Reflect in fixedRecord as well
        if (isObject(fixedRecord) && (fixedRecord as AnyRecord)[lineItemsField]) {
          (fixedRecord as AnyRecord)[lineItemsField] = lineItems;
        }
      }
      
      if (Array.isArray(lineItems)) {
        if (lineItems.length === 0) {
          issues.push({
            severity: 'error',
            field: `${lineItemsField} (Record ${index + 1})`,
            message: `Invoice must contain at least one line item per ZRA requirements`,
            originalValue: 'empty array',
            fixedValue: 'REQUIRED',
            autoFixed: false,
            confidence: 'high',
            category: 'mandatory',
          });
        }
        
        lineItems.forEach((line: unknown, lineIndex: number) => {
          const fixedLine = (fixedRecord as AnyRecord)[lineItemsField][lineIndex] as AnyRecord;

          const l = isObject(line) ? (line as AnyRecord) : { value: line } as AnyRecord;
          const qtyField = l.Quantity !== undefined ? 'Quantity' : 'quantity';
          const priceField = l.UnitPrice !== undefined ? 'UnitPrice' : 'unitPrice';

          const qty = parseNumber(extractPrimitive(l[qtyField]));
          const unitPrice = parseNumber(extractPrimitive(l[priceField]));
          
          // Check for zero or negative quantities
          if (qty !== null && qty <= 0) {
            issues.push({
              severity: 'error',
              field: `${qtyField} (Record ${index + 1}, Line ${lineIndex + 1})`,
              message: `Quantity must be greater than zero per ZRA requirements`,
              originalValue: String(qty),
              fixedValue: 'MANUAL_REVIEW_REQUIRED',
              autoFixed: false,
              confidence: 'high',
              category: 'amount',
            });
          }
          
          // Check for negative unit prices
          if (unitPrice !== null && unitPrice < 0) {
            issues.push({
              severity: 'error',
              field: `${priceField} (Record ${index + 1}, Line ${lineIndex + 1})`,
              message: `Unit price cannot be negative per ZRA requirements`,
              originalValue: String(unitPrice),
              fixedValue: 'MANUAL_REVIEW_REQUIRED',
              autoFixed: false,
              confidence: 'high',
              category: 'amount',
            });
          }
          
          // Check for zero unit prices (warning, might be valid for free items)
          if (unitPrice !== null && unitPrice === 0) {
            issues.push({
              severity: 'warning',
              field: `${priceField} (Record ${index + 1}, Line ${lineIndex + 1})`,
              message: `Unit price is zero. Verify this is correct for free/complimentary items`,
              originalValue: String(unitPrice),
              fixedValue: String(unitPrice),
              autoFixed: false,
              confidence: 'medium',
              category: 'amount',
            });
          }
          
          if (qty !== null && unitPrice !== null && qty > 0 && unitPrice >= 0) {
            const calculatedTotal = Math.round(qty * unitPrice * 100) / 100;
            const lineTotalField = l.LineTotal !== undefined ? 'LineTotal' : 'lineTotal';
            const currentTotal = parseNumber(extractPrimitive(l[lineTotalField]));
            
            if (currentTotal === null || Math.abs(currentTotal - calculatedTotal) > 0.01) {
              fixedLine[lineTotalField] = calculatedTotal;
              issues.push({
                severity: 'warning',
                field: `${lineTotalField} (Record ${index + 1}, Line ${lineIndex + 1})`,
                message: `Line total recalculated: ${qty} × ${unitPrice} = ${calculatedTotal}`,
                originalValue: String(currentTotal),
                fixedValue: String(calculatedTotal),
                autoFixed: true,
                confidence: 'high',
                category: 'amount',
              });
            }
          }
        });
      } else {
        issues.push({
          severity: 'error',
          field: `${lineItemsField} (Record ${index + 1})`,
          message: `Line items must be an array per ZRA schema requirements`,
          originalValue: typeof lineItems,
          fixedValue: 'REQUIRED',
          autoFixed: false,
          confidence: 'high',
          category: 'schema',
        });
      }
    } else {
      // No line items field at all
      issues.push({
        severity: 'error',
        field: `LineItems (Record ${index + 1})`,
        message: `Invoice must contain line items per ZRA requirements`,
        originalValue: 'missing',
        fixedValue: 'REQUIRED',
        autoFixed: false,
        confidence: 'high',
        category: 'mandatory',
      });
    }
    
    // Validate and fix totals
  const taxableField = record.TaxableAmount !== undefined ? 'TaxableAmount' : 'taxableAmount';
  const vatAmountField = record.VATAmount !== undefined ? 'VATAmount' : 'vatAmount';
  const grandTotalField = record.GrandTotal !== undefined ? 'GrandTotal' : 'grandTotal';
    
  const taxable = parseNumber(extractPrimitive(record[taxableField]));
  const vatAmount = parseNumber(extractPrimitive(record[vatAmountField]));
  const grandTotal = parseNumber(extractPrimitive(record[grandTotalField]));
    
    // Check for negative amounts
    if (taxable !== null && taxable < 0) {
      issues.push({
        severity: 'error',
        field: `${taxableField} (Record ${index + 1})`,
        message: `Taxable amount cannot be negative per ZRA requirements`,
        originalValue: String(taxable),
        fixedValue: 'MANUAL_REVIEW_REQUIRED',
        autoFixed: false,
        confidence: 'high',
        category: 'amount',
      });
    }
    
    if (vatAmount !== null && vatAmount < 0) {
      issues.push({
        severity: 'error',
        field: `${vatAmountField} (Record ${index + 1})`,
        message: `VAT amount cannot be negative per ZRA requirements`,
        originalValue: String(vatAmount),
        fixedValue: 'MANUAL_REVIEW_REQUIRED',
        autoFixed: false,
        confidence: 'high',
        category: 'amount',
      });
    }
    
    if (grandTotal !== null && grandTotal < 0) {
      issues.push({
        severity: 'error',
        field: `${grandTotalField} (Record ${index + 1})`,
        message: `Grand total cannot be negative per ZRA requirements`,
        originalValue: String(grandTotal),
        fixedValue: 'MANUAL_REVIEW_REQUIRED',
        autoFixed: false,
        confidence: 'high',
        category: 'amount',
      });
    }
    
    // Check for zero amounts (warning)
    if (taxable !== null && taxable === 0) {
      issues.push({
        severity: 'warning',
        field: `${taxableField} (Record ${index + 1})`,
        message: `Taxable amount is zero. Verify this is correct for zero-rated transactions`,
        originalValue: String(taxable),
        fixedValue: String(taxable),
        autoFixed: false,
        confidence: 'medium',
        category: 'amount',
      });
    }
    
    if (taxable !== null && taxable >= 0) {
      const vatRate = parseNumber(fixedRecord.VATRate || fixedRecord.vatRate || 16) / 100;
      const calculatedVAT = Math.round(taxable * vatRate * 100) / 100;
      const calculatedGrandTotal = Math.round((taxable + calculatedVAT) * 100) / 100;
      
      const currentVAT = parseNumber(record[vatAmountField]);
      if (currentVAT === null || Math.abs(currentVAT - calculatedVAT) > 0.01) {
        fixedRecord[vatAmountField] = calculatedVAT;
        issues.push({
          severity: 'warning',
          field: `${vatAmountField} (Record ${index + 1})`,
          message: `VAT amount recalculated: ${taxable} × ${(vatRate * 100)}% = ${calculatedVAT}`,
          originalValue: String(currentVAT),
          fixedValue: String(calculatedVAT),
          autoFixed: true,
          confidence: 'high',
          category: 'amount',
        });
      }
      
      const currentGrandTotal = parseNumber(record[grandTotalField]);
      if (currentGrandTotal === null || Math.abs(currentGrandTotal - calculatedGrandTotal) > 0.01) {
        fixedRecord[grandTotalField] = calculatedGrandTotal;
        issues.push({
          severity: 'warning',
          field: `${grandTotalField} (Record ${index + 1})`,
          message: `Grand total recalculated: ${taxable} + ${calculatedVAT} = ${calculatedGrandTotal}`,
          originalValue: String(currentGrandTotal),
          fixedValue: String(calculatedGrandTotal),
          autoFixed: true,
          confidence: 'high',
          category: 'amount',
        });
      }
    }
    
    // Validate data structure schema
    const requiredFields = ['TPIN', 'InvoiceNumber', 'InvoiceDate'];
    const missingStructure: string[] = [];
    
    requiredFields.forEach(field => {
      const hasField = record[field] !== undefined || 
                       record[field.toLowerCase()] !== undefined ||
                       record[field.charAt(0).toLowerCase() + field.slice(1)] !== undefined;
      if (!hasField) {
        missingStructure.push(field);
      }
    });
    
    if (missingStructure.length > 0) {
      issues.push({
        severity: 'error',
        field: `Schema Validation (Record ${index + 1})`,
        message: `Missing required fields per ZRA schema: ${missingStructure.join(', ')}`,
        originalValue: 'incomplete structure',
        fixedValue: 'MANUAL_REVIEW_REQUIRED',
        autoFixed: false,
        confidence: 'high',
        category: 'schema',
      });
    }
  });
  
  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    originalData: data,
    fixedData: Array.isArray(data) ? fixedRecords : fixedRecords[0],
  };
}

// Generate detailed statistics for validation
export function getValidationStats(result: ValidationResult): ValidationStats {
  const byCategory: Record<string, number> = {};
  
  result.issues.forEach(issue => {
    const category = issue.category || 'other';
    byCategory[category] = (byCategory[category] || 0) + 1;
  });
  
  const stats = {
    totalIssues: result.issues.length,
    criticalErrors: result.issues.filter(i => i.severity === 'error').length,
    warnings: result.issues.filter(i => i.severity === 'warning').length,
    infoMessages: result.issues.filter(i => i.severity === 'info').length,
    autoFixed: result.issues.filter(i => i.autoFixed).length,
    manualReviewNeeded: result.issues.filter(i => i.severity === 'error' && !i.autoFixed).length,
    byCategory,
  };
  
  return stats;
}
