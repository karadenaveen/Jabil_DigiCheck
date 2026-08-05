import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { ChecklistFillView } from './ChecklistFillView';
import { ClipboardList, Clock, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export function MyChecklistsPage({ currentUser }) {
  const [activeShift, setActiveShift] = useState(() => storageService.getActiveShift());
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    fetchData();
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

  // Check if a specific template & shift was already submitted or approved today
  const getSubmissionStatus = (templateId) => {
    if (!activeShift) return null;
    const today = new Date().toISOString().split('T')[0];
    return submissions.find(
      s => s.templateId === templateId && s.shift === activeShift && s.date === today
    );
  };

  if (selectedTemplate) {
    return (
      <ChecklistFillView
        currentUser={currentUser}
        template={selectedTemplate}
        activeShift={activeShift}
        onBack={() => {
          setSelectedTemplate(null);
          fetchData();
        }}
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

      {/* Checklist Cards Section (Matches Image 1) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((tmpl) => {
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

                {/* Status indicator if already filled for this shift */}
                {pastSub && (
                  <div className="mt-3 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 bg-slate-50 border border-slate-200">
                    <span className="text-slate-500">Status today:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      pastSub.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                      pastSub.status === 'Rejected' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {pastSub.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Fill Checklist Button matching Image 1 */}
              <button
                disabled={!activeShift}
                onClick={() => setSelectedTemplate(tmpl)}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm ${
                  activeShift
                    ? 'bg-[#00529B] hover:bg-blue-800 text-white shadow-blue-100 cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Fill Checklist</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
