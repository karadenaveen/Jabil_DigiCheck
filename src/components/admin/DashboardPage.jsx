/**
 * Admin Dashboard — Plant Operations Analytics
 * --------------------------------------------------------------------
 * Enterprise-grade analytics overview compiled entirely from live REST data
 * (storageService -> Express + MySQL). No mock/dummy datasets: every chart,
 * KPI, and list below is derived from `getDashboardStats`, `getSubmissions`,
 * and `getTemplates`. Business logic, endpoints, and data contracts are
 * untouched — this file only changes presentation, aggregation-for-display,
 * and interaction (filtering, drill-down, export triggers reuse the exact
 * same service calls the rest of the app already relies on).
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { storageService } from '../../services/storageService';
import {
  FileText, CheckCircle2, Clock, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Upload, Layers, Activity, Calendar, ArrowUpRight, Users, RefreshCw, Download,
  BarChart3, PieChart as PieIcon, Award, FolderClock, Filter, Sparkles,
  ChevronRight, X, Inbox, LineChart as LineIcon
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

/* ------------------------------------------------------------------ */
/* Design tokens                                                       */
/* ------------------------------------------------------------------ */
const COLORS = {
  primary: '#00529B',
  teal: '#00A3E0',
  approved: '#10B981',
  pending: '#F59E0B',
  rejected: '#EF4444',
  violet: '#7C3AED',
  slate: '#94A3B8'
};

