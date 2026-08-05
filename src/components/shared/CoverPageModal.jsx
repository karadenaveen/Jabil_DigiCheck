import React from 'react';
import { X, FileText, Calendar, User, ShieldCheck } from 'lucide-react';

export function CoverPageModal({ isOpen, onClose, coverData, docNumber, docTitle, revision }) {
  if (!isOpen) return null;

  const cover = coverData || {
    docTitle: docTitle || 'Checklist',
    docNumber: docNumber || '43-ME80-F28-ASLY-00002',
    revision: revision || 'B',
    category: 'Form',
    revisionHistory: [
      { rev: 'B', changeDetails: 'New Document', originator: 'Dummy Operator', date: '2026-05-19' },
      { rev: 'A', changeDetails: 'Initial Specification', originator: 'QA Engineering', date: '2025-11-10' }
    ],
    purpose: 'Required Document for Daily Production Record for Checklist.',
    scope: 'This document is used for Maintaining Daily Production Record for lines/operations of Checklist.',
    references: [
      { docNumber: docNumber || '43-ME80-F28-ASLY-00002', docTitle: docTitle || 'Checklist' }
    ]
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
            <FileText className="w-5 h-5 text-[#00529B]" />
            <span>Cover Page Preview: {cover.docTitle}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">
          
          {/* Main Cover Page Table Block (Matches Image 4) */}
          <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-12 divide-x divide-y md:divide-y-0 divide-slate-300">
              
              {/* Jabil Logo Cell */}
              <div className="col-span-12 md:col-span-3 p-6 flex items-center justify-center bg-slate-50">
                <div className="bg-[#00529B] text-white px-5 py-2.5 rounded font-black text-2xl tracking-tighter shadow">
                  JABIL
                </div>
              </div>

              {/* Form Title Cell */}
              <div className="col-span-12 md:col-span-6 p-4 flex items-center justify-center text-center">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-lg uppercase tracking-wide">
                    FORM COVER PAGE
                  </h2>
                  <div className="mt-2 text-xs text-slate-600 space-y-1">
                    <div><span className="font-semibold">Doc. number:</span> {cover.docNumber}</div>
                    <div><span className="font-semibold">Doc Title:</span> {cover.docTitle}</div>
                  </div>
                </div>
              </div>

              {/* Revision & Category Cell */}
              <div className="col-span-12 md:col-span-3 p-4 bg-slate-50 flex flex-col justify-center text-xs space-y-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">REVISION</span>
                  <span className="font-bold text-slate-900 text-sm">{cover.revision}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CATEGORY</span>
                  <span className="font-bold text-[#00529B]">{cover.category}</span>
                </div>
              </div>

            </div>
          </div>

          {/* Revision History Section */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 font-bold text-xs text-slate-700 uppercase tracking-wider">
              REVISION HISTORY
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="px-4 py-2 border-r border-slate-200">Rev</th>
                    <th className="px-4 py-2 border-r border-slate-200">Change Details</th>
                    <th className="px-4 py-2 border-r border-slate-200">Originator</th>
                    <th className="px-4 py-2">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cover.revisionHistory?.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5 font-bold text-slate-800 border-r border-slate-200">{row.rev}</td>
                      <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200">{row.changeDetails}</td>
                      <td className="px-4 py-2.5 text-slate-700 border-r border-slate-200">{row.originator}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 1.0 PURPOSE */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 font-bold text-xs text-slate-700 uppercase tracking-wider">
              1.0 PURPOSE
            </div>
            <div className="p-4 text-xs text-slate-700 leading-relaxed">
              {cover.purpose}
            </div>
          </div>

          {/* 2.0 SCOPE */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 font-bold text-xs text-slate-700 uppercase tracking-wider">
              2.0 SCOPE
            </div>
            <div className="p-4 text-xs text-slate-700 leading-relaxed">
              {cover.scope}
            </div>
          </div>

          {/* 3.0 REFERENCES */}
          <div className="bg-white border border-slate-300 rounded-lg overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 font-bold text-xs text-slate-700 uppercase tracking-wider">
              3.0 REFERENCES
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="px-4 py-2 border-r border-slate-200">Document Number</th>
                    <th className="px-4 py-2">Document Title</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {cover.references?.map((ref, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2.5 font-mono text-slate-800 border-r border-slate-200">{ref.docNumber}</td>
                      <td className="px-4 py-2.5 text-slate-700">{ref.docTitle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-[#00529B] hover:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow transition"
          >
            Close Cover Page
          </button>
        </div>

      </div>
    </div>
  );
}
