import React, { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { User, Smartphone, Shield, Search, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';
import { cn, formatDate } from '../lib/utils';

const Admin: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'devices'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        adminService.getAllUsers(),
        adminService.getAllDevices()
      ]);
      setUsers(u);
      setDevices(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <header className="flex items-center justify-between">
        <div>
           <h2 className="text-2xl font-bold text-slate-900">Control Center</h2>
           <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Network Administration</p>
        </div>
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
           <Shield className="h-6 w-6" />
        </div>
      </header>

      {/* Tabs */}
      <div className="flex rounded-xl bg-white p-1 border border-slate-200 shadow-sm">
        <button 
          onClick={() => setActiveTab('users')}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
            activeTab === 'users' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:text-slate-900"
          )}
        >
          Users ({users.length})
        </button>
        <button 
          onClick={() => setActiveTab('devices')}
          className={cn(
            "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
            activeTab === 'devices' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:text-slate-900"
          )}
        >
          Devices ({devices.length})
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div></div>
      ) : (
        <div className="space-y-4 rounded-2xl bg-slate-800 p-4 shadow-xl">
          <div className="grid grid-cols-4 gap-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span className="col-span-2">Entity</span>
            <span>Status</span>
            <span className="text-right">Action</span>
          </div>
          <div className="space-y-2">
            {activeTab === 'users' ? (
              users.map((user, idx) => (
                <AdminItem 
                  key={user.uid} 
                  icon={User} 
                  title={user.email} 
                  subtitle={`Since: ${formatDate(user.createdAt, 'PP')}`}
                  badge={user.role}
                  badgeColor={user.role === 'admin' ? 'orange' : 'slate'}
                />
              ))
            ) : (
              devices.map((device, idx) => (
                <AdminItem 
                  key={device.id} 
                  icon={Smartphone} 
                  title={device.description || device.name} 
                  subtitle={`SN: ${device.serialNumber}${device.description ? ` - ${device.name}` : ''}`}
                  badge={device.subscriptionStatus}
                  badgeColor={device.subscriptionStatus === 'active' ? 'emerald' : 'orange'}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AdminItem = ({ icon: Icon, title, subtitle, badge, badgeColor }: { icon: any; title: string; subtitle: string; badge: string; badgeColor: string; [key: string]: any }) => (
  <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400">
      <Icon className="h-4 w-4" />
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="font-bold text-white text-xs truncate">{title}</h4>
      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">{subtitle}</p>
    </div>
    <div className={cn(
      "rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-tight",
      badgeColor === 'orange' ? "bg-orange-500/20 text-orange-400" : 
      badgeColor === 'emerald' ? "bg-emerald-500/20 text-emerald-400" : 
      "bg-slate-500/20 text-slate-400"
    )}>
      {badge}
    </div>
    <button className="text-slate-600 hover:text-white transition-colors">
      <MoreVertical className="h-4 w-4" />
    </button>
  </div>
);

export default Admin;
