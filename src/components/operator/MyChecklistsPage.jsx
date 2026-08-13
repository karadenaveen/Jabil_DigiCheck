import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storageService } from '../../services/storageService';
import { ChecklistFillView } from './ChecklistFillView';
import { ClipboardList, Clock, ArrowRight, ShieldCheck, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, Search, FileSpreadsheet, X } from 'lucide-react';

export function MyChecklistsPage({ currentUser }) {
  const [activeShift, setActiveShift] = useState(() => storageService.getActiveShift());
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [editSubmission, setEditSubmission] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  // Top search bar — type an application's name or its Doc Number to find
  // and jump straight into filling it, without scrolling the whole list.
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [shiftHint, setShiftHint] = useState(false);
  const [alreadyFilledHint, setAlreadyFilledHint] = useState(false);
  const searchBoxRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  // Close the results dropdown when clicking anywhere outside the search box
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    const tmpls = await storageService.getTemplates();
    const subs = await storageService.getSubmissions();
    setTemplates(tmpls);
    setSubmissions(subs);
  };

  const handleShiftSelect = (shiftName) => {
    setActiveShift(shiftName);
    storageService.setActiveShift(shiftName);
  };

  // Check if THIS operator already submitted this template for the active
  // shift today. Scoped to currentUser's NTID so it's an individual lock —
  // other operators on the same shift can still fill it themselves.
  const getSubmissionStatus = (templateId) => {
    if (!activeShift) return null;
    const today = new Date().toISOString().split('T')[0];
    return submissions.find(
      s => s.templateId === templateId
        && s.shift === activeShift
        && s.date === today
        && s.operatorNTID === currentUser?.ntid
    );
  };

  // Matches on either the application's name (title/shortTitle) or its
  // exact Doc Number — whichever the operator types.
  const matchesSearch = (tmpl, query) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      (tmpl.title || '').toLowerCase().includes(q) ||
      (tmpl.shortTitle || '').toLowerCase().includes(q) ||
      (tmpl.docNumber || '').toLowerCase().includes(q)
    );
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return templates.filter((t) => matchesSearch(t, searchQuery)).slice(0, 8);
  }, [templates, searchQuery]);

  const visibleTemplates = useMemo(
    () => templates.filter((t) => matchesSearch(t, searchQuery)),
    [templates, searchQuery]
  );

  // A submission only stays editable/resubmittable by the OPERATOR when the
  // Shift Leader rejected it. Admin-stage statuses ('PendingAdmin',
  // 'RejectedByAdmin') belong to the Shift Leader's queue, not the operator.
  const isResubmittable = (status) => status === 'Rejected' || status === 'RejectedByShiftLeader';

  const statusLabel = (status) => ({
    Pending: 'Pending (Shift Leader)',
    PendingAdmin: 'Pending (Admin)',
    Approved: 'Approved',
    RejectedByShiftLeader: 'Rejected',
    RejectedByAdmin: 'Rejected (Admin)',
    Rejected: 'Rejected'
  }[status] || status);

  // Selecting an application — either from the search dropdown or a card —
  // goes straight into filling it, as long as a shift is active. If it's
  // already been filled for this shift/day it's locked UNLESS that past
  // submission was Rejected — a rejected one can be edited and resubmitted,
  // which creates a fresh Pending entry for the admin to review again.
  const openTemplate = (tmpl) => {
    if (!activeShift) {
      setShiftHint(true);
      setTimeout(() => setShiftHint(false), 2500);
      return;
    }
    const pastSub = getSubmissionStatus(tmpl.id);
    if (pastSub && !isResubmittable(pastSub.status)) {
      setAlreadyFilledHint(true);
      setTimeout(() => setAlreadyFilledHint(false), 2500);
      return;
    }
    setIsSearchOpen(false);
    setEditSubmission(pastSub && isResubmittable(pastSub.status) ? pastSub : null);
    setSelectedTemplate(tmpl);
  };

  if (selectedTemplate) {
    return (
      <ChecklistFillView
        currentUser={currentUser}
        template={selectedTemplate}
        activeShift={activeShift}
        onBack={() => {
          setSelectedTemplate(null);
          setEditSubmission(null);
          fetchData();
        }}
        mode={editSubmission ? 'edit' : 'create'}
        existingSubmission={editSubmission}
      />
    );
  }

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      
      {/* Title & Subtitle matching Image 1 */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-[#00529B]" />
          <span>My Checklists</span>
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Select your shift and fill out assigned checklist templates.
        </p>
      </div>

      {/* Top Search Bar — find an application by name or Doc Number */}
      <div ref={searchBoxRef} className="relative">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            placeholder="Search application by name or Doc Number..."
            className="w-full pl-11 pr-10 py-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-sky-100 focus:border-[#00529B] transition"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Shift-required hint, shown when picking a result before a shift is active */}
        {shiftHint && (
          <div className="absolute -bottom-8 left-0 flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5" />
            <span>Select a shift below first to unlock filling.</span>
          </div>
        )}

        {/* Already-filled hint, shown when picking a result already submitted today for this shift */}
        {alreadyFilledHint && (
          <div className="absolute -bottom-8 left-0 flex items-center gap-1.5 text-slate-600 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>You already filled this for {activeShift} today — see its status below.</span>
          </div>
        )}

        {/* Live results dropdown */}
        {isSearchOpen && searchQuery.trim() && (
          <div className="absolute z-30 mt-2 w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden max-h-96 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400 font-medium">
                No application found for "{searchQuery}".
              </div>
            ) : (
              searchResults.map((tmpl) => {
                const pastSub = getSubmissionStatus(tmpl.id);
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => openTemplate(tmpl)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sky-50 transition text-left border-b border-slate-100 last:border-b-0"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-4 h-4 text-[#00529B]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {tmpl.shortTitle || tmpl.title}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {tmpl.docNumber} • Rev {tmpl.revision}
                      </div>
                    </div>
                    {pastSub && !isResubmittable(pastSub.status) ? (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                        pastSub.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {statusLabel(pastSub.status)}
                      </span>
                    ) : pastSub && isResubmittable(pastSub.status) ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 bg-rose-100 text-rose-700">
                        Resubmit <ArrowRight className="w-3 h-3" />
                      </span>
                    ) : (
                      <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ACTIVE SHIFT Container (Matches Image 1) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          ACTIVE SHIFT
        </div>

        {/* Shift Selection Buttons */}
        <div className="flex flex-wrap gap-3">
          {['Shift A', 'Shift B', 'Shift C', 'Shift Day'].map((shift) => {
            const isSelected = activeShift === shift;
            return (
              <button
                key={shift}
                onClick={() => handleShiftSelect(shift)}
                className={`px-6 py-2.5 rounded-full text-xs font-bold transition-all shadow-sm ${
                  isSelected
                    ? 'bg-[#00529B] text-white ring-4 ring-sky-100 shadow-md scale-105'
                    : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                }`}
              >
                {shift}
              </button>
            );
          })}
        </div>

        {/* Warning / Lock Notice matching Image 1 */}
        {!activeShift ? (
          <div className="flex items-center gap-2 text-amber-700 text-xs font-medium pt-1">
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>Select a shift to unlock checklist access.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold pt-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Unlocked access for <span className="font-bold">{activeShift}</span>. Ready to fill checklists.</span>
          </div>
        )}
      </div>

      {/* Checklist Cards Section (Matches Image 1) — reflects the search filter above */}
      {searchQuery.trim() && visibleTemplates.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center">
          <FileSpreadsheet className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No applications match "{searchQuery}".</p>
          <p className="text-xs text-slate-400 mt-1">Try the exact Doc Number or part of the application name.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visibleTemplates.map((tmpl) => {
          const pastSub = getSubmissionStatus(tmpl.id);
          return (
            <div
              key={tmpl.id}
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div>
                {/* Title & Badge */}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-extrabold text-slate-900 text-sm leading-snug">
                    {tmpl.shortTitle || tmpl.title}
                  </h3>
                  <span className="px-2 py-0.5 bg-sky-50 text-[#00529B] rounded text-[10px] font-mono font-bold shrink-0">
                    ⚙ 1
                  </span>
                </div>

                {/* Doc Number & Rev */}
                <div className="text-[11px] font-mono text-slate-400 mt-2">
                  {tmpl.docNumber} (Rev {tmpl.revision})
                </div>
              </div>

              {/* Fill Checklist Button — locked to a status pill once already
                  filled for this shift/day, EXCEPT a Shift-Leader-rejected
                  submission, which stays actionable so it can be edited and
                  resubmitted. 'PendingAdmin' means Shift Leader already
                  forwarded it — that stays locked too, it's now Admin's turn. */}
              {pastSub && !isResubmittable(pastSub.status) ? (
                <div className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border ${
                  pastSub.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>You Already Submitted — {statusLabel(pastSub.status)}</span>
                </div>
              ) : pastSub && isResubmittable(pastSub.status) ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-rose-600 font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Rejected{pastSub.rejectionRemark ? `: ${pastSub.rejectionRemark}` : ''}</span>
                  </div>
                  <button
                    onClick={() => openTemplate(tmpl)}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100 cursor-pointer"
                  >
                    <span>Edit &amp; Resubmit</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  disabled={!activeShift}
                  onClick={() => openTemplate(tmpl)}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm ${
                    activeShift
                      ? 'bg-[#00529B] hover:bg-blue-800 text-white shadow-blue-100 cursor-pointer'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <span>Fill Checklist</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}

    </div>
  );
}
