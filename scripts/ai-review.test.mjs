import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { clipDiff, commentDestination, isMissingCli, reviewDecision, reviewPrompt } from "./ai-review.mjs";

const reviewScript = fileURLToPath(new URL("./ai-review.mjs", import.meta.url));

describe("ai review", () => {
  it("skips when the key is missing and reviews when it is set", () => {
    assert.equal(reviewDecision({}).action, "skip");
    assert.equal(reviewDecision({ XAI_API_KEY: "  " }).action, "skip");
    assert.equal(reviewDecision({ XAI_API_KEY: "xai-test" }).action, "review");
  });

  it("exits 0 when the key is missing", () => {
    const result = spawnSync(process.execPath, [reviewScript], {
      env: { ...process.env, XAI_API_KEY: "" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /XAI_API_KEY is not set/);
  });

  it("clips a huge diff and keeps a short one", () => {
    assert.equal(clipDiff("small"), "small");
    const huge = "a".repeat(20_000);
    const clipped = clipDiff(huge);
    assert.equal(clipped.endsWith("[diff truncated]"), true);
    assert.equal(clipped.length < huge.length, true);
  });

  it("comments on Origin when there is a pull request and no GitHub token", () => {
    assert.equal(commentDestination({ PR_NUMBER: "8" }), "origin");
    assert.equal(commentDestination({}), "stdout");
    assert.equal(
      commentDestination({ PR_NUMBER: "8", GITHUB_TOKEN: "ghs", GITHUB_REPOSITORY: "Phazzie/FairytaleswithSpice" }),
      "github",
    );
  });

  it("treats a missing origin binary as a non-fatal CLI gap", () => {
    const error = new Error("spawnSync origin ENOENT");
    error.code = "ENOENT";
    assert.equal(isMissingCli(error), true);
    assert.equal(isMissingCli(new Error("origin pr comment failed (1)")), false);
  });

  it("prints the review and exits 0 when the origin CLI is not on PATH", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { publishReview } from ${JSON.stringify(reviewScript)};
         await publishReview({ PR_NUMBER: "8", GITHUB_TOKEN: "", GITHUB_REPOSITORY: "" }, "review body from test");`,
      ],
      {
        env: { ...process.env, PATH: "/usr/bin:/bin" },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /review body from test/);
    assert.match(result.stdout, /Origin CLI is missing/);
  });

  it("asks for bugs rather than style notes", () => {
    const prompt = reviewPrompt("diff --git a/api/story/stream.ts");
    assert.match(prompt, /security|auth|privacy|story-generation/i);
    assert.match(prompt, /diff --git a\/api\/story\/stream.ts/);
  });
});
