/**
 * Main React Application Entry Component
 * --------------------------------------------------------------------
 * Manages user session state, async JWT authentication initialization,
 * role-based tab routing (ADMIN vs OPERATOR), top navigation header,
 * and page body rendering.
 */

import React, { useState, useEffect } from 'react';
import { storageService } from './services/storageService';
import { LoginPage } from './components/LoginPage';
import { Header } from './components/Header';
import { DashboardPage } from './components/admin/DashboardPage';
import { TemplatesPage } from './components/admin/TemplatesPage';
import { ApprovalsPage } from './components/admin/ApprovalsPage';
import { RecordsPage } from './components/admin/RecordsPage';
import { SettingsPage } from './components/admin/SettingsPage';
import { MyChecklistsPage } from './components/operator/MyChecklistsPage';

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => storageService.getCurrentUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      await storageService.init();
      const validUser = await storageService.getCurrentUserAsync();
      if (validUser) {
        setCurrentUser(validUser);
        if (validUser.role === 'OPERATOR') {
          setActiveTab('my-checklists');
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
        onLogout={handleLogout}
      />

      {/* Main Page Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Admin Pages */}
        {currentUser.role === 'ADMIN' && (
          <>
            {activeTab === 'dashboard' && <DashboardPage />}
            {activeTab === 'templates' && <TemplatesPage />}
            {activeTab === 'approvals' && <ApprovalsPage />}
            {activeTab === 'records' && <RecordsPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </>
        )}

        {/* Operator Pages */}
        {currentUser.role === 'OPERATOR' && (
          <MyChecklistsPage currentUser={currentUser} />
        )}

      </main>

      {/* Footer Bar */}
      <footer className="bg-white border-t border-slate-200 py-3 text-center text-xs text-slate-400 font-mono">
        @ Naveen-Jabil Inc.2026 • DigiCheck Plant Execution Platform
      </footer>

    </div>
  );
}
