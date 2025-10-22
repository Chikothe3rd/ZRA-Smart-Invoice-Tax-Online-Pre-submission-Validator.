import Papa from 'papaparse';
import JSZip from 'jszip';
import { validateAndFix } from './validation';
import type { ValidationResult } from '../types';

export type FileType = 'xml' | 'csv' | 'json';

export interface ProcessedFile {
  name: string;
  type: FileType;
  result: ValidationResult;
}

// Parse XML to JSON (simple parser for invoice data)
function parseXML(xmlString: string): Record<string, unknown> {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

  function xmlToJson(xml: Node | Document): Record<string, unknown> | string {
    const obj: Record<string, unknown> = {};

    if ((xml as Element).nodeType === 1) {
      const el = xml as Element;
      if (el.attributes && el.attributes.length > 0) {
        const attrs: Record<string, string | null> = {};
        for (let j = 0; j < el.attributes.length; j++) {
          const attribute = el.attributes.item(j)!;
          attrs[attribute.nodeName] = attribute.nodeValue;
        }
        obj['@attributes'] = attrs;
      }
    } else if ((xml as CharacterData).nodeType === 3) {
      return (xml as CharacterData).nodeValue || '';
    }

    if (xml.hasChildNodes()) {
      for (let i = 0; i < xml.childNodes.length; i++) {
        const item = xml.childNodes.item(i)!;
        const nodeName = item.nodeName;
        const child = xmlToJson(item);
        if (obj[nodeName] === undefined) {
          obj[nodeName] = child;
        } else {
          if (!Array.isArray(obj[nodeName])) {
            obj[nodeName] = [obj[nodeName]] as unknown as Record<string, unknown>[];
          }
          (obj[nodeName] as unknown as unknown[]).push(child);
        }
      }
    }

    return obj;
  }

  return xmlToJson(xmlDoc) as Record<string, unknown>;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

// Convert JSON back to XML
function jsonToXML(obj: unknown, rootName: string = 'Invoice'): string {
  function buildXML(data: unknown, nodeName: string): string {
    if (data === null || data === undefined) return `<${nodeName}/>`;

    if (!isPlainObject(data) && !Array.isArray(data)) {
      return `<${nodeName}>${String(data)}</${nodeName}>`;
    }

    if (Array.isArray(data)) {
      return data.map(item => buildXML(item, nodeName)).join('\n');
    }

    let xml = `<${nodeName}>`;

    for (const key in data as Record<string, unknown>) {
      if (key === '@attributes') continue;
      xml += '\n  ' + buildXML((data as Record<string, unknown>)[key], key);
    }

    xml += `\n</${nodeName}>`;
    return xml;
  }

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + buildXML(obj, rootName);
}

// Fix common JSON formatting issues before parsing
function fixJSONSyntax(jsonString: string): string {
  let fixed = jsonString.trim();
  
  // Remove comments (// and /* */)
  fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove /* */ comments
  fixed = fixed.replace(/\/\/.*/g, ''); // Remove // comments
  
  // Fix single quotes to double quotes (be careful with values)
  fixed = fixed.replace(/'/g, '"');
  
  // Fix unquoted property names (common issue)
  // Match: word characters followed by colon, not already quoted
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":');
  
  // Remove trailing commas before closing brackets/braces
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
  
  // Fix missing commas between properties (basic fix)
  fixed = fixed.replace(/"\s*\n\s*"/g, '",\n"');
  
  // Remove any remaining whitespace issues
  fixed = fixed.replace(/\r\n/g, '\n');
  
  return fixed;
}

// Process uploaded file
// Allow a File-like object in tests (has name and text())
export type FileLike = File | { name: string; text: () => Promise<string> };
export async function processFile(file: FileLike): Promise<ProcessedFile> {
  const fileName = file.name.toLowerCase();
  let fileType: FileType;
  let data: unknown;
  
  if (fileName.endsWith('.xml')) {
    fileType = 'xml';
    const text = await file.text();
    data = parseXML(text);
  } else if (fileName.endsWith('.csv')) {
    fileType = 'csv';
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, dynamicTyping: true });
    data = parsed.data;

    // If CSV rows look like invoice line items (contain Quantity/UnitPrice/LineTotal),
    // wrap them into an invoice-like object so the validator treats them as a single invoice
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0] || {};
      const hasLineItemKeys = 'Quantity' in sample || 'quantity' in sample || 'UnitPrice' in sample || 'unitPrice' in sample || 'LineTotal' in sample || 'lineTotal' in sample;
      if (hasLineItemKeys) {
        data = {
          LineItems: Array.isArray(data) ? data : [data]
        };
      }
    }
  } else if (fileName.endsWith('.json')) {
    fileType = 'json';
    const text = await file.text();
    
    // Try to parse as-is first
    try {
      data = JSON.parse(text);
    } catch (error) {
      // If parsing fails, try to fix common JSON syntax errors
      console.log('Initial JSON parse failed, attempting to fix syntax errors...');
      try {
        const fixedText = fixJSONSyntax(text);
        data = JSON.parse(fixedText);
        console.log('JSON syntax automatically corrected');
      } catch (fixError) {
        // If still fails, provide detailed error message
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `Invalid JSON format: ${errorMsg}. Please ensure your JSON file has:\n` +
          '• Property names in double quotes (e.g., "InvoiceNumber")\n' +
          '• Values in double quotes for strings\n' +
          '• No trailing commas\n' +
          '• Valid JSON structure\n\n' +
          'You can use a JSON validator online to check your file format.'
        );
      }
    }
  } else {
    throw new Error('Unsupported file type. Please upload XML, CSV, or JSON files.');
  }
  
  const result = validateAndFix(data, fileType);
  
  return {
    name: file.name,
    type: fileType,
    result,
  };
}

