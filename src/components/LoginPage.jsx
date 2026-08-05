import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { storageService } from '../services/storageService';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, Eye, EyeOff, Cpu, Activity, LifeBuoy, FileText } from 'lucide-react';
import loginBg from '../assets/login-bg.jpg';

/* ---------------------------------------------------------------------- */
/* Animation variants — kept outside the component so they are created    */
/* once, not re-allocated on every render.                                */
/* ---------------------------------------------------------------------- */

const cardContainerVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.09,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] },
  },
};

const logoVariants = {
  hidden: { opacity: 0, scale: 0.6, rotate: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] },
  },
};

/* Ambient floating particles — a handful of soft dots drifting slowly.    */
/* Positions/timings are randomized once and memoized so they don't churn */
/* on re-render (keeps this cheap and steady at 60fps).                   */
function useParticles(count) {
  return useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: Math.random() * 100,
        size: 2 + Math.random() * 3,
        duration: 10 + Math.random() * 10,
        delay: Math.random() * 6,
      })),
    [count]
  );
}

export function LoginPage({ onLoginSuccess }) {
  const [usernameOrNTID, setUsernameOrNTID] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ripples, setRipples] = useState([]);

  const particles = useParticles(14);

  /* Subtle mouse-tracked parallax on the hero background & glow layer.     */
  /* Springs smooth the motion; disabled implicitly on touch devices since */
  /* there's no mousemove there, so the image just sits still + Ken Burns. */
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const springX = useSpring(mvX, { stiffness: 40, damping: 20 });
  const springY = useSpring(mvY, { stiffness: 40, damping: 20 });
  const bgX = useTransform(springX, [-1, 1], ['-2%', '2%']);
  const bgY = useTransform(springY, [-1, 1], ['-2%', '2%']);
  const glowX = useTransform(springX, [-1, 1], ['3%', '-3%']);
  const glowY = useTransform(springY, [-1, 1], ['3%', '-3%']);

  const handlePointerMove = useCallback((e) => {
    const { innerWidth, innerHeight } = window;
    mvX.set((e.clientX / innerWidth) * 2 - 1);
    mvY.set((e.clientY / innerHeight) * 2 - 1);
  }, [mvX, mvY]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!usernameOrNTID.trim() || !password.trim()) {
      setError('Please enter both Username/NTID and Password.');
      return;
    }

    setLoading(true);

    try {
      const res = await storageService.authenticateUser(usernameOrNTID, password);
      setLoading(false);

      if (res.success) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error);
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Authentication service error');
    }
  };

  /* Ripple effect on the primary button — purely cosmetic, no logic change */
  const spawnRipple = useCallback((e) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.6;
    const ripple = {
      id: Date.now() + Math.random(),
      x: e.clientX - rect.left - size / 2,
      y: e.clientY - rect.top - size / 2,
      size,
    };
    setRipples((prev) => [...prev, ripple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== ripple.id));
    }, 650);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <div
      className="min-h-[100dvh] flex flex-col justify-between text-white relative bg-[#050b16]"
      onPointerMove={handlePointerMove}
    >
      {/* Hero background image — user-provided asset, slow Ken Burns motion, */}
      {/* plus subtle mouse parallax drift.                                   */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute inset-0 animate-kenburns"
          style={{
            backgroundImage: `url(${loginBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            x: bgX,
            y: bgY,
          }}
        />

        {/* Light readability overlay — image stays clearly visible, just enough */}
        {/* darkening at the edges/bottom to keep text and form legible.         */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#020509]/45 via-transparent to-[#020509]/70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#020509]/35 via-transparent to-[#020509]/20" />

        {/* Ambient blueprint grid, matched to the image's cool navy palette */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.6) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        ></div>

        {/* Floating glow layer — tinted to echo the image's blue/cyan/crimson */}
        {/* accents, drifting slowly with a touch of parallax on top.          */}
        <motion.div className="absolute inset-0" style={{ x: glowX, y: glowY }}>
          <div className="absolute -top-24 -left-10 w-[28rem] h-[28rem] bg-sky-500/20 rounded-full blur-[100px] animate-drift"></div>
          <div className="absolute -bottom-24 -right-10 w-[28rem] h-[28rem] bg-jabil-blue/25 rounded-full blur-[100px] animate-drift-reverse"></div>
          <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-cyan-400/15 rounded-full blur-[90px] animate-drift"></div>
          <div className="absolute bottom-1/4 left-1/5 w-64 h-64 bg-rose-500/10 rounded-full blur-[90px] animate-drift-reverse"></div>
        </motion.div>

        {/* Soft floating particles */}
        {particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-sky-300/40"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
            animate={{
              y: [0, -18, 0],
              opacity: [0.15, 0.6, 0.15],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Top Header Logo Bar */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="py-3 px-4 sm:py-4 sm:px-6 flex items-center justify-between z-10 border-b border-white/5 bg-black/20 backdrop-blur-md shrink-0"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded font-black text-jabil-blue text-base sm:text-xl tracking-tighter shadow-md">
            JABIL
          </div>
          <div className="flex items-center gap-1.5 text-sm sm:text-lg font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
            <span>DigiCheck</span>
          </div>
        </div>
        <div className="hidden md:block text-xs font-mono text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          Industrial Quality Checklist Engine v2.4
        </div>
      </motion.div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-4 sm:py-6 z-10">
        <motion.div
          className="w-full max-w-sm sm:max-w-md"
          variants={cardContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="relative rounded-3xl p-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent shadow-2xl shadow-black/40"
            whileHover={{ boxShadow: '0 25px 60px -15px rgba(56,189,248,0.25)' }}
            transition={{ duration: 0.4 }}
          >
            <div className="rounded-3xl bg-black/35 backdrop-blur-2xl border border-white/10 p-6 sm:p-9">

              {/* Brand Heading */}
              <motion.div variants={itemVariants} className="text-center mb-5 sm:mb-7">
                <motion.div
                  variants={logoVariants}
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-jabil-blue mb-2.5 sm:mb-4 shadow-lg shadow-sky-500/30 ring-1 ring-white/20"
                >
                  <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </motion.div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Welcome back</h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 sm:mt-1.5">
                  Sign in with your NTID or Username to access DigiCheck
                </p>
              </motion.div>

              {/* Error Banner */}
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key={error}
                    initial={{ opacity: 0, y: -10, scale: 0.97 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      x: [0, -6, 5, -3, 2, 0],
                    }}
                    exit={{ opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.2 } }}
                    transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-rose-200">Authentication Notice</p>
                      <p className="text-xs text-rose-300/90 mt-0.5">{error}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
                <motion.div variants={itemVariants}>
                  <label
                    htmlFor="usernameOrNTID"
                    className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1"
                  >
                    Username or NTID
                  </label>
                  <motion.div className="relative group" whileFocus={{ scale: 1.01 }}>
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-sky-400 transition-colors duration-300">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="usernameOrNTID"
                      type="text"
                      autoComplete="username"
                      value={usernameOrNTID}
                      onChange={(e) => setUsernameOrNTID(e.target.value)}
                      placeholder="Enter your Username or NTID"
                      className="w-full pl-10 pr-4 py-2.5 bg-black/25 border border-white/10 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/50 text-sm transition-all duration-300"
                    />
                  </motion.div>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <label
                    htmlFor="password"
                    className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1"
                  >
                    Password
                  </label>
                  <motion.div className="relative group" whileFocus={{ scale: 1.01 }}>
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within:text-sky-400 transition-colors duration-300">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-11 py-2.5 bg-black/25 border border-white/10 rounded-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-sky-500/70 focus:border-sky-500/50 text-sm transition-all duration-300"
                    />
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      whileTap={{ scale: 0.85 }}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {showPassword ? (
                          <motion.span
                            key="hide"
                            initial={{ opacity: 0, rotate: -45 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 45 }}
                            transition={{ duration: 0.18 }}
                          >
                            <EyeOff className="w-4 h-4" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="show"
                            initial={{ opacity: 0, rotate: 45 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: -45 }}
                            transition={{ duration: 0.18 }}
                          >
                            <Eye className="w-4 h-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </motion.div>
                </motion.div>

                <motion.button
                  variants={itemVariants}
                  type="submit"
                  disabled={loading}
                  onClick={spawnRipple}
                  whileHover={{ scale: loading ? 1 : 1.015 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  transition={{ duration: 0.18 }}
                  className="relative overflow-hidden w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-jabil-blue hover:from-sky-400 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/25 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
                >
                  {/* Ripple layer */}
                  {ripples.map((r) => (
                    <motion.span
                      key={r.id}
                      initial={{ opacity: 0.45, scale: 0 }}
                      animate={{ opacity: 0, scale: 1 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="absolute rounded-full bg-white/60 pointer-events-none"
                      style={{ left: r.x, top: r.y, width: r.size, height: r.size }}
                    />
                  ))}

                  <AnimatePresence mode="wait" initial={false}>
                    {loading ? (
                      <motion.span
                        key="loading"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-2"
                      >
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Signing in…</span>
                      </motion.span>
                    ) : (
                      <motion.span
                        key="idle"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center gap-2 group"
                      >
                        <span>Sign In to System</span>
                        <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </form>

              <motion.div
                variants={itemVariants}
                className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/10 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
              >
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-subtle"></span>
                  Systems Online
                </span>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20">
                  <Lock className="w-3 h-3" />
                  Encrypted Session
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-medium bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  <Cpu className="w-3 h-3" />
                  Plant-Grade Security
                </span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="relative z-10 border-t border-white/10 bg-black/30 backdrop-blur-md shrink-0"
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 sm:py-4 flex flex-col items-center justify-center gap-1.5 sm:gap-2">

          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-400">
            <div className="hidden sm:flex w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500 to-jabil-blue items-center justify-center shrink-0">
              <ShieldCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <span>
              <span className="text-slate-300 font-semibold">DigiCheck</span>
              <span className="mx-1.5 text-slate-600">·</span>
              © Naveen-Jabil Inc. 2026
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-4 text-[11px] text-slate-400">
            <a href="#" className="flex items-center gap-1.5 hover:text-sky-300 transition-colors">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              System Status
            </a>
            <a href="#" className="flex items-center gap-1.5 hover:text-sky-300 transition-colors">
              <LifeBuoy className="w-3.5 h-3.5 text-amber-400" />
              Support
            </a>
            <a href="#" className="flex items-center gap-1.5 hover:text-sky-300 transition-colors">
              <FileText className="w-3.5 h-3.5 text-violet-400" />
              Privacy Policy
            </a>
          </div>

        </div>
      </motion.div>
    </div>
    </MotionConfig>
  );
}
