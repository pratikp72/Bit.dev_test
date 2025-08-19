import { logger } from '../lib/logger';
import { WebhookResponse } from './qboPillarsWebhookService';

interface LLMInputData {
  webhookData: WebhookResponse;
  calculatedAssessment: any;
  formattedDate: string;
  companyName: string;
}

export class LLMInputFormatter {
  /**
   * Formats data in plaintext/markdown format for USER VIEWING and PDF generation
   * NOTE: This is NOT for sending to the LLM API - the LLM needs structured JSON data
   * This is what users will see and can download as .md or view as PDF
   */
  static formatForLLM(data: LLMInputData): string {
    const { webhookData, calculatedAssessment, formattedDate, companyName } = data;
    
    if (!webhookData?.pillarData) {
      logger.error('Missing webhook pillar data for LLM formatting');
      throw new Error('Missing required pillar data');
    }

    const output = [];
    
    // Header
    output.push('# QuickBooks Online Financial Data Analysis');
    output.push(`Company: ${companyName}`);
    output.push(`Assessment Date: ${formattedDate}`);
    output.push(`Data Period: ${webhookData.meta.start_date} to ${webhookData.meta.end_date} (${webhookData.meta.windowDays} days)`);
    output.push('');
    output.push('---');
    output.push('');
    
    // Pillar 1: Bank & Credit Card Reconciliation
    output.push('## PILLAR 1: BANK & CREDIT CARD RECONCILIATION');
    output.push('');
    
    const recon = webhookData.pillarData.reconciliation;
    output.push(`Total Bank/CC Accounts: ${recon.variance?.length || 0}`);
    output.push(`Transactions Processed: ${recon.totalTransactionsProcessed || 0}`);
    output.push(`Has Transaction Data: ${recon.hasTransactionData ? 'Yes' : 'No'}`);
    output.push('');
    
    output.push('### Account Variance Analysis:');
    if (recon.variance && recon.variance.length > 0) {
      recon.variance.forEach((acc: any) => {
        output.push(`- ${acc.account}:`);
        output.push(`  - Book Ending Balance: $${acc.bookEndingBalance.toFixed(2)}`);
        output.push(`  - Cleared Amount: $${acc.clearedAmount.toFixed(2)}`);
        output.push(`  - Uncleared Amount: $${acc.unclearedAmount.toFixed(2)}`);
        output.push(`  - Variance: $${acc.varianceBookVsCleared.toFixed(2)}`);
      });
    } else {
      output.push('No variance data available');
    }
    output.push('');
    
    // Pillar 2: Chart of Accounts Integrity
    output.push('## PILLAR 2: CHART OF ACCOUNTS INTEGRITY');
    output.push('');
    
    const coa = webhookData.pillarData.chartIntegrity;
    output.push(`Total Accounts: ${coa.totals.accounts}`);
    output.push(`Duplicate Account Names: ${coa.duplicates.name.length}`);
    if (coa.duplicates.name.length > 0) {
      output.push(`  - Duplicates: ${coa.duplicates.name.join(', ')}`);
    }
    output.push(`Duplicate Account Numbers: ${coa.duplicates.acctNum.length}`);
    output.push(`Accounts Missing Details: ${coa.missingDetail.length}`);
    output.push(`Sub-accounts Missing Parent: ${coa.subAccountsMissingParent.length}`);
    output.push('');
    
    // Pillar 3: Transaction Categorization
    output.push('## PILLAR 3: TRANSACTION CATEGORIZATION');
    output.push('');
    
    const categ = webhookData.pillarData.categorization;
    output.push('### Uncategorized Transactions:');
    Object.entries(categ.uncategorized).forEach(([category, data]: [string, any]) => {
      output.push(`- ${category}:`);
      output.push(`  - Count: ${data.count}`);
      output.push(`  - Amount: $${data.amount.toFixed(2)}`);
    });
    output.push('');
    
    // Pillar 4: Control Account Accuracy
    output.push('## PILLAR 4: CONTROL ACCOUNT ACCURACY');
    output.push('');
    
    const control = webhookData.pillarData.controlAccounts;
    output.push(`Opening Balance Equity: $${control.openingBalanceEquity.balance.toFixed(2)}`);
    output.push(`Undeposited Funds: $${control.undepositedFunds.balance.toFixed(2)}`);
    output.push(`Accounts Receivable: $${control.ar.balance.toFixed(2)}`);
    output.push(`Accounts Payable: $${control.ap.balance.toFixed(2)}`);
    output.push(`Journal Entries to AR/AP: ${control.journalEntriesToARorAP}`);
    output.push('');
    
    // Validation data may not always be present
    output.push('');
    
    // Pillar 5: A/R & A/P Validity
    output.push('## PILLAR 5: ACCOUNTS RECEIVABLE & PAYABLE VALIDITY');
    output.push('');
    
    const aging = webhookData.pillarData.arApValidity;
    output.push('### Accounts Receivable Aging:');
    output.push(`- Current: $${aging.arAging.current.toFixed(2)}`);
    output.push(`- 1-30 days: $${aging.arAging.d1_30.toFixed(2)}`);
    output.push(`- 31-60 days: $${aging.arAging.d31_60.toFixed(2)}`);
    output.push(`- 61-90 days: $${aging.arAging.d61_90.toFixed(2)}`);
    output.push(`- Over 90 days: $${aging.arAging.d90_plus.toFixed(2)}`);
    const arTotal = aging.arAging.current + aging.arAging.d1_30 + aging.arAging.d31_60 + aging.arAging.d61_90 + aging.arAging.d90_plus;
    output.push(`- Total: $${arTotal.toFixed(2)}`);
    output.push('');
    
    output.push('### Accounts Payable Aging:');
    output.push(`- Current: $${aging.apAging.current.toFixed(2)}`);
    output.push(`- 1-30 days: $${aging.apAging.d1_30.toFixed(2)}`);
    output.push(`- 31-60 days: $${aging.apAging.d31_60.toFixed(2)}`);
    output.push(`- 61-90 days: $${aging.apAging.d61_90.toFixed(2)}`);
    output.push(`- Over 90 days: $${aging.apAging.d90_plus.toFixed(2)}`);
    const apTotal = aging.apAging.current + aging.apAging.d1_30 + aging.apAging.d31_60 + aging.apAging.d61_90 + aging.apAging.d90_plus;
    output.push(`- Total: $${apTotal.toFixed(2)}`);
    output.push('');
    
    // Data Quality Summary - removed as it's not part of WebhookPillarData type
    output.push('');
    
    // Calculated Assessment Summary
    output.push('## CALCULATED ASSESSMENT SCORES');
    output.push('');
    
    if (calculatedAssessment) {
      output.push(`Overall Score: ${calculatedAssessment.overallScore}/100`);
      output.push(`Readiness Status: ${calculatedAssessment.readinessStatus}`);
      output.push('');
      
      output.push('### Pillar Scores:');
      output.push(`- Bank & Credit Card Reconciliation: ${calculatedAssessment.pillarScores.reconciliation}/100`);
      output.push(`- Chart of Accounts Integrity: ${calculatedAssessment.pillarScores.coaIntegrity}/100`);
      output.push(`- Transaction Categorization: ${calculatedAssessment.pillarScores.categorization}/100`);
      output.push(`- Control Account Accuracy: ${calculatedAssessment.pillarScores.controlAccount}/100`);
      output.push(`- A/R & A/P Validity: ${calculatedAssessment.pillarScores.aging}/100`);
    }
    output.push('');
    
    output.push('---');
    output.push('');
    output.push('*This data is being sent to the AI for hygiene assessment analysis*');
    
    return output.join('\n');
  }

