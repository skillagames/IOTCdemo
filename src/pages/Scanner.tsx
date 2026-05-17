import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Keyboard,
  Camera,
  ArrowRight,
  X,
  QrCode,
  Image as ImageIcon,
} from "lucide-react";
import { DeviceIcon } from "../components/DeviceIcon";
import { deviceService } from "../services/deviceService";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";

const Scanner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"scan" | "manual">("scan");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [isHardwareLocked, setIsHardwareLocked] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const { user } = useAuth();
  const navigate = useNavigate();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTransitioningRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const isMountedRef = useRef(true);
  const scannerId = "reader";

  const checkPermissions = async () => {
    try {
      const result = await navigator.permissions.query({
        name: "camera" as PermissionName,
      });

      result.onchange = () => {
        // Just trigger a re-check if needed, but the state is sufficient
      };

      return result.state;
    } catch (err) {
      console.warn("Permissions API not supported or failed", err);
      return "unknown";
    }
  };

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((track) => track.stop()); // Stop immediately
      return true;
    } catch (err) {
      console.error("Permission request denied", err);
      return false;
    }
  };

  const startScanner = async () => {
    if (isTransitioningRef.current || !isMountedRef.current) return;

    // Check if the reader element exists in the DOM
    const readerElement = document.getElementById(scannerId);
    if (!readerElement) {
      console.warn("Scanner element not found in DOM yet.");
      return;
    }

    // Reset stop request if starting fresh
    stopRequestedRef.current = false;

    // Proactively check/request permissions
    const currentState = await checkPermissions();
    if (currentState === "denied") {
      setError(
        "Camera access is required. Please enable it in your browser settings.",
      );
      return;
    }

    if (currentState === "prompt" || currentState === "unknown") {
      const granted = await requestPermission();
      if (!granted) {
        setError("Camera permission denied. Access is required for scanning.");
        return;
      }
    }

    try {
      isTransitioningRef.current = true;
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerId);
      }

      // If already scanning, don't start again
      if (html5QrCodeRef.current.isScanning) {
        setCameraActive(true);
        isTransitioningRef.current = false;
        
        // Check if we should have been stopped
        if (stopRequestedRef.current || !isMountedRef.current) {
          await stopScanner();
        }
        return;
      }

      setCameraActive(true);
      setError(null);

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          // Removed qrbox to eliminate the library's default white-cornered overlay
        },
        (decodedText) => {
          handleDetected(decodedText);
        },
        () => {},
      );

      // Successfully started. Check if a stop was requested during the start process
      if (stopRequestedRef.current || !isMountedRef.current) {
        await stopScanner();
      }
    } catch (err: any) {
      console.error("Camera access failed", err);
      // Only set error if it's a real failure, not just a transition conflict
      const errMsg = err?.toString() || "";
      const isInterruptedError =
        errMsg.includes("already under transition") ||
        errMsg.includes("media was removed from the document") ||
        errMsg.includes("play() request was interrupted") ||
        errMsg.includes("NotAllowedError");

      if (!isInterruptedError && isMountedRef.current) {
        setError("Camera access blocked or not found. Try manual entry.");
      }
      setCameraActive(false);
    } finally {
      isTransitioningRef.current = false;
    }
  };

  const stopScanner = async () => {
    // If currently starting, flag it to stop immediately after it finishes
    if (isTransitioningRef.current) {
      stopRequestedRef.current = true;
      return;
    }

    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        isTransitioningRef.current = true;
        await html5QrCodeRef.current.stop();
        setCameraActive(false);
        stopRequestedRef.current = false;
      } catch (err) {
        console.warn("Failed to stop scanner", err);
      } finally {
        isTransitioningRef.current = false;
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    let timeoutId: any;

    const syncScanner = async () => {
      if (activeTab === "scan" && !scanResult && !error) {
        // Short delay to ensure DOM is ready and previous state finished
        timeoutId = setTimeout(() => {
          if (isMountedRef.current) {
            startScanner();
          }
        }, 150);
      } else if (activeTab === "manual" || scanResult) {
        await stopScanner();
      }
    };

    syncScanner();

    return () => {
      isMountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      stopScanner();
    };
  }, [activeTab, scanResult, error]);

  useEffect(() => {
    // Lock scroll and overscroll behavior to prevent the pull-down glitch
    const originalOverscroll = document.body.style.overscrollBehaviorY;
    const originalOverflow = document.body.style.overflow;
    
    document.body.style.overscrollBehaviorY = "none";
    document.body.style.overflow = "hidden";
    
    return () => {
      document.body.style.overscrollBehaviorY = originalOverscroll;
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleDetected = async (code: string) => {
    try {
      // PROACTIVELY stop the scanner before we process data 
      // and before setScanResult(code) triggers a re-render 
      // that removes the scanner element from the DOM.
      await stopScanner();

      const hardwareData = await deviceService.verifyHardware(code);
      if (!hardwareData) {
        setError("Hardware Check Failed: Device not recognized");
        setScanResult(null);
        return;
      }

      setScanResult(code);
      setIsHardwareLocked(true); // Always lock if found in master registry
      setDeviceInfo({
        serialNumber: hardwareData.serialNumber || code,
        name:
          hardwareData.model ||
          `Terminal ${code.substring(0, 4).toUpperCase()}`,
        imei: hardwareData.imei || "N/A",
        iccid: hardwareData.iccid || "N/A",
        materialCode: hardwareData.materialCode || "",
        barcode: hardwareData.barcode || "",
        description: hardwareData.description || "",
        location: hardwareData.location || "",
      });
    } catch (err) {
      console.error("Verification error", err);
      setError("System check failed. Please try again.");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    setError(null);
    await handleDetected(manualCode.trim());
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);
    setError(null);
    setScanResult(null);

    // Ensure we are on the scan tab so the scanner DOM element is definitely present
    if (activeTab !== "scan") {
      setActiveTab("scan");
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Stop camera if active
    if (cameraActive) {
      await stopScanner();
    }

    try {
      // 1. Try modern BarcodeDetector API (more robust on images)
      if ("BarcodeDetector" in window) {
        try {
          const supportedFormats = await (window as any).BarcodeDetector.getSupportedFormats();
          const detector = new (window as any).BarcodeDetector({ 
            formats: supportedFormats && supportedFormats.length > 0 
              ? supportedFormats 
              : ["qr_code", "code_128", "ean_13", "data_matrix"] 
          });
          const bitmap = await createImageBitmap(file);
          const barcodes = await detector.detect(bitmap);
          if (barcodes.length > 0) {
            await handleDetected(barcodes[0].rawValue);
            return;
          }
        } catch (detectorErr) {
          console.warn("BarcodeDetector detection failed, falling back", detectorErr);
        }
      }

      // 2. Fallback to html5-qrcode
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(scannerId);
      }

      // UI Feedback delay to give a "pro feeling" of processing
      await new Promise((resolve) => setTimeout(resolve, 800));

      const decodedText = await html5QrCodeRef.current.scanFile(file, false);
      await handleDetected(decodedText);
    } catch (err: any) {
      console.error("Image scan failed", err);
      const errMsg = (err?.toString() || "").toLowerCase();
      
      if (errMsg.includes("no multiformat readers") || errMsg.includes("not found") || errMsg.includes("no barcode")) {
        setError("Could not identify a clear code in this image. Ensure the barcode is well-lit and not blurry.");
      } else {
        setError("Scanning Protocol Fail: Could not process this image format. Use manual entry.");
      }
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRegister = async () => {
    if (!user || !deviceInfo) return;
    setRegistering(true);
    try {
      const deviceId = await deviceService.registerDevice({
        serialNumber: deviceInfo.serialNumber,
        name: deviceInfo.name,
        imei: deviceInfo.imei || "N/A",
        iccid: deviceInfo.iccid || "N/A",
        materialCode: deviceInfo.materialCode,
        barcode: deviceInfo.barcode,
        description: deviceInfo.description,
        location: deviceInfo.location,
        ownerId: user.uid,
      });
      navigate(`/devices/${deviceId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="-mt-4 flex flex-col h-[calc(100dvh-150px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] overscroll-y-none overflow-hidden select-none">
      <div className="z-40 sticky top-0 -mx-4 px-4 pt-6 pb-2 bg-bg-main shrink-0">
        {/* Background Decor Icon - Positioned absolute to the container to avoid clipping */}
        <QrCode className="absolute -top-4 -right-4 h-32 w-32 text-slate-900/[0.03] -rotate-12 pointer-events-none z-10" />

        <header className="relative z-20 px-1">
          <div className="text-center relative z-10">
            <h1 className="text-2xl font-black font-montserrat tracking-tight text-slate-900 leading-none">
              Add Device
            </h1>
            <p className="mt-2 text-[10px] font-black font-montserrat uppercase tracking-[0.2em] text-slate-400">
              Hardware Integration
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-1 top-0 z-30 flex h-10 w-10 items-center justify-center rounded-[18px] bg-sky-50 border border-sky-100 text-sky-600 shadow-sm hover:bg-sky-100 transition-all active:scale-90 cursor-pointer"
            title="Upload from Image"
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          {/* Tab Switcher */}
          <div className="flex gap-2 justify-center max-w-[320px] mx-auto mt-4">
            <button
              onClick={() => {
                setActiveTab("scan");
                setScanResult(null);
                setError(null);
              }}
              className={cn(
                "relative group flex flex-1 items-center justify-center gap-2 rounded-[16px] py-2.5 px-3 text-[10px] font-black font-montserrat uppercase tracking-widest transition-all",
                activeTab === "scan"
                  ? "text-sky-900"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              {activeTab === "scan" && (
                <motion.div
                  layoutId="scannerTabIndicator"
                  className="absolute inset-0 rounded-[16px] border border-sky-100 bg-sky-50 shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
                <Camera
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    activeTab === "scan"
                      ? "text-sky-600"
                      : "text-slate-300 group-hover:text-slate-400",
                  )}
                />{" "}
                Scan Code
              </span>
            </button>
            <button
              onClick={() => {
                setActiveTab("manual");
                setScanResult(null);
                setError(null);
              }}
              className={cn(
                "relative group flex flex-1 items-center justify-center gap-2 rounded-[16px] py-2.5 px-3 text-[10px] font-black font-montserrat uppercase tracking-widest transition-all",
                activeTab === "manual"
                  ? "text-sky-900"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-100",
              )}
            >
              {activeTab === "manual" && (
                <motion.div
                  layoutId="scannerTabIndicator"
                  className="absolute inset-0 rounded-[16px] border border-sky-100 bg-sky-50 shadow-sm"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap">
                <Keyboard
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    activeTab === "manual"
                      ? "text-sky-600"
                      : "text-slate-300 group-hover:text-slate-400",
                  )}
                />{" "}
                Manual Entry
              </span>
            </button>
          </div>
        </header>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center -mt-4">
        <div className="w-full max-w-[340px] px-6">
          <AnimatePresence mode="wait">
            {scanResult ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full relative min-h-[380px]"
              >
                <div className="h-full w-full rounded-[40px] border-2 border-slate-100 bg-white p-5 flex flex-col shadow-2xl shadow-slate-200/50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-slate-100 text-slate-400 shadow-sm">
                        <DeviceIcon
                          className="h-5 w-5"
                          name={deviceInfo?.name}
                          description={deviceInfo?.description}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 leading-none">
                          Device Identified
                        </h4>
                        <p className="text-[12px] font-black tracking-tight text-slate-900 tabular-nums leading-none pt-1">
                          SN: {deviceInfo?.serialNumber}
                        </p>
                        <div className="h-1 w-6 bg-slate-300 rounded-full mt-1.5" />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setScanResult(null)}
                        className="rounded-full bg-slate-50 p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="py-1 space-y-1.5">
                    <div className="space-y-0.5">
                      <label className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 px-1">
                        Model Number
                      </label>
                      <input
                        type="text"
                        value={deviceInfo?.name}
                        onChange={(e) =>
                          setDeviceInfo({ ...deviceInfo, name: e.target.value })
                        }
                        className="w-full rounded-[14px] bg-slate-50 border-2 border-slate-50 py-1.5 px-3.5 text-xs font-bold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none transition-all"
                      />
                    </div>

                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 px-1">
                          Model Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. CCTV Camera, Network Switch"
                          value={deviceInfo?.description || ""}
                          onChange={(e) =>
                            setDeviceInfo({
                              ...deviceInfo,
                              description: e.target.value,
                            })
                          }
                          className="w-full rounded-[14px] bg-slate-50 border-2 border-slate-50 py-1.5 px-3.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none transition-all"
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 px-1">
                          Location
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Server Room A, Gate 4"
                          value={deviceInfo?.location || ""}
                          onChange={(e) =>
                            setDeviceInfo({
                              ...deviceInfo,
                              location: e.target.value,
                            })
                          }
                          className="w-full rounded-[14px] bg-slate-50 border-2 border-slate-50 py-1.5 px-3.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none transition-all"
                        />
                      </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 px-1">
                          IMEI
                        </label>
                        <input
                          type="text"
                          placeholder="..."
                          readOnly={isHardwareLocked}
                          value={deviceInfo?.imei}
                          onChange={(e) =>
                            setDeviceInfo({
                              ...deviceInfo,
                              imei: e.target.value,
                            })
                          }
                          className={cn(
                            "w-full rounded-[12px] border-2 py-1.5 px-3 text-[10px] font-bold transition-all focus:outline-none",
                            isHardwareLocked
                              ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-50 border-slate-50 text-slate-900 focus:border-slate-900 focus:bg-white",
                          )}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 px-1">
                          ICCID
                        </label>
                        <input
                          type="text"
                          placeholder="..."
                          readOnly={isHardwareLocked}
                          value={deviceInfo?.iccid}
                          onChange={(e) =>
                            setDeviceInfo({
                              ...deviceInfo,
                              iccid: e.target.value,
                            })
                          }
                          className={cn(
                            "w-full rounded-[12px] border-2 py-1.5 px-3 text-[10px] font-bold transition-all focus:outline-none",
                            isHardwareLocked
                              ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-50 border-slate-50 text-slate-900 focus:border-slate-900 focus:bg-white",
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 px-1">
                          Mat. Code
                        </label>
                        <input
                          type="text"
                          placeholder="..."
                          readOnly={isHardwareLocked}
                          value={deviceInfo?.materialCode}
                          onChange={(e) =>
                            setDeviceInfo({
                              ...deviceInfo,
                              materialCode: e.target.value,
                            })
                          }
                          className={cn(
                            "w-full rounded-[12px] border-2 py-1.5 px-3 text-[10px] font-bold transition-all focus:outline-none",
                            isHardwareLocked
                              ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-50 border-slate-50 text-slate-900 focus:border-slate-900 focus:bg-white",
                          )}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[8px] font-black font-montserrat uppercase tracking-widest text-slate-400 px-1">
                          Barcode
                        </label>
                        <input
                          type="text"
                          placeholder="..."
                          readOnly={isHardwareLocked}
                          value={deviceInfo?.barcode}
                          onChange={(e) =>
                            setDeviceInfo({
                              ...deviceInfo,
                              barcode: e.target.value,
                            })
                          }
                          className={cn(
                            "w-full rounded-[12px] border-2 py-1.5 px-3 text-[10px] font-bold transition-all focus:outline-none",
                            isHardwareLocked
                              ? "bg-slate-100 border-slate-100 text-slate-400 cursor-not-allowed"
                              : "bg-slate-50 border-slate-50 text-slate-900 focus:border-slate-900 focus:bg-white",
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-2">
                    <button
                      onClick={handleRegister}
                      disabled={registering}
                      className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-emerald-50 border-2 border-emerald-100 text-[10px] font-black font-montserrat uppercase tracking-[0.15em] text-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {registering ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                      ) : (
                        <>
                          Commit Registration <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === "scan" ? (
              <motion.div
                key="scan"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full relative aspect-[1/1.1]"
              >
                <div className="h-full w-full overflow-hidden rounded-[40px] border-2 border-slate-200 bg-white shadow-xl shadow-slate-200/50 relative">
                  <div
                    id={scannerId}
                    className={cn(
                      "h-full w-full object-cover grayscale-[0.5]",
                      (!cameraActive || error) && "opacity-0",
                    )}
                  />

                  {isProcessingImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-30 p-7 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-sky-50 text-sky-600 mb-4 shrink-0 animate-pulse">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-black font-montserrat tracking-tight text-slate-900 leading-none">
                          Processing Image
                        </h3>
                        <p className="text-[9px] font-black font-montserrat text-sky-600 uppercase tracking-widest mt-1.5">
                          Decoding hardware identifiers...
                        </p>
                      </div>
                    </div>
                  )}

                  {!cameraActive && !error && !isProcessingImage && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-7 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-slate-50 text-slate-900 mb-4 shrink-0 animate-in fade-in zoom-in duration-300">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-lg font-black font-montserrat tracking-tight text-slate-900 leading-none">
                          Starting Camera
                        </h3>
                        <p className="text-[9px] font-black font-montserrat text-slate-400 uppercase tracking-widest mt-1.5">
                          Preparing scanner environment...
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-7 text-center z-20">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-red-50 text-red-500 mb-4 shrink-0 animate-in fade-in zoom-in duration-300">
                        <AlertCircle className="h-6 w-6" />
                      </div>
                      <div className="space-y-0.5 mb-6">
                        <h3 className="text-lg font-black font-montserrat tracking-tight text-slate-900 leading-none">
                          Registry Error
                        </h3>
                        <p className="text-[9px] font-black font-montserrat text-red-500 uppercase tracking-widest mt-1">
                          {error}
                        </p>
                      </div>

                      <div className="w-full space-y-3">
                        <button
                          onClick={() => {
                            setError(null);
                            // startScanner will be triggered by useEffect
                          }}
                          className="w-full rounded-[18px] bg-slate-900 py-3.5 text-[10px] font-black font-montserrat uppercase tracking-[0.15em] text-white transition-all active:scale-95 shadow-xl shadow-slate-950/10"
                        >
                          Restart Scanner
                        </button>
                        <button
                          onClick={() => setActiveTab("manual")}
                          className="w-full text-[10px] font-black font-montserrat uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
                        >
                          Manual Entry Protocol
                        </button>
                      </div>
                    </div>
                  )}

                  {cameraActive && !error && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <motion.div
                        animate={{
                          scale: [1, 1.05, 1],
                          borderColor: [
                            "rgba(0,0,0,0.1)",
                            "rgba(0,0,0,0.4)",
                            "rgba(0,0,0,0.1)",
                          ],
                        }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="h-56 w-56 rounded-[48px] border-2 border-slate-900/10 shadow-[0_0_0_9999px_rgba(255,255,255,0.4)]"
                      />
                      <div className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 animate-[scan-line_2s_linear_infinite] bg-emerald-400 shadow-[0_0_15px_#10b981]" />
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="manual"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="w-full relative aspect-[1/1.1]"
              >
                <form
                  onSubmit={handleManualSubmit}
                  className="h-full w-full rounded-[40px] border-2 border-slate-200 bg-white p-7 flex flex-col justify-center items-center text-center shadow-xl shadow-slate-200/50 overflow-hidden"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-slate-50 text-slate-900 mb-4 shrink-0">
                    <Keyboard className="h-6 w-6" />
                  </div>
                  <div className="space-y-0.5 mb-6">
                    <h3 className="text-lg font-black font-montserrat tracking-tight text-slate-900 leading-none">
                      Manual Entry
                    </h3>
                    <p className="text-[9px] font-black font-montserrat text-slate-400 uppercase tracking-widest mt-1">
                      Transmit serial code
                    </p>
                  </div>
                  <div className="w-full space-y-3">
                    <div className="relative group">
                      <input
                        type="text"
                        placeholder="SN-XXXX-XXXX"
                        value={manualCode}
                        onChange={(e) => {
                          setManualCode(e.target.value.toUpperCase());
                          if (error) setError(null);
                        }}
                        className={cn(
                          "w-full rounded-[18px] bg-slate-50 border-2 px-5 py-3.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-900 placeholder:text-slate-400/40 focus:bg-white focus:outline-none transition-all",
                          error
                            ? "border-red-500 bg-red-50/10 focus:border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                            : "border-slate-100 focus:border-slate-900 shadow-none",
                        )}
                      />
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex items-center justify-center gap-2 px-2"
                        >
                          <AlertCircle className="h-3 w-3 text-red-500" />
                          <span className="text-[10px] font-black font-montserrat uppercase tracking-tight text-red-500">
                            Unrecognized Device ID
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      type="submit"
                      disabled={!manualCode.trim()}
                      className="flex py-3.5 w-full items-center justify-center gap-2 rounded-[18px] bg-slate-900 text-[10px] font-black font-montserrat uppercase tracking-[0.15em] text-white transition-all active:scale-95 disabled:opacity-30 shadow-xl shadow-slate-950/10"
                    >
                      Verify Hardware <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes scan-line {
          0%, 100% { top: 10%; opacity: 0.1; }
          50% { top: 90%; opacity: 1; }
        }
        #reader {
          overscroll-behavior-y: none !important;
        }
        #reader video { 
          width: 100% !important; 
          height: 100% !important; 
          object-fit: cover !important;
          border-radius: 40px !important;
        }
        #reader__scan_region, #reader__dashboard {
          display: none !important;
        }
        #reader img {
          display: none !important;
        }
      `,
        }}
      />
    </div>
  );
};

export default Scanner;
