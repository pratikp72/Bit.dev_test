/**
 * @file rawDataFormatter.ts
 * @description Formats QuickBooks financial data into structured raw data format
 * for LLM scoring using the Day-30 Readiness Assessment methodology.
 *
 * This formatter provides raw data only - no pre-calculated scores.
 * The LLM will perform all scoring calculations using the custom prompt.
 */

import { logger } from "../lib/logger";

// Raw data interfaces for 5-pillar assessment
export interface RawReconciliationData {
  bankAccounts: Array<{
    accountId: string;
    accountName: string;
    accountType: string;
    lastReconciledDate: string | null;
    daysSinceLastReconciliation: number | null;
    unreconciledDifference: number;
    outstandingItems: {
      over30Days: { count: number; totalAmount: number };
      over60Days: { count: number; totalAmount: number };
      over90Days: { count: number; totalAmount: number };
    };
  }>;
  totalBankAccounts: number;
}

export interface RawChartOfAccountsData {
  accounts: Array<{
    accountId: string;
    accountName: string;
    accountNumber?: string;
    accountType: string;
    accountSubType: string;
    active: boolean;
    currentBalance: number;
    lastActivity?: string;
  }>;
  duplicateAccountNames: string[];
  inactiveAccountsWithBalance: Array<{
    accountName: string;
    balance: number;
  }>;
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
}

export interface RawCategorizationData {
  uncategorizedTransactions: Array<{
    accountName: string;
    accountId: string;
    transactionCount: number;
    totalAmount: number;
  }>;
  uncategorizedBalance: number;
  uncategorizedCount: number;
  missingVendorCustomer: number;
}

export interface RawControlAccountsData {
  openingBalanceEquity: {
    balance: number;
    accountExists: boolean;
    accountId?: string;
    lastModified?: string;
  };
  undepositedFunds: {
    balance: number;
    accountExists: boolean;
    accountId?: string;
    agingAnalysis: {
      current: number;
      over30Days: number;
      over60Days: number;
      over90Days: number;
    };
    transactionCount: number;
  };
  payrollLiabilities: Array<{
    id: string;
    name: string;
    balance: number;
    subType: string;
  }>;
}

export interface RawARAP_Data {
  accountsReceivable: {
    totalAR: number;
    agingBuckets: {
      current: number;
      over30: number;
      over60: number;
      over90: number;
    };
    itemsOver90Days: Array<{
      customerId?: string;
      customerName: string;
      amount: number;
      daysOutstanding: number;
    }>;
    creditBalances: Array<{
      customerName: string;
      amount: number;
    }>;
  };
  accountsPayable: {
    totalAP: number;
    agingBuckets: {
      current: number;
      over30: number;
      over60: number;
      over90: number;
    };
    itemsOver90Days: Array<{
      vendorId?: string;
      vendorName: string;
      amount: number;
      daysOutstanding: number;
    }>;
    creditBalances: Array<{
      vendorName: string;
      amount: number;
    }>;
  };
}

export interface FivePillarRawData {
  // PILLAR 1: RECONCILIATION ASSESSMENT (30% Weight)
  reconciliation: RawReconciliationData;

  // PILLAR 2: CHART OF ACCOUNTS INTEGRITY (20% Weight)
  chartOfAccounts: RawChartOfAccountsData;

  // PILLAR 3: TRANSACTION CATEGORIZATION (20% Weight)
  categorization: RawCategorizationData;

  // PILLAR 4: CONTROL ACCOUNT ACCURACY (15% Weight)
  controlAccounts: RawControlAccountsData;

  // PILLAR 5: A/R & A/P VALIDITY (15% Weight)
  arApValidity: RawARAP_Data;

  // Metadata
  assessmentMetadata: {
    assessmentDate: string;
    datePeriodAnalyzed: {
      startDate: string;
      endDate: string;
    };
    dataCompleteness: {
      reconciliationDataAvailable: boolean;
      chartOfAccountsAvailable: boolean;
      categorizationDataAvailable: boolean;
      controlAccountsAvailable: boolean;
      arApDataAvailable: boolean;
      missingReports: string[];
    };
  };
}

