import Parser from 'web-tree-sitter';
import parserRuntime from 'web-tree-sitter/tree-sitter.wasm?url';
import initializeWasm, { initialize_topiary, format_wirefilter } from '../formatter/pkg/wirefilter_formatter.js';
import formatterRuntime from '../formatter/pkg/wirefilter_formatter_bg.wasm?url';
import highlightQuery from '../../tree-sitter-wirefilter/queries/highlights.scm?raw';
import formattingQuery from '../../topiary/queries/formatting.scm?raw';

export const defaultFormattingQuery = formattingQuery;
export const defaultIndent = 4;

let parser, language, highlights, initialization;
export function initialize() {
  return initialization ??= (async () => {
    await Parser.init({ locateFile: () => parserRuntime });
    window.TreeSitter = Parser;
    language = await Parser.Language.load('/tree-sitter-wirefilter.wasm');
    parser = new Parser();
    parser.setLanguage(language);
    highlights = language.query(highlightQuery);
    await initializeWasm(formatterRuntime);
    await initialize_topiary();
  })();
}

const escapeHTML = value => value.replace(/[&<>"']/g, ch => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[ch]);

function inspectTree(tree) {
  const diagnostics = [];
  const stack = [tree.rootNode];
  while (stack.length) {
    const node = stack.pop();
    if (node.type === 'ERROR' || node.isMissing()) {
      diagnostics.push({
        message: node.isMissing() ? `Missing ${node.type}` : `Unexpected syntax: ${node.text.slice(0, 50) || 'end of expression'}`,
        line: node.startPosition.row + 1,
        column: node.startPosition.column + 1,
      });
    }
    stack.push(...node.children.toReversed());
  }
  // An empty tree is still an incomplete expression.
  if (!diagnostics.length && !tree.rootNode.namedChildCount) {
    diagnostics.push({message: 'Enter a Wirefilter expression', line: 1, column: 1});
  }
  return diagnostics;
}

export function analyze(source) {
  if (!parser) throw new Error('The parser is still loading.');
  if (source.length > 20000) throw new Error('Please keep demo expressions below 20,000 characters.');
  const tree = parser.parse(source);
  try {
    const captures = highlights.captures(tree.rootNode)
      .sort((a, b) => a.node.startIndex - b.node.startIndex || b.node.endIndex - a.node.endIndex);
    let html = '', offset = 0;
    for (const { node, name } of captures) {
      if (node.startIndex < offset) continue;
      html += escapeHTML(source.slice(offset, node.startIndex));
      const style = name.split('.')[0];
      html += `<span class="token-${style}">${escapeHTML(source.slice(node.startIndex, node.endIndex))}</span>`;
      offset = node.endIndex;
    }
    html += escapeHTML(source.slice(offset));
    return { html, diagnostics: inspectTree(tree), ast: renderTree(tree.rootNode) };
  } finally { tree.delete(); }
}

function renderTree(root) {
  const lines = [];
  const pending = [{ node: root, depth: 0, field: '' }];
  while (pending.length && lines.length < 2000) {
    const { node, depth, field } = pending.pop();
    const prefix = '  '.repeat(Math.min(depth, 40));
    const location = `${node.startPosition.row + 1}:${node.startPosition.column + 1}`;
    const value = node.childCount ? '' : ` ${JSON.stringify(node.text)}`;
    lines.push(`${prefix}${field ? `${field}: ` : ''}(${node.type} ${location}${value})`);
    if (depth >= 40 && node.childCount) {
      lines.push(`${prefix}  … deeper tree omitted`);
      continue;
    }
    const children = [];
    const cursor = node.walk();
    try {
      if (cursor.gotoFirstChild()) {
        do { children.push({ node: cursor.currentNode(), depth: depth + 1, field: cursor.currentFieldName() || '' }); }
        while (cursor.gotoNextSibling());
      }
    } finally { cursor.delete(); }
    pending.push(...children.reverse());
  }
  if (pending.length) lines.push('… tree display truncated');
  return lines.join('\n');
}

// Compare the concrete tree and every literal/operator token. Editable rules
// may change whitespace, but must not change the expression being formatted.
function treeSignature(root) {
  const result = [];
  const pending = [root];
  while (pending.length) {
    const node = pending.pop();
    if (node === null) { result.push(['end']); continue; }
    result.push(['node', node.type]);
    if (!node.childCount) result.push(['token', node.text]);
    pending.push(null, ...node.children.toReversed());
  }
  return JSON.stringify(result);
}

export async function format(source, { query = defaultFormattingQuery, indent = defaultIndent } = {}) {
  await initialize();
  if (source.length > 20000) throw new Error('Please keep demo expressions below 20,000 characters.');
  if (typeof query !== 'string' || query.length > 64000) {
    throw new Error('Formatting rules must be a Topiary query below 64,000 characters.');
  }
  if (![2, 4, 8].includes(indent)) throw new Error('Indentation must be 2, 4, or 8 spaces.');
  let original;
  const tree = parser.parse(source);
  try {
    const errors = inspectTree(tree);
    if (errors.length) throw new Error(`Fix syntax errors before formatting: ${errors[0].message}`);
    original = treeSignature(tree.rootNode);
  } finally { tree.delete(); }
  // Report query compiler errors without exposing a Rust/JS stack trace in
  // the rules editor. Topiary still validates capture names and predicates.
  let compiledQuery;
  try { compiledQuery = language.query(query); }
  catch (error) { throw new Error(`Invalid formatting query: ${error.message.split('\n')[0]}`); }
  finally { compiledQuery?.delete(); }
  let output;
  try { output = format_wirefilter(source, language, query, indent); }
  catch (error) {
    const message = error.message || String(error);
    const queryError = message.match(/Query\("([^"\n]+)"\)/);
    if (queryError) throw new Error(`Formatting rule error: ${queryError[1]}`);
    if (message.includes('IdempotenceParsing')) throw new Error('Formatting rules produced invalid syntax.');
    if (message.includes('Idempotence')) throw new Error('Formatting rules must produce stable output when applied twice.');
    throw error;
  }
  const formattedTree = parser.parse(output);
  try {
    if (inspectTree(formattedTree).length || treeSignature(formattedTree.rootNode) !== original) {
      throw new Error('Formatting rules changed expression syntax or token contents. Adjust the rules to change whitespace only.');
    }
  } finally { formattedTree.delete(); }
  return output;
}
