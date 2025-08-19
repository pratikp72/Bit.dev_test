import { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { supabase } from '../../lib/supabaseConnect';

interface UserData {
  clerk_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export const useUserSync = () => {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    const syncUserToSupabase = async () => {
      if (!isLoaded || !user) {
        return;
      }

      const email = user.primaryEmailAddress?.emailAddress;
      if (!email) {
        console.warn('User is missing a primary email address. Skipping sync.');
        return;
      }

      const userData = {
        clerk_id: user.id,
        email: email,
        first_name: user.firstName || '',
        last_name: user.lastName || '',
        profile_image_url: user.imageUrl || '',
        updated_at: new Date().toISOString(),
      };

      try {
        const { error } = await supabase
          .from('users')
          .upsert([{ 
            ...userData, 
            created_at: new Date().toISOString() 
          }], {
            onConflict: 'clerk_id',
            ignoreDuplicates: false
          });

        if (error) {
          console.error('Error syncing user to Supabase:', error);
        }
      } catch (error) {
        console.error('Unexpected error during user sync:', error);
      }
    };

    syncUserToSupabase();
  }, [user, isLoaded]);
};