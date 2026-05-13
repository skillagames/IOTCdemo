import React, { useEffect, ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import DeviceDetails from "./pages/DeviceDetails";
import Scanner from "./pages/Scanner";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import Alerts from "./pages/Alerts";
import { motion, AnimatePresence } from "motion/react";
import { notificationService } from "./services/notificationService";
import { SyncScreen } from "./components/SyncScreen";

// Protected Route Component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

// Admin Route Component
const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin } = useAuth();

  if (!user || !isAdmin) return <Navigate to="/" />;
  return <>{children}</>;
};

const PageTransition = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

// Scroll to top on route change component
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppContent = () => {
  const { loading } = useAuth();

  if (loading) return <SyncScreen />;

  return (
    <div className="min-h-dvh bg-bg-main font-sans text-slate-800">
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <PageTransition>
                  <Dashboard />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/devices/:id"
          element={
            <ProtectedRoute>
              <Layout showBack>
                <PageTransition>
                  <DeviceDetails />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/devices"
          element={
            <ProtectedRoute>
              <Layout showBack>
                <PageTransition>
                  <Devices />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/scan"
          element={
            <ProtectedRoute>
              <Layout showBack>
                <PageTransition>
                  <Scanner />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Layout showBack>
                <PageTransition>
                  <Admin />
                </PageTransition>
              </Layout>
            </AdminRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Layout>
                <PageTransition>
                  <Profile />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/alerts"
          element={
            <ProtectedRoute>
              <Layout showBack>
                <PageTransition>
                  <Alerts />
                </PageTransition>
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
};

export default function App() {
  useEffect(() => {
    notificationService.initializeChannels();

    // One-time maintenance: Populate Devices with Missing Data
    const maintainDevices = async () => {
      if (sessionStorage.getItem('devices_maintained')) return;
      sessionStorage.setItem('devices_maintained', 'true');

      try {
        const { 
          collection, 
          getDocs, 
          updateDoc, 
          doc,
          serverTimestamp 
        } = await import("firebase/firestore");
        const { db } = await import("./lib/firebase");

        const querySnapshot = await getDocs(collection(db, "devices"));
        const updatePromises = querySnapshot.docs
          .filter(docSnap => !docSnap.data().materialCode || !docSnap.data().barcode)
          .map(docSnap => {
            const data = docSnap.data();
            const updates: any = { lastUpdated: serverTimestamp() };
            
            if (!data.materialCode) {
              updates.materialCode = "30320" + Math.floor(10000 + Math.random() * 90000);
            }
            if (!data.barcode) {
              updates.barcode = "693" + Math.floor(1000000000 + Math.random() * 9000000000);
            }
            
            return updateDoc(doc(db, "devices", docSnap.id), updates);
          });

        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
          console.log(`Maintenance: ${updatePromises.length} devices updated with dummy data.`);
        }
      } catch (err) {
        console.warn("Maintenance: Device data population skipped:", err);
      }
    };

    maintainDevices();

    // One-time maintenance: Populate ICCID for specific device
    const maintainSpecificDevice = async () => {
      if (sessionStorage.getItem('device_6931847166557_maintained')) return;
      sessionStorage.setItem('device_6931847166557_maintained', 'true');

      try {
        const { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } = await import("firebase/firestore");
        const { db } = await import("./lib/firebase");

        const q = query(collection(db, "devices"), where("barcode", "==", "6931847166557"));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          if (!docSnap.data().iccid || docSnap.data().iccid === "N/A") {
            await updateDoc(doc(db, "devices", docSnap.id), {
              iccid: "89014103211185101234",
              lastUpdated: serverTimestamp()
            });
            console.log("Maintenance: ICCID updated for barcode 6931847166557.");
          }
        }
      } catch (err) {
        // Silently skip
      }
    };
    maintainSpecificDevice();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
