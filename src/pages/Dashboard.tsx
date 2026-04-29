import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Battery, Signal, ChevronRight, PlusCircle, AlertCircle, X, Zap, Activity, ShieldCheck } from 'lucide-react';
import { deviceService, Device } from '../services/deviceService';
import { useAuth } from '../context/AuthContext';
import { formatDate, cn } from '../lib/utils';
import { motion } from 'motion/react';

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'expired' | 'inactive' | null>(null);
  const [isSticky, setIsSticky] = useState(false);
  const navigate = useNavigate();
  const statsRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadDevices();
      deviceService.seedMasterRegistry();
    }
  }, [user]);

  useEffect(() => {
    // Automatically scroll to the filter section when a status is selected
    // to hide the welcome hero and focus on the inventory
    if (!loading && filter && scrollAnchorRef.current) {
      const offset = scrollAnchorRef.current.offsetTop - 64; // Account for 64px layout header
      window.scrollTo({ top: offset, behavior: 'smooth' });
      
      // Also reset the internal list scroll to the top
      if (listRef.current) {
        listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [filter, loading]);

  useEffect(() => {
    const handleScroll = () => {
      // Logic to toggle sticky state based on hero section height (approx 240px)
      if (window.scrollY > 220) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadDevices = async () => {
    try {
      const data = await deviceService.getUserDevices(user!.uid);
      setDevices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
    </div>
  );

  const firstName = profile?.displayName?.split(' ')[0] || 'Member';
  
  const filteredDevices = filter 
    ? devices.filter(d => d.subscriptionStatus === filter)
    : devices;

  return (
    <div className="space-y-5 pb-10">
      {/* Hero Welcome Section - Compressed Sleek Header */}
      <section>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[32px] border border-slate-100 bg-white p-4 shadow-sm"
        >
          {/* IoT Logo Watermark */}
          <div className="absolute -right-6 -top-6 text-slate-200/40 pointer-events-none z-0">
             <Smartphone size={160} strokeWidth={1.5} className="rotate-12" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Cluster: Online</span>
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-slate-900 leading-none">
                Hello, <span className="text-primary">{firstName}</span>
              </h1>
              <p className="text-[10px] font-medium text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                Your cluster is secure. {devices.filter(d => d.subscriptionStatus === 'active').length} active nodes running.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/scan')}
                className="group flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-white transition-all active:scale-95 shadow-lg shadow-slate-900/10"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Add Device</span>
              </button>
              <button 
                onClick={() => navigate('/devices')}
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2 text-slate-900 transition-all active:scale-95 hover:bg-slate-100"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">Inventory</span>
              </button>
            </div>
          </div>
          
          <div className="mt-4 flex items-center gap-5 border-t border-slate-50 pt-3.5">
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Active Pool</span>
                <span className="text-[11px] font-bold text-slate-900 mt-1 leading-none">{devices.filter(d => d.subscriptionStatus === 'active').length}</span>
             </div>
             <div className="h-3 w-px bg-slate-100" />
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Cluster Health</span>
                <span className="text-[11px] font-bold text-slate-900 mt-1 leading-none">92.4%</span>
             </div>
             <div className="h-3 w-px bg-slate-100" />
             <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest leading-none">Logistics</span>
                <span className="text-[11px] font-bold text-slate-900 mt-1 leading-none">Optimized</span>
             </div>
          </div>
        </motion.div>
      </section>
      
      <div ref={scrollAnchorRef} />

      {/* Stats Quick View - Constant Sticky Header */}
      <section 
        ref={statsRef}
        className={cn(
          "sticky top-[64px] z-20 py-2 transition-colors duration-200 space-y-4",
        isSticky ? "bg-bg-main/90 backdrop-blur-md" : "bg-transparent"
      )}>
        <div className="grid grid-cols-3 gap-2">
          <StatCard 
            label="ACTIVE" 
            value={devices.filter(d => d.subscriptionStatus === 'active').length.toString()} 
            color="emerald" 
            icon={Signal}
            isActive={filter === 'active'}
            onClick={() => setFilter(filter === 'active' ? null : 'active')}
          />
          <StatCard 
            label="EXPIRED" 
            value={devices.filter(d => d.subscriptionStatus === 'expired').length.toString()} 
            color="red" 
            icon={AlertCircle}
            isActive={filter === 'expired'}
            onClick={() => setFilter(filter === 'expired' ? null : 'expired')}
          />
          <StatCard 
            label="INACTIVE" 
            value={devices.filter(d => d.subscriptionStatus === 'inactive').length.toString()} 
            color="slate" 
            icon={Smartphone}
            isActive={filter === 'inactive'}
            onClick={() => setFilter(filter === 'inactive' ? null : 'inactive')}
          />
        </div>

        <div className="flex items-center justify-between h-7">
          <div className="flex items-center gap-2">
            <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Quick Inventory</h2>
            {filter && (
               <button 
                onClick={() => setFilter(null)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-widest border transition-all active:scale-95 shadow-sm",
                  filter === 'active' && "bg-emerald-50 text-emerald-600 border-emerald-100",
                  filter === 'expired' && "bg-red-50 text-red-600 border-red-100",
                  filter === 'inactive' && "bg-slate-50 text-slate-500 border-slate-200"
                )}
               >
                 <span>{filter}</span>
                 <X className="h-2 w-2" />
               </button>
            )}
          </div>
          <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tight">{filteredDevices.length} DEVICE(S)</span>
        </div>
      </section>

      {/* Natural List with Independent Scroll (conditional) */}
      <section className="relative -mt-4">
        <div 
          ref={listRef} 
          className={cn(
            "pr-1 -mr-1 scrollbar-thin scrollbar-thumb-slate-200 transition-all duration-300",
            filter 
              ? (isSticky ? "h-[405px] overflow-y-auto" : "h-[405px] overflow-hidden") 
              : "h-auto overflow-visible"
          )}
        >
          <div className="grid gap-3 p-1">
            {filteredDevices.length > 0 ? (
              filteredDevices.map((device, idx) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  key={device.id}
                >
                  <DeviceCard device={device} onClick={() => navigate(`/devices/${device.id}`)} />
                </motion.div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-white border border-slate-100 text-slate-200 shadow-sm">
                  <Smartphone className="h-8 w-8" />
                </div>
                <p className="text-xs font-bold text-slate-400">{filter ? `No ${filter} devices found` : 'No devices provisioned'}</p>
                {!filter && (
                  <button 
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await deviceService.seedDevices(user!.uid);
                        await loadDevices();
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-primary underline"
                  >
                    Seed Simulation
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Cluster Insights Section */}
      {profile?.showInsights !== false && (
        <section className="space-y-4 pt-2">
           <div className="flex items-center justify-between pb-2">
              <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Cluster Insights</h2>
              <div className="flex h-1 w-12 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-primary w-2/3" />
              </div>
           </div>

           <div className="grid gap-4">
              {/* Health Overview Container */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                 
                 {/* Operational Status Card */}
                 <div className="relative overflow-hidden rounded-[32px] border border-slate-100 bg-white shadow-sm p-6 flex flex-col justify-between group">
                    <div className="absolute top-0 right-0 p-6 pointer-events-none opacity-20 group-hover:opacity-10 transition-opacity">
                       <Activity className="w-24 h-24 text-slate-200" strokeWidth={1} />
                    </div>
                    
                    <div className="flex items-start justify-between relative z-10">
                       <div className="space-y-1">
                          <div className="flex items-center gap-2 mb-1">
                             <div className="relative flex h-2 w-2">
                               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                               <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                             </div>
                             <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Operational Status</h4>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium leading-relaxed whitespace-nowrap">Cluster optimized. {devices.filter(d => d.subscriptionStatus === 'active').length} active devices running efficiently.</p>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-6 mt-6 relative z-10">
                       <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center">
                          <svg className="h-full w-full -rotate-90 transform dropshadow-xl">
                             <defs>
                               <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                 <stop offset="0%" stopColor="#3b82f6" />
                                 <stop offset="100%" stopColor="#8b5cf6" />
                               </linearGradient>
                             </defs>
                             <circle cx="36" cy="36" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-50" />
                             <circle cx="36" cy="36" r="32" stroke="url(#healthGrad)" strokeWidth="6" strokeLinecap="round" fill="transparent" strokeDasharray="201.06" strokeDashoffset={201.06 - (201.06 * (devices.filter(d => d.subscriptionStatus === 'active').length / (devices.length || 1)))} className="transition-all duration-1000 ease-out drop-shadow-md" />
                          </svg>
                          <div className="absolute flex flex-col items-center leading-none mt-0.5">
                             <span className="text-sm font-black text-slate-900">{Math.round((devices.filter(d => d.subscriptionStatus === 'active').length / (devices.length || 1)) * 100)}<span className="text-[10px]">%</span></span>
                          </div>
                       </div>
                       
                       <div className="flex flex-col gap-3 w-full">
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Throughput</span>
                             <span className="text-[11px] font-black text-slate-900 font-mono">2.4<span className="text-[8px] text-slate-400 ml-0.5 font-sans">GB/S</span></span>
                          </div>
                          <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
                             <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Latency</span>
                             <span className="text-[11px] font-black text-slate-900 font-mono">12<span className="text-[8px] text-slate-400 ml-0.5 font-sans">MS</span></span>
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Recent Activity Timeline */}
                 <div className="relative overflow-hidden rounded-[32px] border border-white/60 bg-gradient-to-br from-blue-50/40 via-white/40 to-emerald-50/20 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 flex flex-col">
                    <div className="absolute -top-12 -right-6 h-32 w-32 rounded-full bg-blue-300/10 blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-emerald-300/10 blur-3xl" />
                    
                    <div className="flex items-center justify-between mb-5 relative z-10">
                       <div className="flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-blue-500" />
                          <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Live Logistics</h4>
                       </div>
                       <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
                    </div>
                    
                    <div className="relative flex-1 space-y-4 before:absolute before:inset-y-2 before:left-[15px] before:w-px before:bg-slate-200">
                       <LogItem icon={Zap} title="Telemetry Pulse" desc="Route X1 transmitted metrics" time="2m ago" color="blue" />
                       <LogItem icon={ShieldCheck} title="Service Renewal" desc="Field Monitor M1 renewed" time="1h ago" color="emerald" />
                       <LogItem icon={AlertCircle} title="Low Signal" desc="Enterprise Hub G5 latency" time="3h ago" color="red" />
                    </div>
                 </div>
              </div>
           </div>
        </section>
      )}
    </div>
  );
};

const LogItem = ({ icon: Icon, title, desc, time, color }: { icon: any, title: string, desc: string, time: string, color: 'blue' | 'emerald' | 'red' }) => (
  <div className="group relative flex gap-4">
     <div className={cn(
        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/80 backdrop-blur-sm transition-colors group-hover:border-slate-200/60 shadow-sm",
        color === 'blue' && "text-blue-500",
        color === 'emerald' && "text-emerald-500",
        color === 'red' && "text-red-500"
     )}>
        <Icon className="h-4 w-4" />
     </div>
     <div className="flex-1 space-y-0.5 pt-0.5">
        <div className="flex items-center justify-between">
           <h5 className="text-xs font-bold text-slate-900">{title}</h5>
           <span className="text-[9px] font-bold text-slate-400 font-mono bg-white/50 px-1.5 py-0.5 rounded shadow-sm">{time}</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">{desc}</p>
     </div>
  </div>
);

const DeviceCard = ({ device, onClick }: { device: Device; onClick: () => void }) => {
  const isExpired = device.subscriptionStatus === 'expired';
  const isInactive = device.subscriptionStatus === 'inactive';
  
  return (
    <button 
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-4 overflow-hidden rounded-[24px] bg-white p-1.5 pr-5 border transition-all active:scale-[0.98] shadow-sm",
        isExpired ? "border-red-100/50 active:border-red-500 md:hover:border-red-500" : isInactive ? "border-slate-50 opacity-90 border-dashed active:border-slate-300 md:hover:border-slate-300" : "border-slate-100 active:border-emerald-500 md:hover:border-emerald-500"
      )}
    >
      <div className={cn(
        "flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] transition-colors",
        !isExpired && !isInactive && "bg-emerald-50 text-emerald-500 group-active:bg-emerald-500 group-active:text-white md:group-hover:bg-emerald-500 md:group-hover:text-white",
        isExpired && "bg-red-50 text-red-400 group-active:bg-red-500 group-active:text-white md:group-hover:bg-red-500 md:group-hover:text-white",
        isInactive && "bg-slate-100 text-slate-400 group-active:bg-slate-600 group-active:text-white md:group-hover:bg-slate-600 md:group-hover:text-white"
      )}>
        <Smartphone className="h-6 w-6" />
      </div>
      
      <div className="flex-1 min-w-0 text-left">
        <h4 className="text-sm font-black tracking-tight text-slate-900 line-clamp-1">{device.name}</h4>
        <div className="flex items-center gap-1.5 font-mono text-[8px] font-bold uppercase tracking-tight">
          <span className={cn(
             isExpired ? "text-red-500" : isInactive ? "text-slate-400" : "text-emerald-500"
          )}>
            {isExpired ? 'Expired' : isInactive ? 'Inactive' : 'Active'}
          </span>
        </div>
      </div >

      <ChevronRight className="h-4 w-4 text-slate-300" />
    </button>
  );
};

const StatCard = ({ label, value, color, icon: Icon, isActive, onClick }: { label: string; value: string; color: 'emerald' | 'red' | 'slate'; icon: any; isActive: boolean; onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "relative overflow-hidden rounded-[20px] border transition-all text-left p-2.5 shadow-sm active:scale-95",
      isActive 
        ? (color === 'emerald' ? "border-emerald-200 bg-emerald-50 shadow-emerald-500/5" : 
           color === 'red' ? "border-red-200 bg-red-50 shadow-red-500/5" :
           "border-slate-200 bg-slate-50 shadow-none") 
        : "border-slate-100 bg-white"
    )}
  >
    <div className={cn(
      "absolute -right-2 -top-2 h-8 w-8",
      isActive ? "opacity-10" : "opacity-[0.03]",
      color === 'emerald' ? "text-emerald-500" : color === 'red' ? "text-red-500" : "text-slate-500"
    )}>
      <Icon className="h-full w-full" />
    </div>
    <p className={cn(
      "text-[7px] font-black uppercase tracking-[0.2em]",
      isActive 
        ? (color === 'emerald' ? "text-emerald-600/60" : color === 'red' ? "text-red-600/60" : "text-slate-500/60")
        : "text-slate-400"
    )}>{label}</p>
    <div className="flex items-center gap-1.5 leading-none mt-0.5">
      <span className={cn(
        "text-sm font-black tracking-tighter",
        isActive 
          ? (color === 'emerald' ? "text-emerald-600" : color === 'red' ? "text-red-600" : "text-slate-600")
          : "text-slate-900"
      )}>{value}</span>
      <div className={cn(
        "h-1.5 w-1.5 rounded-full shadow-sm",
        color === 'emerald' ? "bg-emerald-400" : color === 'red' ? "bg-red-500" : "bg-slate-400"
      )} />
    </div>
  </button>
);

export default Dashboard;
