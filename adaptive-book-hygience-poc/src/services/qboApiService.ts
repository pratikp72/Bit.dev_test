import { logger } from "../lib/logger";
import { QBOTokenService, StoredQBOTokens, OAuthTokenError, OAuthErrorType } from './qboTokenService';

/**
 * @file qboApiService.ts
 * @description Service for interacting with the QuickBooks Online API via a proxy.
 *
 * This service class abstracts the complexities of making API calls to QuickBooks Online,
 * including rate limiting, error handling, and data transformation. It is designed to be
 * used with a server-side proxy that securely handles OAuth tokens and forwards
 * requests to the QBO API.
 *
 * Key Features:
 * - Rate Limiting: Implements a queue-based rate limiter to avoid hitting QBO API limits.
 * - Error Handling: Provides a custom QBOError class for structured error information.
 * - Authentication: Manages access token and realm ID for API requests.
 * - Data Fetching: Offers methods for fetching common QBO reports and data entities.
 * - Type Safety: Includes comprehensive TypeScript interfaces for API responses.
 */

// =================================================================================
// TYPE DEFINITIONS & INTERFACES
// =================================================================================

/**
 * Callback function for tracking progress of long-running operations.
 * @param progress - A number between 0 and 1 representing completion percentage.
 */
export type ProgressCallback = (progress: number) => void;

/**
 * Interface for detailed progress tracking.
 */
interface FetchProgress {
  total: number;
  completed: number;
  label: string;
  error?: string;
}

/**
 * Represents a date range for filtering reports.
 */
export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * Generic structure for a QBO API response.
 */
interface QBOApiResponse<T> {
  QueryResponse?: {
    maxResults?: number;
    startPosition?: number;
  } & {
    [key: string]: T[];
  };
  Fault?: {
    Error: {
      Message: string;
      Detail?: string;
      code: string;
    }[];
    type: string;
  };
  time: string;
}

/**
 * Represents a QuickBooks Customer.
 */
export interface QBOCustomer {
  Id: string;
  SyncToken: string;
  DisplayName: string;
  FullyQualifiedName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: {
    Address: string;
  };
  PrimaryPhone?: {
    FreeFormNumber: string;
  };
  BillAddr?: QBOAddress;
  Balance: number;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

/**
 * Represents a physical address in QBO.
 */
export interface QBOAddress {
  Id: string;
  Line1?: string;
  Line2?: string;
  City?: string;
  CountrySubDivisionCode?: string; // State/Province
  PostalCode?: string;
  Country?: string;
}

/**
 * Represents the company information.
 */
export interface QBOCompanyInfo {
  CompanyName: string;
  LegalName: string;
  CompanyAddr: QBOAddress;
  CustomerCommunicationAddr: QBOAddress;
  LegalAddr: QBOAddress;
  PrimaryPhone: {
    FreeFormNumber: string;
  };
  Email: {
    Address: string;
  };
  WebAddr: {
    URI: string;
  };
  FiscalYearStartMonth: string;
  Country: string;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

/**
 * Represents an account in the Chart of Accounts.
 */
export interface QBOAccount {
  Name: string;
  Id: string;
  SyncToken: string;
  AccountType: string;
  AccountSubType: string;
  CurrentBalance: number;
  Classification: string;
  Active: boolean;
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

/**
 * Represents a column in a QBO report.
 */
interface QBOReportColumn {
  ColTitle: string;
  ColType: string;
  MetaData?: {
    Name: string;
    Value: string;
  }[];
}

/**
 * Represents a row in a QBO report.
 */
interface QBOReportRow {
  ColData: {
    value: string;
    id?: string;
  }[];
  type?: "Data" | "Section";
  group?: string;
}

/**
 * Represents a standard QBO financial report.
 */
export interface QBOReport {
  Header: {
    Time: string;
    ReportName: string;
    DateMacro: string;
    StartPeriod: string;
    EndPeriod: string;
    Currency: string;
  };
  Columns: {
    Column: QBOReportColumn[];
  };
  Rows: {
    Row: QBOReportRow[];
  };
}

/**
 * Represents a Journal Entry.
 */
interface QBOJournalEntry {
  Id: string;
  SyncToken: string;
  TxnDate: string;
  PrivateNote?: string;
  Line: {
    Id: string;
    Description?: string;
    Amount: number;
    DetailType: "JournalEntryLineDetail";
    JournalEntryLineDetail: {
      PostingType: "Debit" | "Credit";
      AccountRef: {
        value: string;
        name: string;
      };
    };
  }[];
  MetaData: {
    CreateTime: string;
    LastUpdatedTime: string;
  };
}

/**
 * Represents an A/R or A/P Aging Report.
 */
interface QBOAgingReport extends QBOReport {
  // Aging reports have a specific structure that can be further detailed if needed.
}

/**
 * Represents an entry in the Audit Log.
 */
interface QBOAuditLogEntry {
  EventDate: string;
  User: string;
  Event: string;
  Entity: string;
  Details: string;
}

/**
 * Represents reconciliation data for a single account.
 */
export interface QBOReconciliationAssessment {
  accountId: string;
  accountName: string;
  lastReconciledDate: string | null;
  unreconciledDifference: number;
  outstandingItems: {
    thirtyDays: { count: number; totalAmount: number };
    sixtyDays: { count: number; totalAmount: number };
    ninetyDays: { count: number; totalAmount: number };
  };
  qualityScore: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendations: string[];
}

/**
 * Represents the complete reconciliation assessment for all accounts.
 */
export interface QBOAllAccountsReconciliation {
  assessments: QBOReconciliationAssessment[];
  criticalAccounts: number;
  totalAccounts: number;
  accountTypesSummary?: {
    accountTypes: Record<string, string[]>;
    totalAccounts: number;
    accountSummary: Array<{
      accountType: string;
      subtypes: string[];
      count: number;
    }>;
  };
}

/**
 * Represents outstanding transaction items.
 */
export interface QBOOutstandingItems {
  count: number;
  totalAmount: number;
  items: any[];
}

/**
 * Represents transaction aging analysis.
 */
export interface QBOTransactionAging {
  sevenDays: QBOOutstandingItems;
  thirtyDays: QBOOutstandingItems;
  sixtyDays: QBOOutstandingItems;
  ninetyDays: QBOOutstandingItems;
}

/**
 * Represents a transaction from the TransactionList report.
 */
export interface QBOTransaction {
  date: string;
  transactionType: string;
  number?: string;
  name: string;
  memo?: string;
  account: string;
  amount: number;
  cleared: boolean;
}

/**
 * A container for all fetched financial reports.
 */
export interface QBOFinancialReports {
  profitAndLoss?: QBOReport;
  balanceSheet?: QBOReport;
  generalLedger?: QBOReport;
  trialBalance?: QBOReport;
  arAging?: QBOAgingReport;
  apAging?: QBOAgingReport;
}

/**
 * Configuration for a single QBO API request.
 */
interface QBOApiConfig {
  method: "GET" | "POST";
  endpoint: string;
  params?: Record<string, any>;
  data?: any;
}

/**
 * Configuration for the rate limiter.
 */
interface RateLimitConfig {
  maxRequestsPerMinute: number;
  retryDelayMs: number;
  maxRetries: number;
}

/**
 * Enum for different types of errors that can occur.
 */
export enum QBOErrorType {
  NETWORK_ERROR,
  TIMEOUT_ERROR,
  QBO_API_ERROR,
  AUTHENTICATION_ERROR,
  UNKNOWN_ERROR,
}

/**
 * Custom error class for handling API-related issues.
 */
export class QBOError extends Error {
  constructor(
    public type: QBOErrorType,
    public message: string,
    public originalError?: any,
    public isRetryable: boolean = false,
  ) {
    super(message);
    this.name = "QBOError";
  }
}

// =================================================================================
// RATE LIMITER CLASS
// =================================================================================

interface QueuedRequest {
  config: QBOApiConfig;
  retries: number;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}

class RateLimiter {
  private queue: QueuedRequest[] = [];
  private requestTimes: number[] = [];
  private processing = false;

