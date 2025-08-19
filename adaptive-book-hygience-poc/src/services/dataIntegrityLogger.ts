/**
 * @file dataIntegrityLogger.ts
 * @description Enhanced logging for QuickBooks data transformation integrity
 * 
 * This service provides comprehensive logging to identify data discrepancies
 * between raw QBO data and transformed pillar format.
 */

export interface DataIntegrityCheck {
  timestamp: string;
  stage: 'raw' | 'transformed' | 'displayed';
  checksPerformed: ValidationResult[];
  anomalies: AnomalyDetection[];
}

export interface ValidationResult {
  check: string;
  passed: boolean;
  details: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AnomalyDetection {
  field: string;
  expected: any;
  actual: any;
  issue: string;
  recommendation: string;
}

export class DataIntegrityLogger {
  private static checks: DataIntegrityCheck[] = [];

  /**
   * Comprehensive data validation with accounting rules
   */
  static validateQBOData(data: any, stage: 'raw' | 'transformed' | 'displayed'): DataIntegrityCheck {
    const check: DataIntegrityCheck = {
      timestamp: new Date().toISOString(),
      stage,
      checksPerformed: [],
      anomalies: []
    };

    // 1. Sign Convention Validation
    this.validateSignConventions(data, check);
    
    // 2. Type Consistency Validation
    this.validateDataTypes(data, check);
    
    // 3. Accounting Balance Validation
    this.validateAccountingBalances(data, check);
    
    // 4. Data Completeness Validation
    this.validateDataCompleteness(data, check);
    
    // 5. Precision and Rounding Validation
    this.validatePrecision(data, check);

    // Store check for comparison
    this.checks.push(check);
    
    // Log critical issues immediately
    this.logCriticalIssues(check);
    
    return check;
  }

  /**
   * Validate sign conventions per GAAP
   */
  private static validateSignConventions(data: any, check: DataIntegrityCheck): void {
    // AR should be positive (debit balance)
    if (data.controlAccounts?.ar?.balance !== undefined) {
      const arBalance = data.controlAccounts.ar.balance;
      const arCheck: ValidationResult = {
        check: 'AR Sign Convention',
        passed: arBalance >= 0,
        details: { balance: arBalance },
        severity: arBalance < 0 ? 'error' : 'info'
      };
      check.checksPerformed.push(arCheck);
      
      if (arBalance < 0) {
        check.anomalies.push({
          field: 'controlAccounts.ar.balance',
          expected: 'Positive value (debit balance)',
          actual: arBalance,
          issue: 'Negative AR balance indicates potential data extraction error',
          recommendation: 'Verify QBO API response and check for sign inversion in transformation'
        });
      }
    }

    // AP should be positive (credit balance) in standard accounting
    // Note: rawDataTransformer already converts QBO's negative AP to positive
    if (data.controlAccounts?.ap?.balance !== undefined) {
      const apBalance = data.controlAccounts.ap.balance;
      const apRaw = data.controlAccounts.ap?.raw;
      
      console.log('🔍 AP Sign Validation:', {
        balance: apBalance,
        raw: apRaw,
        signConvention: data.controlAccounts.ap.signConvention
      });
      
      const apCheck: ValidationResult = {
        check: 'AP Sign Convention',
        passed: apBalance >= 0,
        details: { 
          balance: apBalance,
          raw: apRaw,
          convention: data.controlAccounts.ap.signConvention 
        },
        severity: apBalance < 0 ? 'warning' : 'info'
      };
      check.checksPerformed.push(apCheck);
      
      // Only flag if still negative after transformation
      if (apBalance < 0) {
        check.anomalies.push({
          field: 'controlAccounts.ap.balance',
          expected: 'Positive value (credit balance) or zero',
          actual: apBalance,
          issue: 'AP balance still negative after transformation - possible vendor credits exceeding payables',
          recommendation: 'This is valid if vendor credits > payables. Review AP aging for details.'
        });
      }
    }
  }

