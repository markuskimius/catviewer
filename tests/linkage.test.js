// Tests for order identity (Order Keys), corrections (COR/RPR/DEL), and
// cross-record linkage checks. Run with: node --test tests/
//
// The code under test is extracted from index.html (a single-file app with no
// module exports): the schema/validation block plus the linkage block from
// LINKAGE_FIELDS through the cross-record checks. allRecords is declared
// locally and set per test.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SAMPLE_FILE = '1234_TEST_20250317_Sample_OrderEvents_000001.json';

function slice(fromMarker, toMarker) {
    const a = html.indexOf(fromMarker), b = html.indexOf(toMarker, a);
    assert.ok(a >= 0 && b > a, `could not extract ${fromMarker} … ${toMarker} from index.html`);
    return html.slice(a, b);
}
function extract(pattern, label) {
    const m = html.match(pattern);
    assert.ok(m, `could not extract ${label} from index.html`);
    return m[0];
}

const api = new Function([
    'let allRecords = [];',
    slice('const CAT_CSV_FIELDS = {', 'function processFileText('),
    extract(/let _etHourFormat = null;[\s\S]*?function catTimestampToNs\(raw\) \{[\s\S]*?\n\}/, 'timestamp helpers'),
    extract(/function formatEpochNanosToET\([\s\S]*?\n\}/, 'formatEpochNanosToET'),
    extract(/function parseSideDetails\(value, fields\) \{[\s\S]*?\n\}/, 'parseSideDetails'),
    slice('const LINKAGE_FIELDS = {', 'function lookupLinkedRecords('),
    `return {
        load(records) { records.forEach((r, i) => { r._idx = i; }); allRecords = records; buildCorrections(records); buildOrderIdentity(); },
        getRecordLaneOrderIDs, recordOrderNode, referencedOrderNode, resolveOrderNode, linkOrderNode, orderIDOfNode,
        isEffectiveRecord, correctionInfo, stats: () => correctionStats, crossRecordChecks, LINKAGE_FIELDS,
    };`,
].join('\n'))();

const D1 = '20250317', D2 = '20250318';
const meno = (orderID, keyDate, extra = {}) => ({
    actionType: 'NEW', firmROEID: `${keyDate.slice(0, 8)}_${orderID}_${extra.symbol || 'AAPL'}_${keyDate}`, type: 'MENO',
    CATReporterIMID: 'FIRM', orderKeyDate: keyDate, orderID, symbol: 'AAPL', eventTimestamp: keyDate, manualFlag: false, ...extra,
});
const meor = (orderID, keyDate, ts, extra = {}) => ({
    actionType: 'NEW', firmROEID: `${ts.slice(0, 8)}_R_${orderID}_${ts}`, type: 'MEOR', CATReporterIMID: 'FIRM',
    orderKeyDate: keyDate, orderID, symbol: 'AAPL', eventTimestamp: ts, manualFlag: false, routedOrderID: 'RT1', ...extra,
});
const codes = (records, r) => (api.crossRecordChecks(records).get(r) || []).map(e => `${e.field}:${e.code}:${e.severity}`);

