import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence, MotionConfig, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { storageService } from '../services/storageService';
import { ShieldCheck, Lock, User, ArrowRight, Eye, EyeOff, Cpu, Activity, LifeBuoy, FileText } from 'lucide-react';
import loginBg from '../assets/login-bg.jpg';
import companyLogo from '../assets/logo.png';

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

/* Small robot-face assistant — styled after the "Robot Login Form"        */
/* reference: ear tabs on a rounded head, a dark screen with 4 status LED  */
/* dots, a live status label, and a simple mouth glyph. On an auth error,  */
/* it switches to a sad/warning face (shake + red pulsing screen) instead  */
/* of a plain text banner; a happy face shows once the password looks     */
/* strong. Kept intentionally compact/small.                              */
function RobotFace({ password, error }) {
  const status = useMemo(() => {
    if (error) return { label: 'OOPS!', lit: 4, color: '#ef4444', mouth: '⌢' };
    const len = password.length;
    if (len === 0) return { label: 'WAITING', lit: 0, color: '#64748b', mouth: '−' };
    if (len < 4) return { label: 'TOO SHORT', lit: 1, color: '#ef4444', mouth: '⌢' };
    if (len < 8) return { label: 'WEAK', lit: 2, color: '#f59e0b', mouth: '−' };
    if (len < 12) return { label: 'OKAY', lit: 3, color: '#38bdf8', mouth: '‿' };
    return { label: 'STRONG', lit: 4, color: '#34d399', mouth: '‿' };
  }, [password, error]);

  return (
    <motion.div
      key={error ? `error-${error}` : 'idle'}
      className="relative"
      animate={
        error
          ? { y: [0, -2, 0], x: [0, -7, 7, -5, 5, -3, 3, 0] }
          : { y: [0, -4, 0] }
      }
      transition={
        error
          ? { duration: 0.6, ease: 'easeInOut' }
          : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }
      }
    >
      {/* ear tabs */}
      <div className="absolute -left-1.5 top-3 w-2 h-4 rounded-sm bg-white/90 ring-1 ring-white/30" />
      <div className="absolute -right-1.5 top-3 w-2 h-4 rounded-sm bg-white/90 ring-1 ring-white/30" />

      {/* head */}
      <div
        className="w-16 h-12 rounded-2xl bg-gradient-to-b from-slate-100 to-slate-300 shadow-lg flex items-center justify-center p-1.5 transition-all"
        style={{ boxShadow: error ? '0 0 0 2px #ef4444aa' : undefined }}
      >
        {/* screen */}
        <motion.div
          className="w-full h-full rounded-lg flex flex-col items-center justify-center gap-0.5"
          animate={{ backgroundColor: error ? ['#1c2233', '#3a1420', '#1c2233'] : '#1c2233' }}
          transition={{ duration: 0.8, repeat: error ? Infinity : 0, ease: 'easeInOut' }}
        >
          {error ? (
            <motion.span
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
              className="text-[11px] leading-none"
            >
              ⚠
            </motion.span>
          ) : (
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  animate={{
                    backgroundColor: i < status.lit ? status.color : '#3a4152',
                    scale: i < status.lit ? [1, 1.25, 1] : 1,
                  }}
                  transition={{ duration: 0.4 }}
                />
              ))}
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.span
              key={status.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="text-[6px] font-extrabold tracking-widest uppercase leading-none"
              style={{ color: status.color }}
            >
              {status.label}
            </motion.span>
          </AnimatePresence>
          <span className="text-[8px] leading-none" style={{ color: status.color }}>
            {status.mouth}
          </span>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* Picks what the little AI assistant should say, based on form progress. */
/* Idle messages the robot cycles through automatically (continuously,     */
/* every ~2.8s) when the form is untouched — starts with the credit line,  */
/* then moves on to the greeting, looping. Reactive states (typing,        */
/* loading, error) still take priority over this cycle once they apply.   */
const IDLE_MESSAGES = ['Developer: Naveen_Karade','Welcome to DigiCheck 👋'];

function useIdleMessageCycle(intervalMs = 2800) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % IDLE_MESSAGES.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return IDLE_MESSAGES[index];
}

