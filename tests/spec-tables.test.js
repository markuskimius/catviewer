// Checks that the spec tables embedded in index.html match the official CAT
// Industry Member JSON schema files. Run with: node --test tests/
//
// The schema files are published at https://www.catnmsplan.com/specifications/im
// and kept in the repository root under their official names. If one is
// missing, its tests are skipped with a message saying which file to download.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const gen = require('../tools/gen-spec.js');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const BASE_FILE = '03.18.26-IM-4.1.0-r15.json';
const DELTA_FILES = ['08.14.26-IM-4.2.0.json'];

// Values the viewer accepts beyond the base schema: exchanges that v4.2.0
// added and that went into production before the v4.2.0 cutover
const BASE_EXTRA_EXCHANGES = ['IEXOP', 'MX2OP'];

const missing = [BASE_FILE, ...DELTA_FILES].filter(f => !fs.existsSync(path.join(ROOT, f)));
const skip = missing.length ? `schema file(s) not present: ${missing.join(', ')} — download from https://www.catnmsplan.com/specifications/im` : false;

const tableSource = name => {
    const i = html.indexOf(`const ${name} = `);
    assert.ok(i >= 0, `could not find ${name} in index.html`);
    // The declaration ends at the first line that ends with ";" (table rows end with ",")
    return html.slice(i, html.indexOf(';\n', i) + 1);
};
const embedded = name => new Function(`${tableSource(name)}; return ${name};`)();

describe('base tables (v4.1.0 r15)', { skip }, () => {
    const official = skip ? null : gen.buildTables(JSON.parse(fs.readFileSync(path.join(ROOT, BASE_FILE), 'utf8')));

    test('CAT_SCHEMA matches field for field', () => {
        assert.deepStrictEqual(embedded('CAT_SCHEMA'), official.schema);
    });

    test('CAT_CSV_FIELDS matches position for position', () => {
        const csv = embedded('CAT_CSV_FIELDS');
        assert.deepStrictEqual(Object.keys(csv).sort(), Object.keys(official.csvFields).sort());
        for (const [t, cols] of Object.entries(official.csvFields)) {
            assert.deepStrictEqual(csv[t], Array.from(cols, c => c), t);
        }
    });

    test('CAT_ARRAY_ELEMENTS matches', () => {
        assert.deepStrictEqual(embedded('CAT_ARRAY_ELEMENTS'), official.arrayElements);
    });

    test('CAT_ALLOWED_TYPES matches the Message Type values', () => {
        assert.deepStrictEqual([...embedded('CAT_ALLOWED_TYPES')].sort(), [...official.types].sort());
    });

    test('CAT_ALLOWED_EXCHANGES matches the Exchange ID values plus the documented extras', () => {
        assert.deepStrictEqual([...embedded('CAT_ALLOWED_EXCHANGES')].sort(), [...official.exchanges, ...BASE_EXTRA_EXCHANGES].sort());
    });

    test('CAT_CHOICE_VALUES matches every choice list (marketCenterID plus the documented extras)', () => {
        const choices = embedded('CAT_CHOICE_VALUES');
        assert.deepStrictEqual(Object.keys(choices).sort(), Object.keys(official.choices).sort());
        for (const [k, v] of Object.entries(official.choices)) {
            const expected = k === 'marketCenterID' ? [...v, ...BASE_EXTRA_EXCHANGES] : v;
            assert.deepStrictEqual([...choices[k]].sort(), [...expected].sort(), k);
        }
    });
});

describe('generated spec deltas', { skip }, () => {
    test('the embedded CAT_SPEC_DELTAS block is what tools/gen-spec.js generates', () => {
        const entries = gen.deltasFromFiles(path.join(ROOT, BASE_FILE), DELTA_FILES.map(f => path.join(ROOT, f)));
        const expected = gen.renderDeltas(entries);
        const actual = gen.embeddedDeltasBlock(html);
        assert.ok(actual, 'index.html has no generated:spec-deltas block');
        assert.strictEqual(actual, expected,
            'CAT_SPEC_DELTAS is stale — run: node tools/gen-spec.js ' + [BASE_FILE, ...DELTA_FILES].join(' ') + ' --write');
    });

    test('name/value pair attribute sets are unchanged (they are hand-maintained in index.html)', () => {
        const entries = gen.deltasFromFiles(path.join(ROOT, BASE_FILE), DELTA_FILES.map(f => path.join(ROOT, f)));
        for (const e of entries) assert.deepStrictEqual(e.nvpWarnings, [], `v${e.version}`);
    });
});

describe('ruleTail', () => {
    test('maps every official data type and rejects unknown ones', () => {
        assert.deepStrictEqual(gen.ruleTail('Text (64)'), ['S', 64]);
        assert.deepStrictEqual(gen.ruleTail('Text (0)'), ['S']);
        assert.deepStrictEqual(gen.ruleTail(['Industry Member ID', 'Exchange ID']), ['S', 16]);
        assert.deepStrictEqual(gen.ruleTail('Price'), ['N', 10, 8]);
        assert.throws(() => gen.ruleTail('Mystery'), /Unknown dataType/);
    });
});
