import React from "react";
import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <div className="bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center text-gray-400">
          <div className="flex justify-center space-x-6 mb-4">
            <Link 
              to="/privacy" 
              className="hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              to="/eula" 
              className="hover:text-white transition-colors"
            >
              EULA
            </Link>
          </div>
          <p>&copy; 2024 BookKeeper Pro. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
};

export default Footer;