  constructor(private config: RateLimitConfig) {}

  async enqueue<T>(config: QBOApiConfig): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ config, retries: 0, resolve, reject });
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }
    this.processing = true;

    const now = Date.now();
    this.requestTimes = this.requestTimes.filter((time) => now - time < 60000);

    if (this.requestTimes.length >= this.config.maxRequestsPerMinute) {
      const oldestRequestTime = this.requestTimes[0];
      const delayTime = 60000 - (now - oldestRequestTime);
      await this.delay(delayTime > 0 ? delayTime : 1000);
      this.processQueue();
      return;
    }

    const request = this.queue.shift();
    if (!request) {
      this.processing = false;
      return;
    }

    try {
      this.requestTimes.push(Date.now());
      // The actual request is made by the QBOApiService instance
      const result = await (this as any).makeRequest(request.config);
      request.resolve(result);
    } catch (error) {
      if (
        error instanceof QBOError &&
        error.isRetryable &&
        request.retries < this.config.maxRetries
      ) {
        logger.warn(
          `Retrying request. Attempt ${request.retries + 1} of ${this.config.maxRetries}.`,
          error,
        );
        request.retries++;
        this.queue.unshift(request); // Add back to the front of the queue
        await this.delay(this.config.retryDelayMs * (request.retries + 1));
      } else {
        request.reject(error);
      }
    }