  /**
   * Converts the formatted text to a downloadable blob
   */
  static createDownloadBlob(formattedText: string, format: 'txt' | 'md' = 'md'): Blob {
    const mimeType = format === 'md' ? 'text/markdown' : 'text/plain';
    return new Blob([formattedText], { type: mimeType });
  }

  /**
   * Triggers download of the LLM input data
   */
  static downloadLLMInput(data: LLMInputData, format: 'txt' | 'md' = 'md'): void {
    try {
      const formattedText = this.formatForLLM(data);
      const blob = this.createDownloadBlob(formattedText, format);
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `llm-input-data-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      logger.info('LLM input data downloaded successfully');
    } catch (error) {
      logger.error('Failed to download LLM input data', error);
      throw error;
    }
  }

  /**
   * Sends the LLM input data to PDF API for viewing/downloading
   */
  static async sendToPDFAPI(data: LLMInputData): Promise<{ url?: string; error?: string }> {
    const pdfApiUrl = import.meta.env.VITE_PDF_API_URL;
    
    if (!pdfApiUrl) {
      logger.error('PDF API URL not configured');
      return { error: 'PDF API URL not configured' };
    }

    try {
      const formattedText = this.formatForLLM(data);
      
      // Send markdown directly as plain text, matching pdfGenerationService format
      const response = await fetch(pdfApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: formattedText,
      });

      if (!response.ok) {
        throw new Error(`PDF API returned ${response.status}`);
      }

      // Check response content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        logger.error('Invalid response type from PDF API', { contentType });
        throw new Error(`Invalid response type: ${contentType}`);
      }

      // Get PDF blob from response
      const pdfBlob = await response.blob();
      
      // Validate blob size
      if (pdfBlob.size === 0) {
        throw new Error('PDF API returned empty response');
      }
      
      // Create object URL for viewing
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Clean up URL after 1 minute
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
      
      logger.info('LLM input data sent to PDF API successfully', { size: pdfBlob.size });
      return { url: pdfUrl };
      
    } catch (error) {
      logger.error('Failed to send LLM input data to PDF API', error);
      return { error: error instanceof Error ? error.message : 'Failed to generate PDF' };
    }
  }
}