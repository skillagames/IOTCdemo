import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Signal,
  AlertCircle,
  ChevronRight,
  SlidersHorizontal,
  MapPin,
  X,
  Activity,
  Server,
  Database,
  Calendar,
} from "lucide-react";
import { deviceService, Device } from "../services/deviceService";
import { useAuth } from "../context/AuthContext";
import { formatDate, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { DeviceIcon } from "../components/DeviceIcon";

const Devices: React.FC = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "expired" | "inactive"
  >("all");
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

  const filteredDevices = devices.filter((d) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      d.name.toLowerCase().includes(query) ||
      d.serialNumber.toLowerCase().includes(query) ||
      (d.imei && d.imei.toLowerCase().includes(query)) ||
      (d.materialCode && d.materialCode.toLowerCase().includes(query)) ||
      (d.barcode && d.barcode.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === "all" || d.subscriptionStatus === statusFilter;

    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const timeA = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.getTime?.() || 0;
    const timeB = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.getTime?.() || 0;
    return timeB - timeA;
  });

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
      </div>
    );

  return (
    <div className="-mt-4">
      <div className="sticky top-[calc(72px+env(safe-area-inset-top))] z-30 pt-6 pb-0 -mx-4 px-4">
        {/* Solid Background Layer */}
        <div className="absolute inset-x-0 top-0 bottom-6 bg-bg-main/95 backdrop-blur-md" />
        {/* Gradient Fade Layer */}
        <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-bg-main/95 to-transparent pointer-events-none" />

        {/* Background Decor Icon - Positioned absolute to the container to avoid clipping */}
        <Server className="absolute -top-4 -right-4 h-32 w-32 text-slate-900/[0.03] -rotate-12 pointer-events-none z-10" />

        <header className="relative z-20 px-1 pb-6">
          <div className="text-center relative z-10">
            <h1 className="text-2xl font-black font-montserrat tracking-tight text-slate-900 leading-none">
              Device Inventory
            </h1>
            <p className="mt-2 text-[10px] font-black font-montserrat uppercase tracking-[0.2em] text-slate-400">
              Total Infrastructure: {devices.length} Devices
            </p>
          </div>

          <div className="mt-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search serial, model, mat. code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl bg-white border border-slate-100 py-3.5 pl-11 pr-4 text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none transition-all shadow-sm"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-2xl border transition-all active:scale-95 shadow-sm",
                  showFilters
                    ? "bg-sky-50 border-sky-100 text-sky-900"
                    : "bg-white border-slate-100 text-slate-900",
                )}
              >
                <SlidersHorizontal className="h-5 w-5" />
              </button>
            </div>

            <AnimatePresence initial={false}>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden -mx-1 px-1 -mb-1 pb-1"
                >
                  <div className="flex w-full gap-1.5 pt-2">
                    {(["all", "active", "expired", "inactive"] as const).map(
                      (status) => (
                        <button
                          key={status}
                          onClick={() =>
                            setStatusFilter(
                              statusFilter === status ? "all" : status,
                            )
                          }
                          className={cn(
                            "flex-1 rounded-xl py-2.5 text-[8px] font-black font-montserrat uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border",
                            statusFilter === status
                              ? cn(
                                  status === "all" &&
                                    "bg-sky-50 border-sky-100 text-sky-900 shadow-sky-500/5",
                                  status === "active" &&
                                    "bg-emerald-50 border-emerald-200 text-emerald-600 shadow-emerald-500/5",
                                  status === "expired" &&
                                    "bg-red-50 border-red-200 text-red-600 shadow-red-500/5",
                                  status === "inactive" &&
                                    "bg-slate-50 border-slate-200 text-slate-500 shadow-none",
                                )
                              : "bg-white border-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-50",
                          )}
                        >
                          {status === "inactive" ? "Inactive" : status}
                        </button>
                      ),
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>
      </div>

      <div className="space-y-3 p-1 pb-32">
        {filteredDevices.length > 0 ? (
          filteredDevices.map((device, idx) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
              key={device.id}
            >
              <DeviceItem
                device={device}
                onClick={() => navigate(`/devices/${device.id}`)}
              />
            </motion.div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-50 text-slate-200">
              <Activity className="h-8 w-8" />
            </div>
            <p className="text-sm font-bold text-slate-400">
              No records matching your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const DeviceItem = ({
  device,
  onClick,
}: {
  device: Device;
  onClick: () => void;
}) => {
  const isStatusExpired = device.subscriptionStatus === "expired";
  const isInactive = device.subscriptionStatus === "inactive";

  const expirationDate = device.expirationDate?.toDate 
    ? device.expirationDate.toDate() 
    : (device.expirationDate instanceof Date 
        ? device.expirationDate 
        : (device.expirationDate?.seconds 
            ? new Date(device.expirationDate.seconds * 1000) 
            : new Date(device.expirationDate)));
            
  const isPlanExpired = isStatusExpired && expirationDate && expirationDate < new Date();
  const isDataExpired = isStatusExpired && (device.remainingDataMb || 0) <= 0;
  const isExpired = isStatusExpired;

  // Check if "New" (added in last 48 hours)
  const createdAtDate = device.createdAt?.toDate?.() || 
                       (device.createdAt instanceof Date ? device.createdAt : 
                       (device.createdAt?.seconds ? new Date(device.createdAt.seconds * 1000) : null));
  const isNew = createdAtDate && (new Date().getTime() - createdAtDate.getTime()) < 48 * 60 * 60 * 1000;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-4 rounded-[26px] bg-white p-2.5 pr-6 border transition-all active:scale-[0.98] shadow-sm",
        isExpired
          ? "border-red-100/50 active:border-red-500 active:shadow-red-500/5 md:hover:border-red-500 md:hover:shadow-red-500/5"
          : isInactive
            ? "border-slate-100 border-dashed opacity-80 active:border-slate-400 md:hover:border-slate-400"
            : "border-slate-100 active:border-emerald-500 active:shadow-xl active:shadow-emerald-500/5 md:hover:border-emerald-500 md:hover:shadow-xl md:hover:shadow-emerald-500/5",
      )}
    >
      {/* NEW Badge */}
      {isNew && (
        <div className="absolute -top-1.5 right-4 z-20">
          <div className="flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-0.5 shadow-md shadow-slate-200 ring-1 ring-white/20">
            <div className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[7px] font-black font-montserrat uppercase tracking-[0.05em] text-white">
              New
            </span>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex h-15 w-15 shrink-0 items-center justify-center rounded-[20px] transition-colors",
          !isExpired &&
            !isInactive &&
            "bg-emerald-50 text-emerald-600 group-active:bg-emerald-500 group-active:text-white md:group-hover:bg-emerald-500 md:group-hover:text-white",
          isExpired &&
            "bg-red-50 text-red-500 group-active:bg-red-500 group-active:text-white md:group-hover:bg-red-500 md:group-hover:text-white",
          isInactive &&
            "bg-slate-100 text-slate-400 group-active:bg-slate-600 group-active:text-white md:group-hover:bg-slate-600 md:group-hover:text-white",
        )}
      >
        <DeviceIcon
          className="h-6 w-6"
          description={device.description}
          name={device.name}
        />
      </div>

      <div className="flex-1 min-w-0 text-left">
        <h4 className="text-[14px] font-black font-montserrat tracking-tight text-slate-900 line-clamp-1">
          {device.description || device.name}
        </h4>
        <p className="mt-0.5 line-clamp-1 text-[11px] font-medium leading-tight text-slate-500 flex items-center gap-1">
          <MapPin className="h-2.5 w-2.5 text-slate-400" />
          {device.location || "Location Not Set"}
        </p>
        <div
          className={cn(
            "mt-1.5 flex items-center tabular-nums text-[10px] font-bold uppercase tracking-tight text-slate-400",
            !isExpired && !isInactive ? "justify-between" : "gap-1.5",
          )}
        >
          <span
            className={cn(
              "flex items-center gap-1",
              isExpired
                ? "text-red-500"
                : isInactive
                  ? "text-slate-400"
                  : "text-emerald-500",
            )}
          >
            {isPlanExpired && <Calendar className="h-2.5 w-2.5" />}
            {isDataExpired && <Database className="h-2.5 w-2.5" />}
            {isPlanExpired ? "Plan Expired" : isDataExpired ? "Data Expired" : isExpired ? "Expired" : isInactive ? "Inactive" : "Active"}
          </span>

          {!isExpired && !isInactive && (
            <>
              <div className="flex items-center gap-1 rounded-md bg-slate-100/80 px-1.5 py-0.5 text-slate-700 ring-1 ring-slate-200/50 text-[9px]">
                <Database className="h-2 w-2 text-slate-500" />
                <span className="font-black">{device.remainingDataMb?.toFixed(0)} MB</span>
              </div>
              <span className="text-slate-400 text-right">
                EXP {formatDate(device.expirationDate, "dd/MM/yy")}
              </span>
            </>
          )}

          {(isExpired || isInactive) && (
            <>
              <span className="h-0.5 w-0.5 rounded-full bg-slate-200" />
              <span>SN:{device.serialNumber.slice(-6)}</span>
            </>
          )}
        </div>
      </div>

      <div
        className={cn(
          "h-7 w-7 flex items-center justify-center rounded-full bg-slate-50 transition-colors",
          !isExpired &&
            !isInactive &&
            "text-emerald-600 group-active:bg-emerald-500 group-active:text-white md:group-hover:bg-emerald-500 md:group-hover:text-white",
          isExpired &&
            "text-red-500 group-active:bg-red-500 group-active:text-white md:group-hover:bg-red-500 md:group-hover:text-white",
          isInactive &&
            "text-slate-400 group-active:bg-slate-600 group-active:text-white md:group-hover:bg-slate-600 md:group-hover:text-white",
        )}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </button>
  );
};

export default Devices;