    // Process next item
    this.processQueue();
  }

  // This method will be overridden by the QBOApiService instance
  private async makeRequest<T>(config: QBOApiConfig): Promise<T> {
    throw new Error("makeRequest method not implemented in RateLimiter.");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =================================================================================
// QBO API SERVICE CLASS
// =================================================================================

export class QBOApiService {
  private readonly PROXY_BASE_URL: string;
  private readonly REQUEST_TIMEOUT: number;
  private rateLimiter: RateLimiter;
  private accessToken: string | null = null;
  private realmId: string | null = null;
  private clerkUserId: string | null = null;
  private backgroundRefreshTimer: NodeJS.Timeout | null = null;
  private readonly BACKGROUND_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

  constructor(rateLimitConfig?: Partial<RateLimitConfig>) {
    logger.debug("Initializing QBOApiService...");

    this.PROXY_BASE_URL = import.meta.env.VITE_QBO_PROXY_BASE_URL || "";
    this.REQUEST_TIMEOUT =
      Number(import.meta.env.VITE_QBO_REQUEST_TIMEOUT) || 30000;

    if (!this.PROXY_BASE_URL) {
      const errorMessage =
        "VITE_QBO_PROXY_BASE_URL environment variable is not set.";
      logger.error(errorMessage);
      // We don't throw here to allow instantiation, but requests will fail.
    }

    const defaultConfig: RateLimitConfig = {
      maxRequestsPerMinute:
        Number(import.meta.env.VITE_QBO_MAX_REQUESTS_PER_MINUTE) || 450,
      retryDelayMs: Number(import.meta.env.VITE_QBO_RETRY_DELAY_MS) || 1000,
      maxRetries: Number(import.meta.env.VITE_QBO_MAX_RETRIES) || 3,
    };

    this.rateLimiter = new RateLimiter({
      ...defaultConfig,
      ...rateLimitConfig,
    });

    (this.rateLimiter as any).makeRequest = this.makeDirectRequest.bind(this);
    logger.info("QBOApiService initialized successfully");
  }

  /**
   * Sets the authentication credentials required for API calls.
   * @param accessToken - The OAuth 2.0 access token.
   * @param realmId - The QBO company ID.
   * @param clerkUserId - The user ID for token management.
   */
  public setAuth(accessToken: string, realmId: string, clerkUserId?: string) {
    this.accessToken = accessToken;
    this.realmId = realmId;
    this.clerkUserId = clerkUserId || null;
    logger.info("QBOApiService authentication tokens have been set.");
    
    // Start background token refresh if clerkUserId is provided
    if (this.clerkUserId) {
      this.startBackgroundTokenRefresh();
    }
  }

  /**
   * Set auth using stored tokens with automatic refresh capability
   */
  public async setAuthFromStoredTokens(clerkUserId: string): Promise<boolean> {
    try {
      const tokens = await QBOTokenService.getValidTokens(clerkUserId);
      if (!tokens) {
        logger.warn('No valid stored tokens found for user');
        return false;
      }

      this.accessToken = tokens.access_token;
      this.realmId = tokens.realm_id;
      this.clerkUserId = clerkUserId;
      
      logger.info('QBOApiService authentication set from stored tokens');
      this.startBackgroundTokenRefresh();
      
      return true;
    } catch (error) {
      logger.error('Failed to set auth from stored tokens', error);
      return false;
    }
  }

  /**
   * Clear authentication and stop background refresh
   */
  public clearAuth() {
    this.accessToken = null;
    this.realmId = null;
    this.clerkUserId = null;
    this.stopBackgroundTokenRefresh();
    logger.info('QBOApiService authentication cleared');
  }

  /**
   * Start background token refresh mechanism
   */
  private startBackgroundTokenRefresh() {
    if (!this.clerkUserId) return;
    
    // Clear existing timer
    this.stopBackgroundTokenRefresh();
    
    // Start new timer
    this.backgroundRefreshTimer = setInterval(async () => {
      try {
        if (!this.clerkUserId) return;
        
        logger.debug('Background token refresh triggered');
        const tokens = await QBOTokenService.getTokens(this.clerkUserId);
        
        if (tokens && QBOTokenService.isTokenNearExpiry(tokens)) {
          logger.info('Background token refresh needed');
          await QBOTokenService.refreshAccessToken(this.clerkUserId);
          
          // Update local tokens
          const refreshedTokens = await QBOTokenService.getTokens(this.clerkUserId);
          if (refreshedTokens) {
            this.accessToken = refreshedTokens.access_token;
            logger.info('Background token refresh completed');
          }
        }
      } catch (error) {
        logger.error('Background token refresh failed', error);
      }
    }, this.BACKGROUND_REFRESH_INTERVAL_MS);
    
    logger.debug('Background token refresh started');
  }

  /**
   * Stop background token refresh
   */
  private stopBackgroundTokenRefresh() {
    if (this.backgroundRefreshTimer) {
      clearInterval(this.backgroundRefreshTimer);
      this.backgroundRefreshTimer = null;
      logger.debug('Background token refresh stopped');
    }
  }

  /**
   * Ensure we have valid tokens before making API calls
   */
  private async ensureValidTokens(): Promise<boolean> {
    if (!this.clerkUserId) {
      // If no clerkUserId, assume tokens are managed externally
      return !!(this.accessToken && this.realmId);
    }

    try {
      const tokens = await QBOTokenService.getValidTokens(this.clerkUserId);
      if (!tokens) {
        logger.error('No valid tokens available');
        return false;
      }

      // Update local tokens if they've been refreshed
      if (tokens.access_token !== this.accessToken) {
        this.accessToken = tokens.access_token;
        logger.debug('Updated access token from refresh');
      }

      return true;
    } catch (error) {
      if (error instanceof OAuthTokenError && error.requiresReauth) {
        logger.error('Token refresh failed, re-authentication required', error);
        // Could emit an event or call a callback here to redirect to re-auth
        this.clearAuth();
        return false;
      }
      
      logger.error('Error ensuring valid tokens', error);
      return false;
    }
  }

  // --- PUBLIC DATA FETCHING METHODS ---

  async fetchCustomers(): Promise<QBOCustomer[]> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/query",
      params: { query: "SELECT * FROM Customer" },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchCompanyInfo(): Promise<QBOCompanyInfo> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/companyinfo/{realmId}",
    };
    const response = await this.rateLimiter.enqueue<any>(config);
    return response.CompanyInfo;
  }

  async fetchProfitAndLoss(range: DateRange): Promise<QBOReport> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/ProfitAndLoss",
      params: {
        start_date: range.startDate,
        end_date: range.endDate,
        summarize_column_by: "Month",
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchBalanceSheet(range: DateRange): Promise<QBOReport> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/BalanceSheet",
      params: {
        start_date: range.startDate,
        end_date: range.endDate,
        summarize_column_by: "Month",
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchGeneralLedger(range: DateRange): Promise<QBOReport> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/GeneralLedger",
      params: {
        start_date: range.startDate,
        end_date: range.endDate,
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchChartOfAccounts(): Promise<QBOAccount[]> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/query",
      params: { query: "SELECT * FROM Account" },
    };
    return this.rateLimiter.enqueue(config);
  }

  async analyzeAllAccountTypes(): Promise<{
    accountTypes: Record<string, string[]>;
    totalAccounts: number;
    accountSummary: Array<{
      accountType: string;
      subtypes: string[];
      count: number;
    }>;
  }> {
    logger.debug(
      "Analyzing all account types and subtypes in the chart of accounts...",
    );

    const allAccounts = await this.fetchChartOfAccounts();
    const accountTypes: Record<string, string[]> = {};

    // Collect all unique AccountType -> AccountSubType combinations
    allAccounts.forEach((account) => {
      const type = account.AccountType || "Unknown";
      const subtype = account.AccountSubType || "No Subtype";

      if (!accountTypes[type]) {
        accountTypes[type] = [];
      }
      if (!accountTypes[type].includes(subtype)) {
        accountTypes[type].push(subtype);
      }
    });

    // Create summary for logging
    const accountSummary = Object.entries(accountTypes).map(
      ([accountType, subtypes]) => {
        const count = allAccounts.filter(
          (acc) => acc.AccountType === accountType,
        ).length;
        return {
          accountType,
          subtypes,
          count,
        };
      },
    );

    logger.info("Complete account type analysis:", {
      totalAccounts: allAccounts.length,
      uniqueAccountTypes: Object.keys(accountTypes).length,
      accountSummary,
    });

    return {
      accountTypes,
      totalAccounts: allAccounts.length,
      accountSummary,
    };
  }

  async fetchTrialBalance(range: DateRange): Promise<QBOReport> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/TrialBalance",
      params: {
        start_date: range.startDate,
        end_date: range.endDate,
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchTransactionList(
    accountId: string,
    range: DateRange,
    clearedStatus: "all" | "reconciled" | "uncleared" | "cleared" = "all",
    sortBy: string = "txn_date",
  ): Promise<any> {
    logger.debug(
      `Fetching transaction list for account ${accountId}, cleared: ${clearedStatus}`,
    );

    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/TransactionList",
      params: {
        account: accountId,
        start_date: range.startDate,
        end_date: range.endDate,
        cleared: clearedStatus,
        sort: sortBy,
        minorversion: 65,
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchLatestReconciledTransactionDate(
    accountId: string,
  ): Promise<string | null> {
    logger.debug(
      `Fetching latest reconciled transaction date for account ${accountId}`,
    );

    try {
      const currentDate = new Date().toISOString().split("T")[0];
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const reconciledTransactions = await this.fetchTransactionList(
        accountId,
        {
          startDate: oneYearAgo.toISOString().split("T")[0],
          endDate: currentDate,
        },
        "reconciled",
        "txn_date",
      );

      if (reconciledTransactions?.Rows?.Row?.length > 0) {
        const lastRow =
          reconciledTransactions.Rows.Row[
            reconciledTransactions.Rows.Row.length - 1
          ];
        return lastRow.ColData?.[0]?.value || null; // First column typically contains the date
      }

      return null;
    } catch (error) {
      logger.warn(
        `Failed to fetch latest reconciled transaction date for account ${accountId}`,
        error,
      );
      return null;
    }
  }

  async fetchOutstandingItemsOlderThanDays(
    accountId: string,
    days: number = 30,
  ): Promise<{
    count: number;
    totalAmount: number;
    items: any[];
  }> {
    logger.debug(
      `Fetching outstanding items older than ${days} days for account ${accountId}`,
    );

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

      const unclearedTransactions = await this.fetchTransactionList(
        accountId,
        { startDate: "1900-01-01", endDate: cutoffDateStr },
        "uncleared",
      );

      const items = unclearedTransactions?.Rows?.Row || [];
      let totalAmount = 0;

      // Calculate total amount from uncleared transactions
      items.forEach((row: any) => {
        const amountCol = row.ColData?.find(
          (col: any) =>
            typeof col.value === "string" &&
            (col.value.includes("$") || /^-?\d+\.?\d*$/.test(col.value)),
        );
        if (amountCol) {
          const amount = parseFloat(amountCol.value.replace(/[$,]/g, ""));
          if (!isNaN(amount)) {
            totalAmount += amount;
          }
        }
      });

      return {
        count: items.length,
        totalAmount,
        items,
      };
    } catch (error) {
      logger.warn(
        `Failed to fetch outstanding items for account ${accountId}`,
        error,
      );
      return { count: 0, totalAmount: 0, items: [] };
    }
  }

  async calculateUnreconciledDifference(
    accountId: string,
    range: DateRange,
  ): Promise<number> {
    logger.debug(
      `Calculating unreconciled difference for account ${accountId}`,
    );

    try {
      const unclearedTransactions = await this.fetchTransactionList(
        accountId,
        range,
        "uncleared",
      );

      let netUncleared = 0;
      const items = unclearedTransactions?.Rows?.Row || [];

      items.forEach((row: any) => {
        const amountCol = row.ColData?.find(
          (col: any) =>
            typeof col.value === "string" &&
            (col.value.includes("$") || /^-?\d+\.?\d*$/.test(col.value)),
        );
        if (amountCol) {
          const amount = parseFloat(amountCol.value.replace(/[$,]/g, ""));
          if (!isNaN(amount)) {
            netUncleared += amount;
          }
        }
      });

      return Math.abs(netUncleared);
    } catch (error) {
      logger.warn(
        `Failed to calculate unreconciled difference for account ${accountId}`,
        error,
      );
      return 0;
    }
  }

  async assessSingleAccountReconciliation(
    accountId: string,
    accountName: string,
  ): Promise<{
    accountId: string;
    accountName: string;
    lastReconciledDate: string | null;
    daysSinceLastReconciliation: number | null;
    unreconciledDifference: number;
    outstandingItems: {
      thirtyDays: { count: number; totalAmount: number };
      sixtyDays: { count: number; totalAmount: number };
      ninetyDays: { count: number; totalAmount: number };
    };
  }> {
    logger.debug(
      `Collecting reconciliation data for account: ${accountName} (${accountId})`,
    );

    try {
      const range = QBOApiService.createThreeMonthRange();

      // Fetch all required data in parallel
      const [
        lastReconciledDate,
        unreconciledDifference,
        outstanding30,
        outstanding60,
        outstanding90,
      ] = await Promise.all([
        this.fetchLatestReconciledTransactionDate(accountId),
        this.calculateUnreconciledDifference(accountId, range),
        this.fetchOutstandingItemsOlderThanDays(accountId, 30),
        this.fetchOutstandingItemsOlderThanDays(accountId, 60),
        this.fetchOutstandingItemsOlderThanDays(accountId, 90),
      ]);

      // Calculate days since last reconciliation for LLM analysis
      let daysSinceLastReconciliation: number | null = null;
      if (lastReconciledDate) {
        daysSinceLastReconciliation = Math.floor(
          (Date.now() - new Date(lastReconciledDate).getTime()) /
            (1000 * 60 * 60 * 24),
        );
      }

      return {
        accountId,
        accountName,
        lastReconciledDate,
        daysSinceLastReconciliation,
        unreconciledDifference,
        outstandingItems: {
          thirtyDays: {
            count: outstanding30.count,
            totalAmount: outstanding30.totalAmount,
          },
          sixtyDays: {
            count: outstanding60.count,
            totalAmount: outstanding60.totalAmount,
          },
          ninetyDays: {
            count: outstanding90.count,
            totalAmount: outstanding90.totalAmount,
          },
        },
      };
    } catch (error) {
      logger.error(
        `Failed to collect reconciliation data for account ${accountName}`,
        error,
      );
      return {
        accountId,
        accountName,
        lastReconciledDate: null,
        daysSinceLastReconciliation: null,
        unreconciledDifference: 0,
        outstandingItems: {
          thirtyDays: { count: 0, totalAmount: 0 },
          sixtyDays: { count: 0, totalAmount: 0 },
          ninetyDays: { count: 0, totalAmount: 0 },
        },
      };
    }
  }

  async assessAllAccountsReconciliation(
    onProgress?: ProgressCallback,
  ): Promise<{
    assessments: any[];
    criticalAccounts: number;
    totalAccounts: number;
  }> {
    logger.info(
      "Starting comprehensive reconciliation assessment for all accounts",
    );

    try {
      const allAccounts = await this.fetchChartOfAccounts();
      const assessments: any[] = [];
      let completed = 0;

      for (const account of allAccounts) {
        if (account.Active) {
          const assessment = await this.assessSingleAccountReconciliation(
            account.Id,
            account.Name,
          );
          assessments.push(assessment);
        }

        completed++;
        if (onProgress) {
          onProgress(completed / allAccounts.length);
        }
      }

      logger.info(
        `Reconciliation data collection completed for ${assessments.length} accounts`,
      );

      return {
        assessments,
        criticalAccounts: assessments.filter((a) => a.status === "critical")
          .length,
        totalAccounts: assessments.length,
      };
    } catch (error) {
      logger.error("Failed to complete reconciliation assessment", error);
      throw error;
    }
  }

  async fetchOpeningBalanceEquity(): Promise<{
    balance: number;
    accountExists: boolean;
    accountId?: string;
    lastModified?: string;
  }> {
    logger.debug("Fetching Opening Balance Equity account information");

    try {
      const allAccounts = await this.fetchChartOfAccounts();
      const obeAccount = allAccounts.find(
        (account) =>
          account.Name.toLowerCase().includes("opening balance equity") ||
          account.AccountSubType === "OpeningBalanceEquity",
      );

      if (!obeAccount) {
        return {
          balance: 0,
          accountExists: false,
        };
      }

      return {
        balance: obeAccount.CurrentBalance || 0,
        accountExists: true,
        accountId: obeAccount.Id,
        lastModified: obeAccount.MetaData?.LastUpdatedTime,
      };
    } catch (error) {
      logger.warn("Failed to fetch Opening Balance Equity data", error);
      return {
        balance: 0,
        accountExists: false,
      };
    }
  }

  async fetchUndepositedFundsAnalysis(): Promise<{
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
  }> {
    logger.debug("Analyzing Undeposited Funds account");

    try {
      const allAccounts = await this.fetchChartOfAccounts();
      const undepositedAccount = allAccounts.find(
        (account) =>
          account.Name.toLowerCase().includes("undeposited funds") ||
          account.AccountSubType === "UndepositedFunds",
      );

      if (!undepositedAccount) {
        return {
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
      }

      // Analyze aging of undeposited funds
      const range = QBOApiService.createThreeMonthRange();
      const transactions = await this.fetchTransactionList(
        undepositedAccount.Id,
        range,
        "all",
      );

      const agingAnalysis = {
        current: 0,
        over30Days: 0,
        over60Days: 0,
        over90Days: 0,
      };

      const transactionItems = transactions?.Rows?.Row || [];

      transactionItems.forEach((row: any) => {
        const dateCol = row.ColData?.[0]?.value;
        const amountCol = row.ColData?.find(
          (col: any) =>
            typeof col.value === "string" &&
            (col.value.includes("$") || /^-?\d+\.?\d*$/.test(col.value)),
        );

        if (dateCol && amountCol) {
          const txnDate = new Date(dateCol);
          const amount = Math.abs(
            parseFloat(amountCol.value.replace(/[$,]/g, "")) || 0,
          );
          const daysOld = Math.floor(
            (Date.now() - txnDate.getTime()) / (1000 * 60 * 60 * 24),
          );

          if (daysOld <= 30) {
            agingAnalysis.current += amount;
          } else if (daysOld <= 60) {
            agingAnalysis.over30Days += amount;
          } else if (daysOld <= 90) {
            agingAnalysis.over60Days += amount;
          } else {
            agingAnalysis.over90Days += amount;
          }
        }
      });

      return {
        balance: undepositedAccount.CurrentBalance || 0,
        accountExists: true,
        accountId: undepositedAccount.Id,
        agingAnalysis,
        transactionCount: transactionItems.length,
      };
    } catch (error) {
      logger.warn("Failed to analyze Undeposited Funds", error);
      return {
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
    }
  }

  async analyzeControlAccounts(): Promise<{
    openingBalanceEquity: any;
    undepositedFunds: any;
    payrollLiabilities: any[];
    recommendations: string[];
  }> {
    logger.debug("Performing comprehensive control account analysis");

    try {
      const [obeData, undepositedData] = await Promise.all([
        this.fetchOpeningBalanceEquity(),
        this.fetchUndepositedFundsAnalysis(),
      ]);

      // Analyze payroll liability accounts
      const allAccounts = await this.fetchChartOfAccounts();
      const payrollAccounts = allAccounts.filter(
        (account) =>
          account.AccountType === "Other Current Liability" &&
          (account.Name.toLowerCase().includes("payroll") ||
            account.Name.toLowerCase().includes("tax") ||
            account.AccountSubType === "PayrollTaxPayable"),
      );

      const recommendations: string[] = [];

      // Generate recommendations based on raw data (no scoring)
      if (obeData.accountExists && Math.abs(obeData.balance) > 100) {
        recommendations.push(
          `Opening Balance Equity has balance of $${obeData.balance.toFixed(2)} - should be zero after proper setup`,
        );
      } else if (!obeData.accountExists) {
        recommendations.push(
          "Opening Balance Equity account not found - may indicate setup issues",
        );
      }

      if (undepositedData.accountExists) {
        const { agingAnalysis } = undepositedData;
        if (agingAnalysis.over90Days > 0) {
          recommendations.push(
            `Undeposited Funds has $${agingAnalysis.over90Days.toFixed(2)} over 90 days old - critical issue`,
          );
        } else if (agingAnalysis.over60Days > 0) {
          recommendations.push(
            `Undeposited Funds has $${agingAnalysis.over60Days.toFixed(2)} over 60 days old`,
          );
        } else if (agingAnalysis.over30Days > 0) {
          recommendations.push(
            `Undeposited Funds has $${agingAnalysis.over30Days.toFixed(2)} over 30 days old`,
          );
        }
      }

      // Analyze payroll liabilities (no scoring)
      const payrollLiabilitiesWithBalance = payrollAccounts.filter(
        (acc) => Math.abs(acc.CurrentBalance || 0) > 10,
      );
      if (payrollLiabilitiesWithBalance.length > 0) {
        const totalPayrollLiability = payrollLiabilitiesWithBalance.reduce(
          (sum, acc) => sum + Math.abs(acc.CurrentBalance || 0),
          0,
        );
        if (totalPayrollLiability > 1000) {
          recommendations.push(
            `Payroll liabilities total $${totalPayrollLiability.toFixed(2)} - ensure timely payment`,
          );
        } else {
          recommendations.push(
            "Minor payroll liabilities present - monitor payment dates",
          );
        }
      }

      return {
        openingBalanceEquity: obeData,
        undepositedFunds: undepositedData,
        payrollLiabilities: payrollAccounts.map((acc) => ({
          id: acc.Id,
          name: acc.Name,
          balance: acc.CurrentBalance || 0,
          subType: acc.AccountSubType,
        })),
        recommendations,
      };
    } catch (error) {
      logger.error("Failed to analyze control accounts", error);
      return {
        openingBalanceEquity: { balance: 0, accountExists: false },
        undepositedFunds: {
          balance: 0,
          accountExists: false,
          agingAnalysis: {
            current: 0,
            over30Days: 0,
            over60Days: 0,
            over90Days: 0,
          },
          transactionCount: 0,
        },
        payrollLiabilities: [],
        recommendations: [
          "Failed to analyze control accounts - manual review required",
        ],
      };
    }
  }

  async analyzeUncategorizedTransactions(): Promise<{
    uncategorizedBalance: number;
    uncategorizedCount: number;
    missingVendorCustomer: number;
    generalAccountUsage: {
      accountName: string;
      accountId: string;
      transactionCount: number;
      totalAmount: number;
    }[];
    recommendations: string[];
  }> {
    logger.debug("Analyzing transaction categorization quality");

    try {
      const allAccounts = await this.fetchChartOfAccounts();
      const range = QBOApiService.createThreeMonthRange();

      // Find common uncategorized accounts
      const uncategorizedAccounts = allAccounts.filter(
        (account) =>
          account.Name.toLowerCase().includes("uncategorized") ||
          account.Name.toLowerCase().includes("general") ||
          account.Name.toLowerCase() === "miscellaneous" ||
          account.AccountSubType === "OtherMiscellaneousIncome" ||
          account.AccountSubType === "OtherMiscellaneousExpense",
      );

      let uncategorizedBalance = 0;
      let uncategorizedCount = 0;
      const generalAccountUsage: any[] = [];

      // Analyze each uncategorized account
      for (const account of uncategorizedAccounts) {
        try {
          const transactions = await this.fetchTransactionList(
            account.Id,
            range,
            "all",
          );
          const transactionItems = transactions?.Rows?.Row || [];

          let accountTotal = 0;
          transactionItems.forEach((row: any) => {
            const amountCol = row.ColData?.find(
              (col: any) =>
                typeof col.value === "string" &&
                (col.value.includes("$") || /^-?\d+\.?\d*$/.test(col.value)),
            );
            if (amountCol) {
              const amount = Math.abs(
                parseFloat(amountCol.value.replace(/[$,]/g, "")) || 0,
              );
              accountTotal += amount;
            }
          });

          if (transactionItems.length > 0) {
            generalAccountUsage.push({
              accountName: account.Name,
              accountId: account.Id,
              transactionCount: transactionItems.length,
              totalAmount: accountTotal,
            });

            uncategorizedBalance += accountTotal;
            uncategorizedCount += transactionItems.length;
          }
        } catch (error) {
          logger.warn(`Failed to analyze account ${account.Name}`, error);
        }
      }

      // Analyze missing vendor/customer assignments
      let missingVendorCustomer = 0;
      try {
        // Check for transactions without proper vendor/customer assignment
        const generalLedger = await this.fetchGeneralLedger(range);
        if (generalLedger?.Rows?.Row) {
          const transactions = generalLedger.Rows.Row;
          missingVendorCustomer = transactions.filter((row: any) => {
            const nameCol = row.ColData?.find(
              (col: any, index: number) => index === 2,
            ); // Typically name column
            return !nameCol?.value || nameCol.value.trim() === "";
          }).length;
        }
      } catch (error) {
        logger.warn("Failed to analyze vendor/customer assignments", error);
      }

      // Generate recommendations based on raw data (no scoring)
      const recommendations: string[] = [];

      if (uncategorizedBalance > 5000) {
        recommendations.push(
          `High uncategorized balance of $${uncategorizedBalance.toFixed(2)} requires immediate attention`,
        );
      } else if (uncategorizedBalance > 1000) {
        recommendations.push(
          `Moderate uncategorized balance of $${uncategorizedBalance.toFixed(2)} should be categorized`,
        );
      } else if (uncategorizedBalance > 100) {
        recommendations.push(
          `Minor uncategorized balance of $${uncategorizedBalance.toFixed(2)}`,
        );
      }

      if (uncategorizedCount > 50) {
        recommendations.push(
          `${uncategorizedCount} uncategorized transactions - significant categorization needed`,
        );
      } else if (uncategorizedCount > 20) {
        recommendations.push(
          `${uncategorizedCount} uncategorized transactions need attention`,
        );
      } else if (uncategorizedCount > 0) {
        recommendations.push(
          `${uncategorizedCount} transactions need categorization`,
        );
      }

      if (missingVendorCustomer > 20) {
        recommendations.push(
          `${missingVendorCustomer} transactions missing vendor/customer assignment`,
        );
      } else if (missingVendorCustomer > 0) {
        recommendations.push(
          `${missingVendorCustomer} transactions need vendor/customer assignment`,
        );
      }

      return {
        uncategorizedBalance,
        uncategorizedCount,
        missingVendorCustomer,
        generalAccountUsage,
        recommendations,
      };
    } catch (error) {
      logger.error("Failed to analyze transaction categorization", error);
      return {
        uncategorizedBalance: 0,
        uncategorizedCount: 0,
        missingVendorCustomer: 0,
        generalAccountUsage: [],
        recommendations: [
          "Failed to analyze transaction categorization - manual review required",
        ],
      };
    }
  }

  async analyzeChartOfAccountsIntegrity(): Promise<{
    totalAccounts: number;
    activeAccounts: number;
    inactiveAccounts: number;
    duplicateAccounts: string[];
    unusedAccounts: {
      accountName: string;
      accountId: string;
      accountType: string;
      lastActivity?: string;
    }[];
    recommendations: string[];
  }> {
    logger.debug("Analyzing Chart of Accounts integrity");

    try {
      const allAccounts = await this.fetchChartOfAccounts();
      const range = QBOApiService.createThreeMonthRange();

      const activeAccounts = allAccounts.filter((acc) => acc.Active).length;
      const inactiveAccounts = allAccounts.length - activeAccounts;

      // Find duplicate accounts (similar names)
      const duplicateAccounts: string[] = [];
      const accountNames = allAccounts.map((acc) =>
        acc.Name.toLowerCase().trim(),
      );
      const nameCounts = accountNames.reduce((counts: any, name) => {
        counts[name] = (counts[name] || 0) + 1;
        return counts;
      }, {});

      Object.entries(nameCounts).forEach(([name, count]) => {
        if ((count as number) > 1) {
          duplicateAccounts.push(name);
        }
      });

      // Find unused accounts (no activity in 3 months)
      const unusedAccounts: any[] = [];
      for (const account of allAccounts.filter((acc) => acc.Active)) {
        try {
          const transactions = await this.fetchTransactionList(
            account.Id,
            range,
            "all",
          );
          const transactionItems = transactions?.Rows?.Row || [];

          if (transactionItems.length === 0) {
            unusedAccounts.push({
              accountName: account.Name,
              accountId: account.Id,
              accountType: account.AccountType,
              lastActivity: account.MetaData?.LastUpdatedTime,
            });
          }
        } catch (error) {
          // If we can't fetch transactions, assume the account might be unused
          if (Math.abs(account.CurrentBalance || 0) < 1) {
            unusedAccounts.push({
              accountName: account.Name,
              accountId: account.Id,
              accountType: account.AccountType,
              lastActivity: account.MetaData?.LastUpdatedTime,
            });
          }
        }
      }

      // Generate recommendations based on raw data (no scoring)
      const recommendations: string[] = [];

      const unusedPercentage = (unusedAccounts.length / activeAccounts) * 100;
      if (unusedPercentage > 20) {
        recommendations.push(
          `${unusedAccounts.length} unused accounts (${unusedPercentage.toFixed(1)}%) should be reviewed`,
        );
      } else if (unusedPercentage > 10) {
        recommendations.push(
          `${unusedAccounts.length} potentially unused accounts`,
        );
      }

      if (duplicateAccounts.length > 0) {
        recommendations.push(
          `${duplicateAccounts.length} duplicate account names found - consolidate similar accounts`,
        );
      }

      const inactivePercentage = (inactiveAccounts / allAccounts.length) * 100;
      if (inactivePercentage > 15) {
        recommendations.push(
          `High number of inactive accounts (${inactivePercentage.toFixed(1)}%) - consider cleanup`,
        );
      } else if (inactivePercentage > 10) {
        recommendations.push(
          "Moderate number of inactive accounts - periodic review recommended",
        );
      }

      return {
        totalAccounts: allAccounts.length,
        activeAccounts,
        inactiveAccounts,
        duplicateAccounts,
        unusedAccounts,
        recommendations,
      };
    } catch (error) {
      logger.error("Failed to analyze Chart of Accounts integrity", error);
      return {
        totalAccounts: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
        duplicateAccounts: [],
        unusedAccounts: [],
        recommendations: [
          "Failed to analyze Chart of Accounts - manual review required",
        ],
      };
    }
  }

  async fetchARAgingReports(reportDate: string): Promise<QBOAgingReport> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/AgedReceivables",
      params: {
        report_date: reportDate,
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchAPAgingReports(reportDate: string): Promise<QBOAgingReport> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/AgedPayables",
      params: {
        report_date: reportDate,
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  async fetchAuditLog(range: DateRange): Promise<QBOAuditLogEntry[]> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/query",
      params: {
        query: `SELECT * FROM AuditLog WHERE EventDate >= '${range.startDate}' AND EventDate <= '${range.endDate}'`,
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  /**
   * Fetches Cash Flow Statement for methodology compliance.
   */
  async fetchCashFlowStatement(range: DateRange): Promise<QBOReport> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/CashFlow",
      params: {
        start_date: range.startDate,
        end_date: range.endDate,
        summarize_column_by: "Month",
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  /**
   * Fetches Journal Entries for transaction integrity assessment.
   */
  async fetchJournalEntries(range: DateRange): Promise<QBOJournalEntry[]> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/query",
      params: {
        query: `SELECT * FROM JournalEntry WHERE TxnDate >= '${range.startDate}' AND TxnDate <= '${range.endDate}' MAXRESULTS 1000`,
      },
    };
    return this.rateLimiter.enqueue(config);
  }

  /**
   * Fetches Customer Balance Summary for A/R validation.
   */
  async fetchCustomerBalanceSummary(): Promise<any[]> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/CustomerBalanceSummary",
    };
    return this.rateLimiter.enqueue(config);
  }

  /**
   * Fetches Vendor Balance Summary for A/P validation.
   */
  async fetchVendorBalanceSummary(): Promise<any[]> {
    const config: QBOApiConfig = {
      method: "GET",
      endpoint: "v3/company/{realmId}/reports/VendorBalanceSummary",
    };
    return this.rateLimiter.enqueue(config);
  }

  /**
   * Fetches bank reconciliation reports for all bank accounts.
   */
  async fetchBankReconciliationReports(): Promise<any[]> {
    try {
      // First get all bank accounts
      const accounts = await this.fetchChartOfAccounts();
      const bankAccounts = accounts.filter(
        (acc) => acc.AccountType === "Bank" && acc.Active,
      );

      const reconciliationReports = [];
      for (const account of bankAccounts) {
        try {
          const config: QBOApiConfig = {
            method: "GET",
            endpoint: "v3/company/{realmId}/reports/TransactionList",
            params: {
              account: account.Id,
              cleared: "all",
              sort: "txn_date",
            },
          };
          const report = await this.rateLimiter.enqueue(config);
          reconciliationReports.push({
            accountId: account.Id,
            accountName: account.Name,
            reconciliationData: report,
          });
        } catch (error) {
          logger.warn(
            `Failed to fetch reconciliation for account ${account.Name}`,
            error,
          );
        }
      }

      return reconciliationReports;
    } catch (error) {
      logger.error("Failed to fetch bank reconciliation reports", error);
      return [];
    }
  }

  async fetchAllFinancialData(
    range: DateRange,
    onProgress: ProgressCallback,
  ): Promise<QBOFinancialReports> {
    const reports: {
      key: keyof QBOFinancialReports;
      fetcher: () => Promise<any>;
    }[] = [
      {
        key: "profitAndLoss",
        fetcher: () => this.fetchProfitAndLoss(range),
      },
      {
        key: "balanceSheet",
        fetcher: () => this.fetchBalanceSheet(range),
      },
      { key: "trialBalance", fetcher: () => this.fetchTrialBalance(range) },
      {
        key: "arAging",
        fetcher: () => this.fetchARAgingReports(range.endDate),
      },
      {
        key: "apAging",
        fetcher: () => this.fetchAPAgingReports(range.endDate),
      },
    ];

    const results: QBOFinancialReports = {};
    let completed = 0;

    await Promise.all(
      reports.map(async (report) => {
        try {
          const data = await report.fetcher();
          results[report.key] = data;
        } catch (error) {
          logger.error(`Failed to fetch ${report.key}`, error);
          // Optionally, store the error in the results
        } finally {
          completed++;
          onProgress(completed / reports.length);
        }
      }),
    );

    return results;
  }

  /**
   * Fetches the complete data package required for comprehensive hygiene assessment.
   * Uses 3-month data scope as recommended by the Day-30 methodology.
   * Implements the multi-dimensional quality framework as per CPA methodology.
   */
  async fetchHygieneAssessmentData(onProgress?: ProgressCallback): Promise<{
    // Core financial statements
    profitAndLoss?: any;
    balanceSheet?: any;
    cashFlowStatement?: any;
    // Detailed transaction data
    generalLedger?: any;
    chartOfAccounts?: any[];
    trialBalance?: any;
    journalEntries?: any[];
    // Control and reconciliation data
    reconciliationAssessment?: QBOAllAccountsReconciliation;
    bankReconciliationReports?: any[];
    openingBalanceEquity?: any;
    undepositedFunds?: any[];
    // Aging and customer/vendor analysis
    arAging?: any;
    apAging?: any;
    customerBalanceSummary?: any[];
    vendorBalanceSummary?: any[];
    // Audit and compliance data
    auditLog?: any[];
    accountTypesAnalysis?: any;
    userAccessLogs?: any[];
    // Analysis results (raw data, no pre-calculated scores)
    controlAccountAnalysis?: any;
    uncategorizedAnalysis?: any;
    chartIntegrityAnalysis?: any;
    // Metadata
    datePeriod: DateRange;
    assessmentTimestamp: string;
    dataCompletenessScore: number;
  }> {
    logger.info("Fetching hygiene assessment data package (3-month scope)");

    const range = QBOApiService.createThreeMonthRange();
    const reports = [
      // Core Financial Statements (Critical for methodology compliance)
      {
        key: "profitAndLoss",
        fetcher: () => this.fetchProfitAndLoss(range),
        description: "Profit & Loss Statement",
        critical: true,
      },
      {
        key: "balanceSheet",
        fetcher: () => this.fetchBalanceSheet(range),
        description: "Balance Sheet",
        critical: true,
      },
      {
        key: "trialBalance",
        fetcher: () => this.fetchTrialBalance(range),
        description: "Trial Balance",
        critical: true,
      },
      // Chart of Accounts and Structure Analysis
      {
        key: "chartOfAccounts",
        fetcher: () => this.fetchChartOfAccounts(),
        description: "Chart of Accounts",
        critical: true,
      },
      {
        key: "accountTypesAnalysis",
        fetcher: () => this.analyzeAllAccountTypes(),
        description: "Account Types Analysis",
        critical: false,
      },
      // Transaction-Level Data
      {
        key: "generalLedger",
        fetcher: () => this.fetchGeneralLedger(range),
        description: "General Ledger",
        critical: true,
      },
      // Aging and Customer/Vendor Analysis
      {
        key: "arAging",
        fetcher: () => this.fetchARAgingReports(range.endDate),
        description: "A/R Aging Report",
        critical: true,
      },
      {
        key: "apAging",
        fetcher: () => this.fetchAPAgingReports(range.endDate),
        description: "A/P Aging Report",
        critical: true,
      },
      // Control and Audit Data
      {
        key: "auditLog",
        fetcher: () => this.fetchAuditLog(range),
        description: "Audit Log",
        critical: false,
      },
      // Additional reports required by methodology
      {
        key: "cashFlowStatement",
        fetcher: () => this.fetchCashFlowStatement(range),
        description: "Cash Flow Statement",
        critical: true,
      },
      {
        key: "journalEntries",
        fetcher: () => this.fetchJournalEntries(range),
        description: "Journal Entries",
        critical: false,
      },
      {
        key: "customerBalanceSummary",
        fetcher: () => this.fetchCustomerBalanceSummary(),
        description: "Customer Balance Summary",
        critical: false,
      },
      {
        key: "vendorBalanceSummary",
        fetcher: () => this.fetchVendorBalanceSummary(),
        description: "Vendor Balance Summary",
        critical: false,
      },
      {
        key: "bankReconciliationReports",
        fetcher: () => this.fetchBankReconciliationReports(),
        description: "Bank Reconciliation Reports",
        critical: true,
      },
      // Analysis methods for comprehensive data
      {
        key: "controlAccountAnalysis",
        fetcher: () => this.analyzeControlAccounts(),
        description: "Control Account Analysis",
        critical: true,
      },
      {
        key: "uncategorizedAnalysis",
        fetcher: () => this.analyzeUncategorizedTransactions(),
        description: "Uncategorized Transaction Analysis",
        critical: true,
      },
      {
        key: "chartIntegrityAnalysis",
        fetcher: () => this.analyzeChartOfAccountsIntegrity(),
        description: "Chart of Accounts Integrity Analysis",
        critical: true,
      },
    ];

    const results: any = {
      datePeriod: range,
      assessmentTimestamp: new Date().toISOString(),
      dataCompletenessScore: 0, // Will be calculated after fetching
    };

    let completed = 0;
    const totalReports = reports.length;

    // Fetch all reports with progress tracking
    await Promise.all(
      reports.map(async (report) => {
        try {
          logger.debug(`Fetching ${report.description}...`);
          const data = await report.fetcher();
          results[report.key] = data;
          logger.debug(`Successfully fetched ${report.description}`);
        } catch (error) {
          logger.error(`Failed to fetch ${report.description}`, error);
          // Store the error but continue with other reports
          results[report.key] = null;
        } finally {
          completed++;
          if (onProgress) {
            onProgress(completed / totalReports);
          }
        }
      }),
    );

    // Fetch comprehensive reconciliation assessment
    try {
      logger.debug("Performing comprehensive reconciliation assessment...");

      // Create a progress callback that accounts for reconciliation assessment
      const reconciliationProgress = (progress: number) => {
        const baseProgress = completed / totalReports;
        const reconciliationWeight = 0.3; // 30% of total progress
        if (onProgress) {
          onProgress(baseProgress + progress * reconciliationWeight);
        }
      };

      const reconciliationData = await this.assessAllAccountsReconciliation(
        reconciliationProgress,
      );

      // Note: Account types analysis is now available separately in results.accountTypesAnalysis

      results.reconciliationAssessment = reconciliationData;
      logger.info("Reconciliation assessment completed successfully", {
        totalAccounts: reconciliationData.totalAccounts,
        criticalAccounts: reconciliationData.criticalAccounts,
      });
    } catch (error) {
      logger.error("Failed to perform reconciliation assessment", error);
      results.reconciliationAssessment = null;
    }

    try {
      logger.debug("Attempting to fetch undeposited funds data...");
      // results.undepositedFunds = await this.fetchUndepositedFunds();
    } catch (error) {
      logger.warn("Undeposited funds data not available", error);
    }

    try {
      logger.debug("Attempting to fetch opening balance equity...");
      // results.openingBalanceEquity = await this.fetchOpeningBalanceEquity();
    } catch (error) {
      logger.warn("Opening balance equity data not available", error);
    }

    // Calculate data completeness score
    const criticalReports = reports.filter((r) => r.critical).length;
    const availableCriticalReports = reports.filter(
      (r) => r.critical && results[r.key] !== null,
    ).length;
    results.dataCompletenessScore = Math.round(
      (availableCriticalReports / criticalReports) * 100,
    );

    logger.info("Hygiene assessment data package fetching completed", {
      datePeriod: range,
      totalReports: reports.length,
      criticalReports,
      availableReports: Object.keys(results).filter(
        (key) =>
          results[key] !== null &&
          ![
            "datePeriod",
            "assessmentTimestamp",
            "dataCompletenessScore",
          ].includes(key),
      ),
      dataCompletenessScore: results.dataCompletenessScore,
      reconciliationAssessmentIncluded: !!results.reconciliationAssessment,
      criticalAccounts: results.reconciliationAssessment?.criticalAccounts || 0,
    });

    return results;
  }

  // --- PRIVATE HELPER METHODS ---

  private async makeDirectRequest<T>(config: QBOApiConfig): Promise<T> {
    if (!this.accessToken || !this.realmId) {
      throw new QBOError(
        QBOErrorType.AUTHENTICATION_ERROR,
        "QBO Access Token or Realm ID has not been set. Call setAuth() first.",
      );
    }

    // Validate and refresh token if needed before making the request
    if (this.clerkUserId) {
      logger.debug('Validating token before QBO API request');
      const isValid = await QBOTokenService.validateAndRefreshIfNeeded(this.clerkUserId);
      
      if (!isValid) {
        logger.error('Token validation failed - token may be revoked or refresh failed');
        throw new QBOError(
          QBOErrorType.AUTHENTICATION_ERROR,
          "Token validation failed. Please reconnect to QuickBooks.",
          null,
          false
        );
      }

      // Get refreshed tokens if they were updated
      const tokens = await QBOTokenService.getTokens(this.clerkUserId);
      if (tokens && tokens.access_token !== this.accessToken) {
        logger.info('Token was refreshed, updating service credentials');
        this.accessToken = tokens.access_token;
        this.realmId = tokens.realm_id;
      }
    }

    const { method, endpoint, params, data } = config;

    try {
      const endpointWithRealm = endpoint.replace("{realmId}", this.realmId);

      // Build URL with query parameters
      let url = `${this.PROXY_BASE_URL}/${endpointWithRealm}`;
      if (params) {
        const urlParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            urlParams.append(key, String(value));
          }
        });
        if (urlParams.toString()) {
          url += `?${urlParams.toString()}`;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.REQUEST_TIMEOUT,
      );

      // Prepare request headers and body
      const headers: Record<string, string> = {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
      };

      let requestBody: string | undefined;
      if (method === "POST" && data) {
        headers["Content-Type"] = "application/json";
        requestBody = JSON.stringify(data);
      }

      const response = await fetch(url, {
        method: method,
        credentials: "include",
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Capture intuit_tid for QuickBooks support troubleshooting\n        const intuitTid = response.headers.get('intuit_tid');\n        if (intuitTid) {\n          logger.debug('QuickBooks request completed', {\n            intuit_tid: intuitTid,\n            endpoint: endpoint,\n            method: method,\n            status: response.status\n          });\n        }\n        await this.handleHttpError(response, intuitTid);
      }

      const result = await response.json();
      if (result.fault) {
        throw new QBOError(
          QBOErrorType.QBO_API_ERROR,
          this.formatQBOError(result.fault),
          result.fault,
        );
      }

      // Extract the relevant data from the nested structure
      return this.extractQueryResults(result);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new QBOError(
          QBOErrorType.TIMEOUT_ERROR,
          "Request timed out",
          error,
          true,
        );
      }
      if (error instanceof QBOError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new QBOError(
          QBOErrorType.NETWORK_ERROR,
          "Network connection failed",
          error,
          true,
        );
      }
      throw new QBOError(
        QBOErrorType.UNKNOWN_ERROR,
        `Unexpected error: ${error instanceof Error ? error.message : "Unknown"}`,
        error,
      );
    }
  }

  private async handleHttpError(response: Response, intuitTid?: string) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch (e) {
      errorBody = await response.text();
    }

    const errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;

    if (response.status === 401) {
      throw new QBOError(
        QBOErrorType.AUTHENTICATION_ERROR,
        "Authentication failed. The access token may be invalid or expired.",
        errorBody,
      );
    }

    throw new QBOError(
      QBOErrorType.QBO_API_ERROR,
      errorMessage,
      errorBody,
      response.status >= 500, // Retry on server errors
    );
  }

  private extractQueryResults(data: any): any {
    if (data && data.QueryResponse) {
      // Find the first key in QueryResponse that is an array (e.g., "Customer", "Account")
      const entityKey = Object.keys(data.QueryResponse).find((key) =>
        Array.isArray(data.QueryResponse[key]),
      );
      return entityKey ? data.QueryResponse[entityKey] : data.QueryResponse;
    }
    return data;
  }

  private formatQBOError(fault: any): string {
    if (fault && fault.Error && fault.Error.length > 0) {
      const error = fault.Error[0];
      return `QBO API Error: ${error.Message} (Code: ${error.code})`;
    }
    return "An unknown QBO API error occurred.";
  }

  public static validateDateRange(range: DateRange): boolean {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    return !isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end;
  }

  public static createDateRange(
    period:
      | "last_year"
      | "last_quarter"
      | "last_month"
      | "three_months"
      | "custom",
    customRange?: { startDate: Date; endDate: Date },
  ): DateRange {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case "last_year":
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      case "last_quarter":
        const currentQuarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), currentQuarter * 3 - 3, 1);
        endDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 3,
          0,
        );
        break;
      case "last_month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "three_months":
        // Past 3 months for hygiene assessment
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "custom":
        if (!customRange) {
          throw new Error("Custom date range requires startDate and endDate.");
        }
        startDate = customRange.startDate;
        endDate = customRange.endDate;
        break;
    }

    const formatDate = (date: Date) => date.toISOString().split("T")[0];
    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }

  /**
   * Creates a 3-month date range specifically for hygiene assessment.
   * This is the recommended data scope for Day-30 readiness evaluation.
   */
  public static createThreeMonthRange(): DateRange {
    return QBOApiService.createDateRange("three_months");
  }
}

