/**
 * @file dataFormatter.ts
 * @description Service for formatting QBO financial data for AI hygiene analysis.
 * 
 * Converts fetched financial data into a structured format that can be sent to the
 * Perplexity AI API along with the assessment prompt. Focuses on creating clean,
 * readable data summaries that match the format expected by the AI system.
 */

import { QBOFinancialReports, DateRange } from "./qboApiService";

// =================================================================================
// INTERFACE DEFINITIONS
// =================================================================================

/**
 * Structured summary of financial data for AI analysis.
 * Aligned with the 5-pillar Day-30 Readiness methodology.
 */
export interface FormattedFinancialData {
  summary: DataSummary;
  reports: FormattedReports;
  metadata: DataMetadata;
  // Added: 5-pillar data structure for methodology compliance
  pillarData: {
    reconciliation: ReconciliationPillarData;
    chartOfAccountsIntegrity: COAIntegrityData;
    transactionCategorization: CategorizationData;
    controlAccountAccuracy: ControlAccountData;
    arApValidity: AgingValidityData;
  };
}

/**
 * High-level summary of the data package.
 */
interface DataSummary {
  totalReports: number;
  availableReports: string[];
  missingReports: string[];
  dateRange: DateRange;
  dataQualityScore: number; // 0-100
}

/**
 * Formatted versions of each report type.
 */
interface FormattedReports {
  profitAndLoss?: FormattedReport;
  balanceSheet?: FormattedReport;
  trialBalance?: FormattedReport;
  arAging?: FormattedReport;
  apAging?: FormattedReport;
  generalLedger?: FormattedReport;
  chartOfAccounts?: FormattedAccountList;
  auditLog?: FormattedAuditLog[];
}

/**
 * Standardized format for financial reports.
 */
interface FormattedReport {
  reportName: string;
  reportPeriod: string;
  currency: string;
  dataRows: number;
  keyMetrics?: Record<string, string | number>;
  summary: string;
  rawDataPreview?: string; // First few rows for AI context
}

/**
 * Formatted chart of accounts.
 */
interface FormattedAccountList {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  accountsByType: Record<string, number>;
  duplicateAccountsDetected: number;
  inactiveAccountsWithBalance: number;
  summary: string;
}

/**
 * Formatted audit log entries.
 */
interface FormattedAuditLog {
  date: string;
  user: string;
  action: string;
  entity: string;
  description: string;
}

/**
 * Metadata about the data package.
 */
interface DataMetadata {
  generatedAt: string;
  dataSource: "qbo_api" | "manual_upload";
  assessmentScope: "3_months" | "custom";
  limitations: string[];
  warnings: string[];
  // Added: Methodology compliance tracking
  methodologyVersion: string;
  dataQualityFlags: string[];
  criticalDataMissing: boolean;
}

// Added: Pillar-specific data structures for methodology alignment
interface ReconciliationPillarData {
  bankAccountCount: number;
  creditCardAccountCount: number;
  lastReconciliationDates: Record<string, string>;
  unreconciledBalances: Record<string, number>;
  outstandingItemsCount: number;
}

interface COAIntegrityData {
  totalAccounts: number;
  duplicateAccounts: string[];
  inactiveAccountsWithBalances: any[];
  accountStructureCompliance: boolean;
  gaapComplianceScore: number;
}

interface CategorizationData {
  uncategorizedTransactionCount: number;
  uncategorizedAmount: number;
  missingVendorAssignments: number;
  missingCustomerAssignments: number;
}

interface ControlAccountData {
  openingBalanceEquityAmount: number;
  undepositedFundsAging: any[];
  payrollLiabilityIssues: any[];
  controlAccountDiscrepancies: any[];
}

interface AgingValidityData {
  arItemsOver90Days: number;
  apItemsOver90Days: number;
  unusualCreditBalances: any[];
  agingAccuracy: number;
}

// =================================================================================
// DATA FORMATTER SERVICE CLASS
// =================================================================================

export class DataFormatterService {
  
