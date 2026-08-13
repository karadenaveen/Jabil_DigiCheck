import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { SubmissionGridReview } from './SubmissionGridReview';
import { sortByLastActivityDesc, buildActivityTimeline } from '../../utils/submissionTimeline';
import { CircleCheck as CheckCircle, Circle as XCircle, Search, Calendar, ListFilter as Filter, Eye, FileText, Check, TriangleAlert as AlertTriangle, Clock, MessageSquare, Grid3x3, RotateCw } from 'lucide-react';

export function ApprovalsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);
  const [gridReviewOpen, setGridReviewOpen] = useState(false);

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

  // Rejection Modal State
  const [rejectingSub, setRejectingSub] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');

  const handleApprove = async (id) => {
    try {
      const updated = await storageService.updateSubmissionStatus(id, 'Approved');
      setSubmissions(sortByLastActivityDesc(updated));
      if (selectedSub?.id === id) {
        setSelectedSub(prev => ({ ...prev, status: 'Approved' }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve submission.');
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionRemark.trim()) {
      alert('Please enter a rejection remark for the operator.');
      return;
    }

    try {
      const updated = await storageService.updateSubmissionStatus(rejectingSub.id, 'Rejected', rejectionRemark);
      setSubmissions(sortByLastActivityDesc(updated));
      
      if (selectedSub?.id === rejectingSub.id) {
        setSelectedSub(prev => ({ ...prev, status: 'RejectedByAdmin', rejectionRemark }));
      }

      setRejectingSub(null);
      setRejectionRemark('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject submission.');
    }
  };

  const filtered = submissions.filter(sub => {
    const matchesSearch = 
      sub.templateTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.docNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !dateFilter || sub.date === dateFilter;
    return matchesSearch && matchesDate;
  });

  // Admin only ever acts on submissions a Shift Leader has already
  // reviewed. 'Pending' / 'RejectedByShiftLeader' belong to the Shift
  // Leader's own queue and aren't shown here.
  const adminQueue = filtered.filter(s => s.status !== 'Pending' && s.status !== 'RejectedByShiftLeader');

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-[#00529B]" />
            <span>Admin Approvals Queue — Final Sign-off</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Final review stage — these submissions were already reviewed and forwarded by a Shift Leader. Approving here is final; rejecting sends it back to the Shift Leader.
          </p>
        </div>
      </div>

      {/* Top Controls: Search Template, Date-Month-Year Picker, Side Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search template name, operator..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
          />
        </div>

        {/* Date Filter (Date-Month-Year) */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter('')}
              className="text-xs text-rose-600 font-bold hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Status Count Summary */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="px-3 py-1 bg-sky-100 text-sky-800 rounded-full">
            Awaiting Final Approval: {submissions.filter(s => s.status === 'PendingAdmin').length}
          </span>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full">
            Approved: {submissions.filter(s => s.status === 'Approved').length}
          </span>
        </div>

      </div>

      {/* Submissions List & Detailed Audit Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Submissions Table / Cards */}
        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Shift-Leader-Approved Checklists</h2>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {adminQueue.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 font-medium">
                Nothing here yet — submissions appear once a Shift Leader approves and forwards them.
              </div>
            ) : adminQueue.map((sub) => {
              const isSelected = selectedSub?.id === sub.id;
              return (
                <div
                  key={sub.id}
                  onClick={() => setSelectedSub(sub)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-sky-50/80 border-[#00529B] shadow-md ring-2 ring-sky-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm">{sub.templateTitle}</h3>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{sub.docNumber} • {sub.shift}</div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      sub.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                      sub.status === 'RejectedByAdmin' ? 'bg-orange-100 text-orange-700' :
                      sub.status === 'PendingAdmin' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sub.status === 'PendingAdmin' ? 'Awaiting You' : sub.status === 'RejectedByAdmin' ? 'Sent Back to Shift Leader' : sub.status}
                    </span>
                    {(sub.resubmissionCount || 0) > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                        <RotateCw className="w-3 h-3" />
                        Re-submit (×{sub.resubmissionCount})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div>
                      Operator: <span className="font-bold text-slate-700">{sub.operatorName}</span> (NTID: {sub.operatorNTID})
                    </div>
                    <div className="font-mono text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">Last Activity</div>
                      <div>{sub.reviewedAt || sub.shiftLeaderReviewedAt || sub.submittedAt}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Form Audit Inspection Pane */}
        <div className="lg:col-span-6">
          {selectedSub ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn sticky top-20">
              
              {/* Top Banner with Pending / Status Badge */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{selectedSub.templateTitle}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedSub.docNumber} • Rev {selectedSub.revision}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedSub.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' :
                  selectedSub.status === 'RejectedByAdmin' ? 'bg-orange-100 text-orange-700 border border-orange-300' :
                  'bg-sky-100 text-sky-700 border border-sky-300'
                }`}>
                  {selectedSub.status === 'PendingAdmin' ? 'Awaiting Your Approval' : selectedSub.status === 'RejectedByAdmin' ? 'Sent Back to Shift Leader' : selectedSub.status}
                </span>
              </div>

              {/* Submission Meta Info */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Submitted By</span>
                  <span className="font-bold text-slate-800">{selectedSub.operatorName} (NTID: {selectedSub.operatorNTID})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Shift</span>
                  <span className="font-bold text-slate-800">{selectedSub.shift}</span>
                </div>
              </div>

              {/* Live activity timeline — every stage's real date & time */}
              <div className="space-y-2">
                {buildActivityTimeline(selectedSub).map((step, idx, arr) => (
                  <div key={step.key} className="flex items-start gap-3 text-xs">
                    <div className="flex flex-col items-center pt-0.5">
                      <span className="w-2 h-2 rounded-full bg-[#00529B] shrink-0" />
                      {idx < arr.length - 1 && (
                        <span className="w-px h-6 bg-slate-200 mt-0.5" />
                      )}
                    </div>
                    <div className="pb-1">
                      <div className="font-bold text-slate-800">
                        {step.label}{step.who ? <span className="font-normal text-slate-500"> — {step.who}</span> : ''}
                      </div>
                      <div className="font-mono text-slate-400 text-[11px]">{step.at}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Rejection Remark if rejected */}
              {selectedSub.status === 'RejectedByAdmin' && selectedSub.rejectionRemark && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <MessageSquare className="w-4 h-4 text-rose-600" />
                    <span>Manager Rejection Remark:</span>
                  </div>
                  <p className="text-rose-700">{selectedSub.rejectionRemark}</p>
                </div>
              )}

              {/* Inspection Checks Grid */}
              {(() => {
                const matchedTemplate = templates.find(t => t.id === selectedSub.templateId);
                const hasExactGrid = matchedTemplate?.gridData && selectedSub.gridAnswers;
                const wasGridSubmission = !!selectedSub.gridAnswers;
                const templateMissingGridData = wasGridSubmission && !matchedTemplate?.gridData;

                if (hasExactGrid) {
                  return (
                    <div className="space-y-2">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Original Excel Checklist</h3>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">
                          This checklist was filled directly on the exact uploaded Excel sheet. Open it to see the real layout with the operator's answers, or download it as a real .xlsx file.
                        </p>
                        <button
                          onClick={() => setGridReviewOpen(true)}
                          className="shrink-0 flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-lg shadow-sm transition"
                        >
                          <Grid3x3 className="w-3.5 h-3.5" />
                          View Original Sheet
                        </button>
                      </div>
                    </div>
                  );
                }

                if (templateMissingGridData) {
                  return (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-bold">Original sheet can't be shown</p>
                        <p className="mt-0.5">
                          This checklist was filled on the exact Excel grid, but the template ("{selectedSub.templateTitle}") no longer has its saved grid data —
                          it may have been uploaded before this feature existed, or the save failed. Re-upload the template to fix this for future submissions.
                        </p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Form Audit Verification</h3>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                      <div className="flex items-center justify-between text-slate-600 font-semibold border-b border-slate-200 pb-2">
                        <span>Check Item</span>
                        <span>Operator Check & Proof Photo</span>
                      </div>
                      
                      {Object.keys(selectedSub.checks || {}).length > 0 ? (
                        Object.entries(selectedSub.checks).map(([rowNo, stations]) => {
                          const stationValues = Object.values(stations || {});
                          const hasFail = stationValues.some((v) => v === 'X' || v === 'x');
                          return (
                            <div key={rowNo} className="flex items-center justify-between py-1.5 border-b border-slate-200/60 text-slate-700">
                              <span>Item #{rowNo} Inspection</span>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 font-bold rounded text-[10px] ${
                                  hasFail
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {hasFail ? 'X (Failed)' : 'V (Passed)'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  {[1, 2, 3, 4].map((s) => stations?.[s] || '-').join(' / ')}
                                </span>
                                {selectedSub.proofPhotos?.[rowNo] && (
                                  <img
                                    src={selectedSub.proofPhotos[rowNo]}
                                    alt="Proof"
                                    className="w-7 h-7 rounded border border-slate-300 object-cover"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-2 text-slate-500">No checklist answers recorded for this submission.</div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons: locked once a decision (Approved/Rejected) has
                  been recorded — only a fresh resubmission (new Pending entry)
                  re-opens Approve/Reject for that record. */}
              {selectedSub.status === 'PendingAdmin' ? (
                <div className="flex gap-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setRejectingSub(selectedSub)}
                    className="flex-1 py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject Submission</span>
                  </button>

                  <button
                    onClick={() => handleApprove(selectedSub.id)}
                    className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Approve Submission</span>
                  </button>
                </div>
              ) : (
                <div className={`pt-4 border-t border-slate-200`}>
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    selectedSub.status === 'Approved'
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-rose-50 border-rose-200'
                  }`}>
                    {selectedSub.status === 'Approved' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div className={`text-xs ${selectedSub.status === 'Approved' ? 'text-emerald-800' : 'text-rose-800'}`}>
                      <p className="font-bold">
                        Decision Locked — {selectedSub.status}
                      </p>
                      <p className="mt-0.5 opacity-90">
                        {selectedSub.status === 'Approved'
                          ? 'This submission has already been approved and can\'t be approved or rejected again.'
                          : 'This submission was rejected and can\'t be actioned again. If the operator or shift leader edits and resubmits it, the new copy will appear here as Pending for review.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400 text-xs">
              Select a submitted form from the left pane to audit details, inspect proof photos, and approve or reject.
            </div>
          )}
        </div>

      </div>

      {/* Rejection Remark Modal */}
      {rejectingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            
            <div className="flex items-center gap-2 text-rose-700 font-bold text-base">
              <XCircle className="w-6 h-6" />
              <span>Confirm Rejection & Add Remark</span>
            </div>

            <p className="text-xs text-slate-600">
              Please enter the specific rejection reason or corrective action required for operator <span className="font-bold text-slate-800">{rejectingSub.operatorName}</span>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Manager Rejection Remark</label>
              <textarea
                rows={4}
                value={rejectionRemark}
                onChange={(e) => setRejectionRemark(e.target.value)}
                placeholder="e.g. Missing proof photo for Item 2. Please re-upload clear photo and resubmit."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingSub(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow"
              >
                Confirm Rejection
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Original Excel Sheet Review (exact grid + real answers) */}
      {selectedSub && (
        <SubmissionGridReview
          isOpen={gridReviewOpen}
          onClose={() => setGridReviewOpen(false)}
          workbook={templates.find(t => t.id === selectedSub.templateId)?.gridData}
          answers={selectedSub.gridAnswers}
          title={selectedSub.templateTitle}
          docNumber={selectedSub.docNumber}
          filledExcelPath={selectedSub.filledExcelPath}
        />
      )}

    </div>
  );
}
