import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ClerkProvider } from "@clerk/clerk-react";
import { UserSyncWrapper } from "./supabase/hooks/UserSyncWrapper";

// Import your Publishable Key with proper error handling
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Enhanced error handling for missing environment variables
if (!PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
  console.error(
    "Available environment variables:",
    Object.keys(import.meta.env),
  );

  // Show user-friendly error in development
  if (import.meta.env.DEV) {
    document.getElementById("root")!.innerHTML = `
      <div style="padding: 20px; background: #fee; color: #c00; font-family: Arial;">
        <h3>Configuration Error</h3>
        <p>Missing VITE_CLERK_PUBLISHABLE_KEY environment variable.</p>
        <p>Please check your .env file and ensure all required variables are set.</p>
      </div>
    `;
    throw new Error("Add your Clerk Publishable Key to the .env file");
  }

  // In production, use a fallback or show error page
  throw new Error("Application configuration error");
}

// Get the root element with error handling
const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <UserSyncWrapper>
        <App />
      </UserSyncWrapper>
    </ClerkProvider>
  </StrictMode>,
);
