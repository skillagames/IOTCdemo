import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Smartphone, ShieldCheck, Mail, Lock, ArrowRight, User as UserIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const Login: React.FC = () => {
  const { user } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle for easy undo if requested
  const ENABLE_LOGO_ANIMATION = true;

  if (user) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // We'll handle the name via a temporary session or directly after creation
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Immediately update name in profile (AuthContext will pick up the doc change)
        const { user } = userCredential;
        const initialProfile = {
          uid: user.uid,
          email: user.email,
          displayName: name,
          role: 'user',
          createdAt: new Date().toISOString(), // Fallback before serverTimestamp
        };
        // This setDoc might conflict with AuthContext, so we'll let AuthContext handle the check 
        // but we'll try to set it with the name here to be explicit
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const { db } = await import('../lib/firebase');
        await setDoc(doc(db, 'users', user.uid), {
           ...initialProfile,
           createdAt: serverTimestamp()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err.code);
      let message = 'An unexpected error occurred. Please try again.';
      
      switch (err.code) {
        case 'auth/email-already-in-use':
          message = 'This email is already registered. Please sign in instead.';
          break;
        case 'auth/invalid-email':
          message = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          message = 'Password should be at least 6 characters.';
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          message = 'Invalid email or password.';
          break;
        case 'auth/operation-not-allowed':
          message = 'Email/Password login is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.';
          break;
        case 'auth/too-many-requests':
          message = 'Too many failed attempts. Please try again later.';
          break;
        default:
          message = err.message.replace('Firebase: ', '');
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-bg-main px-6 py-4 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-sm flex flex-col justify-center space-y-4"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex flex-col items-center group w-max">
            <div className="flex items-center gap-0 whitespace-nowrap">
              <motion.div 
                initial={ENABLE_LOGO_ANIMATION ? { scale: 0.5, opacity: 0, rotate: -15 } : {}}
                animate={ENABLE_LOGO_ANIMATION ? { scale: 1, opacity: 1, rotate: 0 } : {}}
                transition={{ 
                  type: "spring", 
                  stiffness: 260, 
                  damping: 20,
                  delay: 0.2
                }}
                className="bg-black text-white w-14 h-14 flex items-center justify-center rounded-[8px] font-black text-[42px] leading-none shadow-xl"
              >
                IO
              </motion.div>
              
              <div className="flex flex-col items-start leading-none mt-1">
                <motion.span 
                  initial={ENABLE_LOGO_ANIMATION ? { x: -10, opacity: 0 } : {}}
                  animate={ENABLE_LOGO_ANIMATION ? { x: 0, opacity: 1 } : {}}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="text-4xl font-black tracking-tight text-slate-900 leading-none pl-0.5"
                >
                  tConnect
                </motion.span>
              </div>
            </div>
            
            <motion.div 
              initial={ENABLE_LOGO_ANIMATION ? { opacity: 0, y: -2 } : {}}
              animate={ENABLE_LOGO_ANIMATION ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.7, duration: 0.8 }}
              className="mt-3 w-full flex justify-between items-center origin-top"
            >
              <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">global</span>
              <span className="text-[11px] font-light text-slate-300">|</span>
              <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">iot</span>
              <span className="text-[11px] font-light text-slate-300">|</span>
              <span className="text-[11px] font-medium text-slate-400 whitespace-nowrap">connectivity</span>
            </motion.div>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="flex flex-col items-center gap-1.5"
          >
            <div className="flex h-px w-8 bg-slate-100" />
            <p className="text-[11px] font-medium tracking-tight text-slate-500">
               {isSignUp ? 'Create management account' : 'Sign in to dashboard'}
            </p>
          </motion.div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1.5">
            {isSignUp && (
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[13px] font-bold text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[13px] font-bold text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                required
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-[13px] font-bold text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-white transition-all hover:bg-blue-600 active:scale-95 disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span className="text-xs uppercase tracking-wider">{isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full py-0.5 text-center text-[11px] font-bold text-slate-500 hover:text-primary transition-colors"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
          </button>

          {error && (
            <div className="rounded-xl bg-red-50 p-2 text-center">
              <p className="text-[9px] font-bold text-red-500 leading-tight">{error}</p>
            </div>
          )}
        </form>

        {!isSignUp && (
          <div className="border-t border-slate-100 pt-4">
            <Feature icon={ShieldCheck} title="Identity" desc="Unified secure authentication" />
          </div>
        )}

        <div className="pt-2 text-center">
          <p className="text-[8px] uppercase font-bold tracking-[0.3em] text-slate-300">
            Secure Core V1.2.0
          </p>
        </div>
      </motion.div>
    </div>
  );
};

const Feature = ({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) => (
  <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <p className="text-[11px] font-medium text-slate-500">{desc}</p>
    </div>
  </div>
);

export default Login;
