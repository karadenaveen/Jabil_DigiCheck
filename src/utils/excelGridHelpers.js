export const ROW_HEADER_WIDTH = 48;

export function colLetter(n) {
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function parseRange(rangeStr) {
  // e.g. "B2:D4" -> { startRow, startCol, endRow, endCol }
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(rangeStr);
  if (!m) return null;
  const colToNum = (letters) => {
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n;
  };
  return {
    startRow: parseInt(m[2], 10),
    startCol: colToNum(m[1]),
    endRow: parseInt(m[4], 10),
    endCol: colToNum(m[3])
  };
}

export function cellStyleToCss(cellData) {
  if (!cellData) return {};
  const style = {};
  if (cellData.fill) style.backgroundColor = cellData.fill;
  if (cellData.font) {
    if (cellData.font.bold) style.fontWeight = 700;
    if (cellData.font.italic) style.fontStyle = 'italic';
    if (cellData.font.color) style.color = cellData.font.color;
    if (cellData.font.size) style.fontSize = `${cellData.font.size}px`;
    if (cellData.font.underline) style.textDecoration = 'underline';
    else if (cellData.font.strike) style.textDecoration = 'line-through';
  }
  if (cellData.alignment) {
    if (cellData.alignment.horizontal) {
      style.textAlign = cellData.alignment.horizontal === 'center' ? 'center'
        : cellData.alignment.horizontal === 'right' ? 'right' : 'left';
    }
    if (cellData.alignment.vertical) {
      style.verticalAlign = cellData.alignment.vertical === 'middle' ? 'middle'
        : cellData.alignment.vertical === 'bottom' ? 'bottom' : 'top';
    }
    if (cellData.alignment.wrapText) {
      style.whiteSpace = 'normal';
      style.wordBreak = 'normal';
      style.overflowWrap = 'break-word';
    } else {
      style.whiteSpace = 'nowrap';
      style.overflow = 'hidden';
      style.textOverflow = 'ellipsis';
    }
  }
  if (cellData.border) {
    const sideCss = (edge) => edge ? `1px solid ${edge.color}` : undefined;
    if (sideCss(cellData.border.top)) style.borderTop = sideCss(cellData.border.top);
    if (sideCss(cellData.border.bottom)) style.borderBottom = sideCss(cellData.border.bottom);
    if (sideCss(cellData.border.left)) style.borderLeft = sideCss(cellData.border.left);
    if (sideCss(cellData.border.right)) style.borderRight = sideCss(cellData.border.right);
  }
  return style;
}

/**
 * Converts an image's fractional cell anchor (e.g. col 3.4 = 40% into the
 * 4th column) into real pixel coordinates, given the sheet's zoomed column
 * widths/row heights and the row-header/col-header offset. Returns null if
 * the anchor falls outside the known columns/rows.
 *
 * `headerOffset`  — width of the sticky row-number column (left edge offset
 *                    for column 0), same value used for colOffsets[0].
 * `topOffset`     — height of the sticky column-letter header row that sits
 *                    above row 1 in the scroll container. Images are
 *                    positioned absolutely inside that same container, so
 *                    without this offset every image renders shifted up by
 *                    exactly the header row's height.
 */
export function getImageRect(anchor, colWidths, rowHeights, headerOffset = ROW_HEADER_WIDTH, topOffset = 0, zoom = 1) {
  if (!anchor || !colWidths?.length || !rowHeights?.length) return null;

  const pxForCol = (fractionalCol) => {
    const whole = Math.floor(fractionalCol);
    const frac = fractionalCol - whole;
    let x = headerOffset;
    for (let i = 0; i < whole && i < colWidths.length; i++) x += colWidths[i];
    if (whole < colWidths.length) x += frac * colWidths[whole];
    return x;
  };

  const pxForRow = (fractionalRow) => {
    const whole = Math.floor(fractionalRow);
    const frac = fractionalRow - whole;
    let y = topOffset;
    for (let i = 0; i < whole && i < rowHeights.length; i++) y += rowHeights[i];
    if (whole < rowHeights.length) y += frac * rowHeights[whole];
    return y;
  };

  const left = pxForCol(anchor.fromCol);
  const top = pxForRow(anchor.fromRow);

  // Anchored with an explicit pixel size (no cell range) — common for
  // reference/proof photos placed at a fixed size.
  if (anchor.extPx) {
    return {
      left,
      top,
      width: Math.max(4, Math.round(anchor.extPx.width * zoom)),
      height: Math.max(4, Math.round(anchor.extPx.height * zoom))
    };
  }

  const right = pxForCol(anchor.toCol);
  const bottom = pxForRow(anchor.toRow);

  return {
    left,
    top,
    width: Math.max(4, right - left),
    height: Math.max(4, bottom - top)
  };
}

/**
 * Lays out a sheet's embedded images the same way native Excel merges work:
 * each image is attached to the cell it anchors to and made to SPAN the
 * cells it covers, instead of floating as an absolutely-positioned overlay
 * on top of the whole table. The spanned cells are removed from normal
 * rendering (same idea as buildMergeMaps) and the anchor cell renders the
 * image on top with the cell's own content shown below it.
 *
 * This keeps every image visually "inside" its own table cell — contained
 * by the same borders/columns as the rest of the sheet — instead of
 * floating over unrelated columns whenever pixel math drifts slightly out
 * of sync with the rendered table (which is what a free-floating overlay
 * is prone to).
 *
 * Returns:
 *   startMap     — "row_col" of the anchor cell -> { image, rowSpan, colSpan, pxHeight, startRowIdx, startColIdx }
 *   covered      — Set of "row_col" cells hidden because an image spans over them
 *   coveredOwner — "row_col" of a covered cell -> "row_col" of its image's anchor cell
 */
export function buildImageLayout(sheet) {
  const startMap = {};
  const covered = new Set();
  const coveredOwner = {};
  if (!sheet) return { startMap, covered, coveredOwner };

  const rows = sheet.rows || [];
  const colWidths = sheet.colWidths || [];
  const rowIndexAt = (idx) => rows[idx]?.index;
  const colNumAt = (idx) => idx + 1;

  // For images anchored with a fixed pixel size (no cell range), estimate
  // how many columns/rows it roughly covers so it can still "merge" a
  // sensible cell region instead of being pinned to a single cell.
  const spanForPx = (startIdx, pxSize, sizes) => {
    if (!pxSize || pxSize <= 0) return 1;
    let total = 0;
    let count = 0;
    for (let i = startIdx; i < sizes.length; i++) {
      total += (sizes[i] || 0);
      count++;
      if (total >= pxSize) break;
    }
    return Math.max(1, count);
  };

  (sheet.images || []).forEach((img) => {
    const anchor = img.anchor;
    if (!anchor) return;
    const startRowIdx = Math.floor(anchor.fromRow ?? 0);
    const startColIdx = Math.floor(anchor.fromCol ?? 0);
    const startRow = rowIndexAt(startRowIdx);
    const startCol = colNumAt(startColIdx);
    if (startRow === undefined) return;

    let rowSpan;
    let colSpan;
    let pxHeight = null;

    if (anchor.toRow !== undefined && anchor.toCol !== undefined) {
      rowSpan = Math.max(1, Math.round(anchor.toRow - anchor.fromRow));
      colSpan = Math.max(1, Math.round(anchor.toCol - anchor.fromCol));
    } else if (anchor.extPx) {
      const rowSizes = rows.map(r => (r.hidden ? 0 : r.height));
      colSpan = spanForPx(startColIdx, anchor.extPx.width, colWidths);
      rowSpan = spanForPx(startRowIdx, anchor.extPx.height, rowSizes);
      pxHeight = anchor.extPx.height;
    } else {
      rowSpan = 1;
      colSpan = 1;
    }

    const startKey = `${startRow}_${startCol}`;
    if (startMap[startKey]) return; // two images on one anchor cell — keep the first

    startMap[startKey] = { image: img, rowSpan, colSpan, pxHeight, startRowIdx, startColIdx };

    for (let r = 0; r < rowSpan; r++) {
      const rNum = rowIndexAt(startRowIdx + r);
      if (rNum === undefined) continue;
      for (let c = 0; c < colSpan; c++) {
        const cNum = colNumAt(startColIdx + c);
        if (r === 0 && c === 0) continue;
        const coveredKey = `${rNum}_${cNum}`;
        covered.add(coveredKey);
        coveredOwner[coveredKey] = startKey;
      }
    }
  });

  return { startMap, covered, coveredOwner };
}

export function buildMergeMaps(sheet) {
  const starts = {};
  const covered = new Set();
  (sheet?.merges || []).forEach((rangeStr) => {
    const range = parseRange(rangeStr);
    if (!range) return;
    starts[`${range.startRow}_${range.startCol}`] = {
      rowSpan: range.endRow - range.startRow + 1,
      colSpan: range.endCol - range.startCol + 1
    };
    for (let r = range.startRow; r <= range.endRow; r++) {
      for (let c = range.startCol; c <= range.endCol; c++) {
        if (r === range.startRow && c === range.startCol) continue;
        covered.add(`${r}_${c}`);
      }
    }
  });
  return { mergeStarts: starts, coveredCells: covered };
}
