import React, { useEffect, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { StatusBar } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import DeviceDetails from './pages/DeviceDetails';
import Scanner from './pages/Scanner';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Alerts from './pages/Alerts';
import { motion, AnimatePresence } from 'motion/react';
import { notificationService } from './services/notificationService';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="flex h-screen flex-col items-center justify-center bg-white">
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
        {/* Spinning Outer Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute inset-0 rounded-full border-[3px] border-slate-100 border-t-slate-900"
        />
        
        {/* Pulsing Inner Circle with IoT */}
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="relative flex h-14 w-14 items-center justify-center bg-black rounded-full shadow-2xl shadow-slate-900/40"
        >
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/10 to-transparent pointer-events-none" />
          <span className="font-black text-lg text-white tracking-tighter">IoT</span>
        </motion.div>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Synchronizing</span>
        <div className="mt-2 flex gap-1">
          <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="h-1 w-1 rounded-full bg-slate-900" />
          <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="h-1 w-1 rounded-full bg-slate-900" />
          <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="h-1 w-1 rounded-full bg-slate-900" />
        </div>
      </div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
};

// Admin Route Component
const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, isAdmin, loading } = useAuth();
  
  if (loading) return null;
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

export default function App() {
  useEffect(() => {
    notificationService.initializeChannels();
    
    // Capacitor edge-to-edge layout fix for first launch
    const setupDevice = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          // Set overlay false BEFORE hiding splash screen to fix layout shift
          await StatusBar.setOverlaysWebView({ overlay: false });
          // Ensure webview layout has time to apply the top pad fix before hiding splashscreen
          setTimeout(async () => {
             await SplashScreen.hide();
          }, 150);
        } catch (error) {
          console.error('Error during native setup:', error);
        }
      }
    };
    setupDevice();
    
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-bg-main font-sans text-slate-800">
          <Routes>
            <Route path="/login" element={<Login />} />
            
            <Route path="/" element={
              <ProtectedRoute>
                <Layout>
                  <PageTransition>
                    <Dashboard />
                  </PageTransition>
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/devices/:id" element={
              <ProtectedRoute>
                <Layout showBack>
                  <PageTransition>
                    <DeviceDetails />
                  </PageTransition>
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/devices" element={
              <ProtectedRoute>
                <Layout showBack>
                  <PageTransition>
                    <Devices />
                  </PageTransition>
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/scan" element={
              <ProtectedRoute>
                <Layout showBack>
                  <PageTransition>
                    <Scanner />
                  </PageTransition>
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <AdminRoute>
                <Layout showBack>
                  <PageTransition>
                    <Admin />
                  </PageTransition>
                </Layout>
              </AdminRoute>
            } />

            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <PageTransition>
                    <Profile />
                  </PageTransition>
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="/alerts" element={
              <ProtectedRoute>
                <Layout>
                  <PageTransition>
                    <Alerts />
                  </PageTransition>
                </Layout>
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
