// Tests for scripts/scan.mjs. They use real scanner responses saved in
// test/fixtures (captured 2026-10-29) and never touch the network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  summarize,
  formatText,
  parseArgs,
  normalizeUrl,
  scan,
  PRESETS,
  API_URL,
} from "../scripts/scan.mjs";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));

test("level 2 site (pedscalc) meets the default target", () => {
  const s = summarize(fixture("level2"));
  assert.equal(s.level, 2);
  assert.equal(s.levelName, "Bot-Aware");
  assert.equal(s.target, 2);
  assert.equal(s.ok, true);
  assert.equal(s.checks.find((c) => c.check === "contentSignals").status, "pass");
  assert.equal(s.nextLevel.target, 3);
  assert.deepEqual(s.nextLevel.requirements.map((r) => r.check), ["markdownNegotiation"]);
});

test("level 1 site (gnu.org) misses target 2 and only needs Content Signals", () => {
  const s = summarize(fixture("level1"));
  assert.equal(s.level, 1);
  assert.equal(s.ok, false);
  assert.equal(s.checks.find((c) => c.check === "contentSignals").status, "fail");
  assert.deepEqual(s.nextLevel.requirements.map((r) => r.check), ["contentSignals"]);
  assert.ok(s.nextLevel.requirements[0].specUrls.includes("https://contentsignals.org/"));
});

test("level 0 site (example.com) lists the level 1 requirements", () => {
  const s = summarize(fixture("level0"));
  assert.equal(s.level, 0);
  assert.equal(s.levelName, "Not Ready");
  assert.equal(s.ok, false);
  assert.deepEqual(s.nextLevel.requirements.map((r) => r.check), ["robotsTxt", "sitemap", "linkHeaders"]);
});

test("content preset keeps only the Content Site checks, in preset order", () => {
  const s = summarize(fixture("level2"), { preset: "content" });
  assert.deepEqual(s.checks.map((c) => c.check), PRESETS.content);
});

test("all preset keeps every check, including discovery and commerce", () => {
  const s = summarize(fixture("level2"), { preset: "all" });
  const names = s.checks.map((c) => c.check);
  assert.ok(names.length > PRESETS.content.length);
  assert.ok(names.includes("mcpServerCard"));
  assert.ok(names.includes("x402"));
});

test("target changes ok but not level", () => {
  assert.equal(summarize(fixture("level1"), { target: 1 }).ok, true);
  assert.equal(summarize(fixture("level2"), { target: 3 }).ok, false);
  assert.equal(summarize(fixture("level0"), { target: 0 }).ok, true);
});

test("a blocked site becomes an error, not a level", () => {
  const s = summarize(fixture("site-error"));
  assert.equal(s.ok, false);
  assert.match(s.error, /403/);
  assert.match(s.error, /blocked/);
  assert.equal(s.level, undefined);
});

test("API errors and bad shapes become errors", () => {
  assert.match(summarize({ error: "Invalid URL provided" }).error, /Invalid URL/);
  assert.match(summarize({ url: "https://x.test" }).error, /Unexpected response/);
  assert.match(summarize(null).error, /invalid/i);
});

test("formatText prints level, table rows and next steps", () => {
  const out = formatText(summarize(fixture("level1")));
  assert.match(out, /Level 1 "Basic Web Presence" \(target 2: not met\)/);
  assert.match(out, /contentSignals\s+FAIL\s+No Content Signals found in robots.txt/);
  assert.match(out, /Next: Level 2 "Bot-Aware" needs:/);
  assert.match(out, /spec: https:\/\/contentsignals.org\//);
});

test("parseArgs reads url and flags, rejects bad input", () => {
  assert.deepEqual(parseArgs(["https://a.test", "--preset", "all", "--target=3", "--json"]), {
    url: "https://a.test",
    preset: "all",
    target: 3,
    json: true,
    help: false,
  });
  assert.equal(parseArgs(["--help"]).help, true);
  assert.throws(() => parseArgs(["a.test", "--preset", "nope"]), /--preset/);
  assert.throws(() => parseArgs(["a.test", "--target", "x"]), /--target/);
  assert.throws(() => parseArgs(["a.test", "--bogus"]), /Unknown option/);
});

test("normalizeUrl adds https and drops a trailing slash", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com");
  assert.equal(normalizeUrl("https://example.com/"), "https://example.com");
  assert.equal(normalizeUrl("http://example.com/blog/"), "http://example.com/blog");
});

test("scan sends the content preset as enabledChecks (fake fetch)", async () => {
  let sent;
  const fakeFetch = async (url, init) => {
    sent = { url, init };
    return { ok: true, status: 200, text: async () => JSON.stringify(fixture("level2")) };
  };
  const json = await scan("https://www.pedscalc.com", { fetchImpl: fakeFetch });
  assert.equal(sent.url, API_URL);
  assert.equal(sent.init.method, "POST");
  const body = JSON.parse(sent.init.body);
  assert.equal(body.url, "https://www.pedscalc.com");
  assert.deepEqual(body.enabledChecks, PRESETS.content);
  assert.equal(json.level, 2);

  await scan("https://www.pedscalc.com", { preset: "all", fetchImpl: fakeFetch });
  assert.equal(JSON.parse(sent.init.body).enabledChecks, undefined);
});

test("scan turns a non-JSON body into an error", async () => {
  const fakeFetch = async () => ({ ok: false, status: 502, text: async () => "<html>bad gateway</html>" });
  await assert.rejects(scan("https://a.test", { fetchImpl: fakeFetch }), /HTTP 502/);
});