describe('order identity', () => {
    test('the sample file needs no qualification: every node is its orderID', () => {
        const recs = fs.readFileSync(path.join(ROOT, SAMPLE_FILE), 'utf8').trim().split('\n').map(l => JSON.parse(l));
        api.load(recs);
        for (const r of recs) {
            if (r.orderID) assert.strictEqual(api.recordOrderNode(r), r.orderID);
        }
    });

    test('an orderID reused on another day becomes two orders, and each event joins the right one', () => {
        const a = meno('ORD1', `${D1}T093000.000`), b = meno('ORD1', `${D2}T093000.000`);
        const ra = meor('ORD1', `${D1}T093000.000`, `${D1}T093001.000`), rb = meor('ORD1', `${D2}T093000.000`, `${D2}T093001.000`);
        const trade = { actionType: 'NEW', firmROEID: `${D2}_T1`, type: 'MEOT', CATReporterIMID: 'FIRM', tradeKeyDate: `${D2}T100000.000`,
            tradeID: 'T1', symbol: 'AAPL', eventTimestamp: `${D2}T100000.000`, buyDetails: [{ orderKeyDate: `${D2}T093000.000`, orderID: 'ORD1', side: 'B' }] };
        api.load([a, b, ra, rb, trade]);
        assert.strictEqual(api.recordOrderNode(a), 'ORD1 (2025-03-17)');
        assert.strictEqual(api.recordOrderNode(b), 'ORD1 (2025-03-18)');
        assert.deepStrictEqual(api.getRecordLaneOrderIDs(ra), ['ORD1 (2025-03-17)']);
        assert.deepStrictEqual(api.getRecordLaneOrderIDs(rb), ['ORD1 (2025-03-18)']);
        assert.deepStrictEqual(api.getRecordLaneOrderIDs(trade), ['ORD1 (2025-03-18)']);
        assert.strictEqual(api.orderIDOfNode('ORD1 (2025-03-18)'), 'ORD1');
    });

    test('qualifiers name only what differs: symbol, or time of day for same-day reuse', () => {
        const aapl = meno('ORD2', `${D1}T093000.000`), msft = meno('ORD2', `${D1}T093000.000`, { symbol: 'MSFT' });
        api.load([aapl, msft]);
        assert.strictEqual(api.recordOrderNode(aapl), 'ORD2 (AAPL)');
        assert.strictEqual(api.recordOrderNode(msft), 'ORD2 (MSFT)');
        const early = meno('ORD3', `${D1}T093000.000`), late = meno('ORD3', `${D1}T150000.000`);
        api.load([early, late]);
        assert.strictEqual(api.recordOrderNode(early), 'ORD3 (2025-03-17 09:30:00.000)');
        assert.strictEqual(api.recordOrderNode(late), 'ORD3 (2025-03-17 15:00:00.000)');
    });

    test('epoch and string forms of the same orderKeyDate are the same order', () => {
        const a = meno('ORD4', `${D1}T093000`), b = meor('ORD4', '1742218200000000000', `${D1}T093001.000`);
        api.load([a, b]);
        assert.strictEqual(api.recordOrderNode(a), 'ORD4');
        assert.strictEqual(api.recordOrderNode(b), 'ORD4');
    });

    test('references without a key date resolve when unambiguous, otherwise stay the plain orderID', () => {
        api.load([meno('ORD5', `${D1}T093000.000`)]);
        assert.strictEqual(api.resolveOrderNode('ORD5'), 'ORD5');
        api.load([meno('ORD6', `${D1}T093000.000`), meno('ORD6', `${D2}T093000.000`)]);
        assert.strictEqual(api.resolveOrderNode('ORD6'), 'ORD6');
        assert.strictEqual(api.resolveOrderNode('ORD6', `${D2}T093000.000`, 'AAPL', 'FIRM'), 'ORD6 (2025-03-18)');
    });

    test('parent and prior links resolve through their own key dates', () => {
        const p1 = meno('P', `${D1}T093000.000`), p2 = meno('P', `${D2}T093000.000`);
        const child = { ...meno('C', `${D2}T100000.000`), type: 'MECO', parentOrderID: 'P', parentOrderKeyDate: `${D2}T093000.000` };
        api.load([p1, p2, child]);
        assert.strictEqual(api.referencedOrderNode(child, 'parent'), 'P (2025-03-18)');
        assert.strictEqual(api.linkOrderNode('parentOrderID', 'P', child), 'P (2025-03-18)');
    });

    test('routedOrderID links to the other side of the route, not to orderIDs', () => {
        assert.strictEqual(api.LINKAGE_FIELDS.routedOrderID, 'routedOrderID');
    });
});

describe('corrections (Section 7.6)', () => {
    test('COR replaces, DEL removes, and the DEL itself is not an event', () => {
        const orig = meno('O1', `${D1}T093000.000`);
        const cor = { ...orig, actionType: 'COR', price: 10 };
        const other = meno('O2', `${D1}T093000.000`);
        const del = { actionType: 'DEL', firmROEID: other.firmROEID };
        api.load([orig, other, cor, del]);
        assert.ok(!api.isEffectiveRecord(orig));
        assert.ok(api.isEffectiveRecord(cor));
        assert.ok(!api.isEffectiveRecord(other));
        assert.ok(!api.isEffectiveRecord(del));
        assert.strictEqual(api.correctionInfo(orig).supersededBy, cor);
        assert.strictEqual(api.correctionInfo(other).deletedBy, del);
        assert.deepStrictEqual(api.stats(), { corrections: 2, superseded: 1, deleted: 1, unmatched: 0 });
    });

    test('a correction chain keeps only the last version; unmatched instructions are counted', () => {
        const orig = meno('O3', `${D1}T093000.000`);
        const cor1 = { ...orig, actionType: 'COR' }, cor2 = { ...orig, actionType: 'RPR', errorROEID: 5 };
        const stray = { actionType: 'DEL', errorROEID: 99 };
        api.load([orig, cor1, cor2, stray]);
        assert.deepStrictEqual([orig, cor1, cor2].map(api.isEffectiveRecord), [false, false, true]);
        assert.strictEqual(api.stats().unmatched, 1);
    });

    test('a NEW reusing a firmROEID does not replace the first record', () => {
        const a = meno('O4', `${D1}T093000.000`), b = { ...meno('O5', `${D1}T093000.000`), firmROEID: a.firmROEID };
        api.load([a, b]);
        assert.ok(api.isEffectiveRecord(a) && api.isEffectiveRecord(b));
    });
});