// Generate issue report with ZRA compliance details
function generateIssueReport(processedFiles: ProcessedFile[]): string {
  let report = '╔════════════════════════════════════════════════════════════╗\n';
  report += '║         ZRA TAX VALIDATION & COMPLIANCE REPORT            ║\n';
  report += '║     Zambia Revenue Authority Smart Invoice Validator      ║\n';
  report += '╚════════════════════════════════════════════════════════════╝\n\n';
  report += `Generated: ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lusaka' })} (CAT)\n`;
  report += `Files Processed: ${processedFiles.length}\n`;
  report += `Validation Standard: ZRA Smart Invoice Requirements (2024-2025)\n`;
  report += `TPIN Format: 10-digit numeric (ZRA Official Specification)\n`;
  report += `VAT Rate: 16% (standard) / 0% (exempt)\n`;
  report += `Currency: ZMW (Zambian Kwacha)\n\n`;
  
  // Overall summary
  const totalIssues = processedFiles.reduce((sum, f) => sum + f.result.issues.length, 0);
  const totalErrors = processedFiles.reduce((sum, f) => 
    sum + f.result.issues.filter(i => i.severity === 'error').length, 0);
  const totalWarnings = processedFiles.reduce((sum, f) => 
    sum + f.result.issues.filter(i => i.severity === 'warning').length, 0);
  const totalAutoFixed = processedFiles.reduce((sum, f) => 
    sum + f.result.issues.filter(i => i.autoFixed).length, 0);
  
  report += '═══════════════════════════════════════════════════════════\n';
  report += '                    OVERALL SUMMARY\n';
  report += '═══════════════════════════════════════════════════════════\n';
  report += `Total Issues Found: ${totalIssues}\n`;
  report += `  ├─ Errors (Manual Review Required): ${totalErrors}\n`;
  report += `  ├─ Warnings (Auto-Fixed): ${totalWarnings}\n`;
  report += `  └─ Auto-Fixed Issues: ${totalAutoFixed}\n`;
  report += `\nCompliance Status: ${totalErrors === 0 ? '✓ READY FOR ZRA SUBMISSION' : '✗ REQUIRES MANUAL REVIEW'}\n\n`;
  
  processedFiles.forEach((file, index) => {
    report += `\n╔════════════════════════════════════════════════════════════╗\n`;
    report += `║  FILE ${index + 1}: ${file.name.padEnd(47)}║\n`;
    report += `╚════════════════════════════════════════════════════════════╝\n\n`;
    
    const errorCount = file.result.issues.filter(i => i.severity === 'error').length;
    const warningCount = file.result.issues.filter(i => i.severity === 'warning').length;
    const infoCount = file.result.issues.filter(i => i.severity === 'info').length;
    const autoFixedCount = file.result.issues.filter(i => i.autoFixed).length;
    const manualReviewCount = file.result.issues.filter(i => !i.autoFixed && i.severity === 'error').length;
    
    report += `File Type: ${file.type.toUpperCase()}\n`;
    report += `─────────────────────────────────────────────────────────────\n`;
    report += `Issue Statistics:\n`;
    report += `  ├─ Total Issues: ${file.result.issues.length}\n`;
    report += `  ├─ Errors: ${errorCount}${errorCount > 0 ? ' ⚠' : ''}\n`;
    report += `  ├─ Warnings: ${warningCount}\n`;
    report += `  ├─ Info: ${infoCount}\n`;
    report += `  ├─ Auto-Fixed: ${autoFixedCount}\n`;
    report += `  └─ Manual Review Required: ${manualReviewCount}${manualReviewCount > 0 ? ' ⚠' : ''}\n\n`;
    report += `ZRA Compliance Status: ${file.result.isValid ? '✓ VALID (Ready for submission)' : '✗ INVALID (Requires corrections)'}\n\n`;
    
    if (file.result.issues.length > 0) {
      report += 'Detailed Issues:\n';
      report += '─────────────────────────────────────────────────────────────\n\n';
      
      // Group issues by severity
      const errors = file.result.issues.filter(i => i.severity === 'error');
      const warnings = file.result.issues.filter(i => i.severity === 'warning');
      const infos = file.result.issues.filter(i => i.severity === 'info');
      
      if (errors.length > 0) {
        report += `🔴 ERRORS (${errors.length}) - Manual Review Required:\n`;
        report += '─────────────────────────────────────────────────────────────\n';
        errors.forEach((issue, issueIndex) => {
          report += `${issueIndex + 1}. [ERROR] ${issue.field}\n`;
          report += `   Message: ${issue.message}\n`;
          if (issue.originalValue) {
            report += `   Original: ${issue.originalValue}\n`;
          }
          if (issue.fixedValue) {
            report += `   Required: ${issue.fixedValue}\n`;
          }
          report += `   Confidence: ${issue.confidence.toUpperCase()}\n`;
          report += `   ⚠ ACTION REQUIRED: Manual correction needed before ZRA submission\n\n`;
        });
      }
      
      if (warnings.length > 0) {
        report += `🟡 WARNINGS (${warnings.length}) - Auto-Fixed:\n`;
        report += '─────────────────────────────────────────────────────────────\n';
        warnings.forEach((issue, issueIndex) => {
          report += `${issueIndex + 1}. [WARNING] ${issue.field}\n`;
          report += `   Message: ${issue.message}\n`;
          if (issue.originalValue) {
            report += `   Original: ${issue.originalValue}\n`;
          }
          if (issue.fixedValue) {
            report += `   Fixed To: ${issue.fixedValue}\n`;
          }
          report += `   Confidence: ${issue.confidence.toUpperCase()}\n`;
          report += `   ✓ Auto-Fixed: ${issue.autoFixed ? 'Yes' : 'No'}\n\n`;
        });
      }
      
      if (infos.length > 0) {
        report += `ℹ INFO (${infos.length}) - Informational:\n`;
        report += '─────────────────────────────────────────────────────────────\n';
        infos.forEach((issue, issueIndex) => {
          report += `${issueIndex + 1}. [INFO] ${issue.field}\n`;
          report += `   Message: ${issue.message}\n`;
          if (issue.originalValue && issue.fixedValue && issue.originalValue !== issue.fixedValue) {
            report += `   Changed: ${issue.originalValue} → ${issue.fixedValue}\n`;
          }
          report += `\n`;
        });
      }
    } else {
      report += '✓ No issues detected. File is compliant with ZRA requirements.\n\n';
    }
  });
  
  report += '\n╔════════════════════════════════════════════════════════════╗\n';
  report += '║                  END OF VALIDATION REPORT                 ║\n';
  report += '╚════════════════════════════════════════════════════════════╝\n\n';
  
  report += 'ZRA COMPLIANCE CHECKLIST:\n';
  report += '─────────────────────────────────────────────────────────────\n';
  report += `☐ TPIN Format: 10-digit numeric\n`;
  report += `☐ Date Format: YYYY-MM-DD (ISO 8601)\n`;
  report += `☐ VAT Rate: 16% (standard) or 0% (exempt)\n`;
  report += `☐ Invoice Number: Present and valid\n`;
  report += `☐ Amounts: Calculations verified (2 decimal places)\n`;
  report += `☐ Mandatory Fields: All present\n\n`;
  
  report += 'NEXT STEPS:\n';
  report += '─────────────────────────────────────────────────────────────\n';
  if (totalErrors > 0) {
    report += `1. Review ${totalErrors} error(s) marked for manual correction\n`;
    report += `2. Make necessary corrections to the corrected files\n`;
    report += `3. Re-validate files before ZRA submission\n`;
  } else {
    report += `✓ Files are ready for ZRA Smart Invoice submission\n`;
    report += `✓ Use the corrected files in the ZIP package\n`;
  }
  report += '\n';
  
  report += 'DISCLAIMER:\n';
  report += '─────────────────────────────────────────────────────────────\n';
  report += 'This validation tool performs automated checks based on ZRA\n';
  report += 'Smart Invoice requirements. While comprehensive, it may not\n';
  report += 'catch all possible issues. Always review files before official\n';
  report += 'submission to Zambia Revenue Authority.\n\n';
  
  report += '© 2025 ZRA Tax Validation Tool\n';
  report += 'For official ZRA guidance: https://www.zra.org.zm\n';
  
  return report;
}

