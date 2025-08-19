/**
 * @file DataReportFormatter.tsx
 * @description Component that displays webhook response data in the exact format
 * that will be sent to the LLM for hygiene assessment analysis.
 * 
 * This component transforms the webhook response into the 6 key report sections
 * expected by the hygiene-assessment-prompt.txt:
 * - Bank Reconciliation Reports
 * - Chart of Accounts
 * - General Ledger
 * - Trial Balance
 * - A/R Aging
 * - A/P Aging
 */

import React, { useState } from 'react';
import { 
  ChevronDownIcon, 
  ChevronRightIcon,
  EyeOpenIcon,
  FileTextIcon,
  BarChartIcon,
  CalendarIcon
} from '@radix-ui/react-icons';
import { WebhookResponse } from '../services/qboPillarsWebhookService';

interface DataReportFormatterProps {
  webhookData: WebhookResponse;
  className?: string;
}

interface FormattedReportSection {
  title: string;
  description: string;
  data: any;
  isEmpty: boolean;
}

export const DataReportFormatter: React.FC<DataReportFormatterProps> = ({
  webhookData,
  className = ''
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showRawData, setShowRawData] = useState(false);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateStr: string): string => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Transform webhook data into LLM-expected format
  const formatReportSections = (): FormattedReportSection[] => {
    const { pillarData, meta } = webhookData;

    return [
      {
        title: 'Bank Reconciliation Reports',
        description: 'Bank and credit card reconciliation status and outstanding items',
        isEmpty: !pillarData.reconciliation?.variance?.length,
        data: {
          analysisPeriod: `${formatDate(meta.start_date)} to ${formatDate(meta.end_date)}`,
          clearedColumnFound: pillarData.reconciliation?.clearedColumnFound || false,
          accountsAnalyzed: pillarData.reconciliation?.byAccount?.length || 0,
          reconciliationSummary: pillarData.reconciliation?.byAccount?.map(account => ({
            accountName: account.account,
            outstandingItems30Days: account.outstanding_30d_count,
            outstandingAmount30Days: formatCurrency(account.outstanding_30d_amount),
            clearedAmount: formatCurrency(account.cleared_amount),
            unclearedAmount: formatCurrency(account.uncleared_amount),
            totalTransactions: account.txns
          })) || [],
          varianceAnalysis: pillarData.reconciliation?.variance?.map(variance => ({
            account: variance.account,
            bookEndingBalance: formatCurrency(variance.bookEndingBalance),
            clearedAmount: formatCurrency(variance.clearedAmount),
            unclearedAmount: formatCurrency(variance.unclearedAmount),
            outstanding30dAmount: formatCurrency(variance.outstanding30dAmount),
            variance: formatCurrency(variance.varianceBookVsCleared)
          })) || []
        }
      },
      {
        title: 'Chart of Accounts',
        description: 'Account structure, duplicates, and integrity issues',
        isEmpty: !pillarData.chartIntegrity?.totals?.accounts,
        data: {
          totalAccounts: pillarData.chartIntegrity?.totals?.accounts || 0,
          dataSource: pillarData.chartIntegrity?.source || 'Unknown',
          duplicateAccountNames: pillarData.chartIntegrity?.duplicates?.name || [],
          duplicateAccountNumbers: pillarData.chartIntegrity?.duplicates?.acctNum || [],
          accountsMissingDetail: pillarData.chartIntegrity?.missingDetail?.map(account => ({
            id: account.id,
            name: account.name
          })) || [],
          subAccountsMissingParent: pillarData.chartIntegrity?.subAccountsMissingParent?.map(account => ({
            id: account.id,
            name: account.name
          })) || []
        }
      },
      {
        title: 'General Ledger',
        description: 'Transaction categorization and uncategorized items',
        isEmpty: !pillarData.categorization?.uncategorized,
        data: {
          uncategorizedSummary: Object.entries(pillarData.categorization?.uncategorized || {}).map(([category, data]) => ({
            category,
            transactionCount: (data as any).count || 0,
            totalAmount: formatCurrency((data as any).amount || 0)
          })),
          totalUncategorizedAmount: Object.values(pillarData.categorization?.uncategorized || {})
            .reduce((sum, item) => sum + ((item as any).amount || 0), 0),
          totalUncategorizedCount: Object.values(pillarData.categorization?.uncategorized || {})
            .reduce((sum, item) => sum + ((item as any).count || 0), 0)
        }
      },
      {
        title: 'Trial Balance',
        description: 'Control account balances and journal entries',
        isEmpty: !pillarData.controlAccounts,
        data: {
          openingBalanceEquity: {
            balance: formatCurrency(pillarData.controlAccounts?.openingBalanceEquity?.balance || 0),
            accountId: pillarData.controlAccounts?.openingBalanceEquity?.accountId || 'Not found'
          },
          undepositedFunds: {
            balance: formatCurrency(pillarData.controlAccounts?.undepositedFunds?.balance || 0),
            accountId: pillarData.controlAccounts?.undepositedFunds?.accountId || 'Not found'
          },
          accountsReceivable: {
            balance: formatCurrency(pillarData.controlAccounts?.ar?.balance || 0),
            accountId: pillarData.controlAccounts?.ar?.accountId || 'Not found'
          },
          accountsPayable: {
            balance: formatCurrency(pillarData.controlAccounts?.ap?.balance || 0),
            accountId: pillarData.controlAccounts?.ap?.accountId || 'Not found'
          },
          journalEntriesToARorAP: pillarData.controlAccounts?.journalEntriesToARorAP || 0
        }
      },
      {
        title: 'A/R Aging',
        description: 'Accounts receivable aging analysis',
        isEmpty: !pillarData.arApValidity?.arAging,
        data: {
          current: formatCurrency(pillarData.arApValidity?.arAging?.current || 0),
          days1_30: formatCurrency(pillarData.arApValidity?.arAging?.d1_30 || 0),
          days31_60: formatCurrency(pillarData.arApValidity?.arAging?.d31_60 || 0),
          days61_90: formatCurrency(pillarData.arApValidity?.arAging?.d61_90 || 0),
          days90Plus: formatCurrency(pillarData.arApValidity?.arAging?.d90_plus || 0),
          totalAR: formatCurrency(
            (pillarData.arApValidity?.arAging?.current || 0) +
            (pillarData.arApValidity?.arAging?.d1_30 || 0) +
            (pillarData.arApValidity?.arAging?.d31_60 || 0) +
            (pillarData.arApValidity?.arAging?.d61_90 || 0) +
            (pillarData.arApValidity?.arAging?.d90_plus || 0)
          )
        }
      },
      {
        title: 'A/P Aging',
        description: 'Accounts payable aging analysis',
        isEmpty: !pillarData.arApValidity?.apAging,
        data: {
          current: formatCurrency(pillarData.arApValidity?.apAging?.current || 0),
          days1_30: formatCurrency(pillarData.arApValidity?.apAging?.d1_30 || 0),
          days31_60: formatCurrency(pillarData.arApValidity?.apAging?.d31_60 || 0),
          days61_90: formatCurrency(pillarData.arApValidity?.apAging?.d61_90 || 0),
          days90Plus: formatCurrency(pillarData.arApValidity?.apAging?.d90_plus || 0),
          totalAP: formatCurrency(
            (pillarData.arApValidity?.apAging?.current || 0) +
            (pillarData.arApValidity?.apAging?.d1_30 || 0) +
            (pillarData.arApValidity?.apAging?.d31_60 || 0) +
            (pillarData.arApValidity?.apAging?.d61_90 || 0) +
            (pillarData.arApValidity?.apAging?.d90_plus || 0)
          )
        }
      }
    ];
  };

  const reportSections = formatReportSections();

  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Data Report Preview
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              This is the exact data format that will be sent to the AI for hygiene assessment analysis.
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <CalendarIcon className="w-4 h-4" />
                Analysis Period: {formatDate(webhookData.meta.start_date)} to {formatDate(webhookData.meta.end_date)}
              </div>
              <div className="flex items-center gap-1">
                <BarChartIcon className="w-4 h-4" />
                Realm ID: {webhookData.meta.realmId}
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowRawData(!showRawData)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <EyeOpenIcon className="w-4 h-4" />
            {showRawData ? 'Hide' : 'Show'} Raw Data
          </button>
        </div>
      </div>

      {/* Raw Data Toggle */}
      {showRawData && (
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Raw Webhook Response</h4>
          <pre className="text-xs text-gray-600 bg-white p-4 rounded border overflow-x-auto max-h-96">
            {JSON.stringify(webhookData, null, 2)}
          </pre>
        </div>
      )}

      {/* Report Sections */}
      <div className="divide-y divide-gray-200">
        {reportSections.map((section, index) => (
          <div key={section.title} className="p-6">
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => toggleSection(section.title)}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {expandedSections.has(section.title) ? (
                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                  )}
                  <FileTextIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-md font-medium text-gray-900">
                    {section.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {section.description}
                  </p>
                </div>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                section.isEmpty 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {section.isEmpty ? 'No Data' : 'Available'}
              </div>
            </div>

            {/* Expanded Content */}
            {expandedSections.has(section.title) && (
              <div className="mt-4 ml-7">
                {section.isEmpty ? (
                  <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded">
                    No data available for this report section.
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded p-4">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                      {JSON.stringify(section.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            Data formatted for LLM analysis using Day-30 Readiness Assessment methodology
          </div>
          <div className="flex items-center gap-4">
            <span>
              {reportSections.filter(s => !s.isEmpty).length} of {reportSections.length} sections populated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataReportFormatter;