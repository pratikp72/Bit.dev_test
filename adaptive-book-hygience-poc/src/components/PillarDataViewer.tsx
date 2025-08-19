/**
 * @file PillarDataViewer.tsx
 * @description Component for viewing and downloading individual pillar data
 * 
 * This component displays the 5 pillars of financial hygiene assessment
 * and allows downloading each pillar as .md or .pdf format.
 */

import React, { useState } from 'react';
import {
  DownloadIcon,
  FileTextIcon,
  FileIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  CrossCircledIcon
} from '@radix-ui/react-icons';
import { WebhookPillarData } from '../services/qboPillarsWebhookService';
import { PDFGenerationService } from '../services/pdfGenerationService';
import logger from '../lib/logger';

interface PillarDataViewerProps {
  pillarData: WebhookPillarData;
  companyName?: string;
  assessmentDate?: Date;
}

interface PillarSection {
  id: keyof WebhookPillarData;
  name: string;
  description: string;
  icon: React.ReactNode;
}

const PILLAR_SECTIONS: PillarSection[] = [
  {
    id: 'reconciliation',
    name: 'Reconciliation',
    description: 'Bank and credit card reconciliation status',
    icon: <CheckCircledIcon className="w-5 h-5" />
  },
  {
    id: 'chartIntegrity',
    name: 'Chart of Accounts Integrity',
    description: 'Account structure and consistency',
    icon: <FileTextIcon className="w-5 h-5" />
  },
  {
    id: 'categorization',
    name: 'Transaction Categorization',
    description: 'Transaction classification quality',
    icon: <FileIcon className="w-5 h-5" />
  },
  {
    id: 'controlAccounts',
    name: 'Control Accounts',
    description: 'Control account balances and integrity',
    icon: <ExclamationTriangleIcon className="w-5 h-5" />
  },
  {
    id: 'arApValidity',
    name: 'AR/AP Validity',
    description: 'Accounts receivable and payable aging',
    icon: <CrossCircledIcon className="w-5 h-5" />
  }
];

