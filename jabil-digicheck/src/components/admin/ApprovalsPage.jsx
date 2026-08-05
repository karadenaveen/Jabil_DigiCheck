import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { 
  CheckCircle, XCircle, Search, Calendar, Filter, 
  Eye, FileText, Check, AlertTriangle, Clock, MessageSquare 
} from 'lucide-react';

export function ApprovalsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    const data = await storageService.getSubmissions();
    setSubmissions(data);
  };

  // Rejection Modal State
  const [rejectingSub, setRejectingSub] = useState(null);
  const [rejectionRemark, setRejectionRemark] = useState('');

  const handleApprove = async (id) => {
    try {
      const updated = await storageService.updateSubmissionStatus(id, 'Approved');
      setSubmissions(updated);
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
      setSubmissions(updated);
      
      if (selectedSub?.id === rejectingSub.id) {
        setSelectedSub(prev => ({ ...prev, status: 'Rejected', rejectionRemark }));
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

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-[#00529B]" />
            <span>Approvals Queue</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit, verify proof photos, approve or reject operator checklist submissions.
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
          <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full">
            Pending: {submissions.filter(s => s.status === 'Pending').length}
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
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Submitted Checklists</h2>
          
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((sub) => {
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
                      sub.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {sub.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <div>
                      Operator: <span className="font-bold text-slate-700">{sub.operatorName}</span> (NTID: {sub.operatorNTID})
                    </div>
                    <div className="font-mono">{sub.submittedAt}</div>
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
                  selectedSub.status === 'Rejected' ? 'bg-rose-100 text-rose-700 border border-rose-300' :
                  'bg-amber-100 text-amber-700 border border-amber-300'
                }`}>
                  {selectedSub.status}
                </span>
              </div>

              {/* Submission Meta Info */}
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

              {/* Rejection Remark if rejected */}
              {selectedSub.status === 'Rejected' && selectedSub.rejectionRemark && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-900">
                    <MessageSquare className="w-4 h-4 text-rose-600" />
                    <span>Manager Rejection Remark:</span>
                  </div>
                  <p className="text-rose-700">{selectedSub.rejectionRemark}</p>
                </div>
              )}

              {/* Inspection Checks Grid */}
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

              {/* Action Buttons: Reject vs Approve */}
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

    </div>
  );
}
