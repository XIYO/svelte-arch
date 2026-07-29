#!/usr/bin/env bun

import { existsSync } from 'node:fs';
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = resolve(import.meta.dirname, '..');
const sync = join(repoRoot, 'skills/svelte-arch/kit/sync.mjs');
const bun = Bun.which('bun');
const fixtures = [];

if (!bun) throw new Error('Bun runtime을 찾지 못했습니다.');

async function fixture(name) {
	const root = await mkdtemp(join(tmpdir(), `svelte-arch-${name}-`));
	fixtures.push(root);
	return root;
}

async function write(root, relativePath, content = '') {
	const path = join(root, relativePath);
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, content, 'utf-8');
}

async function fakeBun(root) {
	const bin = join(root, 'fake-bin');
	const command = join(bin, 'bun');
	await mkdir(bin, { recursive: true });
	await writeFile(
		command,
		'#!/bin/sh\nprintf "%s\\n" "$@" >> "$SVELTE_ARCH_BUN_ARGS"\nmkdir -p node_modules/.bin\ntouch node_modules/.bin/svelte-check\n',
		'utf-8'
	);
	await chmod(command, 0o755);
	return bin;
}

function run(root, bin, log) {
	return Bun.spawnSync({
		cmd: [bun, sync, '--force'],
		cwd: root,
		env: {
			...process.env,
			PATH: `${bin}:${process.env.PATH ?? ''}`,
			SVELTE_ARCH_BUN_ARGS: log
		},
		stdout: 'pipe',
		stderr: 'pipe'
	});
}

function failure(result) {
	return `${new TextDecoder().decode(result.stdout)}${new TextDecoder().decode(result.stderr)}`;
}

try {
	const missing = await fixture('svelte-check-missing');
	await write(missing, 'package.json', '{"name":"fixture"}\n');
	await write(missing, 'src/AGENTS.md', '# src\n');
	const missingBin = await fakeBun(missing);
	const missingLog = join(missing, 'bun.args');
	const provisioned = run(missing, missingBin, missingLog);
	if (provisioned.exitCode !== 0) {
		throw new Error(`svelte-check 자동 설치 sync가 실패했습니다: ${failure(provisioned)}`);
	}
	const added = await readFile(missingLog, 'utf-8');
	if (added !== 'add\n-d\nsvelte-check\n' || !existsSync(join(missing, 'node_modules/.bin/svelte-check'))) {
		throw new Error(`svelte-check devDependency 설치 명령 계약이 다릅니다: ${JSON.stringify(added)}`);
	}

	const installed = await fixture('svelte-check-installed');
	await write(installed, 'package.json', '{"name":"fixture","devDependencies":{"svelte-check":"1.0.0"}}\n');
	await write(installed, 'src/AGENTS.md', '# src\n');
	await write(installed, 'node_modules/.bin/svelte-check', '');
	const installedBin = await fakeBun(installed);
	const installedLog = join(installed, 'bun.args');
	const alreadyPresent = run(installed, installedBin, installedLog);
	if (alreadyPresent.exitCode !== 0) {
		throw new Error(`이미 설치된 svelte-check sync가 실패했습니다: ${failure(alreadyPresent)}`);
	}
	if (existsSync(installedLog)) {
		throw new Error(`이미 설치된 svelte-check에서 Bun 설치를 다시 실행했습니다: ${await readFile(installedLog, 'utf-8')}`);
	}

	const declaredOnly = await fixture('svelte-check-declared-only');
	await write(declaredOnly, 'package.json', '{"name":"fixture","devDependencies":{"svelte-check":"1.0.0"}}\n');
	await write(declaredOnly, 'src/AGENTS.md', '# src\n');
	const declaredOnlyBin = await fakeBun(declaredOnly);
	const declaredOnlyLog = join(declaredOnly, 'bun.args');
	const restored = run(declaredOnly, declaredOnlyBin, declaredOnlyLog);
	if (restored.exitCode !== 0) {
		throw new Error(`선언만 된 svelte-check 복구 sync가 실패했습니다: ${failure(restored)}`);
	}
	const installedArgs = await readFile(declaredOnlyLog, 'utf-8');
	if (installedArgs !== 'install\n' || !existsSync(join(declaredOnly, 'node_modules/.bin/svelte-check'))) {
		throw new Error(`선언된 svelte-check 복구 명령 계약이 다릅니다: ${JSON.stringify(installedArgs)}`);
	}

	console.log('✓ arch-sync의 svelte-check 자동 설치·중복 방지 계약 통과');
} finally {
	await Promise.all(fixtures.map((root) => rm(root, { recursive: true, force: true })));
}
