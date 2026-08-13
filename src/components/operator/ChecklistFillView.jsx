import React, { useState } from 'react';
import { storageService } from '../../services/storageService';
import { CoverPageModal } from '../shared/CoverPageModal';
import { ExcelSheetFillView } from './ExcelSheetFillView';
import { 
  ArrowLeft, FileText, Camera, Check, X as IconX, Slash, 
  Send, Save, AlertCircle, CheckCircle2, Eye, ShieldCheck,
  Sparkles, Info
} from 'lucide-react';

export function ChecklistFillView({ currentUser, template, activeShift, onBack, mode = 'create', existingSubmission = null, onResubmitted = null }) {
  // Defensive guard: never let a missing/malformed template crash to a
  // blank white screen — show a recoverable error instead.
  if (!template) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Template Not Found</h2>
        <p className="text-xs text-slate-500">
          The checklist template for this form couldn't be loaded. Please go back and try again.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  // If this template was uploaded with full-fidelity grid data, fill it in
  // directly on the exact Excel layout instead of the normalized checklist
  // UI below. Older templates (no gridData) fall back to the original flow
  // unchanged. Editing an existing submission is currently only supported
  // for the legacy (non-grid) checklist layout.
  if (template.gridData && mode === 'create') {
    return (
      <ExcelSheetFillView
        currentUser={currentUser}
        template={template}
        activeShift={activeShift}
        onBack={onBack}
      />
    );
  }

  if (!Array.isArray(template.sheets) || template.sheets.length === 0) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">This Template Can't Be Edited Here</h2>
        <p className="text-xs text-slate-500">
          "{template.title || 'This template'}" doesn't have an editable checklist layout available.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <ChecklistFillViewLegacy
      currentUser={currentUser}
      template={template}
      activeShift={activeShift}
      onBack={onBack}
      mode={mode}
      existingSubmission={existingSubmission}
      onResubmitted={onResubmitted}
    />
  );
}

