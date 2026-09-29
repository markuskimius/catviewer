// Tests for CSV export cell formatting (exportCellText). Run with: node --test tests/
//
// The code under test is extracted from index.html (a single-file app with no
// module exports): the schema/validation block for the element schemas and
// number/NVP helpers, plus sideDetailElementFields and exportCellText.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(pattern, label) {
    const m = html.match(pattern);
    assert.ok(m, `could not extract ${label} from index.html`);
    return m[0];
}
const start = html.indexOf('const CAT_CSV_FIELDS = {'), end = html.indexOf('function processFileText(');
assert.ok(start >= 0 && end > start, 'could not locate the schema/validation block in index.html');

const { exportCellText } = new Function([
    html.slice(start, end),
    extract(/const TRADE_SIDE_FIELDS = .*;/, 'TRADE_SIDE_FIELDS'),
    extract(/const AGGREGATED_ORDER_FIELDS = .*;/, 'AGGREGATED_ORDER_FIELDS'),
    extract(/function sideDetailElementFields\([\s\S]*?\n\}/, 'sideDetailElementFields'),
    extract(/function exportCellText\([\s\S]*?\n\}/, 'exportCellText'),
    'return { exportCellText };',
].join('\n'))();

describe('CSV export cells', () => {
    test('compound arrays use CAT CSV notation in element schema order', () => {
        const meot = { type: 'MEOT' };
        const buy = [{ orderID: 'O1', orderKeyDate: '20250317T093000.000', side: 'B' }, { side: 'B', orderID: 'O2', orderKeyDate: '20250317T093001.000' }];
        assert.strictEqual(exportCellText(buy, 'buyDetails', meot), '20250317T093000.000@O1@B|20250317T093001.000@O2@B');
    });

    test('name/value pair objects use CAT notation', () => {
        assert.strictEqual(exportCellText({ DAY: 20250317 }, 'timeInForce', { type: 'MENO' }), 'DAY=20250317');
        assert.strictEqual(exportCellText({ ALG: true, DISQ: 100 }, 'handlingInstructions', { type: 'MENO' }), 'ALG|DISQ=100');
    });

    test('quotes commas, quotes, CR and LF', () => {
        assert.strictEqual(exportCellText('a,b'), '"a,b"');
        assert.strictEqual(exportCellText('say "hi"'), '"say ""hi"""');
        assert.strictEqual(exportCellText('a\rb'), '"a\rb"');
        assert.strictEqual(exportCellText('a\nb'), '"a\nb"');
    });

    test('neutralizes spreadsheet formulas but leaves numbers alone', () => {
        assert.strictEqual(exportCellText('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
        assert.strictEqual(exportCellText('@SUM(A1)'), "'@SUM(A1)");
        assert.strictEqual(exportCellText('+1-2'), "'+1-2");
        assert.strictEqual(exportCellText(-5), '-5');
        assert.strictEqual(exportCellText('-0.25'), '-0.25');
    });

    test('numbers keep every digit and never use exponent notation', () => {
        assert.strictEqual(exportCellText(1e-8), '0.00000001');
        assert.strictEqual(exportCellText('1742218200123456789'), '1742218200123456789');
        assert.strictEqual(exportCellText(null), '');
        assert.strictEqual(exportCellText(undefined), '');
    });
});
