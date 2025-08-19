/**
 * @file rawDataValidator.ts
 * @description Service for validating raw QuickBooks data before transformation
 * 
 * This service validates that the raw QB data has sufficient quality and completeness
 * to produce meaningful assessment results.
 */

import { logger } from '../lib/logger';
import { RawQBOData } from './rawDataTransformer';
import { WebhookResponse, WebhookPillarData } from './qboPillarsWebhookService';

// =================================================================================
// VALIDATION INTERFACES
// =================================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  completeness: number; // 0-100%
  details: {
    chartOfAccounts: {
      valid: boolean;
      count: number;
      issues: string[];
    };
    transactions: {
      valid: boolean;
      count: number;
      issues: string[];
    };
    agingReports: {
      arValid: boolean;
      apValid: boolean;
      issues: string[];
    };
    trialBalance: {
      valid: boolean;
      issues: string[];
    };
    journalEntries: {
      valid: boolean;
      count: number;
      issues: string[];
    };
  };
}

// =================================================================================
// VALIDATION SERVICE
// =================================================================================

export class RawDataValidator {
  /**
   * Validates raw webhook data before transformation
   */
  static validateRawWebhookData(rawData: RawQBOData): ValidationResult {
    logger.debug("Validating raw webhook data");
    
    const errors: string[] = [];
    const warnings: string[] = [];
    const details = {
      chartOfAccounts: { valid: false, count: 0, issues: [] as string[] },
      transactions: { valid: false, count: 0, issues: [] as string[] },
      agingReports: { arValid: false, apValid: false, issues: [] as string[] },
      trialBalance: { valid: false, issues: [] as string[] },
      journalEntries: { valid: false, count: 0, issues: [] as string[] }
    };

    // Validate Chart of Accounts
    const coaResult = this.validateChartOfAccounts(rawData.chartOfAccounts?.Account || []);
    details.chartOfAccounts = coaResult;
    if (!coaResult.valid) {
      errors.push(`Chart of Accounts validation failed: ${coaResult.issues.join(', ')}`);
    }

    // Validate Transactions
    const txnResult = this.validateTransactions(rawData.txnList?.rows?.Row || []);
    details.transactions = txnResult;
    if (!txnResult.valid) {
      if (txnResult.count === 0) {
        warnings.push(`No transactions found - reconciliation analysis will be limited`);
      } else {
        warnings.push(`Transaction data has issues: ${txnResult.issues.join(', ')}`);
      }
    }

    // Validate Aging Reports
    const agingResult = this.validateAgingReports(rawData.ar, rawData.ap);
    details.agingReports = agingResult;
    if (!agingResult.arValid || !agingResult.apValid) {
      warnings.push(`Aging reports incomplete: ${agingResult.issues.join(', ')}`);
    }

    // Validate Trial Balance
    const trialBalResult = this.validateTrialBalance(rawData.trialBal);
    details.trialBalance = trialBalResult;
    if (!trialBalResult.valid) {
      warnings.push(`Trial balance validation failed: ${trialBalResult.issues.join(', ')}`);
    }

    // Validate Journal Entries
    const journalResult = this.validateJournalEntries(rawData.journalEntries?.entries || []);
    details.journalEntries = journalResult;
    if (!journalResult.valid && journalResult.count > 0) {
      warnings.push(`Journal entries have issues: ${journalResult.issues.join(', ')}`);
    }

    // Calculate completeness score
    const validComponents = [
      details.chartOfAccounts.valid,
      details.transactions.valid || details.transactions.count > 0,
      details.agingReports.arValid || details.agingReports.apValid,
      details.trialBalance.valid,
      details.journalEntries.valid || details.journalEntries.count === 0 // JE optional
    ].filter(Boolean).length;
    
    const completeness = Math.round((validComponents / 5) * 100);

    // Determine overall validity
    const isValid = errors.length === 0 && completeness >= 60;

    if (completeness < 60) {
      errors.push(`Data completeness too low: ${completeness}% (minimum 60% required for analysis)`);
    }

    const result: ValidationResult = {
      isValid,
      errors,
      warnings,
      completeness,
      details
    };

    logger.info("Raw data validation completed", {
      isValid,
      errors: errors.length,
      warnings: warnings.length,
      completeness
    });

    return result;
  }

