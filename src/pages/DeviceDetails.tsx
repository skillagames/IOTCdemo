import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { deviceService, Device, UsageStat, SUBSCRIPTION_PLANS, getManufacturerLogo } from "../services/deviceService";
import {
  Activity,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CreditCard,
  Trash2,
  AlertCircle,
  Repeat,
  MapPin,
  Edit3,
  X,
  Save,
  ChevronDown,
} from "lucide-react";
import { DeviceIcon } from "../components/DeviceIcon";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { formatDate, cn } from "../lib/utils";

const DeviceDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"selection" | "payment" | "processing" | "success">("selection");
  const [cardData, setCardData] = useState({
    number: "4452 7831 2290 4452",
    expiry: "12 / 28",
    cvv: "321",
    name: "John Doe",
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(SUBSCRIPTION_PLANS[1].id);
  
  // Location functionality
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationValue, setLocationValue] = useState("");
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [isDataUsageExpanded, setIsDataUsageExpanded] = useState(false);
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);

  const getCardType = (number: string) => {
    const cleanNumber = number.replace(/\s+/g, "");
    if (/^4/.test(cleanNumber)) return "visa";
    if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(cleanNumber))
      return "mastercard";
    return "unknown";
  };

  const cardType = getCardType(cardData.number);

  useEffect(() => {
    if (showRenewModal) {
      setPaymentStep("selection");
    }
  }, [showRenewModal]);

  // Moved to deviceService.ts

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [deviceData, statsData] = await Promise.all([
        deviceService.getDeviceById(id!),
        deviceService.getUsageStats(id!),
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

  const handleActivate = async () => {
    if (!id) return;
    setIsRenewing(true);
    try {
      // Complimentary 1 year activation using the 'yearly' plan
      await deviceService.renewSubscription(id, "yearly");
      await loadData();
    } catch (err) {
      console.error("Activation failed:", err);
    } finally {
      setIsRenewing(false);
    }
  };

  const handleRenew = async () => {
    // Stage 1: Move from plan selection to payment detail entry
    if (paymentStep === "selection") {
      setPaymentStep("payment");
      return;
    }

    // Stage 2: Move from payment entry to processing animation
    if (paymentStep === "payment") {
      setPaymentStep("processing");
      
      // Simulate real 3D Secure / Bank authentication processing
      await new Promise((r) => setTimeout(r, 2000));
      
      // Stage 3: Success state
      setPaymentStep("success");
      await new Promise((r) => setTimeout(r, 1500));
      
      // Stage 4: Perform actual Firestore operation
      setIsRenewing(true);
      try {
        await deviceService.renewSubscription(id!, selectedPlan);
        await loadData();
        
        // Final transition out
        setTimeout(() => {
          setShowRenewModal(false);
          // Wait for modal exit animation before resetting state
          setTimeout(() => setPaymentStep("selection"), 500);
        }, 1000);
      } catch (err) {
        console.error("Renewal failed:", err);
        setPaymentStep("payment"); // Revert to payment screen on error
      } finally {
        setIsRenewing(false);
      }
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
      navigate("/devices");
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
    }
  };

  const handleUpdateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsUpdatingLocation(true);
    try {
      const { doc, updateDoc, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../lib/firebase");
      const deviceRef = doc(db, "devices", id);
      await updateDoc(deviceRef, {
        location: locationValue,
        lastUpdated: serverTimestamp(),
      });
      await loadData();
      setShowLocationModal(false);
    } catch (err) {
      console.error("Location update failed:", err);
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
      </div>
    );
  if (!device)
    return (
      <div className="text-center py-12 text-slate-500">Device not found</div>
    );

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

  return (
    <div className="space-y-3">
      {/* Brand Partner & Device Identity Header */}
      <section className="relative flex items-center justify-center pt-1 pb-1 px-1">
        <div className="flex flex-col items-center gap-2">
          <p className="text-[7px] font-black font-montserrat uppercase tracking-[0.5em] text-slate-400">
            Manufacturer
          </p>
          <img
            src={getManufacturerLogo(device?.manufacturer)}
            alt="Manufacturer Logo"
            className="h-6 w-auto object-contain opacity-90 transition-all duration-300"
          />
        </div>
      </section>

      <div className="mx-6 border-t border-slate-200/60" />

      {/* Location Bar */}
      <section className="px-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-3 w-3 text-primary" />
          <p className="text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-400">
            {device.location || "Add Location"}
          </p>
        </div>
        <button 
          onClick={() => {
            setLocationValue(device.location || "");
            setShowLocationModal(true);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-slate-100 text-slate-400 shadow-sm active:scale-90 transition-all"
        >
          <Edit3 className="h-3 w-3" />
        </button>
      </section>

      {/* Header Card */}
      <section className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-4 shadow-sm">
        <div
          className={cn(
            "absolute -right-8 -top-8 h-20 w-20 rounded-full blur-3xl",
            isExpired
              ? "bg-red-500/10"
              : isInactive
                ? "bg-slate-500/10"
                : "bg-primary/10",
          )}
        />

        {/* Subtle Background Icon */}
        <div className="absolute -right-6 -top-10 opacity-[0.03] pointer-events-none select-none z-0">
          <DeviceIcon
            className="h-44 w-44 -rotate-12 -scale-x-100"
            description={device.description}
            name={device.name}
          />
        </div>

        <div className="relative z-10 flex items-start">
          <div className="flex-1 space-y-1 pr-8 text-left">
            <h2 className="text-lg font-black font-montserrat text-slate-900 leading-none break-words flex items-center gap-2 flex-wrap">
              <span>{device.description || device.name}</span>
            </h2>
            {device.description && (
              <p className="text-[14px] font-medium text-slate-500 leading-tight">
                {device.name}
              </p>
            )}
            <div className="flex flex-col gap-1 mt-2">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-4">
                  <p className="text-[8px] font-black font-montserrat text-slate-400 uppercase tracking-widest whitespace-nowrap">
                    SN: {device.serialNumber}
                  </p>
                  {device.barcode && (
                    <>
                      <div className="h-2 w-px bg-slate-200" />
                      <p className="text-[8px] font-black font-montserrat text-slate-400 uppercase tracking-widest whitespace-nowrap">
                        Barcode: {device.barcode}
                      </p>
                    </>
                  )}
                </div>
                {device.materialCode && (
                  <div className="flex items-center">
                    <p className="text-[8px] font-black font-montserrat text-slate-400 uppercase tracking-widest whitespace-nowrap">
                      Material Code: {device.materialCode}
                    </p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black font-montserrat text-slate-300 uppercase tracking-widest">
                    IMEI
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums tracking-tight">
                    {device.imei || "N/A"}
                  </span>
                </div>
                <div className="h-5 w-px bg-slate-100 self-end mb-1" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black font-montserrat text-slate-300 uppercase tracking-widest">
                    ICCID
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 tabular-nums tracking-tight">
                    {device.iccid || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div
            className={cn(
              "absolute right-0 top-0 flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black font-montserrat uppercase tracking-tight whitespace-nowrap",
              isExpired && "bg-red-50 text-red-500",
              isInactive && "bg-slate-100 text-slate-500",
              !isExpired && !isInactive && "bg-emerald-50 text-emerald-600",
            )}
          >
            {isExpired ? (
              <XCircle className="h-2.5 w-2.5" />
            ) : isInactive ? (
              <AlertCircle className="h-2.5 w-2.5" />
            ) : (
              <CheckCircle2 className="h-2.5 w-2.5" />
            )}
            {isPlanExpired ? "Plan Expired" : isDataExpired ? "Data Expired" : isInactive ? "Inactive" : device.subscriptionStatus}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-slate-50 pt-3">
          <div className="flex flex-col">
            <p className="text-[7px] uppercase font-black font-montserrat text-slate-300 tracking-[0.2em] leading-none text-left">
              Data Balance
            </p>
            <div className="mt-1.5 flex flex-col gap-1.5">
              <div className="flex items-baseline gap-1">
                <p className="text-sm font-black text-slate-900 leading-none">
                  {device.remainingDataMb?.toFixed(1) || "0.0"}
                </p>
                <p className="text-[9px] font-bold text-slate-400">MB</p>
                <p className="text-[9px] font-medium text-slate-300 ml-auto">
                  of {device.totalDataMb || "0"}MB
                </p>
              </div>
              <div className="h-1 w-full bg-slate-50 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, ((device.remainingDataMb || 0) / (device.totalDataMb || 1)) * 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-colors",
                    ((device.remainingDataMb || 0) / (device.totalDataMb || 1)) < 0.2 ? "bg-red-500" : "bg-primary"
                  )}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col border-l border-slate-50 pl-4">
            <p className="text-[7px] uppercase font-black font-montserrat text-slate-300 tracking-[0.2em] leading-none text-left">
              Plan Validity
            </p>
            <p className="text-sm font-black text-slate-900 mt-1.5 leading-none text-left">
              {isInactive
                ? "Pending"
                : formatDate(device.expirationDate, "MMM dd, yyyy")}
            </p>
            {!isInactive && expirationDate && (
               <p className={cn(
                 "text-[8px] font-bold mt-1.5",
                 isExpired ? "text-red-400" : "text-emerald-500"
               )}>
                 {isPlanExpired ? "Plan Expired" : isDataExpired ? "Data Expired" : isExpired ? "License Expired" : `${Math.ceil((expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days left`}
               </p>
            )}
          </div>
        </div>
      </section>

      {/* Action Buttons Section */}
      <section className="px-1 flex justify-center">
        {isExpired || isInactive ? (
          <button
            onClick={() => (isInactive ? handleActivate() : setShowRenewModal(true))}
            disabled={isRenewing}
            className={cn(
              "flex items-center gap-2 rounded-xl px-8 py-2.5 text-[10px] font-black font-montserrat text-white transition-all active:scale-95 shadow-lg whitespace-nowrap",
              isInactive
                ? "bg-slate-900 shadow-slate-900/20"
                : "bg-red-500 shadow-red-500/20",
              isRenewing && "opacity-80 cursor-not-allowed"
            )}
          >
            {isRenewing && isInactive ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            {isInactive ? (isRenewing ? "Activating..." : "Activate") : "Renew Plan"}
          </button>
        ) : (
          <button
            onClick={handleToggleAutoRenew}
            disabled={isUpdatingAutoRenew}
            className={cn(
              "flex items-center gap-2 rounded-xl px-8 py-2.5 text-[10px] font-black font-montserrat transition-all active:scale-95 shadow-lg whitespace-nowrap border",
              device.autoRenew
                ? "bg-emerald-500 text-white border-transparent shadow-emerald-500/20"
                : "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/5 hover:bg-emerald-100/50",
            )}
          >
            {isUpdatingAutoRenew ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Repeat className="h-4 w-4" />
            )}
            {device.autoRenew ? "Auto-Renew Active" : "Enable Auto-Renew"}
          </button>
        )}
      </section>

      {/* Usage Overview */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[8px] font-black font-montserrat uppercase tracking-[0.2em] text-slate-400 leading-none">
            Usage Analytics
          </h3>
          <button
            onClick={syncTelemetry}
            disabled={isRenewing}
            className="flex items-center gap-1 text-[8px] font-black font-montserrat uppercase tracking-[0.1em] text-primary hover:opacity-80 disabled:opacity-50"
          >
            <RefreshCcw
              className={cn("h-2.5 w-2.5", isRenewing && "animate-spin")}
            />
            Sync
          </button>
        </div>

        {stats.length === 0 ? (
          <div className="relative h-[200px] w-full rounded-2xl bg-white border border-slate-200 p-1 shadow-sm overflow-hidden flex flex-col items-center justify-center gap-3 text-center">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">
                Zero Telemetry Data
              </p>
              <p className="text-[10px] text-slate-500 max-w-[160px]">
                Push a pulse or seed historical metrics to view analytics.
              </p>
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
              className="mt-1 rounded-full bg-slate-900 px-4 py-1.5 text-[9px] font-black font-montserrat uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
            >
              {isRenewing ? "Seeding..." : "Generate History Data"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Data Usage Chart */}
            <div className="rounded-2xl bg-blue-50/50 border border-blue-100 p-4 shadow-sm">
              <button 
                onClick={() => setIsDataUsageExpanded(!isDataUsageExpanded)}
                className="flex w-full items-center justify-between mb-0"
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1 bg-primary rounded-full" />
                  <div className="text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-900 flex items-center overflow-hidden">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {isDataUsageExpanded && (
                        <motion.span
                          key="daily-prefix"
                          initial={{ x: -40, opacity: 0, width: 0 }}
                          animate={{ x: 0, opacity: 1, width: "auto" }}
                          exit={{ x: -40, opacity: 0, width: 0 }}
                          transition={{ 
                            type: "spring", 
                            stiffness: 300, 
                            damping: 30,
                            opacity: { duration: 0.2 }
                          }}
                          className="inline-block whitespace-nowrap pr-1"
                        >
                          Daily
                        </motion.span>
                      )}
                    </AnimatePresence>
                    <motion.span layout transition={{ type: "spring", stiffness: 300, damping: 30 }}>
                      Data Consumption
                    </motion.span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <p className="text-xs font-black text-primary">
                    {stats.reduce((acc, s) => acc + s.dataUsedMb, 0).toFixed(1)} MB
                  </p>
                  <motion.div
                    animate={{ rotate: isDataUsageExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
                  </motion.div>
                </div>
              </button>
              
              <AnimatePresence>
                {isDataUsageExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="h-[140px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#f1f5f9"
                          />
                          <XAxis
                            dataKey="timestamp"
                            tickFormatter={(val) => formatDate(val, "dd")}
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis hide />
                          <Tooltip
                            cursor={{ fill: '#f8fafc' }}
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: "12px",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                              padding: "8px 12px",
                            }}
                            itemStyle={{ color: "#3b82f6", fontSize: "11px", fontWeight: "bold" }}
                            labelStyle={{ display: "none" }}
                          />
                          <Bar
                            dataKey="dataUsedMb"
                            fill="#3b82f6"
                            radius={[4, 4, 0, 0]}
                          >
                            {stats.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.dataUsedMb > 400 ? "#ef4444" : "#3b82f6"} 
                                fillOpacity={0.8}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Activity Trend Chart */}
            <div className="rounded-2xl bg-emerald-50/50 border border-emerald-100 p-4 shadow-sm">
              <button 
                onClick={() => setIsActivityExpanded(!isActivityExpanded)}
                className="flex w-full items-center justify-between mb-0"
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-1 bg-emerald-500 rounded-full" />
                  <p className="text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-900">
                    Activity Lifecycle
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <p className="text-xs font-black text-emerald-500">
                    {stats.reduce((acc, s) => acc + s.activeHours, 0)} Hours
                  </p>
                  <motion.div
                    animate={{ rotate: isActivityExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="h-3.5 w-3.5 text-slate-300" />
                  </motion.div>
                </div>
              </button>

              <AnimatePresence>
                {isActivityExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0, marginTop: 0 }}
                    animate={{ height: "auto", opacity: 1, marginTop: 16 }}
                    exit={{ height: 0, opacity: 0, marginTop: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="h-[140px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats}>
                          <defs>
                            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#f1f5f9"
                          />
                          <XAxis
                            dataKey="timestamp"
                            tickFormatter={(val) => formatDate(val, "dd")}
                            stroke="#94a3b8"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: "12px",
                              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                              padding: "8px 12px",
                            }}
                            itemStyle={{ color: "#10b981", fontSize: "11px", fontWeight: "bold" }}
                            labelStyle={{ display: "none" }}
                          />
                          <Area
                            type="monotone"
                            dataKey="activeHours"
                            stroke="#10b981"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#colorActivity)"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

      </section>

      {/* Danger Zone */}
      <section className="pt-1">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="group flex w-full items-center justify-center gap-2 rounded-xl border border-red-50 bg-red-50/5 py-2.5 text-[8px] font-black font-montserrat uppercase tracking-[0.3em] text-red-300 hover:text-red-500 transition-all active:scale-[0.98] hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
          Destroy Device Node
        </button>
      </section>

      {/* Renew Modal */}
      <AnimatePresence>
        {showRenewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => !isRenewing && paymentStep !== "processing" && setShowRenewModal(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
              style={{ willChange: "opacity, backdrop-filter" }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: -20 }}
              exit={{ opacity: 0, scale: 0.95, y: 0 }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 400,
                mass: 0.8,
              }}
              className={cn(
                "relative w-full max-w-sm rounded-[32px] p-7 shadow-2xl overflow-hidden border border-slate-100 h-[540px] flex flex-col transition-colors duration-500",
                paymentStep === "payment" ? "bg-[#f8fbff]" : "bg-white"
              )}
              style={{ willChange: "transform, opacity" }}
            >
              <AnimatePresence mode="wait">
                {paymentStep === "selection" && (
                  <motion.div
                    key="selection"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="relative flex flex-col items-center text-center h-full"
                  >
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 text-white mb-4 shadow-lg shadow-indigo-400/20"
                      >
                        <CreditCard className="h-6 w-6" />
                      </motion.div>

                      <h2 className="text-xl font-black font-montserrat text-slate-900 tracking-tight">
                        Expand Connectivity
                      </h2>
                      <p className="text-[10px] font-bold font-montserrat text-slate-400 uppercase tracking-widest mt-1">
                        Select your power profile
                      </p>

                      <div className="mt-6 w-full space-y-1.5 overflow-y-auto max-h-[220px] pr-1">
                        {SUBSCRIPTION_PLANS.map((plan) => {
                          const { id, ...rest } = plan;
                          return (
                            <PlanOption
                              key={id}
                              {...rest}
                              active={selectedPlan === id}
                              onClick={() => setSelectedPlan(id)}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6 w-full space-y-3 shrink-0">
                      <button
                        onClick={handleRenew}
                        className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl bg-slate-900 py-4 text-[10px] font-black font-montserrat uppercase tracking-[0.2em] text-white transition-all hover:bg-slate-800 active:scale-95"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 transition-opacity group-hover:opacity-100" />
                        <span className="relative z-10 flex items-center gap-2">
                          Confirm Upgrade <CreditCard className="h-3.5 w-3.5" />
                        </span>
                      </button>
                      <button
                        onClick={() => setShowRenewModal(false)}
                        className="w-full py-1 text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
                {paymentStep === "payment" && (
                  <motion.div
                    key="payment"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="relative flex flex-col items-center h-full"
                  >
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 text-white mb-4 shadow-lg shadow-indigo-400/20">
                        <CreditCard className="h-6 w-6" />
                      </div>
                      
                      <h2 className="text-xl font-black font-montserrat text-slate-900 tracking-tight text-center">
                        Payment Details
                      </h2>
                      <p className="text-[10px] font-bold font-montserrat text-slate-400 uppercase tracking-widest mt-1 text-center">
                        Secure Transaction
                      </p>
                      <div className="mt-4 mb-2 w-full">
                        <div className="mx-auto flex flex-col items-center justify-center bg-slate-50 px-6 py-3 rounded-[28px] border border-slate-100 shadow-sm w-fit min-w-[130px]">
                          <span className="text-[8px] font-black font-montserrat text-slate-400 uppercase tracking-widest leading-none mb-1">
                            Total Charge
                          </span>
                          <span className="text-lg font-black text-slate-900 leading-none">
                            {SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.price}
                          </span>
                        </div>
                      </div>
   
                      <div className="mt-6 w-full space-y-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black font-montserrat uppercase tracking-widest text-slate-400 ml-1">Card Holder</label>
                          <input
                            type="text"
                            value={cardData.name}
                            onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                            placeholder="John Doe"
                            className="h-10 w-full rounded-xl border border-slate-100 bg-white px-4 text-sm font-bold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black font-montserrat uppercase tracking-widest text-slate-400 ml-1">Card Number</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={cardData.number}
                              onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                              className="h-10 w-full rounded-xl border border-slate-100 bg-white px-4 pr-12 text-sm font-bold text-slate-600 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300 tabular-nums"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {cardType === "visa" && (
                                <div className="flex h-5 w-8 items-center justify-center rounded bg-[#1a1f71] px-1 text-[7px] font-black italic text-white shadow-sm">
                                  VISA
                                </div>
                              )}
                              {cardType === "mastercard" && (
                                <div className="flex h-5 w-8 items-center justify-center gap-0">
                                  <div className="z-10 h-3.5 w-3.5 rounded-full bg-[#eb001b] shadow-sm" />
                                  <div className="-ml-2 h-3.5 w-3.5 rounded-full bg-[#f79e1b] shadow-sm" />
                                </div>
                              )}
                              {cardType === "unknown" && (
                                <CreditCard className="h-4 w-4 text-slate-300" />
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black font-montserrat uppercase tracking-widest text-slate-400 ml-1">Expiry</label>
                            <input
                              type="text"
                              value={cardData.expiry}
                              onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                              className="h-10 w-full rounded-xl border border-slate-100 bg-white px-4 text-sm text-slate-600 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black font-montserrat uppercase tracking-widest text-slate-400 ml-1">CVV</label>
                            <input
                              type="password"
                              value={cardData.cvv}
                              onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                              className="h-10 w-full rounded-xl border border-slate-100 bg-white px-4 text-sm text-slate-600 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
   
                    <div className="mt-6 w-full space-y-3 shrink-0">
                      <button
                        onClick={handleRenew}
                        disabled={!cardData.name || !cardData.number}
                        className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-indigo-400 to-blue-500 py-3.5 text-[10px] font-black font-montserrat uppercase tracking-[0.2em] text-white shadow-xl shadow-indigo-400/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100"
                      >
                       Confirm Payment
                      </button>
                      <button
                        onClick={() => setPaymentStep("selection")}
                        className="w-full py-1 text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Back to Plans
                      </button>
                    </div>
                  </motion.div>
                )}

                {paymentStep === "processing" && (
                  <motion.div
                    key="processing"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-12"
                  >
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full border-4 border-slate-100" />
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 h-16 w-16 rounded-full border-4 border-indigo-500 border-t-transparent"
                      />
                    </div>
                    <h2 className="mt-6 text-lg font-black font-montserrat text-slate-900 tracking-tight">
                      Authorizing Payment
                    </h2>
                    <p className="mt-1 text-[10px] font-bold font-montserrat text-slate-400 uppercase tracking-widest">
                      Communicating with Bank...
                    </p>
                  </motion.div>
                )}

                {paymentStep === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center py-8"
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h2 className="mt-6 text-xl font-black font-montserrat text-slate-900 tracking-tight">
                      Payment Successful
                    </h2>
                    <p className="mt-1 text-[10px] font-bold font-montserrat text-slate-400 uppercase tracking-widest">
                      Your plan is being updated
                    </p>
                    <div className="mt-4 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        initial={{ x: "-100%" }}
                        animate={{ x: "0%" }}
                        transition={{ duration: 1.5 }}
                        className="h-full w-full bg-emerald-500"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Modal */}
      <AnimatePresence>
        {/* Edit Location Modal */}
        {showLocationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLocationModal(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-black font-montserrat text-slate-900 leading-none">
                    Update Location
                  </h3>
                  <p className="text-[9px] font-black font-montserrat uppercase tracking-widest text-slate-400 mt-2">
                    Physical Placement Protocol
                  </p>
                </div>
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="p-2 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateLocation} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-500 ml-1">
                    Device Location
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={locationValue}
                      onChange={(e) => setLocationValue(e.target.value)}
                      placeholder="e.g. Server Room A, Gate 4"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-xs font-bold text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                      autoFocus
                    />
                    <MapPin className="absolute right-4 top-3.5 h-4 w-4 text-slate-300" />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpdatingLocation}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-[10px] font-black font-montserrat uppercase tracking-widest text-white shadow-lg shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isUpdatingLocation ? (
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isUpdatingLocation ? "Updating..." : "Establish Location"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

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
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-[32px] bg-white p-5 shadow-2xl overflow-hidden"
            >
              <div className="flex flex-col items-center text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-500 mb-3">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <h2 className="text-lg font-black font-montserrat text-slate-900 tracking-tight">
                  Decommission Device?
                </h2>
                <p className="text-[10px] font-bold font-montserrat text-slate-400 uppercase tracking-widest mt-1 px-4 leading-relaxed">
                  This will permanently purge all telemetry and historical usage
                  data.
                </p>

                <div className="mt-6 w-full space-y-2">
                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-red-500 py-3.5 text-[10px] font-black font-montserrat uppercase tracking-widest text-white shadow-xl shadow-red-500/10 transition-all hover:bg-red-600 active:scale-95 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <RefreshCcw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Purge Device</>
                    )}
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="w-full py-1 text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
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

interface PlanOptionProps {
  key?: number | string;
  name: string;
  price: string;
  desc: string;
  badge?: string;
  active?: boolean;
  onClick: () => void;
}

const PlanOption = ({
  name,
  price,
  desc,
  badge,
  active,
  onClick,
}: PlanOptionProps) => (
  <button
    onClick={onClick}
    className={cn(
      "relative flex w-full items-center justify-between rounded-2xl border p-3.5 text-left transition-all active:scale-[0.98]",
      active
        ? "border-indigo-400 bg-gradient-to-br from-indigo-400 to-blue-500 text-white shadow-lg shadow-indigo-400/20"
        : "border-slate-100 bg-white hover:border-slate-200",
    )}
  >
    {badge && (
      <div
        className={cn(
          "absolute -top-2 right-4 rounded-full px-2 py-0.5 text-[7px] font-black font-montserrat uppercase tracking-widest shadow-sm",
          active ? "bg-white text-indigo-500" : "bg-indigo-400 text-white",
        )}
      >
        {badge}
      </div>
    )}
    <div className="min-w-0">
      <h4
        className={cn(
          "font-black font-montserrat text-[10px] uppercase tracking-wider truncate",
          active ? "text-white" : "text-slate-900",
        )}
      >
        {name}
      </h4>
      <p
        className={cn(
          "text-[9px] font-medium leading-none mt-1",
          active ? "text-indigo-100" : "text-slate-400",
        )}
      >
        {desc}
      </p>
    </div>
    <div className="text-right ml-4 shrink-0">
      <p
        className={cn(
          "text-xs font-black",
          active ? "text-white" : "text-slate-900",
        )}
      >
        {price}
      </p>
    </div>
  </button>
);

export default DeviceDetails;
