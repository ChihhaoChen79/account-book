/** 簡易 CSV 解析（支援引號、逗號、換行；去 BOM） */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

const needsQuote = /[",\r\n]/;
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((v) => { const s = String(v); return needsQuote.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','))
    .join('\r\n');
}
