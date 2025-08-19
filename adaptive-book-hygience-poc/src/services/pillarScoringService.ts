/**
 * @file pillarScoringService.ts
 * @description Service for calculating assessment scores from pillar data
 * 
 * Implements the multi-dimensional scoring framework from requirement.md:
 * - Accuracy & Reliability: 25%
 * - Completeness: 20%
 * - Compliance: 20%
 * - Consistency: 15%
 * - Timeliness: 10%
 * - Integrity: 10%
 */

import { WebhookPillarData, WebhookResponse } from './qboPillarsWebhookService';
import { HygieneAssessmentResult } from './perplexityService';

// =================================================================================
// SCORING CONFIGURATION
// =================================================================================

const PILLAR_WEIGHTS = {
  reconciliation: 0.25,    // Accuracy & Reliability
  coaIntegrity: 0.20,      // Completeness  
  categorization: 0.20,    // Compliance
  controlAccount: 0.15,    // Consistency
  aging: 0.20,             // Combined Timeliness + Integrity
} as const;

const SCORE_THRESHOLDS = {
  excellent: 90,   // Excellent - Minimal cleanup required
  good: 75,        // Good - Minor adjustments needed  
  fair: 60,        // Fair - Moderate cleanup required
  poor: 50,        // Poor - Significant work needed
  critical: 0,     // Critical - Extensive remediation required
} as const;

// =================================================================================
// MAIN SCORING FUNCTIONS
// =================================================================================

/**
 * Calculate overall assessment score from pillar data
 */
export function calculateAssessmentFromPillars(webhookData: WebhookResponse): HygieneAssessmentResult {
  const { pillarData, meta } = webhookData;
  
  // Calculate individual pillar scores
  const pillarScores = {
    reconciliation: calculateReconciliationScore(pillarData.reconciliation),
    coaIntegrity: calculateChartIntegrityScore(pillarData.chartIntegrity),
    categorization: calculateCategorizationScore(pillarData.categorization),
    controlAccount: calculateControlAccountScore(pillarData.controlAccounts),
    aging: calculateArApValidityScore(pillarData.arApValidity),
  };

  // Calculate weighted overall score
  const overallScore = Math.round(
    pillarScores.reconciliation * PILLAR_WEIGHTS.reconciliation +
    pillarScores.coaIntegrity * PILLAR_WEIGHTS.coaIntegrity +
    pillarScores.categorization * PILLAR_WEIGHTS.categorization +
    pillarScores.controlAccount * PILLAR_WEIGHTS.controlAccount +
    pillarScores.aging * PILLAR_WEIGHTS.aging
  );

  // Determine readiness status
  const readinessStatus = getReadinessStatus(overallScore) as "READY_FOR_MONTHLY_OPERATIONS" | "MINOR_FIXES_NEEDED" | "ADDITIONAL_CLEANUP_REQUIRED";

  return {
    overallScore,
    pillarScores,
    readinessStatus,
    businessOwnerSummary: {
      healthScore: getHealthScoreLabel(overallScore),
      whatThisMeans: generateWhatThisMeans(overallScore, pillarScores),
      keyFindings: generateKeyFindings(pillarData),
      nextSteps: generateNextSteps(overallScore, pillarScores),
    },
    bookkeeperReport: {
      criticalIssues: generateCriticalIssues(pillarData, pillarScores),
      recommendedImprovements: generateRecommendedActions(pillarScores),
      ongoingMaintenance: generateDetailedFindings(pillarData),
    },
    assessmentMetadata: {
      assessmentDate: new Date().toISOString().split('T')[0],
      dataPeriod: `${meta.start_date} to ${meta.end_date} (${meta.windowDays} days)`,
      scoringModel: "5-Pillar Webhook Analysis Framework",
      limitations: [],
    },
  };
}

// =================================================================================
// INDIVIDUAL PILLAR SCORING
// =================================================================================

/**
 * Score reconciliation pillar (Accuracy & Reliability - 25% weight)
 */
function calculateReconciliationScore(reconciliation: WebhookPillarData['reconciliation']): number {
  if (!reconciliation?.variance) return 30; // No data penalty
  
  let score = 100;
  let penalties = 0;
  
  // Analyze variances for each account
  reconciliation.variance.forEach(account => {
    const variance = Math.abs(account.varianceBookVsCleared);
    
    // Apply penalties based on variance magnitude
    if (variance > 10000) penalties += 25;      // Major variance
    else if (variance > 1000) penalties += 15;  // Moderate variance  
    else if (variance > 100) penalties += 5;    // Minor variance
  });
  
  // Check for cleared column availability
  if (!reconciliation.clearedColumnFound) {
    penalties += 20; // No reconciliation data available
  }
  
  // Calculate final score
  score = Math.max(0, score - penalties);
  return Math.min(100, score);
}

