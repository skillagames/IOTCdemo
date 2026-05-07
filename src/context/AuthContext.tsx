import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { SplashScreen } from '@capacitor/splash-screen';
import LoadingScreen from '../components/LoadingScreen';
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
  const [isInitialized, setIsInitialized] = useState(false);

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
    const startInitialization = async () => {
      const startTime = Date.now();
      const isFirstLaunch = !localStorage.getItem('app_initialized_v2');
      const MIN_INIT_TIME = isFirstLaunch ? 4000 : 500; // 4s for first launch, 0.5s otherwise

      // Use a promise to track the first auth state emission
      const authPromise = new Promise<{ user: User | null }>((resolve) => {
        const unsub = onAuthStateChanged(auth, (user) => {
          unsub(); // Only need the first emission
          resolve({ user });
        });
      });

      // Attempt a network handshake to "prime" the connection ONLY on first launch
      let networkHandshakePromise = Promise.resolve(null);
      if (isFirstLaunch) {
        const { getDocFromServer, doc } = await import('firebase/firestore');
        networkHandshakePromise = getDocFromServer(doc(db, '_internal_', 'warmup')).catch(() => {
          return null;
        });
      }

      try {
        // Wait for both the auth state and at least a network attempt (only on first launch)
        const [{ user }] = await Promise.all([authPromise, networkHandshakePromise]);
        
        setUser(user);
        if (user) {
          await fetchProfile(user.uid);
          notificationService.checkDeviceExpirations(user.uid);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Initialization error:", error);
      } finally {
        // Ensure we've waited at least MIN_INIT_TIME
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime < MIN_INIT_TIME) {
          await new Promise(resolve => setTimeout(resolve, MIN_INIT_TIME - elapsedTime));
        }

        if (isFirstLaunch) {
          localStorage.setItem('app_initialized_v2', 'true');
        }

        setLoading(false);
        setIsInitialized(true);
        (window as any).__AUTH_INITIALIZED__ = true;
        
        // Remove the static pre-loader from index.html
        const preLoader = document.getElementById('app-pre-loader');
        if (preLoader) {
          preLoader.style.transition = 'opacity 0.5s ease';
          preLoader.style.opacity = '0';
          setTimeout(() => preLoader.remove(), 500);
        }
        
        // Wait another 300ms to ensure React rendering batch completes and paints
        setTimeout(async () => {
          try {
            await SplashScreen.hide();
          } catch (e) {
            console.warn('Failed to hide splash screen', e);
          }
        }, 300);
      }
    };

    const handleFcmToken = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const token = customEvent.detail;
      if (auth.currentUser) {
        const { updateDoc, doc } = await import('firebase/firestore');
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
    
    // Start the robust initialization
    startInitialization();

    // Still use a long-lived listener for state changes throughout the session
    const unsubscribe = onAuthStateChanged(auth, async (newUser) => {
      // Use ref-like check or just wait for the first init to complete
      if (typeof window !== 'undefined' && (window as any).__AUTH_INITIALIZED__) {
        setUser(newUser);
        if (newUser) {
          await fetchProfile(newUser.uid);
        } else {
          setProfile(null);
        }
      }
    });

    return () => {
      unsubscribe();
      window.removeEventListener('fcm_token_ready', handleFcmToken);
    };
  }, []); // Empty dependency array to run only once

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      isAdmin: profile?.role === 'admin',
      refreshProfile 
    }}>
      {!isInitialized ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
