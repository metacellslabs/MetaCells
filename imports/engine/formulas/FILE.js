import { defineFormula } from './definition.js';

export const FILE_OUTPUT_PREFIX = '__FILE_OUTPUT__:';

export function parseFileOutputValue(value) {
  var raw = String(value == null ? '' : value);
  if (raw.indexOf(FILE_OUTPUT_PREFIX) !== 0) return null;
  try {
    var parsed = JSON.parse(raw.substring(FILE_OUTPUT_PREFIX.length));
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

export function buildFileOutputValue(payload) {
  return (
    FILE_OUTPUT_PREFIX +
    JSON.stringify({
      name: String((payload && payload.name) || 'file'),
      content: String((payload && payload.content) || ''),
      type: String((payload && payload.type) || 'TXT').toUpperCase(),
    })
  );
}

export default defineFormula({
  name: 'FILE',
  signature: 'FILE(name, content, type)',
  summary:
    'Creates a downloadable file output. name is the file name, content is the file text, type is the format (default: TXT).',
  examples: [
    '`=FILE("report.txt", A1, "TXT")`',
    '`=FILE("data.csv", A1:B10, "CSV")`',
  ],
  execute: ({ args, helpers }) => {
    var nameScalar = helpers.firstScalar(args[0]);
    var name = String(nameScalar != null ? nameScalar : '').trim() || 'file';
    var rawContent = args.length > 1 ? args[1] : '';
    var typeScalar = helpers.firstScalar(args[2]);
    var type =
      String(typeScalar != null ? typeScalar : 'TXT')
        .trim()
        .toUpperCase() || 'TXT';

    var content;
    if (Array.isArray(rawContent)) {
      content = helpers.matrixToCsv(helpers.toMatrix(rawContent));
    } else {
      content = String(rawContent == null ? '' : rawContent);
    }

    return buildFileOutputValue({ name, content, type });
  },
});
