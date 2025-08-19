import React from "react";
import { useNavigate } from "react-router-dom";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/clerk-react";
import {
  CheckCircledIcon,
  BarChartIcon,
  GearIcon,
  ClockIcon,
  ArrowRightIcon,
  StarIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useUserAssessment } from "../hooks/useUserAssessment";
import { useEulaAwareAuth } from "../hooks/useEulaAwareAuth";
import logger from "../lib/logger";
import Header from "./Header";
import Footer from "./Footer";
import EulaModal from "./EulaModal";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoaded } = useUser();
  const { userAssessment, isCheckingData } = useUserAssessment();
  const {
    showEulaModal,
    pendingAuthAction,
    handleAuthAction,
    handleEulaAgree,
    handleEulaDisagree,
    handleEulaClose,
  } = useEulaAwareAuth();

  const handleGetStarted = () => {
    const hasAssessment = !!userAssessment;
    const targetRoute = hasAssessment ? "/qbo-auth" : "/form";
    const logMsg = hasAssessment
      ? "User has existing data, redirecting to QBO Auth"
      : "User needs to fill form first";
    logger.info(logMsg);
    navigate(targetRoute);
  };

  const handleStartNewAssessment = () => {
    // Force user to go through form again (for new assessment)
    logger.info("Starting new assessment, redirecting to form");
    navigate("/form");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <SignedOut>
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                Know Your Books'
                <span className="text-blue-600"> Health Score</span>
              </h1>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Get a comprehensive assessment of your QuickBooks Online data in
                minutes. Identify issues, fix problems, and ensure your
                financial records are accurate and reliable.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                  onClick={() => handleAuthAction('signup')}
                  className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors flex items-center"
                >
                  Start Free Assessment{" "}
                  <ArrowRightIcon className="w-5 h-5 ml-2" />
                </button>
                <div className="flex items-center space-x-2 text-gray-600">
                  <CheckCircledIcon className="w-5 h-5 text-green-500" />
                  <span>Free • 5 minutes • Instant results</span>
                </div>
              </div>
              
              <div className="mt-6 text-center">
                <p className="text-gray-600 mb-4">Already have an account?</p>
                <button
                  onClick={() => handleAuthAction('signin')}
                  className="text-blue-600 hover:text-blue-800 underline text-lg font-medium"
                >
                  Sign In Here
                </button>
              </div>
            </SignedOut>

            <SignedIn>
              {isCheckingData ? (
                // Loading state while checking for existing data
                <div className="flex flex-col items-center">
                  <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                    Welcome back,{" "}
                    <span className="text-blue-600">{user?.username || user?.firstName || 'there'}!</span>
                  </h1>
                  <div className="flex items-center space-x-3 text-gray-600 mb-8">
                    <ReloadIcon className="w-5 h-5 animate-spin" />
                    <span className="text-xl">Checking your account...</span>
                  </div>
                </div>
              ) : userAssessment ? (
                // User has existing assessment data
                <div>
                  <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                    Welcome back,{" "}
                    <span className="text-blue-600">
                      {userAssessment.first_name}!
                    </span>
                  </h1>
                  <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                    Great news! We found your business information for{" "}
                    <strong>{userAssessment.company}</strong>. You can continue
                    directly to connect your QuickBooks or start a new
                    assessment.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button
                      onClick={handleGetStarted}
                      className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors flex items-center"
                    >
                      Continue to QuickBooks{" "}
                      <ArrowRightIcon className="w-5 h-5 ml-2" />
                    </button>
                    <button
                      onClick={handleStartNewAssessment}
                      className="bg-gray-200 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Start New Assessment
                    </button>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-gray-600 mt-5">
                    <CheckCircledIcon className="w-5 h-5 text-green-500" />
                    <span>Secure • Fast • Ready to connect</span>
                  </div>
                </div>
              ) : (
                // New user - no existing assessment
                <div>
                  <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
                    Welcome,{" "}
                    <span className="text-blue-600">{user?.username || user?.firstName || 'there'}!</span>
                  </h1>
                  <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
                    Ready to assess your QuickBooks Online data? Let's start by
                    gathering some basic information about your business.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <button
                      onClick={handleGetStarted}
                      className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors flex items-center"
                    >
                      Start Assessment{" "}
                      <ArrowRightIcon className="w-5 h-5 ml-2" />
                    </button>
                  </div>
                  <div className="flex items-center justify-center space-x-2 text-gray-600 mt-5">
                    <CheckCircledIcon className="w-5 h-5 text-green-500" />
                    <span>Quick • Secure • Comprehensive</span>
                  </div>
                </div>
              )}
            </SignedIn>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Check Your Books' Health?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Uncover hidden issues in your financial data before they impact
              your business decisions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChartIcon className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Comprehensive Analysis
              </h3>
              <p className="text-gray-600">
                We analyze 5 key pillars: Bank matching, Money organization,
                Transaction categorization, Control accounts, and
                Customer/Vendor balances.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClockIcon className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Quick & Easy
              </h3>
              <p className="text-gray-600">
                Connect your QuickBooks Online account and get results in
                minutes. No complex setup or lengthy questionnaires required.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <GearIcon className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Actionable Insights
              </h3>
              <p className="text-gray-600">
                Get specific recommendations and step-by-step instructions to
                fix issues and improve your books' accuracy.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works - Only show to signed out users */}
      <SignedOut>
        <div className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                How It Works
              </h2>
              <p className="text-lg text-gray-600">
                Simple 4-step process to assess your books' health
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="relative">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mb-4">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Sign Up / Login
                  </h3>
                  <p className="text-gray-600">
                    Create your free account or sign in to access the assessment
                    portal.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mb-4">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Business Details
                  </h3>
                  <p className="text-gray-600">
                    Share basic information about your company and current
                    bookkeeping challenges.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mb-4">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Connect QuickBooks
                  </h3>
                  <p className="text-gray-600">
                    Securely connect your QBO account using OAuth 2.0. We only
                    access data needed for analysis.
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg mb-4">
                    4
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Get Results
                  </h3>
                  <p className="text-gray-600">
                    Receive a comprehensive report with your books' health score
                    and actionable recommendations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SignedOut>

      {/* Dashboard Section - Only show to signed in users */}
      {/* <SignedIn>
        <div className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Your Assessment Dashboard
              </h2>
              <p className="text-lg text-gray-600">
                Track your progress and manage your assessments
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-blue-500">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {userAssessment ? "Continue Assessment" : "New Assessment"}
                </h3>
                <p className="text-gray-600 mb-4">
                  {userAssessment
                    ? "Continue with your QuickBooks connection"
                    : "Start a fresh assessment for your QuickBooks data"}
                </p>
                <button
                  onClick={handleGetStarted}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                >
                  {userAssessment ? "Continue" : "Start Assessment"}
                </button>
              </div>

              {userAssessment && (
                <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-orange-500">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Start New Assessment
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Begin a fresh assessment with updated business information
                  </p>
                  <button
                    onClick={handleStartNewAssessment}
                    className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors"
                  >
                    New Assessment
                  </button>
                </div>
              )}

              <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-gray-300">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Assessment History
                </h3>
                <p className="text-gray-600 mb-4">
                  View your previous assessments and track improvements
                </p>
                <button
                  className="bg-gray-500 text-white px-4 py-2 rounded cursor-not-allowed"
                  disabled
                >
                  Coming Soon
                </button>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-green-500">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Account Settings
                </h3>
                <p className="text-gray-600 mb-4">
                  Manage your profile and connected accounts
                </p>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-8 h-8",
                      userButtonTrigger:
                        "bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors",
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </SignedIn> */}

      {/* Social Proof */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Trusted by Business Owners
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className="w-5 h-5 text-yellow-400 fill-current"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "Found 3 critical issues I didn't know existed. Fixed them in 2
                hours and now my reports are finally accurate!"
              </p>
              <p className="font-semibold text-gray-900">
                Sarah M., Retail Business
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className="w-5 h-5 text-yellow-400 fill-current"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "Super easy to use. Connected my QBO account and had results in
                3 minutes. The technical instructions were spot-on."
              </p>
              <p className="font-semibold text-gray-900">
                Mike R., Consulting Firm
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <StarIcon
                    key={i}
                    className="w-5 h-5 text-yellow-400 fill-current"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-4">
                "The sign-up process was seamless and the assessment saved me
                hours of manual checking."
              </p>
              <p className="font-semibold text-gray-900">
                Jennifer K., E-commerce
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Security & Trust */}
      <div className="bg-blue-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Your Data is Safe & Secure
            </h2>
            <div className="max-w-3xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                <div className="flex items-start">
                  <CheckCircledIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Secure Authentication
                    </h4>
                    <p className="text-gray-600">
                      Clerk-powered login with industry-standard security
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircledIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      OAuth 2.0 Authentication
                    </h4>
                    <p className="text-gray-600">
                      We never see your QuickBooks login credentials
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircledIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Read-Only Access
                    </h4>
                    <p className="text-gray-600">
                      We only read data, never modify anything
                    </p>
                  </div>
                </div>
                <div className="flex items-start">
                  <CheckCircledIcon className="w-6 h-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      Encrypted Connection
                    </h4>
                    <p className="text-gray-600">
                      All data transfer is encrypted with SSL
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <SignedOut>
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Check Your Books' Health?
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Join hundreds of business owners who've discovered and fixed
              critical issues in their financial records.
            </p>
            <button
              onClick={() => handleAuthAction('signup')}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors flex items-center mx-auto"
            >
              Start Your Free Assessment{" "}
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </button>
          </SignedOut>

          <SignedIn>
            <h2 className="text-3xl font-bold text-white mb-4">
              {userAssessment
                ? "Ready to Connect QuickBooks?"
                : "Ready for Your Assessment?"}
            </h2>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              {userAssessment
                ? "Continue with your QuickBooks connection to complete your books health check."
                : "Start your comprehensive books health check and get instant insights."}
            </p>
            <button
              onClick={handleGetStarted}
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition-colors flex items-center mx-auto"
            >
              {userAssessment ? "Connect QuickBooks" : "Start Assessment"}{" "}
              <ArrowRightIcon className="w-5 h-5 ml-2" />
            </button>
          </SignedIn>
        </div>
      </div>

      {/* EULA Modal */}
      <EulaModal
        isOpen={showEulaModal}
        onAgree={handleEulaAgree}
        onDisagree={handleEulaDisagree}
        onClose={handleEulaClose}
      />

      <Footer />
    </div>
  );
};

export default LandingPage;
