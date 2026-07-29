#!/usr/bin/env bun

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = resolve(import.meta.dirname, '..');
const arch = join(repoRoot, 'skills/svelte-arch/kit/scripts/arch.mjs');
const fixture = await mkdtemp(join(tmpdir(), 'svelte-arch-svelte5-'));
const bun = Bun.which('bun');

if (!bun) throw new Error('Bun runtime을 찾지 못했습니다.');

async function write(relativePath, content) {
	const path = join(fixture, relativePath);
	await mkdir(resolve(path, '..'), { recursive: true });
	await writeFile(path, content, 'utf-8');
}

try {
	await write('package.json', '{"name":"svelte5-grammar-fixture"}\n');
	await write('src/AGENTS.md', '# fixture\n');
	await write('src/routes/Legacy.view.svelte', `<script lang="ts">
	import { createEventDispatcher, afterUpdate } from 'svelte';
	import { page } from '$app/stores';
	export let name: string;
	$: greeting = name;
	const dispatch = createEventDispatcher();
	afterUpdate(() => {});
</script>
<button on:click={() => dispatch('save')}>{greeting}</button>
<div use:legacyAction></div>
<slot />
<svelte:component this={Legacy} />\n`);
	await write('src/routes/Legacy.view.svelte.spec.ts', 'export {};\n');
	await write('src/lib/shared/ui/focus.attach.ts', `import type { Attachment } from 'svelte/attachments';

export const focus: Attachment<HTMLElement> = (node) => node.focus();
`);
	await write('.svelte-arch/config.mjs', `export default {
	specRoots: { integration: 'tests', e2e: 'playwright' }
};\n`);

	const result = Bun.spawnSync({
		cmd: [bun, arch, 'audit', '--json'],
		cwd: fixture,
		stdout: 'pipe',
		stderr: 'pipe'
	});
	const output = new TextDecoder().decode(result.stdout);
	const violations = JSON.parse(output);
	const expected = [
		'LEGACY_EXPORT_LET',
		'LEGACY_REACTIVE_STATEMENT',
		'LEGACY_EVENT_DISPATCHER',
		'LEGACY_EVENT_DIRECTIVE',
		'LEGACY_ACTION_DIRECTIVE',
		'LEGACY_SLOT',
		'LEGACY_SVELTE_COMPONENT',
		'LEGACY_APP_STORES',
		'LEGACY_LIFECYCLE'
	];
	for (const code of expected) {
		if (!violations.some((item) => item.code === code)) {
			throw new Error(`${code} 위반을 찾지 못했습니다: ${output}`);
		}
	}
	const attachmentFailures = violations.filter(
		(item) =>
			item.file === 'src/lib/shared/ui/focus.attach.ts' &&
			['UNMARKED_TS', 'SEGMENT_SUFFIX_MISMATCH'].includes(item.code)
	);
	if (attachmentFailures.length) {
		throw new Error(`Svelte 5 attachment를 정식 종별로 인식하지 못했습니다: ${JSON.stringify(attachmentFailures)}`);
	}
	console.log('✓ Svelte 5 runes 문법 게이트와 specRoots 설정 테스트 통과');
} finally {
	await rm(fixture, { recursive: true, force: true });
}
