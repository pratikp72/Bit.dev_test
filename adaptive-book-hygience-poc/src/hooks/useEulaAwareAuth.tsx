import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { EulaStorage } from '../utils/eulaStorage';

export type AuthAction = 'signin' | 'signup';

export const useEulaAwareAuth = () => {
  const navigate = useNavigate();
  const [showEulaModal, setShowEulaModal] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<AuthAction | null>(null);

  const handleAuthAction = useCallback((action: AuthAction) => {
    // Check if EULA is already accepted
    if (EulaStorage.hasAcceptedCurrentEula()) {
      // EULA already accepted, navigate directly to auth page
      navigate(action === 'signup' ? '/signup' : '/signin');
      return;
    }

    // EULA not accepted, show modal first
    setPendingAuthAction(action);
    setShowEulaModal(true);
  }, [navigate]);

  const handleEulaAgree = useCallback(() => {
    // Mark EULA as accepted
    EulaStorage.markEulaAccepted();
    
    // Close modal
    setShowEulaModal(false);
    
    // Navigate to the appropriate auth page
    if (pendingAuthAction) {
      navigate(pendingAuthAction === 'signup' ? '/signup' : '/signin');
    }
    
    // Reset state
    setPendingAuthAction(null);
  }, [navigate, pendingAuthAction]);

  const handleEulaDisagree = useCallback(() => {
    // Clear any EULA acceptance (in case it was previously accepted)
    EulaStorage.clearEulaAcceptance();
    
    // Close modal without proceeding with authentication
    setShowEulaModal(false);
    
    // Reset state
    setPendingAuthAction(null);
  }, []);

  const handleEulaClose = useCallback(() => {
    // Just close modal without any action
    setShowEulaModal(false);
    
    // Reset state
    setPendingAuthAction(null);
  }, []);

  return {
    showEulaModal,
    pendingAuthAction,
    handleAuthAction,
    handleEulaAgree,
    handleEulaDisagree,
    handleEulaClose,
  };
};