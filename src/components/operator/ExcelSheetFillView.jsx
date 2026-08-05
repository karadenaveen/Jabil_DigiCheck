import React, { useState, useMemo, useCallback } from 'react';
import { storageService, getFileUrl } from '../../services/storageService';
import {
  ArrowLeft, Send, CheckCircle2, FileSpreadsheet, ZoomIn, ZoomOut, Maximize2, Download, Loader2
} from 'lucide-react';
import { ROW_HEADER_WIDTH, colLetter, cellStyleToCss, buildMergeMaps, getImageRect } from '../../utils/excelGridHelpers';
import { buildFilledWorkbookBlob } from '../../utils/excelParser';

/**
 * Renders `template.gridData` (the exact, high-fidelity parsed workbook —
 * same shape produced by src/utils/excelParser.js) as a fillable grid.
 *
 * Any cell that was blank in the original file becomes an editable input,
 * styled to match its cell (font/alignment/borders), so the operator is
 * literally filling in the blanks of the real uploaded sheet. Cells that
 * already had content (labels, instructions, cover page text) stay
 * read-only, exactly as extracted.
 */
let _measureEl = null;
function measureTextWidth(text, el) {
  if (!_measureEl) {
    _measureEl = document.createElement('span');
    _measureEl.style.position = 'absolute';
    _measureEl.style.visibility = 'hidden';
    _measureEl.style.whiteSpace = 'pre';
    _measureEl.style.top = '-9999px';
    _measureEl.style.left = '-9999px';
    document.body.appendChild(_measureEl);
  }
  // Mirror the real element's computed font so the measurement is exact,
  // not a guess at what font Tailwind actually applied.
  const computed = window.getComputedStyle(el);
  _measureEl.style.font = computed.font;
  _measureEl.style.letterSpacing = computed.letterSpacing;
  _measureEl.textContent = text || ' ';
  return _measureEl.getBoundingClientRect().width;
}

const MAX_AUTO_COL_WIDTH = 900; // generous ceiling — a full sentence should fit on one line before this kicks in
const CELL_HORIZONTAL_PADDING = 14; // matches the textarea's left+right px padding

/**
 * A fillable cell that grows to fit whatever the operator types. Grows the
 * column wider first (up to a sensible cap), and only falls back to
 * wrapping + a taller row once a single line would get unreasonably wide —
 * plain <input> elements can never grow at all, so this uses a <textarea>.
 */
function AutoGrowCell({ value, minHeight, minWidth, textAlign, onChange, onNeedWidth }) {
  const resize = (el) => {
    const neededWidth = Math.ceil(measureTextWidth(el.value, el)) + CELL_HORIZONTAL_PADDING;
    onNeedWidth(Math.min(MAX_AUTO_COL_WIDTH, Math.max(minWidth, neededWidth)));
    el.style.height = 'auto';
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  };

  const ref = useCallback((el) => { if (el) resize(el); }, [minHeight, minWidth]);

  const handleInput = (e) => {
    resize(e.target);
    onChange(e.target.value);
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={handleInput}
      wrap="off"
      style={{ minHeight, textAlign, resize: 'none', whiteSpace: 'pre' }}
      className="w-full block px-1.5 py-1 text-[11px] text-slate-800 bg-sky-50/50 focus:bg-sky-50 outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400 border-0 overflow-hidden"
    />
  );
}

