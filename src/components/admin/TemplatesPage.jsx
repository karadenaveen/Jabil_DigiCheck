import React, { useState, useEffect } from 'react';
import { storageService, getFileUrl } from '../../services/storageService';
import { CoverPageModal } from '../shared/CoverPageModal';
import { ExcelGridViewer } from '../shared/ExcelGridViewer';
import {
  FileSpreadsheet, Upload, Eye, Trash2, RefreshCw,
  Search, Filter, CheckCircle, FileText, Sparkles, ArrowRight, Grid3x3, AlertTriangle
} from 'lucide-react';
import { parseWorkbookFile, extractChecklistRows } from '../../utils/excelParser';

export function TemplatesPage() {
  const [activeTab, setActiveTab] = useState('library'); // 'library' or 'upload'
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All, Approved, Pending, Draft
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [gridPreview, setGridPreview] = useState(null); // { workbook, title } for ExcelGridViewer

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    const data = await storageService.getTemplates();
    setTemplates(data);
  };

  // Upload State
  const [uploading, setUploading] = useState(false);
  const [parseResult, setParseResult] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    docNumber: '',
    revision: 'A',
    category: 'Form'
  });

  const [parseError, setParseError] = useState('');
  const [lastRawWorkbook, setLastRawWorkbook] = useState(null);

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setParseError('');

    (async () => {
      try {
        // Full-fidelity parse: real cell values, merges, styles, frozen
        // panes, hidden rows/cols, images — nothing fabricated.
        const rawWorkbook = await parseWorkbookFile(file);

        if (!rawWorkbook.sheets.length) {
          throw new Error('No sheets found in this workbook.');
        }

        // Best-effort real-data mapping into the checklist field shape the
        // operator-facing checklist and backend template_fields expect.
        // Only real header-mapped cell values are used; unmatched fields
        // are left blank rather than invented, and fully blank rows are
        // skipped rather than padded with placeholders.
        const parsedSheets = rawWorkbook.sheets.map((sheet, idx) => ({
          id: `sheet-${idx + 1}`,
          title: sheet.name || `Sheet ${idx + 1}`,
          rows: extractChecklistRows(sheet)
        }));

        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        const docNo = '43-ME80-F28-ASLY-' + Math.floor(10000 + Math.random() * 90000);

        const newBlueprint = {
          id: 'tmpl-' + Date.now(),
          title: uploadForm.title || fileNameWithoutExt || 'CLIRT Checksheet F28 CAP CNC',
          shortTitle: (uploadForm.title || fileNameWithoutExt).substring(0, 45) + '...',
          docNumber: uploadForm.docNumber || docNo,
          revision: uploadForm.revision || 'B',
          category: uploadForm.category || 'Form',
          uploadedBy: 'Admin Supervisor',
          uploadedDate: new Date().toISOString().split('T')[0],
          status: 'Active',
          sheetsCount: parsedSheets.length,
          coverPage: {
            docTitle: uploadForm.title || fileNameWithoutExt,
            docNumber: uploadForm.docNumber || docNo,
            revision: uploadForm.revision || 'B',
            category: uploadForm.category || 'Form',
            originator: 'Admin Supervisor',
            date: new Date().toISOString().split('T')[0],
            revisionHistory: [
              { rev: uploadForm.revision || 'B', changeDetails: 'Intelligent Excel Import Finalized', originator: 'Admin Supervisor', date: new Date().toISOString().split('T')[0] }
            ],
            purpose: 'Required Document for Daily Production Record for Checklist.',
            scope: 'This document is used for Maintaining Daily Production Record for lines/operations of Checklist.',
            references: [
              { docNumber: uploadForm.docNumber || docNo, docTitle: uploadForm.title || fileNameWithoutExt }
            ]
          },
          sheets: parsedSheets,
          // Real, exact extracted workbook — persisted so operators can
          // fill in the sheet exactly as uploaded, not just at parse time.
          gridData: rawWorkbook
        };

        const updated = await storageService.saveTemplate(newBlueprint);
        setTemplates(updated);

        // Save the exact original file to disk too (not just parsed JSON),
        // so there's a literal .xlsx admins can always get back.
        let finalTemplate = { ...newBlueprint, ...updated.find(t => t.id === newBlueprint.id) };
        try {
          const withFile = await storageService.uploadOriginalExcelFile(finalTemplate.id, file);
          if (withFile) finalTemplate = { ...finalTemplate, ...withFile };
          setTemplates((prev) => prev.map(t => t.id === finalTemplate.id ? finalTemplate : t));
        } catch (fileErr) {
          console.error('Could not save original Excel file to disk:', fileErr);
          // Non-fatal — the template itself was already saved successfully.
        }

        setParseResult(finalTemplate);
        setLastRawWorkbook(rawWorkbook);
        setUploading(false);
      } catch (err) {
        console.error('Excel Parsing Error:', err);
        setUploading(false);
        setParseError(err.message || 'Could not parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
      }
    })();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this blueprint template?')) {
      const updated = await storageService.deleteTemplate(id);
      setTemplates(updated);
    }
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesQuery = 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.docNumber.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'All') return matchesQuery;
    return matchesQuery && (t.status === statusFilter || statusFilter === 'Approved');
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Title & Subtitle as requested */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span className="text-[#00529B]">Template Blueprints</span>
          </h1>
          <p className="text-xs text-[#00529B] font-medium mt-0.5">
            (Manage, Audit, And Parse Intelligent Excel Checklist Templates)
          </p>
        </div>
      </div>

      {/* Main Container with Left Sidebar Selector Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Corner Selector (Template Library vs Upload New File) */}
        <div className="lg:col-span-3 space-y-2">
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <button
              onClick={() => { setActiveTab('library'); setParseResult(null); }}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${
                activeTab === 'library'
                  ? 'bg-[#00529B] text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-4 h-4" />
                <span>Template Library</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-mono">
                {templates.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('upload')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold text-xs flex items-center justify-between transition-all ${
                activeTab === 'upload'
                  ? 'bg-[#00529B] text-white shadow-md'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4" />
                <span>Upload New File</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-slate-900 font-bold">
                XLSX
              </span>
            </button>
          </div>

          {/* Quick Notice Box */}
          <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-800 space-y-2">
            <div className="font-bold flex items-center gap-1.5 text-sky-900">
              <Sparkles className="w-4 h-4 text-[#00529B]" />
              <span>Intelligent Parsing</span>
            </div>
            <p className="text-[11px] text-sky-700 leading-relaxed">
              Upload Excel templates containing Cover Page and multi-sheet check tables. Unfilled rows will be converted into interactive operator checklists!
            </p>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="lg:col-span-9">
          
          {/* VIEW 1: TEMPLATE LIBRARY */}
          {activeTab === 'library' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              
              {/* Search Bar & Filter Options */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Search Bar */}
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search Template by Name, Doc Number..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                {/* Filter Pills (All Blueprints, Approved, Pending, Draft) */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold border border-slate-200">
                  {['All Blueprints', 'Approved', 'Pending', 'Draft'].map((f) => {
                    const cleanF = f === 'All Blueprints' ? 'All' : f;
                    return (
                      <button
                        key={f}
                        onClick={() => setStatusFilter(cleanF)}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                          statusFilter === cleanF
                            ? 'bg-white text-[#00529B] shadow-sm font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>

              </div>

              {/* Blueprints Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="px-4 py-3">Template Name & Details</th>
                      <th className="px-4 py-3">Doc Number</th>
                      <th className="px-4 py-3 text-center">Sheets</th>
                      <th className="px-4 py-3">Uploaded By</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTemplates.map((tmpl) => (
                      <tr key={tmpl.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <div>{tmpl.title}</div>
                          <div className="text-[10px] font-normal text-slate-500 mt-0.5">Rev {tmpl.revision} • {tmpl.category}</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700 font-semibold">
                          {tmpl.docNumber}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-800">
                          <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded">
                            {tmpl.sheetsCount || 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{tmpl.uploadedBy}</td>
                        <td className="px-4 py-3 text-slate-500">{tmpl.uploadedDate}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {tmpl.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            
                            {/* Eye Option: Opens Cover Page Preview */}
                            <button
                              onClick={() => setPreviewTemplate(tmpl)}
                              className="p-1.5 text-slate-600 hover:text-[#00529B] hover:bg-sky-50 rounded-lg transition"
                              title="View Cover Page Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Grid Option: Opens exact Excel grid, if available */}
                            <button
                              onClick={() => tmpl.gridData && setGridPreview({ workbook: tmpl.gridData, title: tmpl.title, templateId: tmpl.id })}
                              disabled={!tmpl.gridData}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={tmpl.gridData ? 'View Exact Excel Grid' : 'Exact grid not available for this template'}
                            >
                              <Grid3x3 className="w-4 h-4" />
                            </button>

                            {/* Download the literal original .xlsx file, if stored */}
                            {tmpl.originalFilePath ? (
                              <a
                                href={getFileUrl(tmpl.originalFilePath)}
                                download
                                className="p-1.5 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                title="Download Original .xlsx File"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </a>
                            ) : (
                              <span
                                className="p-1.5 text-slate-300 cursor-not-allowed"
                                title="Original .xlsx file not stored for this template"
                              >
                                <FileSpreadsheet className="w-4 h-4" />
                              </span>
                            )}

                            {/* Time recycle icon */}
                            <button
                              onClick={() => alert(`Version Recycle History: Rev ${tmpl.revision} is active.`)}
                              className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title="Version History Recycle"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>

                            {/* Delete Bin */}
                            <button
                              onClick={() => handleDelete(tmpl.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Template Blueprint"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* VIEW 2: UPLOAD NEW FILE */}
          {activeTab === 'upload' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              
              {!parseResult ? (
                <>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Upload Excel Template</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select or drag & drop `.xlsx` checklist blueprint files containing Cover Page and sheets.
                    </p>
                  </div>

                  {/* Metadata Input Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Blueprint Title</label>
                      <input
                        type="text"
                        value={uploadForm.title}
                        onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                        placeholder="CLIRT Checksheet F28 CAP CNC"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Document Number</label>
                      <input
                        type="text"
                        value={uploadForm.docNumber}
                        onChange={(e) => setUploadForm({ ...uploadForm, docNumber: e.target.value })}
                        placeholder="43-ME80-F28-ASLY-00002"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Revision</label>
                      <input
                        type="text"
                        value={uploadForm.revision}
                        onChange={(e) => setUploadForm({ ...uploadForm, revision: e.target.value })}
                        placeholder="Rev B"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {parseError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-rose-800">Could not parse this file</p>
                        <p className="text-xs text-rose-600 mt-0.5">{parseError}</p>
                      </div>
                    </div>
                  )}

                  {/* Drag & Drop Upload Zone */}
                  <label className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-sky-300 hover:border-sky-500 bg-sky-50/50 hover:bg-sky-50 rounded-2xl cursor-pointer transition text-center group">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleExcelUpload}
                      className="hidden"
                    />
                    <div className="w-16 h-16 rounded-2xl bg-white text-[#00529B] shadow-md flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div className="font-bold text-sm text-slate-800">
                      Click to Browse or Drag & Drop Excel File
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Supports `.xlsx` and `.xls` files with Cover Page and Sheet 1, Sheet 2</p>
                    
                    {uploading && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#00529B]">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Parsing Intelligent Blueprint Tables...</span>
                      </div>
                    )}
                  </label>
                </>
              ) : (
                /* Blueprint Parsing Finalized View */
                <div className="space-y-6 animate-fadeIn">
                  
                  {/* Finalized Banner */}
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="font-bold text-emerald-900 text-sm">Blueprint Parsing Finalized</h3>
                      <p className="text-xs text-emerald-700">Review or Upload The Extracted Documents Details Below.</p>
                    </div>
                  </div>

                  {/* Extracted Details Overview */}
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Extracted Blueprint Name</span>
                        <span className="font-extrabold text-slate-900 text-sm">{parseResult.title}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Doc Number</span>
                        <span className="font-mono font-bold text-[#00529B]">{parseResult.docNumber}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Revision</span>
                        <span className="font-bold text-slate-800">{parseResult.revision}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Category</span>
                        <span className="font-bold text-slate-800">{parseResult.category}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Sheets Extracted</span>
                        <span className="font-bold text-slate-800">{parseResult.sheets?.length || 0}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold uppercase block text-[10px]">Checklist Rows Detected</span>
                        <span className="font-bold text-slate-800">
                          {(parseResult.sheets || []).reduce((sum, s) => sum + (s.rows?.length || 0), 0)}
                        </span>
                      </div>
                    </div>
                    {(parseResult.sheets || []).every(s => (s.rows?.length || 0) === 0) && (
                      <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>No recognizable checklist columns (Nature / Method / When, etc.) were found in this sheet, so no rows were auto-mapped. Use "View Excel Grid" below to see exactly what was extracted.</span>
                      </div>
                    )}
                  </div>

                  {/* Options: Upload Another, View Excel Grid (exact), View Cover Page, Go to Library */}
                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => { setParseResult(null); setParseError(''); }}
                      className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Another One</span>
                    </button>

                    <button
                      onClick={() => setGridPreview({ workbook: parseResult.gridData || lastRawWorkbook, title: parseResult.title, templateId: parseResult.id })}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      <Grid3x3 className="w-4 h-4" />
                      <span>View Excel Grid (Exact)</span>
                    </button>

                    <button
                      onClick={() => setPreviewTemplate(parseResult)}
                      className="px-6 py-3 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Cover Page</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('library')}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2 sm:ml-auto"
                    >
                      <span>Go to Template Library</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

      </div>

      {/* Cover Page Modal */}
      <CoverPageModal
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        coverData={previewTemplate?.coverPage}
        docNumber={previewTemplate?.docNumber}
        docTitle={previewTemplate?.title}
        revision={previewTemplate?.revision}
      />

      {/* High-fidelity Excel Grid Viewer — exact extracted workbook */}
      <ExcelGridViewer
        isOpen={!!gridPreview}
        onClose={() => setGridPreview(null)}
        workbook={gridPreview?.workbook}
        title={gridPreview?.title}
        templateId={gridPreview?.templateId}
        onSaved={(updatedTemplate) => {
          if (!updatedTemplate) return;
          setTemplates((prev) => prev.map(t => t.id === updatedTemplate.id ? { ...t, ...updatedTemplate } : t));
          setGridPreview((prev) => prev ? { ...prev, workbook: updatedTemplate.gridData || prev.workbook } : prev);
          if (parseResult?.id === updatedTemplate.id) {
            setParseResult((prev) => prev ? { ...prev, ...updatedTemplate } : prev);
          }
        }}
      />

    </div>
  );
}
