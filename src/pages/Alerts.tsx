import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  ChevronRight, 
  RefreshCcw,
  Trash2,
  X
} from 'lucide-react';
import { notificationService } from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

const Alerts: React.FC = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadAlerts();
    }
  }, [user]);

  const loadAlerts = async () => {
    setLoading(true);
    const data = await notificationService.getAlerts(user!.uid);
    setAlerts(data);
    setLoading(false);
  };

  const handleDismiss = async (alertId: string) => {
    notificationService.dismissAlert(alertId);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleRescan = async () => {
    notificationService.resetAlerts();
    await loadAlerts();
  };

  const handleDismissAll = () => {
    const ids = alerts.map(a => a.id);
    notificationService.dismissAllAlerts(ids);
    setAlerts([]);
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
    </div>
  );

  return (
    <div className="space-y-4">
      <header className="sticky top-16 z-40 -mx-4 -mt-6 flex items-start justify-between bg-bg-main/90 px-4 pb-4 pt-6 backdrop-blur-md">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-none">Device Alerts</h1>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Critical Connectivity Status</p>
        </div>
        
        <button 
          onClick={alerts.length > 0 ? handleDismissAll : handleRescan}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-[18px] transition-all active:scale-90",
            alerts.length > 0 
              ? "bg-red-50 text-red-500 hover:bg-red-100" 
              : "bg-emerald-50/50 text-emerald-500 hover:bg-emerald-100/50"
          )}
          title={alerts.length > 0 ? "Clear all alerts" : "Refresh signals"}
        >
          {alerts.length > 0 ? (
            <Trash2 className="h-5 w-5" />
          ) : (
            <RefreshCcw className="h-5 w-5" />
          )}
        </button>
      </header>

      <div className="grid gap-3 p-1 -m-1">
        <AnimatePresence mode="popLayout">
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.9, filter: 'blur(10px)' }}
                className="relative"
              >
                {/* Background Layer (Revealed during swipe) */}
                <div className="absolute inset-0 flex items-center justify-start rounded-[24px] bg-red-500 px-6">
                  <div className="flex flex-col items-center gap-1 text-white">
                    <Trash2 className="h-5 w-5" />
                    <span className="text-[8px] font-black uppercase tracking-tighter">Dismiss</span>
                  </div>
                </div>

                <motion.div
                  drag="x"
                  dragConstraints={{ right: 0, left: 0 }}
                  dragElastic={0.7}
                  dragSnapToOrigin={true}
                  dragTransition={{ bounceStiffness: 600, bounceDamping: 40 }}
                  onDragEnd={(e, info) => {
                    const target = e.target as HTMLElement;
                    const card = target.closest('.rounded-\\[24px\\]') as HTMLElement;
                    const width = card?.offsetWidth || 300;
                    
                    // Requirement: at least 1/3 of the total width
                    const threshold = width / 3;
                    
                    if (info.offset.x > threshold) {
                      handleDismiss(alert.id);
                    }
                  }}
                  className={cn(
                    "group relative flex w-full items-center gap-4 overflow-hidden rounded-[24px] bg-white p-4 border transition-shadow shadow-sm text-left touch-none",
                    alert.type === 'expired' ? "border-red-100" : alert.type === 'inactive' ? "border-slate-100" : "border-orange-100"
                  )}
                >
                  <div 
                    onClick={() => navigate(`/devices/${alert.deviceId}`)}
                    className="flex flex-1 items-center gap-4 cursor-pointer"
                  >
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px]",
                      alert.type === 'expired' ? "bg-red-50 text-red-500" : alert.type === 'inactive' ? "bg-slate-50 text-slate-400" : "bg-orange-50 text-orange-500"
                    )}>
                      {alert.type === 'expired' ? <AlertTriangle className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-black tracking-tight text-slate-900 line-clamp-1 break-all w-[180px]">{alert.deviceDescription || alert.deviceName}</h4>
                        <span className="text-[8px] font-black uppercase text-slate-400">
                          {alert.type === 'expired' ? 'CRITICAL' : alert.type === 'inactive' ? 'PENDING' : 'WARNING'}
                        </span>
                      </div>
                      {alert.deviceDescription && (
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-tight mt-0.5">{alert.deviceName}</p>
                      )}
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mt-0.5">{alert.message}</p>
                      <p className="text-[9px] font-medium text-slate-400 mt-1 italic">
                        {alert.type === 'expired' ? 'Expired on ' : alert.type === 'inactive' ? 'Waiting for activation since ' : 'Expiring on '}
                        {alert.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => handleDismiss(alert.id)}
                      className="rounded-full bg-slate-50 p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-slate-200" />
                  </div>
                </motion.div>
              </motion.div>
            ))
          ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="relative group">
              {/* Soft success glow */}
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute inset-x-0 -inset-y-4 bg-emerald-400/20 blur-2xl rounded-full" 
              />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-[36px] bg-emerald-50 text-emerald-500 border-2 border-emerald-100/50 shadow-xl shadow-emerald-500/10 transition-transform group-hover:scale-105 duration-500">
                <Bell className="h-10 w-10" />
                {/* Status indicator dot */}
                <div className="absolute top-6 right-6 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
              </div>
            </div>

            <div className="space-y-1.5 mt-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">All Clear</h3>
              <p className="text-[10px] text-slate-500 font-bold max-w-[220px] leading-relaxed mx-auto">
                You've cleared all your alerts. Refresh the page if you want to check for any new device updates.
              </p>
            </div>

            <button 
              onClick={handleRescan}
              className="group flex items-center gap-3 rounded-[20px] bg-slate-900 px-7 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-2xl shadow-slate-900/20 transition-all hover:bg-slate-800 active:scale-95 mt-6"
            >
              <RefreshCcw className="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
              Check for Alerts
            </button>
          </div>
        )}
        </AnimatePresence>
      </div>

      {/* Quick Actions if there are alerts */}
      {alerts.length > 0 && (
        <div className="min-h-[calc(100vh-14rem)] w-full pt-20">
          <div className="rounded-[28px] bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/20">
             <h3 className="text-xs font-black uppercase tracking-widest leading-none mb-2">Protocol Suggestion</h3>
             <p className="text-[10px] text-slate-400 font-medium leading-relaxed mb-4">
               Detected {alerts.length} device(s) requiring immediate attention. Tap on an alert to initiate the renewal protocol and restore full telemetry sync.
             </p>
             <div className="flex flex-col gap-2">
               <button 
                onClick={() => navigate('/devices')}
                className="w-full rounded-xl bg-white/10 py-2.5 text-[9px] font-black uppercase tracking-widest text-white hover:bg-white/20 transition-colors"
               >
                 Manage Devices
               </button>
               <button 
                onClick={handleDismissAll}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 py-2.5 text-[9px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-colors"
               >
                 <Trash2 className="h-3 w-3" />
                 Dismiss All Active Signals
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Alerts;
