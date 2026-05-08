import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { SplashScreen } from '@capacitor/splash-screen';
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
    let isMounted = true;
    let unsubscribe: any = null;
    let backButtonListener: any = null;
    let lastTimeBackPress = 0;

    const init = async () => {
      // 1. Set up Auth Listener
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;
        
        try {
          setUser(user);
          if (user) {
            // Force server fetch on first launch recorded in local storage
            const isProfileSynced = localStorage.getItem(`profile_synced_${user.uid}`);
            if (!isProfileSynced) {
              const { getDocFromServer } = await import('firebase/firestore');
              const docSnap = await getDocFromServer(doc(db, 'users', user.uid)).catch(() => null);
              if (docSnap?.exists()) {
                setProfile(docSnap.data());
                localStorage.setItem(`profile_synced_${user.uid}`, 'true');
              } else {
                await fetchProfile(user.uid);
              }
            } else {
              await fetchProfile(user.uid);
            }
            notificationService.checkDeviceExpirations(user.uid);
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error("Error synchronizing profile:", error);
        } finally {
          if (isMounted) {
            setLoading(false);
            // Hide native splash screen ONLY after a short delay to ensure React UI is painted
            // We use a slightly longer delay here because this is the final hurdle
            setTimeout(() => {
              SplashScreen.hide().catch(e => console.warn('Failed to hide splash screen', e));
            }, 300);
          }
        }
      });

      // 2. Register Back Button Listener (Double back to exit)
      const { App } = await import('@capacitor/app');
      backButtonListener = await App.addListener('backButton', ({ canGoBack }) => {
        const path = window.location.pathname;
        const isRootPage = path === '/' || path === '/login' || path === '/dashboard';
        
        if (!canGoBack || isRootPage) {
          const currentTime = new Date().getTime();
          if (currentTime - lastTimeBackPress < 2000) {
            App.exitApp();
          } else {
            lastTimeBackPress = currentTime;
            // Optionally triggering a native toast if possible
            console.log('Press back again to exit');
          }
        } else {
          window.history.back();
        }
      });
    };

    init();

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

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
      if (backButtonListener) backButtonListener.remove();
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