/**
 * Score chart of accounts integrity (Completeness - 20% weight)
 */
function calculateChartIntegrityScore(chartIntegrity: WebhookPillarData['chartIntegrity']): number {
  if (!chartIntegrity) return 30;
  
  let score = 100;
  const totalAccounts = chartIntegrity.totals?.accounts || 0;
  
  if (totalAccounts === 0) return 30; // No accounts
  
  // Penalize duplicate names
  const duplicateNameCount = chartIntegrity.duplicates?.name?.length || 0;
  score -= duplicateNameCount * 10;
  
  // Penalize duplicate account numbers  
  const duplicateNumberCount = chartIntegrity.duplicates?.acctNum?.length || 0;
  score -= duplicateNumberCount * 15;
  
  // Penalize missing detail accounts
  const missingDetailCount = chartIntegrity.missingDetail?.length || 0;
  score -= missingDetailCount * 5;
  
  // Penalize sub-accounts without parents
  const orphanedSubAccounts = chartIntegrity.subAccountsMissingParent?.length || 0;
  score -= orphanedSubAccounts * 8;
  
  return Math.max(30, Math.min(100, score));
}

/**
 * Score transaction categorization (Compliance - 20% weight)
 */
function calculateCategorizationScore(categorization: WebhookPillarData['categorization']): number {
  if (!categorization?.uncategorized) return 70; // Assume good if no data
  
  let score = 100;
  const uncategorized = categorization.uncategorized;
  
  // Calculate total uncategorized amounts
  const totalUncategorized = 
    (uncategorized['Uncategorized Expense']?.amount || 0) +
    (uncategorized['Uncategorized Income']?.amount || 0) +
    (uncategorized['Uncategorized Asset']?.amount || 0) +
    (uncategorized['Ask My Accountant']?.amount || 0);
    
  // Apply penalties based on uncategorized amounts
  if (totalUncategorized > 10000) score -= 40;      // Major uncategorized
  else if (totalUncategorized > 5000) score -= 25;  // Moderate uncategorized
  else if (totalUncategorized > 1000) score -= 15;  // Minor uncategorized
  else if (totalUncategorized > 100) score -= 5;    // Minimal uncategorized
  
  // Count penalties for transaction counts
  const totalUncategorizedCount =
    (uncategorized['Uncategorized Expense']?.count || 0) +
    (uncategorized['Uncategorized Income']?.count || 0) +
    (uncategorized['Uncategorized Asset']?.count || 0) +
    (uncategorized['Ask My Accountant']?.count || 0);
    
  if (totalUncategorizedCount > 50) score -= 20;
  else if (totalUncategorizedCount > 20) score -= 10;
  else if (totalUncategorizedCount > 10) score -= 5;
  
  return Math.max(30, Math.min(100, score));
}

/**
 * Score control accounts (Consistency - 15% weight)
 */
function calculateControlAccountScore(controlAccounts: WebhookPillarData['controlAccounts']): number {
  if (!controlAccounts) return 50;
  
  let score = 100;
  
  // Opening Balance Equity should be zero in mature companies
  const obeBalance = Math.abs(controlAccounts.openingBalanceEquity?.balance || 0);
  if (obeBalance > 10000) score -= 30;
  else if (obeBalance > 1000) score -= 15;
  else if (obeBalance > 100) score -= 5;
  
  // Undeposited Funds should not be excessive
  const undepositedBalance = Math.abs(controlAccounts.undepositedFunds?.balance || 0);
  if (undepositedBalance > 5000) score -= 20;
  else if (undepositedBalance > 1000) score -= 10;
  
  // Journal entries to AR/AP indicate manual manipulation
  const journalEntries = controlAccounts.journalEntriesToARorAP || 0;
  if (journalEntries > 10) score -= 25;
  else if (journalEntries > 5) score -= 15;
  else if (journalEntries > 0) score -= 5;
  
  return Math.max(30, Math.min(100, score));
}

/**
 * Score AR/AP validity (Combined Timeliness + Integrity - 20% weight)
 */
