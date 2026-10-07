'use strict';

// Focused replacement for Expo's four resolve-workspace-root APIs. Keeping the
// parsers external avoids its published bundle's hidden historical braces/YAML.
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const micromatch = require('micromatch');
const { braces } = require('./index.cjs');

function checkedGlobs(value) {
  if (!Array.isArray(value)) return null;
  if (value.length > 1_000) throw new RangeError('Workspace glob count exceeds security limit');
  for (const pattern of value) braces(pattern, { expand: true, keepEscaping: true });
  return value;
}

function read(filename) {
  try { return fs.readFileSync(filename, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return null;
    throw error;
  }
}

async function readAsync(filename) {
  try { return await fs.promises.readFile(filename, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') return null;
    throw error;
  }
}

function parsePackage(text) {
  if (!text) return null;
  let manifest;
  try { manifest = JSON.parse(text); }
  catch (error) { if (error instanceof SyntaxError) return null; throw error; }
  return checkedGlobs(Array.isArray(manifest?.workspaces) ? manifest.workspaces : manifest?.workspaces?.packages);
}

function parsePnpm(text) {
  if (!text) return null;
  let manifest;
  try { manifest = yaml.load(text); }
  catch (error) { if (error instanceof yaml.YAMLException) return null; throw error; }
  return checkedGlobs(manifest?.packages);
}

function workspaceFiles(directory, options) {
  const files = [];
  if (options.pnpmWorkspaces !== false) files.push([path.join(directory, 'pnpm-workspace.yaml'), parsePnpm]);
  if (options.packageWorkspaces !== false) files.push([path.join(directory, 'package.json'), parsePackage]);
  return files;
}

function getWorkspaceGlobs(rootDir = process.cwd(), options = {}) {
  for (const [filename, parse] of workspaceFiles(rootDir, options)) {
    const globs = parse(read(filename));
    if (globs !== null) return globs;
  }
  return null;
}

async function getWorkspaceGlobsAsync(rootDir = process.cwd(), options = {}) {
  for (const [filename, parse] of workspaceFiles(rootDir, options)) {
    const globs = parse(await readAsync(filename));
    if (globs !== null) return globs;
  }
  return null;
}

function matches(directory, startingDir, globs) {
  const relative = path.relative(directory, startingDir);
  // Validation already ran, including root calls that need no matching.
  return relative === '' || micromatch([relative.replaceAll(path.sep, '/')], globs).length > 0;
}

function resolveWorkspaceRoot(startingDir = process.cwd(), options = {}) {
  let directory = path.normalize(startingDir);
  for (;;) {
    // A nonmatching pnpm declaration must still allow the package declaration.
    for (const [filename, parse] of workspaceFiles(directory, options)) {
      const globs = parse(read(filename));
      if (globs !== null && matches(directory, startingDir, globs)) return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

async function resolveWorkspaceRootAsync(startingDir = process.cwd(), options = {}) {
  let directory = path.normalize(startingDir);
  for (;;) {
    for (const [filename, parse] of workspaceFiles(directory, options)) {
      const globs = parse(await readAsync(filename));
      if (globs !== null && matches(directory, startingDir, globs)) return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

module.exports = { resolveWorkspaceRoot, resolveWorkspaceRootAsync, getWorkspaceGlobs, getWorkspaceGlobsAsync };
