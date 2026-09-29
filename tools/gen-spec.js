#!/usr/bin/env node
// Generates the viewer's spec tables from the official CAT Industry Member
// JSON schema files published at https://www.catnmsplan.com/specifications/im
//
// The base spec (v4.1.0 r15) is embedded in index.html as full tables
// (CAT_SCHEMA, CAT_CSV_FIELDS, CAT_ARRAY_ELEMENTS, ...). Each later spec is
// embedded as a delta against the base, generated here and written between
// the "generated:spec-deltas" markers in index.html.
//
// Usage:
//   node tools/gen-spec.js <base.json> <target.json> [<target.json> ...]          print the deltas
//   node tools/gen-spec.js <base.json> <target.json> [<target.json> ...] --write  update index.html
//
// tests/spec-tables.test.js uses the exported functions to check that the
// embedded tables still match the schema files.

const fs = require('node:fs');
const path = require('node:path');

// Official dataType → viewer rule [typeCode, ...constraints]
//   S = string (max length), N = number (max integer digits, max decimals),
//   SN = timestamp (string or number), B = Boolean, O = name/value pairs, A = array
function ruleTail(rawDataType) {
    // Fields that accept either type list them all, e.g. ["Industry Member ID", "Exchange ID"]
    const dataType = Array.isArray(rawDataType) ? rawDataType.join(',') : rawDataType;
    const text = /^(?:Text|Alphanumeric) \((\d+)\)$/.exec(dataType);
    if (text) return +text[1] ? ['S', +text[1]] : ['S'];
    switch (dataType) {
        case 'Choice': return ['S'];
        case 'Message Type': return ['S', 5];
        case 'CAT Reporter IMID': return ['S', 7];
        case 'Symbol': return ['S', 22];
        case 'Industry Member ID':
        case 'Industry Member ID,Exchange ID': return ['S', 16];
        case 'Timestamp': return ['SN'];
        case 'Boolean': return ['B'];
        case 'Unsigned': return ['N', 20, 0];
        case 'Integer': return ['N', 19, 0];
        case 'Price': return ['N', 10, 8];
        case 'Real Quantity': return ['N', 12, 6];
        case 'Whole Quantity': return ['N', 12, 0];
        case 'Date': return ['N', 8, 0];
        case 'Name/Value Pairs': return ['O'];
        case 'Array':
        case 'Aggregated Orders':
        case 'Aggregated Order Details':
        case 'Trade Side Details':
        case 'Fulfillment Side Details':
        case 'Leg Details': return ['A'];
    }
    throw new Error(`Unknown dataType "${dataType}" — add it to ruleTail() in tools/gen-spec.js`);
}

const REQUIRED = { Required: 'R', Conditional: 'C', Optional: 'O' };
const req = f => {
    if (!REQUIRED[f.required]) throw new Error(`Unknown required value "${f.required}" on ${f.name}`);
    return REQUIRED[f.required];
};

