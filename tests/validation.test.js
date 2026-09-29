// Tests for field-level validation (validateRecord) against the CAT IM
// Technical Specifications v4.1.0 r15. Run with: node --test tests/
//
// index.html is a single-file app with no module exports. The code under test
// is the contiguous block from CAT_CSV_FIELDS through validateRecord (schema
// tables, parsers, validation), plus the timestamp and side-detail helpers it
// calls. If extraction fails, the source has drifted and the tests fail loudly.

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

const start = html.indexOf('const CAT_CSV_FIELDS = {');
const end = html.indexOf('function processFileText(');
assert.ok(start >= 0 && end > start, 'could not locate the schema/validation block in index.html');
const timestampSnippet = extract(
    /let _etHourFormat = null;[\s\S]*?function catTimestampToNs\(raw\) \{[\s\S]*?\n\}/,
    'getETHour / formatETDateCompact / catTimestampToNs'
);
const sideDetailsSnippet = extract(/function parseSideDetails\(value, fields\) \{[\s\S]*?\n\}/, 'parseSideDetails');

const { validateRecord, parseCSV, validateCATFile, CAT_SPECS, recordEventDate, specForRecord } = new Function(
    `${html.slice(start, end)}\n${timestampSnippet}\n${sideDetailsSnippet}\n` +
    'return { validateRecord, parseCSV, validateCATFile, CAT_SPECS, recordEventDate, specForRecord };'
)();

// All errors as "field:code:severity" strings
function issues(record, format = 'json', spec) {
    const errs = validateRecord(record, format, spec);
    if (!errs) return [];
    return Object.entries(errs).flatMap(([f, list]) => list.map(e => `${f}:${e.code}:${e.severity}`));
}
const has = (record, needle, format, spec) => issues(record, format, spec).some(s => s.startsWith(needle));

// A valid electronic equity New Order (JSON)
const meno = (extra = {}) => ({
    actionType: 'NEW', firmROEID: '20250317_ORD1', type: 'MENO', CATReporterIMID: 'TEST',
    orderKeyDate: '20250317T093000.000001', orderID: 'ORD1', symbol: 'AAPL',
    eventTimestamp: '20250317T093000.000001', manualFlag: false, electronicDupFlag: false,
    deptType: 'A', solicitationFlag: false, side: 'B', price: 10.01, quantity: 100,
    orderType: 'LMT', timeInForce: { DAY: 20250317 }, tradingSession: 'REG',
    custDspIntrFlag: false, firmDesignatedID: 'ACCT1', accountHolderType: 'I',
    affiliateFlag: false, negotiatedTradeFlag: false, representativeInd: 'N',
    ...extra,
});

describe('baseline', () => {
    test('a valid MENO has no errors', () => {
        assert.deepStrictEqual(issues(meno()), []);
    });
});

describe('Booleans (Section 2.5)', () => {
    test('an absent JSON Boolean is false, not missing', () => {
        const r = meno();
        delete r.electronicDupFlag;
        delete r.solicitationFlag;
        delete r.affiliateFlag;
        assert.deepStrictEqual(issues(r), []);
    });

    test('CSV Booleans are not case sensitive', () => {
        const [r] = parseCSV('NEW,,20250317_ORD1,MENO,TEST,20250317T093000.000001,ORD1,AAPL,20250317T093000.000001,FALSE,TRUE');
        assert.ok(!issues(r, 'csv').some(s => s.startsWith('manualFlag:') || s.startsWith('electronicDupFlag:')));
    });

    test('a JSON Boolean given as a string is still an error', () => {
        assert.ok(has(meno({ manualFlag: 'false' }), 'manualFlag:'));
    });
});

