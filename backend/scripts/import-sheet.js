#!/usr/bin/env node
/**
 * One-off importer: spreadsheet CSV -> Gym Tracker.
 *
 *   node scripts/import-sheet.js scripts/data/gym.csv             # dry run (default, offline)
 *   node scripts/import-sheet.js scripts/data/gym.csv --commit    # really import
 *
 * --commit logs in to the API with your normal app account, so the data lands under your
 * user and goes through the same validation as the app. Configure it with environment variables:
 *
 *   API_URL        e.g. https://gym-tracker-api.onrender.com   (or http://localhost:5000)
 *   GYM_EMAIL      your app login
 *   GYM_PASSWORD   your app password
 *
 * Other flags:  --dmy   treat dates like 5/6/2026 as day/month (default is month/day).
 *
 * Expected columns (case-insensitive; Polish or English names both work):
 *   date      dzien | date | day            (M/D/YYYY, D.M.YYYY or YYYY-MM-DD)
 *   muscle    miesien | muscle | category   (optional; becomes the exercise category)
 *   exercise  cwiczenie | exercise | name
 *   weight    ciezar | weight               (optional; "50kg", "2x18kg", "-32", "25kg (1 pulley)")
 *   sets      seria1, seria2, ... | set1, set2, ...   (reps; "12", "12+", "(30kg)12", "12(60kg)")
 *   side      side | strona                 (optional; L/R. Otherwise left/right is read from the muscle text)
 *
 * Re-running is safe: dates that were already imported are skipped.
 */
'use strict';
const fs = require('fs');

const MARKER = 'Imported from spreadsheet';
const NUM = '-?\\d+(?:[.,]\\d+)?';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const file = args.find((a) => !a.startsWith('--'));

