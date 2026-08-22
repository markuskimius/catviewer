// Tests for order chain event ordering and sample data integrity.
// Run with: node --test tests/
//
// index.html is a single-file app with no module exports, so the code under
// test is extracted from the inline script by pattern and evaluated in
// isolation. If extraction fails, the source has drifted and the test fails
// loudly rather than silently testing a stale copy.

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

const chainSnippet = extract(
    /const CHAIN_ORIGIN_TYPES[\s\S]*?return rank\(a\) - rank\(b\);\n\}/,
    'CHAIN_ORIGIN_TYPES / compareChainRecords'
);
const { CHAIN_ORIGIN_TYPES, CHAIN_ORIGIN_SUPPLEMENT_TYPES, compareChainRecords } = new Function(
    `${chainSnippet}; return { CHAIN_ORIGIN_TYPES, CHAIN_ORIGIN_SUPPLEMENT_TYPES, compareChainRecords };`
)();

const allowedSnippet = extract(
    /const CAT_ALLOWED_TYPES = new Set\(\[[^\]]*\]\);/,
    'CAT_ALLOWED_TYPES'
);
const { CAT_ALLOWED_TYPES } = new Function(`${allowedSnippet}; return { CAT_ALLOWED_TYPES };`)();

// --- Helpers ---

const T1 = '20250317T140000.000001';
const T2 = '20250317T140000.000002';
const rec = (type, eventTimestamp = T1, extra = {}) => ({ type, eventTimestamp, ...extra });

// A record's lane orderIDs: its own orderID, else orderIDs nested in compound
// arrays (JSON form; mirrors getRecordLaneOrderIDs for the sample file's data).
function laneOrderIDs(r) {
    if (r.orderID) return [r.orderID];
    const ids = new Set();
    for (const f in r) {
        const v = r[f];
        if (!Array.isArray(v)) continue;
        for (const item of v) {
            if (item && typeof item === 'object' && item.orderID) ids.add(String(item.orderID));
        }
    }
    return [...ids];
}

const rank = r =>
    CHAIN_ORIGIN_TYPES.has(r.type) ? 0 :
    CHAIN_ORIGIN_SUPPLEMENT_TYPES.has(r.type) ? 1 : 2;

// --- Type set sanity ---

describe('origin/supplement type sets', () => {
    test('cover equity, options, and multi-leg origination events', () => {
        const expected = ['MENO', 'MEOA', 'MECO', 'MEIR',
                          'MONO', 'MOOA', 'MOCO', 'MOIR',
                          'MLNO', 'MLOA', 'MLCO', 'MLIR'];
        assert.deepStrictEqual([...CHAIN_ORIGIN_TYPES].sort(), expected.sort());
    });

    test('supplements are exactly the origination supplements in the spec', () => {
        assert.deepStrictEqual([...CHAIN_ORIGIN_SUPPLEMENT_TYPES].sort(), ['MENOS', 'MLOS', 'MONOS']);
    });

    test('every listed type is a valid CAT event type', () => {
        for (const t of [...CHAIN_ORIGIN_TYPES, ...CHAIN_ORIGIN_SUPPLEMENT_TYPES]) {
            assert.ok(CAT_ALLOWED_TYPES.has(t), `${t} not in CAT_ALLOWED_TYPES`);
        }
    });

    test('origin and supplement sets are disjoint', () => {
        for (const t of CHAIN_ORIGIN_SUPPLEMENT_TYPES) {
            assert.ok(!CHAIN_ORIGIN_TYPES.has(t), `${t} in both sets`);
        }
    });
});

// --- compareChainRecords unit tests ---