describe('2144 electronicTimestamp + manualFlag (Section 3.2)', () => {
    test('a systematized manual event may carry electronicTimestamp', () => {
        assert.ok(!has(meno({ manualFlag: true, eventTimestamp: '20250317T093000', electronicTimestamp: '20250317T093001.000' }), 'electronicTimestamp:2144'));
    });

    test('an electronic event must not carry electronicTimestamp', () => {
        assert.ok(has(meno({ electronicTimestamp: '20250317T093001.000' }), 'electronicTimestamp:2144:error'));
    });
});

describe('action types (Section 7.6)', () => {
    test('COR and RPR are full restatements: required fields are checked', () => {
        const partial = { actionType: 'COR', firmROEID: '20250317_ORD1', type: 'MENO' };
        assert.ok(has(partial, 'orderID:'));
        assert.ok(has({ ...partial, actionType: 'RPR', errorROEID: 123 }, 'orderID:'));
    });

    test('a spec-conformant DEL has no errors (Table 165)', () => {
        assert.deepStrictEqual(issues({ actionType: 'DEL', firmROEID: '20190416_FirmROE123' }), []);
        assert.deepStrictEqual(issues({ actionType: 'DEL', errorROEID: 45678901 }), []);
    });

    test('a DEL needs errorROEID or firmROEID, and nothing else is used', () => {
        assert.ok(has({ actionType: 'DEL' }, 'firmROEID:2032'));
        assert.ok(has({ actionType: 'DEL', firmROEID: '20190416_X', symbol: 'AAPL' }, 'symbol:2133:warn'));
    });

    test('CSV DEL lines parse to the Table 165 fields and count as CAT records', () => {
        const recs = parseCSV('DEL,,20190416_FirmROE123\nDEL,45678901,');
        assert.deepStrictEqual(recs.map(r => ({ ...r })), [
            { actionType: 'DEL', firmROEID: '20190416_FirmROE123' },
            { actionType: 'DEL', errorROEID: '45678901' },
        ]);
        assert.deepStrictEqual(issues(recs[0], 'csv'), []);
        assert.strictEqual(validateCATFile(recs), 2);
    });
});

describe('timestamps', () => {
    test('2033 compares the firmROEID date with the Eastern Time date of an epoch eventTimestamp', () => {
        // 2025-03-18 00:00 UTC = 2025-03-17 20:00 EDT
        assert.ok(!has(meno({ firmROEID: '20250317_ORD1', eventTimestamp: 1742256000000000000 }), 'firmROEID:2033'));
        assert.ok(has(meno({ firmROEID: '20250318_ORD1', eventTimestamp: 1742256000000000000 }), 'firmROEID:2033'));
    });

    test('epoch timestamps must be nanoseconds', () => {
        assert.ok(has(meno({ eventTimestamp: 1742218200123 }), 'eventTimestamp:2027:error'));
        assert.ok(!has(meno({ eventTimestamp: '1742218200123456789' }), 'eventTimestamp:2027'));
    });

    test('2027: electronic events need millisecond precision; an absent manualFlag means electronic', () => {
        assert.ok(has(meno({ eventTimestamp: '20250317T093000' }), 'eventTimestamp:2027:error'));
        const r = meno({ eventTimestamp: '20250317T093000' });
        delete r.manualFlag;
        assert.ok(has(r, 'eventTimestamp:2027:error'));
        assert.ok(!has(meno({ manualFlag: true, eventTimestamp: '20250317T093000' }), 'eventTimestamp:2027'));
    });

    test('2027: child orders are exempt at ingestion, so only a warning', () => {
        const meco = {
            actionType: 'NEW', firmROEID: '20250317_C1', type: 'MECO', orderKeyDate: '20250317T093000.000',
            orderID: 'C1', symbol: 'AAPL', parentOrderKeyDate: '20250317T093000.000', parentOrderID: 'P1',
            eventTimestamp: '20250317T093000', side: 'B', quantity: 100, orderType: 'MKT',
            timeInForce: { DAY: 20250317 }, tradingSession: 'REG', manualFlag: false,
        };
        assert.ok(has(meco, 'eventTimestamp:2027:warn'));
    });

    test('2139: a timestamp later than now is an error', () => {
        assert.ok(has(meno({ eventTimestamp: '20990101T093000.000' }), 'eventTimestamp:2139:error'));
        assert.ok(!has(meno(), 'eventTimestamp:2139'));
    });
});

