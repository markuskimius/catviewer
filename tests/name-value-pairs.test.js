// Tests for Name/Value Pair fields (handlingInstructions, bid/askRelativePrice):
// CSV/JSON parsing, flattening into summary + per-attribute columns, and column
// discovery across records of the same event type.
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

const nvpSnippet = extract(
    /const NVP_FIELDS[\s\S]*?function isNVPAttrColumn\(col\) \{[\s\S]*?\n\}/,
    'NVP_FIELDS / parseNameValuePairs / isNVPAttrColumn'
);
const flattenSnippet = extract(/function flattenRecord\(record\) \{[\s\S]*?\n\}/, 'flattenRecord');
const internalSnippet = extract(/const _internalFields = new Set\(\[[^\]]*\]\);/, '_internalFields');
const discoverSnippet = extract(/function discoverColumns\(records, colSet\) \{[\s\S]*?\n\}/, 'discoverColumns');
const hiddenSnippet = extract(
    /const DEFAULT_HIDDEN_COLUMNS = new Set\(\[[^\]]*\]\);\nfunction isDefaultHiddenColumn\(col\) \{[\s\S]*?\n\}/,
    'DEFAULT_HIDDEN_COLUMNS / isDefaultHiddenColumn'
);

// flattenRecord's non-NVP collaborators are stubbed: no compound fields, no side slots
const { parseNameValuePairs, formatNameValuePairs, formatNVPValue, isNVPAttrColumn, isDefaultHiddenColumn, flattenRecord, discoverColumns } = new Function(`
    const COMPOUND_FIELDS = new Set();
    function flattenSideSlots() {}
    ${nvpSnippet}
    ${flattenSnippet}
    ${internalSnippet}
    ${discoverSnippet}
    ${hiddenSnippet}
    return { parseNameValuePairs, formatNameValuePairs, formatNVPValue, isNVPAttrColumn, isDefaultHiddenColumn, flattenRecord, discoverColumns };
`)();

const columnsOf = records => {
    const cols = new Set();
    discoverColumns(records, cols);
    return cols;
};

describe('parseNameValuePairs', () => {
    test('parses pipe-delimited CSV per spec (Boolean, paired value, multi-value)', () => {
        assert.deepStrictEqual(
            parseNameValuePairs('AOK|DISP=10.00|TMO=20190419T092316.123456789|AucResp=AuctionID456|DLVT=MM1@MM2@MM3'),
            { AOK: true, DISP: '10.00', TMO: '20190419T092316.123456789', AucResp: 'AuctionID456', DLVT: ['MM1', 'MM2', 'MM3'] }
        );
    });

    test('passes JSON objects through unchanged', () => {
        const obj = { AOK: true, DISP: 10 };
        assert.strictEqual(parseNameValuePairs(obj), obj);
    });

    test('returns null for empty or array values', () => {
        for (const v of [undefined, null, '', ['AOK']]) assert.strictEqual(parseNameValuePairs(v), null);
    });

    test('keeps an empty paired value distinct from a Boolean attribute', () => {
        assert.deepStrictEqual(parseNameValuePairs('DISP='), { DISP: '' });
    });

    test('splits only on the first "=" so values may contain "="', () => {
        assert.deepStrictEqual(parseNameValuePairs('AucResp=A=B'), { AucResp: 'A=B' });
    });

    test('trims whitespace around attributes', () => {
        assert.deepStrictEqual(parseNameValuePairs(' ALG | DISQ=5 '), { ALG: true, DISQ: '5' });
    });

    test('ignores empty segments', () => {
        assert.deepStrictEqual(parseNameValuePairs('ALG||DIR|'), { ALG: true, DIR: true });
    });
});

describe('formatNameValuePairs', () => {
    test('renders spec CSV notation, round-tripping CSV input', () => {
        const csv = 'AOK|DISP=10.00|DLVT=MM1@MM2';
        assert.strictEqual(formatNameValuePairs(parseNameValuePairs(csv)), csv);
    });

    test('renders JSON objects in the same notation as CSV', () => {
        assert.strictEqual(formatNameValuePairs({ AOK: true, DISP: 10, DLVT: ['MM1', 'MM2'] }), 'AOK|DISP=10|DLVT=MM1@MM2');
    });
});

describe('formatNVPValue', () => {
    test('joins multiple values with "@" and passes scalars through', () => {
        assert.strictEqual(formatNVPValue(['MM1', 'MM2']), 'MM1@MM2');
        assert.strictEqual(formatNVPValue(10), 10);
        assert.strictEqual(formatNVPValue(true), true);
    });
});

