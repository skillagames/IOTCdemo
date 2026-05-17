import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Network,
  Battery,
  Signal,
  ChevronRight,
  PlusCircle,
  AlertCircle,
  X,
  Zap,
  Activity,
  ShieldCheck,
  Cpu,
  LayoutGrid,
  MapPin,
  Workflow,
  LogOut,
  User,
  Settings,
  Database,
  Calendar,
} from "lucide-react";
import { deviceService, Device } from "../services/deviceService";
import { useAuth } from "../context/AuthContext";
import { formatDate, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { DeviceIcon } from "../components/DeviceIcon";

const Dashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "active" | "expired" | "inactive" | null
  >(null);
  const [isSticky, setIsSticky] = useState(false);
  const [isStickyHidden, setIsStickyHidden] = useState(false);
  const navigate = useNavigate();
  const statsRef = useRef<HTMLElement>(null);
  const insightsRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const secondLastItemRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(false);

  const handleFilterChange = (newFilter: typeof filter) => {
    isAutoScrolling.current = true;
    setFilter(newFilter);
    setTimeout(() => {
      isAutoScrolling.current = false;
      window.dispatchEvent(new Event("scroll"));
    }, 1000);
  };

  useEffect(() => {
    if (user) {
      loadDevices();
      deviceService.seedMasterRegistry();
    }
  }, [user]);

  useEffect(() => {
    // Automatically scroll to the filter section when a status is selected
    // but only if we are not already looking at the inventory
    if (!loading && filter && scrollAnchorRef.current) {
      const sat =
        parseInt(getComputedStyle(document.body).getPropertyValue("--sat")) ||
        0;
      const offset = scrollAnchorRef.current.offsetTop - (72 + sat);
      const currentScroll = window.scrollY;

      // Scroll if the inventory isn't in view
      if (Math.abs(currentScroll - offset) > 2) {
        window.scrollTo({ top: offset, behavior: "smooth" });
      }

      // Also reset the internal list scroll to the top
      if (listRef.current) {
        listRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [filter, loading]);

  useLayoutEffect(() => {
    const handleScroll = () => {
      // Logic to toggle sticky state based on hero section height
      const sat = parseInt(getComputedStyle(document.body).getPropertyValue("--sat")) || 0;
      const stickyThreshold = (scrollAnchorRef.current?.offsetTop || 0) - (72 + sat);
      
      // Trigger sticky state slightly before it actually sticks to account for scroll speed/framerates
      if (window.scrollY >= stickyThreshold - 8) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }

      if (isAutoScrolling.current) return;

      // Hide sticky header ONLY if insights mode is enabled
      const showInsights = profile?.showInsights !== false;

      if (showInsights) {
        const insightsTop = insightsRef.current?.offsetTop ?? Infinity;
        const isAtBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 20;

        let shouldHide = false;
        const secondLastItem = secondLastItemRef.current;
        
        if (secondLastItem) {
          const rect = secondLastItem.getBoundingClientRect();
          const stickyThreshold = 140; // Position below viewport top to trigger hide
          
          // If the item is above the threshold (scrolling down), hide
          // if it's below (scrolling up), show
          if (rect.top < -20 || isAtBottom) {
            shouldHide = true;
          }
        } else {
          // Fallback if no second-last item
          if (window.scrollY + 140 > insightsTop || isAtBottom) {
            shouldHide = true;
          }
        }

        // Safety: Never hide if we are at the very top of the page
        if (window.scrollY < 10) {
          shouldHide = false;
        }

        setIsStickyHidden(shouldHide);
      } else {
        setIsStickyHidden(false);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initialize state immediately
    handleScroll();
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, [profile?.showInsights, devices.length, loading]);

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

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent"></div>
      </div>
    );

  const firstName = profile?.displayName?.split(" ")[0] || "Member";
  const activeCount = devices.filter((d) => d.subscriptionStatus === "active").length;
  const totalCount = devices.length || 1;
  const healthEfficiency = Math.round((activeCount / totalCount) * 100);

  // Calculated metrics for insights (shifting to realistic IoT throughput)
  const throughputValue = activeCount > 0 ? (activeCount * 12 + Math.floor(Math.random() * 20)).toString() : "0";
  const latencyValue = activeCount > 0 ? (85 + Math.floor(Math.random() * 45)).toString() : "--";

  // Dynamic Logistics Items
  const logisticsLogs = [
    // 1. Critical Alert (Expired)
    ...(devices.find(d => d.subscriptionStatus === "expired") ? [{
      icon: AlertCircle,
      title: "Service Dropout",
      desc: `${devices.find(d => d.subscriptionStatus === "expired")?.description || "Device"} plan expired`,
      time: "Now",
      color: "red" as const
    }] : []),
    // 2. Warning (Low Data)
    ...(activeCount > 0 && devices.find(d => d.subscriptionStatus === "active" && (d.remainingDataMb / (d.totalDataMb || 360)) < 0.2) ? [{
      icon: Activity,
      title: "Capacity Warning",
      desc: `${devices.find(d => d.subscriptionStatus === "active" && (d.remainingDataMb / (d.totalDataMb || 360)) < 0.2)?.description || "Device"} low on data`,
      time: "12m ago",
      color: "red" as const
    }] : []),
    // 3. Status (Active Pulse)
    ...(activeCount > 0 ? [{
      icon: Zap,
      title: "Telemetry Sync",
      desc: `${activeCount} nodes relaying signals`,
      time: "2m ago",
      color: "blue" as const
    }] : []),
    // 4. Default / Standby
    {
      icon: ShieldCheck,
      title: "System Secure",
      desc: "Continuous monitoring active",
      time: "Online",
      color: "emerald" as const
    }
  ].slice(0, 3);

  const filteredDevices = (filter
    ? devices.filter((d) => d.subscriptionStatus === filter)
    : devices
  ).sort((a, b) => {
    const timeA = a.createdAt?.toDate?.()?.getTime() || a.createdAt?.getTime?.() || 0;
    const timeB = b.createdAt?.toDate?.()?.getTime() || b.createdAt?.getTime?.() || 0;
    return timeB - timeA;
  });

  return (
    <div className="pb-0 min-h-screen">
      {/* Hero Welcome Section - Compressed Sleek Header */}
      <section className="pt-3.5 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-visible rounded-[32px] p-4"
        >
          {/* Animated Cluster Network Background */}
          <div className="absolute -right-12 -top-20 text-slate-300/30 pointer-events-none z-0">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 300, repeat: Infinity, ease: "linear" }}
            >
              <svg
                width="240"
                height="240"
                viewBox="0 0 24 24"
                overflow="visible"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="rotate-12"
              >
                {/* Central Hub */}
                <motion.circle
                  cx="12"
                  cy="12"
                  r="1.2"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 1, 0.5], scale: [0, 1.2, 1, 1] }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    times: [0, 0.1, 0.2, 1],
                  }}
                  fill="currentColor"
                  fillOpacity="0.1"
                />

                {/* Primary Nodes and Connections */}
                {[
                  { x: 19, y: 15, d: 0.5, r: 0.8 },
                  { x: 6, y: 17, d: 2.5, r: 0.8 },
                  { x: 13, y: 5, d: 4.5, r: 0.8 },
                  { x: 18, y: 8, d: 6.5, r: 0.8 },
                  { x: 7, y: 9, d: 8.5, r: 0.8 },
                ].map((node, i) => {
                  // Calculate direction for line shortening to avoid center overlap
                  const dx = node.x - 12;
                  const dy = node.y - 12;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  const startMargin = 1.5; // Hub radius + gap
                  const endMargin = node.r + 0.5; // Node radius + gap

                  const x1 = 12 + (dx / dist) * startMargin;
                  const y1 = 12 + (dy / dist) * startMargin;
                  const x2 = node.x - (dx / dist) * endMargin;
                  const y2 = node.y - (dy / dist) * endMargin;

                  return (
                    <React.Fragment key={i}>
                      <motion.line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                          pathLength: [0, 1, 1, 0],
                          opacity: [0, 1, 0.5, 0],
                        }}
                        transition={{
                          duration: 8,
                          delay: node.d,
                          repeat: Infinity,
                          times: [0, 0.2, 0.8, 1],
                        }}
                      />
                      <motion.circle
                        cx={node.x}
                        cy={node.y}
                        r={node.r}
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{
                          opacity: [0, 1, 0.8, 0],
                          scale: [0, 1, 1, 0.5],
                        }}
                        transition={{
                          duration: 8,
                          delay: node.d + 0.5,
                          repeat: Infinity,
                          times: [0, 0.1, 0.9, 1],
                        }}
                        fill="currentColor"
                        fillOpacity="0.05"
                      />
                    </React.Fragment>
                  );
                })}

                {/* Secondary Cross-Connections (Dashed) */}
                {[
                  { x1: 19, y1: 15, x2: 18, y2: 8, d: 3 },
                  { x1: 6, y1: 17, x2: 7, y2: 9, d: 5 },
                  { x1: 13, y1: 5, x2: 18, y2: 8, d: 7 },
                ].map((line, i) => {
                  // Simple straight lines for secondary as they are subtle
                  return (
                    <motion.line
                      key={`link-${i}`}
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{
                        pathLength: [0, 1, 1, 0],
                        opacity: [0, 0.3, 0.2, 0],
                      }}
                      transition={{
                        duration: 10,
                        delay: line.d,
                        repeat: Infinity,
                        times: [0, 0.3, 0.7, 1],
                      }}
                      strokeDasharray="0.5 1"
                    />
                  );
                })}
              </svg>
            </motion.div>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <div className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Network: Online
                </span>
              </div>
              <h1 className="text-2xl font-black font-montserrat tracking-tighter text-slate-900 leading-none">
                Hello, <span className="text-slate-500">{firstName}</span>
              </h1>
              <p className="text-[10px] font-medium text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                Your network is secure.{" "}
                {
                  devices.filter((d) => d.subscriptionStatus === "active")
                    .length
                }{" "}
                active devices running.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <button
                onClick={() => navigate("/scan")}
                className="flex-1 group flex items-center justify-center gap-2.5 rounded-2xl border border-sky-100 bg-sky-50 px-3 md:px-6 py-3 text-sky-900 transition-all active:scale-95 hover:bg-sky-100 shadow-sm"
              >
                <PlusCircle className="h-4 w-4 shrink-0 text-sky-600 transition-colors" />
                <span className="text-[10px] font-black font-montserrat uppercase tracking-widest whitespace-nowrap">
                  Add Device
                </span>
              </button>
              <button
                onClick={() => navigate("/devices")}
                className="flex-1 group flex items-center justify-center gap-2.5 rounded-2xl border border-sky-100 bg-sky-50 px-3 md:px-6 py-3 text-sky-900 transition-all active:scale-95 hover:bg-sky-100 shadow-sm"
              >
                <Network className="h-4 w-4 shrink-0 text-sky-600 transition-colors" />
                <span className="text-[10px] font-black font-montserrat uppercase tracking-widest whitespace-nowrap">
                  All devices
                </span>
              </button>
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-around gap-5 border-t border-slate-50 pt-3.5">
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black font-montserrat text-slate-300 uppercase tracking-widest leading-none whitespace-nowrap">
                Active Pool
              </span>
              <span className="text-[11px] font-bold text-slate-900 mt-1 leading-none">
                {
                  devices.filter((d) => d.subscriptionStatus === "active")
                    .length
                }
              </span>
            </div>
            <div className="h-3 w-px bg-slate-100" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black font-montserrat text-slate-300 uppercase tracking-widest leading-none whitespace-nowrap">
                Network Health
              </span>
              <span className="text-[11px] font-bold text-slate-900 mt-1 leading-none">
                {healthEfficiency}%
              </span>
            </div>
            <div className="h-3 w-px bg-slate-100" />
            <div className="flex flex-col items-center">
              <span className="text-[8px] font-black font-montserrat text-slate-300 uppercase tracking-widest leading-none whitespace-nowrap">
                Logistics
              </span>
              <span className="text-[11px] font-bold text-slate-900 mt-1 leading-none">
                {activeCount > 0 ? "Operational" : "Standby"}
              </span>
            </div>
          </div>
        </motion.div>
      </section>

      <div ref={scrollAnchorRef} className="h-0 w-full" />

      {/* Stats Quick View - Constant Sticky Header */}
      <section
        ref={statsRef}
        className={cn(
          "sticky top-[calc(72px+env(safe-area-inset-top))] z-20 pt-4 pb-0 bg-bg-main transition-all duration-300 before:content-[''] before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-bg-main",
          isStickyHidden && isSticky
            ? "-translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100",
        )}
      >
        {/* Bottom fade for sticky mode only - prevents harsh cut against the list */}
        {isSticky && (
          <div className="absolute inset-x-0 -bottom-2 h-3 bg-gradient-to-b from-bg-main via-bg-main/70 to-transparent pointer-events-none" />
        )}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="ACTIVE"
            value={devices
              .filter((d) => d.subscriptionStatus === "active")
              .length.toString()}
            color="emerald"
            icon={Signal}
            isActive={filter === "active"}
            onClick={() =>
              handleFilterChange(filter === "active" ? null : "active")
            }
          />
          <StatCard
            label="EXPIRED"
            value={devices
              .filter((d) => d.subscriptionStatus === "expired")
              .length.toString()}
            color="red"
            icon={AlertCircle}
            isActive={filter === "expired"}
            onClick={() =>
              handleFilterChange(filter === "expired" ? null : "expired")
            }
          />
          <StatCard
            label="INACTIVE"
            value={devices
              .filter((d) => d.subscriptionStatus === "inactive")
              .length.toString()}
            color="slate"
            icon={Activity}
            isActive={filter === "inactive"}
            onClick={() =>
              handleFilterChange(filter === "inactive" ? null : "inactive")
            }
          />
        </div>

        <div className="flex items-center justify-between h-8 mt-2 pb-1 transition-all duration-300">
          <div className="flex items-center gap-2">
            <h2 className="text-[9px] font-black font-montserrat uppercase tracking-[0.2em] text-slate-500">
              Quick Inventory
            </h2>
            <div className="flex items-center h-6 min-w-[70px]">
              <AnimatePresence mode="wait">
                {filter && (
                  <motion.button
                    key={filter}
                    initial={{ opacity: 0, scale: 0.9, x: -5 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.9, x: -5 }}
                    onClick={() => handleFilterChange(null)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[8px] font-black font-montserrat uppercase tracking-widest border transition-all active:scale-95 shadow-sm",
                      filter === "active" &&
                        "bg-emerald-50 text-emerald-600 border-emerald-100",
                      filter === "expired" &&
                        "bg-red-50 text-red-600 border-red-100",
                      filter === "inactive" &&
                        "bg-slate-50 text-slate-500 border-slate-200",
                    )}
                  >
                    <span>{filter}</span>
                    <X className="h-2 w-2 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
          <span className="text-[9px] font-bold text-slate-400 tabular-nums tracking-tight">
            {filteredDevices.length} DEVICE(S)
          </span>
        </div>
      </section>

      {/* Natural List with Independent Scroll (conditional) */}
      <section className="relative mt-1">
        <div
          ref={listRef}
          className={cn(
            "pr-1 -mr-1 scrollbar-thin scrollbar-thumb-slate-200 relative transition-all duration-300 ease-in-out",
            filter
              ? "h-auto overflow-visible pb-4 pt-1"
              : "min-h-[405px] h-auto overflow-visible pb-4 pt-1",
          )}
        >
          <div className="grid gap-3 px-1 pb-1">
            <AnimatePresence initial={false}>
              {filteredDevices.length > 0 ? (
                filteredDevices.map((device, index) => (
                  <motion.div
                    ref={index === Math.max(0, filteredDevices.length - 2) ? secondLastItemRef : null}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{
                      duration: 0.2,
                      layout: { type: "spring", bounce: 0, duration: 0.4 },
                    }}
                    key={device.id}
                    style={{ willChange: "transform, opacity" }}
                  >
                    <DeviceCard
                      device={device}
                      onClick={() => navigate(`/devices/${device.id}`)}
                    />
                  </motion.div>
                ))
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key="empty-state"
                  className="flex flex-col items-center justify-center gap-4 py-16 text-center"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-white border border-slate-100 text-slate-200 shadow-sm">
                    <Activity className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    {filter
                      ? `No ${filter} devices found`
                      : "No devices provisioned"}
                  </p>
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* Cluster Insights Section */}
      {profile?.showInsights !== false && (
        <section ref={insightsRef} className="space-y-4 pt-2 mt-10">
          <div className="flex items-center justify-between pb-2">
            <h2 className="text-[9px] font-black font-montserrat uppercase tracking-[0.2em] text-slate-500">
              Network Insights
            </h2>
            <div className="flex h-1 w-12 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-primary w-2/3" />
            </div>
          </div>

          <div className="grid gap-4">
            {/* Combined Health & Logistics Overview */}
            <div className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-bg-main shadow-sm p-5 flex flex-col group">
              {/* Background accents */}
              <div className="absolute -top-8 -right-6 h-32 w-32 rounded-full bg-blue-100/40 pointer-events-none transition-transform group-hover:scale-110 duration-700" />
              <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-50/50 pointer-events-none transition-transform group-hover:scale-110 duration-700" />
              <div className="absolute bottom-0 right-0 p-5 pointer-events-none opacity-20 group-hover:opacity-10 transition-opacity">
                <motion.svg
                  width="120"
                  height="120"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-slate-400 w-32 h-32"
                >
                  <motion.path
                    d="M2 12h4l3 9L15 3l3 9h4"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{
                      pathLength: [0, 1, 1],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear",
                      times: [0, 0.7, 1],
                    }}
                  />
                  {/* Subtle static trace for contrast */}
                  <path
                    d="M2 12h4l3 9L15 3l3 9h4"
                    className="opacity-10"
                    strokeWidth="0.5"
                  />
                </motion.svg>
              </div>

              {/* Combined Header using requested Live Logistics style */}
              <div className="flex items-center justify-between mb-5 relative z-10">
                <div className="flex items-center gap-2">
                  <Workflow className="h-4 w-4 text-blue-500" />
                  <h4 className="text-[10px] font-black font-montserrat uppercase tracking-[0.2em] text-slate-500">
                    Operational Status & Logistics
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Live
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                {/* Operational Status (Left) */}
                <div className="flex flex-col h-full">
                  <div className="space-y-1 mb-4">
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                      Network optimized at {healthEfficiency}% efficiency.{" "}
                      {activeCount} active devices running within clusters.
                    </p>
                  </div>

                  <div className="flex items-center gap-5 mt-auto">
                    <div className="relative flex h-[60px] w-[60px] shrink-0 items-center justify-center">
                      <svg className="h-full w-full -rotate-90 transform drop-shadow-lg">
                        <defs>
                          <linearGradient
                            id="healthGrad"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="100%"
                          >
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                        <circle
                          cx="30"
                          cy="30"
                          r="26"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          className="text-slate-100"
                        />
                        <motion.circle
                          initial={{ strokeDashoffset: 163.36 }}
                          animate={{
                            strokeDashoffset:
                              163.36 -
                              163.36 * (healthEfficiency / 100),
                          }}
                          transition={{ duration: 1.5, ease: "easeOut" }}
                          cx="30"
                          cy="30"
                          r="26"
                          stroke="url(#healthGrad)"
                          strokeWidth="6"
                          strokeLinecap="round"
                          fill="transparent"
                          strokeDasharray="163.36"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center leading-none">
                        <span className="text-[11px] font-black text-slate-900">
                          {healthEfficiency}
                          <span className="text-[8px]">%</span>
                        </span>
                      </div>
                    </div>
 
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex items-center justify-between rounded-xl bg-slate-50/80 border border-slate-200 px-3 py-2">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                          Throughput
                        </span>
                        <span className="text-[10px] font-black text-slate-900 tabular-nums">
                          {throughputValue} <span className="text-[7px] font-sans">KB/S</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-xl bg-slate-50/80 border border-slate-200 px-3 py-2">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">
                          Latency
                        </span>
                        <span className="text-[10px] font-black text-slate-900 tabular-nums">
                          {latencyValue} <span className="text-[7px] font-sans">MS</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
 
                {/* Logistics Timeline (Right) */}
                <div className="relative space-y-3.5 before:absolute before:inset-y-2 before:left-[15.5px] before:w-px before:bg-slate-100">
                  {logisticsLogs.map((log, idx) => (
                    <LogItem
                      key={idx}
                      icon={log.icon}
                      title={log.title}
                      desc={log.desc}
                      time={log.time}
                      color={log.color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Brand Partner Logo */}
      <section className="flex flex-col items-center justify-center pt-2 pb-12 mt-14">
        <div className="flex flex-col items-center gap-2.5">
          <p className="text-[7px] font-black font-montserrat uppercase tracking-[0.5em] text-slate-400">
            Hardware Partner
          </p>
          <img
            src="/hikvision.svg"
            alt="Hikvision Logo"
            className="h-5 w-auto object-contain grayscale opacity-40"
          />
        </div>
      </section>
    </div>
  );
};

const LogItem = ({
  icon: Icon,
  title,
  desc,
  time,
  color,
}: {
  icon: any;
  title: string;
  desc: string;
  time: string;
  color: "blue" | "emerald" | "red";
  key?: any;
}) => (
  <div className="group relative flex items-center gap-4">
    <div
      className={cn(
        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white transition-colors group-hover:border-slate-200/60 shadow-sm",
        color === "blue" && "text-blue-500",
        color === "emerald" && "text-emerald-500",
        color === "red" && "text-red-500",
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
    <div className="flex-1 min-w-0">
      <h5 className="text-xs font-bold font-montserrat text-slate-900 leading-tight truncate">
        {title}
      </h5>
      <p className="text-[10px] text-slate-500 leading-tight truncate">{desc}</p>
    </div>
    <span className="shrink-0 text-[9px] font-bold text-slate-400 tabular-nums bg-white/50 px-1.5 py-0.5 rounded shadow-sm">
      {time}
    </span>
  </div>
);

const DeviceCard = ({
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
  // Fallback if status is expired but neither condition is strictly met in UI logic
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
        "group relative flex w-full items-center gap-4 rounded-[24px] bg-white p-1.5 pr-5 border transition-all active:scale-[0.98] shadow-sm",
        isExpired
          ? "border-red-100/50 active:border-red-500 md:hover:border-red-500"
          : isInactive
            ? "border-slate-50 opacity-90 border-dashed active:border-slate-300 md:hover:border-slate-300"
            : "border-slate-100 active:border-emerald-500 md:hover:border-emerald-500",
      )}
    >
      {/* NEW Badge */}
      {isNew && (
        <div className="absolute -top-1.5 right-4 z-20">
          <div className="flex items-center gap-1 rounded-full bg-slate-900 px-2 py-0.5 shadow-md shadow-slate-200 ring-1 ring-white/20">
            <div className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[7px] font-black font-montserrat uppercase tracking-[0.05em] text-white">
              New
            </span>
          </div>
        </div>
      )}

      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] transition-colors",
          !isExpired &&
            !isInactive &&
            "bg-emerald-50 text-emerald-500 group-active:bg-emerald-500 group-active:text-white md:group-hover:bg-emerald-500 md:group-hover:text-white",
          isExpired &&
            "bg-red-50 text-red-400 group-active:bg-red-500 group-active:text-white md:group-hover:bg-red-500 md:group-hover:text-white",
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
            "mt-1 flex items-center tabular-nums text-[10px] font-bold uppercase tracking-tight text-slate-400",
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
              <div className="flex items-center gap-1 rounded-md bg-slate-100/80 px-1.5 py-0.5 text-slate-700 ring-1 ring-slate-200/50">
                <Database className="h-2.5 w-2.5 text-slate-500" />
                <span className="font-black">{device.remainingDataMb?.toFixed(0)} MB</span>
              </div>
              <span className="text-slate-400 text-right">
                EXP {formatDate(device.expirationDate, "dd/MM/yy")}
              </span>
            </>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-slate-300" />
    </button>
  );
};

const StatCard = ({
  label,
  value,
  color,
  icon: Icon,
  isActive,
  onClick,
}: {
  label: string;
  value: string;
  color: "emerald" | "red" | "slate";
  icon: any;
  isActive: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "relative overflow-hidden rounded-[20px] border transition-all text-left p-2.5 shadow-sm active:scale-95",
      isActive
        ? color === "emerald"
          ? "border-emerald-200 bg-emerald-50 shadow-emerald-500/5"
          : color === "red"
            ? "border-red-200 bg-red-50 shadow-red-500/5"
            : "border-slate-200 bg-slate-50 shadow-none"
        : color === "emerald"
          ? "border-emerald-100 bg-emerald-50/50"
          : color === "red"
            ? "border-red-100 bg-red-50/50"
            : "border-slate-100 bg-slate-50/50",
    )}
  >
    <div
      className={cn(
        "absolute -right-2 -top-2 h-8 w-8",
        isActive ? "opacity-20" : "opacity-10",
        color === "emerald"
          ? "text-emerald-500"
          : color === "red"
            ? "text-red-500"
            : "text-slate-500",
      )}
    >
      <Icon className="h-full w-full" />
    </div>
    <p
      className={cn(
        "text-[7px] font-black font-montserrat uppercase tracking-[0.2em]",
        isActive
          ? color === "emerald"
            ? "text-emerald-600/60"
            : color === "red"
              ? "text-red-600/60"
              : "text-slate-500/60"
          : "text-slate-400",
      )}
    >
      {label}
    </p>
    <div className="flex items-center gap-1.5 leading-none mt-0.5">
      <span
        className={cn(
          "text-sm font-black tracking-tighter",
          isActive
            ? color === "emerald"
              ? "text-emerald-600"
              : color === "red"
                ? "text-red-600"
                : "text-slate-600"
            : "text-slate-900",
        )}
      >
        {value}
      </span>
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full shadow-sm",
          color === "emerald"
            ? "bg-emerald-400"
            : color === "red"
              ? "bg-red-500"
              : "bg-slate-400",
        )}
      />
    </div>
  </button>
);

export default Dashboard;