export function ExcelSheetFillView({ currentUser, template, activeShift, onBack }) {
  const workbook = template.gridData;
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [values, setValues] = useState({}); // "sheetIdx_r_c" -> string
  const [columnWidthOverrides, setColumnWidthOverrides] = useState({}); // "sheetIdx_colNum" -> px
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const sheet = workbook?.sheets?.[activeSheetIndex] || null;

  const hiddenColSet = useMemo(() => new Set(sheet?.hiddenCols || []), [sheet]);
  const hiddenRowSet = useMemo(() => {
    const s = new Set();
    (sheet?.rows || []).forEach(r => { if (r.hidden) s.add(r.index); });
    return s;
  }, [sheet]);

  const { mergeStarts, coveredCells } = useMemo(() => buildMergeMaps(sheet), [sheet]);

  const handleNeedWidth = useCallback((colNum, widthPx) => {
    const key = `${activeSheetIndex}_${colNum}`;
    setColumnWidthOverrides((prev) => (
      widthPx > (prev[key] || 0) ? { ...prev, [key]: widthPx } : prev
    ));
  }, [activeSheetIndex]);

  const colWidthsZoomed = useMemo(
    () => (sheet?.colWidths || []).map((w, i) => {
      if (hiddenColSet.has(i + 1)) return 0;
      const base = Math.max(48, Math.round(w * zoom));
      const override = columnWidthOverrides[`${activeSheetIndex}_${i + 1}`] || 0;
      return Math.max(base, override);
    }),
    [sheet, zoom, hiddenColSet, columnWidthOverrides, activeSheetIndex]
  );
  const rowHeightZoomed = useCallback((h) => Math.max(22, Math.round(h * zoom)), [zoom]);

  const colOffsets = useMemo(() => {
    const offsets = [ROW_HEADER_WIDTH];
    for (let i = 0; i < colWidthsZoomed.length; i++) offsets.push(offsets[i] + colWidthsZoomed[i]);
    return offsets;
  }, [colWidthsZoomed]);

  const headerRowHeight = rowHeightZoomed(24);
  const rowHeightsZoomedArray = useMemo(
    () => (sheet?.rows || []).map(r => r.hidden ? 0 : rowHeightZoomed(r.height)),
    [sheet, rowHeightZoomed]
  );

  const xSplit = sheet?.frozen?.xSplit || 0;
  const ySplit = sheet?.frozen?.ySplit || 0;

  const handleValueChange = (r, c, val) => {
    setValues((prev) => ({ ...prev, [`${activeSheetIndex}_${r}_${c}`]: val }));
  };

  const [savedFilePath, setSavedFilePath] = useState(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    const payload = {
      templateId: template.id,
      templateTitle: template.title,
      docNumber: template.docNumber,
      revision: template.revision,
      shift: activeShift || 'Shift A',
      operatorName: currentUser?.name || 'Operator',
      operatorNTID: currentUser?.ntid || '',
      gridAnswers: values
    };
    try {
      const allSubmissions = await storageService.saveSubmission(payload);
      // The backend returns the full list, freshly ordered by created_at
      // DESC — the just-created submission for this operator+template is
      // the first match, and it already has the real .xlsx path attached.
      const justCreated = Array.isArray(allSubmissions)
        ? allSubmissions.find(s => s.templateId === template.id && s.operatorNTID === payload.operatorNTID)
        : null;
      if (justCreated?.filledExcelPath) setSavedFilePath(justCreated.filledExcelPath);
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit checklist to backend.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    // Prefer the real .xlsx file the backend already generated and saved.
    if (savedFilePath) {
      const a = document.createElement('a');
      a.href = getFileUrl(savedFilePath);
      a.download = `${(template.title || 'checklist').replace(/[^a-z0-9]+/gi, '_')}_filled.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // Fallback: regenerate client-side if the server-side file isn't
    // available for some reason.
    setDownloading(true);
    try {
      const blob = await buildFilledWorkbookBlob(workbook, values);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(template.title || 'checklist').replace(/[^a-z0-9]+/gi, '_')}_filled.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Non-critical — the submission itself already succeeded
    } finally {
      setDownloading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-6 animate-fadeIn">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900">Checklist Submitted</h2>
          <p className="text-sm text-slate-500 mt-1">
            Your filled checklist for <strong>{template.title}</strong> has been sent for review.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-5 py-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>{downloading ? 'Preparing...' : 'Download Filled Excel'}</span>
          </button>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-[#00529B] hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow transition"
          >
            Back to My Checklists
          </button>
        </div>
      </div>
    );
  }

  if (!workbook || !Array.isArray(workbook.sheets) || workbook.sheets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center space-y-4">
        <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Exact grid data not available for this template</p>
        <p className="text-xs text-slate-400">This template was uploaded before the exact-grid feature was added.</p>
        <button onClick={onBack} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition">
          <ArrowLeft className="w-3.5 h-3.5 inline mr-1" /> Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-900 truncate">{template.title}</h1>
            <p className="text-xs text-slate-500">{template.docNumber} · Rev {template.revision} · Fill exactly as shown below</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setZoom(z => Math.max(0.6, Number((z - 0.1).toFixed(2))))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.5, Number((z + 0.1).toFixed(2))))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setZoom(1)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {submitError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
          {submitError}
        </div>
      )}

      {/* Grid */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-auto max-h-[65vh] relative">
          <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: ROW_HEADER_WIDTH }} />
              {colWidthsZoomed.map((w, i) => (!hiddenColSet.has(i + 1) && <col key={i} style={{ width: w }} />))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky bg-slate-200 border border-slate-300" style={{ top: 0, left: 0, position: 'sticky', height: headerRowHeight, zIndex: 40 }} />
                {(sheet.colWidths || []).map((_, i) => {
                  const colNum = i + 1;
                  if (hiddenColSet.has(colNum)) return null;
                  const isFrozenCol = colNum <= xSplit;
                  return (
                    <th
                      key={colNum}
                      className="sticky bg-slate-200 border border-slate-300 text-[10px] font-semibold text-slate-600"
                      style={{ top: 0, left: isFrozenCol ? colOffsets[i] : undefined, position: 'sticky', height: headerRowHeight, zIndex: isFrozenCol ? 35 : 30 }}
                    >
                      {colLetter(colNum)}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(sheet.rows || []).map((rowMeta, rIdx) => {
                if (hiddenRowSet.has(rowMeta.index)) return null;
                const h = rowHeightZoomed(rowMeta.height);
                return (
                  <tr key={rowMeta.index}>
                    <td className="sticky bg-slate-200 border border-slate-300 text-center text-[10px] font-semibold text-slate-600" style={{ left: 0, position: 'sticky', height: h, zIndex: 20 }}>
                      {rowMeta.index}
                    </td>
                    {(sheet.colWidths || []).map((_, cIdx) => {
                      const colNum = cIdx + 1;
                      if (hiddenColSet.has(colNum)) return null;
                      const key = `${rowMeta.index}_${colNum}`;
                      if (coveredCells.has(key)) return null;

                      const cellData = sheet.cells[key];
                      const span = mergeStarts[key];
                      const isFrozenColCell = colNum <= xSplit;
                      const hasOriginalContent = cellData && cellData.value !== '' && cellData.value !== undefined;
                      const valueKey = `${activeSheetIndex}_${rowMeta.index}_${colNum}`;

                      const style = {
                        minHeight: h,
                        height: 'auto',
                        ...cellStyleToCss(cellData),
                        ...(isFrozenColCell ? { position: 'sticky', left: colOffsets[cIdx], zIndex: 10 } : {})
                      };

                      return (
                        <td
                          key={key}
                          rowSpan={span ? span.rowSpan : undefined}
                          colSpan={span ? span.colSpan : undefined}
                          className="border border-slate-200 p-0 bg-white align-top"
                          style={style}
                        >
                          {hasOriginalContent ? (
                            <div className="px-1.5 py-1 text-[11px] text-slate-800 min-h-full flex items-center" style={{ whiteSpace: style.whiteSpace }}>
                              {cellData.value}
                            </div>
                          ) : (
                            <AutoGrowCell
                              value={values[valueKey] || ''}
                              minHeight={h}
                              minWidth={colWidthsZoomed[cIdx]}
                              textAlign={style.textAlign}
                              onChange={(val) => handleValueChange(rowMeta.index, colNum, val)}
                              onNeedWidth={(px) => handleNeedWidth(colNum, px)}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Embedded images, positioned exactly where they anchor in the sheet */}
          {(sheet.images || []).map((img, idx) => {
            const rect = getImageRect(img.anchor, colWidthsZoomed, rowHeightsZoomedArray, ROW_HEADER_WIDTH, zoom);
            if (!rect) return null;
            return (
              <img
                key={idx}
                src={img.src}
                alt=""
                className="absolute pointer-events-none object-contain"
                style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, zIndex: 5 }}
              />
            );
          })}
        </div>

        {/* Sheet tabs */}
        {workbook.sheets.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-2 border-t border-slate-200 bg-slate-50 overflow-x-auto">
            {workbook.sheets.map((s, idx) => (
              <button
                key={s.name + idx}
                onClick={() => setActiveSheetIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  idx === activeSheetIndex ? 'bg-[#00529B] text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-slate-500 px-1">
        <span className="w-3 h-3 rounded bg-sky-50 border border-sky-200 inline-block" />
        Highlighted cells are blank fields for you to fill in — everything else is shown exactly as uploaded.
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2"
        >
          {submitting ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{submitting ? 'Submitting...' : 'Submit Checklist'}</span>
        </button>
      </div>
    </div>
  );
}
