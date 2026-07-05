#!/usr/bin/env node
/**
 * 릴리스 버전 동기화 가드 — svelte-arch 저장소 자체 유지보수 스크립트(소비 프로젝트에 배포되는 kit 아님).
 *
 * 버전이 세 곳에 흩어져 있어 릴리스마다 하나를 빠뜨리기 쉽다(실제로 plugin.json이 5.1.0에
 * 방치된 채 kit/CHANGELOG만 5.3.0으로 올라간 적 있음). 이 스크립트는 세 소스가 정확히 일치하는지
 * 검사하고, 어긋나면 비-0 종료해 pre-push 훅이 push를 막는다.
 *
 *   1. .claude-plugin/plugin.json  →  "version"          (Claude Code /plugin 이 읽는 값)
 *   2. skills/svelte-arch/kit/scripts/arch.mjs  →  KIT_VERSION  (audit·매니페스트·마커에 노출)
 *   3. CHANGELOG.md  →  최상단 "## X.Y.Z" 헤딩
 *
 * 실행: `bun scripts/check-version-sync.mjs` 또는 `node scripts/check-version-sync.mjs`
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(repoRoot, rel), 'utf8');

const SEMVER = /^\d+\.\d+\.\d+$/;

/** plugin.json 의 version 필드. */
function pluginVersion() {
	const v = JSON.parse(read('.claude-plugin/plugin.json')).version;
	if (typeof v !== 'string') throw new Error('plugin.json 에 version 문자열이 없습니다');
	return v;
}

/** arch.mjs 의 `const KIT_VERSION = 'X.Y.Z'`. */
function kitVersion() {
	const m = read('skills/svelte-arch/kit/scripts/arch.mjs').match(
		/const\s+KIT_VERSION\s*=\s*'([^']+)'/
	);
	if (!m) throw new Error('arch.mjs 에서 KIT_VERSION 을 찾지 못했습니다');
	return m[1];
}

/** CHANGELOG.md 최상단 `## X.Y.Z` 헤딩의 버전. */
function changelogVersion() {
	const m = read('CHANGELOG.md').match(/^##\s+(\d+\.\d+\.\d+)/m);
	if (!m) throw new Error('CHANGELOG.md 에서 최상단 "## X.Y.Z" 헤딩을 찾지 못했습니다');
	return m[1];
}

const sources = {
	'plugin.json': pluginVersion(),
	'arch.mjs KIT_VERSION': kitVersion(),
	'CHANGELOG.md 최상단': changelogVersion()
};

const bad = Object.entries(sources).filter(([, v]) => !SEMVER.test(v));
if (bad.length) {
	console.error('\x1b[31m✗\x1b[0m 버전 형식 오류(semver X.Y.Z 아님):');
	for (const [name, v] of bad) console.error(`    ${name}: "${v}"`);
	process.exit(1);
}

const distinct = [...new Set(Object.values(sources))];
if (distinct.length !== 1) {
	console.error('\x1b[31m✗\x1b[0m 릴리스 버전 불일치 — 세 소스가 달라 push 를 막습니다:');
	for (const [name, v] of Object.entries(sources)) console.error(`    ${name.padEnd(22)} ${v}`);
	console.error('\n  → 세 곳을 같은 버전으로 맞춘 뒤 다시 push 하세요.');
	process.exit(1);
}

console.log(`\x1b[32m✓\x1b[0m 릴리스 버전 동기화 OK — 세 소스 모두 v${distinct[0]}`);
