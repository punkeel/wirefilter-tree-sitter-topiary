import { initialize, analyze, format } from './engine.js';
import './style.css';

const samples = {
  'method-and-ip': {
    label: 'GET + IP set',
    source: '(\nhttp.request.method eq "GET"\nand ip.src in {192.0.2.0/24 2001:db8::/32}\n) or not http.request.uri.path contains r#"/admin"#',
  },
  operators: {
    label: 'Operators + list',
    source: '(tcp.flags & 0x02) xor (http.user_agent matches "(?i)bot" and http.host strict wildcard "*.example.com") or ip.src in $office_ips',
  },
  quantifiers: {
    label: 'Quantifiers + indexes',
    source: 'any(http.request.headers["user-agent"][*] contains "bot") and not all(http.request.headers["x-role"][*] eq "guest")',
  },
  ranges: {
    label: 'Ranges + raw string',
    source: '(len(http.request.uri.path) gt 20 and http.request.uri.path wildcard r##"*\\"quoted\\"*"##) and ip.src in {10.0.0.1..10.0.0.254 2001:db8::1..2001:db8::ff}',
  },
  invalid: {
    label: 'Invalid expression',
    source: 'http.request.method eq "GET" and',
  },
};

const defaultSample = 'method-and-ip';

const elements = {
  runtimeStatus: document.querySelector('#runtime-status'),
  runtimeStatusText: document.querySelector('#runtime-status-text'),
  sampleSelect: document.querySelector('#sample-select'),
  resetButton: document.querySelector('#reset-button'),
  formatButton: document.querySelector('#format-button'),
  sourceInput: document.querySelector('#source-input'),
  codeScroll: document.querySelector('#code-scroll'),
  syntaxLayer: document.querySelector('#syntax-layer'),
  highlightCode: document.querySelector('#highlight-code'),
  lineNumbers: document.querySelector('#line-numbers'),
  cursorPosition: document.querySelector('#cursor-position'),
  editorHelp: document.querySelector('#editor-help'),
  diagnosticsPanel: document.querySelector('#diagnostics-panel'),
  diagnosticCount: document.querySelector('#diagnostic-count'),
  diagnosticEmpty: document.querySelector('#diagnostic-empty'),
  diagnosticList: document.querySelector('#diagnostic-list'),
  astOutput: document.querySelector('#ast-output'),
  formattedOutput: document.querySelector('#formatted-output'),
  copyOutputButton: document.querySelector('#copy-output-button'),
  formatStatus: document.querySelector('#format-status'),
  copyFeedback: document.querySelector('#copy-feedback'),
  announcer: document.querySelector('#announcer'),
};

let parserReady = false;
let currentAnalysis = null;
let formatRequest = 0;
let copyFeedbackTimer;

function setRuntimeStatus(state, message) {
  elements.runtimeStatus.className = `runtime-status is-${state}`;
  elements.runtimeStatusText.textContent = message;
}

function announce(message) {
  window.clearTimeout(announce.timer);
  elements.announcer.textContent = '';
  announce.timer = window.setTimeout(() => {
    elements.announcer.textContent = message;
  }, 20);
}

function errorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message.replace(/\s+/g, ' ').trim();
  }
  return String(error || 'Unknown parser error').replace(/\s+/g, ' ').trim();
}

function updateLineNumbers(source) {
  const lineCount = Math.max(1, source.split('\n').length);
  elements.lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');
}

function updateCursorPosition() {
  const source = elements.sourceInput.value.slice(0, elements.sourceInput.selectionStart || 0);
  const line = source.split('\n').length;
  const lastLineBreak = source.lastIndexOf('\n');
  const column = source.length - lastLineBreak;
  elements.cursorPosition.textContent = `Ln ${line}, Col ${column}`;
}

function syncEditorScroll() {
  const { sourceInput, syntaxLayer, lineNumbers } = elements;
  syntaxLayer.scrollTop = sourceInput.scrollTop;
  syntaxLayer.scrollLeft = sourceInput.scrollLeft;
  lineNumbers.scrollTop = sourceInput.scrollTop;
}

function formatLocation(diagnostic) {
  const line = Number.isFinite(Number(diagnostic?.line)) ? Number(diagnostic.line) : null;
  const column = Number.isFinite(Number(diagnostic?.column)) ? Number(diagnostic.column) : null;
  if (line === null && column === null) return 'source';
  if (line === null) return `column ${column}`;
  if (column === null) return `line ${line}`;
  return `line ${line}, column ${column}`;
}

