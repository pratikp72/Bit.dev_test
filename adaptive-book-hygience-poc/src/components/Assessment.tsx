import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Link2Icon,
  UploadIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon,
  EyeOpenIcon,
  GearIcon,
  CalendarIcon,
  BarChartIcon,
  DownloadIcon,
  PlayIcon,
  ReloadIcon,
  MagnifyingGlassIcon,
  PersonIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons";
import { useUser } from "@clerk/clerk-react";
import { FormData, CurrentStep, ViewMode } from "../App";
import {
  QBOCustomer,
  DateRange,
  QBOFinancialReports,
} from "../services/qboApiService";
import { useQBOService } from "../services/QBOServiceContext";
import { QBOTokenService } from "../services/qboTokenService";
import {
  qboPillarsWebhookService,
  WebhookResponse,
} from "../services/qboPillarsWebhookService";
import { PillarScoringService } from "../services/pillarScoringService";
import {
  PerplexityService,
  HygieneAssessmentResult,
  CompleteAssessmentResponse,
} from "../services/perplexityService";
import { DataFormatterService } from "../services/dataFormatter";
import { RawDataFormatter } from "../services/rawDataFormatter";
import { AssessmentStorageService } from "../services/assessmentStorageService";
import { PDFGenerationService } from "../services/pdfGenerationService";
import DataReportFormatter from "./DataReportFormatter";
import AssessmentResultsViewer from "./AssessmentResultsViewer";
import PillarDataViewer from "./PillarDataViewer";
import DaysFilter from "./DaysFilter";
import logger from "../lib/logger";
import { LLMInputFormatter } from '../services/llmInputFormatter';

