/**
 * @file rawDataTransformer.ts
 * @description Passes raw QuickBooks data through without transformation
 */

import { logger } from '../lib/logger';
import { WebhookResponse, WebhookPillarData } from './qboPillarsWebhookService';

export interface RawQBOData {
  chartOfAccounts?: any;
  txnList?: any;
  ar?: any;
  ap?: any;
  trialBal?: any;
  journalEntries?: any;
  [key: string]: any; // Allow any other raw QBO data
}

export class RawDataTransformer {
  /**
   * Detects if the data is in raw format or already transformed pillar format
   */
  static isRawFormat(data: any): boolean {
    // Check for raw format indicators
    return !!(data.chartOfAccounts || data.txnList || data.ar || data.ap || data.trialBal);
  }

  /**
   * Pass through raw QuickBooks data without any transformation
   * Just organize it into a structure with metadata
   */
  static transformToPillarFormat(rawData: RawQBOData): WebhookResponse {
    // Data should already be extracted from array if needed
    const data = rawData;
    
    logger.info('Passing through raw QBO data without transformation');

    // Extract actual values from raw data for UI display
    const accounts = data.chartOfAccounts?.Account || [];
    
    // Log account types for debugging
    logger.info(`Total accounts found: ${accounts.length}`);
    
    // Find AR and AP accounts from chart of accounts - match by AccountType exactly
    const arAccount = accounts.find((acc: any) => 
      acc.AccountType === 'Accounts Receivable'
    );
    const apAccount = accounts.find((acc: any) => 
      acc.AccountType === 'Accounts Payable'
    );
    const obeAccount = accounts.find((acc: any) => 
      acc.AccountSubType === 'OpeningBalanceEquity' || acc.Name?.includes('Opening Balance')
    );
    const udfAccount = accounts.find((acc: any) => 
      acc.AccountSubType === 'UndepositedFunds' || acc.Name === 'Undeposited Funds'
    );
    
    // Log what we found
    logger.info('Account extraction results:', {
      arFound: !!arAccount,
      arBalance: arAccount?.CurrentBalance,
      arId: arAccount?.Id,
      apFound: !!apAccount,
      apBalance: apAccount?.CurrentBalance,
      apId: apAccount?.Id,
      obeFound: !!obeAccount,
      obeBalance: obeAccount?.CurrentBalance,
      udfFound: !!udfAccount,
      udfBalance: udfAccount?.CurrentBalance
    });

    // Extract aging data if available - note the lowercase 'rows'
    const arAgingData = data.ar?.rows?.Row || [];
    const apAgingData = data.ap?.rows?.Row || [];
    
    // Calculate aging buckets from raw data
    const calculateAgingBuckets = (agingRows: any[]) => {
      const buckets = {
        current: 0,
        d1_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_plus: 0
      };
      
      // Find the summary row with totals
      const summaryRow = agingRows.find((row: any) => 
        row.Summary?.ColData || (row.type === 'Section' && row.group === 'GrandTotal')
      );
      
      if (summaryRow?.Summary?.ColData) {
        // Extract from summary row - indexes: [0]=label, [1]=current, [2]=1-30, [3]=31-60, [4]=61-90, [5]=91+
        const cols = summaryRow.Summary.ColData;
        buckets.current = parseFloat(cols[1]?.value || '0') || 0;
        buckets.d1_30 = parseFloat(cols[2]?.value || '0') || 0;
        buckets.d31_60 = parseFloat(cols[3]?.value || '0') || 0;
        buckets.d61_90 = parseFloat(cols[4]?.value || '0') || 0;
        buckets.d90_plus = parseFloat(cols[5]?.value || '0') || 0;
      }
      
      logger.info('Extracted aging buckets:', buckets);
      
      return buckets;
    };

    // Pass raw data AS-IS but ensure basic structure for UI compatibility
    const pillarData: WebhookPillarData = {
      reconciliation: {
        rawData: data.txnList || {},
        rawChartOfAccounts: data.chartOfAccounts || {},
        clearedColumnFound: false,
        totalRowsFound: 0,
        totalTransactionsProcessed: 0,
        totalAccountsFound: 0,
        hasTransactionData: false,
        byAccount: [],
        variance: []
      } as any,
      chartIntegrity: {
        rawData: data.chartOfAccounts || {},
        source: 'raw',
        totals: {
          accounts: accounts.length
        },
        duplicates: {
          name: [],
          acctNum: []
        },
        missingDetail: [],
        subAccountsMissingParent: []
      } as any,
      categorization: {
        rawData: {
          chartOfAccounts: data.chartOfAccounts || {},
          txnList: data.txnList || {}
        },
        uncategorized: {
          'Uncategorized Expense': { count: 0, amount: 0 },
          'Uncategorized Income': { count: 0, amount: 0 },
          'Uncategorized Asset': { count: 0, amount: 0 },
          'Ask My Accountant': { count: 0, amount: 0 }
        }
      } as any,
      controlAccounts: {
        rawData: {
          chartOfAccounts: data.chartOfAccounts || {},
          journalEntries: data.journalEntries || {},
          trialBalance: data.trialBal || {}
        },
        openingBalanceEquity: { 
          balance: obeAccount?.CurrentBalance || 0, 
          accountId: obeAccount?.Id || null 
        },
        undepositedFunds: { 
          balance: udfAccount?.CurrentBalance || 0, 
          accountId: udfAccount?.Id || null 
        },
        ar: { 
          balance: arAccount?.CurrentBalance || 0, 
          accountId: arAccount?.Id || null 
        },
        ap: { 
          balance: apAccount?.CurrentBalance || 0, 
          accountId: apAccount?.Id || null 
        },
        journalEntriesToARorAP: 0
      } as any,
      arApValidity: {
        rawData: {
          arAging: data.ar || {},
          apAging: data.ap || {}
        },
        arAging: calculateAgingBuckets(arAgingData),
        apAging: calculateAgingBuckets(apAgingData),
        arTotal: arAccount?.CurrentBalance || 0,
        apTotal: apAccount?.CurrentBalance || 0
      } as any
    };

    // Simple metadata extraction without complex logic
    const meta = this.extractMetadata(data);

    return {
      pillarData,
      meta
    };
  }


  /**
   * Extract minimal metadata from raw data - no complex logic
   */
  private static extractMetadata(data: RawQBOData): any {
    // Get current date as fallback ONLY if webhook doesn't provide dates
    const today = new Date().toISOString().split('T')[0];
    
    // Extract dates from txnList headers where they actually exist (lowercase 'headers')
    const txnListHeaders = data.txnList?.headers;
    const startDate = txnListHeaders?.StartPeriod || data.meta?.start_date || today;
    const endDate = txnListHeaders?.EndPeriod || data.meta?.end_date || today;
    
    // Calculate windowDays from actual date range if available
    let windowDays = 90; // default
    if (startDate && endDate && startDate !== today && endDate !== today) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      windowDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }
    
    // Only use actual data from the response, with required fields having defaults
    const meta = {
      realmId: data.meta?.realmId || data.realmId || txnListHeaders?.ReportBasis || '',
      companyName: data.meta?.companyName || data.companyName || '',
      start_date: startDate,
      end_date: endDate,
      windowDays: data.meta?.windowDays || data.windowDays || windowDays,
      timestamp: new Date().toISOString(),
      rawDataProvided: true
    };
    
    // Log what we actually have
    logger.info('Extracted metadata from raw response:', meta);
    
    return meta;
  }
}