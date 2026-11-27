// Download any section as a real .xlsx (no libraries): the tables on screen become sheets,
// and a few sections (tasks, faults, notes) add a full-detail sheet. Files are built on the device.
import * as db from './store.js';

/* ---------- minimal .xlsx writer (OOXML in a store-only zip) ---------- */
const enc = new TextEncoder();
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } return t })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0 };
const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

function zip(files) {                       // files: [[name, Uint8Array]]
  const out = [], central = []; let off = 0;
  for (const [name, data] of files) {
    const nb = enc.encode(name), crc = crc32(data);
    const head = [0x50, 0x4b, 3, 4, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0)];
    out.push(new Uint8Array(head), nb, data);
    central.push(new Uint8Array([0x50, 0x4b, 1, 2, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nb.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), nb);
    off += head.length + nb.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new Uint8Array([0x50, 0x4b, 5, 6, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(off), ...u16(0)]);
  return new Blob([...out, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s };

function sheetXml(rows) {
  const widths = [];
  const body = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
    if (v === '' || v == null) return '';
    const ref = colName(c) + (r + 1), len = String(v).length;
    widths[c] = Math.min(60, Math.max(widths[c] || 8, len + 2));
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${r === 0 ? ' s="1"' : ''}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${r === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${body}</sheetData></worksheet>`;
}

export function xlsxBlob(sheets) {            // sheets: [{name, rows:[[cell,...]]}]
  const names = [], used = new Set();
  for (const s of sheets) {
    let n = String(s.name || 'Sheet').replace(/[\[\]:*?\/\\]/g, ' ').trim().slice(0, 31) || 'Sheet', k = 2;
    while (used.has(n.toLowerCase())) n = n.slice(0, 28) + ' ' + k++;
    used.add(n.toLowerCase()); names.push(n);
  }
  const F = [];
  const add = (n, t) => F.push([n, enc.encode(t)]);
  add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  add('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xe(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
  add('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  add('xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`);
  sheets.forEach((s, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)));
  return zip(F);
}

/* ---------- reading what is on screen ---------- */
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim();
const cell = s => { const t = clean(s); if (/^-?(0|[1-9]\d{0,14})([.,]\d+)?$/.test(t)) return Number(t.replace(',', '.')); return t };

function tableSheets(root) {
  const out = [];
  root.querySelectorAll('table').forEach((tb, i) => {
    const rows = [...tb.querySelectorAll('tr')].map(tr => [...tr.children].map(td => cell(td.textContent)));
    if (rows.length < 2) return;
    const sec = tb.closest('section,.card') || tb.parentElement;
    const h = sec && sec.querySelector('h2,h3');
    out.push({ name: clean(h ? h.textContent : '') || 'Table ' + (i + 1), rows });
  });
  return out;
}
function listSheet(root) {                    // fallback for card/list sections without tables
  const items = [...root.querySelectorAll('.lg, .t')].filter(e => !e.querySelector('.lg, .t'));
  if (!items.length) return [];
  return [{ name: 'List', rows: [['Item', 'Details'], ...items.map(e => e.innerText.split('\n').map(clean).filter(Boolean)).map(p => [p[0], ...p.slice(1)])] }];
}

/* ---------- full-detail sheets for data that is cards on screen ---------- */
const PRI = { urgent: 'Urgent', medium: 'Medium', later: 'Can wait' };
function tasksSheet() {
  const L = db.all('tasks').filter(t => t.status !== 'dropped').sort((a, b) => (a.day || '9').localeCompare(b.day || '9'));
  return { name: 'Tasks', rows: [['Title', 'Category', 'Priority (manual)', 'P level', 'Day', 'Due', 'Status', 'Owner', 'Waiting for', 'Needs reply', 'Repeat', 'Attachments', 'Note', 'ID'],
    ...L.map(t => [t.title, t.cat, PRI[t.pri] || '', t.prio ? 'P' + t.prio : '', t.day || '', t.due || '', t.status, t.owner || '', t.waiting || '', t.reply ? 'yes' : '', t.repeat || '', (t.att || []).map(a => a.name).join('; '), t.note || '', t.id])] };
}
function faultsSheet() {
  const L = db.all('ts').sort((a, b) => (b.date || '0').localeCompare(a.date || '0'));
  return { name: 'Faults', rows: [['Date', 'Title', 'Group', 'Equipment', 'Status', 'Priority', 'Alarm', 'Symptom', 'Cause', 'Action', 'Parts', 'Reference', 'Source', 'Note'],
    ...L.map(t => [t.date || '', t.title, t.grp, t.eq || '', t.status, t.prio || '', t.alarm || '', t.symptom || '', t.cause || '', t.action || '', t.parts || '', t.ref || '', t.src || '', t.note || ''])] };
}
function notesSheet() {
  const L = db.all('notes').sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  return { name: 'Notes', rows: [['Date', 'Category', 'Text'], ...L.map(n => [(n.at || '').slice(0, 16).replace('T', ' '), n.cat || '', n.text || n.body || ''])] };
}
function soundingsSheet() {                   // every saved day, tanks as columns (sounding, cm)
  const D = db.all('soundings').sort((a, b) => a.id.localeCompare(b.id));
  const keys = [...new Set(D.flatMap(d => Object.keys(d.values || {})))];
  return { name: 'Daily soundings', rows: [['Date', ...keys], ...D.map(d => [d.id, ...keys.map(k => { const v = d.values[k]; return v === '' || v == null ? '' : Number(v) })])] };
}
function robSheet() {
  const R = db.all('rob').sort((a, b) => b.id.localeCompare(a.id));
  if (!R.length) return null;
  const keys = [...new Set(R.flatMap(r => Object.keys(r.tanks || {})))];
  const g = (r, k) => { const x = (r.tanks || {})[k]; return x && x.value !== '' && x.value != null ? Number(x.value) : '' };
  const s = (r, k, f) => { const v = r.sum && r.sum[k] && r.sum[k][f]; return typeof v === 'number' ? Math.round(v * 100) / 100 : '' };
  return { name: 'ROB history', rows: [['Date', 'Place', 'Event', 'Draught FWD', 'Draught AFT', 'Trim', 'HFO m3', 'HFO t', 'DO m3', 'DO t', 'LO m3', 'LO t', ...keys.map(k => k + ' (entered)')],
    ...R.map(r => [r.date, r.place || '', r.event || '', Number(r.fwd), Number(r.aft), typeof r.trim === 'number' ? Math.round(r.trim * 100) / 100 : '', s(r, 'HFO', 'm3'), s(r, 'HFO', 't'), s(r, 'DO', 'm3'), s(r, 'DO', 't'), s(r, 'LO', 'm3'), s(r, 'LO', 't'), ...keys.map(k => g(r, k))])] };
}
function lubeSheet() {
  const L = db.all('lube').sort((a, b) => (a.cat || '').localeCompare(b.cat || '') || (a.name || '').localeCompare(b.name || ''));
  return { name: 'Packed oils', rows: [['Name', 'Category', 'Drum size, l', 'Full', 'In use, l', 'Location', 'Date', 'Density'], ...L.map(x => [x.name, x.cat || '', x.drum ?? '', x.full ?? '', x.inuse ?? '', x.location || '', x.date || '', x.density ?? ''])] };
}
const ONLY = { plan: () => [tasksSheet()], notes: () => [notesSheet()] };
const EXTRA = { equip: () => [faultsSheet()], tanks: () => [soundingsSheet(), robSheet()].filter(Boolean), lube: () => [lubeSheet()] };
const ALWAYS = new Set(['equip', 'tanks', 'lube']);
const NONE = new Set(['today', 'ship', 'more', 'sync', 'urgency', 'icons', 'biolab']);

export function sheetsFor(view, root) {
  if (NONE.has(view)) return [];
  if (ONLY[view]) return ONLY[view]();
  const s = tableSheets(root);
  return [...(s.length ? s : listSheet(root)), ...(EXTRA[view] ? EXTRA[view]() : [])];
}

export function downloadView(view, root) {
  const sheets = sheetsFor(view, root);
  if (!sheets.length) return false;
  const l = document.createElement('a'), u = URL.createObjectURL(xlsxBlob(sheets));
  l.href = u; l.download = `mcv-${view}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  return true;
}

export function exportBar(view, root, label) {
  const any = !NONE.has(view) && (ONLY[view] || ALWAYS.has(view) || root.querySelector('table, .lg, .t'));
  return any ? `<div class="xl-bar"><button type="button" class="btn ghost" data-act="xlsx" data-icon="download">${label}</button></div>` : '';
}