function ChecklistFillViewLegacy({ currentUser, template, activeShift, onBack, mode = 'create', existingSubmission = null, onResubmitted = null }) {
  const isEditMode = mode === 'edit' && !!existingSubmission;
  // Operator resubmits to Shift Leader; Shift Leader resubmits to Admin.
  const isOperatorResubmit = isEditMode && existingSubmission?.status === 'RejectedByShiftLeader';

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Rows and Station Check State
  const activeSheet = template.sheets[activeSheetIndex] || template.sheets[0];
  
  // State for user checks per row: { [rowId]: { 1: 'V', 2: 'X', 3: 'V', 4: 'V' } }
  // In edit mode, pre-fill from the existing (Admin-rejected) submission
  // instead of blank defaults, so the Shift Leader edits the real answers.
  const [checks, setChecks] = useState(() => {
    const initial = {};
    activeSheet.rows.forEach(r => {
      initial[r.id] = (isEditMode && existingSubmission.checks?.[r.id]) || { 1: 'V', 2: 'V', 3: 'V', 4: 'V' };
    });
    return initial;
  });

  // State for proof photos: { [rowId]: base64 or photo URL }
  const [proofPhotos, setProofPhotos] = useState(() => {
    const initial = {};
    activeSheet.rows.forEach(r => {
      const existingPhoto = isEditMode ? existingSubmission.proofPhotos?.[r.id] : null;
      if (existingPhoto) initial[r.id] = existingPhoto;
      else if (r.proofPhoto) initial[r.id] = r.proofPhoto;
    });
    return initial;
  });

  const handlePillClick = (rowId, stationNo, value) => {
    setChecks(prev => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [stationNo]: prev[rowId]?.[stationNo] === value ? '' : value
      }
    }));
  };

  const handlePhotoUpload = (rowId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setProofPhotos(prev => ({
        ...prev,
        [rowId]: evt.target.result
      }));
      setToastMessage('Proof image uploaded successfully!');
      setTimeout(() => setToastMessage(''), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (isEditMode) {
        // Save the edited answers to the SAME record, then push it back to
        // the appropriate reviewer for a fresh decision.
        await storageService.updateSubmissionChecks(existingSubmission.id, checks, proofPhotos);
        if (isOperatorResubmit) {
          await storageService.resubmitSubmissionToShiftLeader(existingSubmission.id);
        } else {
          await storageService.resubmitSubmissionToAdmin(existingSubmission.id);
        }
        setSubmitted(true);
        if (onResubmitted) onResubmitted();
      } else {
        const payload = {
          templateId: template.id,
          templateTitle: template.title,
          docNumber: template.docNumber,
          revision: template.revision,
          shift: activeShift || 'Shift A',
          operatorName: currentUser?.name || 'Dummy Operator',
          operatorNTID: currentUser?.ntid || '1234567',
          checks,
          proofPhotos
        };
        await storageService.saveSubmission(payload);
        setSubmitted(true);
      }
    } catch (err) {
      alert(err.response?.data?.message || (isEditMode ? 'Failed to resubmit checklist.' : 'Failed to submit checklist to backend.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6 animate-fadeIn">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900">
            {isEditMode ? (isOperatorResubmit ? 'Resubmitted to Shift Leader Successfully!' : 'Resubmitted to Admin Successfully!') : 'Checklist Submitted Successfully!'}
          </h2>
          <p className="text-sm text-slate-500 mt-2">
            {isEditMode ? (
              isOperatorResubmit ? (
                <>Your edits to <span className="font-bold text-[#00529B]">{template.title} ({activeShift})</span> have been resubmitted to your Shift Leader for a fresh review.</>
              ) : (
                <>Your edits to <span className="font-bold text-[#00529B]">{template.title} ({activeShift})</span> have been resubmitted to Admin for a fresh final decision.</>
              )
            ) : (
              <>Your checklist form for <span className="font-bold text-[#00529B]">{template.title} ({activeShift})</span> has been submitted to the Approvals Queue for QA Manager review.</>
            )}
          </p>
        </div>
        <div className="pt-4">
          <button
            onClick={onBack}
            className="px-8 py-3.5 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-sm rounded-xl shadow-lg transition"
          >
            {isEditMode ? (isOperatorResubmit ? 'Back to My Checklists' : 'Back to Review Queue') : 'Back to My Checklists'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      
      {/* Floating Toast Notification matching Image 3 */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl font-bold text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Edit Mode Banner */}
      {isEditMode && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
          <div className="text-xs text-orange-800">
            <p className="font-bold">{isOperatorResubmit ? 'Editing a Shift-Leader-Rejected Submission' : 'Editing an Admin-Rejected Submission'}</p>
            <p className="mt-0.5 opacity-90">
              {existingSubmission?.rejectionRemark
                ? <>{isOperatorResubmit ? 'Shift Leader' : 'Admin'}'s remark: "{existingSubmission.rejectionRemark}"</>
                : isOperatorResubmit
                  ? 'Make your corrections below, then resubmit to your Shift Leader for a fresh review.'
                  : 'Make your corrections below, then resubmit to Admin for a fresh decision.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Container with Left Sidebar & Main Form (Matches Images 2 & 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Sidebar Pane (Matches Image 2 & 3) */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Back Button */}
          <button
            onClick={onBack}
            className="text-slate-600 hover:text-slate-900 text-xs font-bold flex items-center gap-1.5 py-1 px-2 hover:bg-slate-200/60 rounded-lg transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isEditMode ? (isOperatorResubmit ? 'Back to My Checklists' : 'Back to Review Queue') : 'Back to Checklists'}</span>
          </button>

          {/* Template Sidebar Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TEMPLATE</div>
              <h2 className="font-extrabold text-slate-900 text-sm mt-0.5">{template.title}</h2>
              <div className="text-xs text-slate-500 font-medium mt-1">
                {activeShift || 'Shift A'} • {new Date().toISOString().split('T')[0]}
              </div>
            </div>

            {/* View Cover Page Button matching Image 2 */}
            <button
              onClick={() => setIsCoverModalOpen(true)}
              className="w-full py-2.5 px-3 bg-sky-50 hover:bg-sky-100 text-[#00529B] font-bold text-xs rounded-xl border border-sky-200 transition flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>View Cover Page</span>
            </button>

            {/* Sheet Tabs List */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">SHEETS</div>
              {template.sheets.map((sheet, idx) => (
                <button
                  key={sheet.id}
                  onClick={() => setActiveSheetIndex(idx)}
                  className={`w-full text-left p-3 rounded-xl text-xs font-bold flex items-center gap-3 transition ${
                    activeSheetIndex === idx
                      ? 'bg-sky-100 text-[#00529B] border border-sky-300 shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-[#00529B] text-white flex items-center justify-center text-xs shrink-0">
                    {idx + 1}
                  </div>
                  <div className="truncate">
                    <div className="truncate">{sheet.title}</div>
                    <div className="text-[10px] font-normal text-slate-400">Interactive Table</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Submit / Resubmit Button */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full py-3 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? (isEditMode ? 'Resubmitting...' : 'Submitting...') : (isEditMode ? (isOperatorResubmit ? 'Resubmit to Shift Leader' : 'Resubmit to Admin') : 'Submit Checklist')}</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center leading-tight">
                {isEditMode ? (isOperatorResubmit ? 'This sends the SAME submission back to your Shift Leader with your edits.' : 'This sends the SAME submission back to Admin with your edits.') : 'At least one sheet must contain data to enable submission'}
              </p>
            </div>

          </div>
        </div>

        {/* Center / Right Industrial Matrix Table (Matches Images 2 & 3) */}
        <div className="lg:col-span-9 space-y-4">
          
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            
            {/* Sheet Title Bar & Skip Sheet button matching Image 2 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {activeSheet.title}
                </h2>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  {template.docNumber} • Rev {template.revision}
                </div>
              </div>

              {/* Skip Sheet Button matching Image 2 */}
              <button
                onClick={() => alert('Skipped sheet.')}
                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0"
              >
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Skip Sheet</span>
              </button>
            </div>

            {/* Scrollable Industrial Table Matrix */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner max-h-[650px]">
              <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                
                {/* Header Columns matching Image 2 & 3 */}
                <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider text-[11px] sticky top-0 z-20 border-b border-slate-300">
                  <tr>
                    <th className="px-3 py-3 border-r border-slate-300 text-center w-12">NO.</th>
                    <th className="px-4 py-3 border-r border-slate-300 min-w-[220px]">NATURE OF ACTIVITY</th>
                    <th className="px-3 py-3 border-r border-slate-300 w-32">TYPE OF ACTIVITY</th>
                    <th className="px-3 py-3 border-r border-slate-300 text-center w-20">PHOTO</th>
                    <th className="px-4 py-3 border-r border-slate-300 min-w-[180px]">METHOD (HOW TO DO)</th>
                    <th className="px-3 py-3 border-r border-slate-300 min-w-[130px]">WHEN TO DO</th>
                    <th className="px-4 py-3 border-r border-slate-300 text-center min-w-[140px]">PIC (PROOF)</th>
                    <th className="px-3 py-3 border-r border-slate-300 text-center w-12">1</th>
                    <th className="px-3 py-3 border-r border-slate-300 text-center w-12">2</th>
                    <th className="px-3 py-3 border-r border-slate-300 text-center w-12">3</th>
                    <th className="px-3 py-3 border-r border-slate-300 text-center w-12">4</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {activeSheet.rows.map((row) => {
                    const rowChecks = checks[row.id] || {};
                    const proofImg = proofPhotos[row.id];

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/90 transition">
                        
                        {/* NO. */}
                        <td className="px-3 py-4 border-r border-slate-200 text-center font-extrabold text-slate-800">
                          {row.no}
                        </td>

                        {/* NATURE OF ACTIVITY (English + Marathi + Badge matching Image 2) */}
                        <td className="px-4 py-4 border-r border-slate-200 space-y-1">
                          <div className="font-extrabold text-slate-900 text-xs leading-snug">
                            {row.nature}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium italic">
                            (
                          </div>
                          <div className="inline-block px-2 py-0.5 bg-amber-100/80 text-amber-800 text-[9px] font-bold rounded uppercase tracking-wider">
                            {row.marathi}
                          </div>
                        </td>

                        {/* TYPE OF ACTIVITY (with Marathi text) */}
                        <td className="px-3 py-4 border-r border-slate-200">
                          <div className="font-bold text-slate-800 text-xs">{row.type}</div>
                          <div className="text-[10px] text-slate-400 font-medium">{row.typeMarathi || 'निरीक्षण'}</div>
                        </td>

                        {/* PHOTO Reference Diagram */}
                        <td className="px-3 py-4 border-r border-slate-200 text-center">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-300 flex items-center justify-center mx-auto overflow-hidden text-slate-500">
                            {row.photoRef === 'cleaning' ? '🧹' : row.photoRef === 'pipe' ? '👁' : row.photoRef === 'ear' ? '👂' : '⚙'}
                          </div>
                        </td>

                        {/* METHOD (HOW TO DO) */}
                        <td className="px-4 py-4 border-r border-slate-200 text-slate-700 italic text-xs">
                          {row.method}
                        </td>

                        {/* WHEN TO DO (Frequency Pill) */}
                        <td className="px-3 py-4 border-r border-slate-200">
                          <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-[10px] border border-slate-200">
                            {row.when}
                          </span>
                        </td>

                        {/* PIC (PROOF) Image Uploader slot matching Image 3 */}
                        <td className="px-4 py-4 border-r border-slate-200 text-center">
                          {proofImg ? (
                            <div className="relative group inline-block">
                              <img
                                src={proofImg}
                                alt="Proof"
                                className="w-14 h-12 object-cover rounded-lg border-2 border-emerald-400 shadow-sm"
                              />
                              <label className="absolute inset-0 bg-black/50 text-white rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold cursor-pointer transition">
                                Change
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload(row.id, e)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          ) : (
                            <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-sky-50 text-slate-600 hover:text-[#00529B] border border-dashed border-slate-300 hover:border-sky-400 rounded-xl cursor-pointer text-[10px] font-extrabold uppercase tracking-wider transition">
                              <Camera className="w-3.5 h-3.5" />
                              <span>PROOF PHOTO</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handlePhotoUpload(row.id, e)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </td>

                        {/* Station Check Columns 1, 2, 3, 4 with Pill buttons V / X / / matching Image 3 */}
                        {[1, 2, 3, 4].map((stationNo) => {
                          const currentVal = rowChecks[stationNo];
                          return (
                            <td key={stationNo} className="px-2 py-4 border-r border-slate-200 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handlePillClick(row.id, stationNo, 'V')}
                                  className={`check-pill ${currentVal === 'V' ? 'check-pill-v-active' : 'check-pill-v'}`}
                                  title="Valid / Check (V)"
                                >
                                  V
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePillClick(row.id, stationNo, 'X')}
                                  className={`check-pill ${currentVal === 'X' ? 'check-pill-x-active' : 'check-pill-x'}`}
                                  title="Fail / Defect (X)"
                                >
                                  X
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePillClick(row.id, stationNo, '/')}
                                  className={`check-pill ${currentVal === '/' ? 'check-pill-slash-active' : 'check-pill-slash'}`}
                                  title="N/A (/)"
                                >
                                  /
                                </button>
                              </div>
                            </td>
                          );
                        })}

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>

            {/* Bottom Actions Bar matching Image 3 */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setToastMessage('Sheet draft saved successfully!');
                  setTimeout(() => setToastMessage(''), 3000);
                }}
                className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Sheet</span>
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Cover Page Modal */}
      <CoverPageModal
        isOpen={isCoverModalOpen}
        onClose={() => setIsCoverModalOpen(false)}
        coverData={template.coverPage}
        docNumber={template.docNumber}
        docTitle={template.title}
        revision={template.revision}
      />

    </div>
  );
}
