/**
 * Excel Workbook Builder (server-side)
 * --------------------------------------------------------------------
 * Reconstructs a real .xlsx file from the stored gridData (the exact
 * parsed workbook — column widths, merges, fonts, fills, borders,
 * alignment) plus a filled-answers map, so the operator's submission
 * exists as a literal file on disk, not just JSON in the database.
 */

import ExcelJS from 'exceljs';

const EXCEL_COL_WIDTH_TO_PX = 7.5;
const PT_TO_PX = 1.333;

export async function buildFilledWorkbookBuffer(gridData, answers = {}) {
  const workbook = new ExcelJS.Workbook();

  (gridData.sheets || []).forEach((sheet, sheetIdx) => {
    const ws = workbook.addWorksheet(sheet.name || `Sheet${sheetIdx + 1}`);

    ws.columns = (sheet.colWidths || []).map((w) => ({ width: Math.max(4, w / EXCEL_COL_WIDTH_TO_PX) }));

    (sheet.merges || []).forEach((rangeStr) => {
      try { ws.mergeCells(rangeStr); } catch { /* skip invalid/overlapping range */ }
    });

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
        // Prefer the operator's recorded answer (see matching comment in
        // src/utils/excelParser.js) so corrections to originally-filled
        // cells actually persist into the generated file.
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
        const imageId = workbook.addImage({ buffer: Buffer.from(base64, 'base64'), extension });
        ws.addImage(imageId, img.range);
      } catch {
        // Skip a single image rather than fail the whole export
      }
    });
  });

  return workbook.xlsx.writeBuffer();
}