describe('choice values by product (Appendix G)', () => {
    test('equity side must be B/SL/SS/SX; option side must be B/S', () => {
        assert.ok(has(meno({ side: 'S' }), 'side:'));
        assert.ok(!has(meno({ side: 'SL' }), 'side:'));
        const mono = { ...meno({ type: 'MONO', optionID: 'AAPL  250321C00200000', side: 'SL' }) };
        assert.ok(has(mono, 'side:'));
    });

    test('an out-of-list choice value is an error', () => {
        assert.ok(has(meno({ deptType: 'ZZ' }), 'deptType:2018:error'));
    });

    test('MX2OP and IEXOP are valid exchange destinations (in production ahead of v4.2.0)', () => {
        const meor = {
            actionType: 'NEW', firmROEID: '20250317_R1', type: 'MEOR', orderKeyDate: '20250317T093000.000',
            orderID: 'O1', symbol: 'AAPL', eventTimestamp: '20250317T093000.001', manualFlag: false,
            destination: 'MX2OP', destinationType: 'E', routedOrderID: 'R1', side: 'B', quantity: 1,
            orderType: 'MKT', timeInForce: { DAY: 20250317 }, tradingSession: 'REG', handlingInstructions: {},
            routeRejectedFlag: false, exchOriginCode: 'X',
        };
        assert.ok(!has(meor, 'destination:2019'));
        assert.ok(!has({ ...meor, destination: 'IEXOP' }, 'destination:2019'));
        assert.ok(has({ ...meor, destination: 'NOPE' }, 'destination:2019'));
    });
});

describe('representativeQuoteInd (MENQ fields 21-23, 29-31)', () => {
    const menq = (extra = {}) => ({
        actionType: 'NEW', firmROEID: '20250317_Q1', type: 'MENQ', quoteKeyDate: '20250317T093000.000',
        quoteID: 'Q1', symbol: 'AAPL', eventTimestamp: '20250317T093000.000', ...extra,
    });

    test('blank representativeQuoteInd requires firmDesignatedID', () => {
        assert.ok(has(menq(), 'firmDesignatedID:2244'));
        assert.ok(!has(menq({ firmDesignatedID: 'F1', accountHolderType: 'O' }), 'firmDesignatedID:2244'));
    });

    test('N needs no firmDesignatedID and forbids aggregated orders', () => {
        assert.ok(!has(menq({ representativeQuoteInd: 'N' }), 'firmDesignatedID:2244'));
        assert.ok(has(menq({ representativeQuoteInd: 'N', askAggregatedOrders: [{ orderID: 'A', orderKeyDate: '20250317T093000.000' }] }), 'askAggregatedOrders:2237'));
    });

    test('A/B/C require the matching aggregated orders', () => {
        assert.ok(has(menq({ representativeQuoteInd: 'A' }), 'askAggregatedOrders:2237'));
        assert.ok(has(menq({ representativeQuoteInd: 'B' }), 'bidAggregatedOrders:2243'));
        const c = issues(menq({ representativeQuoteInd: 'C' }));
        assert.ok(c.some(s => s.startsWith('askAggregatedOrders:2237')) && c.some(s => s.startsWith('bidAggregatedOrders:2243')));
    });

    test('populated representativeQuoteInd forbids firmDesignatedID and unsolicitedInd', () => {
        assert.ok(has(menq({ representativeQuoteInd: 'N', firmDesignatedID: 'F1' }), 'firmDesignatedID:2244'));
        assert.ok(has(menq({ representativeQuoteInd: 'N', unsolicitedInd: 'U' }), 'unsolicitedInd:2246'));
    });
});

