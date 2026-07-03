#!/usr/bin/env bun
/**
 * init.mjs — 이 프로젝트를 arch kit 현재 버전 상태로 수렴 (선언적·멱등)
 *
 * 실행: 프로젝트 루트에서  bun <스킬경로>/kit/init.mjs  [--force]
 * - 최초 실행 = 스캐폴드 / 재실행 = kit-owned 동기화 + 대기 마이그레이션 자동 적용
 * - 설치물은 숨김 폴더 `.svelte-arch/` 하나에 봉인 (+ package.json 2줄 + CLAUDE.md 블록)
 * - 설치 버전 기록 = .svelte-arch/arch.mjs 헤더의 KIT_VERSION (별도 상태 파일 없음 — 파일이 곧 상태)
 * - 구조 변경(MAJOR)은 kit/migrations/<ver>.mjs 코드모드가 수행 — 깨끗한 작업트리 필수
 * - project-owned(config.mjs·기존 README·CLAUDE.md 블록 밖)는 불가침. 롤백 수단 = git
 */

import { readdir, readFile, writeFile, mkdir, copyFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
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
let dirty = false;
try {
	dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim().length > 0;
	if (dirty) log('⚠ 작업트리가 깨끗하지 않음 — init diff 가 기존 변경과 섞입니다 (리뷰 시 유의)');
} catch {
	log('⚠ git 저장소가 아님 — 훅 배선을 건너뜁니다');
}

// ── 0.5 버전 감지 + 마이그레이션 (v(installed) → v(kit) 사이를 semver 순 실행) ──
const cmp = (a, b) => {
	const A = a.split('.').map(Number);
	const B = b.split('.').map(Number);
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
	const files = existsSync(join(KIT, 'migrations'))
		? (await readdir(join(KIT, 'migrations'))).filter((f) => /^\d+\.\d+\.\d+\.mjs$/.test(f))
		: [];
	const pending = files
		.map((f) => f.replace(/\.mjs$/, ''))
		.filter((ver) => cmp(ver, installed) > 0 && cmp(ver, KIT_VERSION) <= 0)
		.sort(cmp);
	if (pending.length) {
		if (dirty && !FORCE) {
			console.error(`✗ v${installed}→v${KIT_VERSION} 마이그레이션 ${pending.length}건 대기 — 깨끗한 작업트리에서 실행하세요 (--force 강행 가능)`);
			process.exit(2);
		}
		for (const ver of pending) {
			const mod = await import(pathToFileURL(join(KIT, 'migrations', `${ver}.mjs`)).href);
			log(`⤴ 마이그레이션 v${ver} — ${mod.summary ?? ''}`);
			await mod.default({ ROOT, log });
			done.push(`마이그레이션 v${ver} 적용${mod.summary ? ` (${mod.summary})` : ''}`);
		}
	}
	log(`↑ kit v${installed} → v${KIT_VERSION}`);
}

// ── 1. kit-owned 복사 (항상 덮어씀) — 전부 .svelte-arch/ 봉인 ────────────
await mkdir(join(ROOT, '.svelte-arch/hooks'), { recursive: true });
await copyFile(join(KIT, 'scripts/arch.mjs'), join(ROOT, '.svelte-arch/arch.mjs'));
done.push(`.svelte-arch/arch.mjs (kit v${KIT_VERSION})`);

// 템플릿 동봉 — arch:new 생성기가 오프라인(플러그인 부재 환경·CI)에서도 동작
await mkdir(join(ROOT, '.svelte-arch/templates'), { recursive: true });
for (const e of await readdir(join(KIT, 'templates'))) {
	await copyFile(join(KIT, 'templates', e), join(ROOT, '.svelte-arch/templates', e));
}
done.push('.svelte-arch/templates (arch:new 생성기용)');

if (existsSync(join(ROOT, '.git'))) {
	await copyFile(join(KIT, 'githooks/pre-commit'), join(ROOT, '.svelte-arch/hooks/pre-commit'));
	try {
		await chmod(join(ROOT, '.svelte-arch/hooks/pre-commit'), 0o755);
	} catch {
		/* Windows 무시 */
	}
	execSync('git config core.hooksPath .svelte-arch/hooks', { cwd: ROOT });
	done.push('.svelte-arch/hooks/pre-commit + core.hooksPath');
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
	for (const [k, v] of Object.entries(want)) {
		if (pkg.scripts[k] !== v) {
			pkg.scripts[k] = v;
			changed = true;
		}
	}
	if (!pkg.scripts.prepare) {
		pkg.scripts.prepare = 'git config core.hooksPath .svelte-arch/hooks || true';
		changed = true;
	} else if (!pkg.scripts.prepare.includes('hooksPath')) {
		log('ℹ prepare 스크립트가 이미 있음 — hooksPath 는 이번 설치에서 직접 설정됨. 새 클론 대비로 prepare 에 `git config core.hooksPath .svelte-arch/hooks` 추가 권장');
	}
	if (changed) {
		await writeFile(p, JSON.stringify(pkg, null, indent) + '\n', 'utf-8');
		done.push('package.json scripts (arch:manifest·audit·analyze·new·plan)');
	}
}

// ── 4. README 씨앗 — 관장 트리 전 디렉토리 (없을 때만) ───────────────────
const ROLE_DRAFT = [
	[/components\/ui$/, 'shadcn-svelte 구역 (vendor 보존 — 불가침, primitive만 래핑 소비)'],
	[/components\/primitive\/icons$/, '커스텀 아이콘 (아이콘 셋에 없는 것만, .primitive 마킹 동일)'],
	[/components\/primitive$/, '도메인 무지 디자인 시스템 선반 (flat — 하위폴더는 icons·세트만)'],
	[/components\/layout$/, '앱 셸 조립 (사이드바·앱바·토스트 — 도메인 폴더와 상호 참조 금지)'],
	[/components$/, '컴포넌트 계층 루트 — 종별 접미사가 역할 선언 (.primitive/.composite/.live)'],
	[/\/data$/, 'wire 경계 (*.remote.ts — 가드·검증·service 호출·전송 매핑만)'],
	[/\/state$/, '클라 전역 상태 (*.svelte.ts — live 전용 소비)'],
	[/\/server\b.*$/, '서버 로직 (*.service.ts 업무 규칙 · *.repository.ts 데이터 접근)']
];
const EXCLUDED = new Set(['node_modules', '.svelte-kit', '.git', 'build', 'dist']);
async function* dirs(d) {
	yield d;
	for (const e of await readdir(d, { withFileTypes: true })) {
		if (e.isDirectory() && !EXCLUDED.has(e.name)) yield* dirs(join(d, e.name));
	}
}
{
	const template = await readFile(join(KIT, 'templates/README.template.md'), 'utf-8');
	const govern = join(ROOT, 'src/lib');
	let seeded = 0;
	if (existsSync(govern)) {
		for await (const d of dirs(govern)) {
			const rel = norm(relative(ROOT, d));
			if (/components\/ui\/.+/.test(rel)) continue; // vendor 내부 하위폴더 예외
			if (existsSync(join(d, 'README.md'))) continue;
			const role =
				ROLE_DRAFT.find(([re]) => re.test(rel))?.[1] ??
				(rel.match(/components\/([^/]+)$/) ? `${basename(rel)} 도메인 조립 (dumb + live 페어)` : '{역할 한 줄 — 다듬어 주세요}');
			await writeFile(join(d, 'README.md'), template.replaceAll('{DIR}', rel).replaceAll('{역할 한 줄}', role), 'utf-8');
			seeded++;
		}
	}
	if (seeded) done.push(`README 씨앗 ${seeded}개 (기존 README 불가침)`);
}

// ── 5. 루트 CLAUDE.md 마커 블록 ──────────────────────────────────────────
{
	const block = (await readFile(join(KIT, 'templates/claude-block.md'), 'utf-8'))
		.replaceAll('{VERSION}', KIT_VERSION)
		.trim();
	const p = join(ROOT, 'CLAUDE.md');
	const BEGIN = '<!-- svelte-arch:begin';
	const END = '<!-- svelte-arch:end -->';
	let content = existsSync(p) ? await readFile(p, 'utf-8') : '# CLAUDE.md\n';
	if (content.includes(BEGIN) && content.includes(END)) {
		const pre = content.slice(0, content.indexOf(BEGIN));
		const post = content.slice(content.indexOf(END) + END.length);
		content = pre + block + post;
	} else {
		content = content.trimEnd() + '\n\n' + block + '\n';
	}
	await writeFile(p, content, 'utf-8');
	done.push('CLAUDE.md 마커 블록 (블록 구간만 kit 관리)');
}

// ── 기존 구조 감지 (무표 .svelte 존재 여부) ──────────────────────────────
let legacyCount = 0;
{
	const compRoot = join(ROOT, 'src/lib/components');
	if (existsSync(compRoot)) {
		const scan = async (d) => {
			for (const e of await readdir(d, { withFileTypes: true })) {
				const p = join(d, e.name);
				if (e.isDirectory()) {
					if (e.name !== 'ui') await scan(p);
				} else if (
					e.name.endsWith('.svelte') &&
					!/\.(primitive|composite|live|stories)\.svelte$/.test(e.name)
				)
					legacyCount++;
			}
		};
		await scan(compRoot);
	}
}

// ── 요약 ─────────────────────────────────────────────────────────────────
log(`\n✓ arch kit v${KIT_VERSION} 설치/업데이트 완료 → ${norm(ROOT)}`);
for (const d of done) log(`  · ${d}`);
if (legacyCount > 0) {
	log(`\n⚠ 기존(무표) 컴포넌트 ${legacyCount}개 감지 — 표준 이행이 필요합니다.`);
	log(`  ① bun run arch:plan          # 전수 검사 → 이행 플랜 산출 (이동·리네임·임포트 치환)`);
	log(`  ② 플랜을 검토·승인한 뒤에만: bun run arch:plan -- --apply`);
	log(`  (에이전트 규범: 플랜을 사용자에게 보여주고 "이렇게 옮기겠습니다. 진행할까요?" 승인 필수)`);
}
log(`\n다음 단계:`);
log(`  1. bun run arch:audit        # baseline 위반 수 확인 (기존 프로젝트면 부채 잔고 박제)`);
log(`  2. git diff 리뷰 → 커밋: chore(arch): kit v${KIT_VERSION} 설치`);
log(`  3. UI 작업 전 상시: bun run arch:manifest -- --layer primitive`);
