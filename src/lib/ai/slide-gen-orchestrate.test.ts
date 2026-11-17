import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runGrsaiFirstBatchPolicy } from "./slide-gen-orchestrate";

describe("runGrsaiFirstBatchPolicy", () => {
  it("succeeds on first GrsAI wave", async () => {
    const tries: number[] = [];
    const { failed } = await runGrsaiFirstBatchPolicy(
      [1, 2],
      2,
      async (n) => {
        tries.push(n);
      },
      null
    );
    assert.equal(failed.length, 0);
    assert.deepEqual(tries.sort(), [1, 2]);
  });
});