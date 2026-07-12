#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

function loadModule(file, extraSandbox) {
  const source = read(file);
  const sandbox = { window: {}, console, ...(extraSandbox || {}) };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

function makeSong(number, title, slides) {
  return {
    number,
    title,
    slides: slides || [
      { label: "Stanza 1", body: "Line one" },
      { label: "Chorus", body: "Sing again" },
      { label: "Stanza 2", body: "Line two" },
    ],
  };
}

async function run() {
  const settingsWin = loadModule("app/hymn-queue/live-hymn-queue-settings.js");
  const uiWin = loadModule("app/hymn-queue/live-hymn-queue-ui.js");
  const serviceWin = loadModule("app/hymn-queue/live-hymn-queue-service.js", {
    window: { ...settingsWin, CISLiveHymnQueueSettings: settingsWin.CISLiveHymnQueueSettings },
  });

  const service = serviceWin.CISLiveHymnQueueService;
  const ui = uiWin.CISLiveHymnQueueUI;

  const songs = {
    "christ-in-song-zulu:051": makeSong("051", "Re Kolobetše", [
      { label: "Stanza 1", body: "Zulu 1" },
      { label: "Stanza 2", body: "Zulu 2" },
      { label: "Chorus", body: "Pinda" },
    ]),
    "sda-hymnal-english:108": makeSong("108", "Amazing Grace", [
      { label: "Stanza 1", body: "Grace" },
      { label: "Refrain", body: "Saved" },
    ]),
    "christ-in-song-zulu:120": makeSong("120", "Another Zulu", [
      { label: "Stanza 1", body: "More zulu" },
    ]),
  };

  let liveMeta = {
    songKey: "christ-in-song-zulu:051",
    hymnBookId: "christ-in-song",
    editionId: "christ-in-song-zulu",
    hymnId: "christ-in-song-zulu:051",
    hymnNumber: "051",
    title: "Re Kolobetše",
    shortLabel: "Christ in Song · Zulu · Hymn 051",
    slideIndex: 1,
    stanzaLabel: "Stanza 2",
  };

  const session = [];
  let goLiveCalls = 0;

  service.configure({
    resolveSong: async (songKey) => songs[songKey] || null,
    describeSongKey: (songKey) => {
      const song = songs[songKey];
      if (!song) return null;
      const editionId = songKey.split(":")[0];
      const book = editionId.includes("sda") ? "SDA Hymnal" : "Christ in Song";
      const lang = editionId.includes("english") ? "English" : "Zulu";
      return {
        hymnBookId: book.toLowerCase().replace(/\s+/g, "-"),
        editionId,
        hymnId: songKey,
        hymnNumber: song.number,
        title: song.title,
        shortLabel: `${book} · ${lang} · Hymn ${song.number}`,
        chorusLabel: "Chorus",
      };
    },
    getLiveMeta: () => liveMeta,
    goLive: async ({ songKey, slideIndex }) => {
      goLiveCalls += 1;
      const song = songs[songKey];
      if (!song) return { ok: false, message: "Missing" };
      liveMeta = {
        songKey,
        hymnNumber: song.number,
        title: song.title,
        shortLabel: service.describeSongKey ? service.describeSongKey(songKey)?.shortLabel : song.title,
        slideIndex,
        stanzaLabel: song.slides[slideIndex]?.label || "",
      };
      return { ok: true };
    },
    findChorusSlide: (song) => (song.slides || []).findIndex((slide) => /chorus|refrain|pinda|impinda/i.test(slide.label || "")),
    saveSession: (payload) => session.push(JSON.parse(JSON.stringify(payload))),
    loadSession: () => session[session.length - 1] || null,
    loadSettings: () => settingsWin.CISLiveHymnQueueSettings.load(() => null),
  });

  assert.equal(liveMeta.songKey, "christ-in-song-zulu:051");

  service.setPreview("sda-hymnal-english:108");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(liveMeta.songKey, "christ-in-song-zulu:051", "preview must not change live");

  service.setAsNext("sda-hymnal-english:108");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(service.getState().next.songKey, "sda-hymnal-english:108");
  assert.equal(liveMeta.songKey, "christ-in-song-zulu:051", "set next must not change live");

  service.addToQueue("christ-in-song-zulu:120");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(service.getState().queue.length, 1);

  service.replaceNext("sda-hymnal-english:108");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(service.getState().next.songKey, "sda-hymnal-english:108");

  service.moveQueueItem(service.getState().queue[0].id, -1);
  assert.equal(service.getState().queue.length, 1);

  const promoted = service.promoteQueueItem(service.getState().queue[0].id);
  assert.equal(promoted, true);
  assert.equal(service.getState().next.songKey, "christ-in-song-zulu:120");

  service.setAsNext("sda-hymnal-english:108", { startAtChorus: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(service.getState().next.startSlideIndex, 1);

  service.clearQueue();
  service.addToQueue("christ-in-song-zulu:120");
  await new Promise((resolve) => setTimeout(resolve, 0));

  const take = await service.takeNextLive();
  assert.equal(take.ok, true);
  assert.equal(liveMeta.songKey, "sda-hymnal-english:108");
  assert.equal(service.getState().history[0].songKey, "christ-in-song-zulu:051");
  assert.equal(service.getState().next.songKey, "christ-in-song-zulu:120", "queue auto-advances");

  service.updateSettings({ autoAdvanceQueue: false }, false);
  service.setAsNext("christ-in-song-zulu:120");
  await service.takeNextLive();
  assert.equal(service.getState().next, null, "auto advance disabled");
  assert.equal(liveMeta.songKey, "christ-in-song-zulu:120");

  const missing = await service.sendLiveNow("missing-edition:001");
  assert.equal(missing.ok, false);
  assert.equal(liveMeta.songKey, "christ-in-song-zulu:120", "failed preload preserves live");

  const expectedRestore = service.getState().history[0]?.songKey;
  const restore = await service.restorePrevious();
  assert.equal(restore.ok, true);
  assert.equal(liveMeta.songKey, expectedRestore);

  service.clearQueue();
  service.removeNext();
  assert.equal(service.getState().next, null);

  const html = ui.renderWorkspace({
    queueState: { ...service.getState(), next: service.buildItemFromSongKey("sda-hymnal-english:108") },
    liveMeta,
    showQuickSearch: true,
  });
  assert.match(html, /Currently Live/);
  assert.match(html, /Next Hymn/);
  assert.match(html, /Upcoming Queue/);
  assert.match(html, /Take Next Live/);

  const actions = ui.renderQueueActions("christ-in-song-zulu:051", true);
  assert.match(actions, /Set as Next/);
  assert.match(actions, /Add to Queue/);

  const appSource = read("app/app.js");
  assert.match(appSource, /setupLiveHymnQueue/);
  assert.match(appSource, /handleHymnQueueCommand/);
  assert.match(appSource, /paintLiveHymnQueuePanels/);

  const indexHtml = read("app/index.html");
  assert.match(indexHtml, /live-hymn-queue-service\.js/);

  console.log("test-live-hymn-queue: all assertions passed");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