const STATUS_META = {
  Approved: { color: COLORS.approved, bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  Pending: { color: COLORS.pending, bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  Rejected: { color: COLORS.rejected, bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' }
};

const TREND_FILTERS = ['Day', 'Week', 'Month', 'Year'];
const CHART_TYPES = [
  { key: 'area', label: 'Area', icon: Activity },
  { key: 'bar', label: 'Bar', icon: BarChart3 },
  { key: 'line', label: 'Line', icon: LineIcon }
];

/* ------------------------------------------------------------------ */
/* Small utilities                                                     */
/* ------------------------------------------------------------------ */

// Animated numeric counter — purely presentational, no data invention.
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const safeTarget = Number.isFinite(target) ? target : 0;
    const from = prevTarget.current;
    let raf;
    let start = null;

    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (safeTarget - from) * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
      else prevTarget.current = safeTarget;
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function getBucketKey(dateStr, filter) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  if (filter === 'Day') return dateStr;
  if (filter === 'Week') {
    const dow = d.getDay() || 7;
    const monday = new Date(d);
    monday.setDate(d.getDate() - dow + 1);
    return monday.toISOString().split('T')[0];
  }
  if (filter === 'Month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${d.getFullYear()}`;
}

function getBucketLabel(key, filter) {
  if (filter === 'Day') {
    return new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (filter === 'Week') {
    return `Wk ${new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  if (filter === 'Month') {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
  return key;
}

function initialsOf(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '—';
}

/* ------------------------------------------------------------------ */
/* Reusable presentational primitives                                  */
/* ------------------------------------------------------------------ */

function GlassPanel({ className = '', children, ...rest }) {
  return (
    <div
      className={`relative bg-white/80 backdrop-blur-xl border border-white/60 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] rounded-2xl ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon = Inbox, title = 'No data yet', subtitle = 'Data will appear here once records are available.' }) {
  return (
    <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center px-6 py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/60">
      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      <p className="text-[11px] text-slate-400 mt-1 max-w-[220px]">{subtitle}</p>
    </div>
  );
}

function SkeletonBlock({ className = '' }) {
  return <div className={`animate-pulse bg-slate-200/70 rounded-xl ${className}`} />;
}

function TrendBadge({ direction = 'flat', label }) {
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const color = direction === 'up' ? 'text-emerald-600' : direction === 'down' ? 'text-rose-600' : 'text-slate-400';
  return (
    <div className={`flex items-center gap-1 text-[11px] font-semibold ${color}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

const cardEnter = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }
  })
};

/* KPI Card ------------------------------------------------------------ */
function KpiCard({ index, icon: Icon, label, value, suffix = '', accent, trend, active, clickable, onClick, footnote }) {
  const animated = useCountUp(Number(value) || 0);

  return (
    <motion.button
      type="button"
      custom={index}
      variants={cardEnter}
      initial="hidden"
      animate="show"
      whileHover={clickable ? { y: -3, scale: 1.01 } : undefined}
      onClick={clickable ? onClick : undefined}
      className={`text-left bg-white/85 backdrop-blur-xl p-5 rounded-2xl border shadow-sm transition-all
        ${clickable ? 'cursor-pointer hover:shadow-lg' : 'cursor-default'}
        ${active ? 'border-[#00529B] ring-2 ring-[#00529B]/25' : 'border-slate-200/80'}`}
    >
      <div className="flex items-center justify-between text-slate-500 mb-3">
        <span className="text-[11px] font-bold uppercase tracking-wider">{label}</span>
        <div className="p-2 rounded-xl" style={{ backgroundColor: `${accent}1A`, color: accent }}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div className="text-2xl font-extrabold text-slate-900 tabular-nums">
        {animated.toLocaleString()}{suffix}
      </div>
      <div className="mt-2 flex items-center justify-between">
        {trend ? <TrendBadge direction={trend.direction} label={trend.label} /> : (
          <span className="text-[11px] text-slate-400">{footnote}</span>
        )}
        {clickable && <ChevronRight className={`w-3.5 h-3.5 ${active ? 'text-[#00529B]' : 'text-slate-300'}`} />}
      </div>
    </motion.button>
  );
}

/* Custom Recharts tooltip ---------------------------------------------- */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-slate-900/95 text-white text-xs rounded-lg px-3 py-2.5 shadow-xl border border-slate-700/50 backdrop-blur">
      <div className="font-semibold mb-1.5 text-slate-200">{label}</div>
      <div className="space-y-1">
        {payload.map((p) => (
          <div key={p.dataKey} className="flex items-center gap-2 justify-between">
            <span className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
              {p.name}
            </span>
            <span className="font-bold">{p.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                       */
/* ------------------------------------------------------------------ */

export function DashboardPage() {
  const [trendFilter, setTrendFilter] = useState('Day');
  const [chartType, setChartType] = useState('area');
  const [drillStatus, setDrillStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [fetchError, setFetchError] = useState(false);

  const [metrics, setMetrics] = useState({
    totalRecords: 0,
    completedForms: 0,
    pendingForms: 0,
    rejectedForms: 0,
    uploadSuccessRate: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [templates, setTemplates] = useState([]);

  const loadDashboard = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setFetchError(false);
    try {
      const [stats, subs, tmpls] = await Promise.all([
        storageService.getDashboardStats(),
        storageService.getSubmissions({}),
        storageService.getTemplates()
      ]);

      if (stats) {
        if (stats.metrics) setMetrics(stats.metrics);
        if (stats.recentActivities) setRecentActivities(stats.recentActivities);
      } else {
        setFetchError(true);
      }
      setSubmissions(Array.isArray(subs) ? subs : []);
      setTemplates(Array.isArray(tmpls) ? tmpls : []);
      setLastUpdated(new Date());
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(false); }, [loadDashboard]);

  /* ---------------- Derived / aggregated (real data only) ---------------- */

  const { totalRecords, completedForms, pendingForms, rejectedForms, uploadSuccessRate } = metrics;

  const statusDistribution = useMemo(() => ([
    { name: 'Approved', value: completedForms, color: COLORS.approved },
    { name: 'Pending', value: pendingForms, color: COLORS.pending },
    { name: 'Rejected', value: rejectedForms, color: COLORS.rejected }
  ]), [completedForms, pendingForms, rejectedForms]);

  const hasStatusData = totalRecords > 0;

  const trendData = useMemo(() => {
    if (!submissions.length) return [];
    const buckets = new Map();

    submissions.forEach((s) => {
      const key = getBucketKey(s.date, trendFilter);
      if (!key) return;
      if (!buckets.has(key)) {
        buckets.set(key, { key, submissions: 0, Approved: 0, Pending: 0, Rejected: 0 });
      }
      const b = buckets.get(key);
      b.submissions += 1;
      if (b[s.status] !== undefined) b[s.status] += 1;
    });

    return Array.from(buckets.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12)
      .map((b) => ({ ...b, name: getBucketLabel(b.key, trendFilter) }));
  }, [submissions, trendFilter]);

  const shiftData = useMemo(() => {
    const buckets = new Map();
    submissions.forEach((s) => {
      const shift = s.shift || 'Unspecified';
      if (!buckets.has(shift)) buckets.set(shift, { name: shift, Approved: 0, Pending: 0, Rejected: 0, total: 0 });
      const b = buckets.get(shift);
      b.total += 1;
      if (b[s.status] !== undefined) b[s.status] += 1;
    });
    return Array.from(buckets.values()).sort((a, b) => b.total - a.total);
  }, [submissions]);

  const templateData = useMemo(() => {
    const buckets = new Map();
    submissions.forEach((s) => {
      const title = s.templateTitle || 'Untitled Blueprint';
      if (!buckets.has(title)) buckets.set(title, { name: title, count: 0 });
      buckets.get(title).count += 1;
    });
    return Array.from(buckets.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((t) => ({ ...t, label: t.name.length > 22 ? `${t.name.slice(0, 22)}…` : t.name }));
  }, [submissions]);

  const topPerformers = useMemo(() => {
    const buckets = new Map();
    submissions.forEach((s) => {
      const key = s.operatorNTID || s.operatorName;
      if (!key) return;
      if (!buckets.has(key)) buckets.set(key, { name: s.operatorName || 'Unknown', ntid: s.operatorNTID || '—', total: 0, approved: 0 });
      const b = buckets.get(key);
      b.total += 1;
      if (s.status === 'Approved') b.approved += 1;
    });
    return Array.from(buckets.values())
      .map((p) => ({ ...p, rate: p.total ? Math.round((p.approved / p.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [submissions]);

  const latestUploads = useMemo(() => templates.slice(0, 5), [templates]);

  const activeTemplatesCount = useMemo(
    () => templates.filter((t) => t.status === 'Active').length,
    [templates]
  );

  const todaysSubmissions = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return submissions.filter((s) => s.date === today).length;
  }, [submissions]);

  const drilldownRecords = useMemo(() => {
    if (drillStatus === 'All') return [];
    return submissions.filter((s) => s.status === drillStatus).slice(0, 8);
  }, [submissions, drillStatus]);

  const handleDrill = (status) => setDrillStatus((prev) => (prev === status ? 'All' : status));
  const handleExport = () => storageService.exportExcel(drillStatus, '');

  /* ---------------------------- Render ---------------------------- */

  return (
    <div className="space-y-6 pb-12">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Dashboard Overview
            <Sparkles className="w-4 h-4 text-[#00A3E0]" />
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {lastUpdated
              ? `Live Operations Feed • Updated ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Live Operations Feed'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
            <Calendar className="w-4 h-4 text-[#00529B]" />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <button
            onClick={() => loadDashboard(true)}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#00529B] hover:border-[#00529B]/40 shadow-sm transition"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#00529B] text-white shadow-sm hover:bg-[#003d73] transition"
            title="Export records to Excel"
          >
            <Download className="w-3.5 h-3.5" />
            Export{drillStatus !== 'All' ? ` ${drillStatus}` : ''}
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4" />
          Some dashboard data couldn't be loaded from the server. Showing the most recent data available.
        </div>
      )}

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} className="h-[112px]" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <KpiCard
            index={0} icon={FileText} label="Total Records" value={totalRecords} accent={COLORS.primary}
            clickable active={drillStatus === 'All'} onClick={() => setDrillStatus('All')}
            footnote="All checklist submissions"
          />
          <KpiCard
            index={1} icon={CheckCircle2} label="Approved" value={completedForms} accent={COLORS.approved}
            clickable active={drillStatus === 'Approved'} onClick={() => handleDrill('Approved')}
            footnote={totalRecords ? `${Math.round((completedForms / totalRecords) * 100)}% of total` : 'No records yet'}
          />
          <KpiCard
            index={2} icon={Clock} label="Pending" value={pendingForms} accent={COLORS.pending}
            clickable active={drillStatus === 'Pending'} onClick={() => handleDrill('Pending')}
            footnote="Awaiting QA review"
          />
          <KpiCard
            index={3} icon={AlertTriangle} label="Rejected" value={rejectedForms} accent={COLORS.rejected}
            clickable active={drillStatus === 'Rejected'} onClick={() => handleDrill('Rejected')}
            footnote="Sent back to operator"
          />
          <KpiCard
            index={4} icon={Upload} label="Approval Rate" value={uploadSuccessRate} suffix="%" accent={COLORS.teal}
            footnote="Of reviewed submissions"
          />
          <KpiCard
            index={5} icon={Layers} label="Active Blueprints" value={activeTemplatesCount} accent={COLORS.violet}
            footnote={`${templates.length} total • ${todaysSubmissions} submitted today`}
          />
        </div>
      )}

      {/* Drill-down strip */}
      <AnimatePresence>
        {drillStatus !== 'All' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <GlassPanel className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${STATUS_META[drillStatus]?.dot}`} />
                  <h3 className="text-sm font-bold text-slate-800">
                    {drillStatus} Records <span className="text-slate-400 font-medium">({drilldownRecords.length} of {metrics[`${drillStatus === 'Approved' ? 'completed' : drillStatus.toLowerCase()}Forms`] ?? drilldownRecords.length} shown)</span>
                  </h3>
                </div>
                <button
                  onClick={() => setDrillStatus('All')}
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  <X className="w-3.5 h-3.5" /> Clear filter
                </button>
              </div>

              {drilldownRecords.length === 0 ? (
                <EmptyState icon={Filter} title={`No ${drillStatus.toLowerCase()} records`} subtitle="Nothing matches this status right now." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-slate-400 uppercase tracking-wider text-[10px] border-b border-slate-100">
                        <th className="py-2 pr-4 font-semibold">Doc #</th>
                        <th className="py-2 pr-4 font-semibold">Template</th>
                        <th className="py-2 pr-4 font-semibold">Operator</th>
                        <th className="py-2 pr-4 font-semibold">Shift</th>
                        <th className="py-2 pr-4 font-semibold">Date</th>
                        <th className="py-2 pr-0 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drilldownRecords.map((r) => (
                        <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70">
                          <td className="py-2.5 pr-4 font-mono text-slate-600">{r.docNumber || '—'}</td>
                          <td className="py-2.5 pr-4 text-slate-700 font-medium">{r.templateTitle}</td>
                          <td className="py-2.5 pr-4 text-slate-600">{r.operatorName}</td>
                          <td className="py-2.5 pr-4 text-slate-500">{r.shift}</td>
                          <td className="py-2.5 pr-4 text-slate-500">{r.date}</td>
                          <td className="py-2.5 pr-0 text-right">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_META[r.status]?.bg} ${STATUS_META[r.status]?.text}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Charts: Trend + Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <GlassPanel className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Submissions Trend</h3>
              <p className="text-xs text-slate-500">Breakdown of checklist forms submitted across plant lines</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl text-[11px] font-semibold border border-slate-200">
                {CHART_TYPES.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setChartType(key)}
                    title={key}
                    className={`p-1.5 rounded-lg transition-all ${chartType === key ? 'bg-white text-[#00529B] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
              <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold border border-slate-200">
                {TREND_FILTERS.map((period) => (
                  <button
                    key={period}
                    onClick={() => setTrendFilter(period)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${trendFilter === period ? 'bg-white text-[#00529B] shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            {loading ? (
              <SkeletonBlock className="h-full w-full" />
            ) : trendData.length === 0 ? (
              <EmptyState icon={BarChart3} title="No submissions yet" subtitle="Trend chart will populate once checklists are submitted." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="submissions" name="Total" stroke={COLORS.primary} strokeWidth={2.5} dot={false} />
                    <Line type="monotone" dataKey="Approved" stroke={COLORS.approved} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Pending" stroke={COLORS.pending} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="Rejected" stroke={COLORS.rejected} strokeWidth={2} dot={false} />
                  </LineChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,82,155,0.05)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Approved" stackId="s" fill={COLORS.approved} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Pending" stackId="s" fill={COLORS.pending} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Rejected" stackId="s" fill={COLORS.rejected} radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : (
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.approved} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={COLORS.approved} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.pending} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={COLORS.pending} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorRejected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.rejected} stopOpacity={0.45} />
                        <stop offset="95%" stopColor={COLORS.rejected} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="Approved" stackId="a" stroke={COLORS.approved} fill="url(#colorApproved)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Pending" stackId="a" stroke={COLORS.pending} fill="url(#colorPending)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Rejected" stackId="a" stroke={COLORS.rejected} fill="url(#colorRejected)" strokeWidth={2} />
                    <Line type="monotone" dataKey="submissions" name="Total" stroke={COLORS.primary} strokeWidth={2.5} dot={{ r: 3 }} />
                  </ComposedChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#00529B]" /> Record Status Distribution
            </h3>
            <p className="text-xs text-slate-500 mb-4">Proportions of Approved, Pending & Rejected forms</p>

            <div className="h-44 w-full flex items-center justify-center">
              {loading ? (
                <SkeletonBlock className="h-full w-full rounded-full" />
              ) : !hasStatusData ? (
                <EmptyState icon={PieIcon} title="No records yet" subtitle="Status breakdown appears once forms are submitted." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={5} dataKey="value"
                    >
                      {statusDistribution.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
            {statusDistribution.map((item) => (
              <button
                key={item.name}
                onClick={() => handleDrill(item.name)}
                className={`flex items-center gap-2 text-xs rounded-lg px-1.5 py-1 transition ${drillStatus === item.name ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 font-medium">{item.name}:</span>
                <span className="font-bold text-slate-900">{item.value}</span>
              </button>
            ))}
          </div>
        </GlassPanel>
      </div>

      {/* Charts: Shift distribution + Template distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <GlassPanel className="p-6">
          <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00529B]" /> Submissions by Shift
          </h3>
          <p className="text-xs text-slate-500 mb-4">Status breakdown across working shifts</p>
          <div className="h-56 w-full">
            {loading ? (
              <SkeletonBlock className="h-full w-full" />
            ) : shiftData.length === 0 ? (
              <EmptyState icon={Layers} title="No shift data" subtitle="Submissions will be grouped by shift here." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shiftData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,82,155,0.05)' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Approved" stackId="s" fill={COLORS.approved} />
                  <Bar dataKey="Pending" stackId="s" fill={COLORS.pending} />
                  <Bar dataKey="Rejected" stackId="s" fill={COLORS.rejected} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassPanel>

        <GlassPanel className="p-6">
          <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#00529B]" /> Top Blueprints by Volume
          </h3>
          <p className="text-xs text-slate-500 mb-4">Most frequently submitted checklist templates</p>
          <div className="h-56 w-full">
            {loading ? (
              <SkeletonBlock className="h-full w-full" />
            ) : templateData.length === 0 ? (
              <EmptyState icon={FileText} title="No submissions yet" subtitle="Template usage will be ranked here." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={templateData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis type="number" stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" stroke="#94A3B8" fontSize={10.5} width={140} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,82,155,0.05)' }} />
                  <Bar dataKey="count" name="Submissions" radius={[0, 6, 6, 0]}>
                    {templateData.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? COLORS.primary : COLORS.teal} fillOpacity={1 - i * 0.11} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* Top performers + Latest uploads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <GlassPanel className="p-6">
          <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
            <Award className="w-4 h-4 text-[#00529B]" /> Top Performers
          </h3>
          <p className="text-xs text-slate-500 mb-4">Operators ranked by checklist volume & approval rate</p>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-12" />)}</div>
          ) : topPerformers.length === 0 ? (
            <EmptyState icon={Users} title="No operator activity" subtitle="Top performers appear once checklists are submitted." />
          ) : (
            <div className="space-y-3">
              {topPerformers.map((p, i) => (
                <motion.div
                  key={p.ntid + p.name}
                  custom={i} variants={cardEnter} initial="hidden" animate="show"
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00529B] to-[#00A3E0] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {initialsOf(p.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate">{p.name}</span>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">{p.ntid}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#00529B] to-emerald-500 transition-all"
                        style={{ width: `${p.rate}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-extrabold text-slate-900">{p.total}</div>
                    <div className="text-[10px] text-slate-400">{p.rate}% approved</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </GlassPanel>

        <GlassPanel className="p-6">
          <h3 className="font-bold text-slate-900 text-base mb-1 flex items-center gap-2">
            <FolderClock className="w-4 h-4 text-[#00529B]" /> Latest Blueprint Uploads
          </h3>
          <p className="text-xs text-slate-500 mb-4">Most recently added checklist templates</p>

          {loading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonBlock key={i} className="h-12" />)}</div>
          ) : latestUploads.length === 0 ? (
            <EmptyState icon={FolderClock} title="No blueprints yet" subtitle="Uploaded templates will show up here." />
          ) : (
            <div className="space-y-2">
              {latestUploads.map((t, i) => (
                <motion.div
                  key={t.id}
                  custom={i} variants={cardEnter} initial="hidden" animate="show"
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#00529B] flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{t.title}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{t.docNumber} • Rev {t.revision}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${t.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {t.status}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-1">{t.uploadedDate}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </GlassPanel>
      </div>

      {/* Recent Activity Timeline */}
      <GlassPanel className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00529B]" />
              <span>Recent Activity Feed</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Latest login, submission, and approval events across shifts</p>
          </div>
          <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Sync
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonBlock key={i} className="h-16" />)}</div>
        ) : recentActivities.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No recent audit activity yet"
            subtitle="Actions like login, submit, approve, and reject will appear here."
          />
        ) : (
          <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
            {recentActivities.map((act, i) => (
              <motion.div
                key={act.id}
                custom={i} variants={cardEnter} initial="hidden" animate="show"
                className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/80 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-sky-100 text-[#00529B] flex items-center justify-center font-bold text-xs shrink-0">
                    {act.user.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">
                      {act.user} <span className="font-normal text-slate-600">• {act.action}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono truncate">{act.target}</div>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-3">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${act.statusColor}`}>
                    {act.status}
                  </span>
                  <div className="text-[11px] text-slate-400 mt-1">{act.time}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </GlassPanel>

    </div>
  );
}