  /**
   * Formats QBO financial data into a structure suitable for AI analysis.
   * Implements the 5-pillar Day-30 Readiness methodology data structure.
   */
  public static formatForAIAnalysis(
    data: any,
    dateRange: DateRange,
    customerName?: string
  ): FormattedFinancialData {
    const availableReports: string[] = [];
    const missingReports: string[] = [];
    const expectedReports = [
      "profitAndLoss",
      "balanceSheet", 
      "trialBalance",
      "arAging",
      "apAging",
      "generalLedger",
      "chartOfAccounts"
    ];

    // Check which reports are available
    expectedReports.forEach(reportType => {
      if (data[reportType] && data[reportType] !== null) {
        availableReports.push(reportType);
      } else {
        missingReports.push(reportType);
      }
    });

    // Calculate data quality score
    const dataQualityScore = Math.round((availableReports.length / expectedReports.length) * 100);

    const formattedData: FormattedFinancialData = {
      summary: {
        totalReports: availableReports.length,
        availableReports,
        missingReports,
        dateRange,
        dataQualityScore
      },
      reports: {
        profitAndLoss: data.profitAndLoss ? this.formatFinancialReport(
          data.profitAndLoss, 
          "Profit & Loss Statement"
        ) : undefined,
        balanceSheet: data.balanceSheet ? this.formatFinancialReport(
          data.balanceSheet,
          "Balance Sheet"
        ) : undefined,
        trialBalance: data.trialBalance ? this.formatFinancialReport(
          data.trialBalance,
          "Trial Balance"
        ) : undefined,
        arAging: data.arAging ? this.formatFinancialReport(
          data.arAging,
          "Accounts Receivable Aging"
        ) : undefined,
        apAging: data.apAging ? this.formatFinancialReport(
          data.apAging,
          "Accounts Payable Aging"
        ) : undefined,
        generalLedger: data.generalLedger ? this.formatFinancialReport(
          data.generalLedger,
          "General Ledger"
        ) : undefined,
        chartOfAccounts: data.chartOfAccounts ? this.formatChartOfAccounts(
          data.chartOfAccounts
        ) : undefined,
        auditLog: data.auditLog ? this.formatAuditLog(data.auditLog) : undefined
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataSource: "qbo_api",
        assessmentScope: "3_months",
        limitations: missingReports.length > 0 ? 
          [`Missing reports: ${missingReports.join(", ")}`] : [],
        warnings: this.generateDataWarnings(data, availableReports),
        methodologyVersion: "Day-30 Readiness v1.0",
        dataQualityFlags: this.assessDataQuality(data),
        criticalDataMissing: missingReports.some(report => 
          ['profitAndLoss', 'balanceSheet', 'trialBalance', 'chartOfAccounts'].includes(report)
        )
      },
      // Added: 5-pillar structured data extraction
      pillarData: {
        reconciliation: this.extractReconciliationData(data),
        chartOfAccountsIntegrity: this.extractCOAIntegrityData(data),
        transactionCategorization: this.extractCategorizationData(data),
        controlAccountAccuracy: this.extractControlAccountData(data),
        arApValidity: this.extractAgingValidityData(data)
      }
    };

    return formattedData;
  }

