import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileTextIcon,
  PersonIcon,
  HomeIcon,
  ArrowRightIcon,
} from "@radix-ui/react-icons";
import { useUser } from "@clerk/clerk-react";
import { FormData } from "../App";
import { supabase } from "../lib/supabaseConnect";
import logger from "../lib/logger";

interface AgentFormProps {
  formData: FormData;
  handleInputChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
}

const AgentForm: React.FC<AgentFormProps> = ({
  formData,
  handleInputChange,
}) => {
  const navigate = useNavigate();
  const { user } = useUser();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSupabaseSubmit = async (
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Validate user is authenticated
      if (!user?.id) {
        throw new Error(
          "User not authenticated. Please sign in and try again.",
        );
      }

      // Validate required fields
      const requiredFields = [
        "firstName",
        "lastName",
        "email",
        "company",
        "businessType",
      ];
      const missingFields = requiredFields.filter(
        (field) => !formData[field as keyof FormData],
      );

      if (missingFields.length > 0) {
        throw new Error(
          `Please fill in all required fields: ${missingFields.join(", ")}`,
        );
      }

      logger.info("Saving registration data for user:", user.id);

      // Upsert data into Supabase (insert or update if exists)
      const { data, error } = await supabase
        .from("registration_data")
        .upsert(
          [
            {
              clerk_id: user.id, // Include clerk_id from Clerk
              first_name: formData.firstName,
              last_name: formData.lastName,
              email: formData.email,
              phone: formData.phone || null,
              company: formData.company,
              business_type: formData.businessType,
              monthly_revenue: formData.monthlyRevenue || null,
              current_software: formData.currentSoftware || null,
              bookkeeping_challenges: formData.bookkeepingChallenges || null,
              urgency_level: formData.urgencyLevel || null,
              updated_at: new Date().toISOString(),
            },
          ],
          {
            onConflict: "clerk_id", // Update if clerk_id already exists
            ignoreDuplicates: false,
          },
        )
        .select();

      if (error) {
        throw error;
      }

      logger.info("Registration data successfully saved:", data);

      // Navigate to QBO Auth page
      navigate("/qbo-auth");
    } catch (error) {
      logger.error("Error saving to Supabase:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "An error occurred while saving your information",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Financial Books Assessment
            </h1>
            <button
              onClick={() => navigate("/")}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Let's Get Started
            </h2>
            <p className="text-lg text-gray-600">
              Help us understand your business so we can provide the most
              relevant assessment and recommendations.
            </p>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 text-sm">{submitError}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Personal Information */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <PersonIcon className="w-5 h-5 mr-2" />
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="border-b pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <HomeIcon className="w-5 h-5 mr-2" />
                Business Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Business Type *
                  </label>
                  <select
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select business type</option>
                    <option value="retail">Retail</option>
                    <option value="services">Services</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="restaurant">Restaurant/Food Service</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="consulting">Consulting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Revenue Range
                  </label>
                  <select
                    name="monthlyRevenue"
                    value={formData.monthlyRevenue}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select range</option>
                    <option value="under-10k">Under $10,000</option>
                    <option value="10k-50k">$10,000 - $50,000</option>
                    <option value="50k-100k">$50,000 - $100,000</option>
                    <option value="100k-500k">$100,000 - $500,000</option>
                    <option value="over-500k">Over $500,000</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Accounting Software
                  </label>
                  <select
                    name="currentSoftware"
                    value={formData.currentSoftware}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select software</option>
                    <option value="quickbooks-online">QuickBooks Online</option>
                    <option value="quickbooks-desktop">
                      QuickBooks Desktop
                    </option>
                    <option value="xero">Xero</option>
                    <option value="excel">Excel/Spreadsheets</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Assessment Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileTextIcon className="w-5 h-5 mr-2" />
                Assessment Details
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What are your biggest bookkeeping challenges?
                  </label>
                  <textarea
                    name="bookkeepingChallenges"
                    value={formData.bookkeepingChallenges}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Reconciling bank accounts, categorizing transactions, managing inventory..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    How urgent is this assessment?
                  </label>
                  <select
                    name="urgencyLevel"
                    value={formData.urgencyLevel}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select urgency level</option>
                    <option value="immediate">
                      Immediate - Need results within 24 hours
                    </option>
                    <option value="this-week">
                      This week - Planning for upcoming decisions
                    </option>
                    <option value="this-month">
                      This month - General health check
                    </option>
                    <option value="planning">
                      Planning - Future consideration
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6">
              <button
                type="button"
                onClick={handleSupabaseSubmit}
                disabled={isSubmitting}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    Continue to Assessment{" "}
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
              <p className="text-sm text-gray-600 mt-2 text-center">
                This information helps us provide more accurate recommendations
                tailored to your business.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentForm;
