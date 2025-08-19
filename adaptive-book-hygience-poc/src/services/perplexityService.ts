import { logger } from "../lib/logger";
import { FivePillarRawData, RawDataFormatter } from "./rawDataFormatter";
import { LLMInputFormatter } from "./llmInputFormatter";

/**
 * @file perplexityService.ts
 * @description Service for integrating with Perplexity AI API to perform financial hygiene assessments.
 *
 * This service handles communication with the Perplexity LLM API, formatting financial data
 * for analysis, and parsing the structured assessment results according to the Day-30
 * Readiness Scoring Model.
 */

// =================================================================================
// TYPE DEFINITIONS & INTERFACES
// =================================================================================

/**
 * Interface for individual pillar scores in the assessment.
 */
export interface HygienePillarScores {
  reconciliation: number; // 0-100, weighted 30%
  coaIntegrity: number; // 0-100, weighted 20%
  categorization: number; // 0-100, weighted 20%
  controlAccount: number; // 0-100, weighted 15%
  aging: number; // 0-100, weighted 15%
}

/**
 * Interface for the complete hygiene assessment result.
 */
export interface HygieneAssessmentResult {
  overallScore: number; // 0-100 composite score
  pillarScores: HygienePillarScores;
  readinessStatus:
    | "READY_FOR_MONTHLY_OPERATIONS"
    | "MINOR_FIXES_NEEDED"
    | "ADDITIONAL_CLEANUP_REQUIRED";
  businessOwnerSummary: {
    healthScore: string;
    whatThisMeans: string;
    keyFindings: string[];
    nextSteps: string[];
  };
  bookkeeperReport: {
    criticalIssues: Array<{
      priority: number;
      pillar: string;
      issue: string;
      qboLocation: string;
      fixSteps: string;
      estimatedTime: string;
    }>;
    recommendedImprovements: string[];
    ongoingMaintenance: string[];
  };
  assessmentMetadata: {
    assessmentDate: string;
    dataPeriod: string;
    scoringModel: string;
    limitations?: string[];
  };
}

/**
 * Interface for the complete assessment response including raw LLM response.
 */
export interface CompleteAssessmentResponse {
  assessmentResult: HygieneAssessmentResult;
  rawLLMResponse: string; // The raw text response from Perplexity
  pdfUrl?: string; // Optional URL for PDF download
}

/**
 * Interface for QBO financial data package required for assessment.
 */
export interface QBODataPackage {
  bankReconciliation?: any[];
  generalLedger?: any;
  chartOfAccounts?: any[];
  trialBalance?: any;
  openingBalanceEquity?: any;
  undepositedFunds?: any[];
  arAging?: any;
  apAging?: any;
  auditLog?: any[];
  datePeriod: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Configuration for Perplexity API requests.
 */
interface PerplexityConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

/**
 * Custom error class for Perplexity API related issues.
 */
export class PerplexityError extends Error {
  constructor(
    public message: string,
    public statusCode?: number,
    public originalError?: any,
  ) {
    super(message);
    this.name = "PerplexityError";
  }
}

// =================================================================================
// PERPLEXITY SERVICE CLASS
// =================================================================================

export class PerplexityService {
  private readonly config: PerplexityConfig;
  private readonly API_BASE_URL = "https://api.perplexity.ai";

  constructor(config?: Partial<PerplexityConfig>) {
    logger.debug("Initializing PerplexityService...");

    const apiKey = import.meta.env.VITE_PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new PerplexityError(
        "VITE_PERPLEXITY_API_KEY environment variable is not set.",
      );
    }

    this.config = {
      apiKey,
      model:
        import.meta.env.VITE_PERPLEXITY_MODEL ||
        config?.model ||
        "sonar-reasoning-pro",
      maxTokens: config?.maxTokens || 4000,
      temperature: config?.temperature || 0.1, // Low temperature for consistent analysis
      timeout: config?.timeout || 60000, // 60 seconds for complex analysis
      ...config,
    };

    logger.info("PerplexityService initialized successfully");
  }

  /**
   * Generate health score label based on numeric score
   */
  private getHealthScoreLabel(score: number): string {
    if (score >= 90) return "EXCELLENT - Minimal cleanup required";
    if (score >= 75) return "GOOD - Minor adjustments needed";
    if (score >= 60) return "FAIR - Moderate cleanup required";
    if (score >= 50) return "POOR - Significant work needed";
    return "CRITICAL - Extensive remediation required";
  }

  /**
   * Loads the hygiene assessment prompt from the public directory.
   */
  private async loadAssessmentPrompt(): Promise<string> {
    try {
      const response = await fetch("/hygiene-assessment-prompt.txt");
      if (!response.ok) {
        throw new PerplexityError(
          `Failed to load assessment prompt: ${response.statusText}`,
        );
      }
      return await response.text();
    } catch (error) {
      logger.error("Failed to load hygiene assessment prompt", error);
      throw new PerplexityError(
        "Unable to load assessment prompt template",
        undefined,
        error,
      );
    }
  }

  /**
   * Formats QBO data for LLM analysis - passes raw QBO data
   */
  private formatQBODataForAnalysis(data: QBODataPackage): string {
    // Just pass the entire raw data object to the LLM
    return (
      "=== QUICKBOOKS ONLINE DATA FOR ANALYSIS ===\n\n" +
      `Data Period: ${data.datePeriod?.startDate} to ${data.datePeriod?.endDate}\n\n` +
      "INSTRUCTIONS FOR ANALYSIS:\n" +
      "1. Calculate scores based on actual data quality and completeness\n" +
      "2. Identify specific issues with exact dollar amounts and account names\n" +
      "3. Provide actionable, QuickBooks-specific remediation steps\n" +
      "4. Use business-friendly language in the executive summary\n" +
      "5. Be specific about locations in QuickBooks (menu paths)\n\n" +
      "RAW QUICKBOOKS DATA:\n" +
      JSON.stringify(data, null, 2)
    );
  }