  /**
   * Converts formatted data to a user-readable text format for the AI API.
   */
  public static toUserMessage(formattedData: FormattedFinancialData): string {
    const sections: string[] = [];

    // Header
    sections.push("=== QUICKBOOKS ONLINE FINANCIAL DATA FOR HYGIENE ASSESSMENT ===");
    sections.push("");

    // Data Summary
    sections.push("DATA SUMMARY:");
    sections.push(`Assessment Period: ${formattedData.summary.dateRange.startDate} to ${formattedData.summary.dateRange.endDate}`);
    sections.push(`Reports Available: ${formattedData.summary.totalReports} out of 7 possible`);
    sections.push(`Data Quality Score: ${formattedData.summary.dataQualityScore}%`);
    sections.push("");

    // Individual Reports
    const reports = formattedData.reports;
    
    if (reports.profitAndLoss) {
      sections.push("PROFIT & LOSS REPORT:");
      sections.push(`Report Period: ${reports.profitAndLoss.reportPeriod}`);
      sections.push(`Currency: ${reports.profitAndLoss.currency}`);
      sections.push(`Data Rows: ${reports.profitAndLoss.dataRows}`);
      if (reports.profitAndLoss.rawDataPreview) {
        sections.push("Key Data Preview:");
        sections.push(reports.profitAndLoss.rawDataPreview);
      }
      sections.push("");
    }

    if (reports.balanceSheet) {
      sections.push("BALANCE SHEET:");
      sections.push(`Report Period: ${reports.balanceSheet.reportPeriod}`);
      sections.push(`Currency: ${reports.balanceSheet.currency}`);
      sections.push(`Data Rows: ${reports.balanceSheet.dataRows}`);
      if (reports.balanceSheet.rawDataPreview) {
        sections.push("Key Data Preview:");
        sections.push(reports.balanceSheet.rawDataPreview);
      }
      sections.push("");
    }

    if (reports.trialBalance) {
      sections.push("TRIAL BALANCE:");
      sections.push(`Report Period: ${reports.trialBalance.reportPeriod}`);
      sections.push(`Data Rows: ${reports.trialBalance.dataRows}`);
      if (reports.trialBalance.rawDataPreview) {
        sections.push("Key Data Preview:");
        sections.push(reports.trialBalance.rawDataPreview);
      }
      sections.push("");
    }

    if (reports.arAging) {
      sections.push("A/R AGING REPORT:");
      sections.push(`Report Date: ${reports.arAging.reportPeriod}`);
      sections.push(`Data Rows: ${reports.arAging.dataRows}`);
      if (reports.arAging.rawDataPreview) {
        sections.push("Aging Data Preview:");
        sections.push(reports.arAging.rawDataPreview);
      }
      sections.push("");
    }

    if (reports.apAging) {
      sections.push("A/P AGING REPORT:");
      sections.push(`Report Date: ${reports.apAging.reportPeriod}`);
      sections.push(`Data Rows: ${reports.apAging.dataRows}`);
      if (reports.apAging.rawDataPreview) {
        sections.push("Aging Data Preview:");
        sections.push(reports.apAging.rawDataPreview);
      }
      sections.push("");
    }

    if (reports.chartOfAccounts) {
      sections.push("CHART OF ACCOUNTS:");
      sections.push(`Total Accounts: ${reports.chartOfAccounts.totalAccounts}`);
      sections.push(`Active Accounts: ${reports.chartOfAccounts.activeAccounts}`);
      sections.push(`Inactive Accounts: ${reports.chartOfAccounts.inactiveAccounts}`);
      sections.push(`Duplicate Accounts Detected: ${reports.chartOfAccounts.duplicateAccountsDetected}`);
      sections.push(`Inactive Accounts with Balances: ${reports.chartOfAccounts.inactiveAccountsWithBalance}`);
      sections.push("Account Distribution:");
      Object.entries(reports.chartOfAccounts.accountsByType).forEach(([type, count]) => {
        sections.push(`  ${type}: ${count} accounts`);
      });
      sections.push("");
    }

    if (reports.auditLog && reports.auditLog.length > 0) {
      sections.push("AUDIT LOG (Recent Activity):");
      sections.push(`Total Entries: ${reports.auditLog.length}`);
      sections.push("Sample Entries:");
      reports.auditLog.slice(0, 10).forEach(entry => {
        sections.push(`  ${entry.date} | ${entry.user} | ${entry.action} | ${entry.description}`);
      });
      sections.push("");
    }

    // Data Quality Assessment
    sections.push("DATA COMPLETENESS OVERVIEW:");
    sections.push(`Reports Successfully Fetched: ${formattedData.summary.availableReports.length}`);
    if (formattedData.summary.missingReports.length > 0) {
      sections.push(`Missing Reports: ${formattedData.summary.missingReports.join(", ")}`);
    }
    sections.push("");

    // Limitations and Warnings
    if (formattedData.metadata.limitations.length > 0) {
      sections.push("ASSESSMENT LIMITATIONS:");
      formattedData.metadata.limitations.forEach(limitation => {
        sections.push(`• ${limitation}`);
      });
      sections.push("");
    }

    if (formattedData.metadata.warnings.length > 0) {
      sections.push("DATA QUALITY WARNINGS:");
      formattedData.metadata.warnings.forEach(warning => {
        sections.push(`• ${warning}`);
      });
      sections.push("");
    }

    // Added: Pillar-specific data summary for AI analysis
    sections.push("5-PILLAR ASSESSMENT DATA:");
    if (formattedData.pillarData) {
      sections.push(`Reconciliation Data: ${formattedData.pillarData.reconciliation.bankAccountCount} bank accounts`);
      sections.push(`COA Integrity: ${formattedData.pillarData.chartOfAccountsIntegrity.totalAccounts} total accounts, ${formattedData.pillarData.chartOfAccountsIntegrity.duplicateAccounts.length} duplicates`);
      sections.push(`Categorization: ${formattedData.pillarData.transactionCategorization.uncategorizedTransactionCount} uncategorized transactions`);
      sections.push(`Control Accounts: OBE balance $${formattedData.pillarData.controlAccountAccuracy.openingBalanceEquityAmount}`);
      sections.push(`A/R A/P Validity: ${formattedData.pillarData.arApValidity.arItemsOver90Days} AR items > 90 days`);
      sections.push("");
    }
    
    sections.push("Please analyze this QuickBooks Online data using the Day-30 Readiness Scoring Model and provide a complete hygiene assessment with specific scores for each pillar, actionable recommendations, and dual-audience reporting as specified in the system prompt.");

    return sections.join("\n");
  }

