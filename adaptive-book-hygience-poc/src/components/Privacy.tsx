import React from "react";
import Header from "./Header";
import Footer from "./Footer";

const Privacy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy for AI Agents</h1>
          
          <div className="space-y-6 text-gray-700">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Information Collection and Processing</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Data We Collect</h3>
              <p>
                <strong>Financial Information:</strong> Our AI agents extract and process financial data from your organization's systems solely for the purpose of completing requested tasks. This includes:
                <ul className="list-disc pl-5 mt-2">
                  <li>Account statements and transaction records</li>
                  <li>Tax preparation documents and supporting materials</li>
                  <li>Financial reports and analytical data</li>
                  <li>Client financial information (for CPA firms)</li>
                  <li>Banking and payment processing data</li>
                </ul>
              </p>
              <p>
                <strong>Usage Information:</strong> We may collect minimal metadata necessary for system functionality:
                <ul className="list-disc pl-5 mt-2">
                  <li>Session timestamps and duration</li>
                  <li>Feature utilization patterns (aggregated and anonymized)</li>
                  <li>Error logs and system performance metrics</li>
                  <li>Authentication and access control records</li>
                </ul>
              </p>
              <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">Data Collection Principles</h3>
              <p>
                Our AI agents operate under strict data minimization principles:
                <ul className="list-disc pl-5 mt-2">
                  <li><strong>Purpose Limitation:</strong> Data is accessed only for the specific task requested</li>
                  <li><strong>Minimal Access:</strong> Agents request only the minimum data required to complete the task</li>
                  <li><strong>Real-Time Processing:</strong> Information is processed in-memory during active sessions</li>
                  <li><strong>No Permanent Storage:</strong> Financial data is never stored in persistent databases</li>
                </ul>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Zero Data Retention (ZDR) Policy</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Core ZDR Implementation</h3>
              <p>
                Upon session termination, all extracted financial information is immediately and permanently deleted from our systems. This includes:
                <ul className="list-disc pl-5 mt-2">
                  <li>Complete removal of all financial data from temporary memory</li>
                  <li>Deletion of processed outputs containing sensitive information</li>
                  <li>Clearing of any cached or temporary files</li>
                  <li>Purging of conversation history containing financial details</li>
                </ul>
                Security and protection of any data or report downloaded by the user from the AI agent is the responsibility of the user.
              </p>
              <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">Technical Safeguards</h3>
              <p>
                <ul className="list-disc pl-5 mt-2">
                  <li><strong>Ephemeral Processing Architecture:</strong> All sensitive data processing occurs in temporary, encrypted memory spaces</li>
                  <li><strong>Automated Deletion Protocols:</strong> System-enforced deletion routines execute immediately upon session termination</li>
                  <li><strong>Verifiable Non-Retention:</strong> Technical controls prevent any permanent storage of financial data</li>
                  <li><strong>Audit Trail:</strong> Deletion events are logged for compliance verification (metadata only, no financial content)</li>
                </ul>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Third-Party LLM Provider Compliance</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Provider Data Handling</h3>
              <p>
                <ul className="list-disc pl-5 mt-2">
                  <li>Enterprise-grade SOC 2 Type II compliance</li>
                  <li>Seven-day file retention with automatic deletion</li>
                  <li>No use of client data for model training</li>
                </ul>
              </p>
              <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">LLM Integration</h3>
              <p>
                <ul className="list-disc pl-5 mt-2">
                  <li>Standard 30-day backend deletion for API users</li>
                  <li>Zero Data Retention (ZDR) agreements available</li>
                </ul>
              </p>
              <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">Model Training Restrictions</h3>
              <p>
                We contractually ensure that:
                <ul className="list-disc pl-5 mt-2">
                  <li>No client financial data is used for training AI models</li>
                  <li>Third-party providers maintain equivalent data protection standards</li>
                </ul>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Security Measures</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Technical Safeguards</h3>
              <p>
                <strong>Data Encryption:</strong>
                <ul className="list-disc pl-5 mt-2">
                  <li>AES-256 encryption for all data in transit and at rest</li>
                  <li>End-to-end encryption for sensitive financial communications</li>
                  <li>Encrypted secure channels for all AI agent interactions</li>
                </ul>
              </p>
              <p>
                <strong>Access Controls:</strong>
                <ul className="list-disc pl-5 mt-2">
                  <li>Multi-factor authentication for all system access</li>
                  <li>Role-based access controls with principle of least privilege</li>
                  <li>Session monitoring and automatic timeout protocols</li>
                  <li>Privileged access management (PAM) systems</li>
                </ul>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Subject Rights and Controls</h2>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Individual Rights</h3>
              <p>
                <strong>Access and Transparency:</strong>
                <ul className="list-disc pl-5 mt-2">
                  <li>Right to know what financial information is required by the AI agent</li>
                  <li>Clear explanations of AI agent decision-making processes</li>
                </ul>
              </p>
              <h3 className="text-lg font-medium text-gray-900 mb-2 mt-4">Control Mechanisms</h3>
              <p>
                <ul className="list-disc pl-5 mt-2">
                  <li>Session termination controls to trigger immediate data deletion</li>
                  <li>Granular permissions for data access by AI agents</li>
                </ul>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Policy Updates and Modifications</h2>
              <p>
                Effective Date: August 15th, 2025<br />
                Last Updated: August 15th, 2025
              </p>
            </section>
          </div>
        </div>
      </div>
      </div>

      <Footer />
    </div>
  );
};

export default Privacy;