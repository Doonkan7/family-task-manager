#!/usr/bin/env node
/*
  Проверка: все комментарии в изменённых файлах должны содержать русские буквы.
  Разрешается смешанный язык, но в каждом комментарии должна быть хотя бы одна кириллическая буква (А-Я, а-я, Ё, ё).
*/

const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const esprima = require('esprima');

function getStagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' });
  return out
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s && /\.(js|jsx|ts|tsx)$/i.test(s));
}

function hasCyrillic(text) {
  return /[А-Яа-яЁё]/.test(text);
}

function checkFile(file) {
  const full = resolve(process.cwd(), file);
  const src = readFileSync(full, 'utf8');
  const parsed = esprima.parseScript(src, { comment: true, tolerant: true, jsx: true, range: true });
  const violations = [];
  for (const c of parsed.comments || []) {
    const value = (c.value || '').trim();
    if (!value) continue;
    if (!hasCyrillic(value)) {
      const kind = c.type === 'Line' ? '//' : '/* */';
      const snippet = value.length > 120 ? value.slice(0, 117) + '...' : value;
      violations.push({ file, kind, snippet });
    }
  }
  return violations;
}

function main() {
  const files = getStagedFiles();
  if (files.length === 0) process.exit(0);

  let allViolations = [];
  for (const f of files) {
    try {
      const v = checkFile(f);
      allViolations = allViolations.concat(v);
    } catch (e) {
      console.warn(`Предупреждение: не удалось разобрать файл ${f}: ${e.message || e}`);
    }
  }

  if (allViolations.length > 0) {
    console.error('\nПравило проекта: комментарии должны содержать русские буквы. Исправьте комментарии ниже:\n');
    for (const v of allViolations) {
      console.error(`- ${v.file}: ${v.kind} ${v.snippet}`);
    }
    console.error('\nПодсказка: добавьте хотя бы одно русское слово в каждый комментарий.');
    process.exit(1);
  }
}

main();
