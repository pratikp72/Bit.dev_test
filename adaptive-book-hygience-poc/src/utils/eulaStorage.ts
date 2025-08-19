export const EULA_ACCEPTANCE_KEY = 'eula_accepted';
export const EULA_VERSION_KEY = 'eula_version';

// Current EULA version - increment this when EULA content changes
export const CURRENT_EULA_VERSION = '1.0.0';

export class EulaStorage {
  /**
   * Check if user has accepted the current version of EULA
   */
  static hasAcceptedCurrentEula(): boolean {
    try {
      const accepted = localStorage.getItem(EULA_ACCEPTANCE_KEY);
      const acceptedVersion = localStorage.getItem(EULA_VERSION_KEY);
      
      return accepted === 'true' && acceptedVersion === CURRENT_EULA_VERSION;
    } catch (error) {
      console.warn('Error reading EULA acceptance from localStorage:', error);
      return false;
    }
  }

  /**
   * Mark EULA as accepted for current version
   */
  static markEulaAccepted(): void {
    try {
      localStorage.setItem(EULA_ACCEPTANCE_KEY, 'true');
      localStorage.setItem(EULA_VERSION_KEY, CURRENT_EULA_VERSION);
    } catch (error) {
      console.error('Error saving EULA acceptance to localStorage:', error);
    }
  }

  /**
   * Clear EULA acceptance (for testing or when user disagrees)
   */
  static clearEulaAcceptance(): void {
    try {
      localStorage.removeItem(EULA_ACCEPTANCE_KEY);
      localStorage.removeItem(EULA_VERSION_KEY);
    } catch (error) {
      console.error('Error clearing EULA acceptance from localStorage:', error);
    }
  }

  /**
   * Get the accepted EULA version
   */
  static getAcceptedVersion(): string | null {
    try {
      return localStorage.getItem(EULA_VERSION_KEY);
    } catch (error) {
      console.warn('Error reading EULA version from localStorage:', error);
      return null;
    }
  }

  /**
   * Force clear EULA for testing (adds to window for debugging)
   */
  static forceResetForTesting(): void {
    try {
      localStorage.removeItem(EULA_ACCEPTANCE_KEY);
      localStorage.removeItem(EULA_VERSION_KEY);
      console.log('EULA acceptance cleared for testing');
    } catch (error) {
      console.error('Error clearing EULA for testing:', error);
    }
  }
}

// Add to window for debugging purposes
if (typeof window !== 'undefined') {
  (window as any).clearEULA = EulaStorage.forceResetForTesting;
}