  /**
   * Validates transformed pillar data
   */
  static validatePillarData(pillarData: WebhookPillarData): ValidationResult {
    logger.debug("Validating transformed pillar data");
    
    const errors: string[] = [];
    const warnings: string[] = [];
    let validPillars = 0;
    const totalPillars = 5;

    // Validate reconciliation pillar
    if (pillarData.reconciliation?.variance?.length > 0) {
      validPillars++;
    } else {
      warnings.push('Reconciliation data is empty - no bank accounts found');
    }

    // Validate chart integrity pillar
    if (pillarData.chartIntegrity?.totals?.accounts > 0) {
      validPillars++;
    } else {
      errors.push('Chart of accounts data is missing or empty');
    }

    // Validate categorization pillar
    const hasCategorizationData = pillarData.categorization?.uncategorized && 
      Object.keys(pillarData.categorization.uncategorized).length > 0;
    if (hasCategorizationData) {
      validPillars++;
    } else {
      warnings.push('Categorization data is empty');
    }

    // Validate control accounts pillar
    if (pillarData.controlAccounts) {
      validPillars++;
      
      // Check for meaningful balances
      const hasNonZeroBalances = 
        pillarData.controlAccounts.ar.balance !== 0 ||
        pillarData.controlAccounts.ap.balance !== 0 ||
        pillarData.controlAccounts.openingBalanceEquity.balance !== 0 ||
        pillarData.controlAccounts.undepositedFunds.balance !== 0;
      
      if (!hasNonZeroBalances) {
        warnings.push('All control account balances are zero - may indicate data quality issues');
      }
    } else {
      errors.push('Control accounts data is missing');
    }

    // Validate AR/AP validity pillar
    const hasArApData = pillarData.arApValidity?.arAging || pillarData.arApValidity?.apAging;
    if (hasArApData) {
      validPillars++;
    } else {
      warnings.push('AR/AP aging data is missing');
    }

    const completeness = Math.round((validPillars / totalPillars) * 100);
    const isValid = errors.length === 0 && completeness >= 80; // Higher threshold for pillar data

    if (completeness < 80) {
      errors.push(`Pillar data completeness too low: ${completeness}% (minimum 80% required)`);
    }

    return {
      isValid,
      errors,
      warnings,
      completeness,
      details: {
        chartOfAccounts: { valid: pillarData.chartIntegrity?.totals?.accounts > 0, count: pillarData.chartIntegrity?.totals?.accounts || 0, issues: [] },
        transactions: { valid: pillarData.reconciliation?.totalTransactionsProcessed > 0, count: pillarData.reconciliation?.totalTransactionsProcessed || 0, issues: [] },
        agingReports: { arValid: !!pillarData.arApValidity?.arAging, apValid: !!pillarData.arApValidity?.apAging, issues: [] },
        trialBalance: { valid: true, issues: [] }, // Not directly mapped
        journalEntries: { valid: true, count: pillarData.controlAccounts?.journalEntriesToARorAP || 0, issues: [] }
      }
    };
  }

  /**
   * Validates chart of accounts data
   */
  private static validateChartOfAccounts(chartOfAccounts: any[]): { valid: boolean; count: number; issues: string[] } {
    const issues: string[] = [];
    
    if (!Array.isArray(chartOfAccounts)) {
      issues.push('Chart of accounts is not an array');
      return { valid: false, count: 0, issues };
    }

    if (chartOfAccounts.length === 0) {
      issues.push('Chart of accounts is empty');
      return { valid: false, count: 0, issues };
    }

    // Check for required fields
    let validAccounts = 0;
    chartOfAccounts.forEach((account, index) => {
      if (!account.Id) {
        issues.push(`Account at index ${index} missing Id`);
      }
      if (!account.Name) {
        issues.push(`Account at index ${index} missing Name`);
      }
      if (!account.AccountType) {
        issues.push(`Account at index ${index} missing AccountType`);
      }
      
      if (account.Id && account.Name && account.AccountType) {
        validAccounts++;
      }
    });

    const valid = validAccounts > 0 && issues.length < chartOfAccounts.length * 0.1; // Allow 10% invalid
    
    if (!valid && validAccounts === 0) {
      issues.push('No valid accounts found');
    }

    return { valid, count: chartOfAccounts.length, issues };
  }

  /**
   * Validates transaction data
   */
  private static validateTransactions(txnList: any[]): { valid: boolean; count: number; issues: string[] } {
    const issues: string[] = [];
    
    if (!Array.isArray(txnList)) {
      issues.push('Transaction list is not an array');
      return { valid: false, count: 0, issues };
    }

    if (txnList.length === 0) {
      // Empty transaction list is valid, just limits reconciliation analysis
      return { valid: true, count: 0, issues: ['No transactions found'] };
    }

    // Check for required fields
    let validTxns = 0;
    txnList.forEach((txn, index) => {
      // For txnList rows, check ColData structure
      if (!txn.ColData || !Array.isArray(txn.ColData)) {
        issues.push(`Transaction at index ${index} missing ColData`);
      } else if (txn.ColData.length > 0) {
        validTxns++;
      }
    });

    const valid = validTxns > 0;
    
    return { valid, count: txnList.length, issues };
  }

  /**
   * Validates aging reports
   */
  private static validateAgingReports(ar: any, ap: any): { arValid: boolean; apValid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    const arValid = ar?.rows?.Row?.length > 0;
    const apValid = ap?.rows?.Row?.length > 0;
    
    if (!arValid) {
      issues.push('AR aging report is empty or malformed');
    }
    if (!apValid) {
      issues.push('AP aging report is empty or malformed');
    }
    
    return { arValid, apValid, issues };
  }

  /**
   * Validates trial balance
   */
  private static validateTrialBalance(trialBal: any): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    const valid = trialBal?.rows?.Row?.length > 0;
    
    if (!valid) {
      issues.push('Trial balance is empty or malformed');
    }
    
    return { valid, issues };
  }

  /**
   * Validates journal entries
   */
  private static validateJournalEntries(journalEntries: any[]): { valid: boolean; count: number; issues: string[] } {
    const issues: string[] = [];
    
    if (!Array.isArray(journalEntries)) {
      issues.push('Journal entries is not an array');
      return { valid: false, count: 0, issues };
    }

    // Journal entries are optional, so empty is valid
    if (journalEntries.length === 0) {
      return { valid: true, count: 0, issues: [] };
    }

    // Check for required fields
    let validJEs = 0;
    journalEntries.forEach((je, index) => {
      if (!je.Id) {
        issues.push(`Journal entry at index ${index} missing Id`);
      }
      if (!je.Line || !Array.isArray(je.Line)) {
        issues.push(`Journal entry at index ${index} missing or invalid Line array`);
      }
      
      if (je.Id && je.Line && Array.isArray(je.Line)) {
        validJEs++;
      }
    });

    const valid = validJEs === journalEntries.length;
    
    return { valid, count: journalEntries.length, issues };
  }
}