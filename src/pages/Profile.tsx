import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  User,
  Shield,
  Calendar,
  LogOut,
  Terminal,
  Database,
  RefreshCw,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
  BellRing,
  Activity,
  Headset,
  Download,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { formatDate, cn } from "../lib/utils";
import { auth, db } from "../lib/firebase";
import { deviceService } from "../services/deviceService";
import { notificationService } from "../services/notificationService";
import { motion, AnimatePresence } from "motion/react";
import { doc, updateDoc } from "firebase/firestore";
import { LocalNotifications } from "@capacitor/local-notifications";
import { App } from "@capacitor/app";

const Profile: React.FC = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDevExpanded, setIsDevExpanded] = useState(false);
  
  // Dummy Data Config State - allow empty strings for easier editing
  const [activeCount, setActiveCount] = useState<number | "">(2);
  const [expiredCount, setExpiredCount] = useState<number | "">(6);
  const [inactiveCount, setInactiveCount] = useState<number | "">(4);
  const [newCount, setNewCount] = useState<number | "">(1);

  // Edit Profile State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleLogout = () => {
    auth.signOut();
  };

  const toggleDevTools = () => {
    setIsDevExpanded(!isDevExpanded);
  };

  const handleOpenEdit = () => {
    setEditName(profile?.displayName || "");
    setEditPhone(profile?.phoneNumber || "");
    setEditAddress(profile?.address || "");
    setShowEditModal(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsUpdating(true);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        displayName: editName,
        phoneNumber: editPhone,
        address: editAddress,
      });
      await refreshProfile();
      setShowEditModal(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const toggleInsights = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        showInsights: profile?.showInsights === false ? true : false,
      });
      await refreshProfile();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSeedData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await deviceService.seedDevices(user.uid, {
        activeCount: Number(activeCount) || 0,
        expiredCount: Number(expiredCount) || 0,
        inactiveCount: Number(inactiveCount) || 0,
        newDevicesCount: Number(newCount) || 0
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevices = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deviceService.deleteAllDevices(user.uid);
      setShowConfirmDelete(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const [capTitle, setCapTitle] = useState("Local Payload");
  const [capNotifMsg, setCapNotifMsg] = useState(
    "This is a local Capacitor notification test.",
  );
  const [capSuccess, setCapSuccess] = useState(false);

  const [appInfo, setAppInfo] = useState<{ id: string; version: string }>(
    () => {
      const cached = localStorage.getItem("app_manifest_info");
      return cached
        ? JSON.parse(cached)
        : { id: "Loading...", version: "Loading..." };
    },
  );

  useEffect(() => {
    const fetchAppInfo = async () => {
      const cached = localStorage.getItem("app_manifest_info");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.id !== "Loading...") {
          setAppInfo(parsed);
          return;
        }
      }

      try {
        const w = window as any;
        if (w.Capacitor?.isNativePlatform()) {
          const info = await App.getInfo();
          const newInfo = { id: info.id, version: info.version };
          setAppInfo(newInfo);
          localStorage.setItem("app_manifest_info", JSON.stringify(newInfo));
        } else {
          const fallback = {
            id: "com.iotconnect.app.preview",
            version: "v1.2.0-SIM",
          };
          setAppInfo(fallback);
          localStorage.setItem("app_manifest_info", JSON.stringify(fallback));
        }
      } catch (e) {
        console.error("App Info Fetch Error:", e);
      }
    };

    fetchAppInfo();
  }, []);

  const handleTestCapacitorPush = async () => {
    try {
      if (
        (window as any).Capacitor?.isNativePlatform() ||
        (window as any).Capacitor?.getPlatform() === "web"
      ) {
        await LocalNotifications.requestPermissions();
        await LocalNotifications.schedule({
          notifications: [
            {
              title: capTitle || "Local Test",
              body: capNotifMsg || "Test",
              id: Math.floor(Math.random() * 2147483647), // Capacitor IDs must be 32-bit signed integers (max 2147483647)
              channelId: "primary_notifications_v4",
              smallIcon: "ic_stat_notification",
              schedule: { at: new Date(Date.now() + 1000) }, // Schedule 1s to allow app to go to background
            },
          ],
        });
        setCapSuccess(true);
        setTimeout(() => setCapSuccess(false), 2000);
      } else {
        alert("Capacitor isn't running native plugin architecture here.");
      }
    } catch (e) {
      console.error(e);
      alert("Capacitor Error: " + String(e));
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-3 pb-1">
      {/* Compressed Header */}
      <header className="relative z-10 text-center pt-4">
        <button
          onClick={handleOpenEdit}
          className="absolute right-2 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-primary transition-colors active:scale-95"
          title="Edit Profile"
        >
          <Edit3 className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-100 text-slate-900 shadow-sm border border-slate-200">
          <User className="h-8 w-8" />
        </div>
        <h2 className="mt-3 text-xl font-black font-montserrat tracking-tight text-slate-900 leading-none">
          {profile.displayName || profile.email.split("@")[0]}
        </h2>

        {/* Refined Streamlined Info Section */}
        <section className="mt-8 px-1">
          <div className="space-y-4">
            {/* Identity & Status - Restore Boxed Layout */}
            <div className="grid grid-cols-2 gap-2 pb-4 border-b border-slate-50">
              <div className="flex items-center gap-3 rounded-[20px] bg-slate-100/80 p-2.5 shadow-sm border border-slate-200/50 text-left">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Shield className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black font-montserrat uppercase tracking-widest text-indigo-600/60 leading-none mb-1">
                    Identity
                  </p>
                  <p className="font-bold text-slate-900 uppercase text-[10px] truncate tracking-tight">
                    {profile.role}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-[20px] bg-slate-100/80 p-2.5 shadow-sm border border-slate-200/50 text-left">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] font-black font-montserrat uppercase tracking-widest text-sky-600/60 leading-none mb-1">
                    Joined
                  </p>
                  <p className="font-bold text-slate-900 text-[10px] truncate tracking-tight">
                    {formatDate(profile?.createdAt, "MMM dd, yy")}
                  </p>
                </div>
              </div>
            </div>

            {/* Contact Details List - Clean Centered */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-center gap-3 text-slate-600">
                <Mail className="h-3.5 w-3.5 opacity-40 shrink-0" />
                <span className="text-[11px] font-bold text-slate-900">{profile.email}</span>
              </div>

              <div className="flex items-center justify-center gap-3 text-slate-600">
                <Phone className="h-3.5 w-3.5 opacity-40 shrink-0" />
                <span className="text-[11px] font-bold text-slate-900">
                  {profile.phoneNumber || "No Contact Data"}
                </span>
              </div>

              <div className="flex items-center justify-center gap-3 text-slate-600">
                <MapPin className="h-3.5 w-3.5 opacity-40 shrink-0" />
                <span className="text-[11px] font-bold text-slate-900">
                  {profile.address || "No Address Data"}
                </span>
              </div>
            </div>
          </div>
        </section>
      </header>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2 pb-1 pt-4">
        {/* Log Out Button */}
        <button
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500/10 border border-red-500/20 py-3 text-[10px] font-black font-montserrat uppercase tracking-widest text-red-500 hover:bg-red-500/20 transition-all active:scale-[0.98]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Terminate Session
        </button>

        <button
          onClick={() => {}}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 border border-slate-200 py-3 text-[10px] font-black font-montserrat uppercase tracking-widest text-sky-600 hover:bg-slate-200/50 transition-all active:scale-[0.98]"
        >
          <Headset className="h-4 w-4" />
          Operational Support
        </button>

        <div className="text-center mt-0.5 pb-0">
          <span className="text-[10px] font-black text-slate-400/50 uppercase tracking-widest">
            Version: v1.1.14
          </span>
        </div>
      </div>

      {/* Collapsible Dev Tools */}
      <section className="space-y-2">
        <button
          onClick={toggleDevTools}
          className="w-full flex items-center justify-center relative px-3 py-2 rounded-xl bg-slate-50/50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-primary" />
            <h3 className="text-[10px] font-black font-montserrat uppercase tracking-[0.2em] text-slate-500">
              Developer Tools
            </h3>
          </div>
          <motion.div
            animate={{ rotate: isDevExpanded ? 180 : 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="absolute right-3"
          >
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </motion.div>
        </button>

        <AnimatePresence>
          {isDevExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-[28px] border border-slate-900 bg-slate-900 p-5 text-white shadow-xl shadow-slate-900/10">
                {/* --- DUMMY DATA CONFIG SECTION --- */}
                <div className="mb-6">
                  <h4 className="text-[10px] font-black font-montserrat uppercase tracking-[0.1em] text-indigo-400/90 mb-2 flex items-center justify-between">
                    <span>DUMMY DATA CONFIG</span>
                    <Database className="h-3.5 w-3.5 text-indigo-400" />
                  </h4>
                  <p className="text-[8px] text-slate-400 font-medium mb-3 leading-relaxed">
                    Configure the distribution of synthetic device manifests for lab testing. 
                    Expired devices split 50/50 between <strong>Data Expired</strong> and <strong>Plan Expired</strong>.
                  </p>

                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-[16px] space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[7px] font-black uppercase tracking-widest text-indigo-400/60 ml-1">
                          Active Count
                        </label>
                        <input
                          type="number"
                          value={activeCount}
                          onChange={(e) => setActiveCount(e.target.value === "" ? "" : parseInt(e.target.value))}
                          className="w-full bg-slate-950/50 font-bold text-[10px] text-white px-3 py-2 rounded-lg border border-white/5 outline-none focus:border-indigo-500/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] font-black uppercase tracking-widest text-indigo-400/60 ml-1">
                          Expired Count
                        </label>
                        <input
                          type="number"
                          value={expiredCount}
                          onChange={(e) => setExpiredCount(e.target.value === "" ? "" : parseInt(e.target.value))}
                          className="w-full bg-slate-950/50 font-bold text-[10px] text-white px-3 py-2 rounded-lg border border-white/5 outline-none focus:border-indigo-500/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] font-black uppercase tracking-widest text-indigo-400/60 ml-1">
                          Inactive Count
                        </label>
                        <input
                          type="number"
                          value={inactiveCount}
                          onChange={(e) => setInactiveCount(e.target.value === "" ? "" : parseInt(e.target.value))}
                          className="w-full bg-slate-950/50 font-bold text-[10px] text-white px-3 py-2 rounded-lg border border-white/5 outline-none focus:border-indigo-500/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[7px] font-black uppercase tracking-widest text-indigo-400/60 ml-1">
                          New Devices
                        </label>
                        <input
                          type="number"
                          value={newCount}
                          onChange={(e) => setNewCount(e.target.value === "" ? "" : parseInt(e.target.value))}
                          className="w-full bg-slate-950/50 font-bold text-[10px] text-white px-3 py-2 rounded-lg border border-white/5 outline-none focus:border-indigo-500/50 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1">
                      <button
                        onClick={handleSeedData}
                        disabled={loading || isDeleting}
                        className="w-full relative flex items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3 text-[9px] font-black font-montserrat uppercase tracking-widest text-indigo-950 transition-all hover:bg-indigo-400 active:scale-95 disabled:opacity-50"
                      >
                        {loading ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : success ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Database className="h-3 w-3" />
                        )}
                        <span>{loading ? "Syncing..." : success ? "Synced" : "Seed Lab Data"}</span>
                      </button>

                      <button
                        onClick={() => setShowConfirmDelete(true)}
                        disabled={loading || isDeleting}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 py-3 text-[9px] font-black font-montserrat uppercase tracking-widest text-red-400 hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Clear Device Pool</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold font-montserrat text-emerald-400">
                    Simulation Mode
                  </h4>
                  <p className="text-[9px] font-medium text-slate-400">
                    Additional operational controls.
                  </p>
                </div>

                <button
                  onClick={toggleInsights}
                  className="mt-4 flex w-full items-center justify-between rounded-[16px] bg-white/5 px-4 py-3 transition-all hover:bg-white/10 active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    {profile?.showInsights === false ? (
                      <EyeOff className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-emerald-400" />
                    )}
                    <span className="text-[10px] font-black font-montserrat uppercase tracking-widest text-white/70">
                      {profile?.showInsights === false
                        ? "Enable Insights Mode"
                        : "Disable Insights Mode"}
                    </span>
                  </div>
                  <div
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      profile?.showInsights === false
                        ? "bg-slate-600"
                        : "bg-emerald-400",
                    )}
                  />
                </button>

                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 flex w-full items-center justify-between rounded-[16px] bg-white/5 px-4 py-3 transition-all hover:bg-white/10 active:scale-95"
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-[10px] font-black font-montserrat uppercase tracking-widest text-white/70">
                      Reload Workspace
                    </span>
                  </div>
                </button>

                {/* --- Capacitor Native Engine Section --- */}
                <div className="mt-6 border-t border-slate-700/50 pt-4">
                  <h4 className="text-[10px] font-black font-montserrat uppercase tracking-[0.1em] text-sky-400/90 mb-2 flex items-center justify-between">
                    <span>Capacitor Native Engine</span>
                    <Activity className="h-3.5 w-3.5 text-sky-400" />
                  </h4>
                  <p className="text-[8px] text-slate-400 font-medium mb-3 leading-relaxed">
                    Primary method for bundled Android/iOS Apps using{" "}
                    <strong>@capacitor/local-notifications</strong>.
                  </p>

                  <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-[16px]">
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[7px] font-black uppercase tracking-widest text-sky-400/60">
                        Active Pipeline
                      </span>
                      <span className="text-[7px] font-mono text-sky-500/80 bg-sky-500/10 px-2 py-0.5 rounded">
                        ch: primary_notifications_v4
                      </span>
                    </div>
                    <input
                      value={capTitle}
                      onChange={(e) => setCapTitle(e.target.value)}
                      placeholder="Notification Title"
                      className="w-full bg-slate-950/50 font-bold text-[10px] text-white px-3 py-2.5 rounded-lg mb-2 border border-white/5 outline-none focus:border-sky-500/50 transition-colors"
                    />
                    <textarea
                      value={capNotifMsg}
                      onChange={(e) => setCapNotifMsg(e.target.value)}
                      placeholder="Notification Body..."
                      className="w-full bg-slate-950/50 text-slate-300 font-medium text-[10px] px-3 py-2.5 rounded-lg mb-3 border border-white/5 outline-none h-14 resize-none focus:border-sky-500/50 transition-colors"
                    />
                    <button
                      onClick={handleTestCapacitorPush}
                      className="flex w-full items-center justify-between rounded-xl bg-sky-500 py-3 px-4 shadow-lg shadow-sky-500/20 transition-all hover:bg-sky-400 active:scale-95 relative overflow-hidden"
                    >
                      {capSuccess && (
                        <div className="absolute inset-0 bg-emerald-500 flex items-center justify-center z-10 animate-in fade-in zoom-in duration-300">
                          <span className="text-[9px] font-black font-montserrat uppercase tracking-widest text-emerald-950 flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Payload Transmitted
                          </span>
                        </div>
                      )}
                      <span className="block text-[9px] font-black font-montserrat uppercase tracking-widest text-sky-950 relative z-0">
                        Dispatch Native Alert
                      </span>
                      <BellRing className="h-3.5 w-3.5 text-sky-950 relative z-0" />
                    </button>
                  </div>
                </div>

                {/* --- Firebase Cloud Messaging Section --- */}
                <div className="mt-6 border-t border-slate-700/50 pt-4">
                  <h4 className="text-[10px] font-black font-montserrat uppercase tracking-[0.1em] text-emerald-400/90 mb-2 flex items-center justify-between">
                    <span>Remote FCM Configuration</span>
                    <Activity className="h-3.5 w-3.5 text-emerald-400" />
                  </h4>
                  <p className="text-[8px] text-slate-400 font-medium mb-3 leading-relaxed">
                    Registration status for remote Push Notifications via
                    Firebase.
                  </p>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-[16px] space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[7px] font-black uppercase tracking-widest text-emerald-400/60">
                        Status
                      </span>
                      {profile?.fcmToken ? (
                        <span className="text-[7px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="h-2 w-2" /> Active
                        </span>
                      ) : (
                        <span className="text-[7px] font-black uppercase tracking-widest text-orange-400 flex items-center gap-1">
                          <AlertTriangle className="h-2 w-2" /> Pending / Denied
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="px-1 text-[7px] font-black uppercase tracking-widest text-slate-500">
                        Device Token
                      </span>
                      {profile?.fcmToken ? (
                        <>
                          <div className="bg-black/40 p-2 rounded-lg border border-white/5 break-all">
                            <code className="text-[8px] text-slate-300 font-mono">
                              {profile.fcmToken}
                            </code>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(profile.fcmToken!);
                              alert(
                                "FCM Token copied to clipboard! To test, go to your Firebase Console > Engage > Cloud Messaging, create a new campaign, and send a test message using this token.",
                              );
                            }}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-emerald-400 hover:bg-emerald-500/30 transition-all border border-emerald-500/20"
                          >
                            <span className="text-[8px] font-black font-montserrat uppercase tracking-widest">
                              Copy Token for Firebase Console
                            </span>
                          </button>
                          <p className="px-1 mt-1 text-[7px] font-medium text-slate-400/80 leading-relaxed text-center">
                            (Frontend apps cannot securely send remote push
                            notifications to themselves. Use the token in your
                            Firebase Console to trigger a test delivery.)
                          </p>
                        </>
                      ) : (
                        <div className="bg-black/40 p-2 rounded-lg border border-red-500/10">
                          <span className="text-[8px] text-red-400/80 font-medium">
                            No token. Check if Push permissions are allowed or
                            if the registration failed.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Designer Tools Section */}
                <details className="mt-8 group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="list-none outline-none cursor-pointer border-t border-slate-700/50 pt-4 pb-2 transition-opacity hover:opacity-80">
                    <h4 className="text-[10px] font-black font-montserrat uppercase tracking-[0.1em] text-fuchsia-400/90 flex items-center justify-between">
                      <span>Designer Assets</span>
                      <Edit3 className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                    </h4>
                  </summary>

                  <div className="mt-1 pb-2">
                    <p className="text-[8px] text-slate-400 font-medium mb-3 leading-relaxed">
                      Export optimized assets for production build pipelines
                      (Android/iOS).
                    </p>

                    <div className="p-4 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-[20px] space-y-3">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[7px] font-black uppercase tracking-widest text-fuchsia-400/60">
                          Android Vector Drawable
                        </span>
                        <span className="text-[7px] font-mono text-fuchsia-500/80 bg-fuchsia-500/10 px-2 py-0.5 rounded">
                          ic_stat_notification.xml
                        </span>
                      </div>

                      {/* Visual Preview */}
                      <div className="flex flex-col items-center justify-center p-6 bg-black/60 rounded-xl border border-white/5 relative group">
                        <div className="absolute top-2 left-2 text-[6px] font-black uppercase tracking-widest text-slate-500">
                          Preview (Scaled)
                        </div>
                        <div className="w-16 h-16 bg-slate-950 rounded-lg flex items-center justify-center shadow-lg overflow-hidden border border-white/5">
                          <svg
                            viewBox="0 0 1024 1024"
                            className="w-full h-full"
                          >
                            <defs>
                              <mask id="scaledMask">
                                <rect width="1024" height="1024" fill="white" />
                                <text
                                  x="512"
                                  y="612"
                                  dominantBaseline="middle"
                                  textAnchor="middle"
                                  fill="black"
                                  fontFamily="'Montserrat', sans-serif"
                                  fontWeight="700"
                                  fontSize="940"
                                  letterSpacing="-30"
                                >
                                  <tspan dx="-40">I</tspan>
                                  <tspan dx="45">O</tspan>
                                </text>
                              </mask>
                            </defs>
                            <rect
                              width="1024"
                              height="1024"
                              rx="160"
                              ry="160"
                              fill="white"
                              mask="url(#scaledMask)"
                            />
                          </svg>
                        </div>
                        <p className="mt-3 text-[7px] text-fuchsia-400 font-bold uppercase tracking-tighter">
                          White Silhouette / Alpha Channel
                        </p>
                      </div>

                      <div className="group relative">
                        <pre className="text-[7px] font-mono p-3 bg-black/40 rounded-xl overflow-x-auto text-slate-400 border border-white/5 max-h-32">
                          {`<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="1024"
    android:viewportHeight="1024">
    <path
        android:fillColor="#FFFFFF"
        android:fillType="evenOdd"
        android:pathData="M160,0 h704 c88,0 160,72 160,160 v704 c0,88 -72,160 -160,160 h-704 c-88,0 -160,-72 -160,-160 v-704 c0,-88 72,-160 160,-160 z M350,220 h130 v700 h-130 z M740,220 c-180,0 -250,150 -250,440 s70,440 250,440 s250,-150 250,-440 s-70,-440 -250,-440 z M740,380 c100,0 120,140 120,280 s-20,280 -120,280 s-120,-140 -120,-280 s20,-280 120,-280 z" />
</vector>`}
                        </pre>
                      </div>

                      <button
                        onClick={() => {
                          const xml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="1024"
    android:viewportHeight="1024">
    <path
        android:fillColor="#FFFFFF"
        android:fillType="evenOdd"
        android:pathData="M160,0 h704 c88,0 160,72 160,160 v704 c0,88 -72,160 -160,160 h-704 c-88,0 -160,-72 -160,-160 v-704 c0,-88 72,-160 160,-160 z M350,220 h130 v700 h-130 z M740,220 c-180,0 -250,150 -250,440 s70,440 250,440 s250,-150 250,-440 s-70,-440 -250,-440 z M740,380 c100,0 120,140 120,280 s-20,280 -120,280 s-120,-140 -120,-280 s20,-280 120,-280 z" />
</vector>`;
                          const blob = new Blob([xml], { type: "text/xml" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "ic_stat_notification.xml";
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-500 py-3 text-[9px] font-black font-montserrat uppercase tracking-widest text-fuchsia-950 transition-all hover:bg-fuchsia-400 active:scale-95"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Download Android Icon
                      </button>

                      <div className="pt-2 border-t border-fuchsia-500/10">
                        <div className="flex items-center justify-between px-1 mb-3">
                          <span className="text-[7px] font-black uppercase tracking-widest text-fuchsia-400/60">
                            App Logo Branding
                          </span>
                          <span className="text-[7px] font-mono text-fuchsia-500/80 bg-fuchsia-500/10 px-2 py-0.5 rounded">
                            io_connect_logo.png
                          </span>
                        </div>

                        <div className="flex flex-col items-center justify-center p-6 bg-slate-950 rounded-xl border border-white/5 relative group mb-3">
                          <div className="absolute top-2 left-2 text-[6px] font-black uppercase tracking-widest text-slate-500">
                            Preview (1024px Export)
                          </div>
                          <div className="w-20 h-20 drop-shadow-2xl flex items-center justify-center">
                            <svg
                              viewBox="0 0 1024 1024"
                              className="w-full h-full drop-shadow-sm"
                            >
                              <defs>
                                <mask id="previewMask">
                                  <rect
                                    width="1024"
                                    height="1024"
                                    fill="white"
                                  />
                                  <text
                                    x="512"
                                    y="612"
                                    dominantBaseline="middle"
                                    textAnchor="middle"
                                    fill="black"
                                    fontFamily="'Montserrat', sans-serif"
                                    fontWeight="700"
                                    fontSize="940"
                                    letterSpacing="-15"
                                  >
                                    <tspan dx="-25">I</tspan>
                                    <tspan dx="30">O</tspan>
                                  </text>
                                </mask>
                              </defs>
                              <rect
                                width="1024"
                                height="1024"
                                rx="160"
                                ry="160"
                                fill="white"
                                mask="url(#previewMask)"
                              />
                            </svg>
                          </div>
                          <p className="mt-4 text-[7px] text-slate-400 font-bold uppercase tracking-widest">
                            White / Transparent Silhouette
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            const size = 1024;
                            const canvas = document.createElement("canvas");
                            canvas.width = size;
                            canvas.height = size;
                            const ctx = canvas.getContext("2d");
                            if (!ctx) return;

                            // The SVG represents the logo exactly as seen in the app
                            // White rounded square with transparent IO text "cut out" via mask
                            const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <mask id="logoMask">
      <rect width="1024" height="1024" fill="white" />
      <text x="512" y="612" dominant-baseline="middle" text-anchor="middle" fill="black" font-family="'Montserrat', sans-serif" font-weight="700" font-size="940" letter-spacing="-15">
        <tspan dx="-25">I</tspan><tspan dx="30">O</tspan>
      </text>
    </mask>
  </defs>
  <rect width="1024" height="1024" rx="160" ry="160" fill="white" mask="url(#logoMask)" />
</svg>`;

                            const img = new Image();
                            const svgBlob = new Blob([svgString], {
                              type: "image/svg+xml;charset=utf-8",
                            });
                            const url = URL.createObjectURL(svgBlob);

                            img.onload = () => {
                              ctx.drawImage(img, 0, 0);
                              const pngUrl = canvas.toDataURL("image/png");
                              const a = document.createElement("a");
                              a.href = pngUrl;
                              a.download = "io_connect_logo_icon.png";
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              URL.revokeObjectURL(url);
                            };
                            img.src = url;
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-fuchsia-500/20 bg-fuchsia-500/10 py-3 text-[9px] font-black font-montserrat uppercase tracking-widest text-fuchsia-300 transition-all hover:bg-fuchsia-500/20 active:scale-95"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download PNG Icon
                        </button>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer Branding */}
      <div className="text-center pt-1 space-y-0.5">
        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-300">
          IoTConnect core v1.2.0-SIM
        </p>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300 opacity-60">
          {appInfo.id}
        </p>
        <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300 opacity-60">
          Build Version: {appInfo.version}
        </p>
        
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowEditModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black font-montserrat text-slate-900">
                  Edit Identity
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-2 rounded-full hover:bg-slate-50 transition-colors"
                >
                  <X className="h-4 w-4 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-500 ml-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Enter operational callsign"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-xs font-bold text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                    <Edit3 className="absolute right-4 top-3.5 h-4 w-4 text-slate-300" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-500 ml-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-xs font-bold text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                    <Edit3 className="absolute right-4 top-3.5 h-4 w-4 text-slate-300" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-500 ml-1">
                    Address
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="123 Tech Avenue, Silicon Valley"
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-xs font-bold text-slate-900 placeholder:text-slate-300 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all"
                    />
                    <Edit3 className="absolute right-4 top-3.5 h-4 w-4 text-slate-300" />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 text-[10px] font-black font-montserrat uppercase tracking-widest text-white shadow-lg shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isUpdating ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {isUpdating ? "Synchronizing..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showConfirmDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirmDelete(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm rounded-[32px] bg-white p-8 text-center shadow-2xl"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[20px] bg-red-50 text-red-500">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-xl font-black font-montserrat text-slate-900">
                Total Data Wipe
              </h3>
              <p className="mt-2 text-xs font-medium text-slate-500 leading-relaxed px-4">
                This will permanently discard all device manifests and
                historical telemetry from the database.
              </p>

              <div className="mt-6 flex flex-col gap-2">
                <button
                  onClick={handleDeleteDevices}
                  disabled={isDeleting}
                  className="flex w-full items-center justify-center gap-2 rounded-[16px] bg-red-500 py-3.5 text-[9px] font-black font-montserrat uppercase tracking-widest text-white shadow-lg shadow-red-500/20 active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Confirm Destruction"
                  )}
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="py-2 text-[9px] font-black font-montserrat uppercase tracking-widest text-slate-400"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Profile;
