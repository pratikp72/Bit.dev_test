/**
 * @file pdfGenerationService.ts
 * @description Service for generating PDF reports from assessment data
 * 
 * This service integrates with the N8N webhook endpoint to convert
 * markdown-formatted assessment reports into PDF documents.
 */

import { HygieneAssessmentResult } from './perplexityService';
import logger from '../lib/logger';

// =================================================================================
// CONFIGURATION
// =================================================================================

const PDF_API_URL = import.meta.env.VITE_PDF_API_URL || 'https://n8n-1-102-1-c1zi.onrender.com/webhook/convert-pdf';
const PDF_TIMEOUT = 30000; // 30 seconds

// =================================================================================
// INTERFACES
// =================================================================================

export interface PDFGenerationOptions {
  action: 'download' | 'view';
  fileName?: string;
}

export interface PDFGenerationResult {
  success: boolean;
  pdfBlob?: Blob;
  pdfUrl?: string;
  error?: string;
}

// =================================================================================
// MAIN SERVICE CLASS
// =================================================================================

export class PDFGenerationService {
  /**
   * Generate markdown report from assessment results
   */
  private static generateMarkdownReport(
    assessmentResult: HygieneAssessmentResult,
    company: string
  ): string {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    });
    const formattedTime = currentDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Generate assessment ID
    const assessmentId = `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Format following the OUTPUT FORMAT SPECIFICATION from the prompt
    let markdown = `# FINANCIAL BOOKS HYGIENE ASSESSMENT REPORT

**Company:** ${company}  
**Assessment Date:** ${currentDate.toISOString()}

---

## SECTION 1: EXECUTIVE SUMMARY (Business Owner)

### FINANCIAL BOOKS HEALTH ASSESSMENT

**Overall Health Score:** ${assessmentResult.overallScore}/100 - ${assessmentResult.businessOwnerSummary.healthScore || assessmentResult.readinessStatus.replace(/_/g, ' ')}

### WHAT THIS MEANS FOR YOUR BUSINESS:

${assessmentResult.businessOwnerSummary.whatThisMeans}

### KEY FINDINGS:

${assessmentResult.businessOwnerSummary.keyFindings.map(finding => `• ${finding}`).join('\n')}

### RECOMMENDED NEXT STEPS:

${assessmentResult.businessOwnerSummary.nextSteps.map(step => `• ${step}`).join('\n')}

---

## SECTION 2: DETAILED ASSESSMENT RESULTS

### PILLAR BREAKDOWN:

• Bank & Credit Card Matching: ${assessmentResult.pillarScores.reconciliation}/100
• Money Organization System: ${assessmentResult.pillarScores.coaIntegrity}/100
• Transaction Categorization: ${assessmentResult.pillarScores.categorization}/100
• Control Account Accuracy: ${assessmentResult.pillarScores.controlAccount}/100
• Customer/Vendor Balances: ${assessmentResult.pillarScores.aging}/100

---

## SECTION 3: TECHNICAL REMEDIATION PLAN (Bookkeeper)

### CRITICAL ISSUES REQUIRING IMMEDIATE ACTION:

${assessmentResult.bookkeeperReport.criticalIssues.length > 0 
  ? assessmentResult.bookkeeperReport.criticalIssues.map(issue => 
      `**Priority ${issue.priority}: ${issue.pillar}**
• Problem: ${issue.issue}
• Location: ${issue.qboLocation}
• Fix: ${issue.fixSteps}
• Time: ${issue.estimatedTime}
`).join('\n')
  : 'No critical issues identified.'}

### RECOMMENDED IMPROVEMENTS:

${assessmentResult.bookkeeperReport.recommendedImprovements.length > 0
  ? assessmentResult.bookkeeperReport.recommendedImprovements.map(improvement => `• ${improvement}`).join('\n')
  : 'No additional improvements recommended at this time.'}

### ONGOING MAINTENANCE REQUIREMENTS:

${assessmentResult.bookkeeperReport.ongoingMaintenance.length > 0
  ? assessmentResult.bookkeeperReport.ongoingMaintenance.map(task => `• ${task}`).join('\n')
  : 'Standard monthly bookkeeping maintenance recommended.'}

---

## SECTION 4: SCORING TRANSPARENCY

### ASSESSMENT METHODOLOGY SUMMARY:

• Assessment Date: ${formattedDate}
• Data Period Analyzed: ${assessmentResult.assessmentMetadata.dataPeriod}
• Scoring Model: ${assessmentResult.assessmentMetadata.scoringModel || 'Day-30 Readiness Framework'}
• Repeatability: Same data will produce identical results
${assessmentResult.assessmentMetadata.limitations && assessmentResult.assessmentMetadata.limitations.length > 0 
  ? `• Limitations: ${assessmentResult.assessmentMetadata.limitations.join(', ')}`
  : ''}

