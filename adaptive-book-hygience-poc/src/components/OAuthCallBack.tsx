import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { ReloadIcon } from "@radix-ui/react-icons";
import logger from "../lib/logger";
import { QBOTokenService } from "../services/qboTokenService";

// OAuth Configuration from environment variables
const POST_LOGIN_REDIRECT = import.meta.env.VITE_QBO_POST_LOGIN_REDIRECT;

// Validate required environment variable
if (!POST_LOGIN_REDIRECT) {
  logger.error("VITE_QBO_POST_LOGIN_REDIRECT environment variable is required");
}

interface OAuthCallbackProps {
  setAccessToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
  setRealmId: (id: string | null) => void;
  setError: (error: string | null) => void;
}

const OAuthCallback: React.FC<OAuthCallbackProps> = ({
  setAccessToken,
  setRefreshToken,
  setRealmId,
  setError,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    logger.group("OAuth Callback Processing");

    const processAuth = async () => {
      const params = new URLSearchParams(location.search);
      
      // Check if we have the QBO tokens in the URL (from N8N redirect)
      const qbTokensParam = params.get("qb_tokens");
      
      // Fallback to individual params if no qb_tokens
      const code = params.get("code");
      const error = params.get("error");
      const state = params.get("state");
      const realmId = params.get("realmId") || params.get("realm_id");
      
      // Check for tokens from N8N redirect
      if (qbTokensParam) {
        try {
          const tokens = JSON.parse(decodeURIComponent(qbTokensParam));
          logger.debug("Received tokens from N8N:", tokens);
          
          if (!isLoaded || !user) {
            logger.debug("User not loaded yet, waiting...");
            return;
          }
          
          // Store tokens in Supabase
          const tokenData = {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || null,
            realm_id: tokens.realm_id || realmId,
            token_type: tokens.token_type || 'Bearer',
            expires_in: tokens.expires_in || 3600
          };

          const stored = await QBOTokenService.storeTokens(user.id, tokenData);
        
          if (stored) {
            // Clear any previous errors and set state
            setError(null);
            setAccessToken(tokens.access_token);
            setRefreshToken(tokens.refresh_token || null);
            setRealmId(tokens.realm_id || realmId);

            logger.info("Successfully processed and stored OAuth tokens from N8N, navigating to assessment");
            navigate("/assessment");
            return;
          } else {
            throw new Error("Failed to store tokens in database");
          }
        } catch (err) {
          logger.error("Failed to process tokens from N8N:", err);
          setError("Failed to complete QuickBooks authentication. Please try again.");
          navigate("/qbo-auth");
          return;
        }
      }

      logger.debug("OAuth callback - code received:", code);
      logger.debug("OAuth callback - error received:", error);
      logger.debug("OAuth callback - state received:", state);

      // Verify state parameter for CSRF protection (OAuth 2.0 best practice)
      const storedState = sessionStorage.getItem('qbo_oauth_state');
      const storedTimestamp = sessionStorage.getItem('qbo_oauth_timestamp');
      
      if (state && storedState) {
        if (state !== storedState) {
          logger.error("OAuth state mismatch - possible CSRF attack", {
            received: state,
            expected: storedState
          });
          setError("Security validation failed. Please try connecting again.");
          sessionStorage.removeItem('qbo_oauth_state');
          sessionStorage.removeItem('qbo_oauth_timestamp');
          navigate("/qbo-auth");
          return;
        }
        
        // Check if state is not too old (15 minutes max)
        if (storedTimestamp) {
          const elapsed = Date.now() - parseInt(storedTimestamp);
          if (elapsed > 15 * 60 * 1000) {
            logger.warn("OAuth state expired (>15 minutes old)");
            setError("Authentication session expired. Please try again.");
            sessionStorage.removeItem('qbo_oauth_state');
            sessionStorage.removeItem('qbo_oauth_timestamp');
            navigate("/qbo-auth");
            return;
          }
        }
        
        // Clear state from storage after successful validation
        sessionStorage.removeItem('qbo_oauth_state');
        sessionStorage.removeItem('qbo_oauth_timestamp');
        logger.info("OAuth state validated successfully");
      }

      if (error) {
        logger.error("OAuth error:", error);
        setError(`OAuth error: ${error}`);
        logger.debugBreak("OAuth error occurred - check error details above");
        logger.info("Redirecting to QBO Auth page due to error");
      }

      if (code && realmId) {
        // This should not happen if N8N is configured correctly
        // The N8N webhook should handle the code exchange and redirect with tokens
        logger.warn("Received authorization code directly - N8N webhook may not be configured correctly");
        logger.warn("The OAuth flow should go through N8N webhook for token exchange");
        
        // Show error to user
        setError("OAuth configuration error. Please contact support.");
        navigate("/qbo-auth");

      // fetch(`${POST_LOGIN_REDIRECT}?code=${code}`, {
      //   method: "GET",
      //   redirect: "manual"
      // })
      //   .then((res) => {
      //     if (!res.ok) {
      //       throw new Error(`HTTP error! status: ${res.status}`);
      //     }
      //     const headers = res.headers;
      //     const accessToken = headers.get("access-token")
      //     const refreshToken = headers.get("refresh-token")
      //     const tokenType = headers.get("token-type")

      //     const data = {
      //       accessToken, refreshToken, tokenType
      //     }

      //     console.log("data", data)

      //     if (data.accessToken) {
      //       setAccessToken(data.refreshToken);
      //       setRefreshToken(data.tokenType || null);
      //       // setRealmId(data.realmId || data.realm_id || "N/A");
      //       // Redirect directly to assessment page after successful auth
      //       navigate("/assessment");
      //     } else {
      //       throw new Error("Invalid response from backend - no access token received");
      //     }
      //   })
      //   .catch((err: Error) => {
      //     console.error("Fetch error:", err);
      //     setError(`Failed to authenticate: ${err.message}`);
      //     navigate('/qbo-auth');
      //   });
      } else {
        logger.error("No authorization code or realm ID received from QuickBooks", { code, realmId });
        setError("No authorization code received from QuickBooks");
        navigate("/qbo-auth");
      }
    };

    processAuth();
    logger.groupEnd();
  }, [isLoaded, user, location.search, navigate, setAccessToken, setRefreshToken, setRealmId, setError]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <ReloadIcon className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Processing Authentication...
          </h2>
          <p className="text-gray-600">
            Please wait while we complete your QuickBooks connection.
          </p>
          <div className="mt-6">
            <div className="animate-pulse flex space-x-1 justify-center">
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
