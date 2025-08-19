import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { supabase } from "../lib/supabaseConnect";
import logger from "../lib/logger";

interface UserAssessment {
  id: string;
  clerk_id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string;
  business_type: string;
  phone?: string;
  monthly_revenue?: string;
  current_software?: string;
  bookkeeping_challenges?: string;
  urgency_level?: string;
  created_at: string;
}

export const useUserAssessment = () => {
  const { user, isLoaded } = useUser();
  const [userAssessment, setUserAssessment] = useState<UserAssessment | null>(
    null,
  );
  const [isCheckingData, setIsCheckingData] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const checkExistingAssessment = async () => {
      if (!isLoaded || !user?.id) {
        return;
      }

      setIsCheckingData(true);
      logger.group("Checking for existing user registration data by clerk_id");

      try {
        // Check by clerk_id first (most reliable)
        logger.debug("Checking for clerk_id:", user.id);

        const { data, error } = await supabase
          .from("registration_data")
          .select("*")
          .eq("clerk_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          logger.error("Error checking user registration data:", error);
          setError(error);
          return;
        }

        if (data && data.length > 0) {
          logger.info(
            "Found existing user registration data by clerk_id:",
            data[0],
          );
          setUserAssessment(data[0]);
        } else {
          // Fallback: check by email if no clerk_id match found
          const userEmail = user.emailAddresses?.[0]?.emailAddress;
          if (userEmail) {
            logger.debug(
              "No registration data found by clerk_id, checking by email:",
              userEmail,
            );

            const { data: emailData, error: emailError } = await supabase
              .from("registration_data")
              .select("*")
              .eq("email", userEmail)
              .order("created_at", { ascending: false })
              .limit(1);

            if (!emailError && emailData && emailData.length > 0) {
              logger.info(
                "Found existing registration data by email, updating with clerk_id",
              );

              // Update the record with the clerk_id for future lookups
              const { error: updateError } = await supabase
                .from("registration_data")
                .update({ clerk_id: user.id })
                .eq("id", emailData[0].id);

              if (!updateError) {
                setUserAssessment({ ...emailData[0], clerk_id: user.id });
              } else {
                logger.error("Error updating clerk_id:", updateError);
                setUserAssessment(emailData[0]);
              }
            } else {
              logger.debug("No existing registration data found for user");
            }
          }
        }
      } catch (error) {
        logger.error("Error in checkExistingAssessment:", error);
        setError(error as Error);
      } finally {
        setIsCheckingData(false);
        logger.groupEnd();
      }
    };

    checkExistingAssessment();
  }, [user, isLoaded]);

  return { userAssessment, isCheckingData, error };
};
