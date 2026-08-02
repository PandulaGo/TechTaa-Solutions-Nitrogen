// One-time import of the user's Excel transaction log ("Cryto Holding" sheet)
// into the trades table. Usage: npm run import [-- path/to/file.xlsx] [--wipe]
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'node:url';
import { getDb } from '../src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_XLSX = path.join(__dirname, '..', 'src', 'data', 'imports', 'Crypto Investment Tracker.xlsx');

const EXPECTED_HOLDINGS = {
  XRP: 25.067,
  POL: 330.0758,
  DOT: 4.30949,
  USDT: 148.99,
  USDC: 0.66328,
  BNB: 0.000017,
  WLD: 40,
  ADA: 10.1,
  DOGE: 1,
};

function excelSerialToDate(serial) {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === 'number') return excelSerialToDate(v);
  const s = String(v).trim();
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function loadSheet(xlsxPath, onTrade) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.getWorksheet('Cryto Holding') || wb.worksheets[0];

  let headerIdx = -1;
  const allRows = [];
  ws.eachRow((row) => allRows.push(row.values));

  for (let i = 0; i < Math.min(allRows.length, 12); i++) {
    const r = allRows[i] || [];
    if (String(r[2] || '').toLowerCase() === 'date' && String(r[3] || '').toLowerCase().includes('coin')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('Could not find the transaction header row (Date / Coin / Type / ...).');
  }

  let count = 0;
  const skipped = [];
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    // row.values is 1-indexed: values[2]=B=Date, [3]=C=Coin, [4]=D=Type, ...
    const r = allRows[i] || [];
    const date = parseDate(r[2]);
    const symbol = r[3] != null ? String(r[3]).trim().toUpperCase() : '';
    const sideRaw = r[4] != null ? String(r[4]).trim().toUpperCase() : '';
    const quantity = parseFloat(r[5]);
    const unitPrice = parseFloat(r[6]);
    const totalValueRaw = r[8];

    if (!symbol || !sideRaw || !['BUY', 'SELL'].includes(sideRaw) || !(quantity > 0)) {
      if (symbol && symbol !== '') skipped.push({ row: i + 1, symbol, side: sideRaw });
      continue;
    }
    if (!date) {
      skipped.push({ row: i + 1, symbol, reason: 'no date' });
      continue;
    }
    let totalValue = parseFloat(totalValueRaw);
    if (!(totalValue > 0) || Number.isNaN(totalValue)) totalValue = quantity * (unitPrice || 0);

    onTrade({
      date,
      symbol,
      side: sideRaw,
      quantity,
      unit_price: unitPrice || 0,
      total_value: totalValue,
      notes: r[11] != null ? String(r[11]).trim() : '',
    });
    count++;
  }
  return { count, skipped };
}

async function main() {
  const args = process.argv.slice(2);
  const wipe = args.includes('--wipe');
  const fileArg = args.find((a) => a.endsWith('.xlsx'));
  const xlsxPath = fileArg || DEFAULT_XLSX;

  if (!fs.existsSync(xlsxPath)) {
    console.error(`Excel file not found: ${xlsxPath}`);
    console.error('Copy your Crypto Investment Tracker.xlsx to src/data/imports/ or pass a path.');
    process.exit(1);
  }

  const db = getDb();
  const existing = db.prepare('SELECT count(*) AS c FROM trades').get().c;
  if (existing > 0 && !wipe) {
    console.error(
      `Trades table already has ${existing} rows. Re-importing would lose manual entries.\n` +
        'Use "npm run import -- --wipe" to replace everything, or start from an empty DB.'
    );
    process.exit(1);
  }
  if (wipe) {
    db.prepare('DELETE FROM trades').run();
    db.prepare('DELETE FROM trailing_state').run();
  }

  const insert = db.prepare(
    `INSERT INTO trades (date, symbol, side, quantity, unit_price, total_value, notes)
     VALUES (@date, @symbol, @side, @quantity, @unit_price, @total_value, @notes)`
  );

  const { count, skipped } = await loadSheet(xlsxPath, (cell) => insert.run(cell));

  console.log(`Imported ${count} transactions from ${path.basename(xlsxPath)}`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} rows:`, JSON.stringify(skipped.slice(0, 10)));
  }

  const holdings = db
    .prepare(
      `SELECT symbol,
              SUM(CASE WHEN side='BUY'  THEN quantity ELSE 0 END) - SUM(CASE WHEN side='SELL' THEN quantity ELSE 0 END) AS qty
       FROM trades GROUP BY symbol ORDER BY symbol`
    )
    .all();
  console.log('\nHoldings after import (verify against your sheet):');
  let allOk = true;
  for (const r of holdings) {
    const expected = EXPECTED_HOLDINGS[r.symbol];
    const ok = expected == null || Math.abs(r.qty - expected) < 0.01;
    if (!ok) allOk = false;
    console.log(
      `  ${r.symbol.padEnd(5)} ${r.qty.toFixed(6).padStart(14)}  ${expected != null ? (ok ? 'OK' : `EXPECTED ${expected}`) : '(new)'}`
    );
  }
  console.log(allOk ? '\nAll holdings match the spreadsheet.' : '\nSome holdings differ — check the sheet.');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