function fail(msg) {
  console.error(`\nError: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- CSV parsing

function detectDelimiter(headerLine) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of headerLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const delim = detectDelimiter(text.split(/\r?\n/)[0]);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return { rows: rows.filter((r) => r.some((c) => c.trim() !== '')), delim };
}

// ------------------------------------------------------------ column mapping

const ALIASES = {
  date: ['dzien', 'dzień', 'date', 'day'],
  muscle: ['miesien', 'mięsień', 'muscle', 'muscles', 'muscle group', 'category', 'group'],
  exercise: ['cwiczenie', 'ćwiczenie', 'exercise', 'name'],
  weight: ['ciezar', 'ciężar', 'weight', 'load'],
  side: ['side', 'strona']
};

function mapColumns(headers) {
  const cols = { sets: [] };
  headers.forEach((h, i) => {
    const n = h.trim().toLowerCase();
    for (const [key, names] of Object.entries(ALIASES)) {
      if (names.includes(n) && cols[key] === undefined) cols[key] = i;
    }
    const m = n.match(/^(?:seria|set|s)\s*(\d+)$/);
    if (m) cols.sets.push({ i, n: Number(m[1]) });
  });
  cols.sets.sort((a, b) => a.n - b.n);
  return cols;
}

// ------------------------------------------------------------- cell parsing

const toNum = (s) => Number(s.replace(',', '.'));

function makeDate(y, mo, d) {
  const dt = new Date(y, mo - 1, d, 12, 0, 0); // noon local time; the sheet has no times
  return dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
}

function parseDate(text, dmy) {
  const t = text.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return makeDate(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return makeDate(+m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const a = +m[1];
    const b = +m[2];
    const dayFirst = dmy || a > 12;
    return makeDate(+m[3], dayFirst ? b : a, dayFirst ? a : b);
  }
  return null;
}

// "50kg" -> 50, "2x18kg" -> 18 (per dumbbell), "-32" -> -32 (assistance), "11" -> 11,
// "25kg (1 pulley)" -> 25 + note, "" -> 0 (bodyweight)
function parseWeight(text) {
  const t = (text || '').trim();
  if (t === '') return { weight: 0 };
  const m = t.match(new RegExp(`^(?:\\d+\\s*[x×]\\s*)?(${NUM})\\s*(?:kg)?\\s*(.*)$`, 'i'));
  if (!m) return { weight: 0, problem: `could not read weight "${t}", using 0` };
  return { weight: toNum(m[1]), note: m[2].trim() || null };
}

const OVERRIDE = new RegExp(`\\(\\s*(?:\\d+\\s*[x×]\\s*)?(${NUM})\\s*(?:kg)?\\s*\\)`, 'i');

// "12", "12+", "(30kg)12", "12(60kg)", "(2x26kg)12+"  ->  { reps, weight|null }
// empty cell -> null (set not done)
function parseSetCell(text) {
  const t = (text || '').trim();
  if (t === '') return null;
  let weight = null;
  let rest = t;
  const o = t.match(OVERRIDE);
  if (o) {
    weight = toNum(o[1]);
    rest = t.replace(o[0], ' ');
  }
  const r = rest.match(/(\d+)\s*\+?/);
  if (!r || rest.replace(/\d+\s*\+?/, '').trim() !== '') return { problem: `could not read "${t}"` };
  return { reps: Number(r[1]), weight };
}

const SIDE_WORDS = '(left|lewy|lewa|lewe|right|prawy|prawa|prawe)';

function detectSide(muscle, sideCell) {
  const probe = (sideCell || '').trim().toLowerCase() || (muscle || '').toLowerCase();
  if (new RegExp('\\b(left|lewy|lewa|lewe|l)\\b').test(probe)) return 'L';
  if (new RegExp('\\b(right|prawy|prawa|prawe|r)\\b').test(probe)) return 'R';
  return null;
}

function cleanMuscle(raw) {
  return raw
    .replace(new RegExp(`\\b(${SIDE_WORDS.slice(1, -1)}|l|r)\\b`, 'gi'), ' ')
    .replace(/[-–()/,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ------------------------------------------------------------- read + group

function readSheet(path, dmy) {
  if (!fs.existsSync(path)) fail(`File not found: ${path}`);
  const { rows, delim } = parseCsv(fs.readFileSync(path, 'utf8'));
  if (rows.length < 2) fail('The CSV has no data rows.');

  const headers = rows[0];
  const cols = mapColumns(headers);
  const missing = [];
  if (cols.date === undefined) missing.push('date ("dzien" / "date")');
  if (cols.exercise === undefined) missing.push('exercise ("cwiczenie" / "exercise")');
  if (cols.sets.length === 0) missing.push('set columns ("seria1" / "set1" ...)');
  if (missing.length) {
    fail(`Could not find column(s): ${missing.join(', ')}.\nHeaders found: ${headers.map((h) => `"${h}"`).join(', ')}`);
  }

  const warnings = [];
  const days = new Map(); // dateKey -> { date, exercises: Map(key -> { sets, notes }) }
  const registry = new Map(); // key -> exercise info

  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (i) => (i === undefined ? '' : (cells[i] ?? '').trim());
    const dateText = get(cols.date);
    const name = get(cols.exercise).replace(/\s+/g, ' ');
    if (!dateText && !name) return;
    if (!name) return warnings.push(`row ${line}: no exercise name, skipped`);

    const date = parseDate(dateText, dmy);
    if (!date) return warnings.push(`row ${line} (${name}): unreadable date "${dateText}", skipped`);

    const muscleRaw = get(cols.muscle);
    const side = detectSide(muscleRaw, get(cols.side));
    const category = cleanMuscle(muscleRaw) || 'General';

    const w = parseWeight(get(cols.weight));
    if (w.problem) warnings.push(`row ${line} (${name}): ${w.problem}`);

    const sets = [];
    for (const { i, n } of cols.sets) {
      const parsed = parseSetCell(get(i));
      if (!parsed) continue;
      if (parsed.problem) {
        warnings.push(`row ${line} (${name}) set ${n}: ${parsed.problem}, set skipped`);
        continue;
      }
      sets.push({ reps: parsed.reps, weight: parsed.weight ?? w.weight, side });
    }
    if (sets.length === 0) return warnings.push(`row ${line} (${name}): no sets filled in, skipped`);

    const key = name.toLowerCase();
    let ex = registry.get(key);
    if (!ex) {
      ex = { key, name, category, asymmetrical: false, categories: new Set(), dates: new Set(), setCount: 0 };
      registry.set(key, ex);
    }
    ex.categories.add(category);
    if (side) ex.asymmetrical = true;

    const dk = dayKey(date);
    ex.dates.add(dk);
    ex.setCount += sets.length;

    let day = days.get(dk);
    if (!day) {
      day = { key: dk, date, exercises: new Map() };
      days.set(dk, day);
    }
    let entry = day.exercises.get(key);
    if (!entry) {
      entry = { sets: [], notes: new Set() };
      day.exercises.set(key, entry);
    }
    entry.sets.push(...sets);
    if (w.note) entry.notes.add(w.note);
  });

  const sortedDays = [...days.values()].sort((a, b) => a.date - b.date);
  return { headers, cols, delim, rowCount: rows.length - 1, days: sortedDays, registry, warnings };
}

// One-sided exercises are stored interleaved (L, R, L, R ...) exactly like the app logs them.
function orderSets(sets) {
  if (!sets.some((s) => s.side)) return sets;
  const L = sets.filter((s) => s.side === 'L');
  const R = sets.filter((s) => s.side === 'R');
  const rest = sets.filter((s) => !s.side);
  const out = [];
  for (let i = 0; i < Math.max(L.length, R.length); i++) {
    if (L[i]) out.push(L[i]);
    if (R[i]) out.push(R[i]);
  }
  return [...out, ...rest];
}

// ------------------------------------------------------------------- report

function printReport(data) {
  const { cols, headers, delim, rowCount, days, registry, warnings } = data;
  const colName = (i) => (i === undefined ? '(none)' : `"${headers[i].trim()}"`);
  const delimName = delim === '\t' ? 'tab' : delim;

  console.log(`Read ${rowCount} data rows (delimiter "${delimName}")`);
  console.log(
    `Columns: date=${colName(cols.date)} muscle=${colName(cols.muscle)} exercise=${colName(cols.exercise)} ` +
      `weight=${colName(cols.weight)} sets=${cols.sets.map((s) => `"${headers[s.i].trim()}"`).join(', ')}` +
      (cols.side !== undefined ? ` side=${colName(cols.side)}` : '')
  );

  console.log(`\nSessions: ${days.length}`);
  days.forEach((d) => {
    const sets = [...d.exercises.values()].reduce((n, e) => n + e.sets.length, 0);
    console.log(`  ${d.key}  ${String(d.exercises.size).padStart(2)} exercises, ${String(sets).padStart(3)} sets`);
  });

  console.log(`\nExercises: ${registry.size}`);
  const exs = [...registry.values()].sort((a, b) => a.name.localeCompare(b.name));
  const width = Math.max(8, ...exs.map((e) => e.name.length));
  exs.forEach((e) => {
    console.log(
      `  ${e.name.padEnd(width)}  ${e.category.padEnd(18)} ${String(e.dates.size).padStart(2)} sessions, ` +
        `${String(e.setCount).padStart(3)} sets${e.asymmetrical ? '  [one-sided: left/right]' : ''}`
    );
  });

  const multi = exs.filter((e) => e.categories.size > 1);
  if (multi.length) {
    console.log('\nNote: these exercises appear under more than one muscle label (the first one becomes the category).');
    console.log('If they are really different exercises, give them different names in the CSV:');
    multi.forEach((e) => console.log(`  ${e.name}: ${[...e.categories].join(' / ')}`));
  }

  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  } else {
    console.log('\nNo warnings.');
  }
}

// ------------------------------------------------------------------- commit

async function commit(data) {
  let base = (process.env.API_URL || '').trim().replace(/\/+$/, '');
  const email = process.env.GYM_EMAIL;
  const password = process.env.GYM_PASSWORD;
  if (!base || !email || !password) {
    fail('--commit needs the environment variables API_URL, GYM_EMAIL and GYM_PASSWORD (see the top of this file).');
  }
  if (!/\/api$/.test(base)) base += '/api';

  let token = null;
  const call = async (method, path, body) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${json.error || 'unknown error'}`);
    return json;
  };

  // Render's free plan sleeps when idle; the first request can take a minute.
  process.stdout.write('\nContacting the API (a sleeping Render service can take up to a minute)');
  let up = false;
  for (let attempt = 0; attempt < 15 && !up; attempt++) {
    try {
      const res = await fetch(`${base}/health`);
      up = res.ok;
    } catch {
      /* not reachable yet */
    }
    if (!up) {
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  if (!up) fail(`\nCould not reach ${base}/health`);
  console.log(' ok');

  token = (await call('POST', '/auth/login', { email, password })).token;
  console.log(`Logged in as ${email}`);

  // exercises: reuse existing ones by name, create the missing ones
  const existing = new Map((await call('GET', '/exercises')).map((e) => [e.name.toLowerCase(), e]));
  const idByKey = new Map();
  let created = 0;
  for (const ex of data.registry.values()) {
    const found = existing.get(ex.key);
    if (found) {
      idByKey.set(ex.key, found._id);
      if (ex.asymmetrical && !found.asymmetrical) {
        console.log(`  ! "${found.name}" exists but is not marked one-sided; left/right sets will still be saved.`);
      }
    } else {
      const made = await call('POST', '/exercises', {
        name: ex.name,
        category: ex.category,
        asymmetrical: ex.asymmetrical
      });
      idByKey.set(ex.key, made._id);
      created += 1;
    }
  }
  console.log(`Exercises: ${created} created, ${data.registry.size - created} already existed`);

  // sessions: skip dates that were imported before
  const imported = new Set(
    (await call('GET', '/sessions'))
      .filter((s) => (s.notes || '').startsWith(MARKER))
      .map((s) => dayKey(new Date(s.date)))
  );

  let added = 0;
  let skipped = 0;
  for (const day of data.days) {
    if (imported.has(day.key)) {
      skipped += 1;
      console.log(`  ${day.key}  already imported, skipped`);
      continue;
    }
    const notes = [];
    const exercises = [...day.exercises.entries()].map(([key, e]) => {
      const name = data.registry.get(key).name;
      e.notes.forEach((n) => notes.push(`${name}: ${n}`));
      return {
        exerciseId: idByKey.get(key),
        sets: orderSets(e.sets).map((s) => ({ reps: s.reps, weight: s.weight, side: s.side }))
      };
    });
    await call('POST', '/sessions', {
      date: day.date.toISOString(),
      notes: [MARKER, ...notes].join('. '),
      exercises
    });
    added += 1;
    console.log(`  ${day.key}  imported (${exercises.length} exercises)`);
  }
  console.log(`\nDone: ${added} sessions imported, ${skipped} skipped.`);
}

// --------------------------------------------------------------------- main

(async () => {
  if (!file) {
    fail('Usage: node scripts/import-sheet.js <file.csv> [--commit] [--dmy]');
  }
  const data = readSheet(file, flags.has('--dmy'));
  printReport(data);

  if (!flags.has('--commit')) {
    console.log('\nThis was a dry run, nothing was written. Re-run with --commit to import.');
    return;
  }
  await commit(data);
})().catch((err) => fail(err.message));

