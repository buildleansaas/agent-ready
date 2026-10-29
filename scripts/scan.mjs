#!/usr/bin/env node
// Scan a website with isitagentready.com (Cloudflare's agent-readiness scanner)
// and print its level, the checks that matter for a content site, and what the
// next level needs. Zero dependencies: Node 18+ (global fetch).

import { pathToFileURL } from "node:url";

export const API_URL = "https://isitagentready.com/api/scan";

// The scanner's "Content Site" preset: the checks a normal website (no public
// API, no store for agents) can and should care about.
export const PRESETS = {
  content: [
    "robotsTxt",
    "sitemap",
    "linkHeaders",
    "dnsAid",
    "markdownNegotiation",
    "robotsTxtAiRules",
    "contentSignals",
  ],
  all: null,
};

export const DEFAULT_TARGET = 2;

const HELP = `Usage: node scripts/scan.mjs <url> [--preset content|all] [--target N] [--json]

Scans <url> with https://isitagentready.com and prints the level, a table of
checks and what the next level needs.

Options:
  --preset content  Only the Content Site checks (default)
  --preset all      Every check the scanner runs (APIs, MCP, commerce...)
  --target N        Level you want to reach (default ${DEFAULT_TARGET})
  --json            Print the summary as JSON instead of a table
  -h, --help        Show this help

Exit codes: 0 = level >= target, 1 = level < target, 2 = network or API error.`;

export function parseArgs(argv) {
  const opts = { url: null, preset: "content", target: DEFAULT_TARGET, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "-h" || a === "--help") opts.help = true;
    else if (a === "--json") opts.json = true;
    else if (a === "--preset") opts.preset = argv[++i];
    else if (a.startsWith("--preset=")) opts.preset = a.slice("--preset=".length);
    else if (a === "--target") opts.target = Number(argv[++i]);
    else if (a.startsWith("--target=")) opts.target = Number(a.slice("--target=".length));
    else if (a.startsWith("-")) throw new Error(`Unknown option: ${a}`);
    else if (!opts.url) opts.url = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  if (!(opts.preset in PRESETS)) throw new Error(`--preset must be one of: ${Object.keys(PRESETS).join(", ")}`);
  if (!Number.isInteger(opts.target) || opts.target < 0) throw new Error("--target must be a whole number, 0 or more");
  return opts;
}

export function normalizeUrl(input) {
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  return new URL(withScheme).toString().replace(/\/$/, "");
}

/**
 * Turn a raw /api/scan response into a small summary. Pure: no I/O.
 * @param {object} json  The scanner's JSON response.
 * @param {{preset?: "content"|"all", target?: number}} [opts]
 */
export function summarize(json, opts = {}) {
  const preset = opts.preset ?? "content";
  const target = opts.target ?? DEFAULT_TARGET;
  const url = json?.url ?? json?.targetUrl ?? null;

  if (!json || typeof json !== "object") {
    return { url, ok: false, error: "Empty or invalid response from the scanner" };
  }
  if (json.error) return { url, ok: false, error: String(json.error) };
  if (json.siteError) {
    const e = json.siteError;
    const parts = [e.httpStatus, e.statusText, e.errorClass && `(${e.errorClass})`].filter(Boolean);
    return {
      url,
      ok: false,
      error: `The scanner could not load the site: ${parts.join(" ")}. A firewall or bot protection may be blocking it.`,
    };
  }
  if (typeof json.level !== "number" || !json.checks) {
    return { url, ok: false, error: "Unexpected response shape from the scanner (no level or checks)" };
  }

  const only = PRESETS[preset];
  const checks = [];
  for (const [category, group] of Object.entries(json.checks)) {
    for (const [name, result] of Object.entries(group ?? {})) {
      if (only && !only.includes(name)) continue;
      checks.push({ category, check: name, status: result?.status ?? "unknown", message: result?.message ?? "" });
    }
  }
  if (only) checks.sort((a, b) => only.indexOf(a.check) - only.indexOf(b.check));

  const next = json.nextLevel
    ? {
        target: json.nextLevel.target,
        name: json.nextLevel.name,
        requirements: (json.nextLevel.requirements ?? []).map((r) => ({
          check: r.check,
          description: r.description,
          prompt: r.prompt,
          specUrls: r.specUrls ?? [],
          skillUrl: r.skillUrl ?? null,
        })),
      }
    : null;

  return {
    url,
    scannedAt: json.scannedAt ?? null,
    level: json.level,
    levelName: json.levelName ?? "",
    target,
    ok: json.level >= target,
    preset,
    checks,
    nextLevel: next,
  };
}

const MARK = { pass: "PASS", fail: "FAIL", neutral: "-" };

export function formatText(s) {
  if (s.error) return `Scan failed for ${s.url ?? "site"}: ${s.error}`;
  const lines = [];
  lines.push(`${s.url}`);
  lines.push(`Level ${s.level} "${s.levelName}" (target ${s.target}: ${s.ok ? "met" : "not met"})`);
  lines.push("");
  const w = Math.max(5, ...s.checks.map((c) => c.check.length));
  lines.push(`${"check".padEnd(w)}  status  message`);
  for (const c of s.checks) {
    lines.push(`${c.check.padEnd(w)}  ${(MARK[c.status] ?? c.status).padEnd(6)}  ${c.message}`);
  }
  if (s.nextLevel?.requirements?.length) {
    lines.push("");
    lines.push(`Next: Level ${s.nextLevel.target} "${s.nextLevel.name}" needs:`);
    for (const r of s.nextLevel.requirements) {
      lines.push(`- ${r.check}: ${r.description}`);
      for (const u of r.specUrls) lines.push(`    spec: ${u}`);
    }
  }
  return lines.join("\n");
}

export async function scan(url, { preset = "content", fetchImpl = fetch, timeoutMs = 90_000 } = {}) {
  const body = { url };
  if (PRESETS[preset]) body.enabledChecks = PRESETS[preset];
  const res = await fetchImpl(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Scanner returned HTTP ${res.status} with a non-JSON body`);
  }
  if (!res.ok && !json.error) json.error = `Scanner returned HTTP ${res.status}`;
  return json;
}

async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}\n\n${HELP}`);
    return 2;
  }
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  if (!opts.url) {
    console.error(HELP);
    return 2;
  }

  let url;
  try {
    url = normalizeUrl(opts.url);
  } catch {
    console.error(`Not a valid URL: ${opts.url}`);
    return 2;
  }

  let summary;
  try {
    const json = await scan(url, { preset: opts.preset });
    summary = summarize(json, { preset: opts.preset, target: opts.target });
    summary.url ??= url;
  } catch (e) {
    summary = { url, ok: false, error: e.name === "TimeoutError" ? "The scan timed out" : e.message };
  }

  if (opts.json) console.log(JSON.stringify(summary, null, 2));
  else if (summary.error) console.error(formatText(summary));
  else console.log(formatText(summary));

  if (summary.error) return 2;
  return summary.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
