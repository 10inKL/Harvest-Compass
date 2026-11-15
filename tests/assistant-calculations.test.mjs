import test from "node:test";
import assert from "node:assert/strict";
import { equipmentScenario, expectedProduction } from "../lib/assistant/calculations.ts";

test("production estimates use stated yield assumptions", () => {
  assert.equal(expectedProduction(320, 190), 60800);
  assert.throws(() => expectedProduction(320, 0));
});

test("combine delay scenario separates time and cost assumptions", () => {
  assert.deepEqual(equipmentScenario(320, 20, 48, 125), {
    baseHarvestHours: 16,
    delayedCompletionHours: 64,
    delayCostEstimate: 6000,
  });
  assert.throws(() => equipmentScenario(320, 0, 48, 125));
});