  /**
   * Formats a generic QBO financial report.
   */
  private static formatFinancialReport(report: any, reportName: string): FormattedReport {
    const header = report.Header || {};
    const rows = report.Rows?.Row || [];
    
    // Extract key data for preview
    let rawDataPreview = "";
    if (rows.length > 0) {
      rawDataPreview = "Sample data rows:\n";
      rows.slice(0, 5).forEach((row: any, index: number) => {
        if (row.ColData && Array.isArray(row.ColData)) {
          const values = row.ColData.map((col: any) => col.value || "").join(" | ");
          rawDataPreview += `Row ${index + 1}: ${values}\n`;
        }
      });
    }

    return {
      reportName,
      reportPeriod: header.StartPeriod && header.EndPeriod ? 
        `${header.StartPeriod} to ${header.EndPeriod}` : 
        header.ReportDate || "Unknown",
      currency: header.Currency || "USD",
      dataRows: rows.length,
      summary: `${reportName} contains ${rows.length} data rows covering the specified period.`,
      rawDataPreview: rawDataPreview || undefined
    };
  }

  /**
   * Formats chart of accounts data.
   */
  private static formatChartOfAccounts(accounts: any[]): FormattedAccountList {
    if (!Array.isArray(accounts)) {
      return {
        totalAccounts: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
        accountsByType: {},
        duplicateAccountsDetected: 0,
        inactiveAccountsWithBalance: 0,
        summary: "Chart of accounts data is not available or malformed."
      };
    }

    const activeAccounts = accounts.filter(acc => acc.Active === true).length;
    const inactiveAccounts = accounts.filter(acc => acc.Active === false).length;
    const inactiveAccountsWithBalance = accounts.filter(acc => 
      acc.Active === false && acc.CurrentBalance !== 0
    ).length;

    // Group by account type
    const accountsByType: Record<string, number> = {};
    accounts.forEach(account => {
      const type = account.AccountType || "Unknown";
      accountsByType[type] = (accountsByType[type] || 0) + 1;
    });

    // Detect potential duplicates (simple name-based check)
    const accountNames = accounts.map(acc => acc.Name?.toLowerCase().trim());
    const duplicateNames = accountNames.filter((name, index) => 
      name && accountNames.indexOf(name) !== index
    );
    const duplicateAccountsDetected = new Set(duplicateNames).size;

    return {
      totalAccounts: accounts.length,
      activeAccounts,
      inactiveAccounts,
      accountsByType,
      duplicateAccountsDetected,
      inactiveAccountsWithBalance,
      summary: `Chart of accounts contains ${accounts.length} total accounts (${activeAccounts} active, ${inactiveAccounts} inactive). ${duplicateAccountsDetected} potential duplicate accounts detected. ${inactiveAccountsWithBalance} inactive accounts have non-zero balances.`
    };
  }

  /**
   * Formats audit log entries.
   */
  private static formatAuditLog(auditLog: any[]): FormattedAuditLog[] {
    if (!Array.isArray(auditLog)) {
      return [];
    }

    return auditLog.slice(0, 100).map(entry => ({ // Limit to last 100 entries
      date: entry.EventDate || "Unknown",
      user: entry.User || "Unknown",
      action: entry.Event || "Unknown",
      entity: entry.Entity || "Unknown",
      description: entry.Details || "No details available"
    }));
  }

  /**
   * Extracts reconciliation pillar data for methodology compliance.
   */
  private static extractReconciliationData(data: any): ReconciliationPillarData {
    const reconciliationAssessment = data.reconciliationAssessment;
    return {
      bankAccountCount: reconciliationAssessment?.totalAccounts || 0,
      creditCardAccountCount: 0, // To be calculated from account types
      lastReconciliationDates: {},
      unreconciledBalances: {},
      outstandingItemsCount: reconciliationAssessment?.criticalAccounts || 0
    };
  }

