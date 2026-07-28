import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export const summary =
	'deprecated 커스텀 좌표를 SvelteKit 공식 기본 좌표로 전환하는 v6 호환성 가드 + 매뉴얼 CLAUDE.md→AGENTS.md rename';

/**
 * v6는 SvelteKit 공식 기본 좌표(src/routes·src/lib)를 정본으로 삼는다.
 *
 * v5 커스텀 좌표는 디렉터리 이동뿐 아니라 kit.files 설정·별칭·외부 도구 설정을 함께
 * 바꿔야 하므로 sync가 자동 rename하지 않는다. 자동화가 사용자 코드를 덮지 않도록
 * 구 좌표가 실제로 남은 프로젝트만 정확한 매핑과 함께 중단한다.
 *
 * 매뉴얼 네이밍(CLAUDE.md → AGENTS.md)은 좌표와 무관한 순수 rename이라 좌표 가드
 * 전에 항상 적용한다. 내용·마커 블록은 그대로 따라가고, 대상에 AGENTS.md가 이미
 * 있으면 불가침(프로젝트 소유 우선).
 */
export default async function migrate({ ROOT, log }) {
	// ── 매뉴얼 rename: **/CLAUDE.md → AGENTS.md (멱등, 충돌 시 불가침) ──
	let renamedManuals = 0;
	const renameManuals = (dir) => {
		if (!existsSync(dir)) return;
		for (const e of readdirSync(dir, { withFileTypes: true })) {
			if (e.name === 'node_modules' || e.name === '.git' || e.name === '.svelte-kit') continue;
			const p = join(dir, e.name);
			if (e.isDirectory()) renameManuals(p);
			else if (e.name === 'CLAUDE.md' && !existsSync(join(dir, 'AGENTS.md'))) {
				renameSync(p, join(dir, 'AGENTS.md'));
				renamedManuals += 1;
			}
		}
	};
	renameManuals(join(ROOT, 'src'));
	if (existsSync(join(ROOT, 'CLAUDE.md')) && !existsSync(join(ROOT, 'AGENTS.md'))) {
		renameSync(join(ROOT, 'CLAUDE.md'), join(ROOT, 'AGENTS.md'));
		renamedManuals += 1;
	}
	if (renamedManuals) log(`  매뉴얼 rename CLAUDE.md→AGENTS.md ${renamedManuals}개 (내용 불가침)`);

	const hasEntries = (path) => existsSync(join(ROOT, path)) && readdirSync(join(ROOT, path)).length > 0;
	const oldRoots = [
		'src/app/routes',
		'src/server',
		'src/shared',
		'src/entities',
		'src/features',
		'src/widgets',
		'src/pages'
	].filter(hasEntries);

	const configFiles = [
		'vite.config.ts',
		'vite.config.js',
		'vite.config.mts',
		'vite.config.mjs',
		'svelte.config.ts',
		'svelte.config.js'
	].filter((path) => existsSync(join(ROOT, path)));
	const deprecatedConfig = [];
	for (const path of configFiles) {
		const content = await readFile(join(ROOT, path), 'utf-8');
		if (/src\/app\/routes|files\s*:\s*\{[\s\S]{0,600}\b(?:lib|routes|appTemplate|hooks)\s*:/m.test(content)) {
			deprecatedConfig.push(path);
		}
	}

	if (!oldRoots.length && !deprecatedConfig.length) {
		log('  공식 기본 좌표 확인 — 이동 대상 0건 (멱등)');
		return;
	}

	const mapping = [
		'src/app/routes → src/routes',
		'src/app/index.html → src/app.html',
		'src/app/app.css → src/app.css',
		'src/app/hooks.* → src/hooks.*',
		'src/{widgets,features,entities,shared,pages,server} → src/lib/{…}',
		'@/{shared,entities,features,widgets,pages,server} → $lib/{…}'
	].join('\n  - ');
	const found = [
		oldRoots.length ? `구 디렉터리: ${oldRoots.join(', ')}` : null,
		deprecatedConfig.length ? `deprecated 설정: ${deprecatedConfig.join(', ')}` : null
	].filter(Boolean).join('\n');

	throw new Error(
		`[svelte-arch:migration:v6] 자동 이동을 중단했습니다.\n${found}\n`
		+ `충돌·도구 설정을 검토하며 다음 매핑을 한 구조 커밋으로 적용하세요:\n  - ${mapping}\n`
		+ '완료 후 sync를 다시 실행하면 v6 설치가 계속됩니다.'
	);
}
