/**
 * @file AssessmentResultsViewer.tsx
 * @description Component for viewing and downloading structured assessment results
 * 
 * Displays the 4-section assessment format:
 * 1. Executive Summary (business owners)
 * 2. Detailed Results (pillar breakdown) 
 * 3. Technical Remediation (bookkeepers)
 * 4. Scoring Transparency (metadata)
 */

import React, { useState } from 'react';
import {
  DownloadIcon,
  EyeOpenIcon,
  FileTextIcon,
  ReloadIcon,
} from '@radix-ui/react-icons';
import { HygieneAssessmentResult } from '../services/perplexityService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import logger from '../lib/logger';

interface AssessmentResultsViewerProps {
  assessmentResult: HygieneAssessmentResult;
  companyName: string;
  onClose?: () => void;
}

export const AssessmentResultsViewer: React.FC<AssessmentResultsViewerProps> = ({
  assessmentResult,
  companyName,
  onClose,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [activeSection, setActiveSection] = useState<number>(1);

  // Handle PDF generation
  const handlePDFAction = async (action: 'view' | 'download') => {
    setIsGeneratingPDF(true);
    try {
      const result = await PDFGenerationService.generateReport(
        assessmentResult,
        companyName,
        { action }
      );

      if (!result.success) {
        throw new Error(result.error || 'PDF generation failed');
      }

      logger.info(`PDF ${action} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'PDF generation failed';
      logger.error(`PDF ${action} failed`, error);
      alert(`Failed to ${action} PDF: ${errorMessage}`);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Download assessment as formatted JSON
  const downloadJSON = () => {
    const jsonData = {
      metadata: {
        company: companyName,
        assessmentDate: new Date().toISOString(),
        version: '1.0',
      },
      assessment: assessmentResult,
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${companyName.replace(/\s+/g, '_')}_assessment_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get status color based on score
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (status === 'READY_FOR_MONTHLY_OPERATIONS') return 'bg-green-100 text-green-800';
    if (status === 'MINOR_FIXES_NEEDED') return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header with action buttons */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Financial Books Hygiene Assessment
          </h1>
          <p className="text-gray-600 mt-2">Company: {companyName}</p>
        </div>
        
        <div className="flex gap-3">
          {/* View PDF Button */}
          <button
            onClick={() => handlePDFAction('view')}
            disabled={isGeneratingPDF}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isGeneratingPDF ? (
              <ReloadIcon className="w-4 h-4 animate-spin" />
            ) : (
              <EyeOpenIcon className="w-4 h-4" />
            )}
            View PDF
          </button>

          {/* Download PDF Button */}
          <button
            onClick={() => handlePDFAction('download')}
            disabled={isGeneratingPDF}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isGeneratingPDF ? (
              <ReloadIcon className="w-4 h-4 animate-spin" />
            ) : (
              <DownloadIcon className="w-4 h-4" />
            )}
            Download PDF
          </button>

          {/* Download JSON Button */}
          <button
            onClick={downloadJSON}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
          >
            <FileTextIcon className="w-4 h-4" />
            Download JSON
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Overall Score Card */}
      <div className="mb-6 bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Overall Health Score</h2>
            <p className={`text-5xl font-bold mt-2 ${getScoreColor(assessmentResult.overallScore)}`}>
              {assessmentResult.overallScore}/100
            </p>
          </div>
          <div className={`px-4 py-2 rounded-full ${getStatusBadgeColor(assessmentResult.readinessStatus)}`}>
            {assessmentResult.readinessStatus.replace(/_/g, ' ')}
          </div>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 1, name: 'Executive Summary', icon: '📊' },
            { id: 2, name: 'Detailed Results', icon: '📈' },
            { id: 3, name: 'Technical Remediation', icon: '🔧' },
            { id: 4, name: 'Scoring Transparency', icon: '🔍' },
          ].map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeSection === section.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{section.icon}</span>
              {section.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Section 1: Executive Summary */}
        {activeSection === 1 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">Executive Summary</h3>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Health Score Assessment</h4>
              <p className="text-gray-700">{assessmentResult.businessOwnerSummary.healthScore}</p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">What This Means for Your Business</h4>
              <p className="text-gray-700">{assessmentResult.businessOwnerSummary.whatThisMeans}</p>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Key Findings</h4>
              <ul className="list-disc pl-5 space-y-1">
                {assessmentResult.businessOwnerSummary.keyFindings.map((finding, idx) => (
                  <li key={idx} className="text-gray-700">{finding}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Recommended Next Steps</h4>
              <ul className="list-disc pl-5 space-y-1">
                {assessmentResult.businessOwnerSummary.nextSteps.map((step, idx) => (
                  <li key={idx} className="text-gray-700">{step}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Section 2: Detailed Results */}
        {activeSection === 2 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">Detailed Assessment Results</h3>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Pillar Breakdown</h4>
              <div className="space-y-3">
                {[
                  { name: 'Bank & Credit Card Matching', score: assessmentResult.pillarScores.reconciliation },
                  { name: 'Money Organization System', score: assessmentResult.pillarScores.coaIntegrity },
                  { name: 'Transaction Categorization', score: assessmentResult.pillarScores.categorization },
                  { name: 'Control Account Accuracy', score: assessmentResult.pillarScores.controlAccount },
                  { name: 'Customer/Vendor Balances', score: assessmentResult.pillarScores.aging },
                ].map((pillar, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-700">{pillar.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            pillar.score >= 85 ? 'bg-green-500' : 
                            pillar.score >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${pillar.score}%` }}
                        />
                      </div>
                      <span className={`font-bold ${getScoreColor(pillar.score)}`}>
                        {pillar.score}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Technical Remediation */}
        {activeSection === 3 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">Technical Remediation Plan</h3>
            
            {/* Critical Issues */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Critical Issues Requiring Immediate Action</h4>
              {assessmentResult.bookkeeperReport.criticalIssues.length > 0 ? (
                <div className="space-y-4">
                  {assessmentResult.bookkeeperReport.criticalIssues.map((issue, idx) => (
                    <div key={idx} className="border-l-4 border-red-500 pl-4 py-3 bg-red-50 rounded-r-lg">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-gray-900">Priority {issue.priority}: {issue.pillar}</span>
                        <span className="text-sm text-gray-600">{issue.estimatedTime}</span>
                      </div>
                      <p className="text-gray-700 mb-1"><strong>Problem:</strong> {issue.issue}</p>
                      <p className="text-gray-700 mb-1"><strong>Location:</strong> {issue.qboLocation}</p>
                      <p className="text-gray-700"><strong>Fix:</strong> {issue.fixSteps}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">No critical issues identified.</p>
              )}
            </div>

            {/* Recommended Improvements */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Recommended Improvements</h4>
              {assessmentResult.bookkeeperReport.recommendedImprovements.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {assessmentResult.bookkeeperReport.recommendedImprovements.map((improvement, idx) => (
                    <li key={idx} className="text-gray-700">{improvement}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">No additional improvements recommended at this time.</p>
              )}
            </div>

            {/* Ongoing Maintenance */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-2">Ongoing Maintenance Requirements</h4>
              {assessmentResult.bookkeeperReport.ongoingMaintenance.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1">
                  {assessmentResult.bookkeeperReport.ongoingMaintenance.map((task, idx) => (
                    <li key={idx} className="text-gray-700">{task}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-600">Standard monthly bookkeeping maintenance recommended.</p>
              )}
            </div>
          </div>
        )}

        {/* Section 4: Scoring Transparency */}
        {activeSection === 4 && (
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-gray-900">Scoring Transparency</h3>
            
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Assessment Methodology Summary</h4>
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Assessment Date:</span>
                  <span className="text-gray-900">{assessmentResult.assessmentMetadata.assessmentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Data Period Analyzed:</span>
                  <span className="text-gray-900">{assessmentResult.assessmentMetadata.dataPeriod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Scoring Model:</span>
                  <span className="text-gray-900">{assessmentResult.assessmentMetadata.scoringModel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Repeatability:</span>
                  <span className="text-gray-900">Same data will produce identical results</span>
                </div>
                {assessmentResult.assessmentMetadata.limitations && (
                  <div>
                    <span className="font-medium text-gray-700">Limitations:</span>
                    <ul className="mt-1 list-disc pl-5">
                      {assessmentResult.assessmentMetadata.limitations.map((limitation, idx) => (
                        <li key={idx} className="text-gray-700">{limitation}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-900">
                This report follows established CPA standards and the Day-30 Readiness Framework for bookkeeping assessment.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssessmentResultsViewer;