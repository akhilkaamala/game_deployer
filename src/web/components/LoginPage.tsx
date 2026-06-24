import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, Eye, EyeOff, Rocket, AlertCircle, ShieldCheck } from "lucide-react";
import { LogoMark } from "./LogoMark";
import { cn } from "../lib/utils";

interface LoginPageProps {
  onLogin: (username: string) => void;
}

const VALID_USERNAME = "admin";
const VALID_PASSWORD = "admin";

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate async auth check
    await new Promise((r) => setTimeout(r, 800));

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      // Brief success pause then enter the app
      await new Promise((r) => setTimeout(r, 300));
      onLogin(username);
    } else {
      setIsLoading(false);
      setError("Invalid username or password.");
      triggerShake();
      setPassword("");
    }
  };

  return (
    <div className="dark min-h-screen bg-[hsl(222.2,84%,4.9%)] flex items-center justify-center relative overflow-hidden">
      {/* Ambient background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-500/8 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-indigo-500/5 blur-[140px]" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative w-full max-w-md mx-4",
          shake && "animate-login-shake"
        )}
      >
        {/* Card */}
        <div className="relative rounded-2xl border border-white/10 bg-card/60 backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] overflow-hidden">
          {/* Top shimmer accent */}
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          <div className="px-10 pt-10 pb-10 space-y-8">
            {/* Logo & Branding */}
            <div className="flex flex-col items-center gap-4 text-center">
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center p-3 shadow-[0_0_30px_rgba(59,130,246,0.25)]"
              >
                <LogoMark />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.45 }}
              >
                <h1 className="text-2xl font-black tracking-tight text-white">
                  AGGR BLAZE
                </h1>
                <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-medium mt-0.5">
                  DevOps Center
                </p>
              </motion.div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/6" />
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/8">
                <ShieldCheck className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Secure Access
                </span>
              </div>
              <div className="flex-1 h-px bg-white/6" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username */}
              <div className="space-y-2">
                <label
                  htmlFor="login-username"
                  className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest"
                >
                  Username
                </label>
                <div className="relative group">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                  <input
                    id="login-username"
                    ref={usernameRef}
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setError(""); }}
                    placeholder="Enter username"
                    className="w-full h-11 pl-10 pr-4 rounded-lg bg-zinc-900/60 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all duration-200"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label
                  htmlFor="login-password"
                  className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest"
                >
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    placeholder="Enter password"
                    className="w-full h-11 pl-10 pr-11 rounded-lg bg-zinc-900/60 border border-white/10 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-all duration-200"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading || !username || !password}
                className={cn(
                  "w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 relative overflow-hidden",
                  "bg-primary text-primary-foreground shadow-[0_0_30px_rgba(59,130,246,0.3)]",
                  "hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] hover:brightness-110",
                  "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                )}
              >
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Authenticating...</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-3"
                    >
                      <Rocket className="w-4 h-4" />
                      <span>Sign In</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Shimmer sweep on hover */}
                <div className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
              </button>
            </form>

            {/* Footer hint */}
            <p className="text-center text-[10px] text-zinc-500 font-medium">
              Authorized personnel only · AGGR BLAZE DevOps
            </p>
          </div>
        </div>
      </motion.div>

      {/* Shake keyframe injected inline so no extra CSS file needed */}
      <style>{`
        @keyframes login-shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
        .animate-login-shake {
          animation: login-shake 0.6s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
}
