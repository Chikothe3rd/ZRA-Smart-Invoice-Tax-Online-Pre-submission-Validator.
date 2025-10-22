// Core type definitions for ZRA Validator

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
  originalValue?: unknown;
  fixedValue?: unknown;
  autoFixed: boolean;
  confidence: 'high' | 'medium' | 'low';
  category?: 'tpin' | 'date' | 'vat' | 'amount' | 'mandatory' | 'duplicate' | 'currency' | 'schema';
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  originalData: unknown;
  fixedData: unknown;
}

export interface ProcessedFile {
  name: string;
  type: 'xml' | 'csv' | 'json';
  result: ValidationResult;
}

export interface ValidationStats {
  totalIssues: number;
  criticalErrors: number;
  warnings: number;
  infoMessages: number;
  autoFixed: number;
  manualReviewNeeded: number;
  byCategory: Record<string, number>;
}

export interface ValidationHistory {
  id: string;
  timestamp: number;
  fileName: string;
  fileType: 'xml' | 'csv' | 'json';
  stats: ValidationStats;
  issues: ValidationIssue[];
}

export type DownloadFormat = 'original' | 'xml' | 'csv' | 'json';

export type IssueFilter = 'all' | 'errors' | 'warnings' | 'auto-fixed' | 'manual-review';
