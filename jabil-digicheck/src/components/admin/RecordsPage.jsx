import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { Database, Search, Download, Printer, Filter, FileText, CheckCircle, XCircle } from 'lucide-react';

export function RecordsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All'); // All, Approved, Rejected, Pending

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    const data = await storageService.getSubmissions();
    setSubmissions(data);
  };

  const filtered = submissions.filter(sub => {
    const matchesSearch = 
      sub.templateTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.docNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'All') return matchesSearch;
    return matchesSearch && sub.status === activeTab;
  });

  const exportExcel = () => {
    storageService.exportExcel(activeTab, searchQuery);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-[#00529B]" />
            <span>Master Checklist Records Archive</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository for all submitted, approved, rejected, and drafted checklists.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export to Excel</span>
          </button>
          
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 transition flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>Print Records</span>
          </button>
        </div>
      </div>

      {/* Main Records Container */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        
        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search records by title, operator, doc #..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold border border-slate-200">
            {['All', 'Approved', 'Rejected', 'Pending'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-white text-[#00529B] shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

        </div>

        {/* Master Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-4 py-3">Record ID</th>
                <th className="px-4 py-3">Template Title</th>
                <th className="px-4 py-3">Doc Number</th>
                <th className="px-4 py-3">Shift</th>
                <th className="px-4 py-3">Operator (NTID)</th>
                <th className="px-4 py-3">Submission Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Remarks / Feedback</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-mono font-bold text-slate-800">{r.id}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{r.templateTitle}</td>
                  <td className="px-4 py-3 font-mono text-slate-600">{r.docNumber}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded font-semibold text-slate-700">
                      {r.shift}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.operatorName} <span className="text-slate-400 font-mono">({r.operatorNTID})</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono">{r.submittedAt}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      r.status === 'Rejected' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 italic">
                    {r.rejectionRemark ? (
                      <span className="text-rose-700 font-medium">Rejection Remark: {r.rejectionRemark}</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
}
