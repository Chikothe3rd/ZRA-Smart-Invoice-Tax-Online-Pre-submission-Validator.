// ZRA (Zambia Revenue Authority) Validation Rules and Constants
// Based on official ZRA Smart Invoice requirements (2024-2025)

export const ZRA_CONSTANTS = {
  // TPIN must be exactly 10 digits (ZRA Official Specification)
  TPIN_LENGTH: 10,
  
  // Standard VAT rate in Zambia as of 2025
  VAT_RATE_STANDARD: 16,
  
  // VAT exempt rate
  VAT_RATE_EXEMPT: 0,
  
  // Valid VAT rates (16% standard, 0% for exempt items)
  VALID_VAT_RATES: [0, 16],
  
  // Decimal precision for currency amounts
  CURRENCY_DECIMAL_PLACES: 2,
  
  // Minimum valid year for dates
  MIN_YEAR: 2000,
  
  // Currency code for Zambia
  CURRENCY_CODE: 'ZMW',
} as const;

export const ZRA_FIELD_REQUIREMENTS = {
  // Mandatory fields for invoices
  MANDATORY_INVOICE_FIELDS: [
    'TPIN',
    'InvoiceDate',
    'InvoiceNumber',
    'TaxableAmount',
    'VATAmount',
    'GrandTotal',
  ],
  
  // Mandatory fields for line items
  MANDATORY_LINE_ITEM_FIELDS: [
    'Description',
    'Quantity',
    'UnitPrice',
    'LineTotal',
  ],
} as const;

export const ZRA_VALIDATION_MESSAGES = {
  TPIN_INVALID: 'TPIN must be exactly 10 digits as per ZRA specification',
  TPIN_MISSING: 'TPIN is mandatory for all ZRA submissions',
  DATE_INVALID: 'Date must be in valid format (YYYY-MM-DD preferred)',
  DATE_FUTURE: 'Invoice date cannot be in the future',
  VAT_RATE_INVALID: 'VAT rate must be 16% (standard) or 0% (exempt) as per ZRA regulations',
  AMOUNT_NEGATIVE: 'Amount cannot be negative',
  CALCULATION_MISMATCH: 'Calculated total does not match provided total',
  MISSING_FIELD: 'Required field is missing',
  INVOICE_NUMBER_MISSING: 'Invoice number is mandatory',
  LINE_ITEMS_EMPTY: 'Invoice must contain at least one line item',
} as const;

export interface ZRAInvoiceValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: string[];
}

/**
 * Validates if a TPIN meets ZRA requirements
 */
export function validateTPIN(tpin: string): { valid: boolean; message?: string } {
  if (!tpin) {
    return { valid: false, message: ZRA_VALIDATION_MESSAGES.TPIN_MISSING };
  }
  
  const cleaned = tpin.replace(/[^0-9]/g, '');
  
  if (cleaned.length !== ZRA_CONSTANTS.TPIN_LENGTH) {
    return { valid: false, message: ZRA_VALIDATION_MESSAGES.TPIN_INVALID };
  }
  
  return { valid: true };
}

/**
 * Validates if a VAT rate is acceptable by ZRA
 */
export function validateVATRate(rate: number): { valid: boolean; message?: string } {
  if (rate < 0 || rate > 100) {
    return { valid: false, message: 'VAT rate must be between 0 and 100' };
  }
  
  const validRates = [0, 16]; // ZRA standard rates
  if (!validRates.includes(rate)) {
    return { 
      valid: true, 
      message: `Non-standard VAT rate. ZRA standard rates are ${validRates.join('% or ')}%` 
    };
  }
  
  return { valid: true };
}

/**
 * Validates if amounts are calculated correctly per ZRA rules
 */
export function validateAmountCalculation(
  taxable: number, 
  vatRate: number, 
  vatAmount: number, 
  grandTotal: number
): { valid: boolean; message?: string; expectedVAT?: number; expectedTotal?: number } {
  const expectedVAT = Math.round(taxable * (vatRate / 100) * 100) / 100;
  const expectedTotal = Math.round((taxable + expectedVAT) * 100) / 100;
  
  const vatMatch = Math.abs(vatAmount - expectedVAT) < 0.01;
  const totalMatch = Math.abs(grandTotal - expectedTotal) < 0.01;
  
  if (!vatMatch || !totalMatch) {
    return {
      valid: false,
      message: ZRA_VALIDATION_MESSAGES.CALCULATION_MISMATCH,
      expectedVAT,
      expectedTotal,
    };
  }
  
  return { valid: true };
}

/**
 * Checks if all mandatory fields are present
 */
export function validateMandatoryFields(record: unknown): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

  for (const field of ZRA_FIELD_REQUIREMENTS.MANDATORY_INVOICE_FIELDS) {
    let value: unknown;
    if (isObj(record)) {
      value = (record as Record<string, unknown>)[field] ?? (record as Record<string, unknown>)[field.toLowerCase()] ?? (record as Record<string, unknown>)[field.charAt(0).toLowerCase() + field.slice(1)];
    } else {
      value = undefined;
    }

    if (value === undefined || value === null || value === '') {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