function calculateArApValidityScore(arApValidity: WebhookPillarData['arApValidity']): number {
  if (!arApValidity) return 60;
  
  let score = 100;
  
  // Analyze AR aging
  if (arApValidity.arAging) {
    const totalAR = Object.values(arApValidity.arAging).reduce((sum, val) => sum + val, 0);
    if (totalAR > 0) {
      const over90 = (arApValidity.arAging.d90_plus || 0) / totalAR;
      const over60 = ((arApValidity.arAging.d61_90 || 0) + (arApValidity.arAging.d90_plus || 0)) / totalAR;
      
      if (over90 > 0.3) score -= 30;        // Over 30% is 90+ days old
      else if (over90 > 0.15) score -= 15;  // Over 15% is 90+ days old
      else if (over60 > 0.4) score -= 10;   // Over 40% is 60+ days old
    }
  }
  
  // Analyze AP aging
  if (arApValidity.apAging) {
    const totalAP = Object.values(arApValidity.apAging).reduce((sum, val) => sum + val, 0);
    if (totalAP > 0) {
      const over90 = (arApValidity.apAging.d90_plus || 0) / totalAP;
      
      if (over90 > 0.2) score -= 20;        // Over 20% AP over 90 days is concerning
      else if (over90 > 0.1) score -= 10;   // Over 10% AP over 90 days
    }
  }
  
  return Math.max(30, Math.min(100, score));
}

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================

function getReadinessStatus(score: number): "READY_FOR_MONTHLY_OPERATIONS" | "MINOR_FIXES_NEEDED" | "ADDITIONAL_CLEANUP_REQUIRED" {
  if (score >= SCORE_THRESHOLDS.excellent) return 'READY_FOR_MONTHLY_OPERATIONS';
  if (score >= SCORE_THRESHOLDS.good) return 'MINOR_FIXES_NEEDED';
  return 'ADDITIONAL_CLEANUP_REQUIRED';
}

function getHealthScoreLabel(score: number): string {
  if (score >= 90) return 'EXCELLENT - Minimal cleanup required';
  if (score >= 75) return 'GOOD - Minor adjustments needed';
  if (score >= 60) return 'FAIR - Moderate cleanup required';
  if (score >= 50) return 'POOR - Significant work needed';
  return 'CRITICAL - Extensive remediation required';
}

function generateWhatThisMeans(score: number, pillars: Record<string, number>): string {
  const lowest = Object.entries(pillars).reduce((min, [key, value]) => 
    value < min.score ? { pillar: key, score: value } : min, 
    { pillar: '', score: 100 }
  );
  
  return `Your books scored ${score}/100. The ${lowest.pillar} pillar (${lowest.score}/100) needs the most attention. ${
    score >= 75 
      ? 'Overall your books are in good shape with minor improvements needed.'
      : score >= 50
        ? 'Your books need moderate attention to improve accuracy and compliance.'
        : 'Your books require significant remediation work before they are audit-ready.'
  }`;
}

function generateKeyFindings(pillarData: WebhookPillarData): string[] {
  const findings: string[] = [];
  
  // Reconciliation findings
  if (pillarData.reconciliation?.variance) {
    const majorVariances = pillarData.reconciliation.variance.filter(
      acc => Math.abs(acc.varianceBookVsCleared) > 1000
    ).length;
    if (majorVariances > 0) {
      findings.push(`${majorVariances} bank account(s) have significant reconciliation variances`);
    }
  }
  
  // Chart integrity findings
  if (pillarData.chartIntegrity?.duplicates) {
    const duplicates = (pillarData.chartIntegrity.duplicates.name?.length || 0) +
                      (pillarData.chartIntegrity.duplicates.acctNum?.length || 0);
    if (duplicates > 0) {
      findings.push(`${duplicates} duplicate account names or numbers found`);
    }
  }
  
  // Categorization findings
  if (pillarData.categorization?.uncategorized) {
    const uncatExpense = pillarData.categorization.uncategorized['Uncategorized Expense']?.amount || 0;
    if (uncatExpense > 100) {
      findings.push(`$${uncatExpense.toFixed(2)} in uncategorized expenses needs review`);
    }
  }
  
  return findings.length ? findings : ['No major issues found in the analyzed data'];
}

function generateNextSteps(score: number, pillars: Record<string, number>): string[] {
  const steps: string[] = [];
  
  if (pillars.reconciliation < 70) {
    steps.push('Complete bank reconciliations for all accounts');
  }
  
  if (pillars.categorization < 70) {
    steps.push('Review and properly categorize uncategorized transactions');
  }
  
  if (pillars.coaIntegrity < 70) {
    steps.push('Clean up duplicate accounts and organize chart of accounts');
  }
  
  if (pillars.controlAccount < 70) {
    steps.push('Review and clear Opening Balance Equity and control accounts');
  }
  
  if (pillars.aging < 70) {
    steps.push('Follow up on aging receivables and review payables');
  }
  
  return steps.length ? steps : ['Maintain current book quality with regular reviews'];
}

