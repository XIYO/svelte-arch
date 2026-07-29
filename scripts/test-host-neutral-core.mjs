#!/usr/bin/env bun

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const core = join(repoRoot, 'skills/svelte-arch');
const hostName = /\b(?:Codex|Claude(?: Code)?)\b/g;
const violations = [];

async function visit(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) {
			await visit(path);
			continue;
		}
		if (!entry.isFile() || !/\.(?:md|mjs|ts|json)$/.test(entry.name)) continue;
		const source = await readFile(path, 'utf-8');
		for (const match of source.matchAll(hostName)) {
			const line = source.slice(0, match.index).split('\n').length;
			violations.push(`${relative(repoRoot, path)}:${line} ${match[0]}`);
		}
	}
}

await visit(core);
if (violations.length) {
	throw new Error(`호스트 이름이 공용 core에 남아 있습니다:\n${violations.join('\n')}`);
}

console.log('✓ 공용 skill·kit 코어의 호스트 중립성 계약 통과');
