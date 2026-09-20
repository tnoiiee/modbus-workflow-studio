#!/usr/bin/env node
/**
 * Repository hygiene scanner for modbus-workflow-studio.
 *
 * Purpose: make it impossible to publish critical or operational files by accident.
 * The scanner checks only what Git would publish (tracked files, staged changes, or
 * reachable history) and never prints the value of a suspected secret in full.
 *
 * Modes
 *   (default) --worktree   tracked files + untracked files that are not ignored
 *   --staged               files staged for the next commit (index content)
 *   --tracked              tracked files only
 *   --history              audit every path that ever existed in reachable history
 *   --all                  tracked tree and reachable history in one run
 *
 * Options
 *   --strict               treat warnings as errors
 *   --soft-history         report history findings as warnings (used before a history reset)
 *   --json                 print a machine-readable summary to stdout
 *   --report <file>        write a masked Markdown report
 *   --quiet                print only the final summary line
 *   --help                 show usage
 *
 * Exit codes
 *   0  no errors
 *   1  errors found
 *   2  usage or environment error
 *
 * No dependencies. Requires Node.js >= 20 and Git on PATH.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SCRIPT_RELATIVE_PATH = 'scripts/hygiene-check.mjs';
const MAX_CONTENT_SCAN_BYTES = 2 * 1024 * 1024; // 2 MiB — larger files are not content-scanned
const LARGE_FILE_WARN_BYTES = 1024 * 1024; // 1 MiB
const LARGE_FILE_ERROR_BYTES = 10 * 1024 * 1024; // 10 MiB
const MAX_HISTORY_FINDINGS = 200;

const COLORS = process.stdout.isTTY
  ? { red: '\u001b[31m', yellow: '\u001b[33m', green: '\u001b[32m', dim: '\u001b[2m', reset: '\u001b[0m' }
  : { red: '', yellow: '', green: '', dim: '', reset: '' };

/* -------------------------------------------------------------------------- */
/* path policy                                                                */
/* -------------------------------------------------------------------------- */

const PATH_RULES = [
  {
    id: 'env-file',
    severity: 'error',
    globs: ['**/.env', '**/.env.*'],
    allow: ['**/.env.example', '**/.env.sample', '**/.env.template'],
    message: 'Environment files stay local. Commit a sanitized .env.example instead.',
  },
  {
    id: 'credential-file',
    severity: 'error',
    globs: ['**/.npmrc', '**/.netrc', '**/.git-credentials', '**/credentials.json', '**/service-account*.json'],
    message: 'Credential store. Never version this file.',
  },
  {
    id: 'private-key-file',
    severity: 'error',
    globs: [
      '**/*.pem',
      '**/*.key',
      '**/*.p12',
      '**/*.pfx',
      '**/*.jks',
      '**/*.keystore',
      '**/*.ppk',
      '**/id_rsa*',
      '**/id_ed25519*',
      '**/.ssh/**',
    ],
    message: 'Key material or SSH configuration. Never version this file.',
  },
  {
    id: 'runtime-data',
    severity: 'error',
    globs: ['server/data/**', 'data/**'],
    allow: ['server/data/.gitkeep', 'data/.gitkeep'],
    message:
      'DATA_DIR runtime state (devices, workflows, monitor lists, audit records) is operational data and must stay out of Git.',
  },
  {
    id: 'build-output',
    severity: 'error',
    globs: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/coverage/**',
      '**/.next/**',
      '**/.vite/**',
      '**/.cache/**',
      '**/.turbo/**',
      '**/*.tsbuildinfo',
    ],
    message: 'Generated build output is recreated locally and must not be committed.',
  },
  {
    id: 'log-or-database',
    severity: 'error',
    globs: [
      '**/*.log',
      '**/*.tmp',
      '**/*.temp',
      '**/*.bak',
      '**/*.orig',
      '**/*.rej',
      '**/*.swp',
      '**/*.swo',
      '**/*.sqlite',
      '**/*.sqlite3',
      '**/*.db',
      '**/*.dump',
      '**/*.sql.gz',
    ],
    message: 'Logs, databases, and temporary files must never be committed.',
  },
  {
    id: 'archive-artifact',
    severity: 'warn',
    globs: ['**/*.zip', '**/*.7z', '**/*.tar', '**/*.tar.gz', '**/*.tgz', '**/*.bundle'],
    message: 'Archives and backup bundles belong in external storage, not in Git.',
  },
  {
    id: 'editor-or-os-file',
    severity: 'warn',
    globs: [
      '**/.DS_Store',
      '**/._*',
      '**/Thumbs.db',
      '**/Desktop.ini',
      '**/.idea/**',
      '**/.vscode/**',
      '**/*.code-workspace',
    ],
    message: 'Editor and operating-system scratch file.',
  },
  {
    id: 'hygiene-report',
    severity: 'warn',
    globs: ['**/hygiene-report.md', '**/.hygiene-out/**'],
    message: 'Scanner output. Keep it local and attach it to a review request instead.',
  },
];

