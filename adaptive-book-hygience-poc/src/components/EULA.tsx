import React from "react";
import Header from "./Header";
import Footer from "./Footer";
import EulaContent from "./EulaContent";

const EULA: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow-lg rounded-lg p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">End User License Agreement (EULA)</h1>
            
            <EulaContent headingLevel="h2" />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default EULA;