function generateCriticalIssues(pillarData: WebhookPillarData, scores: Record<string, number>): Array<{
  priority: number;
  pillar: string;
  issue: string;
  qboLocation: string;
  fixSteps: string;
  estimatedTime: string;
}> {
  const issues: Array<{
    priority: number;
    pillar: string;
    issue: string;
    qboLocation: string;
    fixSteps: string;
    estimatedTime: string;
  }> = [];
  
  // Critical reconciliation issues
  if (scores.reconciliation < 50 && pillarData.reconciliation?.variance) {
    const majorVariances = pillarData.reconciliation.variance.filter(
      acc => Math.abs(acc.varianceBookVsCleared) > 5000
    );
    majorVariances.forEach(acc => {
      issues.push({
        priority: 1,
        pillar: "Reconciliation",
        issue: `Bank reconciliation variance of $${Math.abs(acc.varianceBookVsCleared).toFixed(2)}`,
        qboLocation: `Banking > ${acc.account}`,
        fixSteps: 'Complete bank reconciliation and resolve outstanding items',
        estimatedTime: '2-4 hours'
      });
    });
  }
  
  // Critical categorization issues  
  if (scores.categorization < 50 && pillarData.categorization?.uncategorized) {
    const uncatExpense = pillarData.categorization.uncategorized['Uncategorized Expense'];
    if (uncatExpense && uncatExpense.amount > 1000) {
      issues.push({
        priority: 1,
        pillar: "Categorization",
        issue: `$${uncatExpense.amount.toFixed(2)} in uncategorized expenses`,
        qboLocation: 'Chart of Accounts > Uncategorized Expense',
        fixSteps: 'Review and properly categorize all uncategorized transactions',
        estimatedTime: '3-5 hours'
      });
    }
  }
  
  return issues;
}

function generateDetailedFindings(pillarData: WebhookPillarData): string[] {
  return [
    `${pillarData.chartIntegrity?.totals?.accounts || 0} total accounts in chart of accounts`,
    `${pillarData.reconciliation?.variance?.length || 0} bank accounts analyzed for reconciliation`,
    `Control account balances reviewed for accuracy and consistency`,
    `AR/AP aging analysis completed for ${new Date().toLocaleDateString()}`,
  ];
}

function generateRecommendedActions(scores: Record<string, number>): string[] {
  const actions: string[] = [];
  
  Object.entries(scores).forEach(([pillar, score]) => {
    if (score < 70) {
      switch (pillar) {
        case 'reconciliation':
          actions.push('Prioritize completing bank reconciliations');
          break;
        case 'categorization':
          actions.push('Schedule time to categorize transactions properly');
          break;
        case 'coaIntegrity':
          actions.push('Organize and clean up chart of accounts structure');
          break;
        case 'controlAccount':
          actions.push('Review and clear control account balances');
          break;
        case 'aging':
          actions.push('Follow up on aging receivables and payables');
          break;
      }
    }
  });
  
  return actions;
}

// =================================================================================
// FINANCIAL METRICS EXTRACTION
// =================================================================================

/**
 * Extract key financial metrics from pillar data for display
 */
export function extractFinancialMetrics(webhookData: WebhookResponse) {
  const { pillarData, meta } = webhookData;
  
  // Calculate data completeness score based on available data
  const assessment = calculateAssessmentFromPillars(webhookData);
  
  return {
    dateRange: {
      start: meta.start_date,
      end: meta.end_date,
    },
    windowDays: meta.windowDays,
    bankAccounts: pillarData.reconciliation?.variance?.length || 0,
    totalAccounts: pillarData.chartIntegrity?.totals?.accounts || 0,
    arBalance: pillarData.controlAccounts?.ar?.balance || 0,
    apBalance: pillarData.controlAccounts?.ap?.balance || 0,
    obeBalance: pillarData.controlAccounts?.openingBalanceEquity?.balance || 0,
    undepositedFunds: pillarData.controlAccounts?.undepositedFunds?.balance || 0,
    uncategorizedExpense: pillarData.categorization?.uncategorized?.['Uncategorized Expense']?.amount || 0,
    duplicateAccounts: (pillarData.chartIntegrity?.duplicates?.name?.length || 0) + 
                      (pillarData.chartIntegrity?.duplicates?.acctNum?.length || 0),
    dataCompletenessScore: assessment.overallScore,
  };
}

/**
 * Export service
 */
export const PillarScoringService = {
  calculateAssessmentFromPillars,
  extractFinancialMetrics,
};