import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { 
  FileText, CheckCircle2, Clock, AlertTriangle, TrendingUp, 
  Upload, Layers, Activity, Calendar, ArrowUpRight 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

export function DashboardPage() {
  const [trendFilter, setTrendFilter] = useState('Day'); // Day, Month, Year
  const [metrics, setMetrics] = useState({
    totalRecords: 0,
    completedForms: 0,
    pendingForms: 0,
    rejectedForms: 0,
    uploadSuccessRate: 98.4
  });
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const stats = await storageService.getDashboardStats();
      if (stats) {
        if (stats.metrics) setMetrics(stats.metrics);
        if (stats.recentActivities) setRecentActivities(stats.recentActivities);
      }
    };
    fetchDashboardData();
  }, []);

  // Metrics
  const totalRecords = metrics.totalRecords;
  const completedForms = metrics.completedForms;
  const pendingForms = metrics.pendingForms;
  const rejectedForms = metrics.rejectedForms;
  const uploadSuccessRate = metrics.uploadSuccessRate;

  // Chart Data per filter
  const trendData = {
    Day: [
      { name: '08:00 AM', submissions: 12, approved: 10 },
      { name: '10:00 AM', submissions: 24, approved: 22 },
      { name: '12:00 PM', submissions: 18, approved: 15 },
      { name: '02:00 PM', submissions: 32, approved: 30 },
      { name: '04:00 PM', submissions: 28, approved: 26 },
      { name: '06:00 PM', submissions: 15, approved: 14 },
    ],
    Month: [
      { name: 'Week 1', submissions: 140, approved: 130 },
      { name: 'Week 2', submissions: 210, approved: 195 },
      { name: 'Week 3', submissions: 180, approved: 172 },
      { name: 'Week 4', submissions: 260, approved: 248 },
    ],
    Year: [
      { name: 'Jan', submissions: 820, approved: 780 },
      { name: 'Feb', submissions: 950, approved: 910 },
      { name: 'Mar', submissions: 1100, approved: 1050 },
      { name: 'Apr', submissions: 1020, approved: 990 },
      { name: 'May', submissions: 1250, approved: 1210 },
      { name: 'Jun', submissions: 1180, approved: 1140 },
    ]
  };

  const statusDistribution = [
    { name: 'Approved', value: completedForms, color: '#10B981' },
    { name: 'Pending', value: pendingForms, color: '#F59E0B' },
    { name: 'Rejected', value: rejectedForms, color: '#EF4444' }
  ];

  const displayActivities = recentActivities;

  return (
    <div className="space-y-6 pb-12">
      
      {/* Small Header Title as requested */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Welcome Back. Here's Your Operations Overview.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
          <Calendar className="w-4 h-4 text-[#00529B]" />
          <span>Live Operations Feed • {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Total Records */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Records</span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#00529B]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalRecords}</div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+12% from last week</span>
          </div>
        </div>

        {/* Card 2: Completed Forms */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Completed Forms</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{completedForms}</div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>94.2% completion compliance</span>
          </div>
        </div>

        {/* Card 3: Upload Success Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Upload Success</span>
            <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
              <Upload className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{uploadSuccessRate}%</div>
          <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-sky-600">
            <span>Blueprint Excel Parser Active</span>
          </div>
        </div>

        {/* Card 4: Approved Forms */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Approved</span>
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{completedForms}</div>
          <div className="mt-2 text-[11px] text-slate-500">Verified by QA Supervisors</div>
        </div>

        {/* Card 5: Pending Approvals */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Forms</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">{pendingForms}</div>
          <div className="mt-2 text-[11px] text-amber-700 font-medium">Requires Manager Action</div>
        </div>

      </div>

      {/* Charts Section: Submissions Trends & Status Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Submissions Trends (Filterable: Day, Month, Year) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Submissions Trends</h3>
              <p className="text-xs text-slate-500">Real-time breakdown of checklist forms submitted across plant lines</p>
            </div>
            
            {/* Filter Toggle Buttons */}
            <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-semibold border border-slate-200">
              {['Day', 'Month', 'Year'].map((period) => (
                <button
                  key={period}
                  onClick={() => setTrendFilter(period)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    trendFilter === period
                      ? 'bg-white text-[#00529B] shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData[trendFilter]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00529B" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00529B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                <YAxis stroke="#94A3B8" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0F172A', color: '#FFF', borderRadius: '8px', border: 'none' }}
                />
                <Area type="monotone" dataKey="submissions" stroke="#00529B" strokeWidth={3} fillOpacity={1} fill="url(#colorSub)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Record Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Record Status Distribution</h3>
            <p className="text-xs text-slate-500 mb-4">Proportions of Approved, Pending & Rejected forms</p>
            
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Breakdown Legend */}
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100">
            {statusDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                <span className="text-slate-600 font-medium">{item.name}:</span>
                <span className="font-bold text-slate-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Bottom Section: Last Three Recent Activity (Scrollable) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#00529B]" />
              <span>Recent Activity Feed</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Showing last 3 recent activity logs across all shifts</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Live Sync • Scrollable</span>
        </div>

        {/* Scrollable Recent Activity List */}
        <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
          {displayActivities.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No recent audit activity yet. Actions like login, submit, approve, and reject will appear here.
            </div>
          ) : displayActivities.map((act) => (
            <div key={act.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between hover:bg-slate-100/80 transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-sky-100 text-[#00529B] flex items-center justify-center font-bold text-xs">
                  {act.user.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {act.user} <span className="font-normal text-slate-600">• {act.action}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono">{act.target}</div>
                </div>
              </div>
              
              <div className="text-right">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${act.statusColor}`}>
                  {act.status}
                </span>
                <div className="text-[11px] text-slate-400 mt-1">{act.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