describe('corrected error codes', () => {
    test('2257 for RFQFlag/RFQID in both directions', () => {
        const menq = {
            actionType: 'NEW', firmROEID: '20250317_Q1', type: 'MENQ', quoteKeyDate: '20250317T093000.000',
            quoteID: 'Q1', symbol: 'AAPL', eventTimestamp: '20250317T093000.000', firmDesignatedID: 'F1',
        };
        assert.ok(has({ ...menq, RFQFlag: true }, 'RFQID:2257:error'));
        assert.ok(has({ ...menq, RFQFlag: false, RFQID: 'RFQ1' }, 'RFQID:2257:error'));
        assert.ok(!has({ ...menq, RFQFlag: true, RFQID: 'RFQ1' }, 'RFQID:2257'));
    });

    test('2132 flags lines over 8190 bytes', () => {
        const [r] = parseCSV('NEW,,20250317_ORD1,MENO,TEST,' + 'x'.repeat(8200));
        assert.ok(has(r, 'type:2132', 'csv'));
    });

    test('2145: YE fulfillment without firmDetails is an error', () => {
        const meof = {
            actionType: 'NEW', firmROEID: '20250317_F1', type: 'MEOF', fulfillmentKeyDate: '20250317T093000.000',
            fulfillmentID: 'F1', symbol: 'AAPL', eventTimestamp: '20250317T093000.000', manualFlag: false,
            fulfillmentLinkType: 'YE', quantity: 100, price: 10, capacity: 'A',
            clientDetails: [{ orderID: 'C1', orderKeyDate: '20250317T093000.000', side: 'B' }],
        };
        assert.ok(has(meof, 'firmDetails:2145'));
    });
});

describe('CSV compound fields', () => {
    test('array elements are validated in CSV too', () => {
        // MEOT buyDetails element with an invalid side
        const meot = {
            actionType: 'NEW', firmROEID: '20250317_T1', type: 'MEOT', tradeKeyDate: '20250317T093000.000',
            tradeID: 'T1', symbol: 'AAPL', eventTimestamp: '20250317T093000.000', manualFlag: 'false',
            quantity: '100', price: '10', sideDetailsInd: 'NA',
            buyDetails: '20250317T093000.000@O1@ZZ', sellDetails: '20250317T093000.000@O2@SL',
        };
        assert.ok(issues(meot, 'csv').some(s => s.startsWith('buyDetails:') && s.includes(':error')));
    });

    test('retired positions in CSV must be blank', () => {
        const fields = parseCSV('NEW,,20250317_Q1,MENQ,TEST,20250317T093000.000,Q1,AAPL,oops')[0];
        assert.ok(issues(fields, 'csv').some(s => s.startsWith('retiredFieldPosition_1:2207')));
    });
});

describe('sample file', () => {
    test('has no errors from the corrected rules', () => {
        const lines = fs.readFileSync(path.join(ROOT, SAMPLE_FILE), 'utf8').trim().split('\n');
        const flagged = [];
        for (const line of lines) {
            const r = JSON.parse(line);
            for (const s of issues(r)) {
                if (/^(side|senderType|electronicTimestamp):/.test(s) || /:(2144|2033|2027):/.test(s)) flagged.push(`${r.type} ${r.firmROEID} ${s}`);
            }
        }
        assert.deepStrictEqual(flagged, []);
    });
});

