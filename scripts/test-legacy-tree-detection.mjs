#!/usr/bin/env bun

import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = resolve(import.meta.dirname, '..');
const arch = join(repoRoot, 'skills/svelte-arch/kit/scripts/arch.mjs');
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

function run(cwd, script, ...args) {
	return Bun.spawnSync({
		cmd: [bun, script, ...args],
		cwd,
		stdout: 'pipe',
		stderr: 'pipe'
	});
}

function output(result) {
	return new TextDecoder().decode(result.stdout);
}

function errorOutput(result) {
	return new TextDecoder().decode(result.stderr);
}

try {
	const fsdWithEmptyLegacyDir = await fixture('empty-legacy-dir');
	await write(fsdWithEmptyLegacyDir, 'package.json', '{"name":"fixture"}\n');
	await write(fsdWithEmptyLegacyDir, 'src/AGENTS.md', '# src\n');
	await write(fsdWithEmptyLegacyDir, 'src/lib/entities/post/index.ts', 'export {};\n');
	await mkdir(join(fsdWithEmptyLegacyDir, 'src/features/old-slice/lib'), { recursive: true });

	const audit = run(fsdWithEmptyLegacyDir, arch, 'audit', '--json');
	let violations;
	try {
		violations = JSON.parse(output(audit));
	} catch {
		throw new Error(`빈 구 디렉터리가 audit를 차단했습니다: ${output(audit)}${errorOutput(audit)}`);
	}
	if (!Array.isArray(violations) || output(audit).includes('구(비-FSD) 구조 감지')) {
		throw new Error(`빈 구 디렉터리가 이행 대상으로 오인됐습니다: ${output(audit)}`);
	}

	const synced = run(fsdWithEmptyLegacyDir, sync, '--force');
	if (synced.exitCode !== 0 || output(synced).includes('구(비-FSD) 구조 감지')) {
		throw new Error(`sync가 빈 구 디렉터리를 이행 대상으로 오인했습니다: ${output(synced)}${errorOutput(synced)}`);
	}
	const prettierIgnore = await readFile(join(fsdWithEmptyLegacyDir, '.prettierignore'), 'utf-8');
	if (!prettierIgnore.includes('.svelte-arch/arch.mjs') || !prettierIgnore.includes('svelte-arch:begin')) {
		throw new Error(`sync가 kit CLI 포맷 경계를 만들지 않았습니다: ${prettierIgnore}`);
	}

	const actualLegacy = await fixture('actual-legacy-code');
	await write(actualLegacy, 'package.json', '{"name":"fixture"}\n');
	await write(actualLegacy, 'src/features/old-slice/Old.view.svelte', '<p>legacy</p>\n');
	const legacyAudit = run(actualLegacy, arch, 'audit', '--json');
	if (!output(legacyAudit).includes('구(비-FSD) 구조 감지')) {
		throw new Error(`실제 구 좌표 소스를 놓쳤습니다: ${output(legacyAudit)}${errorOutput(legacyAudit)}`);
	}

	const attachmentLegacy = await fixture('legacy-attachment');
	await write(attachmentLegacy, 'package.json', '{"name":"fixture"}\n');
	await write(attachmentLegacy, 'src/lib/components/primitive/Legacy.view.svelte', '<p>legacy</p>\n');
	await write(attachmentLegacy, 'src/lib/utils/focus.attach.ts', 'export {};\n');
	const attachmentPlan = run(attachmentLegacy, arch, 'plan', '--json');
	let plan;
	try {
		plan = JSON.parse(output(attachmentPlan));
	} catch {
		throw new Error(`attachment 이행 plan을 JSON으로 읽지 못했습니다: ${output(attachmentPlan)}${errorOutput(attachmentPlan)}`);
	}
	if (!plan.moves.some((move) => move.from === 'src/lib/utils/focus.attach.ts' && move.to === 'src/lib/shared/ui/focus.attach.ts')) {
		throw new Error(`attachment를 ui 종별로 보존하지 못했습니다: ${JSON.stringify(plan.moves)}`);
	}

	console.log('✓ 빈 구 디렉터리 무시·실제 구 소스 감지·attachment 이행·sync 정합 테스트 통과');
} finally {
	await Promise.all(fixtures.map((root) => rm(root, { recursive: true, force: true })));
}
