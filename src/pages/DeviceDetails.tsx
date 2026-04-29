import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  deviceService, 
  Device, 
  UsageStat 
} from '../services/deviceService';
import { 
  Activity, 
  Clock, 
  Database, 
  RefreshCcw, 
  CheckCircle2, 
  XCircle,
  AlertTriangle,
  CreditCard,
  Trash2,
  AlertCircle,
  Repeat
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { formatDate, cn } from '../lib/utils';

const DeviceDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(0);

  const PLANS = [
    { id: 0, name: "Starter Pulse", price: "R 79.00", desc: "Basic connectivity for 30 days" },
    { id: 1, name: "Monthly Booster", price: "R 159.00", desc: "Unlimited data for 30 days", badge: "Popular" },
    { id: 2, name: "Quarterly Core", price: "R 399.00", desc: "Solid performance for 90 days" },
    { id: 3, name: "Annual Pro", price: "R 1,299.00", desc: "Best value for power users", badge: "Best Value" }
  ];

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [deviceData, statsData] = await Promise.all([
        deviceService.getDeviceById(id!),
        deviceService.getUsageStats(id!)
      ]);
      setDevice(deviceData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const syncTelemetry = async () => {
    if (!id) return;
    setIsRenewing(true);
    try {
      await deviceService.syncTelemetry(id);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleRenew = async () => {
    setIsRenewing(true);
    // Simulate delay
    await new Promise(r => setTimeout(r, 1500));
    try {
      await deviceService.renewSubscription(id!);
      await loadData();
      setShowRenewModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (!device) return;
    setIsUpdatingAutoRenew(true);
    try {
      await deviceService.toggleAutoRenew(id!, !device.autoRenew);
      await loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingAutoRenew(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deviceService.removeDevice(id!);
      navigate('/devices');
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div></div>;
  if (!device) return <div className="text-center py-12 text-slate-500">Device not found</div>;

  const isExpired = device.subscriptionStatus === 'expired';
  const isInactive = device.subscriptionStatus === 'inactive';
  const expirationDate = device.expirationDate ? new Date(device.expirationDate.seconds * 1000) : null;

  return (
    <div className="space-y-3">
      {/* Header Card */}
      <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
         <div className={cn(
            "absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl",
            isExpired ? "bg-red-500/10" : isInactive ? "bg-slate-500/10" : "bg-primary/10"
          )} />
          
          <div className="relative flex items-start">
            <div className="flex-1 space-y-1 pr-14">
              <h2 className="text-lg font-black text-slate-900 leading-none break-words">{device.name}</h2>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">SN: {device.serialNumber}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">IMEI</span>
                    <span className="text-[11px] font-bold text-slate-500 font-mono tracking-tight">{device.imei || 'N/A'}</span>
                  </div>
                  <div className="h-5 w-px bg-slate-100 self-end mb-1" />
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">ICCID</span>
                    <span className="text-[11px] font-bold text-slate-500 font-mono tracking-tight">{device.iccid || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className={cn(
              "absolute right-0 top-0 flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black uppercase tracking-tight whitespace-nowrap",
              isExpired && "bg-red-50 text-red-500",
              isInactive && "bg-slate-100 text-slate-500",
              !isExpired && !isInactive && "bg-emerald-50 text-emerald-600"
            )}>
              {isExpired ? <XCircle className="h-2.5 w-2.5" /> : isInactive ? <AlertCircle className="h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
              {isInactive ? 'Inactive' : device.subscriptionStatus}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
             <div className="flex flex-col">
                <p className="text-[7px] uppercase font-black text-slate-300 tracking-[0.2em] leading-none">
                  {isInactive ? 'Connectivity' : 'Expiration Date'}
                </p>
                <p className="text-sm font-black text-slate-900 mt-1.5 leading-none">
                  {isInactive ? 'Pending Activation' : formatDate(device.expirationDate, 'MMMM dd, yyyy')}
                </p>
             </div>
             {(isExpired || isInactive) ? (
                <button 
                  onClick={() => setShowRenewModal(true)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-5 py-2.5 text-[9px] font-black text-white transition-all active:scale-95 shadow-lg whitespace-nowrap",
                    isInactive ? "bg-slate-900 shadow-slate-900/20" : "bg-red-500 shadow-red-500/20"
                  )}
                >
                  <RefreshCcw className="h-3.5 w-3.5" /> 
                  {isInactive ? 'Activate' : 'Renew Plan'}
                </button>
             ) : (
                <button 
                  onClick={handleToggleAutoRenew}
                  disabled={isUpdatingAutoRenew}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-4 py-2.5 text-[9px] font-black transition-all active:scale-95 shadow-lg whitespace-nowrap border",
                    device.autoRenew 
                      ? "bg-emerald-500 text-white border-transparent shadow-emerald-500/20" 
                      : "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/5 hover:bg-emerald-100/50"
                  )}
                >
                  {isUpdatingAutoRenew ? (
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Repeat className="h-3.5 w-3.5" />
                  )}
                  {device.autoRenew ? 'Auto-Renew Active' : 'Enable Auto-Renew'}
                </button>
             )}
          </div>
      </section>

      {/* Usage Overview */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none">Usage Analytics</h3>
          <button 
            onClick={syncTelemetry}
            disabled={isRenewing}
            className="flex items-center gap-1 text-[8px] font-black uppercase tracking-[0.1em] text-primary hover:opacity-80 disabled:opacity-50"
          >
            <RefreshCcw className={cn("h-2.5 w-2.5", isRenewing && "animate-spin")} />
            Sync
          </button>
        </div>
        <div className="relative h-[140px] w-full rounded-2xl bg-white border border-slate-200 p-1 shadow-sm overflow-hidden">
          {stats.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                <Activity className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Zero Telemetry Data</p>
                <p className="text-[10px] text-slate-500 max-w-[160px]">Push a pulse or seed historical metrics to view analytics.</p>
              </div>
              <button 
                onClick={async () => {
                  setIsRenewing(true);
                  try {
                    await deviceService.seedDeviceUsage(id!);
                    await loadData();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsRenewing(false);
                  }
                }}
                disabled={isRenewing}
                className="mt-1 rounded-full bg-slate-900 px-4 py-1.5 text-[9px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
              >
                {isRenewing ? 'Seeding...' : 'Seed History'}
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" key={stats.length}>
              <AreaChart data={stats}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(val) => formatDate(val, 'dd')}
                  stroke="#94a3b8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  itemStyle={{ color: '#3b82f6', fontSize: '12px' }}
                  labelStyle={{ display: 'none' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="dataUsedMb" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorUsage)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DetailBadge icon={Database} label="Total Data" value={`${stats.reduce((acc, s) => acc + s.dataUsedMb, 0).toLocaleString()} MB`} />
          <DetailBadge icon={Clock} label="Active Time" value={`${stats.reduce((acc, s) => acc + s.activeHours, 0)} Hrs`} />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="pt-1">
        <button 
          onClick={() => setShowDeleteModal(true)}
          className="group flex w-full items-center justify-center gap-2 rounded-xl border border-red-50 bg-red-50/5 py-2.5 text-[8px] font-black uppercase tracking-[0.3em] text-red-300 hover:text-red-500 transition-all active:scale-[0.98] hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
          Destroy Device Node
        </button>
      </section>

      {/* Renew Modal */}
      <AnimatePresence>
        {showRenewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setShowRenewModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              style={{ willChange: 'opacity, backdrop-filter' }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ 
                type: 'spring', 
                damping: 30, 
                stiffness: 400,
                mass: 0.8
              }}
              className="relative w-full max-w-sm rounded-[32px] bg-white p-5 shadow-2xl overflow-hidden border border-slate-100"
              style={{ willChange: 'transform, opacity' }}
            >
              {/* Decorative Background Elements */}
              <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/5 blur-3xl" />
              <div className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-blue-400/5 blur-3xl" />
              
              <div className="relative flex flex-col items-center text-center">
                 <motion.div 
                   initial={{ scale: 0.5, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   transition={{ delay: 0.1 }}
                   className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 text-white mb-4 shadow-lg shadow-indigo-400/20"
                 >
                    <CreditCard className="h-6 w-6" />
                 </motion.div>
                 
                 <motion.div
                   initial={{ y: 10, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   transition={{ delay: 0.15 }}
                 >
                   <h2 className="text-xl font-black text-slate-900 tracking-tight">Expand Connectivity</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select your power profile</p>
                 </motion.div>
                 
                 <motion.div 
                   className="mt-5 w-full space-y-2"
                   initial="hidden"
                   animate="visible"
                   variants={{
                     visible: {
                       transition: {
                         staggerChildren: 0.05,
                         delayChildren: 0.2
                       }
                     }
                   }}
                 >
                    {PLANS.map((plan) => {
                      const { id, ...rest } = plan;
                      return (
                        <motion.div
                          key={id}
                          variants={{
                            hidden: { x: -10, opacity: 0 },
                            visible: { x: 0, opacity: 1 }
                          }}
                        >
                          <PlanOption 
                            {...rest}
                            active={selectedPlan === id}
                            onClick={() => setSelectedPlan(id)}
                          />
                        </motion.div>
                      );
                    })}
                 </motion.div>

                 <motion.div 
                   className="mt-6 w-full space-y-3"
                   initial={{ y: 20, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   transition={{ delay: 0.4 }}
                 >
                   <button 
                    onClick={handleRenew}
                    disabled={isRenewing}
                    className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-slate-900 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50"
                   >
                     <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
                     <span className="relative z-10 flex items-center gap-2">
                      {isRenewing ? (
                        <RefreshCcw className="h-4 w-4 animate-spin" />
                      ) : (
                        <>Confirm Upgrade <CreditCard className="h-3.5 w-3.5" /></>
                      )}
                     </span>
                   </button>
                   <button 
                    onClick={() => setShowRenewModal(false)}
                    className="w-full py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                   >
                     Cancel
                   </button>
                 </motion.div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-[32px] bg-white p-5 shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center text-center">
                 <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 mb-3">
                    <AlertCircle className="h-5 w-5" />
                 </div>
                 <h2 className="text-lg font-black text-slate-900 tracking-tight">Decommission Device?</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 px-4 leading-relaxed">
                   This will permanently purge all telemetry and historical usage data.
                 </p>
                 
                 <div className="mt-6 w-full space-y-2">
                   <button 
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-500 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-red-500/10 transition-all hover:bg-red-600 active:scale-95 disabled:opacity-50"
                   >
                     {isDeleting ? (
                       <RefreshCcw className="h-4 w-4 animate-spin" />
                     ) : (
                       <>Purge Device</>
                     )}
                   </button>
                   <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                   >
                     Cancel
                   </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailBadge = ({ icon: Icon, label, value }: { icon: any, label: string, value: string }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
      <Icon className="h-4 w-4" />
    </div>
    <div>
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-xs font-black text-slate-900 tabular-nums leading-none">{value}</p>
    </div>
  </div>
);

interface PlanOptionProps {
  key?: number | string;
  name: string;
  price: string;
  desc: string;
  badge?: string;
  active?: boolean;
  onClick: () => void;
}

const PlanOption = ({ name, price, desc, badge, active, onClick }: PlanOptionProps) => (
  <button 
    onClick={onClick}
    className={cn(
      "relative flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98]",
      active 
        ? "border-indigo-400 bg-gradient-to-br from-indigo-400 to-blue-500 text-white shadow-lg shadow-indigo-400/20" 
        : "border-slate-100 bg-white hover:border-slate-200"
    )}
  >
    {badge && (
      <div className={cn(
        "absolute -top-2 right-4 rounded-full px-2 py-0.5 text-[7px] font-black uppercase tracking-widest shadow-sm",
        active ? "bg-white text-indigo-500" : "bg-indigo-400 text-white"
      )}>
        {badge}
      </div>
    )}
    <div className="min-w-0">
      <h4 className={cn("font-black text-[10px] uppercase tracking-wider truncate", active ? "text-white" : "text-slate-900")}>{name}</h4>
      <p className={cn("text-[9px] font-medium leading-none mt-1", active ? "text-indigo-100" : "text-slate-400")}>{desc}</p>
    </div>
    <div className="text-right ml-4 shrink-0">
      <p className={cn("text-xs font-black", active ? "text-white" : "text-slate-900")}>{price}</p>
    </div>
  </button>
);

export default DeviceDetails;
