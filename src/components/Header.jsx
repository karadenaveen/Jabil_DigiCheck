import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, LogOut, LayoutDashboard, FileText, CheckCircle, Database, Settings, ClipboardList, XCircle, Clock, User, ShieldCheck } from 'lucide-react';
import { storageService } from '../services/storageService';
import { sortByLastActivityDesc } from '../utils/submissionTimeline';
import companyLogo from '../assets/logo.png';

// How many recent activity entries to show in the bell dropdown, and how
// often to silently refresh it in the background so new submissions /
// approval decisions show up without a manual page reload.
const MAX_NOTIFICATIONS = 15;
const POLL_INTERVAL_MS = 20000;

export function Header({
  currentUser,
  activeTab,
  setActiveTab,
  setPageOrigin,
  onLogout
}) {
  const role = currentUser?.role;
  const isMainAdmin = role === 'ADMIN';
  const isSubAdmin = role === 'SUBADMIN';
  const isShiftLeader = role === 'SHIFT_LEADER';
  // Sub Admin gets the same day-to-day visibility as Admin, minus Settings.
  const seesAllActivity = isMainAdmin || isSubAdmin;

  const navItems = isMainAdmin
    ? [
        { id: 'dashboard', label: 'DashBoard', icon: LayoutDashboard },
        { id: 'templates', label: 'Templates', icon: FileText },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle },
        { id: 'records', label: 'Records', icon: Database },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    : isSubAdmin
    ? [
        { id: 'dashboard', label: 'DashBoard', icon: LayoutDashboard },
        { id: 'templates', label: 'Templates', icon: FileText },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle },
        { id: 'records', label: 'Records', icon: Database },
      ]
    : isShiftLeader
    ? [
        { id: 'shift-leader-approvals', label: 'Approvals Queue', icon: ShieldCheck },
      ]
    : [
        { id: 'my-checklists', label: 'My Checklists', icon: ClipboardList }
      ];

  // --- Notification bell: shows recent submission / approval activity ---
  // Admin/Sub Admin see activity across everyone; Shift Leader sees the
  // items relevant to their review stage; operators only see their own.
  const [notifications, setNotifications] = useState([]);
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [lastSeenCount, setLastSeenCount] = useState(0);
  const bellRef = useRef(null);

  const fetchNotifications = async () => {
    const subs = await storageService.getSubmissions();
    // LIFO — whichever submission was most recently submitted, forwarded,
    // or decided on (by anyone, at any stage) shows first.
    const sorted = sortByLastActivityDesc(subs);
    let scoped;
    if (seesAllActivity) {
      scoped = sorted;
    } else if (isShiftLeader) {
      scoped = sorted.filter((s) =>
        ['Pending', 'PendingAdmin', 'RejectedByShiftLeader', 'RejectedByAdmin'].includes(s.status)
      );
    } else {
      scoped = sorted.filter((s) => s.operatorNTID === currentUser?.ntid);
    }
    setNotifications(scoped.slice(0, MAX_NOTIFICATIONS));
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.ntid]);

  // Close dropdown when clicking outside it
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setIsBellOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = Math.max(notifications.length - lastSeenCount, 0);

  const toggleBell = () => {
    setIsBellOpen((open) => {
      const next = !open;
      if (next) setLastSeenCount(notifications.length); // mark as read on open
      return next;
    });
  };

  const statusMeta = {
    Approved: { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700' },
    PendingAdmin: { icon: Clock, color: 'text-sky-600', bg: 'bg-sky-50', badge: 'bg-sky-100 text-sky-700' },
    Rejected: { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700' },
    RejectedByShiftLeader: { icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50', badge: 'bg-rose-100 text-rose-700' },
    RejectedByAdmin: { icon: XCircle, color: 'text-orange-600', bg: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700' },
    Pending: { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700' },
  };

  const statusLabel = (status) => ({
    Pending: 'Pending (Shift Leader)',
    PendingAdmin: 'Pending (Admin)',
    Approved: 'Approved',
    RejectedByShiftLeader: 'Rejected (Shift Leader)',
    RejectedByAdmin: 'Rejected (Admin)',
    Rejected: 'Rejected'
  }[status] || status);

  const roleBadgeClass = {
    ADMIN: 'bg-indigo-100 text-indigo-700',
    SUBADMIN: 'bg-purple-100 text-purple-700',
    SHIFT_LEADER: 'bg-amber-100 text-amber-700',
    OPERATOR: 'bg-sky-100 text-sky-700',
  }[role] || 'bg-sky-100 text-sky-700';

  const timeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Left: Company Logo & DigiCheck */}
          <div className="flex items-center gap-3">
            <div className="bg-[#00529B] px-3 py-1.5 rounded shadow-sm flex items-center">
              <img
                src={companyLogo}
                alt="Company logo"
                className="h-9 w-auto object-contain"
              />
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
                <motion.button
                  key={item.id}
                  onClick={(e) => {
  const rect = e.currentTarget.getBoundingClientRect();

  setPageOrigin({
    x: `${rect.left + rect.width / 2}px`,
    y: `${rect.top + rect.height / 2}px`,
  });

  setActiveTab(item.id);
}}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  className={`relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    isActive
                      ? 'text-[#00529B]'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="header-active-tab"
                      className="absolute inset-0 bg-sky-50 border-b-2 border-[#00529B] rounded-lg shadow-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <Icon className={`relative w-4 h-4 ${isActive ? 'text-[#00529B]' : 'text-slate-400'}`} />
                  <span className="relative">{item.label}</span>
                </motion.button>
              );
            })}
          </nav>

          {/* Right: Notifications, User Info & Logout */}
          <div className="flex items-center gap-4">
            
            {/* Notification Bell */}
            <div ref={bellRef} className="relative">
              <button
                onClick={toggleBell}
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-rose-500 rounded-full ring-2 ring-white text-[9px] font-bold text-white flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isBellOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-96 max-w-[92vw] bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50"
                  >
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">
                        {seesAllActivity ? 'Submission Activity' : isShiftLeader ? 'Your Review Queue Activity' : 'Your Submission Status'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        Last {notifications.length}
                      </span>
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 font-medium">
                          No activity yet.
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const meta = statusMeta[n.status] || statusMeta.Pending;
                          const StatusIcon = meta.icon;
                          return (
                            <div key={n.id} className="px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                                <StatusIcon className={`w-4 h-4 ${meta.color}`} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {n.templateTitle}
                                  <span className="ml-1.5 font-mono font-normal text-slate-400">{n.docNumber}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span className="font-semibold text-slate-700">{n.operatorName}</span>
                                  <span className="font-mono text-slate-400">({n.operatorNTID})</span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-600">
                                    {n.shift}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${meta.badge}`}>
                                    {statusLabel(n.status)}
                                  </span>
                                  <span className="text-[10px] text-slate-400 ml-auto whitespace-nowrap">
                                    {timeAgo(n.reviewedAt || n.shiftLeaderReviewedAt || n.submittedAt)}
                                  </span>
                                </div>
                                {n.status.includes('Rejected') && n.rejectionRemark && (
                                  <div className="text-[10px] text-rose-600 italic mt-1 truncate">
                                    Remark: {n.rejectionRemark}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User Avatar Circle & Badge */}
            <div className="flex items-center gap-2.5 bg-slate-50 pl-2 pr-3 py-1 rounded-full border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {currentUser?.avatar || 'DU'}
              </div>
              <div className="text-left leading-tight hidden sm:block">
                <div className="text-xs font-bold text-slate-800">{currentUser?.name || 'Dummy Operator'}</div>
                <div className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded ${roleBadgeClass}`}>
                  {(currentUser?.role || 'OPERATOR').replace('_', ' ')}
                  {isMainAdmin && <span className="ml-1 opacity-70">(Main)</span>}
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
