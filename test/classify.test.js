const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getFileCategory,
  isTestArtifact,
  isTestFile,
  normalizeFilePath,
} = require("../src/classify.js");

test("recognizes common test files and directories", () => {
  const testFiles = [
    "api/handler_test.go",
    "src/button.spec.tsx",
    "src/button.test.js",
    "tests/test_checkout.py",
    "packages/web/__tests__/header.tsx",
    "e2e/login-flow.ts",
    "playwright.config.ts",
    "snapshots/card.snap",
  ];

  for (const filePath of testFiles) {
    assert.equal(isTestFile(filePath), true, filePath);
  }
});

test("does not hide production files with test-like words", () => {
  const sourceFiles = [
    "src/testing-utils.ts",
    "src/contest.ts",
    "src/latest.py",
    "docs/testing-strategy.md",
    "docs/specs/architecture.md",
    "app/testimonials/page.tsx",
    "internal/specification/parser.go",
  ];

  for (const filePath of sourceFiles) {
    assert.equal(isTestFile(filePath), false, filePath);
  }
});

test("normalizes URL-encoded paths", () => {
  assert.equal(
    normalizeFilePath("/src/button%20group.test.tsx?diff=split#L20"),
    "src/button group.test.tsx",
  );
});

test("removes GitHub's bidirectional path markers", () => {
  assert.equal(
    normalizeFilePath("\u200etemplates/backend/tests/conftest.py\u200e"),
    "templates/backend/tests/conftest.py",
  );
});

test("splits config, migrations, and test artifacts from source code", () => {
  const categories = new Map([
    ["src/app.go", "source"],
    ["config/app.json", "config"],
    ["deploy/values.yaml", "config"],
    ["db/migrations/001_create_users.sql", "migrations"],
    ["tests/parser_test.go", "tests"],
    ["tests/config.yaml", "tests"],
    ["tests/schema.sql", "tests"],
    ["tests/fixtures/user.json", "artifacts"],
    ["pkg/__snapshots__/output.snap", "artifacts"],
    ["testdata/golden-response.json", "artifacts"],
  ]);

  for (const [filePath, category] of categories) {
    assert.equal(getFileCategory(filePath), category, filePath);
  }
  assert.equal(isTestArtifact("tests/fixtures/user.json"), true);
  assert.equal(isTestFile("tests/fixtures/user.json"), true);
});