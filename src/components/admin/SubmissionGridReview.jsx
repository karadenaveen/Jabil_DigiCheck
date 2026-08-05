import React, { useState, useMemo } from 'react';
import { X, FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { ROW_HEADER_WIDTH, colLetter, cellStyleToCss, buildMergeMaps, getImageRect } from '../../utils/excelGridHelpers';
import { buildFilledWorkbookBlob } from '../../utils/excelParser';
import { getFileUrl } from '../../services/storageService';

export function SubmissionGridReview({ isOpen, onClose, workbook, answers, title, docNumber, filledExcelPath }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  const sheet = workbook?.sheets?.[activeSheetIndex] || null;
  const { mergeStarts, coveredCells } = useMemo(() => buildMergeMaps(sheet), [sheet]);
  const hiddenColSet = useMemo(() => new Set(sheet?.hiddenCols || []), [sheet]);
  const hiddenRowSet = useMemo(() => {
    const s = new Set();
    (sheet?.rows || []).forEach(r => { if (r.hidden) s.add(r.index); });
    return s;
  }, [sheet]);

  const colWidthsEffective = useMemo(
    () => (sheet?.colWidths || []).map((w, i) => hiddenColSet.has(i + 1) ? 0 : w),
    [sheet, hiddenColSet]
  );

  const colOffsets = useMemo(() => {
    const offsets = [ROW_HEADER_WIDTH];
    colWidthsEffective.forEach((w) => offsets.push(offsets[offsets.length - 1] + w));
    return offsets;
  }, [colWidthsEffective]);

  const xSplit = sheet?.frozen?.xSplit || 0;
  const rowHeightsArray = useMemo(() => (sheet?.rows || []).map(r => r.hidden ? 0 : r.height), [sheet]);

  const handleDownload = async () => {
    // Prefer the real file already saved on disk for this submission.
    if (filledExcelPath) {
      const a = document.createElement('a');
      a.href = getFileUrl(filledExcelPath);
      a.download = `${(title || 'checklist').replace(/[^a-z0-9]+/gi, '_')}_filled.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

    // Fallback: regenerate on the fly (older submissions saved before the
    // on-disk file feature existed).
    setDownloading(true);
    setDownloadError('');
    try {
      const blob = await buildFilledWorkbookBlob(workbook, answers || {});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title || 'checklist').replace(/[^a-z0-9]+/gi, '_')}_filled.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError('Could not generate the Excel file. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  const hasWorkbook = workbook && Array.isArray(workbook.sheets) && workbook.sheets.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[96vw] h-[90vh] flex flex-col overflow-hidden">

        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-[#00529B] shrink-0" />
            <span className="truncate">{title} {docNumber ? `· ${docNumber}` : ''}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasWorkbook && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {downloading ? 'Preparing...' : 'Download Filled Excel'}
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {downloadError && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 shrink-0">{downloadError}</div>
        )}

        {!hasWorkbook ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">Original Excel grid not available</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              This submission's template was uploaded before the exact-grid feature was added.
            </p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-auto relative bg-slate-100">
              <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: ROW_HEADER_WIDTH }} />
                  {(sheet.colWidths || []).map((w, i) => (!hiddenColSet.has(i + 1) && <col key={i} style={{ width: w }} />))}
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky bg-slate-200 border border-slate-300" style={{ top: 0, left: 0, position: 'sticky', height: 24, zIndex: 40 }} />
                    {(sheet.colWidths || []).map((_, i) => {
                      const colNum = i + 1;
                      if (hiddenColSet.has(colNum)) return null;
                      const isFrozenCol = colNum <= xSplit;
                      return (
                        <th
                          key={colNum}
                          className="sticky bg-slate-200 border border-slate-300 text-[10px] font-semibold text-slate-600"
                          style={{ top: 0, left: isFrozenCol ? colOffsets[i] : undefined, position: 'sticky', height: 24, zIndex: isFrozenCol ? 35 : 30 }}
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
                    return (
                      <tr key={rowMeta.index}>
                        <td className="sticky bg-slate-200 border border-slate-300 text-center text-[10px] font-semibold text-slate-600" style={{ left: 0, position: 'sticky', height: rowMeta.height, zIndex: 20 }}>
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
                          const hasOriginal = cellData && cellData.value !== '' && cellData.value !== undefined;
                          const answerKey = `${activeSheetIndex}_${rowMeta.index}_${colNum}`;
                          const answerValue = answers ? answers[answerKey] : undefined;

                          const style = {
                            height: rowMeta.height,
                            ...cellStyleToCss(cellData),
                            ...(isFrozenColCell ? { position: 'sticky', left: colOffsets[cIdx], zIndex: 10 } : {})
                          };

                          const isFilledAnswer = !hasOriginal && answerValue;
                          if (isFilledAnswer) {
                            style.backgroundColor = '#eff6ff';
                            style.color = '#00529B';
                            style.fontWeight = 600;
                          }

                          return (
                            <td
                              key={key}
                              rowSpan={span ? span.rowSpan : undefined}
                              colSpan={span ? span.colSpan : undefined}
                              className="border border-slate-200 px-1.5 text-[11px] bg-white"
                              style={style}
                            >
                              {hasOriginal ? cellData.value : (answerValue || '')}
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
                const rect = getImageRect(img.anchor, colWidthsEffective, rowHeightsArray);
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

            <div className="flex items-center gap-1 px-3 py-2 border-t border-slate-200 bg-slate-50 overflow-x-auto shrink-0">
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
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-500 px-2">
                <span className="w-2.5 h-2.5 rounded bg-blue-50 border border-blue-200 inline-block" />
                Operator-filled values
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
