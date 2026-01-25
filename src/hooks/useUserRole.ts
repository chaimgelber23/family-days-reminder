'use client';

import { useMemo } from 'react';
import { doc } from 'firebase/firestore';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import type { AppUser } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

const HARDCODED_ADMIN_UIDS = new Set([
  'TDH1R5QHqANIyPqyFM4nqKHs4xO2',
  'EQ9hokffU8OL6woznTD5iDIgvkH2',
  'VoGim24n4xX0gis2VziqHtNE4nR2', // office@vaadmishmeresstam.org
  '7QrBTfO30RTXRLjBAiimOg79JF62', // chaimtgelber@gmail.com
]);

export function useUserRole() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: userData, isLoading: isRoleLoading, error } = useDoc<AppUser>(userDocRef);

  useMemo(() => {
      if(error){
        toast({ 
          variant: 'destructive', 
          title: 'Permission Error', 
          description: 'Could not load user permissions.' 
        });
      }
  }, [error, toast]);


  const roleData = useMemo(() => {
    const isHardcodedAdmin = user ? HARDCODED_ADMIN_UIDS.has(user.uid) : false;
    const isAdminFromDb = userData?.role === 'admin';
    const isAdmin = isHardcodedAdmin || isAdminFromDb;

    return {
      user, // The original Firebase user object
      userData, // The user profile from Firestore
      isLoading: isAuthLoading || isRoleLoading,
      role: isAdmin ? 'admin' : userData?.role,
      isAdmin,
      isUser: userData?.role === 'user',
    }
  }, [user, userData, isAuthLoading, isRoleLoading]);

  return roleData;
}
