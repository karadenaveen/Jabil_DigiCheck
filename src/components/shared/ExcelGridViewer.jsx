import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X, Search, ZoomIn, ZoomOut, ChevronUp, ChevronDown,
  FileSpreadsheet, Snowflake, Maximize2, ImagePlus, Save, Loader2, Trash2
} from 'lucide-react';
import { ROW_HEADER_WIDTH, colLetter, cellStyleToCss, buildMergeMaps, buildImageLayout } from '../../utils/excelGridHelpers';
import { storageService } from '../../services/storageService';

export function ExcelGridViewer({ isOpen, onClose, workbook, title, templateId, onSaved }) {
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState(null);

  // Local editable copy — lets "Add Image" work immediately in the UI;
  // "Save Changes" persists it back to the template via the API.
  const [localWorkbook, setLocalWorkbook] = useState(workbook);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [showAddImage, setShowAddImage] = useState(false);
  const [addImageForm, setAddImageForm] = useState({ col: 1, row: 1, file: null });
  const [addImageError, setAddImageError] = useState('');

  useEffect(() => {
    setLocalWorkbook(workbook);
    setIsDirty(false);
  }, [workbook]);

  const scrollRef = useRef(null);
  const cellRefs = useRef({});

  useEffect(() => {
    setActiveSheetIndex(0);
    setSearchTerm('');
    setMatchIndex(0);
    setSelectedCell(null);
    setZoom(1);
  }, [workbook]);

  const sheet = localWorkbook?.sheets?.[activeSheetIndex] || null;

  const hiddenColSet = useMemo(() => new Set(sheet?.hiddenCols || []), [sheet]);
  const hiddenRowSet = useMemo(() => {
    const s = new Set();
    (sheet?.rows || []).forEach(r => { if (r.hidden) s.add(r.index); });
    return s;
  }, [sheet]);

  // Merge lookup: top-left "r_c" -> {rowSpan, colSpan}; covered cells to skip
  const { mergeStarts, coveredCells } = useMemo(() => buildMergeMaps(sheet), [sheet]);

  // Image layout: each image spans the cells it anchors over (like a native
  // Excel merge) instead of floating as a separately-positioned overlay —
  // keeps images contained inside their own cell/column instead of
  // drifting over unrelated columns.
  const imageLayout = useMemo(() => buildImageLayout(sheet), [sheet]);

  // Zoomed pixel dimensions — hidden columns/rows contribute 0px here,
  // matching the fact that they're skipped entirely in the rendered table.
  // (Getting this wrong is what caused images to land in the wrong spot
  // whenever a sheet had any hidden helper columns/rows before them.)
  const colWidthsZoomed = useMemo(
    () => (sheet?.colWidths || []).map((w, i) => hiddenColSet.has(i + 1) ? 0 : Math.max(48, Math.round(w * zoom))),
    [sheet, zoom, hiddenColSet]
  );
  const rowHeightZoomed = useCallback(
    (baseHeight) => Math.max(22, Math.round(baseHeight * zoom)),
    [zoom]
  );

  // Cumulative offsets for frozen columns/rows (for sticky positioning)
  const colOffsets = useMemo(() => {
    const offsets = [ROW_HEADER_WIDTH];
    for (let i = 0; i < colWidthsZoomed.length; i++) {
      offsets.push(offsets[i] + colWidthsZoomed[i]);
    }
    return offsets;
  }, [colWidthsZoomed]);

  const headerRowHeight = rowHeightZoomed(24);
  const rowOffsets = useMemo(() => {
    const offsets = [headerRowHeight];
    (sheet?.rows || []).forEach((r) => {
      const h = hiddenRowSet.has(r.index) ? 0 : rowHeightZoomed(r.height);
      offsets.push(offsets[offsets.length - 1] + h);
    });
    return offsets;
  }, [sheet, hiddenRowSet, rowHeightZoomed, headerRowHeight]);

  const xSplit = sheet?.frozen?.xSplit || 0;
  const ySplit = sheet?.frozen?.ySplit || 0;

  const rowHeightsZoomedArray = useMemo(
    () => (sheet?.rows || []).map(r => r.hidden ? 0 : rowHeightZoomed(r.height)),
    [sheet, rowHeightZoomed]
  );

  // Search matches within the active sheet
  const matches = useMemo(() => {
    if (!searchTerm.trim() || !sheet) return [];
    const term = searchTerm.toLowerCase();
    const found = [];
    Object.entries(sheet.cells).forEach(([key, cellData]) => {
      if (cellData.value !== '' && String(cellData.value).toLowerCase().includes(term)) {
        const [r, c] = key.split('_').map(Number);
        found.push({ r, c });
      }
    });
    found.sort((a, b) => (a.r - b.r) || (a.c - b.c));
    return found;
  }, [searchTerm, sheet]);

  useEffect(() => { setMatchIndex(0); }, [searchTerm]);

  useEffect(() => {
    if (matches.length === 0) return;
    const m = matches[matchIndex % matches.length];
    const key = `${m.r}_${m.c}`;
    const el = cellRefs.current[key];
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ block: 'center', inline: 'center' });
    }
  }, [matchIndex, matches]);

  const letterToColNum = (letters) => {
    let n = 0;
    for (const ch of letters.toUpperCase().trim()) {
      if (ch < 'A' || ch > 'Z') return null;
      n = n * 26 + (ch.charCodeAt(0) - 64);
    }
    return n || null;
  };

  const handleAddImage = () => {
    setAddImageError('');
    const colNum = letterToColNum(String(addImageForm.col));
    const rowNum = parseInt(addImageForm.row, 10);

    if (!colNum) { setAddImageError('Enter a valid column letter (e.g. F).'); return; }
    if (!rowNum || rowNum < 1) { setAddImageError('Enter a valid row number.'); return; }
    if (!addImageForm.file) { setAddImageError('Choose an image file.'); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const match = /^data:image\/(\w+);base64,/.exec(dataUrl);
      const extension = match ? (match[1] === 'jpg' ? 'jpeg' : match[1]) : 'png';

      const newImage = {
        src: dataUrl,
        extension,
        anchor: { fromCol: colNum - 1, fromRow: rowNum - 1, extPx: { width: 100, height: 80 } },
        range: { tl: { col: colNum - 1, row: rowNum - 1 }, ext: { width: 100, height: 80 }, editAs: 'oneCell' }
      };

      setLocalWorkbook((prev) => {
        const sheets = prev.sheets.map((s, idx) =>
          idx === activeSheetIndex ? { ...s, images: [...(s.images || []), newImage] } : s
        );
        return { ...prev, sheets };
      });
      setIsDirty(true);
      setShowAddImage(false);
      setAddImageForm({ col: 1, row: 1, file: null });
    };
    reader.onerror = () => setAddImageError('Could not read that image file.');
    reader.readAsDataURL(addImageForm.file);
  };

  const handleRemoveImage = (imgIdx) => {
    setLocalWorkbook((prev) => {
      const sheets = prev.sheets.map((s, idx) =>
        idx === activeSheetIndex ? { ...s, images: s.images.filter((_, i) => i !== imgIdx) } : s
      );
      return { ...prev, sheets };
    });
    setIsDirty(true);
  };

  const handleSaveChanges = async () => {
    if (!templateId) return;
    setSaving(true);
    setSaveError('');
    try {
      const updated = await storageService.updateTemplateGridData(templateId, localWorkbook);
      setIsDirty(false);
      if (onSaved) onSaved(updated);
    } catch (err) {
      setSaveError('Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const hasWorkbook = localWorkbook && Array.isArray(localWorkbook.sheets) && localWorkbook.sheets.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-[96vw] h-[92vh] flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-[#00529B] shrink-0" />
            <span className="truncate">{title || 'Excel Preview'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!hasWorkbook ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <FileSpreadsheet className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-600">Excel preview data not available</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">
              High-fidelity grid preview is available right after uploading a new file.
              Templates saved before this feature don't have the raw grid stored.
            </p>
          </div>
        ) : (
          <>
            {/* Toolbar: search + zoom + cell reference + frozen indicator */}
            <div className="px-4 py-2 border-b border-slate-200 flex flex-wrap items-center gap-3 bg-white shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search cells..."
                  className="pl-8 pr-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              {searchTerm.trim() && (
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                  <span>{matches.length > 0 ? `${(matchIndex % matches.length) + 1}/${matches.length}` : '0/0'}</span>
                  <button
                    disabled={matches.length === 0}
                    onClick={() => setMatchIndex((i) => (i - 1 + matches.length) % matches.length)}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={matches.length === 0}
                    onClick={() => setMatchIndex((i) => (i + 1) % matches.length)}
                    className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.1).toFixed(2))))}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
                  title="Reset zoom"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {(xSplit > 0 || ySplit > 0) && (
                <div className="flex items-center gap-1 text-[11px] text-sky-700 bg-sky-50 border border-sky-200 px-2 py-1 rounded-full">
                  <Snowflake className="w-3 h-3" />
                  Panes frozen
                </div>
              )}

              {templateId && (
                <button
                  onClick={() => setShowAddImage((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1.5 rounded-lg transition"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  Add Image
                </button>
              )}

              {templateId && isDirty && (
                <button
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-2.5 py-1.5 rounded-lg shadow-sm transition"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}

              <div className="ml-auto text-[11px] font-mono text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                {selectedCell ? `Cell: ${colLetter(selectedCell.c)}${selectedCell.r}` : 'No cell selected'}
              </div>
            </div>

            {saveError && (
              <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 shrink-0">{saveError}</div>
            )}

            {/* Add Image inline form */}
            {showAddImage && (
              <div className="px-4 py-3 border-b border-slate-200 bg-indigo-50/50 shrink-0 flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Column Letter</label>
                  <input
                    type="text"
                    value={addImageForm.col}
                    onChange={(e) => setAddImageForm((f) => ({ ...f, col: e.target.value }))}
                    placeholder="e.g. F"
                    className="w-20 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Row Number</label>
                  <input
                    type="number"
                    min="1"
                    value={addImageForm.row}
                    onChange={(e) => setAddImageForm((f) => ({ ...f, row: e.target.value }))}
                    className="w-24 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Image File</label>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/gif"
                    onChange={(e) => setAddImageForm((f) => ({ ...f, file: e.target.files[0] }))}
                    className="text-xs"
                  />
                </div>
                <button
                  onClick={handleAddImage}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
                >
                  Insert
                </button>
                {addImageError && <span className="text-xs text-rose-600 font-medium">{addImageError}</span>}
              </div>
            )}

            {/* Grid */}
            <div ref={scrollRef} className="flex-1 overflow-auto relative bg-slate-100">
              <table
                className="border-collapse"
                style={{ tableLayout: 'fixed' }}
              >
                <colgroup>
                  <col style={{ width: ROW_HEADER_WIDTH }} />
                  {colWidthsZoomed.map((w, i) => (
                    !hiddenColSet.has(i + 1) && <col key={i} style={{ width: w }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      className="sticky bg-slate-200 border border-slate-300 text-[10px] text-slate-500"
                      style={{ top: 0, left: 0, position: 'sticky', height: headerRowHeight, zIndex: 40 }}
                    />
                    {(sheet.colWidths || []).map((_, i) => {
                      const colNum = i + 1;
                      if (hiddenColSet.has(colNum)) return null;
                      const isFrozenCol = colNum <= xSplit;
                      return (
                        <th
                          key={colNum}
                          className="sticky bg-slate-200 border border-slate-300 text-[10px] font-semibold text-slate-600"
                          style={{
                            top: 0,
                            left: isFrozenCol ? colOffsets[i] : undefined,
                            position: 'sticky',
                            height: headerRowHeight,
                            zIndex: isFrozenCol ? 35 : 30
                          }}
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
                    const isFrozenRow = rowMeta.index <= ySplit;
                    const h = rowHeightZoomed(rowMeta.height);
                    return (
                      <tr key={rowMeta.index}>
                        <td
                          className="sticky z-20 bg-slate-200 border border-slate-300 text-center text-[10px] font-semibold text-slate-600"
                          style={{
                            left: 0,
                            top: isFrozenRow ? rowOffsets[rIdx] : undefined,
                            position: 'sticky',
                            height: h
                          }}
                        >
                          {rowMeta.index}
                        </td>
                        {(sheet.colWidths || []).map((_, cIdx) => {
                          const colNum = cIdx + 1;
                          if (hiddenColSet.has(colNum)) return null;
                          const key = `${rowMeta.index}_${colNum}`;
                          if (coveredCells.has(key) || imageLayout.covered.has(key)) return null;

                          const cellData = sheet.cells[key];
                          const span = mergeStarts[key];
                          const imageSpan = imageLayout.startMap[key];
                          const isSelected = selectedCell && selectedCell.r === rowMeta.index && selectedCell.c === colNum;
                          const isMatch = matches.some(m => m.r === rowMeta.index && m.c === colNum);
                          const isCurrentMatch = matches.length > 0 && matches[matchIndex % matches.length].r === rowMeta.index && matches[matchIndex % matches.length].c === colNum;

                          const isFrozenColCell = colNum <= xSplit;
                          const isFrozenRowCell = rowMeta.index <= ySplit;

                          const effectiveRowSpan = imageSpan ? imageSpan.rowSpan : (span ? span.rowSpan : undefined);
                          const effectiveColSpan = imageSpan ? imageSpan.colSpan : (span ? span.colSpan : undefined);

                          const style = {
                            height: imageSpan ? undefined : h,
                            ...cellStyleToCss(cellData),
                            ...(isFrozenColCell ? { position: 'sticky', left: colOffsets[cIdx], zIndex: 10 } : {}),
                            ...(isFrozenRowCell ? { position: 'sticky', top: rowOffsets[rIdx], zIndex: isFrozenColCell ? 15 : 10 } : {}),
                          };

                          if (isMatch) style.backgroundColor = isCurrentMatch ? '#fbbf24' : '#fef3c7';

                          // Total pixel height/width this cell spans (sums
                          // across image-spanned rows & columns), used to
                          // size the image area and reserve room below it
                          // for the cell's own text.
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

                          const imgAreaHeight = imageSpan
                            ? (imageSpan.pxHeight
                              ? Math.min(Math.max(20, Math.round(imageSpan.pxHeight * zoom)), Math.max(20, totalHeight - 20))
                              : Math.max(20, Math.round(totalHeight * 0.72)))
                            : 0;

                          return (
                            <td
                              key={key}
                              ref={(el) => { cellRefs.current[key] = el; }}
                              rowSpan={effectiveRowSpan}
                              colSpan={effectiveColSpan}
                              onClick={() => setSelectedCell({ r: rowMeta.index, c: colNum })}
                              className={`border border-slate-200 p-0 text-[11px] text-slate-800 bg-white cursor-cell align-top ${
                                isSelected ? 'ring-2 ring-inset ring-sky-500' : ''
                              }`}
                              style={style}
                              title={cellData && cellData.value !== '' ? String(cellData.value) : ''}
                            >
                              {imageSpan ? (
                                <div className="flex flex-col w-full h-full group relative" style={{ minHeight: totalHeight }}>
                                  <div
                                    className="flex items-center justify-center overflow-hidden shrink-0"
                                    style={{ width: totalWidth, height: imgAreaHeight }}
                                  >
                                    <img src={imageSpan.image.src} alt="" className="max-w-full max-h-full object-contain pointer-events-none" />
                                  </div>
                                  {templateId && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const idx = (sheet.images || []).indexOf(imageSpan.image);
                                        if (idx !== -1) handleRemoveImage(idx);
                                      }}
                                      title="Remove this image"
                                      className="absolute top-0.5 right-0.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white shadow"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  <div className="flex-1 min-h-0 px-1.5 py-0.5">
                                    {cellData ? cellData.value : ''}
                                  </div>
                                </div>
                              ) : (
                                <div className="px-1.5" style={{ height: h }}>
                                  {cellData ? cellData.value : ''}
                                </div>
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
            <div className="flex items-center gap-1 px-3 py-2 border-t border-slate-200 bg-slate-50 overflow-x-auto shrink-0">
              {localWorkbook.sheets.map((s, idx) => (
                <button
                  key={s.name + idx}
                  onClick={() => setActiveSheetIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    idx === activeSheetIndex
                      ? 'bg-[#00529B] text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
