import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { SubmissionGridReview } from '../admin/SubmissionGridReview';
import { ChecklistFillView } from '../operator/ChecklistFillView';
import { sortByLastActivityDesc, buildActivityTimeline } from '../../utils/submissionTimeline';
import { CircleCheck as CheckCircle, Circle as XCircle, Search, Calendar, Eye, FileText, TriangleAlert as AlertTriangle, Clock, MessageSquare, Grid3x3, Send, Pencil, RotateCcw, ShieldCheck, RotateCw } from 'lucide-react';

// Shift Leader is stage 1 of the two-stage approval workflow:
//   Operator submits ('Pending') -> Shift Leader reviews
//     -> Approve  -> 'PendingAdmin' (forwarded to Admin for final sign-off)
//     -> Reject   -> 'RejectedByShiftLeader' (bounces back to the Operator)
//   If Admin later rejects a Shift-Leader-approved submission, it comes
//   back here as 'RejectedByAdmin' for this Shift Leader to edit & resend.
export function ShiftLeaderApprovalsPage({ currentUser }) {
  const [submissions, setSubmissions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [queueTab, setQueueTab] = useState('awaiting'); // awaiting | bounced | decided
  const [selectedSub, setSelectedSub] = useState(null);
  const [gridReviewOpen, setGridReviewOpen] = useState(false);

  // Rejection Modal State
  const [rejectingSub, setRejectingSub] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');

  // Full-form edit mode — same fill form the Operator uses, pre-filled with
  // the existing (Admin-rejected) answers, submit both saves edits AND
  // resubmits to Admin in one action.
  const [editingSub, setEditingSub] = useState(null);

  const [resubmitting, setResubmitting] = useState(false);

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

  const handleApprove = async (id) => {
    try {
      const updated = await storageService.updateSubmissionStatus(id, 'Approved');
      setSubmissions(sortByLastActivityDesc(updated));
      if (selectedSub?.id === id) {
        setSelectedSub(prev => ({ ...prev, status: 'PendingAdmin' }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to forward submission to Admin.');
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
        setSelectedSub(prev => ({ ...prev, status: 'RejectedByShiftLeader', rejectionRemark }));
      }

      setRejectingSub(null);
      setRejectionRemark('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject submission.');
    }
  };

  // Resubmit-as-is (no edits) — used for grid/Excel-based submissions, which
  // don't support the full inline edit form yet (see note in the UI below).
  const handleResubmitToAdmin = async () => {
    if (!selectedSub) return;
    setResubmitting(true);
    try {
      const updated = await storageService.resubmitSubmissionToAdmin(selectedSub.id);
      setSubmissions(sortByLastActivityDesc(updated));
      setSelectedSub(prev => ({ ...prev, status: 'PendingAdmin', rejectionRemark: '' }));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resubmit submission to Admin.');
    } finally {
      setResubmitting(false);
    }
  };

  const isRejectedByAdmin = selectedSub?.status === 'RejectedByAdmin';
  const isGridSubmission = !!selectedSub?.gridAnswers;

  // Queue buckets
  const awaitingReview = submissions.filter(s => s.status === 'Pending');
  const bouncedFromAdmin = submissions.filter(s => s.status === 'RejectedByAdmin');
  const myPastDecisions = submissions.filter(s => ['PendingAdmin', 'RejectedByShiftLeader', 'Approved'].includes(s.status));

  const queueSource = queueTab === 'awaiting' ? awaitingReview : queueTab === 'bounced' ? bouncedFromAdmin : myPastDecisions;

  const filtered = queueSource.filter(sub => {
    const matchesSearch =
      sub.templateTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.operatorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.docNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = !dateFilter || sub.date === dateFilter;
    return matchesSearch && matchesDate;
  });

  const statusLabel = (status) => ({
    Pending: 'Awaiting Your Review',
    PendingAdmin: 'Forwarded to Admin',
    Approved: 'Final — Approved',
    RejectedByShiftLeader: 'You Rejected — Sent to Operator',
    RejectedByAdmin: 'Bounced Back by Admin',
    Rejected: 'Rejected'
  }[status] || status);

  const statusColor = (status) => {
    if (status === 'Approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'PendingAdmin') return 'bg-sky-100 text-sky-700';
    if (status === 'RejectedByAdmin') return 'bg-orange-100 text-orange-700';
    if (status === 'RejectedByShiftLeader' || status === 'Rejected') return 'bg-rose-100 text-rose-700';
    return 'bg-amber-100 text-amber-700';
  };

  // Full-screen edit form takeover — same fill form the Operator uses,
  // pre-filled with the existing (Admin-rejected) answers.
  if (editingSub) {
    const matchedTemplate = templates.find(t => t.id === editingSub.templateId);

    // Guard against a blank/crashed screen: if the template can't be found
    // (deleted, renamed, or template list still loading), don't render the
    // fill form with an undefined template — bail back to the queue instead.
    if (!matchedTemplate || !matchedTemplate.sheets) {
      return (
        <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Can't Open Edit Form</h2>
          <p className="text-xs text-slate-500">
            The original template for this submission couldn't be found — it may have been deleted or renamed. You can still resubmit it as-is from the review pane.
          </p>
          <button
            onClick={() => setEditingSub(null)}
            className="px-5 py-2.5 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition"
          >
            Back to Review Queue
          </button>
        </div>
      );
    }

    return (
      <ChecklistFillView
        currentUser={currentUser}
        template={matchedTemplate}
        activeShift={editingSub.shift}
        mode="edit"
        existingSubmission={editingSub}
        onBack={() => setEditingSub(null)}
        onResubmitted={() => {
          fetchSubmissions();
          setEditingSub(null);
          setSelectedSub(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12">

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#00529B]" />
            <span>Shift Leader Review Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review operator submissions, edit if needed, and forward to Admin for final approval.
          </p>
        </div>
      </div>

      {/* Queue Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'awaiting', label: 'Awaiting Your Review', count: awaitingReview.length },
          { id: 'bounced', label: 'Bounced Back by Admin', count: bouncedFromAdmin.length },
          { id: 'decided', label: 'Your Past Decisions', count: myPastDecisions.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setQueueTab(tab.id); setSelectedSub(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              queueTab === tab.id
                ? 'bg-[#00529B] text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${queueTab === tab.id ? 'bg-white/20' : 'bg-slate-100'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Top Controls: Search + Date Filter */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
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

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
          />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="text-xs text-rose-600 font-bold hover:underline">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Submissions List & Detail Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        <div className="lg:col-span-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            {queueTab === 'awaiting' ? 'Submitted Checklists' : queueTab === 'bounced' ? 'Needs Your Edit & Resubmit' : 'Already Actioned By You'}
          </h2>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400 font-medium">Nothing here right now.</div>
            ) : filtered.map((sub) => {
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
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor(sub.status)}`}>
                      {statusLabel(sub.status)}
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
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        {sub.status === 'RejectedByAdmin' || sub.status === 'PendingAdmin' ? 'Last Activity' : 'Submitted'}
                      </div>
                      <div>{sub.shiftLeaderReviewedAt || sub.submittedAt}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail / Audit Pane */}
        <div className="lg:col-span-6">
          {selectedSub ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 animate-fadeIn sticky top-20">

              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">{selectedSub.templateTitle}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedSub.docNumber} • Rev {selectedSub.revision}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColor(selectedSub.status)}`}>
                  {statusLabel(selectedSub.status)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Submitted By</span>
                  <span className="font-bold text-slate-800">{selectedSub.operatorName} (NTID: {selectedSub.operatorNTID})</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase block text-[10px]">Shift & Timestamp</span>
                  <span className="font-bold text-slate-800">{selectedSub.shift} • {selectedSub.submittedAt}</span>
                </div>
              </div>

              {/* Live activity timeline — every stage's real date & time */}
              <div className="space-y-2">
                {buildActivityTimeline(selectedSub).map((step, idx) => (
                  <div key={step.key} className="flex items-start gap-3 text-xs">
                    <div className="flex flex-col items-center pt-0.5">
                      <span className="w-2 h-2 rounded-full bg-[#00529B] shrink-0" />
                      {idx < buildActivityTimeline(selectedSub).length - 1 && (
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

              {/* Admin's rejection remark, when bounced back */}
              {selectedSub.status === 'RejectedByAdmin' && selectedSub.rejectionRemark && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-orange-900">
                    <MessageSquare className="w-4 h-4 text-orange-600" />
                    <span>Admin's Rejection Remark:</span>
                  </div>
                  <p className="text-orange-700">{selectedSub.rejectionRemark}</p>
                  <p className="text-orange-600 pt-1">Edit the checklist below if needed, then resubmit to Admin.</p>
                </div>
              )}

              {/* Original Excel sheet / Legacy checklist audit view */}
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
                      {['Pending', 'RejectedByAdmin'].includes(selectedSub.status) && (
                        <p className="text-[11px] text-slate-400 italic">
                          Cell-level editing of the original Excel sheet isn't available yet — you can still Approve, Reject, or Resubmit this submission as-is.
                        </p>
                      )}
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
                          This checklist was filled on the exact Excel grid, but the template no longer has its saved grid data.
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
                                  hasFail ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {hasFail ? 'X (Failed)' : 'V (Passed)'}
                                </span>
                                <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
                                  {[1, 2, 3, 4].map((s) => (
                                    <span key={s}>{stations?.[s] || '-'}{s < 4 ? ' / ' : ''}</span>
                                  ))}
                                </div>
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

                    {/* Bounced back by Admin: full edit form, same as Operator uses */}
                    {isRejectedByAdmin && (
                      <button
                        onClick={() => setEditingSub(selectedSub)}
                        className="w-full py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                      >
                        <Pencil className="w-4 h-4" />
                        <span>Edit Checklist & Resubmit to Admin</span>
                      </button>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons — depend on which stage this submission is at */}
              {selectedSub.status === 'Pending' ? (
                <div className="flex gap-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => setRejectingSub(selectedSub)}
                    className="flex-1 py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject to Operator</span>
                  </button>

                  <button
                    onClick={() => handleApprove(selectedSub.id)}
                    className="flex-1 py-3 px-4 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Approve & Forward to Admin</span>
                  </button>
                </div>
              ) : selectedSub.status === 'RejectedByAdmin' ? (
                isGridSubmission ? (
                  <div className="pt-4 border-t border-slate-200 space-y-2">
                    <p className="text-[11px] text-slate-400 italic">
                      Cell-level editing of the original Excel sheet isn't available yet — you can resubmit this as-is.
                    </p>
                    <button
                      onClick={handleResubmitToAdmin}
                      disabled={resubmitting}
                      className="w-full py-3 px-4 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{resubmitting ? 'Resubmitting...' : 'Resubmit to Admin (As-Is)'}</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 italic pt-2">
                    Use "Edit Checklist & Resubmit to Admin" above to make corrections and resend.
                  </p>
                )
              ) : (
                <div className="pt-4 border-t border-slate-200">
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-600">
                      <p className="font-bold text-slate-700">{statusLabel(selectedSub.status)}</p>
                      <p className="mt-0.5 opacity-90">
                        {selectedSub.status === 'PendingAdmin' && 'You already forwarded this to Admin — waiting on their final decision.'}
                        {selectedSub.status === 'RejectedByShiftLeader' && 'You already rejected this — the operator has been notified to edit and resubmit.'}
                        {selectedSub.status === 'Approved' && 'This submission completed the full review and was approved by Admin.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400 text-xs">
              Select a submitted form from the left pane to audit details, inspect proof photos, and approve, reject, or resubmit.
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
              This will send the checklist back to <span className="font-bold text-slate-800">{rejectingSub.operatorName}</span> to edit and resubmit.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Shift Leader Rejection Remark</label>
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

      {/* Original Excel Sheet Review */}
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
