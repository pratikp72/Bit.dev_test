import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { SignedIn, SignedOut, useUser } from "@clerk/clerk-react";
import "./App.css";
import LandingPage from "./components/LandingPage";
import AgentForm from "./components/AgentForm";
import QBOAuth from "./components/QBOAuth";
import OAuthCallback from "./components/OAuthCallBack"; // Fixed typo
import Assessment from "./components/Assessment";
import Privacy from "./components/Privacy";
import EULA from "./components/EULA";
import SignUpPage from "./components/SignUpPage";
import SignInPage from "./components/SignInPage";
import { QBOServiceProvider } from "./services/QBOServiceContext";
import { QBOTokenService } from "./services/qboTokenService";
import { useLogoutCleanup } from "./hooks/useLogoutCleanup";
import logger from "./lib/logger";
import Test from "./components/TestBitComponent";

// 1. Define types for the state variables.
export type CurrentView = "landing" | "agent-form" | "qbo-auth" | "assessment";
export type CurrentStep =
  | "upload"
  | "customer-selection"
  | "analysis"
  | "results";
export type ViewMode = "business" | "technical";

// 2. Define an interface for the `formData` object.
export interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  businessType: string;
  bookkeepingChallenges: string;
  currentSoftware: string;
  monthlyRevenue: string;
  urgencyLevel: string;
}

// Protected Route Component
const ProtectedRoute: React.FC<{
  component: React.ComponentType<any>;
  [key: string]: any;
}> = ({ component: Component, ...props }) => {
  return (
    <SignedIn>
      <Component {...props} />
    </SignedIn>
  );
};

function AppContent() {
  const { user, isLoaded } = useUser();
  
  // Initialize logout cleanup hook
  useLogoutCleanup();
  
  // Define all the state variables needed for the different components
  const [currentStep, setCurrentStep] = useState<CurrentStep>("upload");
  const [viewMode, setViewMode] = useState<ViewMode>("business");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Initialize formData with user info from Clerk when available
  const [formData, setFormData] = useState<FormData>({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.emailAddresses?.[0]?.emailAddress || "",
    phone: "",
    company: "",
    businessType: "",
    bookkeepingChallenges: "",
    currentSoftware: "",
    monthlyRevenue: "",
    urgencyLevel: "",
  });

  // Update formData when user loads
  useEffect(() => {
    if (isLoaded && user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
        email: user.emailAddresses?.[0]?.emailAddress || prev.email,
      }));
    }
  }, [isLoaded, user]);

  // QBO Auth states
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [realmId, setRealmId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [tokensLoaded, setTokensLoaded] = useState(false);

  // Load stored QBO tokens when user is available
  useEffect(() => {
    const loadStoredTokens = async () => {
      if (!isLoaded || !user) {
        return;
      }

      try {
        logger.debug("Loading stored QBO tokens for user");
        const tokens = await QBOTokenService.getTokens(user.id);
        
        if (tokens && await QBOTokenService.validateTokens(tokens)) {
          logger.info("Found valid stored QBO tokens");
          setAccessToken(tokens.access_token);
          setRefreshToken(tokens.refresh_token);
          setRealmId(tokens.realm_id);
        } else {
          logger.debug("No valid stored tokens found");
        }
      } catch (error) {
        logger.error("Error loading stored QBO tokens", error);
      } finally {
        setTokensLoaded(true);
      }
    };

    loadStoredTokens();
  }, [isLoaded, user]);

  // Define all the handler functions
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleFileUpload = (reportName: string) => {
    setUploadedFiles((prevFiles) => {
      if (prevFiles.includes(reportName)) {
        return prevFiles; // Prevent duplicates
      }
      return [...prevFiles, reportName];
    });
  };

  const handleAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setCurrentStep("results");
    }, 4000); // Simulate a 4-second analysis process
  };

  return (
    <QBOServiceProvider>
      <Routes>
        {/* Public Landing Page - shows sign in/up options */}
        <Route path="/" element={<LandingPage />} />

        {/* Protected Routes - require authentication */}
        <Route
          path="/dashboard"
          element={
            <SignedIn>
              <LandingPage />
            </SignedIn>
          }
        />

        <Route
          path="/form"
          element={
            <ProtectedRoute
              component={AgentForm}
              formData={formData}
              handleInputChange={handleInputChange}
            />
          }
        />

        <Route
          path="/qbo-auth"
          element={
            <QBOAuth
              formData={formData}
              accessToken={accessToken}
              refreshToken={refreshToken}
              realmId={realmId}
              authError={authError}
            />
          }
        />

        {/* OAuth Callback - needs to be accessible during redirect */}
        <Route
          path="/oauth-callback"
          element={
            <OAuthCallback
              setAccessToken={setAccessToken}
              setRefreshToken={setRefreshToken}
              setRealmId={setRealmId}
              setError={setAuthError}
            />
          }
        />

        <Route
          path="/assessment"
          element={
            <SignedIn>
              {accessToken ? (
                <Assessment
                  currentStep={currentStep}
                  setCurrentStep={setCurrentStep}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  uploadedFiles={uploadedFiles}
                  setUploadedFiles={setUploadedFiles}
                  isAnalyzing={isAnalyzing}
                  setIsAnalyzing={setIsAnalyzing}
                  formData={formData}
                  handleFileUpload={handleFileUpload}
                  handleAnalysis={handleAnalysis}
                  accessToken={accessToken}
                  realmId={realmId}
                />
              ) : (
                <Navigate to="/qbo-auth" replace />
              )}
            </SignedIn>
          }
        />

        {/* Public routes for legal pages */}
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/eula" element={<EULA />} />

        {/* Test Bit Component */}
        <Route path="/test-bit" element={<Test />} />

        {/* Authentication routes */}
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInPage />} />

        {/* Catch all - redirect based on auth status */}
        <Route
          path="*"
          element={
            <>
              <SignedIn>
                <Navigate to="/dashboard" replace />
              </SignedIn>
              <SignedOut>
                <Navigate to="/" replace />
              </SignedOut>
            </>
          }
        />
      </Routes>
    </QBOServiceProvider>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <AppContent />
      </div>
    </Router>
  );
}

export default App;
