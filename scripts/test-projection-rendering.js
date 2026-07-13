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

function loadProjectionStack() {
  const catalog = {
    translations: [{ code: "KJV", name: "King James Version", abbreviation: "KJV", license: "Public domain", verseRecords: 31102 }],
    books: [{ order: 43, name: "John", testament: "NT", chapters: 21 }],
  };

  const sandbox = { window: {}, console };
  vm.createContext(sandbox);

  vm.runInContext(`
    const catalog = ${JSON.stringify(catalog)};
    ${read("app/bible-store.js").replace(
      "const catalog = window.CIS_BIBLE_CATALOG || { translations: [], books: [] };",
      "",
    )}
  `, sandbox);

  [
    "app/bible/bible-reference-parser.js",
    "app/presentation/projection-themes.js",
    "app/presentation/text-fit-engine.js",
    "app/presentation/slide-layout-engine.js",
    "app/presentation/projection-settings.js",
    "app/bible/bible-projection-settings.js",
    "app/bible/bible-projection-service.js",
    "app/presenter-output.js",
    "app/presenter-engine.js",
  ].forEach((file) => vm.runInContext(read(file), sandbox));

  return sandbox.window;
}

function mockVerses() {
  return [
    {
      verse: 1,
      text: "In the beginning God created the heaven and the earth. And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.",
    },
    { verse: 2, text: "And the earth was without form, and void; and darkness was upon the face of the deep." },
    { verse: 3, text: "And God said, Let there be light: and there was light." },
  ];
}