export class RawDataFormatter {
  /**
   * Formats comprehensive financial data into 5-pillar raw data structure
   * for LLM analysis using Day-30 Readiness Assessment methodology.
   */
  static formatForLLMScoring(hygieneData: any): FivePillarRawData {
    logger.debug("Formatting raw financial data for LLM 5-pillar assessment");

    try {
      // Extract and format each pillar's raw data
      const reconciliation = this.formatReconciliationData(hygieneData);
      const chartOfAccounts = this.formatChartOfAccountsData(hygieneData);
      const categorization = this.formatCategorizationData(hygieneData);
      const controlAccounts = this.formatControlAccountsData(hygieneData);
      const arApValidity = this.formatARAP_Data(hygieneData);

      const rawData: FivePillarRawData = {
        reconciliation,
        chartOfAccounts,
        categorization,
        controlAccounts,
        arApValidity,
        assessmentMetadata: {
          assessmentDate: new Date().toISOString(),
          datePeriodAnalyzed: hygieneData.datePeriod || {
            startDate: "Unknown",
            endDate: "Unknown",
          },
          dataCompleteness: {
            reconciliationDataAvailable: !!hygieneData.reconciliationAssessment,
            chartOfAccountsAvailable: !!hygieneData.chartOfAccounts,
            categorizationDataAvailable: !!hygieneData.categorizationAnalysis,
            controlAccountsAvailable: !!hygieneData.controlAccountsAnalysis,
            arApDataAvailable: !!(hygieneData.arAging && hygieneData.apAging),
            missingReports: this.identifyMissingReports(hygieneData),
          },
        },
      };

      logger.info("Raw data formatting completed successfully", {
        reconAccounts: reconciliation.totalBankAccounts,
        totalAccounts: chartOfAccounts.totalAccounts,
        uncategorizedBalance: categorization.uncategorizedBalance,
        obeBalance: controlAccounts.openingBalanceEquity.balance,
        arTotal: arApValidity.accountsReceivable.totalAR,
      });

      return rawData;
    } catch (error) {
      logger.error("Failed to format raw data for LLM", error);
      throw new Error(
        `Raw data formatting failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private static formatReconciliationData(data: any): RawReconciliationData {
    const reconciliationData = data.reconciliationAssessment;
    if (!reconciliationData?.assessments && !data.chartOfAccounts) {
      return {
        bankAccounts: [],
        totalBankAccounts: 0,
      };
    }

    let bankAccounts: any[] = [];

    // If we have reconciliation assessment data, use it
    if (reconciliationData?.assessments) {
      bankAccounts = reconciliationData.assessments.map((account: any) => ({
        accountId: account.accountId,
        accountName: account.accountName,
        accountType: account.accountType || "Bank",
        lastReconciledDate: account.lastReconciledDate,
        daysSinceLastReconciliation: account.daysSinceLastReconciliation,
        unreconciledDifference: account.unreconciledDifference || 0,
        outstandingItems: {
          over30Days: account.outstandingItems?.thirtyDays || {
            count: 0,
            totalAmount: 0,
          },
          over60Days: account.outstandingItems?.sixtyDays || {
            count: 0,
            totalAmount: 0,
          },
          over90Days: account.outstandingItems?.ninetyDays || {
            count: 0,
            totalAmount: 0,
          },
        },
      }));
    }
    // Fallback: Extract bank accounts from Chart of Accounts if reconciliation data is missing
    else if (data.chartOfAccounts) {
      bankAccounts = data.chartOfAccounts
        .filter(
          (account: any) =>
            account.AccountType === "Bank" ||
            account.AccountSubType === "CashOnHand" ||
            account.AccountSubType === "Checking" ||
            account.AccountSubType === "Savings" ||
            account.AccountSubType === "MoneyMarket" ||
            account.AccountSubType === "CreditCard",
        )
        .map((account: any) => ({
          accountId: account.Id,
          accountName: account.Name,
          accountType: account.AccountType,
          lastReconciledDate: null, // Unknown without reconciliation data
          daysSinceLastReconciliation: null,
          unreconciledDifference: 0, // Unknown
          outstandingItems: {
            over30Days: { count: 0, totalAmount: 0 },
            over60Days: { count: 0, totalAmount: 0 },
            over90Days: { count: 0, totalAmount: 0 },
          },
        }));
    }

    return {
      bankAccounts,
      totalBankAccounts: bankAccounts.length,
    };
  }

  private static formatChartOfAccountsData(data: any): RawChartOfAccountsData {
    const chartData = data.chartOfAccounts;
    const integrityData = data.chartIntegrityAnalysis;

    if (!chartData || !Array.isArray(chartData)) {
      logger.warn("Chart of Accounts data is missing or invalid");
      return {
        accounts: [],
        duplicateAccountNames: [],
        inactiveAccountsWithBalance: [],
        totalAccounts: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
      };
    }

    try {
      const accounts = chartData.map((account: any) => ({
        accountId: account.Id || "unknown",
        accountName: account.Name || "Unknown Account",
        accountNumber: account.AcctNum,
        accountType: account.AccountType || "Unknown",
        accountSubType: account.AccountSubType || "Unknown",
        active: account.Active !== false, // Default to true if not specified
        currentBalance: parseFloat(account.CurrentBalance) || 0,
        lastActivity: account.MetaData?.LastUpdatedTime,
      }));

      const activeAccounts = accounts.filter((acc: any) => acc.active).length;
      const inactiveAccounts = accounts.length - activeAccounts;

      // Detect duplicate account names
      const accountNames = accounts.map((acc) => acc.accountName.toLowerCase());
      const duplicateNames = accountNames.filter(
        (name, index) =>
          accountNames.indexOf(name) !== index && name !== "unknown account",
      );

      return {
        accounts,
        duplicateAccountNames: [...new Set(duplicateNames)],
        inactiveAccountsWithBalance: accounts
          .filter(
            (acc: any) => !acc.active && Math.abs(acc.currentBalance) > 0.01,
          ) // Ignore tiny balances
          .map((acc: any) => ({
            accountName: acc.accountName,
            balance: acc.currentBalance,
          })),
        totalAccounts: accounts.length,
        activeAccounts,
        inactiveAccounts,
      };
    } catch (error) {
      logger.error("Failed to format Chart of Accounts data", error);
      return {
        accounts: [],
        duplicateAccountNames: [],
        inactiveAccountsWithBalance: [],
        totalAccounts: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
      };
    }
  }

  private static formatCategorizationData(data: any): RawCategorizationData {
    const categorizationData = data.categorizationAnalysis;

    if (!categorizationData) {
      return {
        uncategorizedTransactions: [],
        uncategorizedBalance: 0,
        uncategorizedCount: 0,
        missingVendorCustomer: 0,
      };
    }

    return {
      uncategorizedTransactions: categorizationData.generalAccountUsage || [],
      uncategorizedBalance: categorizationData.uncategorizedBalance || 0,
      uncategorizedCount: categorizationData.uncategorizedCount || 0,
      missingVendorCustomer: categorizationData.missingVendorCustomer || 0,
    };
  }

  private static formatControlAccountsData(data: any): RawControlAccountsData {
    const controlData = data.controlAccountsAnalysis;
    const chartOfAccounts = data.chartOfAccounts;

    // Initialize default structure
    let openingBalanceEquity = { balance: 0, accountExists: false };
    let undepositedFunds = {
      balance: 0,
      accountExists: false,
      agingAnalysis: {
        current: 0,
        over30Days: 0,
        over60Days: 0,
        over90Days: 0,
      },
      transactionCount: 0,
    };
    let payrollLiabilities: any[] = [];

    // If we have control account analysis data, use it
    if (controlData) {
      openingBalanceEquity = controlData.openingBalanceEquity;
      undepositedFunds = controlData.undepositedFunds;
      payrollLiabilities = controlData.payrollLiabilities || [];
    }
    // Fallback: Extract control account information from Chart of Accounts
    else if (chartOfAccounts) {
      // Look for Opening Balance Equity account
      const obeAccount = chartOfAccounts.find(
        (account: any) =>
          account.Name?.toLowerCase().includes("opening balance equity") ||
          account.AccountSubType === "OpeningBalanceEquity",
      );

      if (obeAccount) {
        openingBalanceEquity = {
          balance: obeAccount.CurrentBalance || 0,
          accountExists: true,
        };
      }

      // Look for Undeposited Funds account
      const undepositedAccount = chartOfAccounts.find(
        (account: any) =>
          account.Name?.toLowerCase().includes("undeposited funds") ||
          account.AccountSubType === "UndepositedFunds",
      );

      if (undepositedAccount) {
        undepositedFunds = {
          balance: undepositedAccount.CurrentBalance || 0,
          accountExists: true,
          agingAnalysis: {
            current: 0,
            over30Days: 0,
            over60Days: 0,
            over90Days: 0,
          }, // Would need transaction-level data
          transactionCount: 0, // Would need transaction-level data
        };
      }

      // Look for Payroll Liability accounts
      payrollLiabilities = chartOfAccounts
        .filter(
          (account: any) =>
            account.AccountType === "Other Current Liability" &&
            (account.Name?.toLowerCase().includes("payroll") ||
              account.Name?.toLowerCase().includes("tax") ||
              account.AccountSubType === "PayrollTaxPayable"),
        )
        .map((account: any) => ({
          id: account.Id,
          name: account.Name,
          balance: account.CurrentBalance || 0,
          subType: account.AccountSubType,
        }));
    }

    return {
      openingBalanceEquity,
      undepositedFunds,
      payrollLiabilities,
    };
  }

  private static formatARAP_Data(data: any): RawARAP_Data {
    const arData = data.arAging;
    const apData = data.apAging;

    return {
      accountsReceivable: this.parseAgingReport(arData, "receivable"),
      accountsPayable: this.parseAgingReport(apData, "payable"),
    };
  }

  private static parseAgingReport(
    agingData: any,
    type: "receivable" | "payable",
  ): any {
    if (!agingData?.Rows?.Row) {
      return type === "receivable"
        ? {
            totalAR: 0,
            agingBuckets: { current: 0, over30: 0, over60: 0, over90: 0 },
            itemsOver90Days: [],
            creditBalances: [],
          }
        : {
            totalAP: 0,
            agingBuckets: { current: 0, over30: 0, over60: 0, over90: 0 },
            itemsOver90Days: [],
            creditBalances: [],
          };
    }

    const rows = agingData.Rows.Row;
    let total = 0;
    let currentAmount = 0;
    let over30Amount = 0;
    let over60Amount = 0;
    let over90Amount = 0;
    const itemsOver90Days: any[] = [];
    const creditBalances: any[] = [];

    rows.forEach((row: any) => {
      const cols = row.ColData || [];
      if (cols.length >= 5) {
        // Ensure we have enough columns for aging buckets
        const name = cols[0]?.value || "Unknown";

        // Skip header rows and total rows
        if (
          !name ||
          name.includes("TOTAL") ||
          name.includes("Total") ||
          row.type === "Section"
        ) {
          return;
        }

        try {
          // QBO aging reports typically have columns: Name, Current, 1-30, 31-60, 61-90, 91+, Total
          const current = parseFloat(
            cols[1]?.value?.replace(/[$,()]/g, "") || "0",
          );
          const thirtyDays = parseFloat(
            cols[2]?.value?.replace(/[$,()]/g, "") || "0",
          );
          const sixtyDays = parseFloat(
            cols[3]?.value?.replace(/[$,()]/g, "") || "0",
          );
          const ninetyDays = parseFloat(
            cols[4]?.value?.replace(/[$,()]/g, "") || "0",
          );
          const over90Days = parseFloat(
            cols[5]?.value?.replace(/[$,()]/g, "") || "0",
          );
          const totalAmount = parseFloat(
            cols[cols.length - 1]?.value?.replace(/[$,()]/g, "") || "0",
          );

          // Handle parentheses as negative values
          const adjustCurrent = cols[1]?.value?.includes("(")
            ? -current
            : current;
          const adjustThirty = cols[2]?.value?.includes("(")
            ? -thirtyDays
            : thirtyDays;
          const adjustSixty = cols[3]?.value?.includes("(")
            ? -sixtyDays
            : sixtyDays;
          const adjustNinety = cols[4]?.value?.includes("(")
            ? -ninetyDays
            : ninetyDays;
          const adjustOver90 = cols[5]?.value?.includes("(")
            ? -over90Days
            : over90Days;
          const adjustTotal = cols[cols.length - 1]?.value?.includes("(")
            ? -totalAmount
            : totalAmount;

          currentAmount += adjustCurrent;
          over30Amount += adjustThirty;
          over60Amount += adjustSixty;
          over90Amount += adjustNinety + adjustOver90;
          total += Math.abs(adjustTotal);

          // Track items over 90 days
          if (adjustOver90 > 0) {
            itemsOver90Days.push({
              [type === "receivable" ? "customerName" : "vendorName"]: name,
              amount: adjustOver90,
              daysOutstanding: 95, // Estimate mid-range
            });
          }

          // Track credit balances (negative amounts)
          if (adjustTotal < 0) {
            creditBalances.push({
              [type === "receivable" ? "customerName" : "vendorName"]: name,
              amount: Math.abs(adjustTotal),
            });
          }
        } catch (error) {
          logger.warn(`Failed to parse aging report row for ${name}`, error);
        }
      }
    });

    const result = {
      [`total${type === "receivable" ? "AR" : "AP"}`]: total,
      agingBuckets: {
        current: currentAmount,
        over30: over30Amount,
        over60: over60Amount,
        over90: over90Amount,
      },
      itemsOver90Days,
      creditBalances,
    };

    return result;
  }

  private static identifyMissingReports(data: any): string[] {
    const missingReports: string[] = [];

    if (!data.reconciliationAssessment)
      missingReports.push("Bank Reconciliation Data");
    if (!data.chartOfAccounts) missingReports.push("Chart of Accounts");
    if (!data.generalLedger) missingReports.push("General Ledger");
    if (!data.trialBalance) missingReports.push("Trial Balance");
    if (!data.arAging) missingReports.push("A/R Aging Report");
    if (!data.apAging) missingReports.push("A/P Aging Report");

    return missingReports;
  }
}

export default RawDataFormatter;
