import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { notificationService } from '../services/notificationService';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  refreshProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const path = `users/${uid}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      let currentProfileData = null;

      if (userDoc.exists()) {
        currentProfileData = userDoc.data();
        setProfile(currentProfileData);
      } else {
        // Create initial profile if it doesn't exist
        const initialProfile = {
          uid: uid,
          email: auth.currentUser?.email || '',
          role: 'user',
          createdAt: serverTimestamp(),
          showInsights: true,
        };
        await setDoc(doc(db, 'users', uid), initialProfile);
        currentProfileData = initialProfile;
        setProfile(initialProfile);
      }

      // HOUSEKEEPING: Sync any native tokens captured before login
      const pendingToken = localStorage.getItem('pending_native_token');
      if (pendingToken) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'users', uid), { 
          fcmToken: pendingToken,
          tokenSource: 'native_bridge_sync'
        });
        localStorage.removeItem('pending_native_token');
        console.log('[AuthContext] Synced pending native token to user profile.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    const handleFcmToken = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const token = customEvent.detail;
      if (auth.currentUser) {
        const { updateDoc } = await import('firebase/firestore');
        try {
          await updateDoc(doc(db, 'users', auth.currentUser.uid), { 
            fcmToken: token,
            tokenSource: 'native_bridge_sync_event'
          });
          localStorage.removeItem('pending_native_token');
        } catch (error) {
          console.error('[AuthContext] Failed to save token on event:', error);
        }
      }
    };
    
    window.addEventListener('fcm_token_ready', handleFcmToken);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setUser(user);
        if (user) {
          await fetchProfile(user.uid);
          notificationService.checkDeviceExpirations(user.uid);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error synchronizing profile:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('fcm_token_ready', handleFcmToken);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin: profile?.role === 'admin',
      refreshProfile 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
