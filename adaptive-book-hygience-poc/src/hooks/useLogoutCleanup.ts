import { useEffect, useRef } from 'react';
import { useUser } from '@clerk/clerk-react';
import { QBOTokenService } from '../services/qboTokenService';
import { AssessmentStorageService } from '../services/assessmentStorageService';
import logger from '../lib/logger';

/**
 * Hook to handle cleanup when user logs out
 * Clears QBO tokens and assessment data from storage
 */
export const useLogoutCleanup = () => {
  const { isSignedIn, user, isLoaded } = useUser();
  const previousStateRef = useRef<{
    isSignedIn: boolean | undefined;
    userId: string | undefined;
  }>({
    isSignedIn: undefined,
    userId: undefined
  });

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const previous = previousStateRef.current;
    const current = {
      isSignedIn,
      userId: user?.id
    };

    // Handle logout detection - user was signed in but now is not
    if (previous.isSignedIn === true && current.isSignedIn === false && previous.userId) {
      handleLogout(previous.userId);
    }

    // Update the previous state for next comparison
    previousStateRef.current = current;
    
  }, [isSignedIn, user?.id, isLoaded]);

  const handleLogout = async (userId: string) => {
    try {
      logger.info('User logout detected, cleaning up QBO data', { userId });
      
      // Clear QBO tokens from Supabase
      await QBOTokenService.clearUserData(userId);
      
      // Clear assessment data from sessionStorage
      AssessmentStorageService.cleanup();
      
      // Clear any other cached data if needed
      
      logger.info('Logout cleanup completed successfully');
    } catch (error) {
      logger.error('Error during logout cleanup', error);
    }
  };
};