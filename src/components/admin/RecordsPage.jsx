import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { SubmissionGridReview } from './SubmissionGridReview';
import { sortByLastActivityDesc, buildActivityTimeline } from '../../utils/submissionTimeline';
import { Database, Search, Download, Printer, ListFilter as Filter, FileText, CircleCheck as CheckCircle, Circle as XCircle, Grid3x3, TriangleAlert as AlertTriangle, RotateCw } from 'lucide-react';

export function RecordsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('All'); // All, Approved, Rejected, Pending

  // Original filled Excel sheet viewer (same as Approvals page)
  const [reviewSub, setReviewSub] = useState(null);
  const [gridReviewOpen, setGridReviewOpen] = useState(false);
  const [noGridNotice, setNoGridNotice] = useState(null);

  useEffect(() => {
    fetchSubmissions();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const data = await storageService.getTemplates();
    setTemplates(data);
  };

  const fetchSubmissions = async () => {
    const data = await storageService.getSubmissions();
    // LIFO — whichever submission was most recently submitted, forwarded,
    // or decided on (by anyone, at any stage) shows first.
    setSubmissions(sortByLastActivityDesc(data));
  };

  // Opens the exact original Excel sheet with the operator's filled-in
  // answers overlaid, same view used on the Approvals page. Falls back to
  // a short explanation if the template no longer has its saved grid data.
  const handleViewOriginalSheet = (sub) => {
    const matchedTemplate = templates.find(t => t.id === sub.templateId);
    const hasExactGrid = matchedTemplate?.gridData && sub.gridAnswers;

    if (!hasExactGrid) {
      setNoGridNotice(sub);
      setTimeout(() => setNoGridNotice(null), 4000);
      return;
    }

    setReviewSub(sub);
    setGridReviewOpen(true);
  };

  // 'Pending' tab covers both approval stages; 'Rejected' tab covers a
  // rejection from either the Shift Leader or Admin stage (plus legacy data).
  const matchesStatusTab = (status, tab) => {
    if (tab === 'All') return true;
    if (tab === 'Pending') return status === 'Pending' || status === 'PendingAdmin';
    if (tab === 'Rejected') return ['Rejected', 'RejectedByShiftLeader', 'RejectedByAdmin'].includes(status);
    return status === tab;
  };

  const statusLabel = (status) => ({
    Pending: 'Pending (Shift Leader)',
    PendingAdmin: 'Pending (Admin)',
    Approved: 'Approved',
    RejectedByShiftLeader: 'Rejected (Shift Leader)',
    RejectedByAdmin: 'Rejected (Admin)',
    Rejected: 'Rejected'
  }[status] || status);

  const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  const filtered = submissions.filter(sub => {
    const matchesSearch = 
      sub.templateTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.docNumber.toLowerCase().includes(searchQuery.toLowerCase());

    const isResubmission = (sub.resubmissionCount || 0) > 0;
    // Normal (first-time) submissions only show for the current day.
    // Re-submit / rework items stay visible across all days so they don't
    // fall off the radar while waiting for action.
    const matchesDay = isResubmission || (sub.date === todayStr);

    return matchesSearch && matchesStatusTab(sub.status, activeTab) && matchesDay;
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
                <th className="px-4 py-3">Activity Timeline (Live Date & Time)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Remarks / Feedback</th>
                <th className="px-4 py-3">Original Sheet</th>
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
                  <td className="px-4 py-3 text-slate-500 font-mono min-w-[200px]">
                    <div className="space-y-1">
                      {buildActivityTimeline(r).map((step) => (
                        <div key={step.key} className="flex items-baseline gap-1.5 text-[10.5px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00529B] shrink-0" />
                          <span className="text-slate-600 font-semibold not-italic font-sans">{step.label}:</span>
                          <span>{step.at}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      r.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                      r.status === 'PendingAdmin' ? 'bg-sky-100 text-sky-800 border border-sky-300' :
                      r.status === 'RejectedByAdmin' ? 'bg-orange-100 text-orange-800 border border-orange-300' :
                      (r.status === 'Rejected' || r.status === 'RejectedByShiftLeader') ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                      'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {statusLabel(r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {(r.resubmissionCount || 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                        <RotateCw className="w-3 h-3" />
                        Re-submit (×{r.resubmissionCount})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        Normal
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 italic">
                    {r.rejectionRemark ? (
                      <span className="text-rose-700 font-medium">Rejection Remark: {r.rejectionRemark}</span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleViewOriginalSheet(r)}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg shadow-sm transition whitespace-nowrap"
                    >
                      <Grid3x3 className="w-3.5 h-3.5" />
                      View Original Sheet
                    </button>
                    {noGridNotice?.id === r.id && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-amber-700 max-w-[220px]">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Original sheet unavailable — template's saved grid data is missing.</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Original Excel Sheet Review (exact grid + real filled-in answers) */}
      {reviewSub && (
        <SubmissionGridReview
          isOpen={gridReviewOpen}
          onClose={() => setGridReviewOpen(false)}
          workbook={templates.find(t => t.id === reviewSub.templateId)?.gridData}
          answers={reviewSub.gridAnswers}
          title={reviewSub.templateTitle}
          docNumber={reviewSub.docNumber}
          filledExcelPath={reviewSub.filledExcelPath}
        />
      )}

    </div>
  );
}