  /**
   * Extracts Chart of Accounts integrity data.
   */
  private static extractCOAIntegrityData(data: any): COAIntegrityData {
    const accounts = data.chartOfAccounts || [];
    const inactiveWithBalance = accounts.filter((acc: any) => 
      !acc.Active && acc.CurrentBalance !== 0
    );
    
    return {
      totalAccounts: accounts.length,
      duplicateAccounts: this.findDuplicateAccounts(accounts),
      inactiveAccountsWithBalances: inactiveWithBalance,
      accountStructureCompliance: accounts.length > 0,
      gaapComplianceScore: this.calculateGAAPCompliance(accounts)
    };
  }

  /**
   * Extracts transaction categorization data.
   */
  private static extractCategorizationData(data: any): CategorizationData {
    const generalLedger = data.generalLedger;
    return {
      uncategorizedTransactionCount: 0, // To be extracted from GL analysis
      uncategorizedAmount: 0,
      missingVendorAssignments: 0,
      missingCustomerAssignments: 0
    };
  }

  /**
   * Extracts control account accuracy data.
   */
  private static extractControlAccountData(data: any): ControlAccountData {
    return {
      openingBalanceEquityAmount: data.openingBalanceEquity?.amount || 0,
      undepositedFundsAging: data.undepositedFunds || [],
      payrollLiabilityIssues: [],
      controlAccountDiscrepancies: []
    };
  }

  /**
   * Extracts A/R and A/P validity data.
   */
  private static extractAgingValidityData(data: any): AgingValidityData {
    return {
      arItemsOver90Days: this.countAgingItems(data.arAging, 90),
      apItemsOver90Days: this.countAgingItems(data.apAging, 90),
      unusualCreditBalances: [],
      agingAccuracy: 100 // To be calculated
    };
  }

  /**
   * Helper method to find duplicate accounts.
   */
  private static findDuplicateAccounts(accounts: any[]): string[] {
    const names = accounts.map(acc => acc.Name?.toLowerCase().trim());
    const duplicates = names.filter((name, index) => 
      name && names.indexOf(name) !== index
    );
    return [...new Set(duplicates)];
  }

  /**
   * Helper method to calculate GAAP compliance score.
   */
  private static calculateGAAPCompliance(accounts: any[]): number {
    // Simplified GAAP compliance check
    const requiredTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Expense'];
    const presentTypes = [...new Set(accounts.map(acc => acc.AccountType))];
    return Math.round((presentTypes.length / requiredTypes.length) * 100);
  }

  /**
   * Helper method to count aging items over specified days.
   */
  private static countAgingItems(agingReport: any, days: number): number {
    if (!agingReport?.Rows?.Row) return 0;
    // Simplified aging analysis - would need specific QBO aging report structure
    return 0;
  }

  /**
   * Assesses overall data quality for methodology compliance.
   */
  private static assessDataQuality(data: any): string[] {
    const flags: string[] = [];
    
    // Check for critical data completeness
    if (!data.chartOfAccounts || data.chartOfAccounts.length === 0) {
      flags.push('MISSING_CHART_OF_ACCOUNTS');
    }
    if (!data.trialBalance) {
      flags.push('MISSING_TRIAL_BALANCE');
    }
    if (!data.generalLedger) {
      flags.push('MISSING_GENERAL_LEDGER');
    }
    
    return flags;
  }

  /**
   * Generates data quality warnings.
   */
  private static generateDataWarnings(data: any, availableReports: string[]): string[] {
    const warnings: string[] = [];

    // Check for missing critical reports
    if (!availableReports.includes("chartOfAccounts")) {
      warnings.push("Chart of Accounts not available - account structure analysis will be limited");
    }
    if (!availableReports.includes("trialBalance")) {
      warnings.push("Trial Balance not available - balance verification will be limited");
    }
    if (!availableReports.includes("profitAndLoss")) {
      warnings.push("Profit & Loss report not available");
    }

    // Check for empty reports
    availableReports.forEach(reportType => {
      const report = data[reportType];
      if (report && report.Rows && (!report.Rows.Row || report.Rows.Row.length === 0)) {
        warnings.push(`${reportType} report contains no data rows`);
      }
    });

    return warnings;
  }
}