interface AssessmentProps {
  currentStep: CurrentStep;
  setCurrentStep: React.Dispatch<React.SetStateAction<CurrentStep>>;
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  uploadedFiles: string[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<string[]>>;
  isAnalyzing: boolean;
  setIsAnalyzing: React.Dispatch<React.SetStateAction<boolean>>;
  formData: FormData;
  handleFileUpload: (reportName: string) => void;
  handleAnalysis: () => void;
  accessToken: string | null;
  realmId: string | null;
}

// Types for assessment results
type ConnectionStatus = "idle" | "success" | "error";

interface Pillar {
  name: string;
  score: number;
  status: "good" | "warning" | "critical";
}

interface CriticalIssue {
  problem: string;
  location: string;
  fix: string;
  time: string;
  priority: "High" | "Medium";
}

interface AssessmentResults {
  overallScore: number;
  category: string;
  categoryColor: string;
  pillars: Pillar[];
  criticalIssues: CriticalIssue[];
}

const Assessment = ({
  currentStep,
  setCurrentStep,
  viewMode,
  setViewMode,
  uploadedFiles,
  setUploadedFiles,
  isAnalyzing,
  setIsAnalyzing,
  formData,
  handleFileUpload,
  handleAnalysis,
  accessToken,
  realmId,
}: AssessmentProps) => {
  const navigate = useNavigate();
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [dataFetchError, setDataFetchError] = useState<string | null>(null);

  // Remove customer selection - no longer needed for QBO integration
  const customers: QBOCustomer[] = [];
  const selectedCustomer: QBOCustomer | null = null;
  const isLoadingCustomers = false;
  const customerError: string | null = null;
  const customerSearchTerm = "";
  const isCustomerDropdownOpen = false;
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: "2024-01-01",
    endDate: "2024-12-31",
  });
  
  // State for days filter
  const [daysFilter, setDaysFilter] = useState<number>(90);

  // Get QBO service from context
  const { qboService, error: serviceError } = useQBOService();

  const { isLoaded, isSignedIn, user } = useUser();

  // Handle service initialization errors
  if (serviceError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <CrossCircledIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Service Error
            </h2>
            <p className="text-gray-600 mb-4">{serviceError}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Add 5-pillar import status state
  const [pillarImportStatus, setPillarImportStatus] = useState<{
    reconciliation: {
      status: "pending" | "importing" | "completed" | "error";
      data?: any;
    };
    chartOfAccounts: {
      status: "pending" | "importing" | "completed" | "error";
      data?: any;
    };
    categorization: {
      status: "pending" | "importing" | "completed" | "error";
      data?: any;
    };
    controlAccounts: {
      status: "pending" | "importing" | "completed" | "error";
      data?: any;
    };
    arApValidity: {
      status: "pending" | "importing" | "completed" | "error";
      data?: any;
    };
  }>({
    reconciliation: { status: "pending" },
    chartOfAccounts: { status: "pending" },
    categorization: { status: "pending" },
    controlAccounts: { status: "pending" },
    arApValidity: { status: "pending" },
  });

  // Replace the existing progress state
  const [isImportingData, setIsImportingData] = useState(false);

  // Add AI analysis progress state
  const [aiAnalysisProgress, setAiAnalysisProgress] = useState<{
    phase:
      | "formatting"
      | "validating"
      | "analyzing"
      | "parsing"
      | "complete"
      | "error";
    message: string;
    percentage: number;
  } | null>(null);

  // Store fetched financial data
  const [financialData, setFinancialData] =
    useState<QBOFinancialReports | null>(null);

  // Store AI assessment results
  const [assessmentResults, setAssessmentResults] =
    useState<HygieneAssessmentResult | null>(null);
  const [perplexityService] = useState(() => new PerplexityService());

  // Store webhook pillar data
  const [webhookData, setWebhookData] = useState<WebhookResponse | null>(null);
  
  // State for checking existing QBO tokens
  const [hasExistingTokens, setHasExistingTokens] = useState(false);
  const [isCheckingTokens, setIsCheckingTokens] = useState(true);
  
  // State for showing imported data before AI analysis
  const [showImportedDataPreview, setShowImportedDataPreview] = useState(false);
  const [importCompleted, setImportCompleted] = useState(false);

  // Check for existing QBO tokens on component mount
  useEffect(() => {
    const checkExistingTokens = async () => {
      if (!user?.id) {
        setIsCheckingTokens(false);
        return;
      }
      
      try {
        logger.debug('Checking for existing QBO tokens');
        const tokens = await QBOTokenService.getTokens(user.id);
        
        if (tokens) {
          const isValid = await QBOTokenService.validateTokens(tokens);
          if (isValid) {
            logger.info('Found valid existing QBO tokens', { realmId: tokens.realm_id });
            setHasExistingTokens(true);
          } else {
            logger.debug('Existing tokens are invalid or expired');
            setHasExistingTokens(false);
          }
        } else {
          logger.debug('No existing QBO tokens found');
          setHasExistingTokens(false);
        }
      } catch (error) {
        logger.error('Error checking QBO tokens', error);
        setHasExistingTokens(false);
      } finally {
        setIsCheckingTokens(false);
      }
    };
    
    checkExistingTokens();
  }, [user?.id]);
  
  // Update date range when webhook data is available
  useEffect(() => {
    if (webhookData?.meta) {
      setDateRange({
        startDate: webhookData.meta.start_date,
        endDate: webhookData.meta.end_date,
      });
    }
  }, [webhookData]);

  // Compute financial metrics from webhook data when available
  const financialMetrics = webhookData
    ? PillarScoringService.extractFinancialMetrics(webhookData)
    : {
        dateRange: { start: dateRange.startDate, end: dateRange.endDate },
        windowDays: 90,
        bankAccounts: 0,
        totalAccounts: 0,
        arBalance: 0,
        apBalance: 0,
        obeBalance: 0,
        undepositedFunds: 0,
        uncategorizedExpense: 0,
        duplicateAccounts: 0,
        dataCompletenessScore: 0,
      };

  // PDF generation state
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showDetailedViewer, setShowDetailedViewer] = useState(false);
  const [showPillarViewer, setShowPillarViewer] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const mockAssessmentResults: AssessmentResults = {
    overallScore: 73,
    category: "MINOR FIXES NEEDED",
    categoryColor: "yellow",
    pillars: [
      { name: "Bank & Credit Card Matching", score: 85, status: "good" },
      { name: "Money Organization System", score: 68, status: "warning" },
      { name: "Transaction Categorization", score: 72, status: "warning" },
      { name: "Control Account Accuracy", score: 90, status: "good" },
      { name: "Customer/Vendor Balances", score: 50, status: "critical" },
    ],
    criticalIssues: [
      {
        problem: "Uncategorized transactions detected in General Ledger",
        location:
          "Accounting > Chart of Accounts > Uncategorized Income/Expense",
        fix: "1. Navigate to Chart of Accounts\n2. Review uncategorized transactions\n3. Assign appropriate categories\n4. Create missing account categories if needed",
        time: "2-3 hours",
        priority: "High",
      },
      {
        problem: "Customer balance discrepancies in A/R aging",
        location: "Sales > Customers > Customer Balance Detail",
        fix: "1. Run A/R Aging Summary\n2. Compare with individual customer balances\n3. Identify and resolve timing differences\n4. Apply unapplied payments",
        time: "1-2 hours",
        priority: "Medium",
      },
    ],
  };

  const requiredReports: string[] = [
    "Profit and Loss Statement",
    "Balance Sheet",
    "General Ledger",
    "Chart of Accounts",
    "Trial Balance",
    "Bank Reconciliation Reports",
    "A/R Aging Summary & Detail",
    "A/P Aging Summary & Detail",
    "Audit Log",
  ];

  // Initialize QBO service when authenticated but DON'T auto-fetch data
  useEffect(() => {
    if (
      accessToken &&
      realmId &&
      qboService &&
      !financialData &&
      !isFetchingData
    ) {
      qboService.setAuth(accessToken, realmId);
      logger.info("QBO service authenticated, ready for manual data import");
      
      // Don't automatically start import - let user:
      // 1. See and adjust the DaysFilter component
      // 2. Click "Import QBO Data" button manually
      // This gives user control over the date range selection
    }
  }, [
    accessToken,
    realmId,
    currentStep,
    qboService,
    financialData,
    isFetchingData,
  ]);

  // Remove handleCustomersFetch - no longer needed for QBO integration

  // Remove handleCustomerSelect - no longer needed

  const handleFetchFinancialData = async () => {
    logger.group("Financial Data Fetch via Webhook");
    logger.info("Starting 5-pillar data import via webhook for company books");

    setIsFetchingData(true);
    setIsImportingData(true);
    setDataFetchError(null);
    setShowImportedDataPreview(false);
    setImportCompleted(false);

    // Reset pillar status
    setPillarImportStatus({
      reconciliation: { status: "pending" },
      chartOfAccounts: { status: "pending" },
      categorization: { status: "pending" },
      controlAccounts: { status: "pending" },
      arApValidity: { status: "pending" },
    });

    try {
      // Progress callback to update UI
      const progressCallback = (
        pillar: string,
        status: "pending" | "importing" | "completed" | "error",
      ) => {
        setPillarImportStatus((prevStatus) => {
          const newStatus = { ...prevStatus };

          // Map webhook pillar names to our state keys
          const pillarMap: { [key: string]: keyof typeof prevStatus } = {
            reconciliation: "reconciliation",
            chartIntegrity: "chartOfAccounts",
            categorization: "categorization",
            controlAccounts: "controlAccounts",
            arApValidity: "arApValidity",
          };

          const stateKey = pillarMap[pillar];
          if (stateKey) {
            newStatus[stateKey].status = status;
          }

          return newStatus;
        });
      };

      // Fetch all pillars data via webhook
      if (!user?.id) {
        throw new Error("User authentication required");
      }
      const webhookData = await qboPillarsWebhookService.fetchAllPillarsData(
        user.id,
        progressCallback,
        daysFilter.toString()
      );

      // Simulate progressive import for each pillar with delays for better UX
      const pillars = [
        { key: 'reconciliation', name: 'Bank Reconciliation', data: webhookData.pillarData.reconciliation },
        { key: 'chartOfAccounts', name: 'Chart of Accounts', data: webhookData.pillarData.chartIntegrity },
        { key: 'categorization', name: 'Transaction Categorization', data: webhookData.pillarData.categorization },
        { key: 'controlAccounts', name: 'Control Accounts', data: webhookData.pillarData.controlAccounts },
        { key: 'arApValidity', name: 'AR/AP Validity', data: webhookData.pillarData.arApValidity },
      ];
      
      // Import each pillar progressively
      for (const pillar of pillars) {
        setPillarImportStatus(prev => ({
          ...prev,
          [pillar.key]: { status: "importing", data: null }
        }));
        
        // Simulate network delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setPillarImportStatus(prev => ({
          ...prev,
          [pillar.key]: {
            status: pillar.data ? "completed" : "error",
            data: pillar.data
          }
        }));
      }

      // Store the webhook data - transform it to match expected format
      const transformedData = {
        reconciliationAssessment: webhookData.pillarData.reconciliation,
        chartIntegrityAnalysis: webhookData.pillarData.chartIntegrity,
        uncategorizedAnalysis: webhookData.pillarData.categorization,
        controlAccountAnalysis: webhookData.pillarData.controlAccounts,
        arAging: webhookData.pillarData.arApValidity.arAging,
        apAging: webhookData.pillarData.arApValidity.apAging,
        chartOfAccounts: null, // Not needed for webhook
        trialBalance: null, // Not needed for webhook
      };

      // Store webhook data for assessment calculations
      setWebhookData(webhookData);

      // Calculate assessment results from pillar data
      const calculatedAssessment =
        PillarScoringService.calculateAssessmentFromPillars(webhookData);
      setAssessmentResults(calculatedAssessment);

      setFinancialData(transformedData as any);
      setUploadedFiles(requiredReports);
      setCurrentStep("analysis");
      logger.info(
        "5-pillar webhook data import completed successfully with calculated assessment",
        {
          webhookData,
          calculatedAssessment,
        },
      );
    } catch (error) {
      logger.error("Error fetching financial data via webhook:", error);
      setDataFetchError(
        error instanceof Error
          ? error.message
          : "Failed to fetch financial data from webhook",
      );

      // Mark all pillars as error
      setPillarImportStatus((prevStatus) => {
        const errorStatus = { ...prevStatus };
        Object.keys(errorStatus).forEach((key) => {
          errorStatus[key as keyof typeof errorStatus].status = "error";
        });
        return errorStatus;
      });
    } finally {
      setIsFetchingData(false);
      setIsImportingData(false);
      setShowImportedDataPreview(true);
      setImportCompleted(true);
      logger.groupEnd();
    }
  };

  // Customer selection no longer needed for QBO integration
  const filteredCustomers: any[] = [];

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusIcon = (status: "good" | "warning" | "critical") => {
    switch (status) {
      case "good":
        return <CheckCircledIcon className="w-5 h-5 text-green-500" />;
      case "warning":
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case "critical":
        return <CrossCircledIcon className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  // Validate assessment data before sending to AI
  const validateAssessmentData = (data: any) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if we have basic data structure
    if (!data.pillarData) {
      errors.push("Missing pillar data");
    }

    if (!data.meta) {
      errors.push("Missing metadata");
    }

    if (!data.financialMetrics) {
      errors.push("Missing financial metrics");
    }

    // Check for meaningful data
    const totalAccounts = data.financialMetrics?.totalAccounts || 0;
    const bankAccounts = data.financialMetrics?.bankAccounts || 0;

    if (totalAccounts === 0) {
      errors.push("No chart of accounts data found");
    }

    if (bankAccounts === 0) {
      warnings.push("No bank accounts found for reconciliation analysis");
    }

    // Check pillar data quality
    if (data.pillarData?.chartIntegrity?.totals?.accounts === 0) {
      errors.push("Chart of accounts appears to be empty");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  };

  // Handle AI-powered hygiene analysis with enhanced data structure
  const handleAIAnalysis = async () => {
    if (!webhookData) {
      logger.error("No webhook assessment data available for analysis");
      return;
    }

    logger.group("AI Hygiene Analysis");
    logger.info(
      "Starting AI-powered financial hygiene assessment with 5-pillar methodology using webhook data",
    );

    setIsAnalyzing(true);
    setAiAnalysisProgress({
      phase: "formatting",
      message: "Formatting assessment data for AI analysis...",
      percentage: 10,
    });

    try {
      // Format data using new raw data formatter for LLM score calculation
      const rawDataForScoring = RawDataFormatter.formatForLLMScoring(
        financialData as any,
      );

      setAiAnalysisProgress({
        phase: "validating",
        message: "Validating data completeness...",
        percentage: 25,
      });

      // Check for transaction processing issues
      const reconciliation = webhookData.pillarData.reconciliation;
      const hasTransactionDataIssues = reconciliation && 
        !reconciliation.hasTransactionData && 
        reconciliation.totalRowsFound > 0;

      // Prepare assessment data for AI analysis
      const assessmentDataForAI = {
        assessmentDate: new Date().toISOString(),
        datePeriod: {
          startDate: financialMetrics.dateRange.start,
          endDate: financialMetrics.dateRange.end
        },
        pillarScores: assessmentResults?.pillarScores || {},
        overallScore: assessmentResults?.overallScore || 0,
        pillarData: webhookData.pillarData, // Use pillarData instead of rawPillarData for validation
        meta: webhookData.meta, // Include meta data for validation
        rawPillarData: webhookData.pillarData, // Keep this for backward compatibility
        financialMetrics,
        dataQualityWarnings: hasTransactionDataIssues ? [
          {
            severity: "warning",
            pillar: "reconciliation",
            message: `Transaction data processing incomplete: ${reconciliation.totalRowsFound} rows found but only ${reconciliation.totalTransactionsProcessed} processed. This may affect reconciliation scoring accuracy due to column mapping issues in the TransactionList report.`,
            technicalDetails: {
              totalRowsFound: reconciliation.totalRowsFound,
              totalTransactionsProcessed: reconciliation.totalTransactionsProcessed,
              clearedColumnFound: reconciliation.clearedColumnFound
            }
          }
        ] : []
      };

      // Validate data before sending to AI
      const dataValidation = validateAssessmentData(assessmentDataForAI);
      if (!dataValidation.isValid) {
        logger.error(
          "Assessment data validation failed:",
          dataValidation.errors,
        );
        throw new Error(
          `Data validation failed: ${dataValidation.errors.join(", ")}`,
        );
      }

      logger.info("Assessment data prepared for AI analysis:", {
        assessmentDate: new Date().toISOString().split("T")[0],
        totalBankAccounts: financialMetrics.bankAccounts,
        totalAccounts: financialMetrics.totalAccounts,
        overallScore: assessmentResults?.overallScore || 0,
        datePeriod: `${webhookData.meta.start_date} to ${webhookData.meta.end_date}`,
        validation:
          dataValidation.warnings.length > 0
            ? dataValidation.warnings
            : "All checks passed",
      });

      setAiAnalysisProgress({
        phase: "analyzing",
        message:
          "Analyzing financial hygiene with AI (this may take 30-60 seconds)...",
        percentage: 50,
      });

      // Perform AI analysis with assessment data (including current scores and raw pillar data)
      const completeResponse: CompleteAssessmentResponse =
        await perplexityService.analyzeFinancialHygiene(
          assessmentDataForAI as any,
        );

      setAiAnalysisProgress({
        phase: "parsing",
        message: "Processing AI analysis results...",
        percentage: 85,
      });

      // Merge LLM results with calculated assessment, preserving calculated values when AI provides placeholders
      const mergedAssessment: HygieneAssessmentResult = {
        ...completeResponse.assessmentResult,
        // Override placeholder text with calculated values if AI didn't provide proper content
        businessOwnerSummary: {
          ...completeResponse.assessmentResult.businessOwnerSummary,
          // Check for invalid/placeholder text and use calculated value or error
          whatThisMeans: (() => {
            const aiValue = completeResponse.assessmentResult.businessOwnerSummary.whatThisMeans;
            const calcValue = assessmentResults?.businessOwnerSummary?.whatThisMeans;
            
            if (!aiValue || aiValue.includes("Analyzing") || aiValue.includes("Loading")) {
              logger.error('AI returned invalid whatThisMeans text', { aiValue });
              return calcValue || 'ERROR: Missing assessment summary';
            }
            return aiValue;
          })(),
          // Use calculated key findings if AI didn't provide any
          keyFindings: completeResponse.assessmentResult.businessOwnerSummary.keyFindings.length === 0 && 
                      assessmentResults?.businessOwnerSummary?.keyFindings
            ? assessmentResults.businessOwnerSummary.keyFindings
            : completeResponse.assessmentResult.businessOwnerSummary.keyFindings,
          // Use calculated next steps if AI didn't provide any
          nextSteps: completeResponse.assessmentResult.businessOwnerSummary.nextSteps.length === 0 && 
                    assessmentResults?.businessOwnerSummary?.nextSteps
            ? assessmentResults.businessOwnerSummary.nextSteps
            : completeResponse.assessmentResult.businessOwnerSummary.nextSteps,
        },
      };
      
      setAssessmentResults(mergedAssessment);

      // Store ephemerally for PDF generation with merged results
      const assessmentId = AssessmentStorageService.storeAssessmentResults(
        mergedAssessment,
        completeResponse.rawLLMResponse,
        formData.company,
      );

      setAiAnalysisProgress({
        phase: "complete",
        message: "AI analysis completed successfully!",
        percentage: 100,
      });

      // Brief delay to show completion before moving to results
      setTimeout(() => {
        setCurrentStep("results");
        setAiAnalysisProgress(null);
      }, 1000);

      logger.info("AI hygiene assessment completed successfully", {
        overallScore: completeResponse.assessmentResult.overallScore,
        readinessStatus: completeResponse.assessmentResult.readinessStatus,
        pillarScores: completeResponse.assessmentResult.pillarScores,
        dataCompletenessScore: financialMetrics.dataCompletenessScore,
        assessmentId,
      });
    } catch (error) {
      logger.error("AI hygiene analysis failed", error);

      // Provide user-friendly error handling
      setAiAnalysisProgress({
        phase: "error",
        message:
          "AI analysis encountered an issue. Using basic assessment instead.",
        percentage: 100,
      });

      // Show error for a moment, then continue with existing assessment
      setTimeout(() => {
        setAiAnalysisProgress(null);
        logger.info("Using existing calculated assessment as fallback");
      }, 3000);

      // Don't create fallback results - we already have calculated assessment from webhook
      // Just log the error and continue with the existing assessment
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      logger.warn(
        "Continuing with basic assessment due to AI analysis failure:",
        errorMessage,
      );
    } finally {
      setIsAnalyzing(false);
      logger.groupEnd();
    }
  };

  // Handle PDF generation
  const handlePDFGeneration = async (action: "download" | "view") => {
    setIsGeneratingPDF(true);
    setPdfError(null);

    try {
      logger.info(`Starting PDF ${action}...`);

      // Check if we have assessment results
      if (!assessmentResults) {
        throw new Error("No assessment results available for PDF generation");
      }

      // Import PDFGenerationService dynamically
      const { PDFGenerationService } = await import('../services/pdfGenerationService');

      // Generate PDF using the new service
      const result = await PDFGenerationService.generateReport(
        assessmentResults,
        formData.company || "Company",
        {
          action,
          fileName: `${formData.company?.replace(/[^a-zA-Z0-9]/g, '_') || 'company'}_hygiene_assessment_${new Date().toISOString().split('T')[0]}.pdf`
        }
      );

      if (!result.success) {
        throw new Error(result.error || "PDF generation failed");
      }

      logger.info(`PDF ${action} completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "PDF generation failed";
      logger.error(`PDF ${action} failed`, error);
      setPdfError(errorMessage);
      
      // Show user-friendly error message
      alert(`Failed to ${action} PDF: ${errorMessage}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Check if we have assessment results for PDF generation
  const hasAssessmentResults = assessmentResults !== null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Financial Books Hygiene Assessment
            </h1>
            <div className="flex items-center space-x-4">
              {isLoaded && isSignedIn && user ? (
                <span className="text-sm text-gray-600">
                  Welcome, {user.username}
                </span>
              ) : (
                <span className="text-sm text-gray-600">
                  Welcome, {formData.firstName}
                </span>
              )}
              <div className="flex space-x-2">
                <span className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full">
                  QuickBooks Connected
                </span>
                {/* <button
                  onClick={() => navigate("/qbo-auth")}
                  className="text-gray-600 hover:text-gray-900 text-sm"
                >
                  Settings
                </button> */}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-8">
            <div
              className={`flex items-center ${currentStep === "upload" ? "text-blue-600" : "text-gray-400"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "upload" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                1
              </div>
              <span className="ml-2 font-medium">Data Fetch</span>
            </div>
            <div
              className={`flex items-center ${currentStep === "analysis" ? "text-blue-600" : "text-gray-400"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "analysis" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                2
              </div>
              <span className="ml-2 font-medium">Analysis</span>
            </div>
            <div
              className={`flex items-center ${currentStep === "results" ? "text-blue-600" : "text-gray-400"}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === "results" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
              >
                3
              </div>
              <span className="ml-2 font-medium">Results</span>
            </div>
          </div>
        </div>

        {/* Connect/Data Fetch Step */}
        {currentStep === "upload" && (
          <div className="space-y-6">
            {/* QBO Financial Data Fetch Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <Link2Icon className="w-5 h-5 mr-2" />
                QuickBooks Online Connection
              </h2>

              {/* Show loading state while checking tokens */}
              {isCheckingTokens && (
                <div className="flex items-center justify-center py-8">
                  <ReloadIcon className="w-6 h-6 text-blue-600 animate-spin mr-3" />
                  <span className="text-gray-600">Checking for existing QuickBooks connection...</span>
                </div>
              )}
              
              {/* Show connect button if no tokens exist */}
              {!isCheckingTokens && !hasExistingTokens && !isFetchingData && !financialData && !dataFetchError && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <ExclamationTriangleIcon className="w-6 h-6 text-yellow-600 mt-1 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        QuickBooks Connection Required
                      </h3>
                      <p className="text-gray-700 mb-4">
                        Please connect your QuickBooks Online account to begin the assessment.
                      </p>
                      <button
                        onClick={() => navigate("/qbo-auth")}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                      >
                        <Link2Icon className="w-5 h-5 mr-2" />
                        Connect to QuickBooks Online
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Show import button if tokens exist */}
              {!isCheckingTokens && hasExistingTokens && !isFetchingData && !financialData && !dataFetchError && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <div className="flex items-start">
                    <CheckCircledIcon className="w-6 h-6 text-green-600 mt-1 mr-3 flex-shrink-0" />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        QuickBooks Already Connected
                      </h3>
                      <p className="text-gray-700 mb-6">
                        Your QuickBooks Online account is connected and ready. Configure the data range and import your financial data.
                      </p>
                      
                      {/* Days Filter Component */}
                      <div className="mb-6">
                        <DaysFilter
                          value={daysFilter}
                          onChange={setDaysFilter}
                          disabled={isFetchingData || isImportingData}
                        />
                      </div>
                      
                      <div className="flex gap-4">
                        <button
                          onClick={handleFetchFinancialData}
                          className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                        >
                          <DownloadIcon className="w-5 h-5 mr-2" />
                          Import QuickBooks Data ({daysFilter} days)
                        </button>
                        <button
                          onClick={() => navigate("/qbo-auth")}
                          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
                        >
                          <ReloadIcon className="w-5 h-5 mr-2" />
                          Reconnect QuickBooks
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {financialData && (
                <div className="flex flex-col items-center py-4">
                  <CheckCircledIcon className="w-12 h-12 text-green-600 mb-4" />
                  <p className="text-lg font-medium text-gray-900">
                    Financial Data Retrieved Successfully!
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Connected to: {formData.company} (Realm ID: {realmId})
                  </p>
                </div>
              )}

              {dataFetchError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <CrossCircledIcon className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
                    <div>
                      <p className="text-red-800 font-medium">
                        Data Fetch Failed
                      </p>
                      <p className="text-red-700 text-sm mt-1">
                        {dataFetchError}
                      </p>
                      <button
                        onClick={handleFetchFinancialData}
                        className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm"
                      >
                        Retry Data Fetch
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Upload Fallback */}
            {(dataFetchError ||
              (!isFetchingData && uploadedFiles.length === 0)) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center">
                  <UploadIcon className="w-5 h-5 mr-2" />
                  Manual Report Upload (Fallback)
                </h2>
                <p className="text-gray-600 mb-4">
                  If automatic data fetching fails, you can upload Excel (.xlsx)
                  reports manually from QuickBooks Online.
                </p>

                {/* Date Range Selection */}
                <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Fiscal Year
                    </label>
                    <div className="flex items-center border rounded-lg px-3 py-2">
                      <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <select className="w-full border-none focus:outline-none">
                        <option>2024</option>
                        <option>2023</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Previous Fiscal Year
                    </label>
                    <div className="flex items-center border rounded-lg px-3 py-2">
                      <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <select className="w-full border-none focus:outline-none">
                        <option>2023</option>
                        <option>2022</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rolling 13 Months
                    </label>
                    <div className="flex items-center border rounded-lg px-3 py-2">
                      <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <input
                        type="text"
                        value="Jan 2023 - Jan 2024"
                        className="w-full border-none focus:outline-none"
                        readOnly
                      />
                    </div>
                  </div>
                </div>

                {/* Required Reports Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requiredReports.map((report, index) => (
                    <div
                      key={index}
                      className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">
                          {report}
                        </span>
                        {uploadedFiles.includes(report) ? (
                          <CheckCircledIcon className="w-5 h-5 text-green-500" />
                        ) : (
                          <UploadIcon className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <button
                        onClick={() => handleFileUpload(report)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {uploadedFiles.includes(report)
                          ? "Uploaded ✓"
                          : "Click to upload .xlsx file"}
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    {uploadedFiles.length} of {requiredReports.length} reports
                    uploaded
                  </span>
                  <button
                    onClick={() => setCurrentStep("analysis")}
                    disabled={uploadedFiles.length < 3}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    Proceed to Analysis
                  </button>
                </div>
              </div>
            )}

            {/* Auto-proceed when customers are fetched */}
            {customers.length > 0 && !isLoadingCustomers && (
              <div className="bg-white rounded-lg shadow p-6 text-center">
                <p className="text-gray-600 mb-4">
                  Customer list fetched successfully!
                </p>
                <button
                  onClick={() => setCurrentStep("analysis")}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Continue to Analysis
                </button>
              </div>
            )}

            {/* Enhanced 5-Pillar Data Import Status */}
            {(isImportingData || importCompleted) && (currentStep === "upload" || currentStep === "analysis") && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <div className="text-center mb-8">
                  {isImportingData ? (
                    <>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        Importing Financial Data
                      </h3>
                      <p className="text-gray-600">
                        Analyzing your QuickBooks data across 5 critical hygiene pillars
                      </p>
                    </>
                  ) : importCompleted ? (
                    <>
                      <h3 className="text-2xl font-bold text-green-600 mb-2">
                        ✓ Data Import Complete!
                      </h3>
                      <p className="text-gray-600">
                        Successfully imported all 5 pillars from QuickBooks
                      </p>
                    </>
                  ) : null}
                  <p className="text-sm text-gray-500 mt-1">
                    Company: <span className="font-medium">{formData.company}</span>
                  </p>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                    <span className="text-sm font-medium text-blue-600">
                      {Object.values(pillarImportStatus).filter(s => s.status === "completed").length} of 5 pillars complete
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${(Object.values(pillarImportStatus).filter(s => s.status === "completed").length / 5) * 100}%`
                      }}
                    />
                  </div>
                </div>

                {/* Pillar Cards with Enhanced Visual Design */}
                <div className="space-y-4">
                  {/* Pillar 1: Bank Reconciliation */}
                  <div className={`border-2 rounded-lg p-6 transition-all duration-300 ${
                    pillarImportStatus.reconciliation.status === "importing" 
                      ? "border-blue-400 bg-blue-50 shadow-lg transform scale-[1.02]"
                      : pillarImportStatus.reconciliation.status === "completed"
                        ? "border-green-400 bg-green-50"
                        : pillarImportStatus.reconciliation.status === "error"
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 bg-gray-50"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-3xl">💰</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Bank Reconciliation</h4>
                          <p className="text-sm text-gray-600">Matching bank statements with books</p>
                          {pillarImportStatus.reconciliation.data && (
                            <div className="mt-2 text-xs text-gray-500">
                              ✓ {pillarImportStatus.reconciliation.data.bankAccounts?.length || 0} bank accounts analyzed
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        {pillarImportStatus.reconciliation.status === "completed" && (
                          <CheckCircledIcon className="w-6 h-6 text-green-600" />
                        )}
                        {pillarImportStatus.reconciliation.status === "importing" && (
                          <ReloadIcon className="w-6 h-6 text-blue-600 animate-spin" />
                        )}
                        {pillarImportStatus.reconciliation.status === "error" && (
                          <CrossCircledIcon className="w-6 h-6 text-red-600" />
                        )}
                        {pillarImportStatus.reconciliation.status === "pending" && (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                        )}
                        <span className={`text-xs mt-2 px-2 py-1 rounded-full ${
                          pillarImportStatus.reconciliation.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : pillarImportStatus.reconciliation.status === "importing"
                              ? "bg-blue-100 text-blue-700"
                              : pillarImportStatus.reconciliation.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-500"
                        }`}>
                          {pillarImportStatus.reconciliation.status === "completed"
                            ? "Complete"
                            : pillarImportStatus.reconciliation.status === "importing"
                              ? "Importing..."
                              : pillarImportStatus.reconciliation.status === "error"
                                ? "Failed"
                                : "Waiting"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 2: Chart of Accounts Integrity */}
                  <div className={`border-2 rounded-lg p-6 transition-all duration-300 ${
                    pillarImportStatus.chartOfAccounts.status === "importing" 
                      ? "border-blue-400 bg-blue-50 shadow-lg transform scale-[1.02]"
                      : pillarImportStatus.chartOfAccounts.status === "completed"
                        ? "border-green-400 bg-green-50"
                        : pillarImportStatus.chartOfAccounts.status === "error"
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 bg-gray-50"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-3xl">📊</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Chart of Accounts Integrity</h4>
                          <p className="text-sm text-gray-600">Analyzing account structure and duplicates</p>
                          {pillarImportStatus.chartOfAccounts.data && (
                            <div className="mt-2 text-xs text-gray-500">
                              ✓ {pillarImportStatus.chartOfAccounts.data.totals?.accounts || 0} accounts analyzed
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        {pillarImportStatus.chartOfAccounts.status === "completed" && (
                          <CheckCircledIcon className="w-6 h-6 text-green-600" />
                        )}
                        {pillarImportStatus.chartOfAccounts.status === "importing" && (
                          <ReloadIcon className="w-6 h-6 text-blue-600 animate-spin" />
                        )}
                        {pillarImportStatus.chartOfAccounts.status === "error" && (
                          <CrossCircledIcon className="w-6 h-6 text-red-600" />
                        )}
                        {pillarImportStatus.chartOfAccounts.status === "pending" && (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                        )}
                        <span className={`text-xs mt-2 px-2 py-1 rounded-full ${
                          pillarImportStatus.chartOfAccounts.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : pillarImportStatus.chartOfAccounts.status === "importing"
                              ? "bg-blue-100 text-blue-700"
                              : pillarImportStatus.chartOfAccounts.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-500"
                        }`}>
                          {pillarImportStatus.chartOfAccounts.status === "completed"
                            ? "Complete"
                            : pillarImportStatus.chartOfAccounts.status === "importing"
                              ? "Importing..."
                              : pillarImportStatus.chartOfAccounts.status === "error"
                                ? "Failed"
                                : "Waiting"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 3: Transaction Categorization */}
                  <div className={`border-2 rounded-lg p-6 transition-all duration-300 ${
                    pillarImportStatus.categorization.status === "importing" 
                      ? "border-blue-400 bg-blue-50 shadow-lg transform scale-[1.02]"
                      : pillarImportStatus.categorization.status === "completed"
                        ? "border-green-400 bg-green-50"
                        : pillarImportStatus.categorization.status === "error"
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 bg-gray-50"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-3xl">🏷️</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Transaction Categorization</h4>
                          <p className="text-sm text-gray-600">Checking for uncategorized transactions</p>
                          {pillarImportStatus.categorization.data && (
                            <div className="mt-2 text-xs text-gray-500">
                              ✓ ${(pillarImportStatus.categorization.data.uncategorizedExpense?.total || 0).toFixed(2)} uncategorized
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        {pillarImportStatus.categorization.status === "completed" && (
                          <CheckCircledIcon className="w-6 h-6 text-green-600" />
                        )}
                        {pillarImportStatus.categorization.status === "importing" && (
                          <ReloadIcon className="w-6 h-6 text-blue-600 animate-spin" />
                        )}
                        {pillarImportStatus.categorization.status === "error" && (
                          <CrossCircledIcon className="w-6 h-6 text-red-600" />
                        )}
                        {pillarImportStatus.categorization.status === "pending" && (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                        )}
                        <span className={`text-xs mt-2 px-2 py-1 rounded-full ${
                          pillarImportStatus.categorization.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : pillarImportStatus.categorization.status === "importing"
                              ? "bg-blue-100 text-blue-700"
                              : pillarImportStatus.categorization.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-500"
                        }`}>
                          {pillarImportStatus.categorization.status === "completed"
                            ? "Complete"
                            : pillarImportStatus.categorization.status === "importing"
                              ? "Importing..."
                              : pillarImportStatus.categorization.status === "error"
                                ? "Failed"
                                : "Waiting"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 4: Control Account Accuracy */}
                  <div className={`border-2 rounded-lg p-6 transition-all duration-300 ${
                    pillarImportStatus.controlAccounts.status === "importing" 
                      ? "border-blue-400 bg-blue-50 shadow-lg transform scale-[1.02]"
                      : pillarImportStatus.controlAccounts.status === "completed"
                        ? "border-green-400 bg-green-50"
                        : pillarImportStatus.controlAccounts.status === "error"
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 bg-gray-50"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-3xl">⚖️</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Control Account Accuracy</h4>
                          <p className="text-sm text-gray-600">Validating control account balances</p>
                          {pillarImportStatus.controlAccounts.data && (
                            <div className="mt-2 text-xs text-gray-500">
                              ✓ OBE: ${(pillarImportStatus.controlAccounts.data.openingBalanceEquity?.balance || 0).toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        {pillarImportStatus.controlAccounts.status === "completed" && (
                          <CheckCircledIcon className="w-6 h-6 text-green-600" />
                        )}
                        {pillarImportStatus.controlAccounts.status === "importing" && (
                          <ReloadIcon className="w-6 h-6 text-blue-600 animate-spin" />
                        )}
                        {pillarImportStatus.controlAccounts.status === "error" && (
                          <CrossCircledIcon className="w-6 h-6 text-red-600" />
                        )}
                        {pillarImportStatus.controlAccounts.status === "pending" && (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                        )}
                        <span className={`text-xs mt-2 px-2 py-1 rounded-full ${
                          pillarImportStatus.controlAccounts.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : pillarImportStatus.controlAccounts.status === "importing"
                              ? "bg-blue-100 text-blue-700"
                              : pillarImportStatus.controlAccounts.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-500"
                        }`}>
                          {pillarImportStatus.controlAccounts.status === "completed"
                            ? "Complete"
                            : pillarImportStatus.controlAccounts.status === "importing"
                              ? "Importing..."
                              : pillarImportStatus.controlAccounts.status === "error"
                                ? "Failed"
                                : "Waiting"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pillar 5: AR/AP Validity */}
                  <div className={`border-2 rounded-lg p-6 transition-all duration-300 ${
                    pillarImportStatus.arApValidity.status === "importing" 
                      ? "border-blue-400 bg-blue-50 shadow-lg transform scale-[1.02]"
                      : pillarImportStatus.arApValidity.status === "completed"
                        ? "border-green-400 bg-green-50"
                        : pillarImportStatus.arApValidity.status === "error"
                          ? "border-red-400 bg-red-50"
                          : "border-gray-200 bg-gray-50"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-3xl">📈</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">AR/AP Validity</h4>
                          <p className="text-sm text-gray-600">Analyzing receivables and payables aging</p>
                          {pillarImportStatus.arApValidity.data && (
                            <div className="mt-2 text-xs text-gray-500">
                              ✓ AR/AP aging reports imported
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        {pillarImportStatus.arApValidity.status === "completed" && (
                          <CheckCircledIcon className="w-6 h-6 text-green-600" />
                        )}
                        {pillarImportStatus.arApValidity.status === "importing" && (
                          <ReloadIcon className="w-6 h-6 text-blue-600 animate-spin" />
                        )}
                        {pillarImportStatus.arApValidity.status === "error" && (
                          <CrossCircledIcon className="w-6 h-6 text-red-600" />
                        )}
                        {pillarImportStatus.arApValidity.status === "pending" && (
                          <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                        )}
                        <span className={`text-xs mt-2 px-2 py-1 rounded-full ${
                          pillarImportStatus.arApValidity.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : pillarImportStatus.arApValidity.status === "importing"
                              ? "bg-blue-100 text-blue-700"
                              : pillarImportStatus.arApValidity.status === "error"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-500"
                        }`}>
                          {pillarImportStatus.arApValidity.status === "completed"
                            ? "Complete"
                            : pillarImportStatus.arApValidity.status === "importing"
                              ? "Importing..."
                              : pillarImportStatus.arApValidity.status === "error"
                                ? "Failed"
                                : "Waiting"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Show data summary after import completes */}
                {importCompleted && webhookData && (
                  <div className="mt-8 border-t pt-6">
                    <h4 className="text-lg font-semibold mb-4 text-gray-800">Import Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Reconciliation Summary */}
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h5 className="font-medium text-blue-900 mb-2">Bank Reconciliation</h5>
                        <p className="text-sm text-blue-700">
                          {webhookData.pillarData.reconciliation.variance?.length || 0} accounts analyzed
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Total variance: ${webhookData.pillarData.reconciliation.variance?.reduce((sum, acc) => sum + Math.abs(acc.varianceBookVsCleared), 0).toFixed(2) || '0.00'}
                        </p>
                      </div>
                      
                      {/* Chart of Accounts Summary */}
                      <div className="bg-green-50 rounded-lg p-4">
                        <h5 className="font-medium text-green-900 mb-2">Chart of Accounts</h5>
                        <p className="text-sm text-green-700">
                          {webhookData.pillarData.chartIntegrity.totals.accounts} total accounts
                        </p>
                        <p className="text-xs text-green-600 mt-1">
                          {webhookData.pillarData.chartIntegrity.duplicates.name.length} duplicate names found
                        </p>
                      </div>
                      
                      {/* Categorization Summary */}
                      <div className="bg-yellow-50 rounded-lg p-4">
                        <h5 className="font-medium text-yellow-900 mb-2">Categorization</h5>
                        <p className="text-sm text-yellow-700">
                          {Object.values(webhookData.pillarData.categorization.uncategorized).reduce((sum: number, cat: any) => sum + cat.count, 0)} uncategorized items
                        </p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Total amount: ${Object.values(webhookData.pillarData.categorization.uncategorized).reduce((sum: number, cat: any) => sum + cat.amount, 0).toFixed(2)}
                        </p>
                      </div>
                      
                      {/* Control Accounts Summary */}
                      <div className="bg-purple-50 rounded-lg p-4">
                        <h5 className="font-medium text-purple-900 mb-2">Control Accounts</h5>
                        <p className="text-sm text-purple-700">
                          AR Balance: ${webhookData.pillarData.controlAccounts.ar.balance.toFixed(2)}
                        </p>
                        <p className="text-xs text-purple-600 mt-1">
                          AP Balance: ${webhookData.pillarData.controlAccounts.ap.balance.toFixed(2)}
                        </p>
                      </div>
                      
                      {/* AR/AP Aging Summary */}
                      <div className="bg-orange-50 rounded-lg p-4">
                        <h5 className="font-medium text-orange-900 mb-2">AR Aging</h5>
                        <p className="text-sm text-orange-700">
                          Current: ${webhookData.pillarData.arApValidity.arAging.current.toFixed(2)}
                        </p>
                        <p className="text-xs text-orange-600 mt-1">
                          Past due: ${(webhookData.pillarData.arApValidity.arAging.d1_30 + 
                                       webhookData.pillarData.arApValidity.arAging.d31_60 +
                                       webhookData.pillarData.arApValidity.arAging.d61_90 +
                                       webhookData.pillarData.arApValidity.arAging.d90_plus).toFixed(2)}
                        </p>
                      </div>
                      
                      {/* Date Range */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-medium text-gray-900 mb-2">Date Range</h5>
                        <p className="text-sm text-gray-700">
                          {webhookData.meta.start_date} to {webhookData.meta.end_date}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {webhookData.meta.windowDays} days of data
                        </p>
                      </div>
                    </div>
                    
                    {/* Action buttons */}
                    <div className="mt-6 flex justify-center space-x-4">
                      <button
                        onClick={() => setCurrentStep("analysis")}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                      >
                        <CheckCircledIcon className="w-5 h-5 mr-2" />
                        Proceed to AI Analysis
                      </button>
                      <button
                        onClick={() => setImportCompleted(false)}
                        className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Hide Summary
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Formatted Imported Data Report - Show after all data is imported */}
            {financialData && importCompleted && currentStep === "upload" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-xl font-semibold mb-6">
                  Imported Data Summary - Ready for AI Analysis
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Data Completeness Overview */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-3">
                      Data Completeness
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Assessment Scope:</span>
                        <span className="font-medium">3-Month Analysis</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">
                          Data Quality Score:
                        </span>
                        <span className="font-medium">
                          {(financialData as any).dataCompletenessScore || 0}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Period Analyzed:</span>
                        <span className="font-medium text-sm">
                          {(financialData as any).datePeriod?.startDate} to{" "}
                          {(financialData as any).datePeriod?.endDate}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pillar Data Status */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-900 mb-3">
                      5-Pillar Data Status
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(pillarImportStatus).map(
                        ([pillar, status]) => (
                          <div
                            key={pillar}
                            className="flex items-center justify-between"
                          >
                            <span className="text-green-700 text-sm capitalize">
                              {pillar
                                .replace(/([A-Z])/g, " $1")
                                .replace(/^./, (str) => str.toUpperCase())}
                              :
                            </span>
                            <div className="flex items-center">
                              {status.status === "completed" && (
                                <>
                                  <CheckCircledIcon className="w-4 h-4 text-green-500 mr-1" />
                                  <span className="text-sm font-medium text-green-800">
                                    Ready
                                  </span>
                                </>
                              )}
                              {status.status === "error" && (
                                <>
                                  <CrossCircledIcon className="w-4 h-4 text-red-500 mr-1" />
                                  <span className="text-sm font-medium text-red-800">
                                    Missing
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>

                {/* Detailed Data Breakdown by Pillar */}
                <div className="space-y-6">
                  <h4 className="text-lg font-semibold text-gray-900">
                    Detailed Data Report
                  </h4>

                  {/* Pillar 1: Reconciliation Data */}
                  {(financialData as any).reconciliationAssessment && (
                    <div className="border rounded-lg p-4">
                      <h5 className="font-semibold text-blue-600 mb-3 flex items-center">
                        <CheckCircledIcon className="w-5 h-5 mr-2" />
                        Pillar 1: Bank & Credit Card Reconciliation
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">
                            Total Bank Accounts:
                          </span>
                          <p className="text-gray-600">
                            {(financialData as any).reconciliationAssessment
                              .totalAccounts || 0}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">
                            Accounts Analyzed:
                          </span>
                          <p className="text-gray-600">
                            {(financialData as any).reconciliationAssessment
                              .assessments?.length || 0}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Critical Issues:</span>
                          <p className="text-gray-600">
                            {(financialData as any).reconciliationAssessment
                              .criticalAccounts || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pillar 2: Chart of Accounts */}
                  {(financialData as any).chartOfAccounts && (
                    <div className="border rounded-lg p-4">
                      <h5 className="font-semibold text-blue-600 mb-3 flex items-center">
                        <CheckCircledIcon className="w-5 h-5 mr-2" />
                        Pillar 2: Chart of Accounts Integrity
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Total Accounts:</span>
                          <p className="text-gray-600">
                            {Array.isArray(
                              (financialData as any).chartOfAccounts,
                            )
                              ? (financialData as any).chartOfAccounts.length
                              : 0}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Active Accounts:</span>
                          <p className="text-gray-600">
                            {Array.isArray(
                              (financialData as any).chartOfAccounts,
                            )
                              ? (financialData as any).chartOfAccounts.filter(
                                  (acc: any) => acc.Active,
                                ).length
                              : 0}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Account Types:</span>
                          <p className="text-gray-600">
                            {Array.isArray(
                              (financialData as any).chartOfAccounts,
                            )
                              ? new Set(
                                  (financialData as any).chartOfAccounts.map(
                                    (acc: any) => acc.AccountType,
                                  ),
                                ).size
                              : 0}{" "}
                            types
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pillar 3: Transaction Categorization */}
                  {(financialData as any).uncategorizedAnalysis && (
                    <div className="border rounded-lg p-4">
                      <h5 className="font-semibold text-blue-600 mb-3 flex items-center">
                        <CheckCircledIcon className="w-5 h-5 mr-2" />
                        Pillar 3: Transaction Categorization
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">
                            Uncategorized Balance:
                          </span>
                          <p className="text-gray-600">
                            $
                            {(
                              (financialData as any).uncategorizedAnalysis
                                .uncategorizedBalance || 0
                            ).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">
                            Uncategorized Count:
                          </span>
                          <p className="text-gray-600">
                            {(financialData as any).uncategorizedAnalysis
                              .uncategorizedCount || 0}{" "}
                            transactions
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">
                            Missing Assignments:
                          </span>
                          <p className="text-gray-600">
                            {(financialData as any).uncategorizedAnalysis
                              .missingVendorCustomer || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pillar 4: Control Accounts */}
                  {(financialData as any).controlAccountAnalysis && (
                    <div className="border rounded-lg p-4">
                      <h5 className="font-semibold text-blue-600 mb-3 flex items-center">
                        <CheckCircledIcon className="w-5 h-5 mr-2" />
                        Pillar 4: Control Account Accuracy
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">
                            Opening Balance Equity:
                          </span>
                          <p className="text-gray-600">
                            $
                            {(
                              (financialData as any).controlAccountAnalysis
                                .openingBalanceEquity?.balance || 0
                            ).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">
                            Undeposited Funds:
                          </span>
                          <p className="text-gray-600">
                            $
                            {(
                              (financialData as any).controlAccountAnalysis
                                .undepositedFunds?.balance || 0
                            ).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">
                            Payroll Liabilities:
                          </span>
                          <p className="text-gray-600">
                            {(financialData as any).controlAccountAnalysis
                              .payrollLiabilities?.length || 0}{" "}
                            accounts
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pillar 5: A/R & A/P Validity */}
                  {(financialData.arAging || financialData.apAging) && (
                    <div className="border rounded-lg p-4">
                      <h5 className="font-semibold text-blue-600 mb-3 flex items-center">
                        <CheckCircledIcon className="w-5 h-5 mr-2" />
                        Pillar 5: A/R & A/P Validity
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">A/R Aging Report:</span>
                          <p className="text-gray-600">
                            {financialData.arAging
                              ? "Available"
                              : "Not Available"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">A/P Aging Report:</span>
                          <p className="text-gray-600">
                            {financialData.apAging
                              ? "Available"
                              : "Not Available"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium">Data Rows:</span>
                          <p className="text-gray-600">
                            {(financialData.arAging?.Rows?.Row?.length || 0) +
                              (financialData.apAging?.Rows?.Row?.length ||
                                0)}{" "}
                            entries
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Data Report Formatter - Shows exact format that will be sent to LLM */}
                {webhookData && (
                  <DataReportFormatter 
                    webhookData={webhookData}
                    className="mb-6"
                  />
                )}

                {/* Action Buttons Section */}
                <div className="mt-8">
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
                    <div className="text-center">
                      <CheckCircledIcon className="w-12 h-12 text-green-600 mx-auto mb-3" />
                      <p className="text-green-800 font-semibold text-lg">
                        All 5 Pillars Successfully Imported
                      </p>
                      <p className="text-green-700 text-sm mt-2">
                        Your financial data is ready for comprehensive AI-powered hygiene assessment
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <button
                      onClick={handleFetchFinancialData}
                      className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center"
                    >
                      <ReloadIcon className="w-5 h-5 mr-2" />
                      Re-import Data
                    </button>
                    <button
                      onClick={() => setCurrentStep("analysis")}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-colors flex items-center justify-center shadow-lg"
                  >
                    <PlayIcon className="w-5 h-5 mr-2" />
                    Proceed to Analysis
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Customer Selection Step */}
        {currentStep === "customer-selection" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center">
                <PersonIcon className="w-5 h-5 mr-2" />
                Select Customer for Analysis
              </h2>
              <p className="text-gray-600 mb-6">
                Choose the customer whose financial data you want to analyze.
                This will filter reports to show data specific to this customer.
              </p>

              {/* Customer Selection */}
              <div className="space-y-6">
                {/* Search and Dropdown */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Search
                  </label>
                  <div className="relative">
                    <div className="flex items-center border-2 border-gray-300 rounded-lg focus-within:border-blue-500">
                      <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 ml-3" />
                      <input
                        type="text"
                        placeholder="Search customers..."
                        value={""} // customerSearchTerm
                        onChange={(e) => {}} // setCustomerSearchTerm(e.target.value)
                        onFocus={() => {}} // setIsCustomerDropdownOpen(true)
                        className="w-full px-3 py-3 border-none focus:outline-none"
                      />
                      <button
                        onClick={() => {}} // setIsCustomerDropdownOpen(!isCustomerDropdownOpen)
                        className="px-3 py-3 text-gray-400 hover:text-gray-600"
                      >
                        <ChevronDownIcon className="w-5 h-5" />
                      </button>
                    </div>
                    {/* Dropdown */}
                    {false && ( // isCustomerDropdownOpen
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map((customer) => (
                            <button
                              key={customer.Id}
                              onClick={() => {}} // handleCustomerSelect(customer)
                              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {customer.DisplayName}
                                  </p>
                                  {customer.CompanyName && (
                                    <p className="text-sm text-gray-600">
                                      {customer.CompanyName}
                                    </p>
                                  )}
                                  {customer.PrimaryEmailAddr && (
                                    <p className="text-xs text-gray-500">
                                      {customer.PrimaryEmailAddr.Address}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-gray-900">
                                    ${customer.Balance.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Balance
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-gray-500 text-center">
                            No customers found
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Customer Preview */}
                {selectedCustomer && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">
                      Selected Customer
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {"Customer Name"} {/* selectedCustomer.DisplayName */}
                        </p>
                        {false /* selectedCustomer.CompanyName */ && (
                          <p className="text-gray-600">
                            {"Company Name"}{" "}
                            {/* selectedCustomer.CompanyName */}
                          </p>
                        )}
                        {false /* selectedCustomer.PrimaryEmailAddr */ && (
                          <p className="text-sm text-gray-600">
                            {"email@example.com"}{" "}
                            {/* selectedCustomer.PrimaryEmailAddr.Address */}
                          </p>
                        )}
                        {false /* selectedCustomer.PrimaryPhone */ && (
                          <p className="text-sm text-gray-600">
                            {"555-1234"}{" "}
                            {/* selectedCustomer.PrimaryPhone.FreeFormNumber */}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Current Balance</p>
                        <p className="text-lg font-semibold text-gray-900">
                          ${"0.00"} {/* selectedCustomer.Balance.toFixed(2) */}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last Updated: {new Date().toLocaleDateString()}{" "}
                          {/* selectedCustomer.MetaData.LastUpdatedTime */}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Date Range Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <div className="flex items-center border rounded-lg px-3 py-2">
                      <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <input
                        type="date"
                        value={dateRange.startDate}
                        onChange={(e) =>
                          setDateRange((prev) => ({
                            ...prev,
                            startDate: e.target.value,
                          }))
                        }
                        className="w-full border-none focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date
                    </label>
                    <div className="flex items-center border rounded-lg px-3 py-2">
                      <CalendarIcon className="w-4 h-4 mr-2 text-gray-400" />
                      <input
                        type="date"
                        value={dateRange.endDate}
                        onChange={(e) =>
                          setDateRange((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        className="w-full border-none focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4">
                  <button
                    onClick={() => setCurrentStep("upload")}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    ← Back to Connection
                  </button>
                  <div className="space-x-4">
                    <button
                      onClick={() => {
                        // setSelectedCustomer(null);
                        setCurrentStep("analysis");
                      }}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Skip (All Customers)
                    </button>
                    <button
                      onClick={handleFetchFinancialData}
                      disabled={isFetchingData || !selectedCustomer}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isFetchingData ? (
                        <>
                          <ReloadIcon className="w-4 h-4 animate-spin" />
                          {isFetchingData ? (
                            <span>"Fetching Data..."</span>
                          ) : (
                            "Fetching Data..."
                          )}
                        </>
                      ) : (
                        <>
                          <DownloadIcon className="w-4 h-4" />
                          Fetch Financial Data
                        </>
                      )}
                    </button>

                    {/* Progress indicator */}
                    {false && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Loading...</span>
                          <span>0%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: "0%" }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Data Fetch Progress */}
                {isFetchingData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <ReloadIcon className="w-5 h-5 text-blue-600 animate-spin mr-2" />
                      <span className="font-medium text-blue-900">
                        Fetching Financial Data...
                      </span>
                    </div>
                    <p className="text-sm text-blue-700 mb-3">
                      Retrieving comprehensive financial reports for{" "}
                      {formData.company}
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full animate-pulse"
                        style={{ width: "60%" }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Data Fetch Error */}
                {dataFetchError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <CrossCircledIcon className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-red-800 font-medium">
                          Data Fetch Failed
                        </p>
                        <p className="text-red-700 text-sm mt-1">
                          {dataFetchError}
                        </p>
                        <button
                          onClick={handleFetchFinancialData}
                          className="mt-3 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors text-sm"
                        >
                          Retry Fetch
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Analysis Step */}
        {currentStep === "analysis" && !isImportingData && (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-2xl font-semibold mb-4">
                Financial Data Summary
              </h2>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-green-800 font-medium">
                  ✓ Successfully connected to {formData.company}
                </p>
                {webhookData ? (
                  <div className="text-green-700 text-sm mt-1 space-y-1">
                    <p>✓ 5-pillar data analysis imported successfully</p>
                    <p>• {webhookData.pillarData.reconciliation.variance?.length || 0} bank accounts analyzed</p>
                    <p>• {webhookData.pillarData.chartIntegrity?.totals?.accounts || 0} chart of accounts reviewed</p>
                    <p>• Period: {webhookData.meta.start_date} to {webhookData.meta.end_date}</p>
                  </div>
                ) : (
                  <p className="text-green-700 text-sm mt-1">
                    {uploadedFiles.length} reports ready for analysis
                  </p>
                )}
                {false && ( // selectedCustomer
                  <p className="text-green-700 text-sm">
                    Customer: {"Customer Name"}
                  </p>
                )}
              </div>
            </div>

            {/* Data Display - Show webhook pillar data */}
            {webhookData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bank Reconciliation Pillar */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <BarChartIcon className="w-5 h-5 mr-2 text-blue-600" />
                    Bank Reconciliation
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Bank Accounts:</span>
                      <span className="font-medium">
                        {webhookData.pillarData.reconciliation.variance?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Variance:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.reconciliation.variance?.reduce((sum, acc) => 
                          sum + Math.abs(acc.varianceBookVsCleared || 0), 0
                        ).toFixed(2) || '0.00'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      {webhookData.pillarData.reconciliation.hasTransactionData ? (
                        <span className="font-medium text-green-600">✓ Analyzed</span>
                      ) : webhookData.pillarData.reconciliation.totalRowsFound > 0 ? (
                        <span className="font-medium text-yellow-600">⚠️ Partial Data</span>
                      ) : (
                        <span className="font-medium text-gray-600">No Data</span>
                      )}
                    </div>
                    {webhookData.pillarData.reconciliation.totalRowsFound > 0 && 
                     !webhookData.pillarData.reconciliation.hasTransactionData && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                        <p className="text-yellow-800">
                          ⚠️ Transaction data was found ({webhookData.pillarData.reconciliation.totalRowsFound} rows) 
                          but could not be processed due to column mapping issues. This may affect reconciliation accuracy.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chart of Accounts Pillar */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <BarChartIcon className="w-5 h-5 mr-2 text-green-600" />
                    Chart of Accounts
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Accounts:</span>
                      <span className="font-medium">
                        {webhookData.pillarData.chartIntegrity.totals.accounts}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Duplicate Names:</span>
                      <span className="font-medium">
                        {webhookData.pillarData.chartIntegrity.duplicates.name.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-green-600">✓ Analyzed</span>
                    </div>
                  </div>
                </div>

                {/* Transaction Categorization Pillar */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <BarChartIcon className="w-5 h-5 mr-2 text-yellow-600" />
                    Transaction Categorization
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uncategorized Items:</span>
                      <span className="font-medium">
                        {Object.values(webhookData.pillarData.categorization.uncategorized).reduce(
                          (sum: number, cat: any) => sum + (cat.count || 0), 0
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Uncategorized Amount:</span>
                      <span className="font-medium">
                        ${Object.values(webhookData.pillarData.categorization.uncategorized).reduce(
                          (sum: number, cat: any) => sum + (cat.amount || 0), 0
                        ).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-green-600">✓ Analyzed</span>
                    </div>
                  </div>
                </div>

                {/* Control Accounts Pillar */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <BarChartIcon className="w-5 h-5 mr-2 text-purple-600" />
                    Control Accounts
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">AR Balance:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.controlAccounts.ar.balance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">AP Balance:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.controlAccounts.ap.balance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="font-medium text-green-600">✓ Analyzed</span>
                    </div>
                  </div>
                </div>

                {/* AR Aging Report */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <PersonIcon className="w-5 h-5 mr-2 text-orange-600" />
                    A/R Aging Report
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.arApValidity.arAging.current.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">1-30 Days:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.arApValidity.arAging.d1_30.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">90+ Days:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.arApValidity.arAging.d90_plus.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* AP Aging Report */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <PersonIcon className="w-5 h-5 mr-2 text-red-600" />
                    A/P Aging Report
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Current:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.arApValidity.apAging.current.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">1-30 Days:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.arApValidity.apAging.d1_30.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">90+ Days:</span>
                      <span className="font-medium">
                        ${webhookData.pillarData.arApValidity.apAging.d90_plus.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}


            {/* Data Summary - Show webhook data overview */}
            {webhookData && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  5-Pillar Analysis Overview
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-2">
                      Pillars Analyzed
                    </h4>
                    <p className="text-2xl font-bold text-blue-600">5</p>
                    <p className="text-sm text-blue-700">Complete Assessment</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">
                      Date Range
                    </h4>
                    <p className="text-sm font-medium text-green-600">
                      {webhookData.meta.start_date}
                    </p>
                    <p className="text-xs text-green-700">to</p>
                    <p className="text-sm font-medium text-green-600">
                      {webhookData.meta.end_date}
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-2">
                      Window Period
                    </h4>
                    <p className="text-2xl font-bold text-purple-600">
                      {webhookData.meta.windowDays || daysFilter}
                    </p>
                    <p className="text-sm text-purple-700">days of data requested</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow p-6">
              {!isAnalyzing ? (
                <div className="space-y-4">
                  {/* View/Download LLM Input Data */}
                  {webhookData && (
                    <div className="border-b pb-4 mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Review Data Being Sent to AI:</h4>
                      <div className="flex flex-wrap gap-3 justify-center">
                        <button
                          onClick={() => {
                            const llmData = {
                              webhookData,
                              calculatedAssessment: assessmentResults,
                              formattedDate: new Date().toLocaleDateString(),
                              companyName: formData.company || 'Company'
                            };
                            LLMInputFormatter.downloadLLMInput(llmData, 'md');
                          }}
                          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Download Input Data (.md)
                        </button>
                        <button
                          onClick={async () => {
                            const llmData = {
                              webhookData,
                              calculatedAssessment: assessmentResults,
                              formattedDate: new Date().toLocaleDateString(),
                              companyName: formData.company || 'Company'
                            };
                            const result = await LLMInputFormatter.sendToPDFAPI(llmData);
                            if (result.url) {
                              window.open(result.url, '_blank');
                            } else {
                              logger.error('Failed to generate PDF view', result.error);
                              alert('Failed to generate PDF view: ' + result.error);
                            }
                          }}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View Input Data (PDF)
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Run AI Assessment Button */}
                  <button
                    onClick={handleAIAnalysis}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center mx-auto"
                  >
                    <PlayIcon className="w-5 h-5 mr-2" />
                    Run AI Hygiene Assessment
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <ReloadIcon className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                  <p className="text-lg font-medium text-gray-900">
                    {aiAnalysisProgress?.message ||
                      "AI is Analyzing Your Financial Books..."}
                  </p>
                  <p className="text-sm text-gray-600 mt-2">
                    Using Day-30 Readiness Scoring Model
                  </p>
                  {aiAnalysisProgress && (
                    <div className="w-full max-w-md mt-4">
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span className="capitalize">
                          {aiAnalysisProgress.phase} Phase
                        </span>
                        <span>{aiAnalysisProgress.percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${aiAnalysisProgress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-3">
                    This may take 30-60 seconds
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results Step */}
        {currentStep === "results" && (
          <div className="space-y-6">
            {/* View Toggle */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setViewMode("business")}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${viewMode === "business" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  <EyeOpenIcon className="w-4 h-4 mr-2" />
                  Business Owner View
                </button>
                <button
                  onClick={() => setViewMode("technical")}
                  className={`flex items-center px-4 py-2 rounded-lg transition-colors ${viewMode === "technical" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  <GearIcon className="w-4 h-4 mr-2" />
                  Bookkeeper View
                </button>
              </div>
            </div>

            {/* Business Owner View */}
            {viewMode === "business" && (
              <div className="space-y-6">
                {/* Overall Score */}
                <div className="bg-white rounded-lg shadow p-6 text-center">
                  <h2 className="text-2xl font-semibold mb-4">
                    Your Books Health Score
                  </h2>
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg
                      className="w-full h-full transform -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="10"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke={
                          (assessmentResults?.overallScore || 0) >= 85
                            ? "#10b981"
                            : (assessmentResults?.overallScore || 0) >= 70
                              ? "#fbbf24"
                              : "#ef4444"
                        }
                        strokeWidth="10"
                        strokeDasharray={`${(assessmentResults?.overallScore || 0) * 2.83} 283`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className={`text-3xl font-bold ${
                          (assessmentResults?.overallScore || 0) >= 85
                            ? "text-green-600"
                            : (assessmentResults?.overallScore || 0) >= 70
                              ? "text-yellow-600"
                              : "text-red-600"
                        }`}
                      >
                        {assessmentResults?.overallScore || "0"}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`inline-block px-4 py-2 rounded-full font-medium ${
                      assessmentResults?.readinessStatus ===
                      "READY_FOR_MONTHLY_OPERATIONS"
                        ? "bg-green-100 text-green-800"
                        : assessmentResults?.readinessStatus ===
                            "MINOR_FIXES_NEEDED"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {assessmentResults?.businessOwnerSummary?.healthScore ||
                      assessmentResults?.readinessStatus?.replace(/_/g, " ") ||
                      "Assessment Pending"}
                  </div>
                </div>

                {/* What This Means */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-semibold mb-4">
                    What This Means for {formData.company}
                  </h3>
                  <div className="prose text-gray-700">
                    <p>
                      {assessmentResults?.businessOwnerSummary?.whatThisMeans ||
                        "Your financial records are generally well-maintained but need some attention in specific areas. With minor fixes, your books will be ready for reliable monthly operations and accurate financial reporting."}
                    </p>

                    {assessmentResults?.businessOwnerSummary?.keyFindings &&
                    assessmentResults.businessOwnerSummary.keyFindings.length >
                      0 ? (
                      <>
                        <h4 className="font-semibold mt-4 mb-2">
                          Key Findings:
                        </h4>
                        <ul className="space-y-2">
                          {assessmentResults.businessOwnerSummary.keyFindings.map(
                            (finding, index) => (
                              <li key={index}>• {finding}</li>
                            ),
                          )}
                        </ul>
                      </>
                    ) : (
                      <>
                        <h4 className="font-semibold mt-4 mb-2">
                          Key Findings:
                        </h4>
                        <ul className="space-y-2">
                          <li>
                            • Your bank matching is strong, ensuring accurate
                            cash tracking
                          </li>
                          <li>
                            • Some transactions need proper categorization for
                            clearer profit reports
                          </li>
                          <li>
                            • Customer balances need attention - this affects
                            your cash flow visibility
                          </li>
                          <li>
                            • Your control accounts are accurate, which is
                            excellent for financial integrity
                          </li>
                        </ul>
                      </>
                    )}

                    {assessmentResults?.businessOwnerSummary?.nextSteps &&
                    assessmentResults.businessOwnerSummary.nextSteps.length >
                      0 ? (
                      <>
                        <h4 className="font-semibold mt-4 mb-2">
                          Recommended Next Steps:
                        </h4>
                        <ul className="space-y-2">
                          {assessmentResults.businessOwnerSummary.nextSteps.map(
                            (step, index) => (
                              <li key={index}>• {step}</li>
                            ),
                          )}
                        </ul>
                      </>
                    ) : (
                      <>
                        <h4 className="font-semibold mt-4 mb-2">
                          Recommended Next Steps:
                        </h4>
                        <ul className="space-y-2">
                          <li>
                            • Work with your bookkeeper to categorize
                            uncategorized transactions
                          </li>
                          <li>
                            • Review and resolve customer balance discrepancies
                          </li>
                          <li>
                            • Implement monthly book reviews to maintain this
                            health score
                          </li>
                        </ul>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-xl font-semibold mb-4">
                    Available Actions
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {webhookData && (
                      <button
                        onClick={() => setShowPillarViewer(true)}
                        className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                        View Detailed Pillar Data
                      </button>
                    )}
                    {hasAssessmentResults && (
                      <>
                        <button
                          onClick={() => handlePDFGeneration("download")}
                          disabled={isGeneratingPDF}
                          className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
                        >
                          {isGeneratingPDF ? (
                            <ReloadIcon className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <DownloadIcon className="w-4 h-4 mr-2" />
                          )}
                          Download Full Report (PDF)
                        </button>
                        <button
                          onClick={() => setShowDetailedViewer(true)}
                          className="flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <EyeOpenIcon className="w-4 h-4 mr-2" />
                          View Full Assessment
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Technical/Bookkeeper View */}
            {viewMode === "technical" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-semibold">
                    Technical Remediation Plan
                  </h2>
                  <div className="flex items-center space-x-3">
                    {webhookData && (
                      <button
                        onClick={() => setShowPillarViewer(true)}
                        className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <MagnifyingGlassIcon className="w-4 h-4 mr-2" />
                        View Pillar Data
                      </button>
                    )}
                    {hasAssessmentResults && (
                      <>
                        <button
                          onClick={() => setShowDetailedViewer(true)}
                          className="flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <EyeOpenIcon className="w-4 h-4 mr-2" />
                          View Detailed Report
                        </button>
                        <button
                          onClick={() => handlePDFGeneration("view")}
                          disabled={isGeneratingPDF}
                          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                        >
                          {isGeneratingPDF ? (
                            <ReloadIcon className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <EyeOpenIcon className="w-4 h-4 mr-2" />
                          )}
                          {isGeneratingPDF
                            ? "Generating..."
                            : "View PDF"}
                        </button>
                        <button
                          onClick={() => handlePDFGeneration("download")}
                          disabled={isGeneratingPDF}
                          className="flex items-center bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:bg-gray-400 transition-colors"
                        >
                          {isGeneratingPDF ? (
                            <ReloadIcon className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <DownloadIcon className="w-4 h-4 mr-2" />
                          )}
                          {isGeneratingPDF ? "Generating..." : "Download"}
                        </button>
                      </>
                    )}
                    {!hasAssessmentResults && (
                      <div className="text-sm text-gray-500 italic">
                        PDF generation requires assessment results
                      </div>
                    )}
                  </div>
                </div>

                {/* PDF Error Display */}
                {pdfError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <CrossCircledIcon className="w-5 h-5 text-red-500 mr-3 mt-0.5" />
                      <div>
                        <p className="text-red-800 font-medium">
                          PDF Generation Failed
                        </p>
                        <p className="text-red-700 text-sm mt-1">{pdfError}</p>
                        <button
                          onClick={() => setPdfError(null)}
                          className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Critical Issues */}
                <div className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b">
                    <h3 className="text-lg font-semibold text-red-600 flex items-center">
                      <CrossCircledIcon className="w-5 h-5 mr-2" />
                      Critical Issues Requiring Immediate Action
                    </h3>
                  </div>
                  <div className="divide-y">
                    {(
                      assessmentResults?.bookkeeperReport?.criticalIssues || []
                    ).map((issue, index) => (
                      <div key={index} className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">
                              Problem
                            </h4>
                            <p className="text-sm text-gray-700">
                              {(issue as any).issue || (issue as any).problem}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">
                              Location in QBO
                            </h4>
                            <p className="text-sm text-blue-600 font-mono bg-blue-50 p-2 rounded">
                              {(issue as any).qboLocation ||
                                (issue as any).location}
                            </p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">
                              Fix Instructions
                            </h4>
                            <pre className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-2 rounded">
                              {(issue as any).fixSteps || (issue as any).fix}
                            </pre>
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-2">
                              Est. Time
                            </h4>
                            <p className="text-sm text-gray-700">
                              {(issue as any).estimatedTime ||
                                (issue as any).time}
                            </p>
                            <span
                              className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                                (issue as any).priority === 1 ||
                                (issue as any).priority === "High"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {(issue as any).priority === 1 ||
                              (issue as any).priority === 2
                                ? `Priority ${(issue as any).priority}`
                                : (issue as any).priority || "Medium"}{" "}
                              Priority
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pillar Details */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">
                    Detailed Pillar Assessment
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Pillar</th>
                          <th className="text-left py-2">Score</th>
                          <th className="text-left py-2">Status</th>
                          <th className="text-left py-2">Issues Found</th>
                          <th className="text-left py-2">Action Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(assessmentResults
                          ? [
                              {
                                name: "Bank & Credit Card Matching",
                                score:
                                  assessmentResults.pillarScores.reconciliation,
                              },
                              {
                                name: "Chart of Accounts Integrity",
                                score:
                                  assessmentResults.pillarScores.coaIntegrity,
                              },
                              {
                                name: "Transaction Categorization",
                                score:
                                  assessmentResults.pillarScores.categorization,
                              },
                              {
                                name: "Control Account Accuracy",
                                score:
                                  assessmentResults.pillarScores.controlAccount,
                              },
                              {
                                name: "A/R & A/P Validity",
                                score: assessmentResults.pillarScores.aging,
                              },
                            ]
                          : []
                        ).map((pillar, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-3 font-medium">{pillar.name}</td>
                            <td
                              className={`py-3 font-semibold ${getScoreColor(pillar.score)}`}
                            >
                              {pillar.score}%
                            </td>
                            <td className="py-3">
                              {getStatusIcon(
                                pillar.score >= 70
                                  ? "good"
                                  : pillar.score >= 50
                                    ? "warning"
                                    : "critical",
                              )}
                            </td>
                            <td className="py-3 text-sm text-gray-600">
                              {pillar.score < 50
                                ? "3 critical issues"
                                : pillar.score < 70
                                  ? "2 minor issues"
                                  : "No issues"}
                            </td>
                            <td className="py-3 text-sm">
                              {pillar.score >= 70
                                ? "Monitor monthly"
                                : "Immediate attention needed"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Pillar Data Viewer Modal */}
        {showPillarViewer && webhookData && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={() => setShowPillarViewer(false)}
              />
              
              {/* Modal content */}
              <div className="inline-block w-full max-w-6xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Financial Hygiene Pillar Data</h2>
                  <button
                    onClick={() => setShowPillarViewer(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <CrossCircledIcon className="w-6 h-6" />
                  </button>
                </div>
                <PillarDataViewer 
                  pillarData={webhookData.pillarData}
                  companyName={formData.company || 'Unknown Company'}
                  assessmentDate={new Date()}
                />
              </div>
            </div>
          </div>
        )}
        
        {/* Detailed Assessment Viewer Modal */}
        {showDetailedViewer && assessmentResults && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              {/* Background overlay */}
              <div 
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
                onClick={() => setShowDetailedViewer(false)}
              />
              
              {/* Modal content */}
              <div className="inline-block w-full max-w-7xl px-4 pt-5 pb-4 overflow-hidden text-left align-bottom transition-all transform bg-white rounded-lg shadow-xl sm:my-8 sm:align-middle sm:p-6">
                <AssessmentResultsViewer
                  assessmentResult={assessmentResults}
                  companyName={formData.company || 'Unknown Company'}
                  onClose={() => setShowDetailedViewer(false)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Assessment;
