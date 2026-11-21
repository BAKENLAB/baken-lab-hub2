import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Test the actual LOCAL eye guard expressions, not a duplicated regex fixture.
const code = readFileSync(
  new URL("../supabase/functions/local-claimed-mcp/local-eye.mjs", import.meta.url),
  "utf8",
);
const extract = (name) => {
  const line = code.match(new RegExp("^const " + name + " = /(.+)/i;$", "m"));
  assert.ok(line, name + " expression must be found");
  return new RegExp(line[1], "i");
};
const marketText = extract("marketText");
const marketKey = extract("marketKey");

test("official sponsored race names are not market signals", () => {
  for (const name of ["オッズパーク杯", "オッズパーク賞", "オッズパーク協賛",
    "2026/11/7 佐賀 オッズパーク杯 4着"]) {
    assert.equal(marketText.test(name), false, name);
  }
});

test("all actual odds and popularity language remains forbidden", () => {
  for (const statement of ["オッズ", "1番人気", "市場情報で加点",
    "高配当", "market odds", "popularity",
    "オッズパーク杯のオッズは2.5倍", "オッズパーク杯の1番人気"]) {
    assert.equal(marketText.test(statement), true, statement);
  }
});

test("market field keys remain forbidden without exception", () => {
  for (const key of ["odds", "popularity", "市場", "人気", "単勝", "オッズ"]) {
    assert.equal(marketKey.test(key), true, key);
  }
});

test("unrecognized sponsor fragments are not accidentally exempt", () => {
  for (const name of ["オッズパーク", "オッズパーク開催"]) {
    assert.equal(marketText.test(name), true, name);
  }
});
