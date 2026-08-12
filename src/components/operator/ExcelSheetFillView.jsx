import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { storageService, getFileUrl } from '../../services/storageService';
import {
  ArrowLeft, Send, CheckCircle2, FileSpreadsheet, ZoomIn, ZoomOut, Maximize2, Download, Loader2
} from 'lucide-react';
import { ROW_HEADER_WIDTH, colLetter, cellStyleToCss, buildMergeMaps, buildImageLayout } from '../../utils/excelGridHelpers';
import { buildFilledWorkbookBlob } from '../../utils/excelParser';

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
  const computed = window.getComputedStyle(el);
  _measureEl.style.font = computed.font;
  _measureEl.style.fontSize = computed.fontSize;
  _measureEl.style.fontFamily = computed.fontFamily;
  _measureEl.style.fontWeight = computed.fontWeight;
  _measureEl.style.letterSpacing = computed.letterSpacing;
  _measureEl.textContent = text || ' ';
  return _measureEl.getBoundingClientRect().width;
}

const MAX_COL_WIDTH = 360;
const CELL_H_PADDING = 18;
const ARROW_DIRECTIONS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

/**
 * Reports this cell's OWN needed width on every change (including 0 when
 * the cell is emptied). The parent takes the max across all cells in a
 * column to decide the column's width — so when the widest cell is
 * cleared, the column can shrink back down again.
 *
 * Click/keyboard behavior mirrors Excel:
 * - Single click / arrow-key move only SELECTS a cell (read-only, focus
 *   ring shown, nothing can be typed yet).
 * - Double-click, Enter, or F2 enters edit mode keeping existing content,
 *   cursor placed at the end.
 * - Typing any regular character while selected clears the cell and
 *   starts editing with that character — no double-click needed.
 * - Delete/Backspace while selected clears the cell without entering
 *   edit mode.
 * - Arrow keys while selected move the selection to the next cell.
 * - Enter while editing commits and moves the selection down a row.
 * - Escape while editing exits edit mode without losing the change.
 */
function AutoGrowCell({
  value, rowNum, colNum, minHeight, textAlign, onChange, onNeedsWidth,
  highlighted, isEditing, onStartEdit, onStopEdit, onNavigate, registerRef,
}) {
  const resizeHeight = (el) => {
    el.style.height = 'auto';
    el.style.height = `${Math.max(minHeight, el.scrollHeight)}px`;
  };

  const growColumn = (el, text) => {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      onNeedsWidth(rowNum, colNum, 0);
      return;
    }
    const neededWidth = Math.ceil(measureTextWidth(text, el)) + CELL_H_PADDING;
    onNeedsWidth(rowNum, colNum, Math.min(MAX_COL_WIDTH, neededWidth));
  };

  const ref = useCallback(
    (el) => {
      registerRef?.(rowNum, colNum, el);
      if (!el) return;
      resizeHeight(el);
      growColumn(el, el.value);
      if (isEditing) {
        // Just switched into edit mode — focus and drop the cursor at the end.
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minHeight, isEditing, rowNum, colNum],
  );

  const handleInput = (e) => {
    const el = e.currentTarget;
    const nextValue = el.value;
    resizeHeight(el);
    growColumn(el, nextValue);
    onChange(nextValue);
  };

  const handleDoubleClick = () => {
    if (!isEditing) onStartEdit(rowNum, colNum);
  };

  const handleBlur = () => {
    if (isEditing) onStopEdit();
  };

  const handleKeyDown = (e) => {
    if (!isEditing) {
      if (e.key === 'Enter' || e.key === 'F2') {
        e.preventDefault();
        onStartEdit(rowNum, colNum);
        return;
      }
      if (ARROW_DIRECTIONS[e.key]) {
        e.preventDefault();
        onNavigate(rowNum, colNum, ARROW_DIRECTIONS[e.key]);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onChange('');
        onNeedsWidth(rowNum, colNum, 0);
        return;
      }
      // Any plain printable character starts editing and replaces the content.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        onStartEdit(rowNum, colNum, e.key);
      }
      return;
    }

    // Editing an already-open cell:
    if (e.key === 'Escape') {
      e.currentTarget.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
      onNavigate(rowNum, colNum, 'down');
    } else if (ARROW_DIRECTIONS[e.key]) {
      // Like Excel: an arrow key while typing commits the entry and moves
      // the selection in that direction, instead of moving the text cursor.
      e.preventDefault();
      e.currentTarget.blur();
      onNavigate(rowNum, colNum, ARROW_DIRECTIONS[e.key]);
    }
    // Other keys (typing, Home/End within the text, etc.) behave normally.
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      readOnly={!isEditing}
      onChange={handleInput}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      wrap="off"
      spellCheck={false}
      style={{
        display: 'block',
        width: '100%',
        minWidth: '100%',
        minHeight,
        height: minHeight,
        padding: '4px 6px',
        textAlign,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        resize: 'none',
        boxSizing: 'border-box',
        cursor: isEditing ? 'text' : 'default',
      }}
      className={
        highlighted
          ? 'block text-[11px] text-slate-800 bg-sky-50 focus:bg-sky-100 outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400 border border-sky-200 shadow-sm'
          : 'block text-[11px] text-slate-800 bg-white focus:bg-sky-50 outline-none focus:ring-2 focus:ring-inset focus:ring-sky-400 border border-transparent hover:border-slate-200'
      }
    />
  );
}

