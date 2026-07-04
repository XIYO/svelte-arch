import { readdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

export const summary = '접미사 표준화 — `.live.svelte`→`.container.svelte` 파일 rename + 소스·문서 내 문자열 치환 + config.mjs 키 rename (기계적 코드모드, 승인 불요)';

/**
 * v4(smart 접미사 `.live.svelte`) → v5(`.container.svelte`)는 파일명 rename과
 * 문자열 치환뿐인 기계적 변경이라(3계층 분류처럼 사람 판단이 필요 없다) — v3→v4와 달리
 * 이 마이그레이션은 실제로 코드를 고친다. 멱등: 이미 `.container.svelte`인 프로젝트는
 * 두 번째 실행에서 대상 0건으로 조용히 끝난다.
 */

const EXCLUDED_DIRS = new Set(['node_modules', '.svelte-kit', '.git', 'build', 'dist', 'coverage', 'test-results', 'playwright-report', 'storybook-static']);

async function* walk(dir) {
	let entries;
	try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
	for (const e of entries) {
		const p = join(dir, e.name);
		if (e.isDirectory()) { if (!EXCLUDED_DIRS.has(e.name)) yield* walk(p); }
		else if (e.isFile()) yield p;
	}
}

let git = null;
async function gitMv(ROOT, from, to) {
	if (git === null) {
		try {
			const { execSync } = await import('node:child_process');
			execSync('git rev-parse --is-inside-work-tree', { cwd: ROOT, stdio: 'ignore' });
			git = true;
			// execSync 재사용을 위해 모듈 참조를 클로저에 남긴다
			gitMv._execSync = execSync;
		} catch { git = false; }
	}
	if (git) {
		// stdio 'pipe' — git mv 실패 시 stderr가 그대로 터미널에 새지 않게 잡아서 버린다(폴백은 조용해야 한다)
		try { gitMv._execSync(`git mv "${from}" "${to}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); return; } catch { /* 언트랙 파일 등 — fs rename으로 폴백 */ }
	}
	await rename(join(ROOT, from), join(ROOT, to));
}

export default async function migrate({ ROOT, log }) {
	// ① src/**/*.live.svelte → *.container.svelte (git mv 우선, 실패 시 fs rename)
	const renamed = [];
	for await (const abs of walk(join(ROOT, 'src'))) {
		if (!abs.endsWith('.live.svelte')) continue;
		const from = relative(ROOT, abs).replaceAll('\\', '/');
		const to = from.replace(/\.live\.svelte$/, '.container.svelte');
		if (existsSync(join(ROOT, to))) { log(`  ⚠ 건너뜀(대상 존재): ${from} ↛ ${to}`); continue; }
		await gitMv(ROOT, from, to);
		renamed.push({ from, to });
	}
	if (renamed.length) log(`  파일 rename ${renamed.length}건: *.live.svelte → *.container.svelte`);

	// ② src/**/*.{ts,svelte}·**/CLAUDE.md 안의 문자열 치환 — import 경로는 항상 확장자가 붙으므로 안전
	const REPLACERS = [
		[/\.live\.svelte/g, '.container.svelte'],
		// index.ts 재수출 별칭만 표적 — kit이 생성하는 `export { default as XxxLive } from …` 패턴 한정.
		// `\bas\s+` 앞맥락으로 좁혀 무관 식별자(예: isLive)의 오치환을 막는다(안전한 임포트/재수출 문맥만 매칭).
		[/\bas\s+(\w+)Live\b/g, 'as $1Container']
	];
	let rewritten = 0;
	const CANDIDATE_ROOTS = ['src', 'tests', 'e2e'];
	for (const root of CANDIDATE_ROOTS) {
		const dir = join(ROOT, root);
		if (!existsSync(dir)) continue;
		for await (const abs of walk(dir)) {
			if (!/\.(ts|js|svelte|tsx)$/.test(abs)) continue;
			const content = await readFile(abs, 'utf-8');
			let next = content;
			for (const [re, sub] of REPLACERS) next = next.replace(re, sub);
			if (next !== content) { await writeFile(abs, next, 'utf-8'); rewritten++; }
		}
	}
	// CLAUDE.md (계층·slice 루트 자기서술 — .live 언급 가능성)
	for await (const abs of walk(ROOT)) {
		if (dirname(abs).includes('node_modules') || dirname(abs).includes('.git')) continue;
		if (!abs.endsWith('CLAUDE.md')) continue;
		const content = await readFile(abs, 'utf-8');
		const next = content.replace(/\.live\.svelte/g, '.container.svelte').replace(/`\.live`/g, '`.container`');
		if (next !== content) { await writeFile(abs, next, 'utf-8'); rewritten++; }
	}
	if (rewritten) log(`  문자열 치환 ${rewritten}파일: .live.svelte → .container.svelte (+ XxxLive → XxxContainer 재수출 별칭)`);

	// ③ .svelte-arch/config.mjs의 allow.liveOutsideGlue 키 rename (project-owned — 존재할 때만, 값 보존)
	const cfgPath = join(ROOT, '.svelte-arch/config.mjs');
	if (existsSync(cfgPath)) {
		const content = await readFile(cfgPath, 'utf-8');
		if (content.includes('liveOutsideGlue')) {
			const next = content.replace(/\bliveOutsideGlue\b/g, 'containerOutsideGlue');
			await writeFile(cfgPath, next, 'utf-8');
			log('  .svelte-arch/config.mjs: allow.liveOutsideGlue → allow.containerOutsideGlue (값 보존)');
		}
	}

	if (!renamed.length && !rewritten) log('  대상 0건 — 이미 v5 표기(.container.svelte)로 수렴된 프로젝트 (멱등 확인)');
}
