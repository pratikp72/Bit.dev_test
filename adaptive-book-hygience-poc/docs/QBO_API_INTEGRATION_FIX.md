# QuickBooks Online API Query Endpoint Fix

## Issue Summary

The application was experiencing `400 Bad Request` errors when attempting to fetch data from QuickBooks Online (QBO) API query endpoints. The root cause was identified as sending SQL queries in JSON format instead of the plain text format expected by QBO's `/query` endpoint.

## Architecture Context

- **Frontend**: React 18 with TypeScript using Vite
- **Proxy**: `local-cors-proxy` running on Docker via Render.com
- **QBO API**: QuickBooks Online Accounting API v3
- **Authentication**: OAuth 2.0 with access tokens

## Root Cause Analysis

### The Problem
The QBO `/query` endpoint has specific requirements that differ from other QBO API endpoints:

1. **Expected HTTP Method**: GET (not POST)
2. **Expected Content Format**: SQL query as URL parameter (not JSON body)
3. **Parameter Name**: `query` containing the raw SQL string

### What Was Wrong
The original implementation was:
- Using POST method with JSON body: `{ "query": "SELECT * FROM Customer" }`
- Sending to: `POST /v3/company/{realmId}/query`

### What QBO Actually Expects
The correct format should be:
- Using GET method with URL parameter
- Sending to: `GET /v3/company/{realmId}/query?query=SELECT%20*%20FROM%20Customer`

## Solution Implementation

### Code Changes Made

#### 1. Fixed Query Method Configuration
```typescript
// Before (incorrect)
async fetchCustomers(): Promise<QBOCustomer[]> {
  const config: QBOApiConfig = {
    method: "POST",
    endpoint: "v3/company/{realmId}/query",
    data: { query: "SELECT * FROM Customer" },
  };
  return this.rateLimiter.enqueue(config);
}

// After (correct)
async fetchCustomers(): Promise<QBOCustomer[]> {
  const config: QBOApiConfig = {
    method: "GET",
    endpoint: "v3/company/{realmId}/query",
    params: { query: "SELECT * FROM Customer" },
  };
  return this.rateLimiter.enqueue(config);
}
```

#### 2. Standardized All Query Methods
Updated these methods to use consistent GET + params pattern:
- `fetchCustomers()`
- `fetchChartOfAccounts()`
- `fetchBankReconciliation()`
- `fetchAuditLog()`

#### 3. Fixed TypeScript Interface
```typescript
// Fixed QBOApiResponse interface to handle mixed types
interface QBOApiResponse<T> {
  QueryResponse?: {
    maxResults?: number;
    startPosition?: number;
  } & {
    [key: string]: T[];
  };
  // ... rest of interface
}
```

#### 4. Enhanced Request Building
```typescript
// Enhanced URL building with proper parameter handling
let url = `${this.PROXY_BASE_URL}/${endpointWithRealm}`;
if (params) {
  const urlParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      urlParams.append(key, String(value));
    }
  });
  if (urlParams.toString()) {
    url += `?${urlParams.toString()}`;
  }
}
```

## How local-cors-proxy Integration Works

### Request Flow
1. **Frontend Request**:
   ```
   GET /proxy/v3/company/{realmId}/query?query=SELECT%20*%20FROM%20Customer
   Authorization: Bearer {access_token}
   ```

2. **local-cors-proxy Processing**:
   - Removes `/proxy` prefix
   - Forwards request to QuickBooks API
   - Adds CORS headers to response

3. **Actual QBO API Request**:
   ```
   GET https://sandbox-quickbooks.api.intuit.com/v3/company/{realmId}/query?query=SELECT%20*%20FROM%20Customer
   Authorization: Bearer {access_token}
   Accept: application/json
   ```

### Why This Works
- `local-cors-proxy` forwards requests **as-is** without transformation
- No special handling needed in the proxy for different endpoint types
- Frontend controls the exact format sent to QBO API
- Simple pass-through architecture maintains request integrity

## Verification Steps

### 1. Request Format Validation
Verify that query requests now generate correct URLs:
```
✅ GET /proxy/v3/company/123/query?query=SELECT%20*%20FROM%20Customer
❌ POST /proxy/v3/company/123/query (with JSON body)
```

### 2. Response Validation
Confirm successful responses contain expected QBO data structure:
```typescript
{
  "QueryResponse": {
    "Customer": [...],
    "maxResults": 1000,
    "startPosition": 1
  },
  "time": "2025-01-07T..."
}
```

### 3. Error Resolution
Verify that `400 Bad Request` errors are resolved for query endpoints.

## Environment Configuration

### Required Environment Variables
```bash
# QBO API Configuration
VITE_QBO_PROXY_BASE_URL=/proxy
VITE_QBO_REQUEST_TIMEOUT=30000
VITE_QBO_MAX_REQUESTS_PER_MINUTE=450
VITE_QBO_MAX_RETRIES=3
VITE_QBO_RETRY_DELAY_MS=1000

# OAuth Configuration
VITE_QBO_CLIENT_ID=your_client_id
VITE_QBO_REDIRECT_URI=your_n8n_webhook_url
VITE_QBO_SCOPE=com.intuit.quickbooks.accounting
```

### local-cors-proxy Configuration
The proxy should be configured to:
- Forward requests to QBO API base URL
- Preserve all headers including Authorization
- Add appropriate CORS headers for your domain
- Handle both GET and POST methods

## Testing Recommendations

### 1. Integration Testing
```typescript
// Test actual QBO API calls
const qboService = new QBOApiService();
qboService.setAuth(accessToken, realmId);

// Should now work without 400 errors
const customers = await qboService.fetchCustomers();
const accounts = await qboService.fetchChartOfAccounts();
```

### 2. Error Handling Testing
```typescript
// Test with invalid tokens
// Test with expired tokens  
// Test rate limiting scenarios
// Test network timeout scenarios
```

### 3. Performance Testing
```typescript
// Test rate limiting compliance (450 requests/minute)
// Test concurrent request handling
// Test large dataset retrieval
```

## Lessons Learned

### 1. API Documentation Clarity
- Always verify the exact HTTP method and content type expected
- QBO query endpoints are different from other QBO endpoints
- Read the specific endpoint documentation, not just general API docs

### 2. Proxy Architecture Benefits
- Simple pass-through proxies (like local-cors-proxy) maintain request integrity
- No transformation logic needed in proxy layer
- Frontend has full control over request format

### 3. Error Diagnosis Process
- Check HTTP method first (GET vs POST)
- Verify content type and body format
- Compare actual request with API documentation examples
- Test direct API calls to isolate proxy vs. endpoint issues

## Future Considerations

### 1. Error Monitoring
Implement monitoring for:
- QBO API response codes
- Rate limiting adherence
- Token expiration handling

### 2. Performance Optimization
Consider implementing:
- Response caching for frequently accessed data
- Batch query optimization
- Progressive data loading

### 3. Resilience Improvements
Add features for:
- Automatic retry with exponential backoff
- Circuit breaker pattern for failed endpoints
- Graceful degradation when QBO API is unavailable

## Related Documentation

- [QBO API All Entities](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account)
- [QBO Query API Reference](https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/query)
- [OAuth 2.0 Flow Documentation](https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization/oauth-2.0)

---

**Resolution Date**: January 7, 2025  
**Issue Duration**: Resolved during development phase  
**Impact**: Enabled successful QBO data integration for financial assessment platform