  /**
   * Sends a request to the Perplexity API.
   */
  private async makeAPIRequest(messages: any[]): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new PerplexityError(
          `Perplexity API error: ${response.status} ${response.statusText}`,
          response.status,
          errorBody,
        );
      }

      const result = await response.json();
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof PerplexityError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new PerplexityError("Request timed out", undefined, error);
      }
      throw new PerplexityError(
        `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
        undefined,
        error,
      );
    }
  }

  /**
   * Parses the LLM text response to extract key findings and hygiene score.
   * The LLM now returns a plain text response that we parse using pattern matching.
   */
  private parseAssessmentResponse(response: string): HygieneAssessmentResult {
    try {
      // Handle empty or null responses
      if (!response || response.trim().length === 0) {
        logger.warn(
          "Empty response received from AI, returning default result",
        );
        return this.createDefaultAssessmentResult();
      }

      logger.info("Parsing text response from LLM");

      // Extract overall score using various patterns
      let overallScore = 0;
      const scorePatterns = [
        /Overall\s+(?:Health\s+)?Score[:\s]*(\d+)(?:\/100)?/i,
        /Health\s+Score[:\s]*(\d+)(?:\/100)?/i,
        /Score[:\s]*(\d+)(?:\/100)?/i,
        /(\d+)\s*\/\s*100\s*-\s*(?:READY|MINOR|ADDITIONAL|Excellent|Good|Fair|Needs\s+Attention|Critical)/i,
        /Composite\s+Score[:\s]*(\d+)(?:\/100)?/i,
      ];

      for (const pattern of scorePatterns) {
        const match = response.match(pattern);
        if (match) {
          overallScore = parseInt(match[1]);
          logger.info(`Extracted overall score: ${overallScore}`);
          break;
        }
      }

      // Extract score category
      let scoreCategory = "";
      const categoryPatterns = [
        /(Excellent|Good|Fair|Needs\s+Attention|Critical)\s*(?:-|\||$)/i,
        /Score\s*Category[:\s]*([^\n]+)/i,
        /\d+\/100\s*-\s*([^\n]+)/i,
      ];

      for (const pattern of categoryPatterns) {
        const match = response.match(pattern);
        if (match) {
          scoreCategory = match[1].trim();
          logger.info(`Extracted score category: ${scoreCategory}`);
          break;
        }
      }

      // Extract readiness status
      let readinessStatus:
        | "READY_FOR_MONTHLY_OPERATIONS"
        | "MINOR_FIXES_NEEDED"
        | "ADDITIONAL_CLEANUP_REQUIRED" = "ADDITIONAL_CLEANUP_REQUIRED";

      if (response.match(/READY\s+FOR\s+MONTHLY\s+OPERATIONS/i)) {
        readinessStatus = "READY_FOR_MONTHLY_OPERATIONS";
      } else if (response.match(/MINOR\s+FIXES\s+NEEDED|NEEDS\s+CLEANUP/i)) {
        readinessStatus = "MINOR_FIXES_NEEDED";
      }

      // Extract key findings
      const keyFindings: string[] = [];
      const findingsSection = response.match(
        /KEY\s+FINDINGS[:\s]*([\s\S]*?)(?=RECOMMENDED|NEXT\s+STEPS|PILLAR|##|$)/i,
      );
      if (findingsSection) {
        const findingsText = findingsSection[1];

        // Look for sections with emojis (✅ STRONG AREAS and ⚠️ AREAS NEEDING ATTENTION)
        const strongAreas = findingsText.match(
          /✅\s*STRONG\s+AREAS[:\s]*([\s\S]*?)(?=⚠️|💰|####|$)/i,
        );
        const needsAttention = findingsText.match(
          /⚠️\s*AREAS\s+NEEDING\s+ATTENTION[:\s]*([\s\S]*?)(?=💰|####|$)/i,
        );
        const businessImpact = findingsText.match(
          /💰\s*BUSINESS\s+IMPACT[:\s]*([\s\S]*?)(?=####|###|$)/i,
        );

        // Extract items from each section
        const extractItems = (text: string | null) => {
          if (!text) return [];
          const items: string[] = [];
          const bulletPoints = text.match(/[•\-*]\s*([^\n]+)/g) || [];
          bulletPoints.forEach((item) => {
            const cleaned = item.replace(/^[•\-*\s]+/, "").trim();
            if (cleaned && cleaned.length > 5) {
              items.push(cleaned);
            }
          });
          return items;
        };

        if (strongAreas) {
          extractItems(strongAreas[1]).forEach((item) =>
            keyFindings.push(`✅ ${item}`),
          );
        }
        if (needsAttention) {
          extractItems(needsAttention[1]).forEach((item) =>
            keyFindings.push(`⚠️ ${item}`),
          );
        }
        if (businessImpact) {
          extractItems(businessImpact[1]).forEach((item) =>
            keyFindings.push(`💰 ${item}`),
          );
        }

        // Fallback to general bullet points if no emoji sections found
        if (keyFindings.length === 0) {
          const bulletPoints = findingsText.match(/[•\-*]\s*([^\n]+)/g) || [];
          const numberedItems = findingsText.match(/\d+\.\s*([^\n]+)/g) || [];

          [...bulletPoints, ...numberedItems].forEach((item) => {
            const cleaned = item.replace(/^[•\-*\d\.\s]+/, "").trim();
            if (cleaned && cleaned.length > 5) {
              keyFindings.push(cleaned);
            }
          });
        }
      }

      // If no structured findings, extract sentences that look like findings
      if (keyFindings.length === 0) {
        const findingPatterns = [
          /(?:found|identified|detected|discovered)\s+([^.]+)/gi,
          /(?:issue|problem|concern)\s+(?:is|with)\s+([^.]+)/gi,
          /(?:missing|incomplete|unreconciled)\s+([^.]+)/gi,
        ];

        for (const pattern of findingPatterns) {
          const matches = response.matchAll(pattern);
          for (const match of matches) {
            if (match[1] && match[1].length > 10) {
              keyFindings.push(match[1].trim());
              if (keyFindings.length >= 5) break;
            }
          }
          if (keyFindings.length >= 5) break;
        }
      }

      // Extract pillar scores
      const pillarScores = {
        reconciliation: 0,
        coaIntegrity: 0,
        categorization: 0,
        controlAccount: 0,
        aging: 0,
      };

      const pillarPatterns = [
        {
          key: "reconciliation",
          pattern:
            /(?:Bank\s*&?\s*Credit\s*Card\s*Matching|Reconciliation)[:\s]*(\d+)(?:\/100)?/i,
        },
        {
          key: "coaIntegrity",
          pattern:
            /(?:Money\s*Organization\s*System|Chart\s*of\s*Accounts)[:\s]*(\d+)(?:\/100)?/i,
        },
        {
          key: "categorization",
          pattern: /(?:Transaction\s*)?Categorization[:\s]*(\d+)(?:\/100)?/i,
        },
        {
          key: "controlAccount",
          pattern: /Control\s*Account\s*(?:Accuracy)?[:\s]*(\d+)(?:\/100)?/i,
        },
        {
          key: "aging",
          pattern:
            /(?:Customer\/Vendor\s*Balances|A\/R\s*&?\s*A\/P|Aging)[:\s]*(\d+)(?:\/100)?/i,
        },
      ];

      for (const { key, pattern } of pillarPatterns) {
        const match = response.match(pattern);
        if (match) {
          pillarScores[key as keyof typeof pillarScores] = parseInt(match[1]);
        }
      }

      // Extract next steps
      const nextSteps: string[] = [];
      const nextStepsSection = response.match(
        /(?:RECOMMENDED\s+)?NEXT\s+STEPS[:\s]*([\s\S]*?)(?=PILLAR|TECHNICAL|$)/i,
      );
      if (nextStepsSection) {
        const stepsText = nextStepsSection[1];
        const bulletPoints = stepsText.match(/[•\-*]\s*([^\n]+)/g) || [];
        const numberedItems = stepsText.match(/\d+\.\s*([^\n]+)/g) || [];

        [...bulletPoints, ...numberedItems].forEach((item) => {
          const cleaned = item.replace(/^[•\-*\d\.\s]+/, "").trim();
          if (cleaned && cleaned.length > 5) {
            nextSteps.push(cleaned);
          }
        });
      }

      // Build the result
      const result: HygieneAssessmentResult = {
        overallScore,
        pillarScores,
        readinessStatus,
        businessOwnerSummary: {
          healthScore: `${overallScore}/100${scoreCategory ? " - " + scoreCategory : ""}`,
          whatThisMeans: this.extractWhatThisMeans(response, overallScore),
          keyFindings:
            keyFindings.length > 0
              ? keyFindings
              : [
                  "Assessment completed",
                  `Overall health score: ${overallScore}/100`,
                  `Status: ${readinessStatus.replace(/_/g, " ").toLowerCase()}`,
                ],
          nextSteps:
            nextSteps.length > 0
              ? nextSteps
              : [
                  "Review assessment results",
                  "Prioritize critical issues",
                  "Begin remediation process",
                ],
        },
        bookkeeperReport: {
          criticalIssues: this.extractCriticalIssues(response),
          recommendedImprovements:
            this.extractRecommendedImprovements(response),
          ongoingMaintenance: this.extractOngoingMaintenance(response),
        },
        assessmentMetadata: {
          assessmentDate: new Date().toISOString().split("T")[0],
          dataPeriod: this.extractDataPeriod(response),
          scoringModel: "Day-30 Readiness Framework",
          limitations: this.extractLimitations(response),
        },
      };

      logger.info("Successfully parsed text response", {
        overallScore: result.overallScore,
        readinessStatus: result.readinessStatus,
        keyFindingsCount: result.businessOwnerSummary.keyFindings.length,
      });

      return result;
    } catch (error) {
      logger.error("Failed to parse LLM text response", {
        response:
          response.substring(0, 500) + (response.length > 500 ? "..." : ""),
        error,
      });

      // Return a default result instead of throwing to maintain service availability
      logger.info("Returning default assessment result due to parsing failure");
      return this.createDefaultAssessmentResult();
    }
  }

  /**
   * Extract "What This Means" section from text response
   */
  private extractWhatThisMeans(response: string, score: number): string {
    const patterns = [
      /WHAT\s+THIS\s+MEANS[:\s]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
      /(?:Your\s+)?(?:financial\s+)?books\s+(?:are|scored)[^.]+\.[^.]+\./i,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match) {
        return match[1] ? match[1].trim() : match[0].trim();
      }
    }

    // Default based on score
    if (score >= 85) {
      return "Your financial books are in excellent condition and ready for monthly bookkeeping operations.";
    } else if (score >= 70) {
      return "Your books are in good shape but need minor adjustments before monthly operations can begin smoothly.";
    } else if (score >= 50) {
      return "Your books require moderate cleanup to ensure accurate financial reporting and compliance.";
    } else {
      return "Your books need significant remediation work before they are ready for regular bookkeeping operations.";
    }
  }

  /**
   * Extract critical issues from text response
   */
  private extractCriticalIssues(response: string): Array<{
    priority: number;
    pillar: string;
    issue: string;
    qboLocation: string;
    fixSteps: string;
    estimatedTime: string;
  }> {
    const issues: any[] = [];
    const criticalSection = response.match(
      /CRITICAL\s+ISSUES[:\s]*([\s\S]*?)(?=RECOMMENDED|ONGOING|$)/i,
    );

    if (criticalSection) {
      const text = criticalSection[1];
      const priorityMatches = text.matchAll(/Priority\s*(\d+)[:\s]*([^\n]+)/gi);

      let priority = 1;
      for (const match of priorityMatches) {
        issues.push({
          priority: parseInt(match[1]) || priority++,
          pillar: "General",
          issue: match[2].trim(),
          qboLocation: "QuickBooks Online",
          fixSteps: "See detailed report",
          estimatedTime: "To be determined",
        });
      }
    }

    return issues;
  }

  /**
   * Extract recommended improvements from text response
   */
  private extractRecommendedImprovements(response: string): string[] {
    const improvements: string[] = [];
    const section = response.match(
      /RECOMMENDED\s+IMPROVEMENTS[:\s]*([\s\S]*?)(?=ONGOING|$)/i,
    );

    if (section) {
      const text = section[1];
      const items = text.match(/[•\-*]\s*([^\n]+)/g) || [];

      items.forEach((item) => {
        const cleaned = item.replace(/^[•\-*\s]+/, "").trim();
        if (cleaned && cleaned.length > 5) {
          improvements.push(cleaned);
        }
      });
    }

    return improvements;
  }

  /**
   * Extract ongoing maintenance tasks from text response
   */
  private extractOngoingMaintenance(response: string): string[] {
    const maintenance: string[] = [];
    const section = response.match(
      /ONGOING\s+MAINTENANCE[:\s]*([\s\S]*?)(?=$)/i,
    );

    if (section) {
      const text = section[1];
      const items = text.match(/[•\-*]\s*([^\n]+)/g) || [];

      items.forEach((item) => {
        const cleaned = item.replace(/^[•\-*\s]+/, "").trim();
        if (cleaned && cleaned.length > 5) {
          maintenance.push(cleaned);
        }
      });
    }

    return maintenance;
  }

  /**
   * Extract data period from text response
   */
  private extractDataPeriod(response: string): string {
    const match = response.match(/Data\s+Period[:\s]*([^\n]+)/i);
    return match ? match[1].trim() : "Current Period";
  }

  /**
   * Extract limitations from text response
   */
  private extractLimitations(response: string): string[] | undefined {
    const limitations: string[] = [];
    const section = response.match(/Limitations[:\s]*([\s\S]*?)(?=$|\n\n)/i);

    if (section) {
      const text = section[1];
      const items = text.match(/[•\-*]\s*([^\n]+)/g) || [];

      items.forEach((item) => {
        const cleaned = item.replace(/^[•\-*\s]+/, "").trim();
        if (cleaned && cleaned.length > 5) {
          limitations.push(cleaned);
        }
      });
    }

    return limitations.length > 0 ? limitations : undefined;
  }

  /**
   * Creates a default assessment result for cases where AI response cannot be parsed
   */
  private createDefaultAssessmentResult(): HygieneAssessmentResult {
    return {
      overallScore: 0,
      pillarScores: {
        reconciliation: 0,
        coaIntegrity: 0,
        categorization: 0,
        controlAccount: 0,
        aging: 0,
      },
      readinessStatus: "ADDITIONAL_CLEANUP_REQUIRED",
      businessOwnerSummary: {
        healthScore: "0/100 - Assessment Incomplete",
        whatThisMeans:
          "Unable to complete the assessment due to data processing issues. Please try again or contact support.",
        keyFindings: ["Assessment could not be completed"],
        nextSteps: [
          "Please retry the assessment",
          "Contact support if issues persist",
        ],
      },
      bookkeeperReport: {
        criticalIssues: [],
        recommendedImprovements: ["Assessment needs to be re-run"],
        ongoingMaintenance: [],
      },
      assessmentMetadata: {
        assessmentDate: new Date().toISOString().split("T")[0],
        dataPeriod: "Unknown",
        scoringModel: "Day-30 Readiness Framework",
        limitations: [
          "Assessment could not be completed due to parsing errors",
        ],
      },
    };
  }

  /**
   * Parses the new structured format as defined in hygiene-assessment-prompt.txt
   */
  private parseNewStructuredFormat(parsed: any): HygieneAssessmentResult {
    try {
      // Extract basic scores and status with validation
      const overallScore = this.validateScore(parsed.overallScore);
      const pillarScores = {
        reconciliation: this.validateScore(parsed.pillarScores?.reconciliation),
        coaIntegrity: this.validateScore(parsed.pillarScores?.coaIntegrity),
        categorization: this.validateScore(parsed.pillarScores?.categorization),
        controlAccount: this.validateScore(
          parsed.pillarScores?.controlAccounts,
        ), // Note: mapping controlAccounts to controlAccount
        aging: this.validateScore(parsed.pillarScores?.arApValidity), // Note: mapping arApValidity to aging
      };

      // Map readiness status to expected enum values
      let readinessStatus:
        | "READY_FOR_MONTHLY_OPERATIONS"
        | "MINOR_FIXES_NEEDED"
        | "ADDITIONAL_CLEANUP_REQUIRED";
      const rawStatus = parsed.readinessStatus || "";
      if (rawStatus.includes("READY FOR MONTHLY OPERATIONS")) {
        readinessStatus = "READY_FOR_MONTHLY_OPERATIONS";
      } else if (
        rawStatus.includes("MINOR FIXES") ||
        rawStatus.includes("NEEDS CLEANUP")
      ) {
        readinessStatus = "MINOR_FIXES_NEEDED";
      } else {
        readinessStatus = "ADDITIONAL_CLEANUP_REQUIRED";
      }

      // Extract Section 1: Executive Summary (Business Owner)
      const section1 = parsed.section1_executiveSummary || {};
      const businessOwnerSummary = {
        healthScore:
          section1.healthScore || this.getHealthScoreLabel(overallScore),
        whatThisMeans:
          section1.whatThisMeans ||
          `Your financial books scored ${overallScore}/100. ${
            overallScore >= 75
              ? "Your books are in good shape with minor improvements needed."
              : overallScore >= 50
                ? "Your books need moderate attention to improve accuracy and compliance."
                : "Your books require significant remediation work before they are audit-ready."
          }`,
        keyFindings: Array.isArray(section1.keyFindings)
          ? section1.keyFindings
          : [],
        nextSteps: Array.isArray(section1.recommendedNextSteps)
          ? section1.recommendedNextSteps
          : [],
      };

      // Extract Section 2: Detailed Results (Optional pillar breakdown info)
      const section2 = parsed.section2_detailedResults || {};
      // This section provides additional context but doesn't change the main structure

      // Extract Section 3: Technical Remediation (Bookkeeper)
      const section3 = parsed.section3_technicalRemediation || {};
      const criticalIssues = Array.isArray(section3.criticalIssues)
        ? section3.criticalIssues.map((issue: any, index: number) => ({
            priority: issue.priority || index + 1,
            pillar: this.mapIssueToPillar(
              issue.issueDescription || issue.problem || "Unknown",
            ),
            issue:
              issue.issueDescription ||
              issue.problem ||
              "Critical issue identified",
            qboLocation: issue.qboLocation || "QuickBooks Online",
            fixSteps:
              issue.fixSteps ||
              "Contact your bookkeeper for detailed remediation steps",
            estimatedTime: issue.estimatedTime || "To be determined",
          }))
        : [];

      // Convert recommended improvements to string array format
      const recommendedImprovements = Array.isArray(
        section3.recommendedImprovements,
      )
        ? section3.recommendedImprovements.map((item: any) =>
            typeof item === "string"
              ? item
              : `${item.area || "General"}: ${item.description || item.task || "Improvement recommended"}`,
          )
        : [];

      // Convert ongoing maintenance to string array format
      const ongoingMaintenance = Array.isArray(section3.ongoingMaintenance)
        ? section3.ongoingMaintenance.map((item: any) =>
            typeof item === "string"
              ? item
              : `${item.frequency || "Regular"}: ${item.task || "Maintenance task"} (${item.qboPath || "QuickBooks Online"})`,
          )
        : [];

      // Extract Section 4: Scoring Transparency
      const section4 = parsed.section4_scoringTransparency || {};
      const assessmentMetadata = {
        assessmentDate:
          section4.assessmentDate || new Date().toISOString().split("T")[0],
        dataPeriod: section4.dataPeriodAnalyzed || "Current Period",
        scoringModel: section4.scoringModel || "Day-30 Readiness Framework",
        limitations: Array.isArray(section4.limitations)
          ? section4.limitations
          : undefined,
      };

      const result: HygieneAssessmentResult = {
        overallScore,
        pillarScores,
        readinessStatus,
        businessOwnerSummary,
        bookkeeperReport: {
          criticalIssues,
          recommendedImprovements,
          ongoingMaintenance,
        },
        assessmentMetadata,
      };

      return result;
    } catch (error) {
      logger.error(
        "Error parsing new structured format, falling back to default",
        error,
      );
      return this.createDefaultAssessmentResult();
    }
  }

  /**
   * Fallback parser for legacy format responses
   */
  private parseLegacyFormat(parsed: any): HygieneAssessmentResult {
    // Return AI insights with placeholder scores
    // Actual scores will be preserved from PillarScoringService calculations
    const result: HygieneAssessmentResult = {
      // These scores are placeholders - will be replaced with calculated scores
      overallScore: parsed.overallScore || 0,
      pillarScores: {
        reconciliation: parsed.pillarScores?.reconciliation || 0,
        coaIntegrity: parsed.pillarScores?.coaIntegrity || 0,
        categorization: parsed.pillarScores?.categorization || 0,
        controlAccount: parsed.pillarScores?.controlAccount || 0,
        aging: parsed.pillarScores?.aging || 0,
      },
      readinessStatus: parsed.readinessStatus || "ADDITIONAL_CLEANUP_REQUIRED",
      // AI-generated insights and recommendations
      businessOwnerSummary: {
        healthScore:
          parsed.businessOwnerSummary?.healthScore ||
          this.getHealthScoreLabel(parsed.overallScore || 0),
        whatThisMeans:
          parsed.businessOwnerSummary?.whatThisMeans ||
          `Your financial books scored ${parsed.overallScore || 0}/100. ${
            (parsed.overallScore || 0) >= 75
              ? "Your books are in good shape with minor improvements needed."
              : (parsed.overallScore || 0) >= 50
                ? "Your books need moderate attention to improve accuracy and compliance."
                : "Your books require significant remediation work before they are audit-ready."
          }`,
        keyFindings: parsed.businessOwnerSummary?.keyFindings || [],
        nextSteps: parsed.businessOwnerSummary?.nextSteps || [],
      },
      bookkeeperReport: {
        criticalIssues: parsed.bookkeeperReport?.criticalIssues || [],
        recommendedImprovements:
          parsed.bookkeeperReport?.recommendedImprovements || [],
        ongoingMaintenance: parsed.bookkeeperReport?.ongoingMaintenance || [],
      },
      assessmentMetadata: {
        assessmentDate: new Date().toISOString().split("T")[0],
        dataPeriod: parsed.assessmentMetadata?.dataPeriod || "Unknown",
        scoringModel: "Day-30 Readiness Framework with AI Enhancement",
        limitations: parsed.assessmentMetadata?.limitations,
      },
    };

    return result;
  }

  /**
   * Maps an issue description to the appropriate pillar name
   */
  private mapIssueToPillar(issueDescription: string): string {
    const issue = issueDescription.toLowerCase();

    if (
      issue.includes("reconcil") ||
      issue.includes("bank") ||
      issue.includes("credit card")
    ) {
      return "Bank & Credit Card Matching";
    }
    if (
      issue.includes("chart of accounts") ||
      issue.includes("coa") ||
      issue.includes("account structure")
    ) {
      return "Money Organization System";
    }
    if (
      issue.includes("categor") ||
      issue.includes("uncategor") ||
      issue.includes("transaction")
    ) {
      return "Transaction Categorization";
    }
    if (
      issue.includes("control") ||
      issue.includes("opening balance") ||
      issue.includes("undeposited")
    ) {
      return "Control Account Accuracy";
    }
    if (
      issue.includes("receivable") ||
      issue.includes("payable") ||
      issue.includes("aging") ||
      issue.includes("customer") ||
      issue.includes("vendor")
    ) {
      return "Customer/Vendor Balances";
    }

    return "General";
  }

  /**
   * Validates and normalizes score values to ensure they're within 0-100 range
   */
  private validateScore(score: any): number {
    if (typeof score === "number" && !isNaN(score)) {
      return Math.max(0, Math.min(100, Math.round(score)));
    }
    if (typeof score === "string") {
      const parsed = parseFloat(score);
      if (!isNaN(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
    return 0; // Default to 0 for invalid scores
  }

  /**
   * Performs a complete financial hygiene assessment using the Perplexity API.
   * Now supports webhook assessment data format
   */
  public async analyzeFinancialHygiene(
    rawData: FivePillarRawData | QBODataPackage | any,
  ): Promise<CompleteAssessmentResponse> {
    logger.info("Starting financial hygiene assessment with Perplexity AI");

    try {
      // Load the assessment prompt
      const systemPrompt = await this.loadAssessmentPrompt();

      // Format the data for analysis
      let formattedData: string;
      if (this.isWebhookAssessmentData(rawData)) {
        // Use the JSON formatter for LLM analysis (not markdown formatter)
        // The LLM needs structured data, not human-readable markdown
        formattedData = this.formatWebhookAssessmentDataForAnalysis(rawData);
        logger.info("Using structured JSON format for LLM analysis");
      } else if (this.isFivePillarRawData(rawData)) {
        formattedData = this.formatFivePillarDataForAnalysis(rawData);
      } else {
        formattedData = this.formatQBODataForAnalysis(
          rawData as QBODataPackage,
        );
      }

      // Prepare the messages for the API
      const messages = [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `
FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS (use this template structure):

# OUTPUT FORMAT SPECIFICATION

## SECTION 1: EXECUTIVE SUMMARY (Business Owner)

FINANCIAL BOOKS HEALTH ASSESSMENT
Overall Health Score: [X]/100 - [Category]

WHAT THIS MEANS FOR YOUR BUSINESS:
[Plain language explanation of current state and business impact]

KEY FINDINGS:
• [Major issues in simple terms]
• [Positive aspects to acknowledge]
• [Business impact of current state]

RECOMMENDED NEXT STEPS:
[Clear actions in business language]

## SECTION 2: DETAILED ASSESSMENT RESULTS

PILLAR BREAKDOWN:
• Bank & Credit Card Matching: [Score]/100
• Money Organization System: [Score]/100
• Transaction Categorization: [Score]/100
• Control Account Accuracy: [Score]/100
• Customer/Vendor Balances: [Score]/100

## SECTION 3: TECHNICAL REMEDIATION PLAN (Bookkeeper)

CRITICAL ISSUES REQUIRING IMMEDIATE ACTION:
Priority 1: [Issue Description]
• Problem: [Technical description]
• Location: [Exact QBO path]
• Fix: [Step-by-step remedy]
• Time: [Estimated hours]

Priority 2: [Next issue]
[Same format]

RECOMMENDED IMPROVEMENTS:
[Detailed technical steps with QBO navigation]

ONGOING MAINTENANCE REQUIREMENTS:
[Monthly/quarterly tasks to maintain hygiene]

## SECTION 4: SCORING TRANSPARENCY

ASSESSMENT METHODOLOGY SUMMARY:
• Assessment Date: [Current date]
• Data Period Analyzed: [Date range]
• Scoring Model: Day-30 Readiness Framework
• Repeatability: Same data will produce identical results
• Limitations: [Any incomplete data areas]

------------------------------------------------------------
Please analyze the following raw QuickBooks Online JSON data and provide a comprehensive financial books health assessment report.
Here is the QuickBooks Online data to analyze:

${formattedData}`,
        },
      ];

      // Enhanced validation for different data formats
      let validation: {
        isComplete: boolean;
        missingData: string[];
        warnings: string[];
      };
      if (this.isWebhookAssessmentData(rawData)) {
        // For webhook data, validate the current assessment structure
        validation = this.validateWebhookAssessmentData(rawData);
      } else if (this.isFivePillarRawData(rawData)) {
        validation = this.validateFivePillarDataCompleteness(rawData);
      } else {
        validation = this.validateDataCompleteness(rawData as QBODataPackage);
      }

      if (!validation.isComplete) {
        logger.warn("Assessment data incomplete", {
          missingData: validation.missingData,
          warnings: validation.warnings,
        });
      }

      // Make the API request
      logger.debug("Sending request to Perplexity API");
      const apiResponse = await this.makeAPIRequest(messages);

      if (
        !apiResponse.choices ||
        !apiResponse.choices[0] ||
        !apiResponse.choices[0].message
      ) {
        throw new PerplexityError("Invalid API response structure");
      }

      const rawLLMResponse = apiResponse.choices[0].message.content;
      logger.debug("Received assessment response from Perplexity API");

      // Parse the structured response
      const assessmentResult = this.parseAssessmentResponse(rawLLMResponse);

      logger.info("Financial hygiene assessment completed successfully", {
        overallScore: assessmentResult.overallScore,
        readinessStatus: assessmentResult.readinessStatus,
      });

      // Generate PDF if PDF API URL is configured
      let pdfUrl: string | undefined;
      if (import.meta.env.VITE_PDF_API_URL) {
        try {
          const pdfResponse = await this.generatePDF(rawLLMResponse);
          pdfUrl = pdfResponse.url;
        } catch (pdfError) {
          logger.error("Failed to generate PDF", pdfError);
          // Continue without PDF - it's optional
        }
      }

      return {
        assessmentResult,
        rawLLMResponse,
        pdfUrl,
      };
    } catch (error) {
      logger.error("Financial hygiene assessment failed", error);
      throw error instanceof PerplexityError
        ? error
        : new PerplexityError(
            `Assessment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            undefined,
            error,
          );
    }
  }

  /**
   * Validates that the QBO data package contains the minimum required data.
   */
  public validateDataCompleteness(data: QBODataPackage): {
    isComplete: boolean;
    missingData: string[];
    warnings: string[];
  } {
    const missingData: string[] = [];
    const warnings: string[] = [];

    // Required data elements
    if (!data.chartOfAccounts || data.chartOfAccounts.length === 0) {
      missingData.push("Chart of Accounts");
    }
    if (!data.trialBalance) {
      missingData.push("Trial Balance");
    }
    if (!data.generalLedger) {
      warnings.push("General Ledger data may be incomplete");
    }

    // Important but not critical
    if (!data.bankReconciliation) {
      warnings.push(
        "Bank reconciliation data not available - reconciliation assessment will be limited",
      );
    }
    if (!data.arAging && !data.apAging) {
      warnings.push(
        "Aging reports not available - A/R and A/P assessment will be limited",
      );
    }

    return {
      isComplete: missingData.length === 0,
      missingData,
      warnings,
    };
  }

  /**
   * Type guard to check if data is FivePillarRawData
   */
  private isFivePillarRawData(data: any): data is FivePillarRawData {
    return (
      data &&
      data.reconciliation &&
      data.chartOfAccounts &&
      data.categorization &&
      data.controlAccounts &&
      data.arApValidity &&
      data.assessmentMetadata
    );
  }

  /**
   * Type guard to check if data is webhook assessment data format
   */
  private isWebhookAssessmentData(data: any): boolean {
    // Check for either the full webhook response or the assessment data format from Assessment.tsx
    return (
      data &&
      // Full webhook response format
      ((data.pillarData && data.meta) ||
        // Assessment data format with raw pillar data
        (data.rawPillarData && data.financialMetrics))
    );
  }

  /**
   * Formats webhook assessment data for LLM analysis - passes raw QBO data
   */
  private formatWebhookAssessmentDataForAnalysis(data: any): string {
    const sections = [];

    sections.push("=== QUICKBOOKS ONLINE DATA FOR ANALYSIS ===");
    sections.push("");

    // Include metadata if available
    if (data.meta) {
      sections.push(
        `Data Period: ${data.meta?.start_date} to ${data.meta?.end_date}`,
      );
      sections.push(`Company: ${data.meta?.companyName || "Unknown"}`);
      sections.push("");
    }

    sections.push("INSTRUCTIONS FOR ANALYSIS:");
    sections.push(
      "1. Calculate scores based on actual data quality and completeness",
    );
    sections.push(
      "2. Identify specific issues with exact dollar amounts and account names",
    );
    sections.push(
      "3. Provide actionable, QuickBooks-specific remediation steps",
    );
    sections.push("4. Use business-friendly language in the executive summary");
    sections.push("5. Be specific about locations in QuickBooks (menu paths)");
    sections.push("");
    sections.push("KEY VALUES TO HIGHLIGHT:");
    sections.push("• AR Balance (Accounts Receivable)");
    sections.push("• AP Balance (Accounts Payable)");
    sections.push("• Opening Balance Equity amount");
    sections.push("• Undeposited Funds amount");
    sections.push("• Number of chart of accounts");
    sections.push("• Uncategorized transaction amounts");
    sections.push("• Bank account balances");
    sections.push("");

    // Pass ALL raw data to the LLM
    sections.push("RAW QUICKBOOKS DATA:");
    sections.push(JSON.stringify(data, null, 2));

    return sections.join("\n");
  }

  /**
   * Validates webhook assessment data completeness
   */
  private validateWebhookAssessmentData(data: any): {
    isComplete: boolean;
    missingData: string[];
    warnings: string[];
  } {
    const missingData: string[] = [];
    const warnings: string[] = [];

    // Check basic structure
    if (!data.pillarData) {
      missingData.push("Pillar data is missing");
    }

    if (!data.currentAssessment) {
      missingData.push("Current assessment results are missing");
    }

    if (!data.financialMetrics) {
      missingData.push("Financial metrics are missing");
    }

    // Check data quality
    if (data.financialMetrics?.totalAccounts === 0) {
      missingData.push("No chart of accounts data");
    }

    if (data.financialMetrics?.bankAccounts === 0) {
      warnings.push("No bank accounts for reconciliation analysis");
    }

    // Check pillar data completeness
    if (data.pillarData?.chartIntegrity?.totals?.accounts === 0) {
      warnings.push("Chart of accounts data appears empty");
    }

    return {
      isComplete: missingData.length === 0,
      missingData,
      warnings,
    };
  }

  /**
   * Formats five pillar raw data for LLM analysis - passes raw QBO data
   */
  private formatFivePillarDataForAnalysis(rawData: FivePillarRawData): string {
    // Just pass the entire raw data object to the LLM
    return (
      "=== QUICKBOOKS ONLINE DATA FOR ANALYSIS ===\n\n" +
      `Data Period: ${rawData.assessmentMetadata?.datePeriodAnalyzed?.startDate} to ${rawData.assessmentMetadata?.datePeriodAnalyzed?.endDate}\n\n` +
      "INSTRUCTIONS FOR ANALYSIS:\n" +
      "1. Calculate scores based on actual data quality and completeness\n" +
      "2. Identify specific issues with exact dollar amounts and account names\n" +
      "3. Provide actionable, QuickBooks-specific remediation steps\n" +
      "4. Use business-friendly language in the executive summary\n" +
      "5. Be specific about locations in QuickBooks (menu paths)\n\n" +
      "RAW QUICKBOOKS DATA:\n" +
      JSON.stringify(rawData, null, 2)
    );
  }

  /**
   * Validates that the five pillar raw data contains the minimum required data.
   */
  private validateFivePillarDataCompleteness(data: FivePillarRawData): {
    isComplete: boolean;
    missingData: string[];
    warnings: string[];
  } {
    const missingData: string[] = [];
    const warnings: string[] = [];

    // Check data completeness flags from metadata
    if (data.assessmentMetadata.dataCompleteness.missingReports.length > 0) {
      data.assessmentMetadata.dataCompleteness.missingReports.forEach(
        (report) => {
          if (
            report.includes("Chart of Accounts") ||
            report.includes("Trial Balance")
          ) {
            missingData.push(report);
          } else {
            warnings.push(
              `${report} data not available - may impact assessment accuracy`,
            );
          }
        },
      );
    }

    // Check pillar data completeness
    if (!data.assessmentMetadata.dataCompleteness.reconciliationDataAvailable) {
      warnings.push(
        "Bank reconciliation data not available - reconciliation assessment will be limited",
      );
    }

    if (!data.assessmentMetadata.dataCompleteness.chartOfAccountsAvailable) {
      missingData.push("Chart of Accounts data is missing");
    }

    if (!data.assessmentMetadata.dataCompleteness.categorizationDataAvailable) {
      warnings.push("Categorization analysis data not available");
    }

    if (!data.assessmentMetadata.dataCompleteness.controlAccountsAvailable) {
      warnings.push("Control accounts data not available");
    }

    if (!data.assessmentMetadata.dataCompleteness.arApDataAvailable) {
      warnings.push("A/R and A/P aging data not available");
    }

    // Check individual pillar data quality
    if (data.reconciliation.totalBankAccounts === 0) {
      warnings.push("No bank accounts found for reconciliation analysis");
    }

    if (data.chartOfAccounts.totalAccounts === 0) {
      missingData.push("Chart of Accounts is empty");
    }

    return {
      isComplete: missingData.length === 0,
      missingData,
      warnings,
    };
  }

  /**
   * Generate PDF from assessment text using VITE_PDF_API_URL
   */
  private async generatePDF(
    assessmentText: string,
  ): Promise<{ url?: string; error?: string }> {
    const pdfApiUrl = import.meta.env.VITE_PDF_API_URL;

    if (!pdfApiUrl) {
      logger.error("PDF API URL not configured");
      return { error: "PDF API URL not configured" };
    }

    try {
      logger.info("Sending assessment to PDF API");

      // Send text directly as plain text for PDF generation
      const response = await fetch(pdfApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: assessmentText,
      });

      if (!response.ok) {
        throw new Error(`PDF API returned ${response.status}`);
      }

      // Check response content type
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/pdf")) {
        logger.error("Invalid response type from PDF API", { contentType });
        throw new Error(`Invalid response type: ${contentType}`);
      }

      // Get PDF blob from response
      const pdfBlob = await response.blob();

      // Validate blob size
      if (pdfBlob.size === 0) {
        throw new Error("PDF API returned empty response");
      }

      // Create object URL for viewing/downloading
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Clean up URL after 5 minutes
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 300000);

      logger.info("PDF generated successfully", { size: pdfBlob.size });
      return { url: pdfUrl };
    } catch (error) {
      logger.error("Failed to generate PDF", error);
      return {
        error:
          error instanceof Error ? error.message : "Failed to generate PDF",
      };
    }
  }

  /**
   * Health check method to verify Perplexity API connectivity.
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const messages = [
        {
          role: "user",
          content: "Please respond with 'OK' if you can process this request.",
        },
      ];

      const response = await this.makeAPIRequest(messages);
      return (
        response.choices && response.choices[0] && response.choices[0].message
      );
    } catch (error) {
      logger.error("Perplexity service health check failed", error);
      return false;
    }
  }
}
