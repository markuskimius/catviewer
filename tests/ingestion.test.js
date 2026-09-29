// Tests for file ingestion: lossless JSON numbers, skipped-line reporting,
// bzip2 decoding, ZIP central-directory reading, and exact comparisons for
// sorting and range filters. Run with: node --test tests/
//
// The code under test is extracted from index.html (a single-file app with no
// module exports). Compressed fixtures in tests/fixtures were written by
// Python's bz2 and zipfile modules: a streaming ZIP with data descriptors, a
// ZIP64 archive, a ZIP mixing bzip2/stored/LZMA entries, a two-stream .bz2,
// and bzip2 run-length edge cases.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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

// Schema tables through validateRecord (parsers, lossless numbers, bzip2, ZIP), plus helpers
const validationBlock = slice('const CAT_CSV_FIELDS = {', 'function processFileText(');
const timestampSnippet = extract(/let _etHourFormat = null;[\s\S]*?function catTimestampToNs\(raw\) \{[\s\S]*?\n\}/, 'timestamp helpers');
const sideDetailsSnippet = extract(/function parseSideDetails\(value, fields\) \{[\s\S]*?\n\}/, 'parseSideDetails');
const displaySnippet = extract(/function formatDecimalText\([\s\S]*?\n\}/, 'formatDecimalText');
const comparableSnippet = extract(/function getComparableValue\([\s\S]*?\n\}/, 'getComparableValue');

const loaded = [], warnings = [];
const api = new Function('processFileText', 'showWarning', 'showError',
    `${validationBlock}\n${timestampSnippet}\n${sideDetailsSnippet}\n${displaySnippet}\n${comparableSnippet}\n` +
    'return { parseJSON, isLosslessNumber, plainNumberText, validateRecord, bunzip2, bytesToText, listZipEntries, handleZipFile, formatDecimalText, getComparableValue, stripGzExtension, detectFormat };'
)(
    (file, text, append) => { loaded.push({ name: file.name, text, append }); return true; },
    msg => warnings.push(msg),
    msg => { throw new Error(`unexpected showError: ${msg}`); },
);

const readFixture = name => new Uint8Array(fs.readFileSync(path.join(FIXTURES, name)));
const fixtureFile = name => {
    const buf = fs.readFileSync(path.join(FIXTURES, name));
    return { name, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) };
};

describe('lossless JSON numbers', () => {
    const line = '{"actionType":"NEW","errorROEID":12345678901234567890,"eventTimestamp":1742218200123456789,' +
        '"price":1234567890.12345678,"quantity":100,"orderID":"1234567890123456789",' +
        '"aggregatedOrders":[{"orderID":"A","quantity":123456.1234567891234}]}';
    const [r] = api.parseJSON(line);

    test('numbers beyond double precision keep their exact digits', () => {
        assert.strictEqual(r.eventTimestamp, '1742218200123456789');
        assert.strictEqual(r.errorROEID, '12345678901234567890');
        assert.strictEqual(r.price, '1234567890.12345678');
        assert.strictEqual(r.aggregatedOrders[0].quantity, '123456.1234567891234');
    });

    test('short numbers stay numbers and strings are untouched', () => {
        assert.strictEqual(r.quantity, 100);
        assert.strictEqual(r.orderID, '1234567890123456789');
        assert.ok(!api.isLosslessNumber(r, 'orderID'));
    });

    test('the values are recorded as JSON numbers, including inside arrays', () => {
        assert.ok(api.isLosslessNumber(r, 'eventTimestamp'));
        assert.ok(api.isLosslessNumber(r, 'price'));
        assert.ok(api.isLosslessNumber(r.aggregatedOrders[0], 'quantity'));
    });

    test('validation treats them as numbers and checks their real digits', () => {
        const rec = api.parseJSON('{"actionType":"NEW","firmROEID":"20250317_O1","type":"MENO","orderKeyDate":1742218200123456789,' +
            '"orderID":"O1","symbol":"AAPL","eventTimestamp":1742218200123456789,"deptType":"A","side":"B",' +
            '"price":10.123456789012345678,"quantity":100,"orderType":"LMT","timeInForce":{"DAY":20250317},"tradingSession":"REG",' +
            '"firmDesignatedID":"F1","accountHolderType":"I","representativeInd":"N"}')[0];
        const errs = api.validateRecord(rec, 'json') || {};
        assert.ok(!Object.values(errs).flat().some(e => /Expected number/.test(e.message)), JSON.stringify(errs));
        // 18 decimal places exceeds Price's 8, which a double would have hidden
        assert.ok((errs.price || []).some(e => /Decimal places exceed max 8/.test(e.message)), JSON.stringify(errs.price));
    });

    test('exponent notation becomes plain decimal text', () => {
        assert.strictEqual(api.plainNumberText(1e-8), '0.00000001');
        assert.strictEqual(api.plainNumberText(1.5e-7), '0.00000015');
        assert.strictEqual(api.plainNumberText(-2.5e-3), '-0.0025');
        assert.strictEqual(api.plainNumberText(1e21), '1000000000000000000000');
        assert.strictEqual(api.plainNumberText('123.45'), '123.45');
    });

    test('display formatting keeps every digit', () => {
        assert.strictEqual(api.formatDecimalText('1234567.123456', { group: true }), '1,234,567.123456');
        assert.strictEqual(api.formatDecimalText('0.123456', { group: true }), '0.123456');
        assert.strictEqual(api.formatDecimalText('10.5', { minFractionDigits: 2 }), '10.50');
        assert.strictEqual(api.formatDecimalText(1e-8, {}), '0.00000001');
        assert.strictEqual(api.formatDecimalText('abc', {}), null);
    });
});

