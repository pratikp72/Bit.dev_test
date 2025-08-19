import React from "react";
import { SignUp } from "@clerk/clerk-react";
import Header from "./Header";
import Footer from "./Footer";

const SignUpPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900">
              Create Your Account
            </h2>
            <p className="mt-2 text-gray-600">
              Sign up to start your free QuickBooks health assessment
            </p>
          </div>
          
          <SignUp 
            fallbackRedirectUrl="/dashboard"
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-xl",
              },
            }}
          />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default SignUpPage;