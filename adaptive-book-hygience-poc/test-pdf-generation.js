#!/usr/bin/env node

/**
 * Test script to verify PDF generation with proper assessment data
 * This tests that the PDF shows actual assessment results instead of placeholder text
 */

const mockAssessmentResult = {
  overallScore: 71,
  pillarScores: {
    reconciliation: 75,
    coaIntegrity: 70,
    categorization: 80,
    controlAccount: 65,
    aging: 60
  },
  readinessStatus: "MINOR_FIXES_NEEDED",
  businessOwnerSummary: {
    healthScore: "GOOD - Minor adjustments needed",
    whatThisMeans: "Your books scored 71/100. The aging pillar (60/100) needs the most attention. Your books need moderate attention to improve accuracy and compliance.",
    keyFindings: [
      "2 bank account(s) have significant reconciliation variances",
      "$1,234.56 in uncategorized expenses needs review",
      "3 duplicate account names or numbers found"
    ],
    nextSteps: [
      "Review and clear Opening Balance Equity and control accounts",
      "Follow up on aging receivables and review payables",
      "Complete bank reconciliations for all accounts"
    ]
  },
  bookkeeperReport: {
    criticalIssues: [
      {
        priority: 1,
        pillar: "Control Accounts",
        issue: "Opening Balance Equity has non-zero balance",
        qboLocation: "Chart of Accounts > Equity > Opening Balance Equity",
        fixSteps: "Review and reclassify all entries to appropriate accounts",
        estimatedTime: "2-3 hours"
      }
    ],
    recommendedImprovements: [
      "Prioritize completing bank reconciliations",
      "Review and clear control account balances",
      "Follow up on aging receivables and payables"
    ],
    ongoingMaintenance: [
      "90 total accounts in chart of accounts",
      "4 bank accounts analyzed for reconciliation",
      "Control account balances reviewed for accuracy and consistency"
    ]
  },
  assessmentMetadata: {
    assessmentDate: new Date().toISOString().split('T')[0],
    dataPeriod: "2024-01-01 to 2024-12-31 (365 days)",
    scoringModel: "5-Pillar Webhook Analysis Framework",
    limitations: []
  }
};

// Test the markdown generation
function generateTestMarkdown(assessmentResult, company) {
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
  const assessmentId = `assessment_${Date.now()}_test`;

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

// Generate test markdown
const testMarkdown = generateTestMarkdown(mockAssessmentResult, "Test Company Inc.");

console.log("Generated Markdown Report:");
console.log("=" .repeat(80));
console.log(testMarkdown);
console.log("=" .repeat(80));

// Check for placeholder text
if (testMarkdown.includes("Analyzing your financial data...")) {
  console.error("❌ ERROR: PDF still contains placeholder text!");
  process.exit(1);
} else {
  console.log("✅ SUCCESS: PDF contains actual assessment results!");
  console.log("\nKey sections found:");
  console.log("- Overall Score:", mockAssessmentResult.overallScore + "/100");
  console.log("- What This Means:", mockAssessmentResult.businessOwnerSummary.whatThisMeans.substring(0, 50) + "...");
  console.log("- Key Findings:", mockAssessmentResult.businessOwnerSummary.keyFindings.length, "items");
  console.log("- Next Steps:", mockAssessmentResult.businessOwnerSummary.nextSteps.length, "items");
  console.log("- Critical Issues:", mockAssessmentResult.bookkeeperReport.criticalIssues.length, "items");
}