describe('malformed JSON lines', () => {
    test('are reported with line numbers instead of dropped silently', () => {
        const recs = api.parseJSON('{"type":"MENO"}\n{"type":"MENO", bad}\n\n{"type":"MEOR"}\nnot json');
        assert.strictEqual(recs.length, 2);
        assert.deepStrictEqual(recs.skippedLines.map(s => s.line), [2, 5]);
    });

    test('a JSON array and a single pretty-printed object still load', () => {
        assert.strictEqual(api.parseJSON('[{"type":"MENO"},\n {"type":"MEOR"}]').length, 2);
        const single = api.parseJSON('{\n  "type": "MENO",\n  "orderID": "O1"\n}');
        assert.strictEqual(single.length, 1);
        assert.strictEqual(single[0].orderID, 'O1');
    });

    test('an invalid JSON array is reported, not parsed line by line', () => {
        const recs = api.parseJSON('[{"type":"MENO"},\n oops]');
        assert.strictEqual(recs.length, 0);
        assert.match(recs.skippedLines[0].message, /not a valid JSON array/);
    });
});

describe('bzip2', () => {
    const decode = name => Buffer.from(api.bytesToText(api.bunzip2(readFixture(name))), 'utf8');

    test('decodes a CAT JSON file', () => {
        const lines = decode('sample.json.bz2').toString().trim().split('\n');
        assert.strictEqual(lines.length, 84);
        for (const l of lines) JSON.parse(l);
    });

    test('decodes concatenated streams', () => {
        assert.strictEqual(decode('two-streams.csv.bz2').toString(), 'DEL,,20250317_TE_001\nDEL,,20250317_TE_002\n');
    });

    test('handles run-length edge cases (runs of 1-5, 259, 260 and every byte value)', () => {
        const expected = Buffer.concat([
            Buffer.alloc(1000, 'a'), Buffer.alloc(3, 'b'), Buffer.alloc(4, 'c'), Buffer.alloc(5, 'd'),
            Buffer.alloc(259, 'e'), Buffer.alloc(260, 'f'), Buffer.from([...Array(3)].flatMap(() => [...Array(256).keys()])),
        ]);
        assert.ok(Buffer.concat(api.bunzip2(readFixture('runs.bin.bz2'))).equals(expected));
    });

    test('rejects corrupt, truncated and non-bzip2 input', () => {
        const bad = readFixture('sample.json.bz2');
        bad[200] ^= 0xff;
        assert.throws(() => api.bunzip2(bad), /CRC|invalid/);
        assert.throws(() => api.bunzip2(readFixture('sample.json.bz2').slice(0, 500)), /truncated/);
        assert.throws(() => api.bunzip2(new TextEncoder().encode('{"type":"MENO"}')), /not a bzip2 file/);
    });

    test('.bz2 names are detected by their inner extension', () => {
        assert.strictEqual(api.stripGzExtension('x.csv.bz2'), 'x.csv');
        assert.strictEqual(api.detectFormat('x.json.bz2', '{}'), 'json');
    });
});

describe('ZIP archives', () => {
    const load = async name => {
        loaded.length = 0;
        warnings.length = 0;
        const ok = await api.handleZipFile(fixtureFile(name), false);
        return { ok, files: loaded.map(f => ({ name: f.name, lines: f.text.trim().split('\n').length, append: f.append })), warnings: [...warnings] };
    };

    test('streaming ZIPs (data descriptors, zero sizes in local headers) load every entry', async () => {
        const r = await load('streamed-data-descriptors.zip');
        assert.ok(r.ok);
        assert.deepStrictEqual(r.files, [
            { name: 'streamed.json', lines: 84, append: false },
            { name: 'streamed2.csv', lines: 2, append: true },
        ]);
    });

    test('ZIP64 archives are read through the ZIP64 end of central directory', async () => {
        const r = await load('zip64.zip');
        assert.deepStrictEqual(r.files.map(f => f.name), ['one.json', 'two.json']);
        assert.strictEqual(r.files[0].lines, 84);
    });

    test('bzip2-compressed and .bz2 entries load; unsupported entries are skipped with a warning', async () => {
        const r = await load('mixed-methods.zip');
        assert.deepStrictEqual(r.files.map(f => [f.name, f.lines]), [['m12.json', 84], ['inner.json.bz2', 84]]);
        assert.strictEqual(r.warnings.length, 1);
        assert.match(r.warnings[0], /lzma\.json.*unsupported compression method 14/);
    });
});

describe('comparable values for sorting and range filters', () => {
    test('timestamps compare as exact instants across ET strings and epoch numbers', () => {
        const ts = v => api.getComparableValue('eventTimestamp', v, 'timestamp');
        assert.ok(ts('20250317 092959.999999999') < ts('1742218200000000000'));
        assert.ok(ts('1742218200000000001') > ts('20250317T093000'));
        assert.strictEqual(ts('20250317T093000'), ts('1742218200000000000'));
        assert.strictEqual(ts('not a time'), null);
    });

    test('long integers compare exactly; non-numbers have no numeric value', () => {
        const num = v => api.getComparableValue('errorROEID', v, 'number');
        assert.ok(num('12345678901234567891') > num('12345678901234567890'));
        assert.ok(num('12345678901234567890') > num(5));
        assert.strictEqual(num('abc'), null);
    });
});