function run() {
  const modules = loadProjectionStack();
  const {
    CISProjectionThemes,
    CISTextFitEngine,
    CISlideLayoutEngine,
    CISProjectionSettings,
    CISBibleProjectionSettings,
    CISBibleProjectionService,
    CISPresenterEngine,
    CISPresenterOutput,
  } = modules;

  assert.ok(CISProjectionThemes, "projection themes module loads");
  assert.equal(CISProjectionThemes.ALLOWED_THEME_IDS.length, 6, "six approved themes");

  const theme = CISProjectionThemes.getTheme("scripture_focus");
  assert.equal(theme.minFontPx, 32);
  assert.ok(theme.safeMargin);

  const obsTheme = CISProjectionThemes.resolveThemeForProfile("classic_dark", "obs");
  assert.equal(obsTheme.id, "classic_dark");

  const stageTheme = CISProjectionThemes.resolveThemeForProfile("classic_dark", "stage");
  assert.equal(stageTheme.id, "stage_display");

  const longVerse = mockVerses()[0].text.repeat(3);
  const fit = CISTextFitEngine.fitContent({
    text: longVerse,
    theme,
    maxLines: 5,
  });
  assert.ok(fit.splitBodies && fit.splitBodies.length > 1, "long verses split across slides");
  assert.ok(fit.fontSize >= theme.minFontPx, "font never below minimum");

  const smallFit = CISTextFitEngine.fitContent({
    text: "The Lord is my shepherd;",
    theme,
  });
  assert.equal(smallFit.fontSize, Math.round(theme.preferredFontPx));

  CISBibleProjectionService.configure({
    loadSettings: () => CISBibleProjectionSettings.DEFAULTS,
    saveSettings: () => {},
  });

  const parsed = { bookOrder: 43, chapter: 3, verseStart: 16, verseEnd: 18 };
  const shortVerses = [
    { verse: 16, text: "For God so loved the world." },
    { verse: 17, text: "For God sent not his Son into the world to condemn the world." },
    { verse: 18, text: "He that believeth on him is not condemned." },
  ];

  const slidesOne = CISlideLayoutEngine.buildScriptureSlides(shortVerses, parsed, {
    settings: { versesPerSlide: 1, autoSplit: false, projectionTheme: "scripture_focus" },
    translation: "KJV",
  });
  assert.equal(slidesOne.length, 3, "one verse per slide default");

  const slidesTwo = CISlideLayoutEngine.buildScriptureSlides(shortVerses, parsed, {
    settings: { versesPerSlide: 2, autoSplit: false, projectionTheme: "scripture_focus" },
    translation: "KJV",
  });
  assert.equal(slidesTwo.length, 2, "two verses per slide option");

  const longSlides = CISlideLayoutEngine.buildScriptureSlides(mockVerses(), parsed, {
    settings: { versesPerSlide: "auto", verseGrouping: "auto", autoSplit: true, projectionTheme: "scripture_focus" },
    translation: "KJV",
  });
  assert.ok(longSlides.length >= 2, "long verses use automatic safe split");

  const dualSlides = CISlideLayoutEngine.buildScriptureSlides(mockVerses().slice(0, 1), parsed, {
    settings: {
      dualVersion: true,
      showVerseNumbers: true,
      showTranslationAbbr: true,
      versesPerSlide: 1,
      projectionTheme: "scripture_focus",
    },
    translation: "KJV",
    secondaryVerses: [{ verse: 1, text: "Secondary translation text for verse one." }],
  });
  assert.match(dualSlides[0].body, /Secondary translation text/);

  const hymnSong = {
    title: "Amazing Grace",
    number: 108,
    slides: [
      { label: "Verse 1", body: "Amazing grace how sweet the sound\nThat saved a wretch like me" },
      { label: "Chorus", body: "Praise God from whom all blessings flow" },
      { label: "Verse 2", body: "Line one\nLine two\nLine three\nLine four\nLine five\nLine six\nLine seven" },
      { label: "Stanza 4", body: "No stanza number overlap test" },
    ],
  };

  const hymnSlides = CISlideLayoutEngine.prepareHymnSlides(hymnSong, {
    projectionTheme: "classic_dark",
    hymnMaxLines: 5,
  });
  assert.ok(hymnSlides.length > hymnSong.slides.length, "long stanzas split safely");
  assert.equal(CISlideLayoutEngine.chorusClass("Chorus"), "is-chorus");
  assert.equal(CISlideLayoutEngine.chorusClass("Refrain"), "is-refrain");
  assert.equal(CISlideLayoutEngine.chorusClass("Pinda"), "is-pinda");
  assert.equal(CISlideLayoutEngine.chorusClass("Impinda"), "is-impinda");

  const saved = { themeId: "warm_worship", transition: "crossfade", hideTitleAfterFirst: false };
  const loaded = CISProjectionSettings.save(saved, (key, value) => {
    assert.equal(key, CISProjectionSettings.STORAGE_KEY);
    assert.deepEqual(value.themeId, "warm_worship");
  });
  assert.equal(loaded.themeId, "warm_worship");

  const rejected = CISProjectionSettings.load((key) => (
    key === CISProjectionSettings.STORAGE_KEY ? { themeId: "custom_unapproved" } : null
  ));
  assert.equal(rejected.themeId, CISProjectionSettings.DEFAULTS.themeId, "uncontrolled theme combinations rejected");

  CISPresenterEngine.configure({
    currentPresenterItem: () => ({
      type: "song",
      title: "Hymn 108 · Amazing Grace",
      shortTitle: "Hymn 108",
      slides: hymnSlides,
      contentKind: "hymn",
    }),
    nextContext: () => ({ nextSlide: hymnSlides[1], nextHymn: null }),
    getProjectionContext: () => ({
      themeId: "classic_dark",
      projectionTheme: "classic_dark",
      outputProfile: "projector",
      transition: "fade",
      hideTitleAfterFirst: true,
      showTranslationOnOutput: true,
      layout: "fullscreen",
    }),
  });
  CISPresenterEngine.patchState({ active: true, slideIndex: 1, displayMode: "lyrics" });
  const snapshot = CISPresenterEngine.buildSnapshot();
  assert.equal(snapshot.slide.kind, "chorus");
  assert.equal(snapshot.hideTitleAfterFirst, true);
  assert.ok(snapshot.nextSlide);

  const outputSource = read("app/presenter-output.js");
  assert.ok(!outputSource.includes("renderEmergencyReturn"), "no operator controls on congregation output");
  assert.ok(!outputSource.includes("data-command"), "no operator command hooks on congregation output");

  const screenSource = read("app/presenter-screen.js");
  assert.ok(screenSource.includes('cursor = "none"'), "projector window hides mouse pointer");

  const sw = read("app/sw.js");
  assert.match(sw, /christ-in-song-worship-v47/);
  assert.ok(sw.includes("projection-themes.js"));
  assert.ok(sw.includes("text-fit-engine.js"));
  assert.ok(sw.includes("slide-layout-engine.js"));

  const styles = read("app/styles.css");
  assert.ok(styles.includes("projector-safe-area"));
  assert.ok(styles.includes("projector-layout-lower-third"));
  assert.ok(styles.includes("projector-transition-fade"));
  assert.ok(styles.includes("aspect-ratio: 4/3"));

  const resolutions = ["16:9", "4:3"];
  resolutions.forEach((ratio) => {
    const margin = theme.safeMargin;
    assert.ok(margin.endsWith("vmin"), `${ratio} safe margins use viewport units`);
  });

  console.log("test:projection-rendering — all assertions passed");
}

run();
