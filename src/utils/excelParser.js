/**
 * High-fidelity Excel workbook parser
 * --------------------------------------------------------------------
 * Uses ExcelJS (already a project dependency) to extract an Excel workbook
 * as close to "exactly as it appears" as the browser can reasonably
 * reproduce: real cell values (formula results, not formula text), merged
 * cell ranges, column widths, row heights, frozen panes, hidden rows/
 * columns, per-cell styling (font, fill, borders, alignment/wrap), and
 * any embedded images.
 *
 * This module NEVER fabricates content. If a cell has no value, or a
 * style/property can't be read, the corresponding field is simply left
 * blank/undefined — callers should render blanks, not placeholder text.
 */

import ExcelJS from 'exceljs';

const EXCEL_COL_WIDTH_TO_PX = 8.2;  // approximate Excel "character width" -> px (was 7.5 — bumped for larger cells)
const DEFAULT_COL_WIDTH_PX = 110;   // was 88
const DEFAULT_ROW_HEIGHT_PX = 28;   // was 22
const PT_TO_PX = 1.333;
const MIN_COL_WIDTH_PX = 90;        // never render a column unreadably thin (was 60)
const MIN_ROW_HEIGHT_PX = 24;       // never render a row unreadably short

function argbToCss(argb) {
  if (!argb || typeof argb !== 'string') return null;
  // ExcelJS ARGB strings are 8 hex chars: AARRGGBB
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  if (hex.length !== 6) return null;
  return `#${hex}`;
}

function readFill(cell) {
  const fill = cell.fill;
  if (!fill) return null;
  if (fill.type === 'pattern' && fill.pattern === 'solid' && fill.fgColor) {
    return argbToCss(fill.fgColor.argb);
  }
  return null;
}

function readFont(cell) {
  const font = cell.font;
  if (!font) return {};
  return {
    bold: !!font.bold,
    italic: !!font.italic,
    underline: !!font.underline,
    strike: !!font.strike,
    size: font.size || null,
    color: font.color ? argbToCss(font.color.argb) : null,
    name: font.name || null
  };
}

function readBorders(cell) {
  const b = cell.border;
  if (!b) return null;
  const side = (edge) => {
    if (!edge || !edge.style) return null;
    return {
      style: edge.style,
      color: edge.color ? argbToCss(edge.color.argb) || '#000000' : '#000000'
    };
  };
  const result = {
    top: side(b.top),
    bottom: side(b.bottom),
    left: side(b.left),
    right: side(b.right)
  };
  if (!result.top && !result.bottom && !result.left && !result.right) return null;
  return result;
}

function readAlignment(cell) {
  const a = cell.alignment;
  if (!a) return {};
  return {
    horizontal: a.horizontal || null,
    vertical: a.vertical || null,
    wrapText: !!a.wrapText,
    textRotation: a.textRotation || 0,
    indent: a.indent || 0
  };
}

/**
 * Reads the actual displayed value of a cell. For formulas, returns the
 * cached result (what Excel last displayed) rather than the formula text.
 * Returns '' (blank) for empty/unreadable cells — never invented text.
 */
function readDisplayValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';

  // Formula cell — use cached result if present
  if (typeof v === 'object' && 'formula' in v) {
    if (v.result !== undefined && v.result !== null) {
      if (typeof v.result === 'object' && v.result.error) return `#${v.result.error}`;
      return v.result;
    }
    return '';
  }

  // Rich text runs — concatenate the real text pieces
  if (typeof v === 'object' && Array.isArray(v.richText)) {
    return v.richText.map(r => r.text).join('');
  }

  // Hyperlink object
  if (typeof v === 'object' && 'text' in v && 'hyperlink' in v) {
    return v.text;
  }

  // Date
  if (v instanceof Date) {
    return v.toLocaleDateString();
  }

  return v;
}

