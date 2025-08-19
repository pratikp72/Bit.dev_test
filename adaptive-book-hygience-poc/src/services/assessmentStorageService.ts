/**
 * @file assessmentStorageService.ts
 * @description Service for ephemeral storage and PDF generation of assessment results.
 * 
 * Stores assessment results temporarily in sessionStorage until logout or cache cleared.
 * Provides PDF generation functionality by converting markdown to HTML to PDF.
 */

import { HygieneAssessmentResult } from "./perplexityService";
import { PDFApiService } from "./pdfApiService";
import { logger } from "../lib/logger";

// =================================================================================
// INTERFACE DEFINITIONS
// =================================================================================

export interface StoredAssessmentData {
  assessmentResults: HygieneAssessmentResult;
  rawLLMResponse: string; // The first choice message from Perplexity
  generatedAt: string;
  companyName: string;
  assessmentId: string;
}


// =================================================================================
// ASSESSMENT STORAGE SERVICE
// =================================================================================

export class AssessmentStorageService {
  private static readonly STORAGE_KEY = "hygiene_assessment_data";

  /**
   * Stores assessment results ephemerally in sessionStorage.
   */
  public static storeAssessmentResults(
    assessmentResults: HygieneAssessmentResult,
    rawLLMResponse: string,
    companyName: string
  ): string {
    const assessmentId = `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const storedData: StoredAssessmentData = {
      assessmentResults,
      rawLLMResponse,
      generatedAt: new Date().toISOString(),
      companyName,
      assessmentId
    };

    try {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedData));
      logger.info("Assessment results stored successfully", { assessmentId });
      return assessmentId;
    } catch (error) {
      logger.error("Failed to store assessment results", error);
      throw new Error("Failed to store assessment results");
    }
  }

  /**
   * Retrieves stored assessment results from sessionStorage.
   */
  public static getStoredAssessmentResults(): StoredAssessmentData | null {
    try {
      const stored = sessionStorage.getItem(this.STORAGE_KEY);
      if (!stored) {
        return null;
      }

      const data: StoredAssessmentData = JSON.parse(stored);
      logger.debug("Retrieved stored assessment results", { assessmentId: data.assessmentId });
      return data;
    } catch (error) {
      logger.error("Failed to retrieve stored assessment results", error);
      return null;
    }
  }

  /**
   * Checks if assessment results are currently stored.
   */
  public static hasStoredResults(): boolean {
    return sessionStorage.getItem(this.STORAGE_KEY) !== null;
  }

  /**
   * Clears stored assessment results.
   */
  public static clearStoredResults(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    logger.info("Stored assessment results cleared");
  }

  /**
   * Formats the raw LLM response for PDF generation.
   */
  public static formatResponseForPDF(storedData: StoredAssessmentData): string {
    const { assessmentResults, companyName, generatedAt } = storedData;
    
    // Create a comprehensive markdown report
    const markdown = `# Financial Books Hygiene Assessment Report

**Company:** ${companyName}  
**Assessment Date:** ${new Date(generatedAt).toLocaleDateString()}  
**Assessment ID:** ${storedData.assessmentId}

---

## Executive Summary

**Overall Health Score:** ${assessmentResults.overallScore}/100  
**Readiness Status:** ${assessmentResults.readinessStatus.replace(/_/g, ' ')}

### What This Means for Your Business

${assessmentResults.businessOwnerSummary.whatThisMeans}

### Key Findings

${assessmentResults.businessOwnerSummary.keyFindings.map(finding => `• ${finding}`).join('\n')}

### Recommended Next Steps

${assessmentResults.businessOwnerSummary.nextSteps.map(step => `• ${step}`).join('\n')}

---

## Day-30 Readiness Assessment Breakdown

### Pillar Scores

| Pillar | Score | Weight |
|--------|-------|---------|
| Bank & Credit Card Reconciliation | ${assessmentResults.pillarScores.reconciliation}% | 30% |
| Chart of Accounts Integrity | ${assessmentResults.pillarScores.coaIntegrity}% | 20% |
| Transaction Categorization | ${assessmentResults.pillarScores.categorization}% | 20% |
| Control Account Accuracy | ${assessmentResults.pillarScores.controlAccount}% | 15% |
| A/R & A/P Validity | ${assessmentResults.pillarScores.aging}% | 15% |

---

## Technical Remediation Plan (For Bookkeepers)

### Critical Issues Requiring Immediate Action

${assessmentResults.bookkeeperReport.criticalIssues.map((issue, index) => `
#### Issue ${index + 1}: ${issue.issue}

**Priority:** ${issue.priority}  
**Location in QBO:** ${issue.qboLocation}  
**Estimated Time:** ${issue.estimatedTime}

**Fix Steps:**
${issue.fixSteps}

---
`).join('')}

### Recommended Improvements

${assessmentResults.bookkeeperReport.recommendedImprovements.map(improvement => `• ${improvement}`).join('\n')}

### Ongoing Maintenance Requirements

${assessmentResults.bookkeeperReport.ongoingMaintenance.map(maintenance => `• ${maintenance}`).join('\n')}

---

## Assessment Methodology

**Scoring Model:** ${assessmentResults.assessmentMetadata.scoringModel}  
**Data Period Analyzed:** ${assessmentResults.assessmentMetadata.dataPeriod}  

${assessmentResults.assessmentMetadata.limitations && assessmentResults.assessmentMetadata.limitations.length > 0 ? `
### Assessment Limitations

${assessmentResults.assessmentMetadata.limitations.map(limitation => `• ${limitation}`).join('\n')}
` : ''}

---

*This report was generated using advanced AI analysis following established CPA standards and the Day-30 Readiness Framework for bookkeeping assessment.*

*Generated on: ${new Date().toLocaleString()}*
`;

    return markdown;
  }

  /**
   * Generates a PDF from the stored assessment results.
   */
  public static async generatePDF(storedData: StoredAssessmentData): Promise<Blob> {
    logger.info("Starting PDF generation", { assessmentId: storedData.assessmentId });

    try {
      // Format the assessment data as markdown
      const markdown = this.formatResponseForPDF(storedData);
      
      // Prepare the PDF generation request
      const pdfRequest = {
        markdown,
        filename: `${storedData.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_hygiene_assessment.pdf`,
        companyName: storedData.companyName,
        assessmentDate: storedData.generatedAt
      };

      // Use the PDF API service with automatic fallback
      const pdfBlob = await PDFApiService.generatePDFWithFallback(pdfRequest);
      
      logger.info("PDF generated successfully", { 
        assessmentId: storedData.assessmentId,
        size: pdfBlob.size 
      });

      return pdfBlob;

    } catch (error) {
      logger.error("PDF generation failed", error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Downloads the PDF report.
   */
  public static async downloadPDFReport(): Promise<void> {
    const storedData = this.getStoredAssessmentResults();
    if (!storedData) {
      throw new Error("No assessment results available for PDF generation");
    }

    try {
      const pdfBlob = await this.generatePDF(storedData);
      
      // Create download link
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${storedData.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_hygiene_assessment.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      logger.info("PDF report downloaded successfully");

    } catch (error) {
      logger.error("PDF download failed", error);
      throw error;
    }
  }

  /**
   * Opens the PDF report in a new tab.
   */
  public static async viewPDFReport(): Promise<void> {
    const storedData = this.getStoredAssessmentResults();
    if (!storedData) {
      throw new Error("No assessment results available for PDF generation");
    }

    try {
      const pdfBlob = await this.generatePDF(storedData);
      
      // Create object URL and open in new tab
      const url = URL.createObjectURL(pdfBlob);
      const newTab = window.open(url, '_blank');
      
      if (!newTab) {
        throw new Error("Failed to open PDF in new tab - popup blocked?");
      }

      // Clean up URL after a delay to allow the tab to load
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
      
      logger.info("PDF report opened in new tab");

    } catch (error) {
      logger.error("PDF viewing failed", error);
      throw error;
    }
  }

  /**
   * Gets assessment summary for UI display.
   */
  public static getAssessmentSummary(): {
    hasResults: boolean;
    companyName?: string;
    assessmentDate?: string;
    overallScore?: number;
    assessmentId?: string;
  } {
    const storedData = this.getStoredAssessmentResults();
    
    if (!storedData) {
      return { hasResults: false };
    }

    return {
      hasResults: true,
      companyName: storedData.companyName,
      assessmentDate: new Date(storedData.generatedAt).toLocaleDateString(),
      overallScore: storedData.assessmentResults.overallScore,
      assessmentId: storedData.assessmentId
    };
  }

  /**
   * Cleanup method to be called on app unmount or logout.
   */
  public static cleanup(): void {
    this.clearStoredResults();
    logger.info("Assessment storage cleanup completed");
  }
}