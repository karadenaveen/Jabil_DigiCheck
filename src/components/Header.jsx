import React from 'react';
import { Bell, LogOut, LayoutDashboard, FileText, CheckCircle, Database, Settings, ClipboardList } from 'lucide-react';

export function Header({ currentUser, activeTab, setActiveTab, onLogout }) {
  const isAdmin = currentUser?.role === 'ADMIN';

  const navItems = isAdmin
    ? [
        { id: 'dashboard', label: 'DashBoard', icon: LayoutDashboard },
        { id: 'templates', label: 'Templates', icon: FileText },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle },
        { id: 'records', label: 'Records', icon: Database },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    : [
        { id: 'my-checklists', label: 'My Checklists', icon: ClipboardList }
      ];

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Jabil Logo & DigiCheck */}
          <div className="flex items-center gap-3">
            <div className="bg-[#00529B] text-white px-3 py-1.5 rounded font-black text-xl tracking-tighter shadow-sm">
              JABIL
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-slate-900 text-lg tracking-tight">DigiCheck</span>
            </div>
          </div>

          {/* Center: Navigation Bar */}
          <nav className="flex items-center space-x-1 md:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                    isActive
                      ? 'bg-sky-50 text-[#00529B] border-b-2 border-[#00529B] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#00529B]' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Notifications, User Info & Logout */}
          <div className="flex items-center gap-4">
            
            {/* Notification Bell */}
            <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-sky-500 rounded-full ring-2 ring-white animate-pulse"></span>
            </button>

            {/* User Avatar Circle & Badge */}
            <div className="flex items-center gap-2.5 bg-slate-50 pl-2 pr-3 py-1 rounded-full border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {currentUser?.avatar || 'DU'}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <div className="text-xs font-bold text-slate-800">{currentUser?.name || 'Dummy Operator'}</div>
                <div className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded ${
                  isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-sky-100 text-sky-700'
                }`}>
                  {currentUser?.role || 'OPERATOR'}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
              title="Logout System"
            >
              <LogOut className="w-5 h-5" />
            </button>

          </div>

        </div>
      </div>
    </header>
  );
}