// Full viewer tables for one schema file
function buildTables(json) {
    const schema = {}, csvFields = {}, arrayElements = {};
    for (const ev of json.eventDefinitions) {
        const t = ev.eventName;
        const fields = [...ev.fields].sort((a, b) => +a.position - +b.position);
        schema[t] = {};
        csvFields[t] = [];
        for (const f of fields) {
            schema[t][f.name] = [req(f), ...ruleTail(f.dataType)];
            csvFields[t][+f.position - 1] = f.name;
            if (f.arrayElements) {
                (arrayElements[t] ||= {})[f.name] = f.arrayElements.map(e => [e.name, req(e), ...ruleTail(e.dataType)]);
            }
        }
    }
    const dataType = name => json.dataTypes.find(d => d.dataType === name);
    return {
        version: json.version,
        schema,
        csvFields,
        arrayElements,
        types: [...dataType('Message Type').allowedValues],
        exchanges: [...dataType('Exchange ID').allowedValues],
        choices: Object.fromEntries(Object.entries(json.choices).map(([k, v]) => [k, [...v]])),
        nameValuePairs: Object.fromEntries(json.nameValuePairDefinitions.map(n => [n.nameValuePair, n.fields.map(f => `${f.name}:${f.dataType}`)])),
    };
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// What changes from base to target, in the shape index.html applies at load
// (applySpecDelta): removed event types, per-type field changes (null removes
// a field), replaced array element lists, replaced choice lists, and the
// exchange list if it changed.
function specDelta(baseJson, targetJson) {
    const base = buildTables(baseJson), target = buildTables(targetJson);
    const delta = { removedTypes: [], addedTypes: [], fields: {}, arrayElements: {}, choices: {}, exchanges: null };
    for (const t of Object.keys(base.schema)) if (!target.schema[t]) delta.removedTypes.push(t);
    for (const t of Object.keys(target.schema)) {
        if (!base.schema[t]) {
            delta.addedTypes.push(t);
            delta.fields[t] = target.schema[t];
            if (target.arrayElements[t]) delta.arrayElements[t] = target.arrayElements[t];
            continue;
        }
        const changes = {};
        for (const [f, rule] of Object.entries(target.schema[t])) {
            if (!same(base.schema[t][f], rule)) changes[f] = rule;
        }
        for (const f of Object.keys(base.schema[t])) if (!(f in target.schema[t])) changes[f] = null;
        if (Object.keys(changes).length) delta.fields[t] = changes;
        for (const [f, elems] of Object.entries(target.arrayElements[t] || {})) {
            if (!same((base.arrayElements[t] || {})[f], elems)) (delta.arrayElements[t] ||= {})[f] = elems;
        }
    }
    for (const [k, v] of Object.entries(target.choices)) if (!same(base.choices[k], v)) delta.choices[k] = v;
    for (const k of Object.keys(base.choices)) if (!(k in target.choices)) delta.choices[k] = [];
    if (!same([...base.exchanges].sort(), [...target.exchanges].sort())) delta.exchanges = target.exchanges;

    // CSV layout: the viewer parses every version with the base layout, which
    // only works while later versions retire positions instead of moving fields
    for (const [t, cols] of Object.entries(target.csvFields)) {
        const baseCols = base.csvFields[t];
        if (!baseCols) continue;
        cols.forEach((name, i) => {
            if (name !== baseCols[i] && name !== 'retiredFieldPosition' && name !== 'reservedForFutureUse') {
                throw new Error(`${t} position ${i + 1} changed from ${baseCols[i]} to ${name}; the base CSV layout no longer parses v${target.version}`);
            }
        });
    }
    // Name/value pair attribute sets are hand-maintained in index.html (HI_*, TIF_*, BRP_ARP_ATTRS)
    const nvpWarnings = [];
    for (const [k, v] of Object.entries(target.nameValuePairs)) {
        if (base.nameValuePairs[k] && !same(base.nameValuePairs[k], v)) nvpWarnings.push(`${k} attributes changed`);
    }
    return { delta, nvpWarnings };
}

const BEGIN = '// <generated:spec-deltas> — written by tools/gen-spec.js from the official schema files; do not edit';
const END = '// </generated:spec-deltas>';

function renderDeltas(entries) {
    const lines = [BEGIN, 'const CAT_SPEC_DELTAS = {'];
    for (const { version, source, delta } of entries) {
        lines.push(`  ${JSON.stringify(version)}: {`);
        lines.push(`    source: ${JSON.stringify(source)},`);
        for (const [k, v] of Object.entries(delta)) lines.push(`    ${k}: ${JSON.stringify(v)},`);
        lines.push('  },');
    }
    lines.push('};', END);
    return lines.join('\n');
}

function deltasFromFiles(baseFile, targetFiles) {
    const baseJson = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
    return targetFiles.map(file => {
        const json = JSON.parse(fs.readFileSync(file, 'utf8'));
        const { delta, nvpWarnings } = specDelta(baseJson, json);
        return { version: json.version, source: path.basename(file), delta, nvpWarnings };
    });
}

function embeddedDeltasBlock(html) {
    const a = html.indexOf(BEGIN), b = html.indexOf(END);
    if (a < 0 || b < 0) return null;
    return html.slice(a, b + END.length);
}

module.exports = { ruleTail, buildTables, specDelta, renderDeltas, deltasFromFiles, embeddedDeltasBlock };

if (require.main === module) {
    const args = process.argv.slice(2);
    const write = args.includes('--write');
    const files = args.filter(a => a !== '--write');
    if (files.length < 2) {
        console.error('usage: node tools/gen-spec.js <base.json> <target.json> [...] [--write]');
        process.exit(2);
    }
    const entries = deltasFromFiles(files[0], files.slice(1));
    for (const e of entries) for (const w of e.nvpWarnings) console.error(`warning: v${e.version}: ${w} — update the hand-maintained NVP sets in index.html`);
    const block = renderDeltas(entries);
    if (!write) {
        console.log(block);
    } else {
        const htmlFile = path.join(__dirname, '..', 'index.html');
        const html = fs.readFileSync(htmlFile, 'utf8');
        const current = embeddedDeltasBlock(html);
        if (!current) {
            console.error('index.html has no generated:spec-deltas markers');
            process.exit(1);
        }
        fs.writeFileSync(htmlFile, html.replace(current, block));
        console.log(`updated index.html (${entries.map(e => 'v' + e.version).join(', ')})`);
    }
}
