/**
 * Main React Application Entry Component
 * --------------------------------------------------------------------
 * Manages user session state, async JWT authentication initialization,
 * role-based tab routing (ADMIN vs OPERATOR), top navigation header,
 * and page body rendering.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { storageService } from './services/storageService';
import { LoginPage } from './components/LoginPage';
import { Header } from './components/Header';
import { DashboardPage } from './components/admin/DashboardPage';
import { TemplatesPage } from './components/admin/TemplatesPage';
import { ApprovalsPage } from './components/admin/ApprovalsPage';
import { RecordsPage } from './components/admin/RecordsPage';
import { SettingsPage } from './components/admin/SettingsPage';
import { MyChecklistsPage } from './components/operator/MyChecklistsPage';
import { ShiftLeaderApprovalsPage } from './components/shiftleader/ShiftLeaderApprovalsPage';

/* "App launch" style transition — scales up from a slightly smaller,     */
/* lower position with a springy pop-in (like a macOS app opening), and   */
/* shrinks back down quickly on the way out (like it's closing).          */
const appOpenVariants = {
  initial: {
    opacity: 0,
    scale: 0.85,
    y: 10,
  },

  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },

  exit: {
    opacity: 0,
    scale: 0.96,
    y: -5,
    transition: {
      duration: 0.18,
      ease: [0.4, 0, 1, 1],
    },
  },
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => storageService.getCurrentUser());
  const [activeTab, setActiveTab] = useState('dashboard');

   const [pageOrigin, setPageOrigin] = useState({
    x: '50%',
    y: '50%',
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      await storageService.init();
      const validUser = await storageService.getCurrentUserAsync();
      if (validUser) {
        setCurrentUser(validUser);
        if (validUser.role === 'OPERATOR') {
          setActiveTab('my-checklists');
        } else if (validUser.role === 'SHIFT_LEADER') {
          setActiveTab('shift-leader-approvals');
        } else {
          setActiveTab('dashboard');
        }
      }
      setLoading(false);
    };

    initSession();
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.role === 'OPERATOR') {
      setActiveTab('my-checklists');
    } else if (user.role === 'SHIFT_LEADER') {
      setActiveTab('shift-leader-approvals');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    storageService.logout();
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
          <p className="text-xs font-mono text-slate-400">Initializing Jabil DigiCheck Platform...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      
      {/* Top Navigation Bar */}
      <Header
  currentUser={currentUser}
  activeTab={activeTab}
  setActiveTab={setActiveTab}
  setPageOrigin={setPageOrigin}
  onLogout={handleLogout}
/>

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">

        <AnimatePresence mode="wait">
  <motion.div
    key={activeTab}
    variants={appOpenVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    style={{
      transformOrigin: `${pageOrigin.x} ${pageOrigin.y}`,
    }}
  >
    {/* Admin & Sub Admin Pages — Sub Admin gets everything except Settings */}
    {(currentUser.role === 'ADMIN' || currentUser.role === 'SUBADMIN') && (
      <>
        {activeTab === 'dashboard' && <DashboardPage />}
        {activeTab === 'templates' && <TemplatesPage />}
        {activeTab === 'approvals' && <ApprovalsPage />}
        {activeTab === 'records' && <RecordsPage />}
        {activeTab === 'settings' && currentUser.role === 'ADMIN' && <SettingsPage />}
      </>
    )}

    {/* Shift Leader Page */}
    {currentUser.role === 'SHIFT_LEADER' && activeTab === 'shift-leader-approvals' && (
      <ShiftLeaderApprovalsPage currentUser={currentUser} />
    )}

    {/* Operator Pages */}
    {currentUser.role === 'OPERATOR' && (
      <MyChecklistsPage currentUser={currentUser} />
    )}
  </motion.div>
</AnimatePresence>

      </main>

      {/* Footer Bar */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-400 font-mono">
        @ Naveen-Jabil Inc.2026 • DigiCheck Plant Execution Platform
      </footer>

    </div>
  );
}
