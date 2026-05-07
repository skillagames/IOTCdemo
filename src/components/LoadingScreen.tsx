import React from 'react';
import { motion } from 'motion/react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="flex fixed inset-0 z-[9999] flex-col items-center justify-center bg-white font-sans">
      <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
        {/* Spinning Outer Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute inset-0 rounded-full border-[3px] border-slate-100 border-t-slate-900"
        />
        
        {/* Inner Circle with IO */}
        <div className="relative flex h-14 w-14 items-center justify-center bg-black rounded-full shadow-2xl shadow-slate-900/40">
          <span className="font-black text-xl text-white tracking-tight">IO</span>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900 opacity-80">Synchronizing</span>
      </div>
    </div>
  );
};

export default LoadingScreen;