describe('compareChainRecords', () => {
    test('earlier timestamp wins regardless of type', () => {
        assert.ok(compareChainRecords(rec('MEOC', T1), rec('MENO', T2)) < 0);
        assert.ok(compareChainRecords(rec('MENO', T2), rec('MEOC', T1)) > 0);
    });

    test('every origination type sorts before a non-origination event at the same timestamp', () => {
        for (const t of CHAIN_ORIGIN_TYPES) {
            assert.ok(compareChainRecords(rec(t), rec('MEOR')) < 0, `${t} should sort before MEOR`);
            assert.ok(compareChainRecords(rec('MEOR'), rec(t)) > 0, `MEOR should sort after ${t}`);
        }
    });

    test('every supplement sorts between origination and other events at the same timestamp', () => {
        for (const s of CHAIN_ORIGIN_SUPPLEMENT_TYPES) {
            assert.ok(compareChainRecords(rec('MENO'), rec(s)) < 0, `MENO should sort before ${s}`);
            assert.ok(compareChainRecords(rec(s), rec('MEOT')) < 0, `${s} should sort before MEOT`);
        }
    });

    test('same-rank ties compare equal, preserving file order under stable sort', () => {
        assert.strictEqual(compareChainRecords(rec('MEOT'), rec('MEOR')), 0);
        assert.strictEqual(compareChainRecords(rec('MENO'), rec('MECO')), 0);
        assert.strictEqual(compareChainRecords(rec('MENOS'), rec('MONOS')), 0);
    });

    test('missing timestamps are tolerated and sort together', () => {
        const a = { type: 'MENO' };
        const b = { type: 'MEOR' };
        assert.ok(compareChainRecords(a, b) < 0);
        assert.ok(compareChainRecords(b, a) > 0);
        assert.ok(compareChainRecords({ type: 'MEOC' }, rec('MENO')) < 0, 'no timestamp sorts before any timestamp');
    });

    test('sorting a scrambled group yields chronological order with origin-first ties', () => {
        const group = [
            rec('MEOT', T1), rec('MEOR', T1), rec('MENOS', T1), rec('MENO', T1),
            rec('MEOC', T2), rec('MECO', '20250317T135959.000001'),
        ];
        const sorted = [...group].sort(compareChainRecords);
        assert.deepStrictEqual(sorted.map(r => r.type), ['MECO', 'MENO', 'MENOS', 'MEOT', 'MEOR', 'MEOC']);
    });
});

// --- Sample file integrity ---

const lines = fs.readFileSync(path.join(ROOT, SAMPLE_FILE), 'utf8').trim().split('\n');
const records = lines.map((l, i) => {
    try { return JSON.parse(l); }
    catch (e) { assert.fail(`${SAMPLE_FILE} line ${i + 1} is not valid JSON: ${e.message}`); }
});

describe('sample file integrity', () => {
    test('every record has a valid CAT event type', () => {
        for (const r of records) {
            assert.ok(CAT_ALLOWED_TYPES.has(r.type), `unknown type ${r.type} (firmROEID ${r.firmROEID})`);
        }
    });

    test('firmROEIDs are unique', () => {
        const seen = new Set();
        for (const r of records) {
            assert.ok(!seen.has(r.firmROEID), `duplicate firmROEID ${r.firmROEID}`);
            seen.add(r.firmROEID);
        }
    });

    test('every record has a well-formed eventTimestamp', () => {
        for (const r of records) {
            assert.match(r.eventTimestamp, /^\d{8}T\d{6}\.\d{3,9}$/,
                `bad eventTimestamp on ${r.firmROEID}: ${r.eventTimestamp}`);
        }
    });
});

// --- End-to-end: scrambled same-timestamp groups in the sample file ---

describe('same-timestamp tie-break scenarios in sample file', () => {
    const groups = {};
    for (const r of records) {
        for (const oid of laneOrderIDs(r)) (groups[oid] ||= []).push(r);
    }

    const scenarios = [
        { orderID: 'TE-014',    fileOrder: ['MEOT', 'MEOR', 'MENOS', 'MENO'], chainOrder: ['MENO', 'MENOS', 'MEOT', 'MEOR'] },
        { orderID: 'TE-CH-003', fileOrder: ['MEOC', 'MECO'],                  chainOrder: ['MECO', 'MEOC'] },
        { orderID: 'TE-IR-004', fileOrder: ['MEOR', 'MEIR'],                  chainOrder: ['MEIR', 'MEOR'] },
    ];

    for (const { orderID, fileOrder, chainOrder } of scenarios) {
        test(`${orderID}: fixture stays scrambled in file order`, () => {
            const group = groups[orderID];
            assert.ok(group, `no records found for ${orderID}`);
            assert.deepStrictEqual(group.map(r => r.type), fileOrder,
                `${orderID} fixture changed — the origination event must come last in the file for the test to prove anything`);
            const ts = new Set(group.map(r => r.eventTimestamp));
            assert.strictEqual(ts.size, 1, `${orderID} events must share one timestamp`);
        });

        test(`${orderID}: chain sort puts origination first`, () => {
            const sorted = [...groups[orderID]].sort(compareChainRecords);
            assert.deepStrictEqual(sorted.map(r => r.type), chainOrder);
        });
    }

    test('all groups: within any timestamp tie, ranks are non-decreasing after sort', () => {
        for (const [oid, group] of Object.entries(groups)) {
            const sorted = [...group].sort(compareChainRecords);
            for (let i = 1; i < sorted.length; i++) {
                if (sorted[i].eventTimestamp === sorted[i - 1].eventTimestamp) {
                    assert.ok(rank(sorted[i - 1]) <= rank(sorted[i]),
                        `${oid}: ${sorted[i - 1].type} ranks after ${sorted[i].type} at ${sorted[i].eventTimestamp}`);
                }
            }
        }
    });
});