/* -------------------------------------------------------------------------- */
/* content policy                                                             */
/* -------------------------------------------------------------------------- */

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.cs', '.java', '.go', '.rb', '.php']);

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.yml',
  '.yaml',
  '.sh',
  '.bash',
  '.ps1',
  '.psm1',
  '.bat',
  '.cmd',
  '.py',
  '.cs',
  '.java',
  '.go',
  '.rb',
  '.php',
  '.ini',
  '.cfg',
  '.conf',
  '.toml',
  '.xml',
  '.env',
]);

const PLACEHOLDER_VALUE_PATTERNS = [
  /example/i,
  /sample/i,
  /placeholder/i,
  /change[-_ ]?me/i,
  /your[-_ ]/i,
  /redact/i,
  /dummy/i,
  /\*\*\*/,
  /^<.*>$/,
  /^\$\{.*\}$/,
  /^process\.env/i,
  /^import\.meta\.env/i,
  /^env\./i,
  /^x{3,}$/i,
  /^\.{3,}$/,
  /^\*+$/,
  /^-+$/,
  /^_{3,}$/,
  /^(true|false|null|none|undefined)$/i,
  /^(string|number|boolean)$/i,
];

const PRIVATE_IPV4 = /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/;

const CONTENT_RULES = [
  {
    id: 'private-key-block',
    severity: 'error',
    re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
    message: 'Private key material found in file content.',
  },
  {
    id: 'aws-access-key',
    severity: 'error',
    re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/,
    message: 'AWS access key identifier.',
  },
  {
    id: 'github-token',
    severity: 'error',
    re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b/,
    message: 'GitHub token.',
  },
  {
    id: 'slack-token',
    severity: 'error',
    re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
    message: 'Slack token.',
  },
  {
    id: 'google-api-key',
    severity: 'error',
    re: /\bAIza[0-9A-Za-z_-]{35}\b/,
    message: 'Google API key.',
  },
  {
    id: 'provider-api-key',
    severity: 'error',
    re: /\b(?:sk-(?:ant-)?[A-Za-z0-9_-]{20,}|[rs]k_live_[0-9A-Za-z]{16,})\b/,
    message: 'Third-party API key.',
  },
  {
    id: 'jwt',
    severity: 'error',
    re: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    message: 'Serialized JSON Web Token.',
  },
  {
    id: 'credentialed-url',
    severity: 'error',
    re: /[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/:@]+@/,
    message: 'URL with embedded credentials.',
  },
  {
    id: 'assigned-secret',
    severity: 'error',
    docsSeverity: 'warn',
    sourceFileSeverity: 'warn',
    re: /(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token)["']?\s*[:=]\s*["']?([^\s"',;#]{8,})/i,
    message: 'Credential-like value assigned in a file. Confirm it is not a real secret.',
    valueGroup: 2,
  },
  {
    id: 'private-network-address',
    severity: 'warn',
    re: PRIVATE_IPV4,
    scope: 'code',
    message: 'Private network address. Device topology and endpoints are operational information.',
  },
  {
    id: 'local-user-path',
    severity: 'warn',
    re: /[A-Za-z]:\\+Users\\+[^\\\s"']+/,
    message: 'Local machine path. Remove the user name before publishing.',
  },
];

/* Files that legitimately document the rules above. */
const SELF_IGNORE = new Set([SCRIPT_RELATIVE_PATH]);

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function fail(message, code = 2) {
  process.stderr.write(`hygiene-check: ${message}\n`);
  process.exit(code);
}

function runGit(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}

function tryGit(args, cwd) {
  try {
    return runGit(args, cwd);
  } catch {
    return null;
  }
}

function globToRegExp(glob) {
  let out = '^';
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        i += 1;
        if (glob[i + 1] === '/') {
          i += 1;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
    } else if (char === '?') {
      out += '[^/]';
    } else if ('\\^$.|+()[]{}'.includes(char)) {
      out += `\\${char}`;
    } else {
      out += char;
    }
  }
  return new RegExp(`${out}$`);
}

const REGEXP_CACHE = new Map();
function matchesAny(relativePath, globs) {
  for (const glob of globs) {
    let re = REGEXP_CACHE.get(glob);
    if (!re) {
      re = globToRegExp(glob);
      REGEXP_CACHE.set(glob, re);
    }
    if (re.test(relativePath)) return true;
  }
  return false;
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function mask(value) {
  const text = String(value);
  if (text.length <= 6) return `${'#'.repeat(text.length)} (${text.length} chars)`;
  return `${text.slice(0, 3)}${'#'.repeat(Math.min(text.length - 3, 12))}… (${text.length} chars)`;
}

function isPlaceholder(value) {
  const text = String(value).trim();
  if (text.length === 0) return true;
  return PLACEHOLDER_VALUE_PATTERNS.some((pattern) => pattern.test(text));
}

function looksBinary(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

function parseArgs(argv) {
  const options = {
    mode: 'worktree',
    requestedModes: new Set(),
    strict: false,
    softHistory: false,
    json: false,
    quiet: false,
    report: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--worktree':
        options.requestedModes.add('worktree');
        break;
      case '--staged':
        options.requestedModes.add('staged');
        break;
      case '--tracked':
        options.requestedModes.add('tracked');
        break;
      case '--history':
        options.requestedModes.add('history');
        break;
      case '--all':
        options.requestedModes.add('all');
        break;
      case '--strict':
        options.strict = true;
        break;
      case '--soft-history':
        options.softHistory = true;
        break;
      case '--json':
        options.json = true;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      case '--report':
        options.report = argv[i + 1];
        i += 1;
        if (!options.report) fail('--report requires a file path');
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        fail(`unknown argument: ${arg}`);
    }
  }

  const requested = options.requestedModes;
  if (requested.has('all') || (requested.has('tracked') && requested.has('history'))) {
    options.mode = 'tree+history';
  } else if (requested.size === 1) {
    const [mode] = requested;
    options.mode = mode === 'tracked' ? 'tracked' : mode;
  } else if (requested.size > 1) {
    fail('choose one scan mode, or use --all for the tracked tree plus reachable history');
  }
  return options;
}

function printUsage() {
  process.stdout.write(
    [
      'Usage: node scripts/hygiene-check.mjs [mode] [options]',
      '',
      'Modes:',
      '  --worktree   tracked files plus untracked non-ignored files (default)',
      '  --staged     files staged for the next commit',
      '  --tracked    tracked files only',
      '  --history    audit every path that ever existed in reachable history',
      '  --all        tracked tree plus reachable history in one run',
      '',
      'Options:',
      '  --strict         treat warnings as errors',
      '  --soft-history   report history findings as warnings',
      '  --json           print a machine-readable summary',
      '  --report <file>  write a masked Markdown report',
      '  --quiet          print only the final summary line(s)',
      '',
    ].join('\n'),
  );
}

/* -------------------------------------------------------------------------- */
/* collection                                                                 */
/* -------------------------------------------------------------------------- */

function resolveRepositoryRoot() {
  const root = tryGit(['rev-parse', '--show-toplevel'], process.cwd());
  if (!root) return null;
  return root.trim();
}

function collectFilePaths(root, mode) {
  if (mode === 'staged') {
    const out = runGit(['diff', '--cached', '--name-only', '--diff-filter=d', '-z'], root);
    return { paths: out.split('\0').filter(Boolean), source: 'index' };
  }
  if (mode === 'tracked') {
    const out = runGit(['ls-files', '-z'], root);
    return { paths: out.split('\0').filter(Boolean), source: 'worktree' };
  }
  const tracked = runGit(['ls-files', '-z'], root).split('\0').filter(Boolean);
  const untracked = runGit(['ls-files', '--others', '--exclude-standard', '-z'], root).split('\0').filter(Boolean);
  return { paths: [...new Set([...tracked, ...untracked])].sort(), source: 'worktree' };
}

function readFileContent(root, relativePath, source) {
  if (source === 'index') {
    const out = tryGit(['show', `:${relativePath}`], root);
    return out === null ? null : Buffer.from(out, 'utf8');
  }
  const absolute = path.join(root, relativePath);
  try {
    const stat = fs.statSync(absolute);
    if (!stat.isFile()) return null;
    return fs.readFileSync(absolute);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* scanning                                                                   */
/* -------------------------------------------------------------------------- */

function scanPath(relativePath, severityOverride) {
  const findings = [];
  for (const rule of PATH_RULES) {
    if (rule.allow && matchesAny(relativePath, rule.allow)) continue;
    if (!matchesAny(relativePath, rule.globs)) continue;
    const severity = severityOverride ?? rule.severity;
    findings.push({ rule: rule.id, severity, path: relativePath, evidence: '', message: rule.message });
  }
  return findings;
}

function scanContent(relativePath, buffer) {
  const findings = [];
  if (SELF_IGNORE.has(relativePath)) return findings;
  const extension = path.extname(relativePath).toLowerCase();
  const isMarkdown = /\.mdx?$/i.test(relativePath);
  const isCode = CODE_EXTENSIONS.has(extension);
  const isSource = SOURCE_EXTENSIONS.has(extension);
  const lines = buffer.toString('utf8').split(/\r?\n/);
  for (const rule of CONTENT_RULES) {
    if (rule.scope === 'code' && (!isCode || isMarkdown)) continue;
    let ruleFindings = 0;
    for (let index = 0; index < lines.length; index += 1) {
      if (ruleFindings >= 5) break;
      const line = lines[index];
      if (line.includes('hygiene-allow')) continue;
      const match = rule.re.exec(line);
      if (!match) continue;
      const raw = rule.valueGroup ? match[rule.valueGroup] : match[0];
      if (rule.valueGroup && isPlaceholder(raw)) continue;
      let severity = rule.severity;
      if (isMarkdown && rule.docsSeverity) severity = rule.docsSeverity;
      if (isSource && rule.sourceFileSeverity) severity = rule.sourceFileSeverity;
      findings.push({
        rule: rule.id,
        severity,
        path: relativePath,
        line: index + 1,
        evidence: mask(raw),
        message: rule.message,
      });
      ruleFindings += 1;
    }
  }
  return findings;
}

function scanFile(root, relativePath, source) {
  const findings = scanPath(relativePath);
  const buffer = readFileContent(root, relativePath, source);
  if (!buffer) return findings;

  if (buffer.length > LARGE_FILE_ERROR_BYTES) {
    findings.push({
      rule: 'large-file',
      severity: 'error',
      path: relativePath,
      evidence: `${(buffer.length / 1024 / 1024).toFixed(1)} MiB`,
      message: 'File is too large for source control. Use external storage.',
    });
  } else if (buffer.length > LARGE_FILE_WARN_BYTES) {
    findings.push({
      rule: 'large-file',
      severity: 'warn',
      path: relativePath,
      evidence: `${(buffer.length / 1024 / 1024).toFixed(1)} MiB`,
      message: 'Large file. Confirm it belongs in the repository.',
    });
  }

  if (buffer.length <= MAX_CONTENT_SCAN_BYTES && !looksBinary(buffer)) {
    findings.push(...scanContent(relativePath, buffer));
  }
  return findings;
}

function scanHistory(root, options) {
  const output = tryGit(['rev-list', '--objects', '--all'], root);
  if (output === null) return { findings: [], pathsScanned: 0 };
  const seen = new Set();
  const findings = [];
  let truncated = false;
  for (const line of output.split('\n')) {
    const separator = line.indexOf(' ');
    if (separator === -1) continue;
    const relativePath = line.slice(separator + 1).trim();
    if (!relativePath || seen.has(relativePath)) continue;
    seen.add(relativePath);
    if (findings.length >= MAX_HISTORY_FINDINGS) {
      truncated = true;
      continue;
    }
    const pathFindings = scanPath(relativePath, options.softHistory ? 'warn' : undefined);
    for (const finding of pathFindings) {
      findings.push({
        ...finding,
        message: options.softHistory
          ? `${finding.message} (present in reachable history; discarded by a clean-history reset)`
          : `${finding.message} (present in reachable history)`,
      });
    }
  }
  if (truncated) {
    findings.push({
      rule: 'history-scan-truncated',
      severity: 'warn',
      path: '(history)',
      evidence: `> ${MAX_HISTORY_FINDINGS}`,
      message: 'History audit stopped at the finding limit. Narrow the scope or inspect older refs manually.',
    });
  }
  return { findings, pathsScanned: seen.size };
}

function addPhase(findings, phase) {
  return findings.map((finding) => ({ ...finding, phase }));
}

/* -------------------------------------------------------------------------- */
/* reporting                                                                  */
/* -------------------------------------------------------------------------- */

function severityRank(severity) {
  return severity === 'error' ? 0 : 1;
}

function sortFindings(findings) {
  return [...findings].sort(
    (a, b) =>
      severityRank(a.severity) - severityRank(b.severity) ||
      String(a.path).localeCompare(String(b.path)) ||
      String(a.rule).localeCompare(String(b.rule)),
  );
}

function printFindings(findings, quiet) {
  if (quiet) return;
  for (const finding of sortFindings(findings)) {
    const tag = finding.severity === 'error' ? `${COLORS.red}[ERROR]${COLORS.reset}` : `${COLORS.yellow}[WARN ]${COLORS.reset}`;
    const location = finding.line ? `${finding.path}:${finding.line}` : finding.path;
    const evidence = finding.evidence ? ` ${COLORS.dim}${finding.evidence}${COLORS.reset}` : '';
    process.stdout.write(`${tag} ${location}${evidence}\n        ${finding.rule}: ${finding.message}\n`);
  }
}

function buildReport({ root, options, findings, counts }) {
  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warn');
  const head = tryGit(['rev-parse', 'HEAD'], root);
  const remote = tryGit(['remote', '-v'], root);
  const nextAction =
    errors.length === 0
      ? 'No action required; there are no blocking hygiene errors.'
      : counts.treeErrors === 0 && counts.historyErrors > 0
        ? 'The tree is clean, but reachable history still has findings. Perform the clean-history procedure in [docs/CLEAN_HISTORY_PUSH_RUNBOOK.md](docs/CLEAN_HISTORY_PUSH_RUNBOOK.md).'
        : 'Runtime or build data is still tracked. Run `node scripts/untrack-runtime-data.mjs --write` first, then review history.';
  const lines = [
    '# Repository hygiene report',
    '',
    `- Generated: ${new Date().toISOString()}`,
    `- Repository: ${root}`,
    `- Mode: \`${options.mode}\``,
    `- HEAD: ${head ? head.trim() : 'no commits'}`,
    `- Remotes: ${remote && remote.trim() ? remote.trim().split('\n')[0] : 'none'}`,
    `- Files checked: ${counts.filesChecked}`,
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    `- Tree errors: ${counts.treeErrors}`,
    `- History errors: ${counts.historyErrors}`,
    '',
    '## Next action',
    '',
    nextAction,
    '',
    '> Suspected values are masked. Do not paste raw secrets into issues, chat, or pull requests.',
    '',
  ];
  if (findings.length === 0) {
    lines.push('No findings. The tree and reachable history match the repository hygiene policy.', '');
    return `${lines.join('\n')}\n`;
  }
  lines.push('| Phase | Severity | Rule | Path | Evidence | Message |', '| --- | --- | --- | --- | --- | --- |');
  for (const finding of sortFindings(findings)) {
    const location = finding.line ? `${finding.path}:${finding.line}` : finding.path;
    lines.push(
      `| ${finding.phase} | ${finding.severity} | \`${finding.rule}\` | \`${location}\` | ${finding.evidence || ''} | ${finding.message.replace(/\|/g, '\\|')} |`,
    );
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/* -------------------------------------------------------------------------- */
/* main                                                                       */
/* -------------------------------------------------------------------------- */

function scanTree(root, mode) {
  const { paths, source } = collectFilePaths(root, mode);
  const findings = [];
  for (const relativePath of paths) {
    findings.push(...scanFile(root, toPosix(relativePath), source));
  }
  return { findings: addPhase(findings, 'tree'), pathsScanned: paths.length };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const root = resolveRepositoryRoot();
  if (!root) fail('not inside a Git working tree. Run this from the repository root.', 2);

  let findings = [];
  let treeFiles = 0;
  let historyFiles = 0;

  if (options.mode === 'history') {
    const historyResult = scanHistory(root, options);
    findings = addPhase(historyResult.findings, 'history');
    historyFiles = historyResult.pathsScanned;
  } else if (options.mode === 'tree+history') {
    const treeResult = scanTree(root, 'tracked');
    const historyResult = scanHistory(root, options);
    findings = [...treeResult.findings, ...addPhase(historyResult.findings, 'history')];
    treeFiles = treeResult.pathsScanned;
    historyFiles = historyResult.pathsScanned;
  } else {
    const treeResult = scanTree(root, options.mode);
    findings = treeResult.findings;
    treeFiles = treeResult.pathsScanned;
  }

  if (options.strict) {
    findings = findings.map((finding) => (finding.severity === 'warn' ? { ...finding, severity: 'error' } : finding));
  }

  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warn');
  const treeErrors = errors.filter((finding) => finding.phase === 'tree').length;
  const historyErrors = errors.filter((finding) => finding.phase === 'history').length;
  const filesChecked = treeFiles + historyFiles;
  const counts = { filesChecked, treeFiles, historyFiles, treeErrors, historyErrors };

  if (!options.json) {
    printFindings(findings, options.quiet);
    if (options.report) {
      fs.mkdirSync(path.dirname(path.resolve(root, options.report)), { recursive: true });
      fs.writeFileSync(path.resolve(root, options.report), buildReport({ root, options, findings, counts }), 'utf8');
      if (!options.quiet) process.stdout.write(`${COLORS.dim}Report written: ${options.report}${COLORS.reset}\n`);
    }
    const verdict = errors.length === 0 ? `${COLORS.green}PASS${COLORS.reset}` : `${COLORS.red}FAIL${COLORS.reset}`;
    process.stdout.write(
      `hygiene-check [${options.mode}] ${verdict} — files: ${filesChecked}, errors: ${errors.length}, warnings: ${warnings.length}\n`,
    );
    if (options.mode === 'tree+history') {
      process.stdout.write(`tree: ${treeErrors} error(s) · history: ${historyErrors} error(s)\n`);
    }
  } else {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: options.mode,
          repository: root,
          filesChecked,
          treeFiles,
          historyFiles,
          errors: errors.length,
          warnings: warnings.length,
          treeErrors,
          historyErrors,
          findings,
        },
        null,
        2,
      )}\n`,
    );
  }

  process.exit(errors.length === 0 ? 0 : 1);
}

main();
