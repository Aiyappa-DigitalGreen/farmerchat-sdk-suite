#!/usr/bin/env node
// Gzipped size budget check. Zero dependencies: node:zlib only.
//
// Usage: node size-check.mjs [budget.json]   (default: ./size-budget.json, resolved from cwd)
//
// Budget file shape:
//   { "entries": [ { "name": "...", "files": ["dist/a.js"], "budgetKB": 120 },
//                  { "name": "...", "dir": "dist", "ext": [".js"], "budgetKB": 300 } ] }
// An entry's size is the SUM of each matched file gzipped on its own (level 9), which is what a
// consumer's server or bundler would ship. `dir` walks recursively. Fails (exit 1) when any entry
// is over budget or matches no files, so a renamed/missing output is never a silent pass.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve, join, relative } from 'node:path';

const cwd = process.cwd();
const budgetPath = resolve(cwd, process.argv[2] ?? 'size-budget.json');
const { entries } = JSON.parse(readFileSync(budgetPath, 'utf8'));

function walk(dir, exts) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

function filesFor(entry) {
  if (entry.files) return entry.files.map((f) => resolve(cwd, f));
  const dir = resolve(cwd, entry.dir);
  return existsSync(dir) ? walk(dir, entry.ext ?? ['.js']) : [];
}

const kb = (n) => (n / 1024).toFixed(1);
const rows = [];
let failed = false;

for (const entry of entries) {
  const files = filesFor(entry);
  const missing = files.filter((f) => !existsSync(f));
  if (files.length === 0 || missing.length > 0) {
    failed = true;
    rows.push([entry.name, '-', '-', `${entry.budgetKB}`, 'MISSING ' + missing.map((f) => relative(cwd, f)).join(', ')]);
    continue;
  }
  let raw = 0;
  let gz = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    raw += buf.length;
    gz += gzipSync(buf, { level: 9 }).length;
  }
  const over = gz > entry.budgetKB * 1024;
  if (over) failed = true;
  const pct = ((gz / (entry.budgetKB * 1024)) * 100).toFixed(0);
  const label = files.length > 1 ? `${entry.name} (${files.length} files)` : entry.name;
  rows.push([label, kb(raw), kb(gz), `${entry.budgetKB}`, `${over ? 'OVER' : 'ok'} ${pct}%`]);
}

const header = ['entry', 'raw KB', 'gzip KB', 'budget KB', 'status'];
const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
const line = (r) => r.map((c, i) => (i === 0 ? String(c).padEnd(widths[i]) : String(c).padStart(widths[i]))).join('  ');
console.log(line(header));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
rows.forEach((r) => console.log(line(r)));

if (failed) {
  console.error(`\nSize budget FAILED (${relative(cwd, budgetPath)}). Shrink the output, or raise the budget deliberately in the same change.`);
  process.exit(1);
}
console.log('\nSize budget OK.');
