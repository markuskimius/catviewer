// Tests for the filters shown by default (DEFAULT_FILTERS): the list itself,
// the desktop/mobile switch, and that every default names a real, visible
// column that the sample file populates.
// Run with: node --test tests/
//
// Code under test is extracted from index.html by pattern (see
// chain-order.test.js); extraction failures fail loudly.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SAMPLE_FILE = '1234_TEST_20250317_Sample_OrderEvents_000001.json';

function extract(pattern, label) {
    const m = html.match(pattern);
    assert.ok(m, `could not extract ${label} from index.html`);
    return m[0];
}

// --- Code under test, extracted from index.html ---

const filtersSnippet = extract(
    /const DEFAULT_FILTERS = \[[^\]]*\];\nconst DEFAULT_FILTERS_MOBILE = \[[^\]]*\];\nfunction isMobileLayout\(\) \{[^\n]*\}\nfunction defaultFilters\(\) \{[^\n]*\}/,
    'DEFAULT_FILTERS / isMobileLayout / defaultFilters'
);
const prioritySnippet = extract(/const PRIORITY_COLUMNS = \[[^\]]*\];/, 'PRIORITY_COLUMNS');
const hiddenSnippet = extract(
    /const DEFAULT_HIDDEN_COLUMNS = new Set\(\[[^\]]*\]\);\nfunction isDefaultHiddenColumn\(col\) \{[\s\S]*?\n\}/,
    'DEFAULT_HIDDEN_COLUMNS / isDefaultHiddenColumn'
);
const nvpSnippet = extract(
    /const NVP_FIELDS[\s\S]*?function isNVPAttrColumn\(col\) \{[\s\S]*?\n\}/,
    'NVP_FIELDS / isNVPAttrColumn'
);
const csvFieldsSnippet = extract(/const CAT_CSV_FIELDS = \{[\s\S]*?\n\};/, 'CAT_CSV_FIELDS');

// window and matchMedia are injected so each test picks its own viewport
function loadFilters(viewport) {
    const window = { innerWidth: viewport.width, innerHeight: viewport.height };
    const matchMedia = () => ({ matches: !!viewport.coarse });
    return new Function('window', 'matchMedia', `
        ${filtersSnippet}
        return { DEFAULT_FILTERS, DEFAULT_FILTERS_MOBILE, isMobileLayout, defaultFilters };
    `)(window, matchMedia);
}

const DESKTOP = { width: 1440, height: 900, coarse: false };
const { DEFAULT_FILTERS, DEFAULT_FILTERS_MOBILE } = loadFilters(DESKTOP);

const { PRIORITY_COLUMNS, isDefaultHiddenColumn, CAT_CSV_FIELDS } = new Function(`
    ${prioritySnippet}
    ${nvpSnippet}
    ${hiddenSnippet}
    ${csvFieldsSnippet}
    return { PRIORITY_COLUMNS, isDefaultHiddenColumn, CAT_CSV_FIELDS };
`)();

const sampleRecords = fs.readFileSync(path.join(ROOT, SAMPLE_FILE), 'utf8')
    .split('\n').filter(l => l.trim()).map(l => JSON.parse(l));

describe('default filter list', () => {
    test('is type, actionType, symbol, side, orderID in that order', () => {
        assert.deepStrictEqual(DEFAULT_FILTERS, ['type', 'actionType', 'symbol', 'side', 'orderID']);
    });

    test('has no option-only fields', () => {
        for (const col of ['underlying', 'optionID']) {
            assert.ok(!DEFAULT_FILTERS.includes(col), `${col} should not be a default filter`);
        }
    });

    test('has no duplicates', () => {
        assert.strictEqual(new Set(DEFAULT_FILTERS).size, DEFAULT_FILTERS.length);
    });

    test('mobile layout starts with no filters', () => {
        assert.deepStrictEqual(DEFAULT_FILTERS_MOBILE, []);
    });
});

describe('defaultFilters()', () => {
    test('returns the desktop list on a wide viewport', () => {
        const f = loadFilters(DESKTOP);
        assert.strictEqual(f.isMobileLayout(), false);
        assert.strictEqual(f.defaultFilters(), f.DEFAULT_FILTERS);
    });

    test('returns the mobile list at 768px wide or less', () => {
        const f = loadFilters({ width: 768, height: 1024, coarse: false });
        assert.strictEqual(f.isMobileLayout(), true);
        assert.strictEqual(f.defaultFilters(), f.DEFAULT_FILTERS_MOBILE);
    });

    test('returns the desktop list at 769px wide', () => {
        const f = loadFilters({ width: 769, height: 1024, coarse: false });
        assert.strictEqual(f.isMobileLayout(), false);
        assert.strictEqual(f.defaultFilters(), f.DEFAULT_FILTERS);
    });

    test('treats a short touch viewport (landscape phone) as mobile', () => {
        const f = loadFilters({ width: 900, height: 400, coarse: true });
        assert.strictEqual(f.isMobileLayout(), true);
        assert.strictEqual(f.defaultFilters(), f.DEFAULT_FILTERS_MOBILE);
    });

    test('treats a short viewport with a fine pointer as desktop', () => {
        const f = loadFilters({ width: 900, height: 400, coarse: false });
        assert.strictEqual(f.isMobileLayout(), false);
        assert.strictEqual(f.defaultFilters(), f.DEFAULT_FILTERS);
    });

    test('callers copying the result cannot change the defaults', () => {
        const f = loadFilters(DESKTOP);
        const active = [...f.defaultFilters()];
        active.push('firmDesignatedID');
        assert.deepStrictEqual(f.DEFAULT_FILTERS, ['type', 'actionType', 'symbol', 'side', 'orderID']);
    });
});

describe('default filters name real columns', () => {
    test('each is a priority column', () => {
        for (const col of DEFAULT_FILTERS) {
            assert.ok(PRIORITY_COLUMNS.includes(col), `${col} is not in PRIORITY_COLUMNS`);
        }
    });

    test('none is hidden by default', () => {
        for (const col of DEFAULT_FILTERS) {
            assert.ok(!isDefaultHiddenColumn(col), `${col} is hidden by default`);
        }
    });

    test('each is a CSV field of at least one event type', () => {
        const layouts = Object.values(CAT_CSV_FIELDS);
        assert.ok(layouts.length > 0, 'CAT_CSV_FIELDS is empty');
        for (const col of DEFAULT_FILTERS) {
            assert.ok(layouts.some(fields => fields.includes(col)), `${col} is not in any CSV layout`);
        }
    });

    test('type and actionType are in every event layout', () => {
        for (const [type, fields] of Object.entries(CAT_CSV_FIELDS)) {
            for (const col of ['type', 'actionType']) {
                assert.ok(fields.includes(col), `${type} has no ${col}`);
            }
        }
    });

    test('each is populated in most sample records', () => {
        for (const col of DEFAULT_FILTERS) {
            const populated = sampleRecords.filter(r => r[col] !== undefined && r[col] !== '').length;
            assert.ok(populated > sampleRecords.length / 2, `${col} is populated in only ${populated} of ${sampleRecords.length} sample records`);
        }
    });
});
