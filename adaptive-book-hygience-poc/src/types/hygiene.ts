/**
 * @file hygiene.ts
 * @description TypeScript interfaces for Financial Books Hygiene Assessment
 * 
 * Defines the type system for the Day-30 Readiness Scoring Model
 * and all related assessment data structures.
 */

// =================================================================================
// CORE ASSESSMENT TYPES
// =================================================================================

/**
 * The five pillar scores as defined by the Day-30 methodology.
 */
export interface HygienePillarScores {
  /** Bank & Credit Card Reconciliation Status - 30% weight */
  reconciliation: number; // 0-100
  /** Chart of Accounts Integrity - 20% weight */
  coaIntegrity: number;   // 0-100
  /** Transaction Categorization Completeness - 20% weight */
  categorization: number; // 0-100
  /** Control Account Balance Accuracy - 15% weight */
  controlAccount: number; // 0-100
  /** Accounts Receivable & Payable Validity - 15% weight */
  aging: number;         // 0-100
}

/**
 * Overall readiness status based on composite score.
 */
export type ReadinessStatus = 
  | "READY_FOR_MONTHLY_OPERATIONS"    // 85-100 score
  | "MINOR_FIXES_NEEDED"              // 70-84 score  
  | "ADDITIONAL_CLEANUP_REQUIRED";    // <70 score

/**
 * Business owner summary in plain language.
 */
export interface BusinessOwnerSummary {
  healthScore: string;        // e.g., "78/100 - Almost There"
  whatThisMeans: string;      // Plain English explanation
  keyFindings: string[];      // Major issues in simple terms
  nextSteps: string[];        // Clear actions in business language
}

/**
 * Technical remediation plan for bookkeepers.
 */
export interface BookkeeperReport {
  criticalIssues: CriticalIssue[];
  recommendedImprovements: string[];
  ongoingMaintenance: string[];
}

/**
 * Individual critical issue requiring immediate attention.
 */
export interface CriticalIssue {
  priority: number;           // 1 = highest priority
  pillar: string;            // Which pillar this affects
  issue: string;             // Technical description
  qboLocation: string;       // Exact QBO navigation path
  fixSteps: string;          // Step-by-step remedy
  estimatedTime: string;     // Time estimate (e.g., "1 hr")
}

/**
 * Assessment metadata and transparency information.
 */
export interface AssessmentMetadata {
  assessmentDate: string;     // ISO date string
  dataPeriod: string;        // Date range analyzed
  scoringModel: string;      // "Day-30 Readiness Framework"
  limitations?: string[];    // Any data limitations
}

/**
 * Complete hygiene assessment result.
 */
export interface HygieneAssessmentResult {
  overallScore: number;                    // 0-100 composite score
  pillarScores: HygienePillarScores;      // Individual pillar breakdown
  readinessStatus: ReadinessStatus;       // Overall status
  businessOwnerSummary: BusinessOwnerSummary;
  bookkeeperReport: BookkeeperReport;
  assessmentMetadata: AssessmentMetadata;
}

// =================================================================================
// DATA PACKAGE TYPES
// =================================================================================

/**
 * QBO data package required for hygiene assessment.
 */
export interface QBODataPackage {
  // Core required data
  chartOfAccounts?: QBOChartOfAccount[];
  trialBalance?: QBOTrialBalance;
  generalLedger?: QBOGeneralLedger;
  
  // Aging reports
  arAging?: QBOAgingReport;
  apAging?: QBOAgingReport;
  
  // Control and audit data
  auditLog?: QBOAuditLogEntry[];
  
  // Additional hygiene-specific data (may be limited by API availability)
  bankReconciliation?: QBOBankReconciliation[];
  openingBalanceEquity?: QBOOpeningBalanceEquity;
  undepositedFunds?: QBOUndepositedFundsEntry[];
  
  // Assessment scope
  datePeriod: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
  };
}

// =================================================================================
// QBO DATA STRUCTURE TYPES
// =================================================================================

/**
 * Chart of Accounts entry.
 */
export interface QBOChartOfAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType: string;
  Active: boolean;
  CurrentBalance: number;
  Classification: string;
  ParentRef?: {
    value: string;
    name: string;
  };
}

/**
 * Trial Balance report structure.
 */
