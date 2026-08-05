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
 */
export function getImageRect(anchor, colWidths, rowHeights, headerOffset = ROW_HEADER_WIDTH, zoom = 1) {
  if (!anchor || !colWidths?.length || !rowHeights?.length) return null;

  const pxForCol = (fractionalCol) => {
    const whole = Math.floor(fractionalCol);
    const frac = fractionalCol - whole;
    let x = headerOffset;
    for (let i = 0; i < whole && i < colWidths.length; i++) x += colWidths[i];
    if (whole < colWidths.length) x += frac * colWidths[whole];
    return x;
  };

  const pxForRow = (fractionalRow, rowOffsetBase) => {
    const whole = Math.floor(fractionalRow);
    const frac = fractionalRow - whole;
    let y = rowOffsetBase;
    for (let i = 0; i < whole && i < rowHeights.length; i++) y += rowHeights[i];
    if (whole < rowHeights.length) y += frac * rowHeights[whole];
    return y;
  };

  const left = pxForCol(anchor.fromCol);
  const top = pxForRow(anchor.fromRow, 0);

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
  const bottom = pxForRow(anchor.toRow, 0);

  return {
    left,
    top,
    width: Math.max(4, right - left),
    height: Math.max(4, bottom - top)
  };
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
