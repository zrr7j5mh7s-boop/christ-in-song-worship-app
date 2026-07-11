#!/usr/bin/env node
// scripts/test-help-centre.js

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function loadModule(file, exportName) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const storage = new Map();
  const window = {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  };
  const fn = new Function('window', `${source}; return window.${exportName};`);
  return fn(window);
}

function loadHelpSearch() {
  const storage = new Map();
  const window = {
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  };
  const fuse = fs.readFileSync(path.join(ROOT, 'app/vendor/fuse.min.js'), 'utf8');
  const content = fs.readFileSync(path.join(ROOT, 'app/help/help-content.js'), 'utf8');
  const store = fs.readFileSync(path.join(ROOT, 'app/help/help-store.js'), 'utf8');
  const search = fs.readFileSync(path.join(ROOT, 'app/help/help-search.js'), 'utf8');
  const fn = new Function('window', `${fuse}\n${content}\n${store}\n${search}; return window.CISHelpSearch;`);
  return fn(window);
}

function run() {
  const content = loadModule('app/help/help-content.js', 'CISHelpContent');
  const store = loadModule('app/help/help-store.js', 'CISHelpStore');
  const diagnostics = loadModule('app/help/help-diagnostics.js', 'CISHelpDiagnostics');
  const search = loadHelpSearch();

  assert.ok(content.CATEGORIES.length >= 12, 'expected 12+ help categories');
  assert.ok(content.ARTICLES.length >= 30, 'expected substantial article count');
  assert.ok(content.FAQS.length >= 10, 'expected FAQs');
  assert.ok(content.GLOSSARY.length >= 10, 'expected glossary terms');

  const requiredCategories = [
    'start-here', 'worship-service', 'bible', 'hymns', 'obs', 'media',
    'shortcuts', 'troubleshooting', 'emergency', 'training', 'backup', 'about',
  ];
  requiredCategories.forEach((id) => {
    assert.ok(content.getCategory(id), `missing category ${id}`);
  });

  const obsArticle = content.getArticle('obs-connect');
  assert.ok(obsArticle, 'obs connect article required');
  assert.ok(obsArticle.howToUse && obsArticle.howToUse.length >= 3);

  assert.ok(content.getArticle('emergency-help'), 'emergency help article required');
  assert.ok(content.getArticle('training-overview'), 'training overview article required');

  store.toggleChecklistItem('setup', 'open-app', true);
  const progress = store.checklistProgress('setup', content.SETUP_CHECKLIST.length);
  assert.equal(progress.done, 1);
  store.resetChecklist('setup');

  store.toggleChecklistItem('pre-service', 'projector', true);
  const pre = store.getChecklist('pre-service');
  assert.ok(pre.serviceDate, 'pre-service checklist should track service date');
  assert.equal(pre.items.projector, true);

  search.init();
  const obsQuery = search.search('OBS disconnected');
  assert.ok(obsQuery.results.some((row) => row.id === 'obs-disconnected' || row.id === 'obs-connect'), 'OBS disconnected search');

  const projectorQuery = search.search('projector blank');
  assert.ok(projectorQuery.results.length > 0, 'projector blank search');

  const bibleQuery = search.search('John 3:16');
  assert.ok(bibleQuery.results.some((row) => row.id === 'bible-search-reference'), 'John 3:16 search');

  const report = diagnostics.gatherDiagnostics({
    desktopInfo: { version: '1.0.0' },
    obsStatus: { connected: false, hasPassword: true, password: 'secret' },
  });
  assert.equal(report.obs.password, undefined);
  assert.ok(!JSON.stringify(report).includes('secret'));

  const helpFiles = [
    'app/help/help-ui.js',
    'app/help/help-search.js',
    'app/help/help-store.js',
    'app/help/help-content.js',
    'app/help/help-contextual.js',
    'app/help/help-checklists.js',
    'app/help/help-diagnostics.js',
    'app/help/help-training.js',
    'app/help/help-icons.js',
  ];
  helpFiles.forEach((file) => assert.ok(fs.existsSync(path.join(ROOT, file)), `missing ${file}`));

  const appJs = fs.readFileSync(path.join(ROOT, 'app/app.js'), 'utf8');
  assert.ok(appJs.includes('renderHelpCentre'), 'app.js must render help centre');
  assert.ok(appJs.includes('id: "help"'), 'help nav entry required');
  assert.ok(appJs.includes('help-open-emergency'), 'emergency help command required');
  assert.ok(appJs.includes('renderHelpContextOverlay'), 'contextual help overlay required');
  assert.ok(appJs.includes('helpContextRoot'), 'help context root required');

  const indexHtml = fs.readFileSync(path.join(ROOT, 'app/index.html'), 'utf8');
  assert.ok(indexHtml.includes('help/help-ui.js'), 'help scripts must be in index.html');
  assert.ok(indexHtml.includes('helpContextRoot'), 'help context root in index.html');

  console.log('test-help-centre: all checks passed');
}

run();