// =================================================================================
// EXAMPLE USAGE
// =================================================================================

/**
 * Demonstrates how to use the QBOApiService.
 * This is for documentation and testing purposes.
 */
class QBOApiServiceExample {
  private qboService: QBOApiService;

  constructor() {
    this.qboService = new QBOApiService();
    // In a real app, you would get these from your OAuth flow
    const FAKE_ACCESS_TOKEN = "your_real_access_token";
    const FAKE_REALM_ID = "your_real_realm_id";
    this.qboService.setAuth(FAKE_ACCESS_TOKEN, FAKE_REALM_ID);
  }

  async basicUsage() {
    try {
      logger.info("Fetching customers...");
      const customers = await this.qboService.fetchCustomers();
      logger.info(`Found ${customers.length} customers.`, customers[0]);

      logger.info("Fetching company info...");
      const companyInfo = await this.qboService.fetchCompanyInfo();
      logger.info(`Company Name: ${companyInfo.CompanyName}`);
    } catch (error) {
      if (error instanceof QBOError) {
        logger.error(
          `QBO Service Error (${error.type}): ${error.message}`,
          error.originalError,
        );
      } else {
        logger.error("An unexpected error occurred", error);
      }
    }
  }

  async fetchAllDataWithProgress() {
    try {
      const range = QBOApiService.createDateRange("last_year");
      logger.info("Fetching all financial data for last year...", range);

      const onProgress = (progress: number) => {
        const percentage = Math.round(progress * 100);
        logger.info(`Progress: ${percentage}%`);
      };

      const allData = await this.qboService.fetchAllFinancialData(
        range,
        onProgress,
      );
      logger.info("Successfully fetched all financial data:", allData);
    } catch (error) {
      logger.error("Failed to fetch all financial data", error);
    }
  }

  async rateLimitingExample() {
    logger.info(
      "Demonstrating rate limiting by sending 10 requests quickly...",
    );
    const requests = [];
    for (let i = 0; i < 10; i++) {
      requests.push(this.qboService.fetchCompanyInfo());
    }
    try {
      const results = await Promise.all(requests);
      logger.info("All 10 requests completed successfully.", results.length);
    } catch (error) {
      logger.error("An error occurred during the rate limiting example", error);
    }
  }
}
