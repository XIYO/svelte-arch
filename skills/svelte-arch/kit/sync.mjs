#!/usr/bin/env bun
/**
 * sync.mjs — 이 프로젝트를 arch kit 현재 버전 상태로 수렴 (선언적·멱등)
 *
 * 실행: 프로젝트 루트에서  bun <스킬경로>/kit/sync.mjs  [--force]
 * - 최초 실행 = 스캐폴드 / 재실행 = kit-owned 동기화 + 대기 마이그레이션 자동 적용
 * - 설치물 = .svelte-arch/ + package.json arch:* 5줄 + CLAUDE.md 마커 블록 + 훅 파일 안 마커 블록
 *   + 계층·slice CLAUDE.md 씨앗(없는 곳만) + core.hooksPath 미설정 시 .githooks 지정
 * - kit 은 core.hooksPath 를 소유하지 않는다: 기존 hooksPath(없으면 .githooks 생성)를 존중하고
 *   그 pre-commit 안의 마커 구간만 관리한다 — 블록 밖·다른 훅은 불가침.
 * - project-owned(config.mjs·plan-overrides·기존 CLAUDE.md·마커 밖)는 불가침. 롤백 = git.
 */

import { readdir, readFile, writeFile, mkdir, copyFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const KIT = dirname(fileURLToPath(import.meta.url));
const KIT_VERSION = (await readFile(join(KIT, 'VERSION'), 'utf-8')).trim();
const ROOT = process.cwd();
const FORCE = process.argv.includes('--force');
const norm = (p) => p.replaceAll('\\', '/');
const log = (s) => console.log(s);
const done = [];

// ── 0. 가드 ──────────────────────────────────────────────────────────────
if (!existsSync(join(ROOT, 'package.json')) || !existsSync(join(ROOT, 'src'))) {
	console.error('✗ 프로젝트 루트(package.json + src/)에서 실행하세요 — cwd:', ROOT);
	process.exit(2);
}
let isGit = true;
let dirty = false;
try {
	dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0;
	if (dirty) log('⚠ 작업트리가 깨끗하지 않음 — init diff 가 기존 변경과 섞입니다 (리뷰 시 유의)');
} catch {
	isGit = false;
	log('⚠ git 저장소가 아님 — 훅 배선을 건너뜁니다');
}

// ── 0.5 버전 감지 + 마이그레이션 ─────────────────────────────────────────
const cmp = (a, b) => {
	const A = a.split('.').map(Number), B = b.split('.').map(Number);
	for (let i = 0; i < 3; i++) if ((A[i] ?? 0) !== (B[i] ?? 0)) return (A[i] ?? 0) - (B[i] ?? 0);
	return 0;
};
const installed = existsSync(join(ROOT, '.svelte-arch/arch.mjs'))
	? ((await readFile(join(ROOT, '.svelte-arch/arch.mjs'), 'utf-8')).match(/KIT_VERSION\s*=\s*'([^']+)'/)?.[1] ?? null)
	: null;
if (installed && cmp(installed, KIT_VERSION) > 0) {
	console.error(`✗ 프로젝트(v${installed})가 스킬 kit(v${KIT_VERSION})보다 최신 — 스킬부터 업데이트하세요`);
	process.exit(2);
}
if (installed && cmp(installed, KIT_VERSION) < 0) {
	const migDir = join(KIT, 'migrations');
	const pending = (existsSync(migDir) ? await readdir(migDir) : [])
		.filter((f) => /^\d+\.\d+\.\d+\.mjs$/.test(f)).map((f) => f.replace(/\.mjs$/, ''))
		.filter((ver) => cmp(ver, installed) > 0 && cmp(ver, KIT_VERSION) <= 0).sort(cmp);
	if (pending.length) {
		if (dirty && !FORCE) {
			console.error(`✗ v${installed}→v${KIT_VERSION} 마이그레이션 ${pending.length}건 대기 — 깨끗한 작업트리에서 실행 (--force 강행 가능)`);
			process.exit(2);
		}
		for (const ver of pending) {
			const mod = await import(pathToFileURL(join(migDir, `${ver}.mjs`)).href);
			log(`⤴ 마이그레이션 v${ver} — ${mod.summary ?? ''}`);
			await mod.default({ ROOT, log });
			done.push(`마이그레이션 v${ver} 적용${mod.summary ? ` (${mod.summary})` : ''}`);
		}
	}
	log(`↑ kit v${installed} → v${KIT_VERSION}`);
}

// ── 1. kit-owned 복사 (항상 덮어씀) ─────────────────────────────────────
await mkdir(join(ROOT, '.svelte-arch'), { recursive: true });
await copyFile(join(KIT, 'scripts/arch.mjs'), join(ROOT, '.svelte-arch/arch.mjs'));
done.push(`.svelte-arch/arch.mjs (kit v${KIT_VERSION})`);
await mkdir(join(ROOT, '.svelte-arch/templates'), { recursive: true });
for (const e of await readdir(join(KIT, 'templates'))) await copyFile(join(KIT, 'templates', e), join(ROOT, '.svelte-arch/templates', e));
done.push('.svelte-arch/templates (arch:new 생성기용)');

// ── 1.5 훅 — hooksPath 를 소유하지 않고 마커 블록만 주입 ─────────────────
if (isGit) {
	let hooksPath = '';
	try { hooksPath = execSync('git config core.hooksPath', { cwd: ROOT }).toString().trim(); } catch { /* 미설정 */ }
	if (!hooksPath) {
		hooksPath = '.githooks';
		execSync('git config core.hooksPath .githooks', { cwd: ROOT });
		done.push('core.hooksPath = .githooks (미설정이어서 생성)');
	}
	const hookDir = join(ROOT, hooksPath);
	await mkdir(hookDir, { recursive: true });
	const hookFile = join(hookDir, 'pre-commit');
	const BEGIN = '# >>> svelte-arch:begin';
	const END = '# <<< svelte-arch:end';
	const block = [
		`${BEGIN} (kit v${KIT_VERSION} — 이 블록만 kit 이 갱신, 블록 밖은 프로젝트 소유)`,
		'STAGED_ARCH=$(git diff --cached --name-only --diff-filter=ACMR | grep -E \'\\.(svelte|ts|tsx)$\' || true)',
		'if [ -n "$STAGED_ARCH" ]; then',
		'\techo "→ arch:audit (staged $(echo "$STAGED_ARCH" | wc -l | tr -d \' \')개)"',
		'\techo "$STAGED_ARCH" | xargs bun .svelte-arch/arch.mjs audit --files || exit 1',
		'fi',
		END
	].join('\n');
	let hook = existsSync(hookFile) ? await readFile(hookFile, 'utf-8') : '#!/usr/bin/env bash\n# pre-commit — 프로젝트 소유 (svelte-arch 는 아래 마커 블록만 관리)\n';
	if (hook.includes(BEGIN) && hook.includes(END)) {
		hook = hook.slice(0, hook.indexOf(BEGIN)) + block + hook.slice(hook.indexOf(END) + END.length);
	} else {
		hook = hook.trimEnd() + '\n\n' + block + '\n';
	}
	await writeFile(hookFile, hook, 'utf-8');
	try { await chmod(hookFile, 0o755); } catch { /* Windows 무시 */ }
	done.push(`${hooksPath}/pre-commit 마커 블록 (hooksPath 불가침)`);
}

// ── 2. project-owned 씨앗 (없을 때만) ────────────────────────────────────
if (!existsSync(join(ROOT, '.svelte-arch/config.mjs'))) {
	await copyFile(join(KIT, 'scripts/config.mjs'), join(ROOT, '.svelte-arch/config.mjs'));
	done.push('.svelte-arch/config.mjs (씨앗 — project-owned)');
}

// ── 3. package.json 스크립트 ─────────────────────────────────────────────
{
	const p = join(ROOT, 'package.json');
	const raw = await readFile(p, 'utf-8');
	const indent = raw.match(/\n([ \t]+)"/)?.[1] ?? '\t';
	const pkg = JSON.parse(raw);
	pkg.scripts ??= {};
	const want = {
		'arch:manifest': 'bun .svelte-arch/arch.mjs manifest',
		'arch:audit': 'bun .svelte-arch/arch.mjs audit',
		'arch:analyze': 'bun .svelte-arch/arch.mjs analyze',
		'arch:new': 'bun .svelte-arch/arch.mjs new',
		'arch:plan': 'bun .svelte-arch/arch.mjs plan'
	};
	let changed = false;
	for (const [k, v] of Object.entries(want)) if (pkg.scripts[k] !== v) { pkg.scripts[k] = v; changed = true; }
	if (changed) {
		await writeFile(p, JSON.stringify(pkg, null, indent) + '\n', 'utf-8');
		done.push('package.json scripts (arch:manifest·audit·analyze·new·plan)');
	}
}

// ── 4. CLAUDE.md 씨앗 — 계층·slice 루트 (없을 때만, FSD 트리에서만) ──────
const LAYER_ROLES = {
	'src/app': '초기화 계층 — index.html·hooks·app.css·routes(글루 + pages first 콜로케이션)',
	'src/widgets': '자립 대형 블록 slice들 (view/container 페어 = 독립 데이터 섬)',
	'src/features': '사용자 상호작용(동사) slice들 — 폼·다이얼로그·액션',
	'src/entities': '업무 개체(명사) slice들 — 표시 view·wire 타입(model)·remote(api). ui는 view 전용',
	'src/shared': '업무 무관 — ui(디자인 시스템, 딥 임포트)·vendor(shadcn 원본 보존)·lib·model·config',
	'src/server': '서버 스택($lib/server 보호) — slice별 service·repository·adapter, 이름은 클라 slice와 1:1',
	'src/shared/ui': '디자인 시스템 선반 — 승격 4테스트 통과분만, flat + icons/ + 세트 폴더',
	'src/shared/vendor': 'shadcn-svelte 산출물 원본 보존(불가침) — shared/ui 만 래핑 소비'
};
{
	const template = await readFile(join(KIT, 'templates/CLAUDE.template.md'), 'utf-8');
	let seeded = 0;
	const seedIfDir = async (rel, role) => {
		const abs = join(ROOT, rel);
		if (!existsSync(abs) || existsSync(join(abs, 'CLAUDE.md'))) return;
		await writeFile(join(abs, 'CLAUDE.md'), template.replaceAll('{DIR}', rel).replaceAll('{역할 한 줄}', role), 'utf-8');
		seeded++;
	};
	for (const [rel, role] of Object.entries(LAYER_ROLES)) await seedIfDir(rel, role);
	for (const layer of ['widgets', 'features', 'entities', 'server']) {
		const dir = join(ROOT, 'src', layer);
		if (!existsSync(dir)) continue;
		for (const e of await readdir(dir, { withFileTypes: true })) {
			if (!e.isDirectory() || e.name === 'vendor') continue;
			await seedIfDir(norm(join('src', layer, e.name)), `${e.name} ${layer} slice — {역할 한 줄 다듬기}`);
		}
	}
	if (seeded) done.push(`CLAUDE.md 씨앗 ${seeded}개 (기존 불가침)`);
}

// ── 5. 루트 CLAUDE.md 마커 블록 ──────────────────────────────────────────
{
	const block = (await readFile(join(KIT, 'templates/claude-block.md'), 'utf-8')).replaceAll('{VERSION}', KIT_VERSION).trim();
	const p = join(ROOT, 'CLAUDE.md');
	const BEGIN = '<!-- svelte-arch:begin';
	const END = '<!-- svelte-arch:end -->';
	let content = existsSync(p) ? await readFile(p, 'utf-8') : '# CLAUDE.md\n';
	if (content.includes(BEGIN) && content.includes(END)) {
		content = content.slice(0, content.indexOf(BEGIN)) + block + content.slice(content.indexOf(END) + END.length);
	} else {
		content = content.trimEnd() + '\n\n' + block + '\n';
	}
	await writeFile(p, content, 'utf-8');
	done.push('CLAUDE.md 마커 블록 (블록 구간만 kit 관리)');
}

// ── 구 구조 감지 ─────────────────────────────────────────────────────────
const legacy = existsSync(join(ROOT, 'src/lib/components')) || existsSync(join(ROOT, 'src/lib/server')) ||
	(existsSync(join(ROOT, 'src/routes')) && !existsSync(join(ROOT, 'src/app/routes')));

// ── 요약 ─────────────────────────────────────────────────────────────────
log(`\n✓ arch kit v${KIT_VERSION} 설치/업데이트 완료 → ${norm(ROOT)}`);
for (const d of done) log(`  · ${d}`);
if (legacy) {
	log(`\n⚠ 구(비-FSD) 구조 감지 — FSD 좌표계 이행이 필요합니다.`);
	log(`  ① svelte.config 수술 (스킬 references/fsd-guide.md 스니펫 — 수동 1분)`);
	log(`  ② bun run arch:plan          # 이동·리네임·3계층 분류 제안표`);
	log(`  ③ 제안표 검토·승인 + .svelte-arch/plan-overrides.json 조정 후에만: bun run arch:plan -- --apply`);
	log(`  (에이전트 규범: "FSD 표준대로 이렇게 옮기겠습니다. 진행할까요?" 승인 필수)`);
}
log(`\n다음 단계:`);
log(`  1. bun run arch:audit        # ${legacy ? '(이행 전엔 plan 안내만 출력)' : 'baseline 위반 확인'}`);
log(`  2. git diff 리뷰 → 커밋: chore(arch): kit v${KIT_VERSION} 설치`);
log(`  3. 작업 전 상시: bun run arch:manifest [-- --slice <이름>]`);
