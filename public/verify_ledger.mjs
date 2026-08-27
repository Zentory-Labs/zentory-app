#!/usr/bin/env node
// Zentory forward-ledger verifier. Dependency-free, Node >= 18.
//
// Usage:
//   node verify_ledger.mjs forward_ledger.jsonl
//   node verify_ledger.mjs https://app.zentorylabs.com/forward_ledger.jsonl
//   curl -s https://app.zentorylabs.com/forward_ledger.jsonl | node verify_ledger.mjs
//
// Each ledger entry commits to the previous one: entry_hash is the sha256 of
// the entry's canonical JSON (keys sorted, compact separators, entry_hash
// removed), and prev_hash must equal the previous entry's entry_hash. The
// chain is GLOBAL across assets and starts at 64 zeros. Any edited, inserted,
// deleted or reordered line breaks every hash after it.
//
// The recorder writes entries with Python's json.dumps, whose number
// formatting differs from JavaScript's (e.g. 100000.0 vs 100000). So we never
// re-serialize parsed values: the canonical payload is rebuilt from the raw
// key/value tokens of each line, byte-for-byte as the recorder hashed them.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const GENESIS = "0".repeat(64);

function fail(lineNo, msg) {
  console.error(`CHAIN BROKEN at line ${lineNo}: ${msg}`);
  process.exit(1);
}

// Scan a JSON string token starting at line[i] === '"'; return index past it.
function scanString(line, i) {
  for (i++; i < line.length; i++) {
    if (line[i] === "\\") i++;
    else if (line[i] === '"') return i + 1;
  }
  throw new Error("unterminated string");
}

// Split one compact JSON object line into key -> raw value token.
function rawFields(line) {
  const fields = new Map();
  let i = 0;
  if (line[i] !== "{") throw new Error("not a JSON object");
  i++;
  if (line[i] === "}") return fields;
  for (;;) {
    if (line[i] !== '"') throw new Error("expected key");
    const keyEnd = scanString(line, i);
    const key = JSON.parse(line.slice(i, keyEnd));
    i = keyEnd;
    if (line[i] !== ":") throw new Error("expected ':'");
    i++;
    const valStart = i;
    if (line[i] === '"') {
      i = scanString(line, i);
    } else if (line[i] === "{" || line[i] === "[") {
      let depth = 0;
      for (; i < line.length; i++) {
        const c = line[i];
        if (c === '"') i = scanString(line, i) - 1;
        else if (c === "{" || c === "[") depth++;
        else if (c === "}" || c === "]") { depth--; if (depth === 0) { i++; break; } }
      }
    } else {
      while (i < line.length && !",}".includes(line[i])) i++;
    }
    fields.set(key, line.slice(valStart, i));
    if (line[i] === ",") { i++; continue; }
    if (line[i] === "}") return fields;
    throw new Error("malformed object");
  }
}

// sha256 of the canonical form: sorted keys, compact separators, no entry_hash.
function entryHash(fields) {
  const keys = [...fields.keys()].filter((k) => k !== "entry_hash").sort();
  const payload = "{" + keys.map((k) => `${JSON.stringify(k)}:${fields.get(k)}`).join(",") + "}";
  return createHash("sha256").update(payload).digest("hex");
}

async function readInput(arg) {
  if (arg && arg !== "-") {
    if (/^https?:\/\//i.test(arg)) {
      const res = await fetch(arg);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${arg}`);
      return res.text();
    }
    return readFile(arg, "utf8");
  }
  if (process.stdin.isTTY) {
    console.error("usage: node verify_ledger.mjs <path-or-URL>   (or pipe JSONL via stdin)");
    process.exit(1);
  }
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const text = await readInput(process.argv[2]).catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});

let prev = GENESIS;
let entries = 0;
const assets = new Set();
const lines = text.split("\n");
for (let n = 0; n < lines.length; n++) {
  const line = lines[n].trim();
  if (!line) continue;
  const lineNo = n + 1;
  let fields;
  try {
    fields = rawFields(line);
  } catch (e) {
    fail(lineNo, `unparseable entry (${e.message})`);
  }
  const stored = fields.get("entry_hash");
  const prevRaw = fields.get("prev_hash");
  if (!stored || !prevRaw) fail(lineNo, "entry is missing entry_hash or prev_hash");
  const storedHash = JSON.parse(stored);
  if (JSON.parse(prevRaw) !== prev) {
    fail(lineNo, `prev_hash does not match the previous entry's hash (expected ${prev})`);
  }
  const computed = entryHash(fields);
  if (computed !== storedHash) {
    fail(lineNo, `entry_hash mismatch — entry was altered (recomputed ${computed}, stored ${storedHash})`);
  }
  const asset = fields.get("asset");
  if (asset) assets.add(JSON.parse(asset));
  prev = storedHash;
  entries++;
}

if (entries === 0) {
  console.error("CHAIN BROKEN: no entries found in input");
  process.exit(1);
}
// Success line is named "VERIFIED" — the canonical pass signal that the
// investor playbook + validation contract (VAL-FLOW-053) read for. The
// counts + chain head are printed next to it so a reviewer can see how
// many entries + assets were checked and the head hash they should anchor
// to. The detailed count + head line is preserved for human readers who
// want the audit-quality summary; tooling can grep for "VERIFIED".
console.log(`VERIFIED — ${entries} entries, ${assets.size} assets, head ${prev}`);
