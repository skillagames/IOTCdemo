import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Plus, 
  Settings, 
  ChevronLeft, 
  LayoutDashboard,
  ShieldCheck,
  LogOut,
  Scan,
  Radio,
  Home,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { notificationService } from '../services/notificationService';

interface LayoutProps {
  children: React.ReactNode;
  showBack?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showBack }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (user) {
      const checkAlerts = async () => {
        const alerts = await notificationService.getAlerts(user.uid);
        setAlertCount(alerts.length);
      };

      checkAlerts();
      
      // Listen for manual dismissals from within the app
      window.addEventListener('alerts_updated', checkAlerts);
      // Listen for dismissals/updates from other tabs
      window.addEventListener('storage', checkAlerts);

      // Periodic fallback check
      const interval = setInterval(checkAlerts, 60000);

      return () => {
        window.removeEventListener('alerts_updated', checkAlerts);
        window.removeEventListener('storage', checkAlerts);
        clearInterval(interval);
      };
    }
  }, [user]);

  // Toggle for easy undo if requested
  const ENABLE_LOGO_ANIMATION = true;

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Scan, label: 'Scan', path: '/scan' },
    { icon: Radio, label: 'Alerts', path: '/alerts' },
    { icon: UserIcon, label: 'Profile', path: '/profile' },
  ];

  if (isAdmin) {
    navItems.splice(2, 0, { icon: ShieldCheck, label: 'Admin', path: '/admin' });
  }

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="flex min-h-screen flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-between px-4">
          <div className="flex items-center">
            {showBack && (
              <button 
                onClick={() => navigate(-1)}
                className="rounded-full p-2 hover:bg-slate-100"
              >
                <ChevronLeft className="h-6 w-6 text-slate-600" />
              </button>
            )}
          </div>

          <div 
            onClick={() => navigate('/')}
            className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition-transform active:scale-95 group w-max"
          >
            <div className="flex items-center gap-0 whitespace-nowrap">
              <motion.div 
                initial={ENABLE_LOGO_ANIMATION ? { scale: 0.5, opacity: 0, rotate: -15 } : {}}
                animate={ENABLE_LOGO_ANIMATION ? { scale: 1, opacity: 1, rotate: 0 } : {}}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20,
                  delay: 0.1
                }}
                className="bg-black text-white w-7 h-7 flex items-center justify-center rounded-[4px] font-black text-[20px] leading-none shadow-sm"
              >
                IO
              </motion.div>
              <div className="flex flex-col leading-none">
                <motion.span 
                  initial={ENABLE_LOGO_ANIMATION ? { x: -10, opacity: 0 } : {}}
                  animate={ENABLE_LOGO_ANIMATION ? { x: 0, opacity: 1 } : {}}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-lg font-black tracking-tight text-slate-900 pl-0.5"
                >
                  tConnect
                </motion.span>
              </div>
            </div>
            
            <motion.div
              initial={ENABLE_LOGO_ANIMATION ? { opacity: 0, y: -2 } : {}}
              animate={ENABLE_LOGO_ANIMATION ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="mt-0.5 flex w-full justify-between items-center origin-top"
            >
              <span className="text-[7px] font-medium text-slate-400 whitespace-nowrap">global</span>
              <span className="text-[7px] font-light text-slate-200">|</span>
              <span className="text-[7px] font-medium text-slate-400 whitespace-nowrap">iot</span>
              <span className="text-[7px] font-light text-slate-200">|</span>
              <span className="text-[7px] font-medium text-slate-400 whitespace-nowrap">connectivity</span>
            </motion.div>
          </div>
          
          <div className="flex items-center">
            <button 
              onClick={handleLogout}
              className="rounded-full p-2 text-slate-300 hover:bg-slate-100 hover:text-red-500 transition-colors"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        {children}
      </main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 transition-colors relative group",
                  isActive ? "text-primary" : "text-slate-400"
                )}
              >
                <motion.div
                  animate={isActive ? { scale: 1.2, y: -2 } : { scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <item.icon className={cn("h-6 w-6", isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                </motion.div>
                
                {item.label === 'Alerts' && alertCount > 0 && (
                  <span className="absolute right-3 top-2 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 border border-white"></span>
                  </span>
                )}
                <span className={cn(
                  "text-[9px] uppercase tracking-[0.1em] font-black transition-all",
                  isActive ? "opacity-100 scale-100" : "opacity-60 scale-95"
                )}>
                  {item.label}
                </span>
                
                {isActive && (
                  <motion.div 
                    layoutId="nav-underline"
                    className="absolute -bottom-1 h-0.5 w-6 rounded-full bg-primary"
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