export async function parseWorkbookFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheets = [];

  workbook.eachSheet((worksheet) => {
    const rowCount = worksheet.rowCount || 0;
    const colCount = worksheet.columnCount || 0;

    // Column widths (real, from the file — fall back to Excel's own default
    // only when a column truly has no width recorded, never a guess).
    const colWidths = [];
    for (let c = 1; c <= colCount; c++) {
      const col = worksheet.getColumn(c);
      const width = col.width ? Math.round(col.width * EXCEL_COL_WIDTH_TO_PX) : DEFAULT_COL_WIDTH_PX;
      colWidths.push(Math.max(MIN_COL_WIDTH_PX, width));
    }

    const hiddenCols = [];
    for (let c = 1; c <= colCount; c++) {
      if (worksheet.getColumn(c).hidden) hiddenCols.push(c);
    }

    // Frozen panes
    let frozen = { xSplit: 0, ySplit: 0 };
    const view = (worksheet.views && worksheet.views[0]) || null;
    if (view && view.state === 'frozen') {
      frozen = { xSplit: view.xSplit || 0, ySplit: view.ySplit || 0 };
    }

    // Merges — ExcelJS exposes the merge map on the worksheet model
    const merges = [];
    const mergeModel = (worksheet.model && worksheet.model.merges) || [];
    mergeModel.forEach((range) => merges.push(range));

    const rows = [];
    const cellsMap = {};

    for (let r = 1; r <= rowCount; r++) {
      const row = worksheet.getRow(r);
      const height = row.height ? Math.round(row.height * PT_TO_PX) : DEFAULT_ROW_HEIGHT_PX;
      rows.push({ index: r, height: Math.max(MIN_ROW_HEIGHT_PX, height), hidden: !!row.hidden });

      for (let c = 1; c <= colCount; c++) {
        const cell = row.getCell(c);
        const value = readDisplayValue(cell);
        // Skip truly empty, unstyled cells to keep payload size sane —
        // still fully faithful since a missing key renders as blank.
        const fill = readFill(cell);
        const font = readFont(cell);
        const border = readBorders(cell);
        const alignment = readAlignment(cell);
        const hasContent = value !== '' && value !== null && value !== undefined;
        const hasStyle = fill || border || font.bold || font.italic || font.color || alignment.wrapText;

        if (hasContent || hasStyle) {
          cellsMap[`${r}_${c}`] = {
            value: hasContent ? value : '',
            fill: fill || null,
            font,
            border,
            alignment
          };
        }
      }
    }

    // Embedded images, positioned by their real anchor range so they land
    // in the correct spot (not just stacked at the top-left corner).
    const images = [];
    try {
      const sheetImages = worksheet.getImages ? worksheet.getImages() : [];
      sheetImages.forEach((img) => {
        const media = workbook.model.media.find((m) => m.index === img.imageId);
        if (media && media.buffer) {
          const base64 = typeof Buffer !== 'undefined'
            ? Buffer.from(media.buffer).toString('base64')
            : btoa(new Uint8Array(media.buffer).reduce((s, b) => s + String.fromCharCode(b), ''));
          const tl = img.range?.tl || { col: 0, row: 0 };
          const br = img.range?.br || null;
          const ext = img.range?.ext || null;
          images.push({
            src: `data:image/${media.extension};base64,${base64}`,
            extension: media.extension,
            // Fractional, 0-based cell coordinates (e.g. col 3.4 = 40% into
            // the 4th column) — used to place the image pixel-accurately.
            // Some images (especially reference photos) are anchored with
            // just a top-left position + an explicit pixel size rather than
            // a full cell range — extPx covers that case.
            anchor: br
              ? { fromCol: tl.col, fromRow: tl.row, toCol: br.col, toRow: br.row }
              : { fromCol: tl.col, fromRow: tl.row, extPx: ext ? { width: ext.width, height: ext.height } : { width: 120, height: 90 } },
            // A plain, JSON-safe range for the .xlsx re-export path.
            // IMPORTANT: img.range itself is an ExcelJS Anchor object with
            // a circular reference back to the whole workbook — storing it
            // directly crashes JSON.stringify (and therefore silently
            // breaks saving any template that contains images). Only these
            // plain numbers may be kept.
            range: br
              ? { tl: { col: tl.col, row: tl.row }, br: { col: br.col, row: br.row }, editAs: img.range?.editAs || 'oneCell' }
              : { tl: { col: tl.col, row: tl.row }, ext: { width: ext?.width || 120, height: ext?.height || 90 }, editAs: img.range?.editAs || 'oneCell' }
          });
        }
      });
      // eslint-disable-next-line no-console
      console.log(`[excelParser] Sheet "${worksheet.name}": found ${images.length} embedded image(s).`);
    } catch (imgErr) {
      // eslint-disable-next-line no-console
      console.warn(`[excelParser] Image extraction failed for sheet "${worksheet.name}":`, imgErr);
    }

    sheets.push({
      name: worksheet.name,
      rowCount,
      colCount,
      colWidths,
      hiddenCols,
      frozen,
      merges,
      rows,
      cells: cellsMap,
      images
    });
  });

  return { sheets };
}

/**
 * Best-effort mapping from real worksheet header columns to the checklist
 * field names the operator-facing checklist expects (nature, method, when,
 * type, marathi, proofRequired). Only real cell values are used — if a
 * matching column can't be found, the field is left blank rather than
 * invented. This preserves existing downstream template_fields behavior
 * without generating placeholder content.
 */