describe('isDefaultHiddenColumn', () => {
    test('hides attribute columns but keeps the summary column visible', () => {
        assert.ok(isDefaultHiddenColumn('handlingInstructions.ALG'));
        assert.ok(isDefaultHiddenColumn('askRelativePrice.PEG'));
        assert.ok(!isDefaultHiddenColumn('handlingInstructions'));
        assert.ok(!isDefaultHiddenColumn('bidRelativePrice'));
    });

    test('still hides the raw side-detail columns', () => {
        for (const c of ['buyDetails', 'sellDetails', 'clientDetails', 'firmDetails']) assert.ok(isDefaultHiddenColumn(c));
        assert.ok(!isDefaultHiddenColumn('side1.orderID'));
    });
});

describe('isNVPAttrColumn', () => {
    test('matches only per-attribute columns of Name/Value Pair fields', () => {
        assert.ok(isNVPAttrColumn('handlingInstructions.AOK'));
        assert.ok(isNVPAttrColumn('bidRelativePrice.PEG'));
        assert.ok(isNVPAttrColumn('askRelativePrice.MOC'));
        assert.ok(!isNVPAttrColumn('handlingInstructions'));
        assert.ok(!isNVPAttrColumn('timeInForce.name'));
        assert.ok(!isNVPAttrColumn('side1.orderID'));
    });
});

describe('flattenRecord', () => {
    test('JSON and CSV records flatten to the same summary and attribute columns', () => {
        const fromJSON = flattenRecord({ type: 'MENO', handlingInstructions: { ALG: true, DISQ: 100, DLVT: ['MM1', 'MM2'] } });
        const fromCSV = flattenRecord({ type: 'MENO', handlingInstructions: 'ALG|DISQ=100|DLVT=MM1@MM2' });
        for (const flat of [fromJSON, fromCSV]) {
            assert.strictEqual(flat.handlingInstructions, 'ALG|DISQ=100|DLVT=MM1@MM2');
            assert.strictEqual(flat['handlingInstructions.ALG'], true);
            assert.strictEqual(String(flat['handlingInstructions.DISQ']), '100');
            assert.strictEqual(flat['handlingInstructions.DLVT'], 'MM1@MM2');
        }
    });

    test('shows invalid JSON values (e.g. AOK: false) in the summary rather than dropping them', () => {
        const flat = flattenRecord({ type: 'MENO', handlingInstructions: { AOK: false } });
        assert.strictEqual(flat.handlingInstructions, 'AOK=false');
        assert.strictEqual(flat['handlingInstructions.AOK'], false);
    });

    test('empty values produce no attribute columns', () => {
        for (const v of ['', {}]) {
            const flat = flattenRecord({ type: 'MENO', handlingInstructions: v });
            assert.strictEqual(flat.handlingInstructions, '');
            assert.ok(!Object.keys(flat).some(isNVPAttrColumn));
        }
    });

    test('attribute columns are left out of free-text search (summary covers them)', () => {
        const flat = flattenRecord({ type: 'MENO', handlingInstructions: { DIR: true } });
        assert.ok(flat._searchText.includes('dir'));
        assert.ok(!flat._searchText.split('\0').includes('true'));
    });
});

describe('discoverColumns', () => {
    test('finds attribute columns from every record, not just the first of each type', () => {
        const cols = columnsOf([
            { type: 'MENO' },
            { type: 'MENO', handlingInstructions: { ALG: true } },
            { type: 'MENO', handlingInstructions: 'DIR|NH' },
            { type: 'MENO', bidRelativePrice: 'PEG' },
        ].map(flattenRecord));
        for (const c of ['handlingInstructions', 'handlingInstructions.ALG', 'handlingInstructions.DIR', 'handlingInstructions.NH', 'bidRelativePrice', 'bidRelativePrice.PEG']) {
            assert.ok(cols.has(c), `missing column ${c}`);
        }
    });

    test('records without NVP values add no NVP columns', () => {
        const cols = columnsOf([{ type: 'MENO', orderID: 'A' }].map(flattenRecord));
        assert.ok(![...cols].some(c => c.startsWith('handlingInstructions')));
    });

    test('sample file: every handlingInstructions attribute gets a column', () => {
        const records = fs.readFileSync(path.join(ROOT, SAMPLE_FILE), 'utf8')
            .split('\n').filter(l => l.trim()).map(l => flattenRecord(JSON.parse(l)));
        const expected = new Set();
        for (const r of records) {
            for (const k of Object.keys(r)) if (isNVPAttrColumn(k)) expected.add(k);
        }
        // Fixture must vary attributes within a type after its first record,
        // or this test proves nothing about per-type sampling
        assert.ok(expected.size >= 4, `expected varied handlingInstructions in ${SAMPLE_FILE}`);
        const cols = columnsOf(records);
        for (const c of ['handlingInstructions', ...expected]) assert.ok(cols.has(c), `missing column ${c}`);
    });
});