  /**
   * Validate data types and detect coercion issues
   */
  private static validateDataTypes(data: any, check: DataIntegrityCheck): void {
    const checkNumericField = (value: any, fieldName: string) => {
      if (value !== undefined && value !== null) {
        const isNumber = typeof value === 'number';
        const isFinite = Number.isFinite(value);
        const hasDecimals = value.toString().includes('.');
        
        const typeCheck: ValidationResult = {
          check: `Data Type: ${fieldName}`,
          passed: isNumber && isFinite,
          details: {
            type: typeof value,
            isNumber,
            isFinite,
            hasDecimals,
            value
          },
          severity: !isNumber ? 'error' : 'info'
        };
        check.checksPerformed.push(typeCheck);
        
        if (!isNumber) {
          check.anomalies.push({
            field: fieldName,
            expected: 'number',
            actual: typeof value,
            issue: 'Type mismatch may cause calculation errors',
            recommendation: `Parse as number: parseFloat(${fieldName})`
          });
        }
      }
    };

    // Check critical numeric fields
    checkNumericField(data.controlAccounts?.ar?.balance, 'AR Balance');
    checkNumericField(data.controlAccounts?.ap?.balance, 'AP Balance');
    checkNumericField(data.reconciliation?.variance?.length, 'Variance Count');
  }

  /**
   * Validate accounting balance relationships
   */
  private static validateAccountingBalances(data: any, check: DataIntegrityCheck): void {
    // Check AR vs AP relationship for reasonableness
    if (data.controlAccounts?.ar?.balance !== undefined && 
        data.controlAccounts?.ap?.balance !== undefined) {
      const arBalance = Math.abs(data.controlAccounts.ar.balance);
      const apBalance = Math.abs(data.controlAccounts.ap.balance);
      const ratio = arBalance / (apBalance || 1);
      
      const balanceCheck: ValidationResult = {
        check: 'AR/AP Balance Ratio',
        passed: ratio > 0.1 && ratio < 10, // Reasonable range
        details: {
          arBalance,
          apBalance,
          ratio: ratio.toFixed(2)
        },
        severity: ratio > 10 || ratio < 0.1 ? 'warning' : 'info'
      };
      check.checksPerformed.push(balanceCheck);
      
      if (ratio > 10) {
        check.anomalies.push({
          field: 'AR/AP Ratio',
          expected: 'Between 0.1 and 10',
          actual: ratio.toFixed(2),
          issue: 'Unusually high AR compared to AP may indicate collection issues',
          recommendation: 'Review aging reports and collection procedures'
        });
      }
    }

    // Check for control account subsidiary ledger reconciliation
    if (data.arApValidity?.arTotal !== undefined && 
        data.controlAccounts?.ar?.balance !== undefined) {
      const arAgingTotal = data.arApValidity.arTotal;
      const arControlBalance = Math.abs(data.controlAccounts.ar.balance);
      const difference = Math.abs(arAgingTotal - arControlBalance);
      
      const reconciliationCheck: ValidationResult = {
        check: 'AR Control vs Aging Total',
        passed: difference < 0.01, // Allow for rounding
        details: {
          controlBalance: arControlBalance,
          agingTotal: arAgingTotal,
          difference
        },
        severity: difference > 0.01 ? 'critical' : 'info'
      };
      check.checksPerformed.push(reconciliationCheck);
      
      if (difference > 0.01) {
        check.anomalies.push({
          field: 'AR Reconciliation',
          expected: 'Control account equals aging total',
          actual: `Difference of ${difference.toFixed(2)}`,
          issue: 'AR control account does not reconcile with subsidiary ledger',
          recommendation: 'Run AR reconciliation report and investigate discrepancies'
        });
      }
    }
  }

  /**
   * Validate data completeness
   */
  private static validateDataCompleteness(data: any, check: DataIntegrityCheck): void {
    const requiredFields = [
      'reconciliation.variance',
      'reconciliation.byAccount',
      'chartIntegrity.totals.accounts',
      'categorization.uncategorized',
      'controlAccounts.ar',
      'controlAccounts.ap'
    ];

    requiredFields.forEach(fieldPath => {
      const value = this.getNestedValue(data, fieldPath);
      const completenessCheck: ValidationResult = {
        check: `Field Completeness: ${fieldPath}`,
        passed: value !== undefined && value !== null,
        details: { value },
        severity: value === undefined ? 'warning' : 'info'
      };
      check.checksPerformed.push(completenessCheck);
      
      if (value === undefined || value === null) {
        check.anomalies.push({
          field: fieldPath,
          expected: 'Defined value',
          actual: value,
          issue: 'Missing required field',
          recommendation: 'Ensure QBO API returns this field or provide default value'
        });
      }
    });
  }

