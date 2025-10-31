#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const disallowedPattern = /study_with_feruzbek_tracker/;
const ignoredExtensions = new Set([
  '.md',
  '.mdx',
  '.markdown',
  '.MD',
  '.MDX',
  '.MARKDOWN'
]);
const ignoredPrefixes = ['docs/'];

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => {
    if (ignoredPrefixes.some((prefix) => file.startsWith(prefix))) {
      return false;
    }
    const extension = extname(file);
    if (ignoredExtensions.has(extension)) {
      return false;
    }
    const upperExt = extension.toUpperCase();
    if (ignoredExtensions.has(upperExt)) {
      return false;
    }
    return true;
  });

const violations = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (!disallowedPattern.test(content)) {
    continue;
  }
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (disallowedPattern.test(line)) {
      violations.push(`${file}:${index + 1}`);
    }
  });
}

if (violations.length > 0) {
  console.error('Found forbidden references to "study_with_feruzbek_tracker":');
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  process.exit(1);
}

console.log('No coupling to tracker repo detected.');
