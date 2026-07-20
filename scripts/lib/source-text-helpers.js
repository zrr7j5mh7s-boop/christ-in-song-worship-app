"use strict";

function normalizeSource(source) {
  return String(source).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function extractSetSearchModeBindBlock(source) {
  const normalized = normalizeSource(source);
  const match = normalized.match(
    /if\s*\(\s*command\s*===\s*"set-search-mode"\s*\)\s*\{[\s\S]*?return;\s*\}/,
  );
  return match ? match[0] : null;
}

function assertSetSearchModeBindSpecialCase(assert, source, label) {
  const block = extractSetSearchModeBindBlock(source);
  assert.ok(block, `${label}: bindWorkspace must special-case set-search-mode`);
  assert.match(block, /addEventListener\s*\(\s*"click"/);
  assert.match(block, /addEventListener\s*\(\s*"keydown"/);
  assert.match(block, /event\.key\s*===\s*"Enter"/);
  assert.match(block, /event\.key\s*===\s*" "/);
  assert.match(block, /event\.preventDefault\s*\(\s*\)/);
  return block;
}

function testSetSearchModeBindSourceRegression(assert) {
  const correct = `
      if (command === "set-search-mode") {
        element.addEventListener("click", () => handlers(command, element));
        element.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handlers(command, element);
          }
        });
        return;
      }`;

  assertSetSearchModeBindSpecialCase(assert, correct, "LF fixture");
  assertSetSearchModeBindSpecialCase(assert, correct.replace(/\n/g, "\r\n"), "CRLF fixture");
  assertSetSearchModeBindSpecialCase(
    assert,
    correct.replace(/\n/g, "\r").replace(/\{/g, " {\n"),
    "CR fixture",
  );
  assertSetSearchModeBindSpecialCase(
    assert,
    correct.replace(/\s{2}/g, "    "),
    "expanded whitespace fixture",
  );

  const incorrect = `
      if (command === "set-search-mode") {
        element.addEventListener("click", () => handlers(command, element));
        return;
      }`;
  const incorrectBlock = extractSetSearchModeBindBlock(incorrect);
  assert.ok(incorrectBlock, "incorrect fixture should still parse bind block");
  assert.doesNotMatch(
    incorrectBlock,
    /addEventListener\s*\(\s*"keydown"/,
    "incorrect implementation must fail keyboard special-case assertion",
  );
}

module.exports = {
  normalizeSource,
  extractSetSearchModeBindBlock,
  assertSetSearchModeBindSpecialCase,
  testSetSearchModeBindSourceRegression,
};