// Generate ZIP with corrected files and report (with format selection)
export async function generateDownloadZip(
  processedFiles: ProcessedFile[], 
  outputFormat: 'original' | 'xml' | 'csv' | 'json' = 'original'
): Promise<Blob> {
  const zip = new JSZip();
  
  // Add corrected files in selected format
  processedFiles.forEach(file => {
    let content: string;
    let extension: string;
    
    // Determine output format and extension
    if (outputFormat === 'original') {
      extension = file.type;
    } else {
      extension = outputFormat;
    }
    
  // Generate file name
  const baseName = file.name.replace(/\.(xml|csv|json)$/i, '');
  const correctedName = `${baseName}_corrected.${extension}`;
    
    // Convert to selected format
    if (extension === 'xml') {
      content = jsonToXML(file.result.fixedData);
    } else if (extension === 'csv') {
      const dataArray = Array.isArray(file.result.fixedData) 
        ? file.result.fixedData 
        : [file.result.fixedData];
      content = Papa.unparse(dataArray);
    } else {
      content = JSON.stringify(file.result.fixedData, null, 2);
    }
    
    zip.file(correctedName, content);
  });
  
  // Add issue report
  const report = generateIssueReport(processedFiles);
  zip.file('ZRA_Validation_Report.txt', report);
  
  return await zip.generateAsync({ type: 'blob' });
}
