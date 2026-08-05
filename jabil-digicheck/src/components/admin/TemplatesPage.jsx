import React, { useState, useEffect } from 'react';
import { storageService } from '../../services/storageService';
import { CoverPageModal } from '../shared/CoverPageModal';
import { 
  FileSpreadsheet, Upload, Eye, Trash2, RefreshCw, 
  Search, Filter, CheckCircle, FileText, Sparkles, ArrowRight 
} from 'lucide-react';
import * as XLSX from 'xlsx';

export function TemplatesPage() {
  const [activeTab, setActiveTab] = useState('library'); // 'library' or 'upload'
  const [templates, setTemplates] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All'); // All, Approved, Pending, Draft
  const [previewTemplate, setPreviewTemplate] = useState(null);

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

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });

        const sheetNames = wb.SheetNames;
        const parsedSheets = sheetNames.map((sName, idx) => {
          const ws = wb.Sheets[sName];
          const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          // Generate structured rows from raw sheet data
          const rows = rawData.slice(1, 10).map((r, rIdx) => ({
            id: rIdx + 1,
            no: rIdx + 1,
            nature: r[0] || `Check point item #${rIdx + 1} compliance`,
            marathi: `(YOUR ROW (SHIFT EVERY DAY (हर दिन)))`,
            type: rIdx % 2 === 0 ? 'Cleaning' : 'Inspection',
            photoRef: 'cleaning',
            method: r[1] || 'Inspect visually to verify compliance.',
            when: 'Every Shift (हर शिफ्ट)',
            proofRequired: true
          }));

          return {
            id: `sheet-${idx + 1}`,
            title: sName || `Sheet ${idx + 1}`,
            rows: rows.length > 0 ? rows : [
              {
                id: 1,
                no: 1,
                nature: 'Clean Machine inside burr & outer surface of machine.',
                marathi: '(YOUR ROW (SHIFT EVERY DAY (हर दिन)))',
                type: 'Cleaning',
                photoRef: 'cleaning',
                method: 'Inspect visually to verify compliance.',
                when: 'Every Day (हर दिन)',
                proofRequired: true
              }
            ]
          };
        });

        // Formulate Extracted Blueprint
        const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
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
          sheets: parsedSheets
        };

        const updated = await storageService.saveTemplate(newBlueprint);
        setTemplates(updated);
        setParseResult(newBlueprint);
        setUploading(false);
      } catch (err) {
        console.error('Excel Parsing Error:', err);
        setUploading(false);
        alert('Could not parse Excel file. Please ensure it is a valid .xlsx file.');
      }
    };
    reader.readAsBinaryString(file);
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
                    </div>
                  </div>

                  {/* Options as requested: Upload Another One OR View Blueprint Preview */}
                  <div className="flex flex-col sm:flex-row gap-4 pt-2">
                    <button
                      onClick={() => setParseResult(null)}
                      className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Upload Another One</span>
                    </button>
                    
                    <button
                      onClick={() => setPreviewTemplate(parseResult)}
                      className="px-6 py-3 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      <span>View Blueprint Preview</span>
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

    </div>
  );
}
