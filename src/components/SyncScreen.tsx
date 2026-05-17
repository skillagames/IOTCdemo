import React from "react";
import { motion } from "motion/react";

export const SyncScreen = () => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-white fixed inset-0 z-[9999]">
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
        {/* Spinning Outer Ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute inset-0 rounded-full border-[3px] border-slate-100 border-t-slate-900"
        />

        {/* Pulsing Inner Circle with IO */}
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="relative flex h-14 w-14 items-center justify-center bg-black rounded-full shadow-lg"
        >
          <span className="font-montserrat font-bold text-2xl text-white">
            IO
          </span>
        </motion.div>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-[10px] font-black font-montserrat uppercase tracking-[0.3em] text-slate-900">
          Synchronizing
        </span>
        <div className="mt-2 flex gap-1">
          <motion.div
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1, delay: 0 }}
            className="h-1 w-1 rounded-full bg-slate-900"
          />
          <motion.div
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
            className="h-1 w-1 rounded-full bg-slate-900"
          />
          <motion.div
            animate={{ opacity: [0, 1, 0] }}
            transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
            className="h-1 w-1 rounded-full bg-slate-900"
          />
        </div>
      </div>
    </div>
  );
};
