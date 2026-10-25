/**
 * test/test-dashboard-search.js - Cross-panel search indexing, stemming and scoring
 */

var assert = require('assert');
var fs = require('fs');
var path = require('path');

console.log('Running test-dashboard-search.js ...');

var code = fs.readFileSync(path.join(__dirname, '../server/assets/ui/search.js'), 'utf8');
var aliasesCode = fs.readFileSync(path.join(__dirname, '../server/assets/ui/search-aliases.js'), 'utf8');

// Basic syntax check
assert(code.indexOf('function scoreItem') !== -1, 'scoreItem function defined');
assert(code.indexOf('function normalizeQuery') !== -1, 'normalizeQuery function defined');
assert(code.indexOf('function indexTabs') !== -1, 'indexTabs function defined');
assert(code.indexOf('function indexSections') !== -1, 'indexSections function defined');
assert(code.indexOf('function indexLogLines') !== -1, 'indexLogLines function defined');
assert(code.indexOf('function indexControls') !== -1, 'indexControls function defined');
assert(code.indexOf("section.className = 'search-result-section'") !== -1, 'search results show category labels');
assert(code.indexOf("kind.className = 'search-result-kind'") !== -1, 'search results show type labels');
assert(code.indexOf('row.dataset.kind') !== -1, 'search results expose their type for styling');
assert(code.indexOf('tabTitle: tabLabel(tab)') !== -1, 'search results use dashboard tab names as categories');
assert(code.indexOf("t('search.category'") !== -1, 'category labels are translated');
assert(aliasesCode.indexOf("'system logs'") !== -1, 'search includes natural-language log aliases');
assert(aliasesCode.indexOf("'variable refresh rate'") !== -1, 'search includes expanded gaming aliases');
assert(aliasesCode.indexOf("'home assistant'") !== -1, 'search includes service aliases');
assert(code.indexOf("tab === 'metrics' || tab === 'apps'") === -1, 'metrics and apps tabs are not blocked from search');
assert(code.indexOf("closest('#apps-installed-list')") !== -1, 'installed apps stay excluded from search');
assert(code.indexOf("nextElementSibling && row.nextElementSibling.classList.contains('log-detail')") === -1, 'log indexing has no dead details lookup');

// On legacy Node (0.10/0.12), browser ES6 cannot be evaluated directly
if (process.version.indexOf('v0.10') === 0 || process.version.indexOf('v0.12') === 0) {
  console.log('  - skipped: search.js runs in modern browser, needs Node >= 4 for unit eval');
  console.log('ALL test-dashboard-search.js assertions passed!');
  process.exit(0);
}

// Extract normalizeQuery and scoreItem for direct unit verification
var sandbox = {
  escapeRegExp: function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); },
  fuzzyMatch: function (query, text) {
    return query.length >= 5 && text.indexOf(query) !== -1;
  }
};

// Evaluate helper functions in sandbox
var normMatch = code.match(/function normalizeQuery\([\s\S]*?^  \}/m);
assert(normMatch, 'Found normalizeQuery implementation');
eval('sandbox.normalizeQuery = ' + normMatch[0]);

var scoreMatch = code.match(/function scoreItem\([\s\S]*?^  \}/m);
assert(scoreMatch, 'Found scoreItem implementation');
eval('sandbox.scoreItem = ' + scoreMatch[0].replace('fuzzyMatch', 'sandbox.fuzzyMatch').replace('escapeRegExp', 'sandbox.escapeRegExp'));

// 1. Plural and suffix normalization
assert.deepEqual(sandbox.normalizeQuery('screensaver'), ['screensaver']);
assert.deepEqual(sandbox.normalizeQuery('screensavers'), ['screensavers', 'screensaver']);
assert.deepEqual(sandbox.normalizeQuery('logs'), ['logs', 'log']);
assert.deepEqual(sandbox.normalizeQuery('gsr'), ['gsr']);
assert.deepEqual(sandbox.normalizeQuery('wireless'), ['wireless']); // ends in ss, not stripped

// 2. Mock items representing the dashboard DOM
var oledGsr = {
  key: 'oled:gsr',
  title: 'Global Stress Reduction (GSR)',
  kind: 'setting',
  tab: 'oledcare',
  tabTitle: 'OLED Care',
  aliases: ['gsr', 'burn-in', 'dimming', 'stationary', 'hud'],
  searchText: 'Global Stress Reduction GSR Dims the whole screen when it detects a stationary element'
};

var screensaverTab = {
  key: 'tab:screensaver',
  title: 'Screensaver',
  kind: 'tab',
  tab: 'screensaver',
  tabTitle: 'Tab',
  aliases: ['screensavers', 'screen saver', 'screen savers', 'display sleep', 'art', 'clock'],
  searchText: 'Screensaver screensavers screen saver'
};

var screensaverButton = {
  key: 'act:btn_ss',
  title: 'Screensaver',
  kind: 'action',
  tab: 'control',
  tabTitle: 'Control · Panel',
  aliases: ['screensaver', 'screensavers'],
  searchText: 'Screensaver Panel'
};

var toolsTab = {
  key: 'tab:tools',
  title: 'Tools',
  kind: 'tab',
  tab: 'tools',
  tabTitle: 'Tab',
  aliases: ['logs', 'log', 'syslog', 'dmesg', 'kernel', 'glasshouse log', 'terminal', 'diagnostics'],
  searchText: 'Tools logs syslog dmesg'
};

var systemLogsSec = {
  key: 'sec:pv-sec:tools',
  title: 'System logs',
  kind: 'section',
  tab: 'tools',
  tabTitle: 'Tools',
  aliases: ['logs', 'syslog', 'dmesg'],
  searchText: 'System logs Logs from the TV, Glasshouse and hardware'
};

// Test GSR search
var gsrForms = sandbox.normalizeQuery('GSR');
var gsrScore = sandbox.scoreItem(oledGsr, gsrForms);
assert(gsrScore >= 450, 'GSR matches OLED Care GSR protection with high score (got ' + gsrScore + ')');

// Test logs search
var logsForms = sandbox.normalizeQuery('logs');
var toolsScore = sandbox.scoreItem(toolsTab, logsForms);
var logsSecScore = sandbox.scoreItem(systemLogsSec, logsForms);
assert(toolsScore >= 450, 'logs query matches Tools tab alias');
assert(logsSecScore >= 300, 'logs query matches System logs heading');

// Test multi-word searches match meaningful words, not only exact phrases
var multiWord = sandbox.normalizeQuery('system log');
multiWord.tokens = ['system', 'log'];
assert(sandbox.scoreItem(systemLogsSec, multiWord) > 0, 'system log matches by individual words');

// Test screensaver search
var ssForms = sandbox.normalizeQuery('screensaver');
var ssTabScore = sandbox.scoreItem(screensaverTab, ssForms);
var ssBtnScore = sandbox.scoreItem(screensaverButton, ssForms);
assert(ssTabScore > ssBtnScore, 'Screensaver tab ranks above action button');
assert(ssBtnScore >= 500, 'Screensaver action button has exact title match');

// Test screensavers plural search
var sssForms = sandbox.normalizeQuery('screensavers');
var sssTabScore = sandbox.scoreItem(screensaverTab, sssForms);
var sssBtnScore = sandbox.scoreItem(screensaverButton, sssForms);
assert(sssTabScore >= 450, 'screensavers matches Screensaver tab');
assert(sssBtnScore >= 450, 'screensavers matches Screensaver action button');

console.log('ALL test-dashboard-search.js assertions passed!');
