import React from 'react'
import { useUserSync } from './useUserSync'

interface UserSyncWrapperProps {
  children: React.ReactNode
}

export const UserSyncWrapper: React.FC<UserSyncWrapperProps> = ({ children }) => {
  useUserSync()
  return <>{children}</>
}