const HEADER_ALIASES = {
  nature: ['nature', 'description', 'checkpoint', 'check point', 'item', 'particulars', 'activity'],
  method: ['method', 'how', 'procedure', 'instruction'],
  type: ['type', 'category'],
  when: ['when', 'frequency', 'shift'],
  marathi: ['marathi', 'translation', 'regional'],
  proofRequired: ['proof', 'photo required', 'photo']
};

function findHeaderRow(sheet) {
  // Look at the first few rows for the row most likely to be headers
  for (let r = 1; r <= Math.min(5, sheet.rowCount); r++) {
    const rowCells = Object.keys(sheet.cells).filter(k => k.startsWith(`${r}_`));
    if (rowCells.length >= 2) return r;
  }
  return 1;
}

function matchColumn(headerTextByCol, aliases) {
  for (const [col, text] of Object.entries(headerTextByCol)) {
    const lower = String(text).toLowerCase();
    if (aliases.some(a => lower.includes(a))) return parseInt(col, 10);
  }
  return null;
}

export function extractChecklistRows(sheet) {
  const headerRowIdx = findHeaderRow(sheet);
  const headerTextByCol = {};
  for (let c = 1; c <= sheet.colCount; c++) {
    const cellData = sheet.cells[`${headerRowIdx}_${c}`];
    if (cellData && cellData.value) headerTextByCol[c] = String(cellData.value);
  }

  const colMap = {
    nature: matchColumn(headerTextByCol, HEADER_ALIASES.nature),
    method: matchColumn(headerTextByCol, HEADER_ALIASES.method),
    type: matchColumn(headerTextByCol, HEADER_ALIASES.type),
    when: matchColumn(headerTextByCol, HEADER_ALIASES.when),
    marathi: matchColumn(headerTextByCol, HEADER_ALIASES.marathi),
    proofRequired: matchColumn(headerTextByCol, HEADER_ALIASES.proofRequired)
  };

  const getVal = (r, col) => {
    if (!col) return '';
    const cellData = sheet.cells[`${r}_${col}`];
    return cellData && cellData.value !== undefined ? String(cellData.value) : '';
  };

  const rows = [];
  for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
    const nature = getVal(r, colMap.nature) || (colMap.nature ? '' : getVal(r, 1));
    const method = getVal(r, colMap.method);
    const type = getVal(r, colMap.type);
    const when = getVal(r, colMap.when);
    const marathi = getVal(r, colMap.marathi);
    const proofRaw = getVal(r, colMap.proofRequired).toLowerCase();

    // Skip fully blank rows rather than inserting empty placeholder rows
    if (!nature && !method && !type && !when && !marathi) continue;

    rows.push({
      id: rows.length + 1,
      no: rows.length + 1,
      nature: nature || '',
      marathi: marathi || '',
      type: type || '',
      photoRef: '',
      method: method || '',
      when: when || '',
      proofRequired: proofRaw === 'yes' || proofRaw === 'true' || proofRaw === '1'
    });
  }

  return rows;
}

/**
 * Extracts the real Doc Number as it literally appears in the uploaded
 * workbook — e.g. a cover-page cell like "Doc. number : 43-ME80-F29-ASLY-00001"
 * or a checksheet header cell like "Doc No :43-ME80-F29-ASLY-00001-B".
 * Never fabricates a value: if no matching cell is found, returns ''.
 *
 * Cover-page style cells often pack "Doc. number : ...\nDoc Title : ..."
 * into one cell — each cell's text is split on newlines first so the
 * match stays scoped to just the Doc Number line.
 */
const DOC_NO_REGEX = /doc\.?\s*(?:no\.?|number)\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9\-\/]*)/i;

function scanSheetForDocNumber(sheet) {
  for (let r = 1; r <= sheet.rowCount; r++) {
    for (let c = 1; c <= sheet.colCount; c++) {
      const cellData = sheet.cells[`${r}_${c}`];
      if (!cellData || cellData.value === '' || cellData.value === undefined || cellData.value === null) continue;
      const text = String(cellData.value);
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(DOC_NO_REGEX);
        if (match && match[1]) {
          // Trim stray trailing punctuation picked up by the loose match
          return match[1].trim().replace(/[.,;]+$/, '');
        }
      }
    }
  }
  return '';
}

export function extractDocNumber(rawWorkbook) {
  if (!rawWorkbook || !Array.isArray(rawWorkbook.sheets)) return '';

  // Prefer a cover-page-style sheet first — it typically holds the clean,
  // canonical Doc Number without a revision suffix tacked on.
  const coverSheet = rawWorkbook.sheets.find((s) => /cover/i.test(s.name || ''));
  if (coverSheet) {
    const fromCover = scanSheetForDocNumber(coverSheet);
    if (fromCover) return fromCover;
  }

  // Fall back to scanning every sheet in order (e.g. the checksheet's own
  // "Doc No :" header cell) until a real match is found.
  for (const sheet of rawWorkbook.sheets) {
    const found = scanSheetForDocNumber(sheet);
    if (found) return found;
  }

  return '';
}