function useBotMessage({ usernameOrNTID, password, error, loading, idleMessage }) {
  return useMemo(() => {
    if (loading) return "Hang tight — verifying your credentials...";
    if (error) return error;
    if (!usernameOrNTID.trim() && !password.trim()) return idleMessage;
    if (!usernameOrNTID.trim()) return "Hi! Please enter your NTID or Username to get started.";
    if (!password.trim()) return "Great! Now enter your password.";
    return "Looks good — tap Sign In when you're ready!";
  }, [usernameOrNTID, password, error, loading, idleMessage]);
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

  /* Subtle 3D tilt on the login card itself, driven by the same mouse-     */
  /* tracked springs as the background parallax — a light "premium" feel   */
  /* without being distracting. Range kept small (a few degrees).          */
  const cardRotateY = useTransform(springX, [-1, 1], ['-4deg', '4deg']);
  const cardRotateX = useTransform(springY, [-1, 1], ['3deg', '-3deg']);

  const idleMessage = useIdleMessageCycle(2000);
  const botMessage = useBotMessage({ usernameOrNTID, password, error, loading, idleMessage });

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
          {/* Company logo image (was a "JABIL" text pill) */}
          <div className="bg-white px-2.5 py-1 sm:px-3 sm:py-1.5 rounded shadow-md flex items-center">
            <img
              src={companyLogo}
              alt="Company logo"
              className="h-5 sm:h-6 w-auto object-contain"
            />
          </div>
          <div className="flex items-center gap-1.5 text-sm sm:text-lg font-semibold text-slate-200">
            <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
            <span>DigiCheck</span>
          </div>
        </div>
        <div className="hidden md:block text-xs font-mono text-slate-400 bg-white/5 px-3 py-1 rounded-full border border-white/10">
          Industrial Quality Checklists
        </div>
      </motion.div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-4 sm:py-6 z-10">
        <motion.div
          className="w-full max-w-xs sm:max-w-sm"
          variants={cardContainerVariants}
          initial="hidden"
          animate="visible"
          style={{ perspective: 1000 }}
        >
          <motion.div
            className="relative rounded-3xl p-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent shadow-2xl shadow-black/40"
            style={{ rotateX: cardRotateX, rotateY: cardRotateY, transformStyle: 'preserve-3d' }}
            whileHover={{ boxShadow: '0 25px 60px -15px rgba(56,189,248,0.25)' }}
            transition={{ duration: 0.4 }}
          >
            {/* "hands" — shoulder tabs where the robot's arms attach to the box */}
            <div className="absolute -left-2 top-9 w-3 h-9 rounded-md bg-white/10 border border-white/20 z-10" />
            <div className="absolute -right-2 top-9 w-3 h-9 rounded-md bg-white/10 border border-white/20 z-10" />
            {/* "legs" — feet tabs where the robot's legs attach below the box */}
            <div className="absolute -bottom-2.5 left-8 w-8 h-4 rounded-md bg-white/10 border border-white/20 z-10" />
            <div className="absolute -bottom-2.5 right-8 w-8 h-4 rounded-md bg-white/10 border border-white/20 z-10" />

            <div className="rounded-3xl bg-black/35 backdrop-blur-2xl border border-white/10 p-5 sm:p-7">

              {/* Brand Heading */}
              <motion.div variants={itemVariants} className="text-center mb-5 sm:mb-7">
                <motion.div variants={logoVariants} className="flex flex-col items-center mb-2.5 sm:mb-4">
                  <RobotFace password={password} error={error} />
                  <div className="relative mt-2 max-w-[230px] bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl px-3 py-2 shadow-xl">
                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-black/60 border-l border-t border-white/15 rotate-45" />
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={botMessage}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3 }}
                        className="text-[11px] sm:text-xs text-slate-200 text-center leading-snug"
                      >
                        {botMessage}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </motion.div>

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
                  className="relative overflow-hidden block w-auto mx-auto px-6 py-2 text-sm bg-gradient-to-r from-sky-500 to-jabil-blue hover:from-sky-400 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/25 transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b16]"
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
{/*
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
*/}
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