  /**
   * Validate numeric precision and rounding
   */
  private static validatePrecision(data: any, check: DataIntegrityCheck): void {
    const checkPrecision = (value: any, fieldName: string) => {
      if (typeof value === 'number') {
        const decimalPlaces = (value.toString().split('.')[1] || '').length;
        const precisionCheck: ValidationResult = {
          check: `Precision: ${fieldName}`,
          passed: decimalPlaces <= 2,
          details: {
            value,
            decimalPlaces
          },
          severity: decimalPlaces > 2 ? 'warning' : 'info'
        };
        check.checksPerformed.push(precisionCheck);
        
        if (decimalPlaces > 2) {
          check.anomalies.push({
            field: fieldName,
            expected: 'Maximum 2 decimal places',
            actual: `${decimalPlaces} decimal places`,
            issue: 'Excessive precision may indicate floating point errors',
            recommendation: `Round to 2 decimals: Math.round(value * 100) / 100`
          });
        }
      }
    };

    checkPrecision(data.controlAccounts?.ar?.balance, 'AR Balance');
    checkPrecision(data.controlAccounts?.ap?.balance, 'AP Balance');
  }

  /**
   * Get nested object value by path
   */
  private static getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Log critical issues to console
   */
  private static logCriticalIssues(check: DataIntegrityCheck): void {
    const criticalIssues = check.checksPerformed.filter(c => c.severity === 'critical');
    const errors = check.checksPerformed.filter(c => c.severity === 'error');
    
    if (criticalIssues.length > 0) {
      console.error('🚨 CRITICAL DATA INTEGRITY ISSUES:', {
        timestamp: check.timestamp,
        stage: check.stage,
        issues: criticalIssues,
        anomalies: check.anomalies
      });
    }
    
    if (errors.length > 0) {
      console.error('❌ DATA VALIDATION ERRORS:', {
        timestamp: check.timestamp,
        stage: check.stage,
        errors
      });
    }

    // Log summary
    console.log(`📊 Data Integrity Check (${check.stage}):`, {
      totalChecks: check.checksPerformed.length,
      passed: check.checksPerformed.filter(c => c.passed).length,
      failed: check.checksPerformed.filter(c => !c.passed).length,
      anomalies: check.anomalies.length,
      critical: criticalIssues.length,
      errors: errors.length
    });
  }

  /**
   * Compare checks across different stages
   */
  static compareStages(): void {
    if (this.checks.length < 2) return;
    
    const stages = this.checks.reduce((acc, check) => {
      acc[check.stage] = check;
      return acc;
    }, {} as Record<string, DataIntegrityCheck>);
    
    console.log('🔄 STAGE COMPARISON:', {
      raw: stages.raw?.anomalies.length || 0,
      transformed: stages.transformed?.anomalies.length || 0,
      displayed: stages.displayed?.anomalies.length || 0
    });
    
    // Find new anomalies introduced during transformation
    if (stages.raw && stages.transformed) {
      const newAnomalies = stages.transformed.anomalies.filter(
        ta => !stages.raw.anomalies.some(ra => ra.field === ta.field)
      );
      
      if (newAnomalies.length > 0) {
        console.error('⚠️ NEW ANOMALIES INTRODUCED DURING TRANSFORMATION:', newAnomalies);
      }
    }
  }

  /**
   * Generate corrected data with fixes applied
   * Note: Sign corrections are now handled in rawDataTransformer
   */
  static applyCorrectionSuggestions(data: any): any {
    const corrected = JSON.parse(JSON.stringify(data)); // Deep clone
    
    console.log('🎯 Data Correction Check:', {
      stage: 'correction',
      ar: {
        balance: corrected.controlAccounts?.ar?.balance,
        raw: corrected.controlAccounts?.ar?.raw
      },
      ap: {
        balance: corrected.controlAccounts?.ap?.balance,
        raw: corrected.controlAccounts?.ap?.raw
      }
    });
    
    // NO LONGER apply sign correction here - it's done in transformer
    // This prevents double-correction issues
    
    // Round all numeric values to 2 decimal places
    const roundNumbers = (obj: any, path = '') => {
      Object.keys(obj).forEach(key => {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof obj[key] === 'number' && key !== 'raw') { // Don't round raw values
          const original = obj[key];
          obj[key] = Math.round(obj[key] * 100) / 100;
          if (original !== obj[key]) {
            console.log(`🔄 Rounded ${currentPath}: ${original} -> ${obj[key]}`);
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          roundNumbers(obj[key], currentPath);
        }
      });
    };
    roundNumbers(corrected);
    
    return corrected;
  }
}

// Export for use in services
export const dataIntegrityLogger = DataIntegrityLogger;