/**
 * Reconstructs a real, downloadable .xlsx file from parsed `gridData`
 * (produced by parseWorkbookFile) plus a filled-answers map (keys
 * "sheetIdx_row_col" -> string, exactly as produced by ExcelSheetFillView).
 *
 * Recreates real column widths, row heights, merges, fonts, fills, borders
 * and alignment — the output opens in Excel looking like the original
 * template, with the operator's answers written into the blank cells.
 * Returns a Blob ready to be downloaded.
 */
export async function buildFilledWorkbookBlob(gridData, answers = {}) {
  const workbook = new ExcelJS.Workbook();

  (gridData.sheets || []).forEach((sheet, sheetIdx) => {
    const ws = workbook.addWorksheet(sheet.name || `Sheet${sheetIdx + 1}`);

    // Column widths (convert back from px to Excel's character-width units)
    ws.columns = (sheet.colWidths || []).map((w) => ({ width: Math.max(4, w / EXCEL_COL_WIDTH_TO_PX) }));

    // Merges
    (sheet.merges || []).forEach((rangeStr) => {
      try { ws.mergeCells(rangeStr); } catch { /* skip invalid/overlapping range */ }
    });

    // Row heights + cell values/styles
    (sheet.rows || []).forEach((rowMeta) => {
      const row = ws.getRow(rowMeta.index);
      row.height = rowMeta.height / PT_TO_PX;
      if (rowMeta.hidden) row.hidden = true;
    });

    (sheet.hiddenCols || []).forEach((c) => { ws.getColumn(c).hidden = true; });

    for (let r = 1; r <= sheet.rowCount; r++) {
      for (let c = 1; c <= sheet.colCount; c++) {
        const key = `${r}_${c}`;
        const cellData = sheet.cells[key];
        const answerKey = `${sheetIdx}_${r}_${c}`;
        const answerValue = answers[answerKey];

        const hasOriginal = cellData && cellData.value !== '' && cellData.value !== undefined;
        const hasAnswer = answerValue !== undefined && answerValue !== '';
        if (!hasOriginal && !hasAnswer) continue;

        const cell = ws.getCell(r, c);
        // Prefer the operator's recorded answer — newer submissions send a
        // full snapshot of every cell (edits AND untouched originals), so
        // this is what lets a correction to originally-filled text
        // actually survive into the exported file. Older submissions that
        // only recorded blanks still fall back to the original correctly.
        cell.value = hasAnswer ? answerValue : cellData.value;

        if (cellData) {
          if (cellData.fill) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${cellData.fill.replace('#', '')}` } };
          }
          if (cellData.font) {
            cell.font = {
              bold: cellData.font.bold,
              italic: cellData.font.italic,
              underline: cellData.font.underline,
              strike: cellData.font.strike,
              size: cellData.font.size || undefined,
              name: cellData.font.name || undefined,
              color: cellData.font.color ? { argb: `FF${cellData.font.color.replace('#', '')}` } : undefined
            };
          }
          if (cellData.alignment) {
            cell.alignment = {
              horizontal: cellData.alignment.horizontal || undefined,
              vertical: cellData.alignment.vertical || undefined,
              wrapText: !!cellData.alignment.wrapText
            };
          }
          if (cellData.border) {
            const side = (edge) => edge ? { style: edge.style, color: { argb: `FF${(edge.color || '#000000').replace('#', '')}` } } : undefined;
            cell.border = {
              top: side(cellData.border.top),
              bottom: side(cellData.border.bottom),
              left: side(cellData.border.left),
              right: side(cellData.border.right)
            };
          }
        } else if (answerValue) {
          // Operator-filled cell with no original style — give it a subtle
          // highlight so it's visibly distinguishable as filled-in data.
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
          cell.font = { color: { argb: 'FF00529B' } };
        }
      }
    }

    if (sheet.frozen && (sheet.frozen.xSplit || sheet.frozen.ySplit)) {
      ws.views = [{ state: 'frozen', xSplit: sheet.frozen.xSplit || 0, ySplit: sheet.frozen.ySplit || 0 }];
    }

    // Re-embed images at their original anchor position
    (sheet.images || []).forEach((img) => {
      try {
        const match = /^data:image\/(\w+);base64,(.+)$/.exec(img.src);
        if (!match) return;
        const [, ext, base64] = match;
        const extension = ext === 'jpg' ? 'jpeg' : ext;
        if (!['png', 'jpeg', 'gif'].includes(extension)) return;
        const imageId = workbook.addImage({ base64, extension });
        ws.addImage(imageId, img.range);
      } catch {
        // Skip a single image rather than fail the whole export
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

