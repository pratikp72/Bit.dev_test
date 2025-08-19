import React from "react";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/clerk-react";
import { useEulaAwareAuth } from "../hooks/useEulaAwareAuth";
import EulaModal from "./EulaModal";

const Header: React.FC = () => {
  const { user } = useUser();
  const {
    showEulaModal,
    pendingAuthAction,
    handleAuthAction,
    handleEulaAgree,
    handleEulaDisagree,
    handleEulaClose,
  } = useEulaAwareAuth();

  return (
    <div className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center">
            <Link to="/" className="text-2xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              BookKeeper Pro
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <SignedOut>
              <button 
                onClick={() => handleAuthAction('signin')}
                className="text-gray-600 hover:text-gray-900"
              >
                Login
              </button>
              <button 
                onClick={() => handleAuthAction('signup')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign Up
              </button>
            </SignedOut>
            <SignedIn>
              <span className="text-gray-600">
                Welcome, {user?.username}!
              </span>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </div>
      
      {/* EULA Modal */}
      <EulaModal
        isOpen={showEulaModal}
        onAgree={handleEulaAgree}
        onDisagree={handleEulaDisagree}
        onClose={handleEulaClose}
      />
    </div>
  );
};

export default Header;