describe('cross-record checks', () => {
    test('3002: duplicate firmROEID among NEW records, but not for corrections', () => {
        const a = meno('O1', `${D1}T093000.000`), b = { ...meno('O2', `${D1}T093000.000`), firmROEID: a.firmROEID };
        api.load([a, b]);
        assert.ok(codes([a, b], a).includes('firmROEID:3002:error'));
        const cor = { ...a, actionType: 'COR' };
        api.load([a, cor]);
        assert.ok(!codes([a, cor], cor).some(c => c.includes(':3002:')));
    });

    test('3004: an Order Key assigned twice (a replaced original does not count)', () => {
        const a = meno('O1', `${D1}T093000.000`), b = { ...meno('O1', `${D1}T093000.000`), firmROEID: `${D1}_other` };
        api.load([a, b]);
        assert.ok(codes([a, b], b).includes('orderID:3004:error'));
        const cor = { ...a, actionType: 'COR' };
        api.load([a, cor]);
        assert.ok(!codes([a, cor], cor).some(c => c.includes(':3004:')));
    });

    test('3501: a route whose order is not loaded is a warning', () => {
        const r = meor('GHOST', `${D1}T093000.000`, `${D1}T093001.000`);
        api.load([r]);
        assert.ok(codes([r], r).includes('orderID:3501:warn'));
    });

    test('3601: events earlier than their order beyond the clock drift allowance', () => {
        const o = meno('O1', `${D1}T093000.100`);
        const early = meor('O1', `${D1}T093000.100`, `${D1}T093000.000`);
        const within = meor('O1', `${D1}T093000.100`, `${D1}T093000.060`);
        api.load([o, early, within]);
        assert.ok(codes([o, early, within], early).includes('eventTimestamp:3601:error'));
        assert.ok(!codes([o, early, within], within).some(c => c.includes(':3601:')));
        const manualEarly = { ...early, manualFlag: true };
        api.load([o, manualEarly]);
        assert.ok(!codes([o, manualEarly], manualEarly).some(c => c.includes(':3601:')), 'manual events get 1 second');
    });

    test('3502: trade side details must reference a loaded order', () => {
        const t = { actionType: 'NEW', firmROEID: `${D1}_T1`, type: 'MEOT', CATReporterIMID: 'FIRM', tradeKeyDate: `${D1}T100000.000`,
            tradeID: 'T1', symbol: 'AAPL', eventTimestamp: `${D1}T100000.000`, buyDetails: [{ orderKeyDate: `${D1}T093000.000`, orderID: 'NOPE', side: 'B' }] };
        api.load([t]);
        assert.ok(codes([t], t).includes('buyDetails:3502:warn'));
    });

    test('3602: a supplement must carry its event\'s timestamp to the millisecond', () => {
        const o = meno('O1', `${D1}T093000.000`);
        const sup = { actionType: 'NEW', firmROEID: `${D1}_S1`, type: 'MENOS', CATReporterIMID: 'FIRM', orderKeyDate: `${D1}T093000.000`,
            orderID: 'O1', symbol: 'AAPL', eventTimestamp: `${D1}T093000.0009` };
        api.load([o, sup]);
        assert.ok(!codes([o, sup], sup).some(c => c.includes(':3602:')), 'sub-millisecond difference is allowed');
        const off = { ...sup, eventTimestamp: `${D1}T093000.002` };
        api.load([o, off]);
        assert.ok(codes([o, off], off).includes('eventTimestamp:3602:error'));
    });

    test('3711: PENDING firmDesignatedID until a supplement supplies the real one', () => {
        const o = meno('O1', `${D1}T093000.000`, { firmDesignatedID: 'PENDING' });
        api.load([o]);
        assert.ok(codes([o], o).includes('firmDesignatedID:3711:error'));
        const sup = { actionType: 'NEW', firmROEID: `${D1}_S1`, type: 'MENOS', CATReporterIMID: 'FIRM', orderKeyDate: `${D1}T093000.000`,
            orderID: 'O1', symbol: 'AAPL', eventTimestamp: `${D1}T093000.000`, firmDesignatedID: 'ACCT9' };
        api.load([o, sup]);
        assert.ok(!codes([o, sup], o).some(c => c.includes(':3711:')));
    });

    test('the sample file has no cross-record errors (only warnings for references outside the file)', () => {
        const recs = fs.readFileSync(path.join(ROOT, SAMPLE_FILE), 'utf8').trim().split('\n').map(l => JSON.parse(l));
        api.load(recs);
        const errors = [];
        for (const [r, list] of api.crossRecordChecks(recs)) {
            for (const e of list) if (e.severity === 'error') errors.push(`${r.type} ${r.firmROEID} ${e.code} ${e.message}`);
        }
        assert.deepStrictEqual(errors, []);
    });
});
