import React, { createContext, useContext, useMemo } from 'react';
import { QBOApiService } from './qboApiService';
import logger from '../lib/logger';

interface QBOServiceContextType {
  qboService: QBOApiService | null;
  error: string | null;
}

const QBOServiceContext = createContext<QBOServiceContextType>({
  qboService: null,
  error: null
});

export const QBOServiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo(() => {
    try {
      logger.debug('Creating QBO service instance...');
      const qboService = new QBOApiService();
      logger.info('QBO service created successfully');
      return { qboService, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to initialize QBO service';
      logger.error('Failed to create QBO service:', errorMessage);
      return {
        qboService: null,
        error: errorMessage
      };
    }
  }, []);

  return (
    <QBOServiceContext.Provider value={value}>
      {children}
    </QBOServiceContext.Provider>
  );
};

export const useQBOService = () => {
  const context = useContext(QBOServiceContext);
  if (context === undefined) {
    throw new Error('useQBOService must be used within a QBOServiceProvider');
  }
  return context;
};

export default QBOServiceContext;
