import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export function LoginPage({ onLoginSuccess }) {
  const [usernameOrNTID, setUsernameOrNTID] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleQuickLogin = (userType) => {
    if (userType === 'admin') {
      setUsernameOrNTID('admin');
      setPassword('admin123');
    } else if (userType === 'operator') {
      setUsernameOrNTID('1234567');
      setPassword('operator123');
    } else if (userType === 'denied') {
      setUsernameOrNTID('5551234');
      setPassword('password123');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-900 text-white relative overflow-hidden">
      {/* Background Glows & Industrial Overlay */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      {/* Top Header Logo Bar */}
      <div className="p-6 flex items-center justify-between z-10 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="bg-white px-3 py-1.5 rounded font-black text-jabil-blue text-xl tracking-tighter shadow-md">
            JABIL
          </div>
          <div className="flex items-center gap-1.5 text-lg font-semibold text-slate-200">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <span>DigiCheck</span>
          </div>
        </div>
        <div className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700">
          Industrial Quality Checklist Engine v2.4
        </div>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center p-4 z-10">
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          
          {/* Brand Heading */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 mb-4 shadow-lg shadow-sky-500/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System Login</h1>
            <p className="text-sm text-slate-400 mt-1">Enter your NTID or Username & Password to access DigiCheck</p>
          </div>

          {/* Quick Demo Pre-fill Badges */}
          <div className="mb-6 p-3 bg-slate-900/60 border border-slate-700/60 rounded-xl text-xs">
            <div className="text-slate-400 font-semibold mb-2 flex items-center justify-between">
              <span>Quick Demo Access:</span>
              <span className="text-[10px] text-sky-400 uppercase tracking-wide font-mono">Click to autofill</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="px-2.5 py-1 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 transition flex items-center gap-1 font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                Admin (admin)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('operator')}
                className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition flex items-center gap-1 font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Operator (NTID: 1234567)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('denied')}
                className="px-2.5 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg hover:bg-rose-500/30 transition flex items-center gap-1 font-medium"
                title="Tests Admin Denied Access feature"
              >
                Denied NTID Demo
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-6 p-3.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 text-sm flex items-start gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Notice</p>
                <p className="text-xs text-rose-200/90 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Username or NTID Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usernameOrNTID}
                  onChange={(e) => setUsernameOrNTID(e.target.value)}
                  placeholder="Enter Username or NTID (e.g. 1234567)"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900/80 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent text-sm transition"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-sky-500/25 transition duration-200 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>

      {/* Footer as requested */}
      <div className="py-4 text-center border-t border-slate-800/80 text-xs text-slate-400 bg-slate-950/80 font-mono">
        @ Naveen-Jabil Inc.2026
      </div>
    </div>
  );
}