describe('spec version by event date', () => {
    // An ordinary (non-ADF) quote with an RFQ response, before and after the v4.2.0 cutover (12/7/2026)
    const menq = date => ({
        actionType: 'NEW', firmROEID: `${date}_Q1`, type: 'MENQ', quoteKeyDate: `${date}T093000.000`,
        quoteID: 'Q1', symbol: 'AAPL', eventTimestamp: `${date}T093000.000`, firmDesignatedID: 'F1',
        accountHolderType: 'O', unsolicitedInd: 'U', RFQFlag: true, RFQID: 'RFQ1',
    });

    test('records pick v4.1.0 r15 before 2026-12-07 and v4.2.0 from then on', () => {
        assert.strictEqual(specForRecord(menq('20261206')).version, '4.1.0r15');
        assert.strictEqual(specForRecord(menq('20261207')).version, '4.2.0');
    });

    test('the event date is Eastern Time: an epoch timestamp at 19:30 ET on 12/6 is still before the cutover', () => {
        // 2026-12-07 00:30 UTC = 2026-12-06 19:30 EST
        assert.strictEqual(recordEventDate({ eventTimestamp: '1796603400000000000' }), '20261206');
        assert.strictEqual(recordEventDate({ actionType: 'DEL', firmROEID: '20261208_X' }), '20261208');
    });

    test('RFQ fields are valid on r15 quotes and rejected after they were removed in v4.2.0', () => {
        assert.ok(!issues(menq('20261206')).some(s => /^(RFQID|RFQFlag):/.test(s)));
        assert.ok(has(menq('20261207'), 'RFQFlag:2133:error'));
        assert.ok(has(menq('20261207'), 'RFQID:2133:error'));
    });

    test('in CSV a removed field is a retired position that must be blank', () => {
        // MENQ positions 32/33 are RFQID/RFQFlag in r15 and retired in v4.2.0
        const fields = ['NEW', '', '20261208_Q1', 'MENQ', 'TEST', '20261208T093000.000', 'Q1', 'AAPL', '', '', '20261208T093000.000'];
        while (fields.length < 31) fields.push('');
        const [r] = parseCSV([...fields, 'RFQ1', 'true'].join(','));
        assert.ok(has(r, 'RFQID:2207:error', 'csv'));
        assert.ok(has(r, 'RFQFlag:2207:error', 'csv'));
    });

    test('options and multi-leg quote events do not exist in v4.2.0', () => {
        const monq = { actionType: 'NEW', firmROEID: '20261208_Q1', type: 'MONQ', eventTimestamp: '20261208T093000.000' };
        assert.ok(has(monq, 'type:2105'));
        assert.ok(!has({ ...monq, firmROEID: '20261201_Q1', eventTimestamp: '20261201T093000.000' }, 'type:2105'));
    });

    test('destinationType S (non-CAT entity) is only valid before v4.2.0', () => {
        const merq = date => ({
            actionType: 'NEW', firmROEID: `${date}_Q1`, type: 'MERQ', quoteKeyDate: `${date}T093000.000`,
            quoteID: 'Q1', symbol: 'AAPL', eventTimestamp: `${date}T093000.000`, manualFlag: false,
            destination: 'NCAT', destinationType: 'S', routedQuoteID: 'RQ1', onlyOneQuoteFlag: false,
        });
        assert.ok(!has(merq('20261206'), 'destinationType:'));
        assert.ok(has(merq('20261207'), 'destinationType:'));
    });

    test('2247 (CASH quantity) retired from production on 2026-06-01', () => {
        const cash = date => meno({ firmROEID: `${date}_ORD1`, orderKeyDate: `${date}T093000.000001`, eventTimestamp: `${date}T093000.000001`,
            timeInForce: { DAY: +date }, handlingInstructions: { CASH: 5000 }, quantity: 100 });
        assert.ok(has(cash('20260529'), 'quantity:2247'));
        assert.ok(!has(cash('20260601'), 'quantity:2247'));
    });

    test('an explicit spec overrides the event date', () => {
        assert.ok(!issues(menq('20261208'), 'json', CAT_SPECS['4.1.0r15']).some(s => /^(RFQID|RFQFlag):/.test(s)));
        assert.ok(has(menq('20261201'), 'RFQFlag:2133', 'json', CAT_SPECS['4.2.0']));
    });
});
