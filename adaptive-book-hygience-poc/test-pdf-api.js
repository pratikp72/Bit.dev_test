const fetch = require('node-fetch');

const PDF_API_URL = 'https://n8n-1-102-1-c1zi.onrender.com/webhook/convert-pdf';

const sampleMarkdown = `# QuickBooks Online Financial Data Analysis
Company: Company
Assessment Date: 09/08/2025
Data Period: 2025-05-11 to 2025-08-09 (90 days)

---

## PILLAR 1: BANK & CREDIT CARD RECONCILIATION

Total Bank/CC Accounts: 4
Transactions Processed: 130
Has Transaction Data: Yes

### Account Variance Analysis:
- Checking:
  - Book Ending Balance: $1201.00
  - Cleared Amount: $0.00
  - Uncleared Amount: $0.00
  - Variance: $1201.00
- Mastercard:
  - Book Ending Balance: $157.72
  - Cleared Amount: $0.00
  - Uncleared Amount: $0.00
  - Variance: $157.72
- Savings:
  - Book Ending Balance: $800.00
  - Cleared Amount: $0.00
  - Uncleared Amount: $0.00
  - Variance: $800.00
- Visa:
  - Book Ending Balance: $0.00
  - Cleared Amount: $0.00
  - Uncleared Amount: $0.00
  - Variance: $0.00

## PILLAR 2: CHART OF ACCOUNTS INTEGRITY

Total Accounts: 90
Duplicate Account Names: 8
  - Duplicates: Depreciation, Equipment Rental, Installation, Job Materials, Decks and Patios, Plants and Soil, Sprinklers and Drip Systems, Maintenance and Repair
Duplicate Account Numbers: 0
Accounts Missing Details: 0
Sub-accounts Missing Parent: 0

## PILLAR 3: TRANSACTION CATEGORIZATION

### Uncategorized Transactions:
- Uncategorized Expense:
  - Count: 0
  - Amount: $0.00
- Uncategorized Income:
  - Count: 0
  - Amount: $0.00
- Uncategorized Asset:
  - Count: 0
  - Amount: $0.00
- Ask My Accountant:
  - Count: 0
  - Amount: $0.00

## PILLAR 4: CONTROL ACCOUNT ACCURACY

Opening Balance Equity: $9337.50
Undeposited Funds: $2062.52
Accounts Receivable: $5281.52
Accounts Payable: $1602.67
Journal Entries to AR/AP: 0


## PILLAR 5: ACCOUNTS RECEIVABLE & PAYABLE VALIDITY

### Accounts Receivable Aging:
- Current: $1153.85
- 1-30 days: $3730.67
- 31-60 days: $241.00
- 61-90 days: $156.00
- Over 90 days: $0.00
- Total: $5281.52

### Accounts Payable Aging:
- Current: $0.00
- 1-30 days: $1516.23
- 31-60 days: $86.44
- 61-90 days: $0.00
- Over 90 days: $0.00
- Total: $1602.67


## CALCULATED ASSESSMENT SCORES

Overall Score: 71/100
Readiness Status: ADDITIONAL_CLEANUP_REQUIRED

### Pillar Scores:
- Bank & Credit Card Reconciliation: 55/100
- Chart of Accounts Integrity: 30/100
- Transaction Categorization: 100/100
- Control Account Accuracy: 75/100
- A/R & A/P Validity: 100/100

---

*This data is being sent to the AI for hygiene assessment analysis*`;

async function testPDFAPI() {
  console.log('Testing PDF API with sample markdown...');
  console.log('URL:', PDF_API_URL);
  console.log('Content length:', sampleMarkdown.length);
  
  try {
    const response = await fetch(PDF_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: sampleMarkdown,
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());
    
    const contentType = response.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`PDF API returned ${response.status}: ${errorText}`);
    }

    const blob = await response.blob();
    console.log('Response blob size:', blob.size);
    
    if (blob.size === 0) {
      console.error('❌ PDF API returned empty response');
    } else if (!contentType || !contentType.includes('application/pdf')) {
      console.error('❌ Invalid content type:', contentType);
      // Try to read as text to see what was returned
      const text = await blob.text();
      console.log('Response text (first 500 chars):', text.substring(0, 500));
    } else {
      console.log('✅ PDF generated successfully!');
      console.log('PDF size:', blob.size, 'bytes');
      
      // Save to file for inspection
      const fs = require('fs');
      const buffer = await blob.arrayBuffer();
      fs.writeFileSync('test-output.pdf', Buffer.from(buffer));
      console.log('PDF saved to test-output.pdf');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

testPDFAPI();