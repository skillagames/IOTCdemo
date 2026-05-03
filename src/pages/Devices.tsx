import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Smartphone, Signal, AlertCircle, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { deviceService, Device } from '../services/deviceService';
import { useAuth } from '../context/AuthContext';
import { formatDate, cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Devices: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'inactive'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadDevices();
    }
  }, [user]);

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

  const filteredDevices = devices.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || d.subscriptionStatus === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] overflow-hidden -mt-2">
      {/* Fixed Header Box */}
      <div className="sticky top-0 z-30 bg-bg-main/95 pb-4 pt-2 backdrop-blur-sm">
        <header className="space-y-4 px-1">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 leading-none">Device Inventory</h1>
            <p className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Infrastructure: {devices.length} Devices</p>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search serial or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl bg-white border border-slate-100 py-3.5 pl-11 pr-4 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none transition-all shadow-sm"
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-95 shadow-sm",
                showFilters ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-100 text-slate-900"
              )}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-1.5 py-1">
                  {(['all', 'active', 'expired', 'inactive'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        "flex-1 rounded-xl py-2.5 text-[8px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border",
                        statusFilter === status 
                          ? cn(
                              status === 'all' && "bg-slate-900 border-slate-900 text-white shadow-slate-900/10",
                              status === 'active' && "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-500/5",
                              status === 'expired' && "bg-red-50 border-red-200 text-red-600 shadow-red-500/5",
                              status === 'inactive' && "bg-slate-50 border-slate-200 text-slate-500 shadow-none"
                            )
                          : "bg-white border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50/50"
                      )}
                    >
                      {status === 'inactive' ? 'Inactive' : status}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 p-1 pb-32 custom-scrollbar">
        {filteredDevices.length > 0 ? (
          filteredDevices.map((device, idx) => (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              key={device.id}
            >
              <DeviceItem device={device} onClick={() => navigate(`/devices/${device.id}`)} />
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
             <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-50 text-slate-200">
                <Smartphone className="h-8 w-8" />
             </div>
             <p className="text-sm font-bold text-slate-400">No records matching your search.</p >
          </div>
        )}
      </div>
    </div>
  );
};

const DeviceItem = ({ device, onClick }: { device: Device; onClick: () => void }) => {
  const isExpired = device.subscriptionStatus === 'expired';
  const isInactive = device.subscriptionStatus === 'inactive';
  
  return (
    <button 
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-4 overflow-hidden rounded-[28px] bg-white p-2 pr-6 border transition-all active:scale-[0.98] shadow-sm",
        isExpired ? "border-red-100/50 active:border-red-500 active:shadow-red-500/5 md:hover:border-red-500 md:hover:shadow-red-500/5" : isInactive ? "border-slate-100 border-dashed opacity-80 active:border-slate-400 md:hover:border-slate-400" : "border-slate-100 active:border-emerald-500 active:shadow-xl active:shadow-emerald-500/5 md:hover:border-emerald-500 md:hover:shadow-xl md:hover:shadow-emerald-500/5"
      )}
    >
      <div className={cn(
        "flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] transition-colors",
        !isExpired && !isInactive && "bg-emerald-50 text-emerald-600 group-active:bg-emerald-500 group-active:text-white md:group-hover:bg-emerald-500 md:group-hover:text-white",
        isExpired && "bg-red-50 text-red-500 group-active:bg-red-500 group-active:text-white md:group-hover:bg-red-500 md:group-hover:text-white",
        isInactive && "bg-slate-50 text-slate-300 group-active:bg-slate-500 group-active:text-white md:group-hover:bg-slate-500 md:group-hover:text-white"
      )}>
        <Smartphone className="h-7 w-7" />
      </div>
      
      <div className="flex-1 min-w-0 text-left">
        <h4 className="text-base font-black tracking-tight text-slate-900 line-clamp-1">{device.description || device.name}</h4>
        {device.description && (
          <p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-1">{device.name}</p>
        )}
        <div className="mt-0.5 flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-tight text-slate-400">
          <span>SN:{device.serialNumber.slice(-6)}</span>
          <span className="h-1 w-1 rounded-full bg-slate-200" />
          <span className={cn(
            isExpired ? "text-red-500" : isInactive ? "text-slate-400" : "text-emerald-500"
          )}>
            {isExpired ? 'Expired' : isInactive ? 'Inactive' : 'Active'}
          </span>
        </div>
      </div >

      <div className={cn(
        "h-8 w-8 flex items-center justify-center rounded-full bg-slate-50 transition-colors",
        !isExpired && !isInactive && "text-emerald-600 group-active:bg-emerald-500 group-active:text-white md:group-hover:bg-emerald-500 md:group-hover:text-white",
        isExpired && "text-red-500 group-active:bg-red-500 group-active:text-white md:group-hover:bg-red-500 md:group-hover:text-white",
        isInactive && "text-slate-300 group-active:bg-slate-500 group-active:text-white md:group-hover:bg-slate-500 md:group-hover:text-white"
      )}>
        <ChevronRight className="h-4 w-4" />
      </div>
    </button>
  );
};

export default Devices;