export interface QBOTrialBalance {
  Header: {
    ReportName: string;
    StartPeriod: string;
    EndPeriod: string;
  };
  Rows: {
    Row: Array<{
      ColData: Array<{
        value: string;
        id?: string;
      }>;
    }>;
  };
}

/**
 * General Ledger report structure.
 */
export interface QBOGeneralLedger {
  Header: {
    ReportName: string;
    StartPeriod: string;
    EndPeriod: string;
  };
  Rows: {
    Row: Array<{
      ColData: Array<{
        value: string;
        id?: string;
      }>;
      type?: string;
    }>;
  };
}

/**
 * Aging report (A/R or A/P) structure.
 */
export interface QBOAgingReport {
  Header: {
    ReportName: string;
    ReportDate: string;
  };
  Rows: {
    Row: Array<{
      ColData: Array<{
        value: string;
        id?: string;
      }>;
    }>;
  };
}

/**
 * Bank reconciliation data.
 */
export interface QBOBankReconciliation {
  AccountId: string;
  AccountName: string;
  StatementDate: string;
  BeginningBalance: number;
  EndingBalance: number;
  ClearedBalance: number;
  Difference: number;
  LastReconciledDate?: string;
  UnreconciledItems?: Array<{
    TransactionId: string;
    Date: string;
    Amount: number;
    Description: string;
  }>;
}

/**
 * Opening Balance Equity report.
 */
export interface QBOOpeningBalanceEquity {
  AccountId: string;
  CurrentBalance: number;
  Details?: Array<{
    Date: string;
    Amount: number;
    Description: string;
  }>;
}

/**
 * Undeposited Funds entries.
 */
export interface QBOUndepositedFundsEntry {
  TransactionId: string;
  Date: string;
  Amount: number;
  PaymentMethod: string;
  Customer?: string;
  DaysUndeposited: number;
}

/**
 * Audit log entry.
 */
export interface QBOAuditLogEntry {
  EventDate: string;
  User: string;
  Event: string;
  Entity: string;
  EntityId?: string;
  Details: string;
}

// =================================================================================
// UI STATE TYPES  
// =================================================================================

/**
 * Assessment progress tracking.
 */
export interface AssessmentProgress {
  phase: "initializing" | "fetching_data" | "analyzing" | "completed" | "error";
  currentStep: string;
  progress: number; // 0-1
  error?: string;
}

/**
 * Data validation results.
 */
export interface DataValidationResult {
  isComplete: boolean;
  missingData: string[];
  warnings: string[];
  dataQualityScore?: number; // 0-100
}

/**
 * Assessment configuration options.
 */
export interface AssessmentConfig {
  includeDetailedAnalysis: boolean;
  generateRecommendations: boolean;
  businessType?: string;
  customWeights?: Partial<{
    reconciliation: number;
    coaIntegrity: number; 
    categorization: number;
    controlAccount: number;
    aging: number;
  }>;
}

// =================================================================================
// API RESPONSE TYPES
// =================================================================================

/**
 * Response from the hygiene assessment API.
 */
export interface HygieneAssessmentApiResponse {
  success: boolean;
  data?: HygieneAssessmentResult;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    processingTime: number;
    dataSourcesUsed: string[];
    confidence: number; // 0-1
  };
}

/**
 * Saved assessment record.
 */
export interface SavedAssessmentRecord {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  assessment: HygieneAssessmentResult;
  createdAt: string;
  updatedAt: string;
}

// =================================================================================
// UTILITY TYPES
// =================================================================================

/**
 * Type guard to check if a value is a valid ReadinessStatus.
 */
export function isReadinessStatus(value: string): value is ReadinessStatus {
  return ["READY_FOR_MONTHLY_OPERATIONS", "MINOR_FIXES_NEEDED", "ADDITIONAL_CLEANUP_REQUIRED"].includes(value);
}

/**
 * Type guard to check if assessment result is complete.
 */
export function isCompleteAssessment(assessment: any): assessment is HygieneAssessmentResult {
  return assessment && 
    typeof assessment.overallScore === 'number' &&
    assessment.pillarScores &&
    assessment.readinessStatus &&
    assessment.businessOwnerSummary &&
    assessment.bookkeeperReport;
}

/**
 * Helper type for partial updates to assessment results.
 */
export type PartialAssessmentUpdate = Partial<HygieneAssessmentResult>;