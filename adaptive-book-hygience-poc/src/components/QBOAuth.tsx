import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import {
  Link2Icon,
  CheckCircledIcon,
  ExclamationTriangleIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { FormData } from "../App";
import { QBOTokenService, StoredQBOTokens } from "../services/qboTokenService";
import logger from "../lib/logger";

// QuickBooks OAuth Configuration from environment variables
const CLIENT_ID = import.meta.env.VITE_QBO_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_QBO_REDIRECT_URI;
const SCOPE = import.meta.env.VITE_QBO_SCOPE;
const AUTH_BASE_URL = import.meta.env.VITE_QBO_AUTH_BASE_URL;

// Debug environment variables
console.log("=== QBO OAuth Debug ===");
console.log("CLIENT_ID:", CLIENT_ID);
console.log("REDIRECT_URI:", REDIRECT_URI);
console.log("SCOPE:", SCOPE);
console.log("AUTH_BASE_URL:", AUTH_BASE_URL);
console.log("All env vars:", import.meta.env);
console.log("=====================");

// ADD THESE 3 LINES:
console.log("=== ENV TEST ===");
console.log("Raw env object:", import.meta.env);
console.log("================");

// Validate required environment variables
if (!CLIENT_ID) {
  console.error("VITE_QBO_CLIENT_ID environment variable is required");
}
if (!REDIRECT_URI) {
  console.error("VITE_QBO_REDIRECT_URI environment variable is required");
}
if (!SCOPE) {
  console.error("VITE_QBO_SCOPE environment variable is required");
}
if (!AUTH_BASE_URL) {
  console.error("VITE_QBO_AUTH_BASE_URL environment variable is required");
}

interface QBOAuthProps {
  formData: FormData;
  accessToken: string | null;
  refreshToken: string | null;
  realmId: string | null;
  authError: string | null;
}

const QBOAuth: React.FC<QBOAuthProps> = ({
  formData,
  accessToken,
  refreshToken,
  realmId,
  authError,
}) => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const [isCheckingTokens, setIsCheckingTokens] = useState(true);
  const [storedTokens, setStoredTokens] = useState<StoredQBOTokens | null>(null);

  console.log("🟢 QBOAuth component is rendering!");
  console.log("QBOAuth props:", {
    formData,
    accessToken,
    refreshToken,
    realmId,
    authError,
  });

  // Check for existing stored tokens on component mount
  useEffect(() => {
    const checkExistingTokens = async () => {
      if (!isLoaded || !user) {
        return;
      }

      try {
        setIsCheckingTokens(true);
        logger.debug("Checking for existing QBO tokens...");

        const tokens = await QBOTokenService.getTokens(user.id);
        
        if (tokens) {
          const isValid = await QBOTokenService.validateTokens(tokens);
          
          if (isValid) {
            logger.info("Found valid existing QBO tokens, redirecting to assessment");
            setStoredTokens(tokens);
            // Auto-redirect to assessment if we have valid tokens
            navigate("/assessment");
            return;
          } else {
            logger.debug("Found expired/invalid tokens, will show connect button");
            // Deactivate invalid tokens
            await QBOTokenService.deactivateExistingTokens(user.id);
          }
        } else {
          logger.debug("No existing QBO tokens found");
        }
      } catch (error) {
        logger.error("Error checking existing QBO tokens", error);
      } finally {
        setIsCheckingTokens(false);
      }
    };

    checkExistingTokens();
  }, [isLoaded, user, navigate]);

  // Auto-redirect to assessment when access token is received
  useEffect(() => {
    if (accessToken) {
      const timer = setTimeout(() => {
        navigate("/assessment");
      }, 2000); // 2 second delay to show success message

      return () => clearTimeout(timer);
    }
  }, [accessToken, navigate]);

  const loginWithQuickBooks = () => {
    console.log("🔴 loginWithQuickBooks CALLED!");
    console.trace("Stack trace for loginWithQuickBooks call");
    console.log("Environment variables at redirect time:");
    console.log("CLIENT_ID:", CLIENT_ID);
    console.log("REDIRECT_URI:", REDIRECT_URI);
    console.log("SCOPE:", SCOPE);
    console.log("AUTH_BASE_URL:", AUTH_BASE_URL);
    
    // QuickBooks OAuth URL - DO NOT add /authorize!
    // The correct URL is https://appcenter.intuit.com/connect/oauth2 (without /authorize)
    const baseUrl = AUTH_BASE_URL || 'https://appcenter.intuit.com/connect/oauth2';
    
    console.log("Fixed Auth Base URL:", baseUrl);
    
    // Generate a cryptographically random state parameter for CSRF protection
    // OAuth 2.0 best practice: use a random string to prevent CSRF attacks
    const generateState = () => {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };
    
    const state = generateState();
    
    // Store state in sessionStorage to verify it when the callback returns
    // This prevents CSRF attacks by ensuring the callback is from our initiated request
    sessionStorage.setItem('qbo_oauth_state', state);
    sessionStorage.setItem('qbo_oauth_timestamp', Date.now().toString());
    
    console.log("Generated OAuth state for CSRF protection:", state);
    
    const authUrl = `${baseUrl}?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI,
    )}&response_type=code&scope=${encodeURIComponent(SCOPE)}&state=${state}`;
    console.log("🚀 Generated OAuth URL:", authUrl);
    window.location.href = authUrl;
  };

  const proceedToAssessment = () => {
    navigate("/assessment");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Connect to QuickBooks
            </h1>
            <button
              onClick={() => navigate("/form")}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Form
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Hi {formData.firstName}! Let's Connect Your QuickBooks
            </h2>
            <p className="text-lg text-gray-600">
              We need to securely connect to your QuickBooks Online account to
              analyze your financial data and provide accurate assessment
              results for {formData.company}.
            </p>
          </div>

          {/* Connection Status */}
          <div className="space-y-6">
            {/* Loading State - Checking for existing tokens */}
            {isCheckingTokens && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <ReloadIcon className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Checking Connection
                </h3>
                <p className="text-gray-600">
                  Please wait while we check your QuickBooks connection status...
                </p>
              </div>
            )}

            {!isCheckingTokens && !accessToken && !authError && !storedTokens && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <Link2Icon className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Ready to Connect
                </h3>
                <p className="text-gray-600 mb-6">
                  Click the button below to securely connect your QuickBooks
                  Online account. We'll only access the data needed for your
                  financial assessment.
                </p>
                <button
                  onClick={loginWithQuickBooks}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center mx-auto text-lg font-semibold"
                >
                  <Link2Icon className="w-5 h-5 mr-2" />
                  Connect to QuickBooks Online
                </button>
                <p className="text-sm text-gray-500 mt-4">
                  Secure OAuth 2.0 connection - we never see your login
                  credentials
                </p>
              </div>
            )}

            {/* Loading State (would be shown during redirect) */}
            <div
              className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center hidden"
              id="loading-state"
            >
              <ReloadIcon className="w-12 h-12 text-yellow-600 mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting...
              </h3>
              <p className="text-gray-600">
                Please wait while we establish a secure connection to your
                QuickBooks account.
              </p>
            </div>

            {/* Success State */}
            {accessToken && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <CheckCircledIcon className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Successfully Connected!
                </h3>
                <p className="text-gray-600 mb-6">
                  Great! We've successfully connected to your QuickBooks Online
                  account. You'll be redirected to the assessment automatically.
                </p>

                <div className="bg-white rounded-lg p-4 mb-6 text-left">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Connection Details:
                  </h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      <strong>Company:</strong> {formData.company}
                    </p>
                    <p>
                      <strong>Realm ID:</strong> {realmId}
                    </p>
                    <p>
                      <strong>Status:</strong>{" "}
                      <span className="text-green-600 font-medium">
                        Connected ✓
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <ReloadIcon className="w-5 h-5 text-blue-600 animate-spin mr-2" />
                  <span className="text-gray-600">
                    Redirecting to assessment...
                  </span>
                </div>
              </div>
            )}

            {/* Error State */}
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <ExclamationTriangleIcon className="w-12 h-12 text-red-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Connection Failed
                </h3>
                <p className="text-gray-600 mb-4">
                  We encountered an issue connecting to your QuickBooks account:
                </p>
                <div className="bg-white rounded-lg p-4 mb-6">
                  <p className="text-red-700 font-medium">{authError}</p>
                </div>
                <div className="space-y-3">
                  <button
                    onClick={loginWithQuickBooks}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors mr-3"
                  >
                    <ReloadIcon className="w-4 h-4 mr-2 inline" />
                    Try Again
                  </button>
                  <button
                    onClick={() => navigate("/assessment")}
                    className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Continue Without Connection
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-4">
                  Note: Without QuickBooks connection, you'll need to upload
                  reports manually.
                </p>
              </div>
            )}

            {/* What happens next */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-semibold text-gray-900 mb-3">
                What happens next?
              </h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-start">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">
                    1
                  </span>
                  <span>
                    We'll securely fetch your financial reports from QuickBooks
                    Online
                  </span>
                </div>
                <div className="flex items-start">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">
                    2
                  </span>
                  <span>
                    Our AI will analyze your data across 5 key financial health
                    pillars
                  </span>
                </div>
                <div className="flex items-start">
                  <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold mr-3 mt-0.5">
                    3
                  </span>
                  <span>
                    You'll receive a comprehensive assessment with actionable
                    recommendations
                  </span>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="border-l-4 border-blue-500 bg-blue-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    <strong>Security Notice:</strong> We use industry-standard
                    OAuth 2.0 authentication. We never store your QuickBooks
                    login credentials and only access the minimum data required
                    for your assessment. You can revoke our access at any time
                    through your QuickBooks account settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QBOAuth;