export function ExcelSheetFillView({ currentUser, template, activeShift, onBack }) {
  const workbook = template.gridData;
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [values, setValues] = useState({});

  // Per-cell requested widths: { [sheetIndex]: { "row_col": width } }
  // A column's rendered width is derived as the max across its cells,
  // so clearing a cell (width -> 0/removed) lets the column shrink again.
  const [cellWidths, setCellWidths] = useState({});

  // Which single cell (within the active sheet) is currently editable.
  // Key format: "row_col". Only one cell is ever in edit mode at a time.
  const [editingCellKey, setEditingCellKey] = useState(null);

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

  // Derive each column's max requested width from the individual cell widths
  const colMaxWidths = useMemo(() => {
    const sheetWidths = cellWidths[activeSheetIndex] || {};
    const maxByCol = {};
    Object.keys(sheetWidths).forEach((cellKey) => {
      const colNum = parseInt(cellKey.split('_')[1], 10);
      const w = sheetWidths[cellKey];
      if (!maxByCol[colNum] || w > maxByCol[colNum]) maxByCol[colNum] = w;
    });
    return maxByCol;
  }, [cellWidths, activeSheetIndex]);

  const colWidthsZoomed = useMemo(() => {
    return (sheet?.colWidths || []).map((width, index) => {
      const colNum = index + 1;
      if (hiddenColSet.has(colNum)) return 0;
      const originalWidth = Math.max(48, Math.round(width * zoom));
      const customWidth = colMaxWidths[colNum] || 0;
      return Math.max(originalWidth, customWidth);
    });
  }, [sheet, zoom, hiddenColSet, colMaxWidths]);

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

  // Ordered lists of visible row numbers / column numbers, used for
  // arrow-key navigation (hidden rows/cols are skipped).
  const visibleRowIndices = useMemo(
    () => (sheet?.rows || []).filter(r => !hiddenRowSet.has(r.index)).map(r => r.index),
    [sheet, hiddenRowSet]
  );
  const visibleColNums = useMemo(
    () => (sheet?.colWidths || []).map((_, i) => i + 1).filter(c => !hiddenColSet.has(c)),
    [sheet, hiddenColSet]
  );

  /**
   * Image layout: instead of floating every image over the whole table as
   * a separately-positioned overlay (which always paints on top of cell
   * text underneath it), each image is attached to the cell it anchors to
   * and made to SPAN the cells it covers — like a native Excel merge. The
   * spanned cells are removed from normal rendering (same idea as
   * buildMergeMaps), and the anchor cell renders the image on top with the
   * cell's own text/input shown below it, so nothing gets hidden.
   */
  const imageLayout = useMemo(() => buildImageLayout(sheet), [sheet]);

  // Reverse lookup: covered-by-merge cell key -> the merge's start cell key.
  // Used so arrow-key navigation can land on the actual rendered/focusable
  // cell instead of a merged-away one.
  const mergeCoveredOwner = useMemo(() => {
    const map = {};
    Object.entries(mergeStarts).forEach(([startKey, span]) => {
      const [srStr, scStr] = startKey.split('_');
      const sr = parseInt(srStr, 10);
      const sc = parseInt(scStr, 10);
      for (let r = 0; r < span.rowSpan; r++) {
        for (let c = 0; c < span.colSpan; c++) {
          if (r === 0 && c === 0) continue;
          map[`${sr + r}_${sc + c}`] = startKey;
        }
      }
    });
    return map;
  }, [mergeStarts]);

  // DOM refs for every rendered (focusable) cell, keyed by "row_col".
  // Populated/cleared by each AutoGrowCell via registerRef.
  const cellRefs = useRef(new Map());
  useEffect(() => {
    cellRefs.current.clear();
  }, [activeSheetIndex]);

  const registerCellRef = useCallback((rowNum, colNum, el) => {
    const key = `${rowNum}_${colNum}`;
    if (el) cellRefs.current.set(key, el);
    else cellRefs.current.delete(key);
  }, []);

  const resolveFocusableKey = useCallback((rowNum, colNum) => {
    const key = `${rowNum}_${colNum}`;
    if (coveredCells.has(key)) return mergeCoveredOwner[key] || null;
    if (imageLayout.covered.has(key)) return imageLayout.coveredOwner[key] || null;
    return key;
  }, [coveredCells, mergeCoveredOwner, imageLayout]);

  const handleNavigate = useCallback((rowNum, colNum, direction) => {
    // If the current cell is a merged/image-spanned cell, moving down/right
    // should jump past its FULL span in one step — otherwise the next row/col
    // is still covered by the same span, gets redirected right back to this
    // same cell, and repeated arrow presses appear to zig-zag in place.
    const currentKey = `${rowNum}_${colNum}`;
    const currentSpan = imageLayout.startMap[currentKey] || mergeStarts[currentKey] || null;
    const rowSpan = currentSpan?.rowSpan || 1;
    const colSpan = currentSpan?.colSpan || 1;

    const rowIdx = visibleRowIndices.indexOf(rowNum);
    const colIdx = visibleColNums.indexOf(colNum);
    if (rowIdx === -1 || colIdx === -1) return;

    const maxRowIdx = visibleRowIndices.length - 1;
    const maxColIdx = visibleColNums.length - 1;

    let nextRowIdx = rowIdx;
    let nextColIdx = colIdx;
    if (direction === 'up') nextRowIdx = rowIdx - 1;
    if (direction === 'down') nextRowIdx = rowIdx + rowSpan;
    if (direction === 'left') nextColIdx = colIdx - 1;
    if (direction === 'right') nextColIdx = colIdx + colSpan;

    // Step one cell further in the same direction until we land on a
    // DIFFERENT, actually-registered cell (this absorbs merge/image
    // redirect loops that would otherwise point right back at the
    // current cell — the previous "stuck at edges" bug), or we genuinely
    // run off the sheet, in which case we just stay put.
    while (nextRowIdx >= 0 && nextRowIdx <= maxRowIdx && nextColIdx >= 0 && nextColIdx <= maxColIdx) {
      const candidateRow = visibleRowIndices[nextRowIdx];
      const candidateCol = visibleColNums[nextColIdx];
      const targetKey = resolveFocusableKey(candidateRow, candidateCol);
      const targetEl = targetKey ? cellRefs.current.get(targetKey) : null;

      if (targetEl && targetKey !== currentKey) {
        targetEl.focus();
        return;
      }

      if (direction === 'up') nextRowIdx -= 1;
      else if (direction === 'down') nextRowIdx += 1;
      else if (direction === 'left') nextColIdx -= 1;
      else if (direction === 'right') nextColIdx += 1;
      else break;
    }
    // Ran off the edge of the sheet in this direction — nothing further to
    // focus, so the selection simply stays where it is.
  }, [visibleRowIndices, visibleColNums, resolveFocusableKey, imageLayout, mergeStarts]);

  const handleValueChange = useCallback((r, c, val) => {
    setValues((prev) => ({ ...prev, [`${activeSheetIndex}_${r}_${c}`]: val }));
  }, [activeSheetIndex]);

  const handleCellNeedsWidth = useCallback(
    (rowNum, colNum, width) => {
      setCellWidths((prev) => {
        const sheetWidths = prev[activeSheetIndex] || {};
        const cellKey = `${rowNum}_${colNum}`;

        if (width <= 0) {
          // Cell is empty — remove its entry entirely so it no longer
          // contributes to the column's max width.
          if (!(cellKey in sheetWidths)) return prev;
          const nextSheetWidths = { ...sheetWidths };
          delete nextSheetWidths[cellKey];
          return { ...prev, [activeSheetIndex]: nextSheetWidths };
        }

        if (sheetWidths[cellKey] === width) return prev;
        return {
          ...prev,
          [activeSheetIndex]: { ...sheetWidths, [cellKey]: width },
        };
      });
    },
    [activeSheetIndex],
  );

  const handleStartEdit = useCallback((rowNum, colNum, initialChar) => {
    setEditingCellKey(`${rowNum}_${colNum}`);
    if (initialChar !== undefined) {
      handleValueChange(rowNum, colNum, initialChar);
    }
  }, [handleValueChange]);

  const handleStopEdit = useCallback(() => {
    setEditingCellKey(null);
  }, []);

  const handleSelectSheet = (idx) => {
    setEditingCellKey(null); // leave edit mode when switching sheets
    setActiveSheetIndex(idx);
  };

  const [savedFilePath, setSavedFilePath] = useState(null);

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');

    // Build the final answer set: start from every original cell's value
    // (so unedited original text is preserved), then layer the user's
    // edits — including edits made to originally-filled cells — on top.
    const gridAnswers = { ...values };
    (workbook.sheets || []).forEach((s, sIdx) => {
      Object.keys(s.cells || {}).forEach((cellKey) => {
        const cellData = s.cells[cellKey];
        const hasOriginalContent = cellData && cellData.value !== '' && cellData.value !== undefined;
        if (!hasOriginalContent) return;
        const valueKey = `${sIdx}_${cellKey}`;
        if (gridAnswers[valueKey] === undefined) {
          gridAnswers[valueKey] = cellData.value;
        }
      });
    });

    const payload = {
      templateId: template.id,
      templateTitle: template.title,
      docNumber: template.docNumber,
      revision: template.revision,
      shift: activeShift || 'Shift A',
      operatorName: currentUser?.name || 'Operator',
      operatorNTID: currentUser?.ntid || '',
      gridAnswers
    };
    try {
      const allSubmissions = await storageService.saveSubmission(payload);
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
    if (savedFilePath) {
      const a = document.createElement('a');
      a.href = getFileUrl(savedFilePath);
      a.download = `${(template.title || 'checklist').replace(/[^a-z0-9]+/gi, '_')}_filled.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }

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
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => setZoom(z => Math.max(0, Number((z - 0.1).toFixed(2))))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(zoom * 100)}
            onChange={(e) => setZoom(Number(e.target.value) / 100)}
            className="w-28 accent-[#00529B] cursor-pointer"
            aria-label="Zoom"
          />
          <span className="text-xs font-mono text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1, Number((z + 0.1).toFixed(2))))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
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
          <table
            className="border-collapse"
            style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
          >
            <colgroup>
              <col style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH }} />
              {colWidthsZoomed.map((w, i) => {
                const colNum = i + 1;
                if (hiddenColSet.has(colNum)) return null;
                return <col key={colNum} style={{ width: w, minWidth: w }} />;
              })}
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
                      if (coveredCells.has(key) || imageLayout.covered.has(key)) return null;

                      const cellData = sheet.cells[key];
                      const mergeSpan = mergeStarts[key];
                      const imageSpan = imageLayout.startMap[key];
                      const isFrozenColCell = colNum <= xSplit;
                      const hasOriginalContent = cellData && cellData.value !== '' && cellData.value !== undefined;
                      const valueKey = `${activeSheetIndex}_${rowMeta.index}_${colNum}`;
                      const isEditing = editingCellKey === key;

                      // Controlled value: whatever the user typed, falling
                      // back to the original sheet's content on first render.
                      const cellValue = values[valueKey] !== undefined
                        ? values[valueKey]
                        : (hasOriginalContent ? cellData.value : '');

                      const effectiveRowSpan = imageSpan ? imageSpan.rowSpan : (mergeSpan ? mergeSpan.rowSpan : undefined);
                      const effectiveColSpan = imageSpan ? imageSpan.colSpan : (mergeSpan ? mergeSpan.colSpan : undefined);

                      const style = {
                        minHeight: h,
                        height: 'auto',
                        ...cellStyleToCss(cellData),
                        ...(isFrozenColCell ? { position: 'sticky', left: colOffsets[cIdx], zIndex: 10 } : {})
                      };

                      // Total pixel height/width this cell actually spans
                      // (sums across merged/image-spanned rows & columns),
                      // used to size the image area and reserve room below
                      // it for the cell's text.
                      let totalHeight = h;
                      let totalWidth = colWidthsZoomed[cIdx] || 0;
                      if (imageSpan) {
                        totalHeight = 0;
                        for (let r = 0; r < imageSpan.rowSpan; r++) {
                          totalHeight += rowHeightsZoomedArray[imageSpan.startRowIdx + r] || 0;
                        }
                        totalWidth = 0;
                        for (let c = 0; c < imageSpan.colSpan; c++) {
                          totalWidth += colWidthsZoomed[imageSpan.startColIdx + c] || 0;
                        }
                      }

                      // The image's own display height. `pxHeight * zoom` can
                      // round down to 0 at low zoom levels (e.g. 0%), which
                      // would make the image invisible — so it's floored to
                      // stay visible at every zoom level from 0% to 100%.
                      const imgAreaHeight = imageSpan
                        ? (imageSpan.pxHeight
                          ? Math.min(Math.max(20, Math.round(imageSpan.pxHeight * zoom)), Math.max(20, totalHeight - 28))
                          : Math.max(20, Math.round(totalHeight * 0.72)))
                        : 0;

                      return (
                        <td
                          key={key}
                          rowSpan={effectiveRowSpan}
                          colSpan={effectiveColSpan}
                          className="border border-slate-200 p-0 bg-white align-top"
                          style={style}
                        >
                          {imageSpan ? (
                            <div className="flex flex-col w-full h-full" style={{ minHeight: totalHeight }}>
                              <div
                                className="flex items-center justify-center overflow-hidden shrink-0"
                                style={{
                                  width: totalWidth,
                                  height: imgAreaHeight,
                                }}
                              >
                                <img
                                  src={imageSpan.image.src}
                                  alt=""
                                  className="max-w-full max-h-full object-contain"
                                />
                              </div>
                              <div className="flex-1 min-h-0">
                                <AutoGrowCell
                                  value={cellValue}
                                  rowNum={rowMeta.index}
                                  colNum={colNum}
                                  minHeight={Math.max(22, totalHeight - imgAreaHeight)}
                                  textAlign={style.textAlign}
                                  onChange={(val) => handleValueChange(rowMeta.index, colNum, val)}
                                  onNeedsWidth={handleCellNeedsWidth}
                                  highlighted={!hasOriginalContent}
                                  isEditing={isEditing}
                                  onStartEdit={handleStartEdit}
                                  onStopEdit={handleStopEdit}
                                  onNavigate={handleNavigate}
                                  registerRef={registerCellRef}
                                />
                              </div>
                            </div>
                          ) : (
                            <AutoGrowCell
                              value={cellValue}
                              rowNum={rowMeta.index}
                              colNum={colNum}
                              minHeight={h}
                              textAlign={style.textAlign}
                              onChange={(val) => handleValueChange(rowMeta.index, colNum, val)}
                              onNeedsWidth={handleCellNeedsWidth}
                              highlighted={!hasOriginalContent}
                              isEditing={isEditing}
                              onStartEdit={handleStartEdit}
                              onStopEdit={handleStopEdit}
                              onNavigate={handleNavigate}
                              registerRef={registerCellRef}
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
        </div>

        {/* Sheet tabs */}
        {workbook.sheets.length > 1 && (
          <div className="flex items-center gap-1 px-3 py-2 border-t border-slate-200 bg-slate-50 overflow-x-auto">
            {workbook.sheets.map((s, idx) => (
              <button
                key={s.name + idx}
                onClick={() => handleSelectSheet(idx)}
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

      <div className="flex items-center gap-3 text-xs text-slate-500 px-1 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-sky-50 border border-sky-200 inline-block" />
          Blank fields for you to fill in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" />
          Original content — click to edit if it needs a correction
        </span>
        <span className="text-slate-400">Click a cell then type, or use arrow keys to move · Enter/F2 to edit · Esc to stop</span>
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