function sourceOffsetFor(line, column) {
  const source = elements.sourceInput.value;
  const targetLine = Math.max(1, Number(line) || 1);
  const targetColumn = Math.max(1, Number(column) || 1);
  let offset = 0;
  for (let currentLine = 1; currentLine < targetLine; currentLine += 1) {
    const nextBreak = source.indexOf('\n', offset);
    if (nextBreak === -1) return source.length;
    offset = nextBreak + 1;
  }
  return Math.min(source.length, offset + targetColumn - 1);
}

function focusDiagnostic(diagnostic) {
  const offset = sourceOffsetFor(diagnostic.line, diagnostic.column);
  elements.sourceInput.focus();
  elements.sourceInput.setSelectionRange(offset, Math.min(elements.sourceInput.value.length, offset + 1));
  updateCursorPosition();
}

function renderDiagnostics(diagnostics) {
  const issues = Array.isArray(diagnostics) ? diagnostics : [];
  elements.diagnosticList.replaceChildren();
  elements.diagnosticsPanel.classList.toggle('has-errors', issues.length > 0);
  elements.diagnosticEmpty.hidden = issues.length > 0;

  if (issues.length === 0) {
    elements.diagnosticCount.textContent = '0 issues';
    elements.diagnosticCount.className = 'diagnostic-count is-valid';
    return;
  }

  elements.diagnosticCount.textContent = `${issues.length} syntax ${issues.length === 1 ? 'issue' : 'issues'}`;
  elements.diagnosticCount.className = 'diagnostic-count is-error';

  issues.forEach((diagnostic, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'diagnostic-item';
    button.dataset.index = String(index);
    button.innerHTML = '<span class="diagnostic-mark" aria-hidden="true">×</span><span class="diagnostic-copy"><span class="diagnostic-message"></span><span class="diagnostic-location"></span></span>';
    button.querySelector('.diagnostic-message').textContent = diagnostic?.message || 'Syntax error';
    button.querySelector('.diagnostic-location').textContent = formatLocation(diagnostic);
    button.addEventListener('click', () => focusDiagnostic(diagnostic));
    item.append(button);
    elements.diagnosticList.append(item);
  });
}

function renderAnalysis(result) {
  currentAnalysis = result;
  elements.highlightCode.innerHTML = typeof result?.html === 'string' ? result.html : '';
  elements.astOutput.textContent = typeof result?.ast === 'string' && result.ast ? result.ast : '(no syntax tree returned)';
  renderDiagnostics(result?.diagnostics);
  elements.editorHelp.textContent = (result?.diagnostics?.length || 0) > 0
    ? 'Fix the syntax issue before running Topiary.'
    : 'Syntax is analyzed as you type.';
  updateLineNumbers(elements.sourceInput.value);
  updateCursorPosition();
}

function renderAnalysisFailure(error) {
  currentAnalysis = { diagnostics: [{ message: errorMessage(error) }] };
  elements.highlightCode.textContent = elements.sourceInput.value;
  elements.astOutput.textContent = 'Parser unavailable.';
  renderDiagnostics(currentAnalysis.diagnostics);
  elements.editorHelp.textContent = 'The parser could not analyze this input.';
  announce(`Parser error: ${errorMessage(error)}`);
}

function analyzeSource() {
  if (!parserReady) return;
  try {
    renderAnalysis(analyze(elements.sourceInput.value));
  } catch (error) {
    renderAnalysisFailure(error);
  }
}

function clearFormattedOutput(status = 'Not run yet') {
  formatRequest += 1;
  elements.formattedOutput.value = '';
  elements.formattedOutput.classList.remove('has-error');
  elements.copyOutputButton.disabled = true;
  elements.formatStatus.textContent = status;
}

function setSource(source, { clearOutput = true } = {}) {
  elements.sourceInput.value = source;
  if (clearOutput) clearFormattedOutput();
  updateLineNumbers(source);
  updateCursorPosition();
  syncEditorScroll();
  analyzeSource();
}