---

*This report follows established CPA standards and the Day-30 Readiness Framework for bookkeeping assessment.*

**Assessment ID:** ${assessmentId}  
**Generated on:** ${formattedDate}, ${formattedTime}`;

    return markdown;
  }

  /**
   * Send markdown to PDF API and get PDF blob
   */
  private static async generatePDF(markdown: string): Promise<Blob> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PDF_TIMEOUT);

    try {
      const response = await fetch(PDF_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: markdown,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error(`Invalid response type: ${contentType}`);
      }

      return await response.blob();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('PDF generation timed out');
      }
      throw error;
    }
  }

  /**
   * Generate PDF report from assessment results
   */
  public static async generateReport(
    assessmentResult: HygieneAssessmentResult,
    company: string,
    options: PDFGenerationOptions
  ): Promise<PDFGenerationResult> {
    try {
      logger.info(`Generating PDF report for ${company} (${options.action})`);

      // Generate markdown report
      const markdown = this.generateMarkdownReport(assessmentResult, company);
      logger.debug('Markdown report generated', { length: markdown.length });

      // Send to PDF API
      const pdfBlob = await this.generatePDF(markdown);
      logger.info('PDF generated successfully', { size: pdfBlob.size });

      // Create object URL for viewing/downloading
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Handle action
      if (options.action === 'download') {
        // Create download link
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = options.fileName || `assessment_report_${company}_${Date.now()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up URL after download
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);
        
        return {
          success: true,
          pdfBlob
        };
      } else {
        // Open in new tab for viewing
        window.open(pdfUrl, '_blank');
        
        // Clean up URL after a delay
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000); // Keep for 1 minute
        
        return {
          success: true,
          pdfBlob,
          pdfUrl
        };
      }
    } catch (error) {
      logger.error('PDF generation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'PDF generation failed'
      };
    }
  }

  /**
   * Generate PDF for individual pillar data
   */
  public static async generatePillarPDF(pillarContent: {
    title: string;
    companyName: string;
    assessmentDate: string;
    data: any;
  }): Promise<Blob> {
    try {
      logger.info(`Generating PDF for pillar: ${pillarContent.title}`);
      
      // Generate markdown for the specific pillar
      let markdown = `# ${pillarContent.title} Report\n\n`;
      markdown += `**Company:** ${pillarContent.companyName}\n`;
      markdown += `**Assessment Date:** ${new Date(pillarContent.assessmentDate).toLocaleDateString()}\n\n`;
      markdown += '---\n\n';
      
      // Format the pillar data based on the type
      const pillarKey = Object.keys(pillarContent.data)[0];
      const pillarData = pillarContent.data[pillarKey];
      
      switch (pillarKey) {
        case 'reconciliation':
          markdown += '## Reconciliation Status\n\n';
          markdown += `**Cleared Column Found:** ${pillarData.clearedColumnFound ? 'Yes' : 'No'}\n\n`;
          markdown += `**Total Transactions Processed:** ${pillarData.totalTransactionsProcessed}\n\n`;
          markdown += `**Total Accounts Found:** ${pillarData.totalAccountsFound}\n\n`;
          
          if (pillarData.byAccount && pillarData.byAccount.length > 0) {
            markdown += '### Account Details\n\n';
            markdown += '| Account | Outstanding (30d+) | Cleared | Uncleared | Total Transactions |\n';
            markdown += '|---------|-------------------|---------|-----------|-------------------|\n';
            pillarData.byAccount.forEach((acc: any) => {
              markdown += `| ${acc.account} | $${acc.outstanding_30d_amount.toFixed(2)} (${acc.outstanding_30d_count} items) | $${acc.cleared_amount.toFixed(2)} | $${acc.uncleared_amount.toFixed(2)} | ${acc.txns} |\n`;
            });
            markdown += '\n';
          }
          
          if (pillarData.variance && pillarData.variance.length > 0) {
            markdown += '### Variance Analysis\n\n';
            markdown += '| Account | Book Balance | Cleared | Uncleared | Variance |\n';
            markdown += '|---------|-------------|---------|-----------|----------|\n';
            pillarData.variance.forEach((v: any) => {
              markdown += `| ${v.account} | $${v.bookEndingBalance.toFixed(2)} | $${v.clearedAmount.toFixed(2)} | $${v.unclearedAmount.toFixed(2)} | $${v.varianceBookVsCleared.toFixed(2)} |\n`;
            });
          }
          break;
          
        case 'chartIntegrity':
          markdown += '## Chart of Accounts Integrity\n\n';
          markdown += `**Total Accounts:** ${pillarData.totals.accounts}\n\n`;
          markdown += `**Duplicate Account Names:** ${pillarData.duplicates.name.length}\n\n`;
          markdown += `**Duplicate Account Numbers:** ${pillarData.duplicates.acctNum.length}\n\n`;
          markdown += `**Accounts Missing Details:** ${pillarData.missingDetail.length}\n\n`;
          markdown += `**Sub-accounts Missing Parent:** ${pillarData.subAccountsMissingParent.length}\n\n`;
          
          if (pillarData.duplicates.name.length > 0) {
            markdown += '### Duplicate Account Names\n\n';
            pillarData.duplicates.name.forEach((name: string) => {
              markdown += `• ${name}\n`;
            });
            markdown += '\n';
          }
          
          if (pillarData.missingDetail.length > 0) {
            markdown += '### Accounts Missing Details\n\n';
            pillarData.missingDetail.forEach((acc: any) => {
              markdown += `• ${acc.name} (ID: ${acc.id})\n`;
            });
          }
          break;
          
        case 'categorization':
          markdown += '## Transaction Categorization\n\n';
          markdown += '### Uncategorized Transactions\n\n';
          markdown += '| Category | Count | Amount |\n';
          markdown += '|----------|-------|--------|\n';
          Object.entries(pillarData.uncategorized).forEach(([category, info]: [string, any]) => {
            markdown += `| ${category} | ${info.count} | $${info.amount.toFixed(2)} |\n`;
          });
          break;
          
        case 'controlAccounts':
          markdown += '## Control Account Analysis\n\n';
          markdown += '### Account Balances\n\n';
          markdown += `**Opening Balance Equity:** $${pillarData.openingBalanceEquity.balance.toFixed(2)}\n\n`;
          markdown += `**Undeposited Funds:** $${pillarData.undepositedFunds.balance.toFixed(2)}\n\n`;
          markdown += `**Accounts Receivable:** $${pillarData.ar.balance.toFixed(2)}\n\n`;
          markdown += `**Accounts Payable:** $${pillarData.ap.balance.toFixed(2)}\n\n`;
          markdown += `**Journal Entries to AR/AP:** ${pillarData.journalEntriesToARorAP}\n`;
          break;
          
        case 'arApValidity':
          markdown += '## AR/AP Aging Analysis\n\n';
          markdown += '### Accounts Receivable Aging\n\n';
          markdown += '| Period | Amount |\n';
          markdown += '|--------|--------|\n';
          markdown += `| Current | $${pillarData.arAging.current.toFixed(2)} |\n`;
          markdown += `| 1-30 days | $${pillarData.arAging.d1_30.toFixed(2)} |\n`;
          markdown += `| 31-60 days | $${pillarData.arAging.d31_60.toFixed(2)} |\n`;
          markdown += `| 61-90 days | $${pillarData.arAging.d61_90.toFixed(2)} |\n`;
          markdown += `| 90+ days | $${pillarData.arAging.d90_plus.toFixed(2)} |\n\n`;
          
          markdown += '### Accounts Payable Aging\n\n';
          markdown += '| Period | Amount |\n';
          markdown += '|--------|--------|\n';
          markdown += `| Current | $${pillarData.apAging.current.toFixed(2)} |\n`;
          markdown += `| 1-30 days | $${pillarData.apAging.d1_30.toFixed(2)} |\n`;
          markdown += `| 31-60 days | $${pillarData.apAging.d31_60.toFixed(2)} |\n`;
          markdown += `| 61-90 days | $${pillarData.apAging.d61_90.toFixed(2)} |\n`;
          markdown += `| 90+ days | $${pillarData.apAging.d90_plus.toFixed(2)} |\n`;
          break;
      }
      
      markdown += '\n---\n\n';
      markdown += `*Generated on ${new Date().toLocaleString()}*`;
      
      // Generate PDF
      const pdfBlob = await this.generatePDF(markdown);
      logger.info('Pillar PDF generated successfully', { size: pdfBlob.size });
      
      return pdfBlob;
    } catch (error) {
      logger.error('Failed to generate pillar PDF', error);
      throw error;
    }
  }

  /**
   * Check if PDF API is available
   */
  public static async checkAPIHealth(): Promise<boolean> {
    try {
      const response = await fetch(PDF_API_URL, {
        method: 'HEAD'
      });
      return response.ok || response.status === 405; // 405 means endpoint exists but doesn't support HEAD
    } catch (error) {
      logger.error('PDF API health check failed', error);
      return false;
    }
  }
}

export default PDFGenerationService;