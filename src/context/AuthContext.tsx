import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { SplashScreen } from "@capacitor/splash-screen";
import { auth, db } from "../lib/firebase";
import { handleFirestoreError, OperationType } from "../lib/utils";
import { notificationService } from "../services/notificationService";

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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const path = `users/${uid}`;
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      let currentProfileData = null;

      if (userDoc.exists()) {
        currentProfileData = userDoc.data();
        setProfile(currentProfileData);
      } else {
        // Create initial profile if it doesn't exist
        const initialProfile = {
          uid: uid,
          email: auth.currentUser?.email || "",
          role: "user",
          createdAt: serverTimestamp(),
          showInsights: true,
          displayName: auth.currentUser?.displayName || "",
        };
        await setDoc(doc(db, "users", uid), initialProfile);
        currentProfileData = initialProfile;
        setProfile(initialProfile);
      }

      // HOUSEKEEPING: Sync any native tokens captured before login
      const pendingToken = localStorage.getItem("pending_native_token");
      if (pendingToken) {
        const { updateDoc } = await import("firebase/firestore");
        await updateDoc(doc(db, "users", uid), {
          fcmToken: pendingToken,
          tokenSource: "native_bridge_sync",
        }).catch(() => {}); // Silent fail for housekeeping
        localStorage.removeItem("pending_native_token");
      }
      return currentProfileData;
    } catch (error) {
      console.warn(
        "[AuthContext] Profile fetch failed, using minimal fallback:",
        error,
      );
      // Minimal fallback to prevent "buggy app screen"
      const fallback = {
        uid: uid,
        email: auth.currentUser?.email || "",
        role: "user",
        displayName: auth.currentUser?.displayName || "Member",
        isOffline: true,
      };
      if (!profile) {
        setProfile(fallback);
      }
      return fallback;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;
    let backButtonListener: any = null;
    let lastTimeBackPress = 0;

    const init = async () => {
      // 1. Background Firebase setup - no longer blocking the whole flow
      import("../lib/firebase").then(({ initializeFirebaseConnection }) => {
        initializeFirebaseConnection().catch(() => {});
      });

      // 2. Set up Auth Listener
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!isMounted) return;

        try {
          setUser(user);
          if (user) {
            // Priority: Speed. Check if we have minimal cached data to show immediately
            const cachedProfile = localStorage.getItem(
              `profile_cache_${user.uid}`,
            );
            if (cachedProfile && !profile) {
              try {
                setProfile(JSON.parse(cachedProfile));
              } catch (e) {}
            }

            // Sync logic: Only force server if we truly haven't seen this user before
            const isProfileSynced = localStorage.getItem(
              `profile_synced_${user.uid}`,
            );

            if (!isProfileSynced) {
              console.log("[AuthContext] New user sync...");
              const { getDocFromServer } = await import("firebase/firestore");
              const docSnap = await getDocFromServer(
                doc(db, "users", user.uid),
              ).catch(() => null);
              if (docSnap?.exists()) {
                const data = docSnap.data();
                setProfile(data);
                localStorage.setItem(
                  `profile_cache_${user.uid}`,
                  JSON.stringify(data),
                );
                localStorage.setItem(`profile_synced_${user.uid}`, "true");
              } else {
                await fetchProfile(user.uid);
              }
            } else {
              // Background refresh - don't block UI if cache exists
              fetchProfile(user.uid)
                .then((data) => {
                  if (user && data)
                    localStorage.setItem(
                      `profile_cache_${user.uid}`,
                      JSON.stringify(data),
                    );
                })
                .catch(() => {});
            }

            // Clean up: Check expirations non-blocking
            notificationService
              .checkDeviceExpirations(user.uid)
              .catch(() => {});
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error("Auth sync error:", error);
        } finally {
          if (isMounted) {
            setLoading(false);

            // Consistently hide the splash screen so native edge-to-edge UI stabilizes the same way on cold and warm starts
            setTimeout(async () => {
              SplashScreen.hide()
                .then(() => {
                  // Force webview size recalculation on first launch after splash screen hides
                  setTimeout(
                    () => window.dispatchEvent(new Event("resize")),
                    100,
                  );
                })
                .catch(() => {});
            }, 100);
          }
        }
      });

      // 2. Register Back Button Listener (Double back to exit)
      const { App } = await import("@capacitor/app");
      const { Toast } = await import("@capacitor/toast");

      backButtonListener = await App.addListener(
        "backButton",
        ({ canGoBack }) => {
          const path = window.location.pathname;
          const isRootPage =
            path === "/" || path === "/login" || path === "/dashboard";

          if (!canGoBack || isRootPage) {
            const currentTime = new Date().getTime();
            if (currentTime - lastTimeBackPress < 2000) {
              App.exitApp();
            } else {
              lastTimeBackPress = currentTime;
              Toast.show({ text: "Press back again to exit" }).catch(() => {});
            }
          } else {
            window.history.back();
          }
        },
      );
    };

    init();

    const handleFcmToken = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const token = customEvent.detail;
      if (auth.currentUser) {
        const { updateDoc } = await import("firebase/firestore");
        try {
          await updateDoc(doc(db, "users", auth.currentUser.uid), {
            fcmToken: token,
            tokenSource: "native_bridge_sync_event",
          });
          localStorage.removeItem("pending_native_token");
        } catch (error) {
          console.error("[AuthContext] Failed to save token on event:", error);
        }
      }
    };

    window.addEventListener("fcm_token_ready", handleFcmToken);

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
      if (backButtonListener) backButtonListener.remove();
      window.removeEventListener("fcm_token_ready", handleFcmToken);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === "admin",
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