async function formatSource() {
  if (!parserReady) {
    announce('The parser is still starting.');
    return;
  }

  const diagnostics = currentAnalysis?.diagnostics || [];
  if (diagnostics.length > 0) {
    elements.formatStatus.textContent = 'Fix syntax issues first';
    elements.formattedOutput.classList.add('has-error');
    announce('Formatting is paused until syntax issues are fixed.');
    return;
  }

  const request = ++formatRequest;
  elements.formatButton.disabled = true;
  elements.copyOutputButton.disabled = true;
  elements.formatStatus.textContent = 'Running Topiary…';
  elements.formattedOutput.classList.remove('has-error');

  try {
    const formatted = await format(elements.sourceInput.value);
    if (request !== formatRequest) return;
    elements.formattedOutput.value = String(formatted);
    elements.copyOutputButton.disabled = elements.formattedOutput.value.length === 0;
    elements.formatStatus.textContent = 'Formatted just now';
    announce('Topiary formatting complete.');
  } catch (error) {
    if (request !== formatRequest) return;
    elements.formattedOutput.value = '';
    elements.formattedOutput.classList.add('has-error');
    elements.formatStatus.textContent = `Topiary error: ${errorMessage(error)}`;
    announce(`Topiary could not format this expression: ${errorMessage(error)}`);
  } finally {
    if (parserReady) elements.formatButton.disabled = false;
  }
}

function fallbackCopy(text) {
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.append(helper);
  helper.select();
  const copied = document.execCommand('copy');
  helper.remove();
  return copied;
}

async function copyTarget(button) {
  const target = document.querySelector(`#${button.dataset.copyTarget}`);
  const value = target?.value ?? target?.textContent ?? '';
  if (!value) {
    showCopyFeedback(button, 'Nothing to copy');
    return;
  }

  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      copied = true;
    } else {
      copied = fallbackCopy(value);
    }
  } catch {
    try {
      copied = fallbackCopy(value);
    } catch {
      copied = false;
    }
  }
  showCopyFeedback(button, copied ? 'Copied' : 'Copy unavailable');
  if (copied) announce(`${button.dataset.copyTarget === 'ast-output' ? 'Syntax tree' : 'Formatted output'} copied.`);
}

function showCopyFeedback(button, message) {
  window.clearTimeout(copyFeedbackTimer);
  elements.copyFeedback.textContent = message;
  const original = button.dataset.originalLabel || button.getAttribute('aria-label') || 'Copy';
  button.dataset.originalLabel = original;
  button.setAttribute('aria-label', message);
  button.classList.toggle('is-copied', message === 'Copied');
  const label = button.querySelector('.sr-only');
  if (label) label.textContent = message;
  copyFeedbackTimer = window.setTimeout(() => {
    elements.copyFeedback.textContent = '';
    button.setAttribute('aria-label', original);
    button.classList.remove('is-copied');
    if (label) label.textContent = original;
  }, 2200);
}

function resetToDefault() {
  elements.sampleSelect.value = defaultSample;
  setSource(samples[defaultSample].source);
  elements.sourceInput.focus();
  announce(`${samples[defaultSample].label} sample loaded.`);
}

function loadSelectedSample() {
  const sample = samples[elements.sampleSelect.value] || samples[defaultSample];
  setSource(sample.source);
  elements.sourceInput.focus();
  announce(`${sample.label} sample loaded.`);
}

function handleEditorInput() {
  clearFormattedOutput('Output cleared');
  updateLineNumbers(elements.sourceInput.value);
  updateCursorPosition();
  analyzeSource();
}

function handleShortcut(event) {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    formatSource();
  }
}

async function start() {
  setRuntimeStatus('loading', 'Starting parser');
  elements.formatButton.disabled = true;
  setSource(samples[defaultSample].source, { clearOutput: false });

  try {
    await initialize();
    parserReady = true;
    setRuntimeStatus('ready', 'Parser ready');
    elements.formatButton.disabled = false;
    analyzeSource();
  } catch (error) {
    setRuntimeStatus('error', 'Parser unavailable');
    elements.editorHelp.textContent = `Parser startup failed: ${errorMessage(error)}`;
    elements.diagnosticCount.textContent = 'Unavailable';
    elements.diagnosticCount.className = 'diagnostic-count is-error';
    announce(`Parser startup failed: ${errorMessage(error)}`);
  }
}

elements.sourceInput.addEventListener('input', handleEditorInput);
elements.sourceInput.addEventListener('scroll', syncEditorScroll);
elements.sourceInput.addEventListener('click', updateCursorPosition);
elements.sourceInput.addEventListener('keyup', updateCursorPosition);
elements.sourceInput.addEventListener('select', updateCursorPosition);
elements.sampleSelect.addEventListener('change', loadSelectedSample);
elements.resetButton.addEventListener('click', resetToDefault);
elements.formatButton.addEventListener('click', formatSource);
document.addEventListener('keydown', handleShortcut);
document.querySelectorAll('.copy-button').forEach((button) => {
  button.addEventListener('click', () => copyTarget(button));
});

start();