const PillarDataViewer: React.FC<PillarDataViewerProps> = ({ 
  pillarData, 
  companyName = 'Company',
  assessmentDate = new Date()
}) => {
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(new Set());
  const [downloadingPillar, setDownloadingPillar] = useState<string | null>(null);

  const togglePillar = (pillarId: string) => {
    const newExpanded = new Set(expandedPillars);
    if (newExpanded.has(pillarId)) {
      newExpanded.delete(pillarId);
    } else {
      newExpanded.add(pillarId);
    }
    setExpandedPillars(newExpanded);
  };

  const formatPillarDataAsMarkdown = (pillarId: keyof WebhookPillarData, pillarName: string): string => {
    const data = pillarData[pillarId] as any;
    let markdown = `# ${pillarName}\n\n`;
    markdown += `**Assessment Date:** ${assessmentDate.toLocaleDateString()}\n\n`;
    
    // Format based on pillar type
    switch (pillarId) {
      case 'reconciliation':
        markdown += '## Reconciliation Status\n\n';
        markdown += `- **Cleared Column Found:** ${data.clearedColumnFound ? 'Yes' : 'No'}\n`;
        markdown += `- **Total Transactions:** ${data.totalTransactionsProcessed}\n`;
        markdown += `- **Total Accounts:** ${data.totalAccountsFound}\n\n`;
        
        if (data.byAccount.length > 0) {
          markdown += '### Account Details\n\n';
          markdown += '| Account | Outstanding (30d+) | Cleared | Uncleared | Total Txns |\n';
          markdown += '|---------|-------------------|---------|-----------|------------|\n';
          data.byAccount.forEach((acc: any) => {
            markdown += `| ${acc.account} | $${acc.outstanding_30d_amount.toFixed(2)} (${acc.outstanding_30d_count}) | $${acc.cleared_amount.toFixed(2)} | $${acc.uncleared_amount.toFixed(2)} | ${acc.txns} |\n`;
          });
        }
        break;
        
      case 'chartIntegrity':
        markdown += '## Chart of Accounts Analysis\n\n';
        markdown += `- **Total Accounts:** ${data.totals.accounts}\n`;
        markdown += `- **Duplicate Names:** ${data.duplicates.name.length}\n`;
        markdown += `- **Duplicate Account Numbers:** ${data.duplicates.acctNum.length}\n`;
        markdown += `- **Missing Details:** ${data.missingDetail.length}\n`;
        markdown += `- **Sub-accounts Missing Parent:** ${data.subAccountsMissingParent.length}\n\n`;
        
        if (data.duplicates.name.length > 0) {
          markdown += '### Duplicate Account Names\n\n';
          data.duplicates.name.forEach((name: any) => {
            markdown += `- ${name}\n`;
          });
        }
        break;
        
      case 'categorization':
        markdown += '## Transaction Categorization\n\n';
        markdown += '### Uncategorized Transactions\n\n';
        markdown += '| Category | Count | Amount |\n';
        markdown += '|----------|-------|--------|\n';
        Object.entries(data.uncategorized).forEach(([category, info]: any) => {
          markdown += `| ${category} | ${info.count} | $${info.amount.toFixed(2)} |\n`;
        });
        break;
        
      case 'controlAccounts':
        markdown += '## Control Account Balances\n\n';
        markdown += `- **Opening Balance Equity:** $${data.openingBalanceEquity.balance.toFixed(2)}\n`;
        markdown += `- **Undeposited Funds:** $${data.undepositedFunds.balance.toFixed(2)}\n`;
        markdown += `- **Accounts Receivable:** $${data.ar.balance.toFixed(2)}\n`;
        markdown += `- **Accounts Payable:** $${data.ap.balance.toFixed(2)}\n`;
        markdown += `- **Journal Entries to AR/AP:** ${data.journalEntriesToARorAP}\n`;
        break;
        
      case 'arApValidity':
        markdown += '## AR/AP Aging Analysis\n\n';
        markdown += '### Accounts Receivable Aging\n\n';
        markdown += '| Period | Amount |\n';
        markdown += '|--------|--------|\n';
        markdown += `| Current | $${data.arAging.current.toFixed(2)} |\n`;
        markdown += `| 1-30 days | $${data.arAging.d1_30.toFixed(2)} |\n`;
        markdown += `| 31-60 days | $${data.arAging.d31_60.toFixed(2)} |\n`;
        markdown += `| 61-90 days | $${data.arAging.d61_90.toFixed(2)} |\n`;
        markdown += `| 90+ days | $${data.arAging.d90_plus.toFixed(2)} |\n\n`;
        
        markdown += '### Accounts Payable Aging\n\n';
        markdown += '| Period | Amount |\n';
        markdown += '|--------|--------|\n';
        markdown += `| Current | $${data.apAging.current.toFixed(2)} |\n`;
        markdown += `| 1-30 days | $${data.apAging.d1_30.toFixed(2)} |\n`;
        markdown += `| 31-60 days | $${data.apAging.d31_60.toFixed(2)} |\n`;
        markdown += `| 61-90 days | $${data.apAging.d61_90.toFixed(2)} |\n`;
        markdown += `| 90+ days | $${data.apAging.d90_plus.toFixed(2)} |\n`;
        break;
    }
    
    return markdown;
  };

  const downloadPillarAsMarkdown = (pillarId: keyof WebhookPillarData, pillarName: string) => {
    try {
      const markdown = formatPillarDataAsMarkdown(pillarId, pillarName);
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companyName}_${pillarName.replace(/\s+/g, '_')}_${assessmentDate.toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.info(`Downloaded ${pillarName} as markdown`);
    } catch (error) {
      logger.error(`Failed to download ${pillarName} as markdown`, error);
    }
  };

  const downloadPillarAsPDF = async (pillarId: keyof WebhookPillarData, pillarName: string) => {
    setDownloadingPillar(pillarId);
    try {
      // Generate pillar-specific content for PDF
      const pillarContent = {
        title: pillarName,
        companyName,
        assessmentDate: assessmentDate.toISOString(),
        data: { [pillarId]: pillarData[pillarId] }
      };

      const pdfBlob = await PDFGenerationService.generatePillarPDF(pillarContent);
      
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companyName}_${pillarName.replace(/\s+/g, '_')}_${assessmentDate.toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      logger.info(`Downloaded ${pillarName} as PDF`);
    } catch (error) {
      logger.error(`Failed to download ${pillarName} as PDF`, error);
    } finally {
      setDownloadingPillar(null);
    }
  };

  const downloadAllPillarsAsMarkdown = () => {
    try {
      let markdown = `# Financial Hygiene Assessment - All Pillars\n\n`;
      markdown += `**Company:** ${companyName}\n`;
      markdown += `**Assessment Date:** ${assessmentDate.toLocaleDateString()}\n\n`;
      markdown += '---\n\n';
      
      PILLAR_SECTIONS.forEach(section => {
        markdown += formatPillarDataAsMarkdown(section.id, section.name);
        markdown += '\n---\n\n';
      });
      
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${companyName}_All_Pillars_${assessmentDate.toISOString().split('T')[0]}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logger.info('Downloaded all pillars as markdown');
    } catch (error) {
      logger.error('Failed to download all pillars as markdown', error);
    }
  };

  const renderPillarContent = (pillarId: keyof WebhookPillarData) => {
    const data = pillarData[pillarId] as any;
    
    switch (pillarId) {
      case 'reconciliation':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Cleared Column:</span>
                <span className="ml-2 font-medium">{data.clearedColumnFound ? 'Found' : 'Not Found'}</span>
              </div>
              <div>
                <span className="text-gray-500">Total Transactions:</span>
                <span className="ml-2 font-medium">{data.totalTransactionsProcessed}</span>
              </div>
            </div>
            {data.byAccount.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Account Summary</h4>
                <div className="space-y-2">
                  {data.byAccount.slice(0, 3).map((acc: any, idx: any) => (
                    <div key={idx} className="text-xs bg-gray-50 p-2 rounded">
                      <span className="font-medium">{acc.account}:</span>
                      <span className="ml-2">{acc.outstanding_30d_count} outstanding items</span>
                    </div>
                  ))}
                  {data.byAccount.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{data.byAccount.length - 3} more accounts
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
        
      case 'chartIntegrity':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Total Accounts:</span>
                <span className="ml-2 font-medium">{data.totals.accounts}</span>
              </div>
              <div>
                <span className="text-gray-500">Duplicates:</span>
                <span className="ml-2 font-medium">{data.duplicates.name.length + data.duplicates.acctNum.length}</span>
              </div>
            </div>
            {(data.duplicates.name.length > 0 || data.missingDetail.length > 0) && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Issues Found</h4>
                <div className="text-xs space-y-1">
                  {data.duplicates.name.length > 0 && (
                    <div className="text-amber-600">• {data.duplicates.name.length} duplicate account names</div>
                  )}
                  {data.missingDetail.length > 0 && (
                    <div className="text-amber-600">• {data.missingDetail.length} accounts missing details</div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
        
      case 'categorization':
        const totalUncategorized = Object.values(data.uncategorized).reduce((sum: number, cat: any) => sum + (cat?.count || 0), 0);
        return (
          <div className="space-y-3">
            <div className="text-sm">
              <span className="text-gray-500">Total Uncategorized:</span>
              <span className="ml-2 font-medium">{totalUncategorized} transactions</span>
            </div>
            <div className="space-y-2">
              {Object.entries(data.uncategorized).map(([category, info]: any) => {
                const count = info?.count || 0;
                const amount = info?.amount || 0;
                return count > 0 ? (
                  <div key={category} className="text-xs bg-gray-50 p-2 rounded flex justify-between">
                    <span>{category}:</span>
                    <span className="font-medium">{count} items (${amount.toFixed(2)})</span>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        );
        
      case 'controlAccounts':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Opening Balance:</span>
                <span className="ml-2 font-medium">${data.openingBalanceEquity.balance.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Undeposited Funds:</span>
                <span className="ml-2 font-medium">${data.undepositedFunds.balance.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">AR Balance:</span>
                <span className="ml-2 font-medium">${data.ar.balance.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">AP Balance:</span>
                <span className="ml-2 font-medium">${data.ap.balance.toFixed(2)}</span>
              </div>
            </div>
            {data.journalEntriesToARorAP > 0 && (
              <div className="text-xs text-amber-600 mt-2">
                ⚠️ {data.journalEntriesToARorAP} journal entries affecting AR/AP
              </div>
            )}
          </div>
        );
        
      case 'arApValidity':
        const totalAR = Object.values(data.arAging).reduce((sum: any, val: any) => sum + val, 0);
        const totalAP = Object.values(data.apAging).reduce((sum: any, val: any) => sum + val, 0);
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2">AR Aging</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Current:</span>
                    <span>${data.arAging.current.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>90+ days:</span>
                    <span className={data.arAging.d90_plus > 0 ? 'text-red-600' : ''}>
                      ${data.arAging.d90_plus.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Total:</span>
                    <span>${(totalAR as number).toFixed(0)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2">AP Aging</h4>
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span>Current:</span>
                    <span>${data.apAging.current.toFixed(0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>90+ days:</span>
                    <span className={data.apAging.d90_plus > 0 ? 'text-red-600' : ''}>
                      ${data.apAging.d90_plus.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex justify-between font-medium pt-1 border-t">
                    <span>Total:</span>
                    <span>${(totalAP as number).toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with download all button */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold">Detailed Pillar Data</h3>
        <button
          onClick={downloadAllPillarsAsMarkdown}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <DownloadIcon className="w-4 h-4" />
          Download All Pillars (.md)
        </button>
      </div>

      {/* Individual pillar sections */}
      <div className="space-y-3">
        {PILLAR_SECTIONS.map(section => (
          <div key={section.id} className="border rounded-lg overflow-hidden bg-white">
            {/* Pillar header */}
            <div
              className="px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => togglePillar(section.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {expandedPillars.has(section.id) ? 
                    <ChevronDownIcon className="w-5 h-5 text-gray-500" /> : 
                    <ChevronRightIcon className="w-5 h-5 text-gray-500" />
                  }
                  {section.icon}
                  <div>
                    <h4 className="font-medium">{section.name}</h4>
                    <p className="text-xs text-gray-500">{section.description}</p>
                  </div>
                </div>
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => downloadPillarAsMarkdown(section.id, section.name)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    title="Download as Markdown"
                  >
                    <FileTextIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => downloadPillarAsPDF(section.id, section.name)}
                    disabled={downloadingPillar === section.id}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
                    title="Download as PDF"
                  >
                    {downloadingPillar === section.id ? (
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                    ) : (
                      <FileIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Pillar content */}
            {expandedPillars.has(section.id) && (
              <div className="px-4 py-4 border-t">
                {renderPillarContent(section.id)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PillarDataViewer;