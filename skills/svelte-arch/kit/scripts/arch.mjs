#!/usr/bin/env bun
/**
 * arch.mjs — SvelteKit 풀스택 파일 종별 아키텍처 CLI (svelte-arch kit)
 *
 * ⚠ kit-owned — 이 파일을 직접 수정하지 말 것. 업데이트(init 재실행) 시 덮어써진다.
 *    프로젝트 확장(룰 추가·allowlist·중립 리터럴)은 .svelte-arch/config.mjs 에.
 *
 * 사용:
 *   bun scripts/arch.mjs manifest [--layer primitive] [--domain <d>] [--detail <Base>] [--json]
 *   bun scripts/arch.mjs audit    [--files <p...>] [--json]
 *   bun scripts/arch.mjs analyze  [--json]           # 진화 신호 리포트 (승격 후보·고아·비대·커버리지)
 *   bun scripts/arch.mjs new primitive <Name>
 *   bun scripts/arch.mjs new section <domain> <Name> # dumb+live 페어 생성
 *   bun scripts/arch.mjs new composite <domain> <Name>
 *   bun scripts/arch.mjs new set <set> <Root> <Part...>  # 세트 폴더+부품+index.ts 배럴 자동 생성
 *   bun scripts/arch.mjs version
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const KIT_VERSION = '3.1.1';
const ROOT = process.cwd();
const COMPONENTS = 'src/lib/components';
const SELF_DIR = dirname(fileURLToPath(import.meta.url));
// 설치본(.svelte-arch/templates)과 킷 원본(kit/scripts → ../templates) 양쪽 지원
const TEMPLATE_DIR = [join(SELF_DIR, 'templates'), join(SELF_DIR, '../templates')].find((d) =>
	existsSync(d)
);

// ── config (project-owned 확장) ──────────────────────────────────────────
const DEFAULT_CONFIG = {
	governedRoots: ['src/lib'],
	readmeExempt: [/components\/ui\/.+/], // vendor 내부 하위폴더 (ui/ 루트는 의무)
	neutralLiterals: ['확인', '취소', '닫기', '저장', '삭제', '검색', '선택', '목록으로', '미리보기', '로딩 중…', '불러오는 중…', '검색 결과가 없습니다'],
	allow: { crossDomain: [], liveOutsideGlue: [] },
	rules: []
};

async function loadConfig() {
	const p = join(ROOT, '.svelte-arch/config.mjs');
	if (!existsSync(p)) return DEFAULT_CONFIG;
	const mod = await import(pathToFileURL(p).href);
	const c = mod.default ?? {};
	return {
		...DEFAULT_CONFIG,
		...c,
		allow: { ...DEFAULT_CONFIG.allow, ...(c.allow ?? {}) },
		readmeExempt: [...DEFAULT_CONFIG.readmeExempt, ...(c.readmeExempt ?? [])]
	};
}

// ── 파일 수집 · 종별 판별 ────────────────────────────────────────────────
const EXCLUDED_DIRS = new Set([
	'node_modules', '.svelte-kit', '.git', 'build', 'dist', 'coverage',
	'test-results', 'playwright-report', 'storybook-static'
]);
const norm = (p) => p.replaceAll('\\', '/');

async function* walk(dir) {
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const e of entries) {
		const p = join(dir, e.name);
		if (e.isDirectory()) {
			if (!EXCLUDED_DIRS.has(e.name)) yield* walk(p);
		} else if (e.isFile()) yield p;
	}
}

/** 종별 판별. legacy=true 는 접미사 없이 디렉토리로 추정된 것(이행 전 프로젝트 관용 판독). */
function kindOf(rel) {
	const r = norm(rel);
	const b = basename(r);
	if (r.includes(`${COMPONENTS}/ui/`)) return { kind: 'vendor' };
	if (/^\+(page|layout|error)(@[^.]*)?\.svelte$/.test(b)) return { kind: 'glue' };
	if (/^\+.+\.(ts|js)$/.test(b)) return { kind: 'glue-server' };
	if (b.endsWith('.stories.svelte')) return { kind: 'stories' };
	if (b.endsWith('.spec.ts')) return { kind: 'spec' };
	if (b.endsWith('.primitive.svelte')) return { kind: 'primitive' };
	if (b.endsWith('.composite.svelte')) return { kind: 'composite' };
	if (b.endsWith('.live.svelte')) return { kind: 'live' };
	if (b.endsWith('.svelte.ts')) return { kind: 'runes-module' };
	if (b.endsWith('.remote.ts')) return { kind: 'remote' };
	if (b.endsWith('.service.ts')) return { kind: 'service' };
	if (b.endsWith('.repository.ts')) return { kind: 'repository' };
	if (b.endsWith('.svelte')) {
		// 무표 .svelte — 이행 전 레포 관용 판독(매니페스트용), 감사는 UNMARKED 로 적발
		if (r.startsWith('src/routes/')) return { kind: 'other-svelte' };
		if (r.includes(`${COMPONENTS}/primitive/`)) return { kind: 'primitive', legacy: true };
		if (r.includes(`${COMPONENTS}/`)) return { kind: r.endsWith('.live.svelte') ? 'live' : 'composite', legacy: true };
		return { kind: 'other-svelte' };
	}
	return { kind: 'ts' };
}

/** 도메인 추출 — 신트리(components/<domain>/)와 구트리(components/composite/<domain>/) 겸용 */
function domainOf(rel) {
	const m = norm(rel).match(/components\/(?:composite\/)?([^/]+)\//);
	if (!m) return null;
	if (['primitive', 'ui', 'composite'].includes(m[1])) return null;
	return m[1];
}

function baseOf(rel) {
	return basename(rel).replace(/\.(primitive|composite|live|stories)\.svelte$|\.svelte$/, '');
}

async function collectFiles() {
	const files = [];
	for await (const abs of walk(join(ROOT, 'src'))) {
		const rel = norm(relative(ROOT, abs));
		if (!/\.(svelte|ts|tsx)$/.test(rel)) continue;
		const { kind, legacy } = kindOf(rel);
		files.push({ abs, rel, kind, legacy: !!legacy, content: await readFile(abs, 'utf-8') });
	}
	return files;
}

// ── 컴포넌트 메타 추출 (매니페스트 + 일부 감사 룰 공용) ──────────────────
function extractDoc(content) {
	const m = content.match(/<!--\s*@component([\s\S]*?)-->/);
	if (!m) return { role: '', usage: '' };
	const lines = m[1].split('\n').map((l) => l.trim()).filter(Boolean);
	const usage = lines.find((l) => l.startsWith('사용:') || l.startsWith('<'));
	const role = lines.find((l) => l !== usage) ?? '';
	return { role, usage: usage ?? '' };
}

/** `type Props = <prefix> & { ... }` 블록 파싱. 실패 시 raw 만 반환 (parse-or-quote). */
function extractProps(content) {
	const anchor = content.match(/(?:type|interface)\s+Props\b[^={]*[={]/);
	if (!anchor) return null;
	const start = content.indexOf(anchor[0]) + anchor[0].length - 1;
	// '=' 뒤 첫 '{' 를 찾아 중괄호 균형 매칭. 앞부분(교차 타입 prefix)은 base 로 기록.
	let i = content.indexOf('{', anchor[0].endsWith('{') ? start : start);
	if (i === -1) return null;
	const prefix = content.slice(content.indexOf(anchor[0]) + anchor[0].length - 1, i).replace(/[=&\s]+/g, ' ').trim();
	let depth = 0;
	let end = -1;
	for (let j = i; j < content.length; j++) {
		if (content[j] === '{') depth++;
		else if (content[j] === '}') {
			depth--;
			if (depth === 0) {
				end = j;
				break;
			}
		}
	}
	if (end === -1) return null;
	// 주석 제거 후 판정 — 주석 속 '{' 가 비정형 오판정을 만들지 않게 (TSDoc 은 멤버 정규식이 별도 캡처)
	const inner = content
		.slice(i + 1, end)
		.replace(/\/\/[^\n]*/g, '')
		.replace(/\/\*(?!\*)[\s\S]*?\*\//g, '');
	const raw = content.slice(content.indexOf(anchor[0]), end + 1);
	// 내부에 중첩 객체 타입({})이 있으면 멤버 정규식이 불안정 → 비정형(원문 인용).
	// 처방: 인라인 객체 타입은 별칭으로 추출 (manifest-protocol.md §앵커)
	const irregular = /\{/.test(inner);
	const members = [];
	if (!irregular) {
		const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?([A-Za-z_$][\w$]*)(\?)?\s*:\s*([^;\n]+)[;\n]/g;
		let m;
		while ((m = re.exec(inner)) !== null) {
			members.push({
				doc: (m[1] ?? '').replace(/^[\s*]+/gm, '').trim().split('\n')[0] ?? '',
				deprecated: /@deprecated/.test(m[1] ?? ''),
				name: m[2],
				optional: !!m[3],
				type: m[4].trim()
			});
		}
	}
	// $props() 구조분해에서 기본값·bindable·rest 추출
	const defaults = new Map();
	const bindables = new Set();
	let rest = null;
	const dm = content.match(/(?:let|const)\s*\{([\s\S]*?)\}\s*(?::\s*\w+)?\s*=\s*\$props\(\)/);
	if (dm) {
		for (const entryRaw of splitTopLevel(dm[1], ',')) {
			const entry = entryRaw.trim();
			if (!entry) continue;
			if (entry.startsWith('...')) {
				rest = entry.slice(3).trim();
				continue;
			}
			const em = entry.match(/^([\w$]+)(?:\s*:\s*[\w$]+)?\s*(?:=\s*([\s\S]+))?$/);
			if (!em) continue;
			const [, name, def] = em;
			if (def?.includes('$bindable')) {
				bindables.add(name);
				const arg = def.match(/\$bindable\(([\s\S]*)\)/)?.[1]?.trim();
				if (arg) defaults.set(name, arg);
			} else if (def !== undefined) defaults.set(name, def.trim());
		}
	}
	return { raw, prefix, irregular, members, defaults, bindables, rest };
}

/** 최상위 구분자 split (괄호·중괄호·대괄호 depth 0 에서만) */
function splitTopLevel(s, sep) {
	const out = [];
	let depth = 0;
	let cur = '';
	for (const ch of s) {
		if ('([{'.includes(ch)) depth++;
		else if (')]}'.includes(ch)) depth--;
		if (ch === sep && depth === 0) {
			out.push(cur);
			cur = '';
		} else cur += ch;
	}
	out.push(cur);
	return out;
}

function classifyMember(m, bindables) {
	if (bindables.has(m.name)) return '양방향';
	if (/\bSnippet\b/.test(m.type)) return '스니펫';
	if (/^on[A-Z]/.test(m.name) && m.type.includes('=>')) return '콜백';
	return '주입';
}

// ── manifest ─────────────────────────────────────────────────────────────
async function runManifest(args, config) {
	const files = await collectFiles();
	const comps = files.filter((f) => ['primitive', 'composite', 'live', 'stories'].includes(f.kind));
	const consumers = buildConsumerMap(files);

	const layerOnly = args.get('--layer');
	const domainOnly = args.get('--domain');
	const detail = args.get('--detail');
	const pkgName = await readPkgName();

	const primitives = comps.filter((f) => f.kind === 'primitive');
	const domains = [...new Set(comps.map((f) => domainOf(f.rel)).filter(Boolean))].sort();

	if (args.has('--json')) {
		const data = comps.map((f) => ({
			rel: f.rel, kind: f.kind, legacy: f.legacy, base: baseOf(f.rel),
			domain: domainOf(f.rel), consumers: consumers.get(f.rel)?.size ?? 0,
			doc: extractDoc(f.content)
		}));
		console.log(JSON.stringify({ kit: KIT_VERSION, project: pkgName, components: data }, null, 2));
		return 0;
	}

	const out = [];
	const domainCounts = domains.map((d) => `${d}(${comps.filter((f) => domainOf(f.rel) === d && f.kind === 'composite').length})`).join(' ');
	out.push(`# arch-manifest · kit v${KIT_VERSION} · ${pkgName} · primitive ${primitives.length} · domains ${domainCounts}`);

	if (detail) {
		const f = comps.find((x) => baseOf(x.rel) === detail);
		if (!f) {
			console.error(`✗ '${detail}' 컴포넌트를 찾지 못함`);
			return 1;
		}
		out.push('', ...renderDetail(f, consumers, files));
		console.log(out.join('\n'));
		return 0;
	}

	if (!domainOnly || layerOnly === 'primitive') {
		out.push('', '## primitive');
		// 세트 폴더 그룹
		const sets = new Map();
		const flat = [];
		for (const f of primitives) {
			const sm = norm(f.rel).match(/primitive\/([^/]+)\/[^/]+$/);
			if (sm && sm[1] !== 'icons') (sets.get(sm[1]) ?? sets.set(sm[1], []).get(sm[1])).push(f);
			else flat.push(f);
		}
		for (const f of flat.sort((a, b) => baseOf(a.rel).localeCompare(baseOf(b.rel)))) {
			out.push('', ...renderDetail(f, consumers, files));
		}
		for (const [set, parts] of sets) {
			const root = parts.find((p) => /Root/.test(p.rel)) ?? parts[0];
			out.push('', `### ${set} (세트) · 부품 ${parts.length}`, extractDoc(root.content).role || '(역할 주석 없음)');
			for (const p of parts) out.push(...renderDetail(p, consumers, files, '  '));
		}
	}

	const targetDomains = domainOnly ? [domainOnly] : layerOnly === 'primitive' ? [] : domains;
	for (const d of targetDomains) {
		const dFiles = comps.filter((f) => domainOf(f.rel) === d && f.kind === 'composite');
		const readme1 = await readmeFirstLine(join(ROOT, COMPONENTS, d));
		out.push('', `## ${d}${readme1 ? ` — ${readme1}` : ''}`);
		for (const f of dFiles.sort((a, b) => a.rel.localeCompare(b.rel))) {
			const base = baseOf(f.rel);
			const hasLive = comps.some((x) => x.kind === 'live' && baseOf(x.rel) === base && dirname(x.rel) === dirname(f.rel));
			const hasStory = comps.some((x) => x.kind === 'stories' && baseOf(x.rel) === base) ||
				files.some((x) => x.kind === 'spec' && baseOf(x.rel).replace(/\.svelte$/, '') === base);
			const { role } = extractDoc(f.content);
			const flags = [base.endsWith('Section') ? '화면루트' : '부품', hasLive && '⚡live', hasStory && '📖', f.legacy && '⚠무표'].filter(Boolean).join(' · ');
			out.push(`${base} · ${flags} · ${role || '(역할 주석 없음)'} · 소비 ${consumers.get(f.rel)?.size ?? 0}곳`);
		}
		if (domainOnly) out.push('', ...(await wireTypes(d)));
	}

	console.log(out.join('\n'));
	return 0;
}

function renderDetail(f, consumers, files, indent = '') {
	const base = baseOf(f.rel);
	const { role, usage } = extractDoc(f.content);
	const props = extractProps(f.content);
	const hasStory = files.some(
		(x) => (x.kind === 'stories' && baseOf(x.rel) === base) || (x.kind === 'spec' && baseOf(x.rel).replace(/\.svelte$/, '') === base)
	);
	const lines = [];
	lines.push(`${indent}### ${base} · ${f.kind}${f.legacy ? ' ⚠무표' : ''} · 소비 ${consumers.get(f.rel)?.size ?? 0}곳${hasStory ? ' · 📖' : ''}`);
	lines.push(`${indent}${role || '(역할 주석 없음 — @component 헤더 필요)'}`);
	if (usage) lines.push(`${indent}${usage.startsWith('사용:') ? usage : `사용: ${usage}`}`);
	if (!props) {
		lines.push(`${indent}⚠ Props 명명 선언 없음 (type Props 앵커 필요)`);
		return lines;
	}
	if (props.irregular) {
		lines.push(`${indent}⚠비정형 — Props 원문:`);
		lines.push(...props.raw.split('\n').map((l) => indent + l));
		return lines;
	}
	const byClass = { 주입: [], 양방향: [], 콜백: [], 스니펫: [] };
	for (const m of props.members) {
		const def = props.defaults.has(m.name) ? ` = ${props.defaults.get(m.name)}` : '';
		const req = !m.optional && !props.defaults.has(m.name) ? ' (필수)' : '';
		const dep = m.deprecated ? ' ⛔폐기예정' : '';
		byClass[classifyMember(m, props.bindables)].push(
			`${m.name}${m.optional ? '?' : ''}: ${m.type}${def}${req}${dep}${m.doc ? ` — ${m.doc}` : ''}`
		);
	}
	for (const [label, items] of Object.entries(byClass)) {
		if (items.length) lines.push(`${indent}${label.padEnd(3, '　')} ${items.join(`\n${indent}     `)}`);
	}
	if (props.rest || props.prefix) lines.push(`${indent}통과   ${props.prefix || ''}${props.rest ? ` (...${props.rest})` : ''}`.trimEnd());
	return lines;
}

function buildConsumerMap(files) {
	const map = new Map();
	for (const f of files) map.set(f.rel, new Set());
	const bySuffix = files.filter((f) => f.rel.includes('components/'));
	for (const f of files) {
		for (const im of f.content.matchAll(/from\s+['"]([^'"]*components\/[^'"]+\.svelte)['"]/g)) {
			const suffix = im[1].slice(im[1].indexOf('components/'));
			const target = bySuffix.find((x) => norm(x.rel).endsWith(suffix));
			if (target && target.rel !== f.rel) map.get(target.rel)?.add(f.rel);
		}
		// 세트 네임스페이스 임포트 → 세트 부품 전체에 카운트
		for (const im of f.content.matchAll(/from\s+['"]\$lib\/components\/primitive\/([^/'".]+)['"]/g)) {
			for (const t of bySuffix.filter((x) => norm(x.rel).includes(`primitive/${im[1]}/`)))
				map.get(t.rel)?.add(f.rel);
		}
	}
	return map;
}

async function wireTypes(domain) {
	const out = [`### wire 타입 (${domain}.remote)`];
	const dataDir = join(ROOT, 'src/lib/data');
	if (!existsSync(dataDir)) return [];
	for (const e of await readdir(dataDir)) {
		if (!e.startsWith(domain) || !e.endsWith('.remote.ts')) continue;
		const content = await readFile(join(dataDir, e), 'utf-8');
		for (const m of content.matchAll(/export\s+(?:type|interface)\s+[A-Za-z_$][\w$]*[\s\S]*?(?=\nexport|\n\n|$)/g)) {
			out.push(m[0].trim());
		}
	}
	return out.length > 1 ? out : [];
}

async function readmeFirstLine(dir) {
	try {
		const c = await readFile(join(dir, 'README.md'), 'utf-8');
		return c.split('\n')[0]?.replace(/^#\s*[^—-]*[—-]\s*/, '').replace(/^#\s*/, '').trim() ?? '';
	} catch {
		return '';
	}
}

async function readPkgName() {
	try {
		return JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8')).name ?? '(이름없음)';
	} catch {
		return '(이름없음)';
	}
}

// ── audit ────────────────────────────────────────────────────────────────
const T = (kinds) => new Set(kinds);
const isTypeImport = (line) => /^\s*import\s+type\b/.test(line);

/** 코어 룰 — 종별 지명(R0). 상세 근거는 스킬 references/audit-rules.md */
const CORE_RULES = [
	{
		code: 'UNMARKED_COMPONENT', severity: 'error', kinds: T(['primitive', 'composite', 'live', 'other-svelte']),
		desc: '무표 .svelte — 종별 접미사(.primitive/.composite/.live)로 역할 선언 필요',
		check: (f) => (f.legacy || f.kind === 'other-svelte') && !norm(f.rel).startsWith('src/routes/')
			? [v(f, 1, basename(f.rel))] : []
	},
	{
		code: 'SUFFIX_DIR_MISMATCH', severity: 'error', kinds: T(['primitive', 'composite', 'live']),
		desc: '접미사↔디렉토리 불일치 (파일명=역할, 디렉토리=소속 — 두 채널 상호 검증)',
		check: (f) => {
			if (f.legacy) return [];
			const r = norm(f.rel);
			const inPrimitive = r.includes(`${COMPONENTS}/primitive/`);
			if (f.kind === 'primitive' && r.includes(`${COMPONENTS}/`) && !inPrimitive) return [v(f, 1, '.primitive 파일이 primitive/ 밖')];
			if (f.kind !== 'primitive' && inPrimitive) return [v(f, 1, `${f.kind} 파일이 primitive/ 안`)];
			return [];
		}
	},
	{
		code: 'LIVE_WITHOUT_PAIR', severity: 'error', kinds: T(['live']),
		desc: 'live 페어 dumb 부재 (같은 폴더·같은 Base 의 .composite.svelte 필수)',
		check: (f) => {
			if (f.legacy) return [];
			const dir = dirname(f.abs);
			const base = baseOf(f.rel);
			if (existsSync(join(dir, `${base}.composite.svelte`)) || existsSync(join(dir, `${base}.svelte`))) return [];
			return [v(f, 1, `${base}.composite.svelte 없음`)];
		}
	},
	{
		code: 'UPWARD_IMPORT_IN_PRIMITIVE', severity: 'error', kinds: T(['primitive']),
		desc: 'primitive 의 상향 의존 (도메인·앱·데이터 무지 위반)',
		scan: /from\s+['"](?:\$lib\/data\/|\$lib\/server\/|\$lib\/state\/|\$app\/navigation|\$app\/state|[^'"]*\.(?:composite|live)\.svelte)['"]/,
		skipTypeImport: true
	},
	{
		code: 'CROSS_DOMAIN_IMPORT', severity: 'error', kinds: T(['composite', 'live']),
		desc: '도메인 간 수평 import (공유가 필요하면 primitive 승격이 유일 통로)',
		check: (f, ctx) => {
			const own = domainOf(f.rel);
			if (!own) return [];
			if (ctx.config.allow.crossDomain.includes(norm(f.rel))) return [];
			const out = [];
			f.lines.forEach((line, i) => {
				if (isTypeImport(line)) return;
				const m = line.match(/from\s+['"]\$lib\/components\/(?:composite\/)?([^/'"]+)\//);
				if (m && m[1] !== own && !['primitive', 'ui'].includes(m[1])) out.push(v(f, i + 1, line.trim()));
			});
			return out;
		}
	},
	{
		code: 'REMOTE_IN_DUMB', severity: 'error', kinds: T(['composite']),
		desc: 'dumb 의 remote 값 import (.live 페어가 배선 — dumb 은 mock props 렌더 가능해야)',
		scan: /from\s+['"][^'"]*\.remote['"]/, skipTypeImport: true
	},
	{
		code: 'STATE_MODULE_IN_DUMB', severity: 'error', kinds: T(['composite', 'primitive']),
		desc: '전역 상태 모듈($lib/state) import — live 전용',
		scan: /from\s+['"]\$lib\/state\//, skipTypeImport: true
	},
	{
		code: 'GLUE_LOGIC', severity: 'error', kinds: T(['glue']),
		desc: '글루(+page/+layout)의 배선 로직 — 글루는 live 마운트·Snippet 주입·파라미터 전달만',
		scan: /\$state\s*\(|\$effect\b|from\s+['"][^'"]*\.remote['"]/
	},
	{
		code: 'LIVE_IMPORT_OUTSIDE_GLUE', severity: 'error',
		kinds: T(['primitive', 'composite', 'live', 'runes-module', 'ts', 'stories']),
		desc: '.live 를 글루 외 파일이 import (live 는 라우트 글루의 소유물 — dumb 은 Snippet 으로 주입받음)',
		check: (f, ctx) => {
			if (ctx.config.allow.liveOutsideGlue.includes(norm(f.rel))) return [];
			const out = [];
			f.lines.forEach((line, i) => {
				if (/from\s+['"][^'"]*\.live\.svelte['"]/.test(line)) out.push(v(f, i + 1, line.trim()));
			});
			return out;
		}
	},
	{
		code: 'LIVE_MARKUP', severity: 'error', kinds: T(['live']),
		desc: 'live 의 HTML 마크업 (마크업 0 — boundary+페어+스니펫만. 콘텐츠가 필요하면 dumb 에 prop 추가)',
		check: (f) => {
			const out = [];
			let inScript = false;
			f.lines.forEach((line, i) => {
				if (/<script\b/.test(line)) inScript = true;
				if (/<\/script>/.test(line)) {
					inScript = false;
					return;
				}
				if (inScript) return;
				if (/<(?!\/|svelte:|script\b|style\b|!--)[a-z]/.test(line)) out.push(v(f, i + 1, line.trim()));
			});
			return out;
		}
	},
	{
		code: 'UI_VENDOR_IMPORT', severity: 'error',
		kinds: T(['composite', 'live', 'glue', 'runes-module', 'ts', 'remote', 'service', 'repository']),
		desc: 'vendor(components/ui = shadcn-svelte 구역) 소비 — primitive 의 래핑만 허용',
		scan: /from\s+['"][^'"]*components\/ui\//
	},
	{
		code: 'NO_BARREL_IMPORT', severity: 'error',
		kinds: T(['primitive', 'composite', 'live', 'glue', 'runes-module', 'ts', 'stories']),
		desc: '배럴형 import — 딥 임포트 단일 규약 (세트 네임스페이스 import 는 primitive/<set> 만)',
		check: (f) => {
			const out = [];
			f.lines.forEach((line, i) => {
				if (/from\s+['"]\$lib\/components\/(?:primitive|composite|layout|ui)?['"]/.test(line)) out.push(v(f, i + 1, line.trim()));
				const m = line.match(/from\s+['"]\$lib\/components\/([^/'"]+)['"]/);
				if (m) out.push(v(f, i + 1, line.trim()));
				const m2 = line.match(/from\s+['"]\$lib\/components\/(?!primitive\/|ui\/)([^/'"]+)\/([^/'".]+)['"]/);
				if (m2) out.push(v(f, i + 1, `도메인 하위 배럴: ${line.trim()}`));
			});
			return out;
		}
	},
	{
		code: 'SET_PARTIAL_IMPORT', severity: 'error',
		kinds: T(['primitive', 'composite', 'live', 'glue', 'stories']),
		desc: '세트 부분 구조분해 import — 네임스페이스(import * as X) 의무',
		scan: /import\s*\{[^}]*\}\s*from\s+['"]\$lib\/components\/primitive\/[^/'".]+['"]/
	},
	{
		code: 'CLASS_MERGE_IMPORT', severity: 'error', kinds: T(['primitive', 'composite', 'live', 'glue']),
		desc: 'cn/clsx/tailwind-merge import — 내장 class={[...]} 배열만 (배열이어야 린트·정렬·감사가 정확)',
		check: (f) => {
			const out = [];
			f.lines.forEach((line, i) => {
				if (/from\s+['"](?:clsx|classnames|tailwind-merge|tw-merge)['"]/.test(line)) out.push(v(f, i + 1, line.trim()));
				else if (/import\s*\{[^}]*\bcn\b[^}]*\}\s*from/.test(line)) out.push(v(f, i + 1, line.trim()));
			});
			return out;
		}
	},
	{
		code: 'TEMPLATE_LITERAL_CLASS', severity: 'error', kinds: T(['primitive', 'composite']),
		desc: '템플릿 리터럴 클래스 합성 — class={[...]} 배열 사용 (정적 분석 가능해야)',
		scan: /\bclass=\{`/
	},
	{
		code: 'STRING_CLASS_ON_COMPONENT', severity: 'error', kinds: T(['primitive', 'composite', 'live', 'glue']),
		desc: '컴포넌트 태그에 문자열 class="…" — class={[...]} 배열 사용',
		check: (f) => {
			const out = [];
			const re = /\bclass="[^"]*"/g;
			let m;
			while ((m = re.exec(f.content)) !== null) {
				const before = f.content.slice(0, m.index);
				const lastLt = before.lastIndexOf('<');
				if (lastLt === -1) continue;
				const slice = before.slice(lastLt);
				if (slice.includes('>')) continue;
				const tag = /^<([A-Za-z][\w:.]*)/.exec(slice);
				if (!tag || !/^[A-Z]/.test(tag[1])) continue;
				out.push(v(f, before.split('\n').length, m[0].slice(0, 80)));
			}
			return out;
		}
	},
	{
		code: 'MISSING_COMPONENT_DOC', severity: 'error', kinds: T(['primitive', 'composite']),
		desc: '<!-- @component --> 헤더 부재 (IDE 호버·매니페스트·감사 3소비자 앵커)',
		check: (f) => (/<!--\s*@component/.test(f.content) ? [] : [v(f, 1, basename(f.rel))])
	},
	{
		code: 'UNNAMED_PROPS_TYPE', severity: 'error', kinds: T(['primitive', 'composite', 'live']),
		desc: '$props() 인라인 타입 — type Props 명명 선언 필수 (추출 앵커)',
		check: (f) => (f.content.includes('$props()') && !/(?:type|interface)\s+Props\b/.test(f.content) ? [v(f, 1, basename(f.rel))] : [])
	},
	{
		code: 'UNDOCUMENTED_PROP', severity: 'warn', kinds: T(['primitive']),
		desc: 'TSDoc 없는 prop (primitive 는 전 prop 문서 의무 — 매니페스트 주입 품질)',
		check: (f) => {
			const p = extractProps(f.content);
			if (!p || p.irregular) return [];
			return p.members.filter((m) => !m.doc).map((m) => v(f, 1, m.name));
		}
	},
	{
		code: 'DOMAIN_DEFAULT_IN_PRIMITIVE', severity: 'warn', kinds: T(['primitive']),
		desc: 'primitive 문구 prop 의 도메인 어휘 기본값 (기본값 제거 — 소비자가 공급)',
		check: (f, ctx) => {
			const out = [];
			// 접미사 매칭 — searchPlaceholder·emptyTitle 같은 camelCase 변형까지 포착
			const re = /\b\w*(?:[pP]laceholder|[lL]abel|[tT]itle|[dD]escription)\s*(?:=|\?\?)\s*['"]([^'"]*[가-힣]{2}[^'"]*)['"]/g;
			f.lines.forEach((line, i) => {
				let m;
				re.lastIndex = 0;
				while ((m = re.exec(line)) !== null) {
					if (!ctx.config.neutralLiterals.includes(m[1].trim())) out.push(v(f, i + 1, m[0].slice(0, 80)));
				}
			});
			return out;
		}
	},
	{
		code: 'CALLBACK_NAME_STYLE', severity: 'warn', kinds: T(['primitive', 'composite']),
		desc: '콜백 prop 은 camelCase onXxx (DOM passthrough 소문자와 시각 구분)',
		check: (f) => {
			const p = extractProps(f.content);
			if (!p || p.irregular) return [];
			return p.members
				.filter((m) => /^on[a-z]/.test(m.name) && m.type.includes('=>'))
				.map((m) => v(f, 1, `${m.name} → on${m.name[2].toUpperCase()}${m.name.slice(3)}`));
		}
	}
];

function v(f, line, match) {
	return { file: f.rel, line, match: String(match).slice(0, 100) };
}

async function structuralChecks(files, config, hatchOnly = false) {
	const out = [];
	// DUPLICATE_ESCAPE_HATCH — 토큰 정렬 정규화(순서만 다른 복붙도 검출)
	const hatch = new Map();
	for (const f of files) {
		if (!['primitive', 'composite'].includes(f.kind)) continue;
		for (const m of f.content.matchAll(/\b([a-z][A-Za-z]*Class)=(?:"([^"]+)"|\{'([^']+)'\})/g)) {
			const tokens = (m[2] ?? m[3]).split(/\s+/).filter(Boolean);
			if (tokens.length < 4) continue;
			const key = `${m[1]}::${tokens.toSorted().join(' ')}`;
			const line = f.content.slice(0, m.index).split('\n').length;
			(hatch.get(key) ?? hatch.set(key, []).get(key)).push({ f, line });
		}
	}
	for (const [key, sites] of hatch) {
		const fileSet = new Set(sites.map((s) => s.f.rel));
		if (fileSet.size < 2) continue;
		for (const s of sites)
			out.push({
				code: 'DUPLICATE_ESCAPE_HATCH', severity: 'error',
				desc: `동일 이스케이프 해치가 ${fileSet.size}개 파일에 복붙 — primitive variant 로 승격`,
				file: s.f.rel, line: s.line, match: key.split('::')[0]
			});
	}
	if (hatchOnly) return out;

	// NO_BARREL_FILE + SET_BARREL_LEAK
	for (const f of files) {
		const r = norm(f.rel);
		if (!r.startsWith(`${COMPONENTS}/`) || basename(r) !== 'index.ts' || r.includes('/ui/')) continue;
		const setMatch = r.match(new RegExp(`^${COMPONENTS}/primitive/([^/]+)/index\\.ts$`));
		if (!setMatch) {
			out.push({ code: 'NO_BARREL_FILE', severity: 'error', desc: '배럴(index.ts) 금지 — 발견성은 arch:manifest, 배럴은 세트 폴더만', file: f.rel, line: 1, match: 'index.ts' });
			continue;
		}
		f.lines.forEach((line, i) => {
			const t = line.trim();
			if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
			if (!/^export\s.+from\s+'\.\/[^/']+';?$/.test(t))
				out.push({ code: 'SET_BARREL_LEAK', severity: 'error', desc: '세트 배럴은 같은 폴더 부품 재수출만 (로직·외부 재수출 금지)', file: f.rel, line: i + 1, match: t.slice(0, 80) });
		});
	}

	// MISSING_README — 관장 트리 전 디렉토리
	const dirs = new Set();
	for (const root of config.governedRoots) {
		const abs = join(ROOT, root);
		if (!existsSync(abs)) continue;
		dirs.add(root);
		for await (const p of walk(abs)) dirs.add(norm(relative(ROOT, dirname(p))));
	}
	for (const d of [...dirs].sort()) {
		if (config.readmeExempt.some((re) => (re instanceof RegExp ? re.test(d) : d.includes(re)))) continue;
		if (!existsSync(join(ROOT, d, 'README.md')))
			out.push({ code: 'MISSING_README', severity: 'error', desc: '디렉토리 자기서술 의무 — README.md 부재 (kit 설치가 씨앗 생성)', file: `${d}/`, line: 1, match: 'README.md 없음' });
	}
	return out;
}

async function collectViolations(files, config, filesArg = null) {
	const rules = [...CORE_RULES, ...config.rules.map(normalizeConfigRule)];
	const scope = filesArg?.length ? files.filter((f) => filesArg.some((t) => norm(t) === f.rel || norm(t).endsWith(f.rel))) : files;

	const violations = [];
	for (const f of scope) {
		for (const rule of rules) {
			if (!rule.kinds.has(f.kind)) continue;
			if (rule.check) {
				for (const x of rule.check(f, { config, files })) violations.push({ ...x, code: rule.code, severity: rule.severity, desc: rule.desc });
			} else if (rule.scan) {
				f.lines.forEach((line, i) => {
					const t = line.trim();
					if (t.startsWith('//') || t.startsWith('*')) return;
					if (rule.skipTypeImport && isTypeImport(line)) return;
					if (rule.scan.test(line)) violations.push({ code: rule.code, severity: rule.severity, desc: rule.desc, file: f.rel, line: i + 1, match: t.slice(0, 100) });
				});
			}
		}
	}
	// 구조 검사: --files 모드에선 해치 중복만(전 파일 필요 검사라 전체 대상으로 수행하되 결과는 scope 무관 유지)
	violations.push(...(await structuralChecks(files, config, !!filesArg?.length)));
	return violations;
}

async function runAudit(args, config) {
	const filesArg = args.getList('--files');
	const files = await collectFiles();
	for (const f of files) f.lines = f.content.split('\n');
	const violations = await collectViolations(files, config, filesArg);

	if (args.has('--json')) console.log(JSON.stringify(violations, null, 2));
	else printAudit(violations);
	return violations.some((x) => x.severity === 'error') ? 1 : 0;
}

function normalizeConfigRule(r) {
	return { ...r, kinds: r.kinds instanceof Set ? r.kinds : new Set(r.kinds), check: r.check, scan: r.pattern ?? r.scan };
}

function printAudit(violations) {
	if (!violations.length) {
		console.log(`\x1b[32m✓\x1b[0m arch:audit 통과 — 위반 0건 (kit v${KIT_VERSION})`);
		return;
	}
	const byCode = Map.groupBy(violations, (x) => x.code);
	for (const [code, list] of byCode) {
		const tag = list[0].severity === 'error' ? '\x1b[31m■\x1b[0m' : '\x1b[33m▲\x1b[0m';
		console.log(`\n${tag} \x1b[1m${code}\x1b[0m (${list.length}건) — ${list[0].desc}`);
		for (const x of list.slice(0, 5)) console.log(`   ${x.file}:${x.line}  \x1b[90m${x.match}\x1b[0m`);
		if (list.length > 5) console.log(`   \x1b[90m… ${list.length - 5}건 더\x1b[0m`);
	}
	const e = violations.filter((x) => x.severity === 'error').length;
	console.log(`\n총 \x1b[31m${e}\x1b[0m error, \x1b[33m${violations.length - e}\x1b[0m warning (kit v${KIT_VERSION})`);
}

// ── analyze — 진화 신호 리포트 (audit=위반, analyze=다음에 할 일) ─────────
function jaccard(a, b) {
	const A = new Set(a);
	const B = new Set(b);
	const inter = [...A].filter((x) => B.has(x)).length;
	return inter / (A.size + B.size - inter);
}

async function runAnalyze(args, config) {
	const files = await collectFiles();
	for (const f of files) f.lines = f.content.split('\n');
	const comps = files.filter((f) => ['primitive', 'composite', 'live'].includes(f.kind));
	const consumers = buildConsumerMap(files);
	const R = { kit: KIT_VERSION };

	// 1) 종별·커버리지 통계
	const prims = comps.filter((f) => f.kind === 'primitive');
	const sections = comps.filter((f) => f.kind === 'composite' && baseOf(f.rel).endsWith('Section'));
	const hasDoc = (f) => /<!--\s*@component/.test(f.content);
	const hasStory = (f) => {
		const base = baseOf(f.rel);
		return files.some((x) => (x.kind === 'stories' || x.kind === 'spec') && baseOf(x.rel).replace(/\.svelte$/, '') === base);
	};
	let propsTotal = 0;
	let propsDocumented = 0;
	let irregular = [];
	for (const f of prims) {
		const p = extractProps(f.content);
		if (!p) continue;
		if (p.irregular) irregular.push(f.rel);
		else {
			propsTotal += p.members.length;
			propsDocumented += p.members.filter((m) => m.doc).length;
		}
	}
	R.stats = {
		kinds: Object.fromEntries(['primitive', 'composite', 'live', 'glue', 'remote', 'service', 'repository'].map((k) => [k, files.filter((f) => f.kind === k).length])),
		livePairCoverage: `${sections.filter((f) => comps.some((x) => x.kind === 'live' && baseOf(x.rel) === baseOf(f.rel) && dirname(x.rel) === dirname(f.rel))).length}/${sections.length} Section`,
		componentDoc: `${comps.filter((f) => f.kind !== 'live' && hasDoc(f)).length}/${comps.filter((f) => f.kind !== 'live').length}`,
		primitiveTsdoc: propsTotal ? `${propsDocumented}/${propsTotal} prop` : '-',
		storyCoverage: `${prims.filter(hasStory).length}/${prims.length} primitive`
	};

	// 2) 고아·저소비 primitive
	R.orphans = prims.filter((f) => (consumers.get(f.rel)?.size ?? 0) === 0).map((f) => baseOf(f.rel));
	R.lowUse = prims.filter((f) => (consumers.get(f.rel)?.size ?? 0) === 1).map((f) => baseOf(f.rel));

	// 3) 유사 이스케이프 해치 클러스터 (완전 동일은 audit 몫 — 여기선 유사 = variant 승격 후보)
	const hatches = [];
	for (const f of comps) {
		if (!['primitive', 'composite'].includes(f.kind)) continue;
		for (const m of f.content.matchAll(/\b([a-z][A-Za-z]*Class)=(?:"([^"]+)"|\{'([^']+)'\})/g)) {
			const tokens = (m[2] ?? m[3]).split(/\s+/).filter(Boolean);
			if (tokens.length < 4) continue;
			hatches.push({ file: f.rel, line: f.content.slice(0, m.index).split('\n').length, prop: m[1], tokens });
		}
	}
	const clusters = [];
	const used = new Set();
	for (let i = 0; i < hatches.length; i++) {
		if (used.has(i)) continue;
		const group = [hatches[i]];
		for (let j = i + 1; j < hatches.length; j++) {
			if (used.has(j) || hatches[j].prop !== hatches[i].prop) continue;
			if (jaccard(hatches[i].tokens, hatches[j].tokens) >= 0.5) {
				group.push(hatches[j]);
				used.add(j);
			}
		}
		if (new Set(group.map((g) => g.file)).size >= 2) clusters.push(group);
	}
	R.hatchClusters = clusters.map((g) => ({
		prop: g[0].prop,
		sites: g.map((s) => `${s.file}:${s.line}`),
		hint: 'variant 승격 후보 — Rule of Two'
	}));

	// 4) live 비대 (로직은 *.svelte.ts 추출 처방)
	R.fatLives = comps
		.filter((f) => f.kind === 'live' && f.lines.length > 100)
		.sort((a, b) => b.lines.length - a.lines.length)
		.map((f) => `${f.rel} (${f.lines.length}줄)`);

	// 5) composite 의 네이티브 요소 빈도 — primitive 부재 신호
	const NATIVE = ['button', 'input', 'table', 'dialog', 'textarea', 'select', 'nav', 'progress'];
	const nativeCount = Object.fromEntries(NATIVE.map((t) => [t, 0]));
	for (const f of comps.filter((x) => x.kind === 'composite'))
		for (const t of NATIVE) nativeCount[t] += (f.content.match(new RegExp(`<${t}\\b`, 'g')) ?? []).length;
	R.nativeSignals = Object.entries(nativeCount)
		.filter(([, n]) => n >= 5)
		.sort((a, b) => b[1] - a[1])
		.map(([t, n]) => `<${t}> ${n}회 — 대응 primitive 검토`);

	// 6) 매니페스트 품질 부채
	R.manifestQuality = {
		irregularProps: irregular,
		missingDoc: comps.filter((f) => f.kind !== 'live' && !hasDoc(f)).length
	};

	// 7) 감사 요약 (부채 잔고)
	const violations = await collectViolations(files, config);
	const err = violations.filter((v) => v.severity === 'error').length;
	R.auditSummary = `${err} error / ${violations.length - err} warn`;

	if (args.has('--json')) return console.log(JSON.stringify(R, null, 2)), 0;
	const out = [`# arch-analyze · kit v${KIT_VERSION} · ${await readPkgName()}`, ''];
	out.push(`종별: ${Object.entries(R.stats.kinds).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
	out.push(`커버리지: live 페어 ${R.stats.livePairCoverage} · @component ${R.stats.componentDoc} · TSDoc ${R.stats.primitiveTsdoc} · 스토리 ${R.stats.storyCoverage}`);
	out.push(`감사 잔고: ${R.auditSummary}`, '');
	if (R.orphans.length) out.push(`⚠ 고아 primitive (소비 0): ${R.orphans.join(', ')} — 두 릴리스 연속이면 삭제 검토`);
	if (R.lowUse.length) out.push(`저소비 primitive (소비 1): ${R.lowUse.join(', ')}`);
	for (const c of R.hatchClusters) out.push('', `🔺 유사 해치 클러스터 (${c.prop}) — ${c.hint}`, ...c.sites.map((s) => `   ${s}`));
	if (R.fatLives.length) out.push('', '🔺 live 비대 (>100줄 — 로직을 *.svelte.ts 로 추출):', ...R.fatLives.map((s) => `   ${s}`));
	if (R.nativeSignals.length) out.push('', '🔺 네이티브 요소 다빈도 (primitive 부재 신호):', ...R.nativeSignals.map((s) => `   ${s}`));
	if (R.manifestQuality.irregularProps.length)
		out.push('', `🔺 Props 비정형 ${R.manifestQuality.irregularProps.length}건 (인라인 객체 타입 → 별칭 추출):`, ...R.manifestQuality.irregularProps.map((s) => `   ${s}`));
	console.log(out.join('\n'));
	return 0;
}

// ── new — 스캐폴드 생성기 (앵커 선재·Base 전역 유일 강제·세트 배럴 자동) ──
async function loadTemplate(name) {
	if (!TEMPLATE_DIR) throw new Error('템플릿 디렉토리를 찾지 못함 — init 재실행으로 .svelte-arch/templates 복원');
	return readFile(join(TEMPLATE_DIR, name), 'utf-8');
}

async function assertUniqueBase(base) {
	for await (const p of walk(join(ROOT, COMPONENTS))) {
		if (p.endsWith('.svelte') && baseOf(norm(relative(ROOT, p))) === base) {
			console.error(`✗ Base '${base}' 이미 존재: ${norm(relative(ROOT, p))} — Base 는 레포 전역 유일`);
			process.exit(1);
		}
	}
}

const isPascal = (s) => /^[A-Z][A-Za-z0-9]*$/.test(s);

async function seedDirReadme(dir, role) {
	if (existsSync(join(dir, 'README.md'))) return;
	try {
		const t = await loadTemplate('README.template.md');
		await writeFile(join(dir, 'README.md'), t.replaceAll('{DIR}', norm(relative(ROOT, dir))).replaceAll('{역할 한 줄}', role), 'utf-8');
	} catch {
		/* 템플릿 없으면 생략 — audit 이 알림 */
	}
}

async function runNew(positionals) {
	const [kind, ...rest] = positionals;
	const created = [];
	const write = async (rel, content) => {
		const abs = join(ROOT, rel);
		if (existsSync(abs)) {
			console.error(`✗ 이미 존재: ${rel}`);
			process.exit(1);
		}
		await mkdir(dirname(abs), { recursive: true });
		await writeFile(abs, content, 'utf-8');
		created.push(rel);
	};

	if (kind === 'primitive') {
		const [name] = rest;
		if (!name || !isPascal(name)) return console.error('사용법: new primitive <PascalName>'), 1;
		await assertUniqueBase(name);
		const t = await loadTemplate('Component.primitive.svelte');
		await write(`${COMPONENTS}/primitive/${name}.primitive.svelte`, t.replaceAll('Component', name));
	} else if (kind === 'section' || kind === 'composite') {
		const [domain, rawName] = rest;
		if (!domain || !rawName || !isPascal(rawName)) return console.error(`사용법: new ${kind} <domain> <PascalName>`), 1;
		const name = kind === 'section' && !rawName.endsWith('Section') ? `${rawName}Section` : rawName;
		await assertUniqueBase(name);
		const dir = join(ROOT, COMPONENTS, domain);
		await mkdir(dir, { recursive: true });
		await seedDirReadme(dir, `${domain} 도메인 조립 (dumb + live 페어)`);
		const dumb = await loadTemplate('ScreenSection.composite.svelte');
		await write(`${COMPONENTS}/${domain}/${name}.composite.svelte`, dumb.replaceAll('ScreenSection', name));
		if (kind === 'section') {
			const live = await loadTemplate('ScreenSection.live.svelte');
			await write(`${COMPONENTS}/${domain}/${name}.live.svelte`, live.replaceAll('ScreenSection', name));
		}
	} else if (kind === 'set') {
		const [setName, ...parts] = rest;
		if (!setName || !/^[a-z][a-z0-9-]*$/.test(setName) || parts.length < 2 || !parts.every(isPascal))
			return console.error('사용법: new set <kebab-set> <Root> <Part...> (부품 2개 이상, Root 포함 권장)'), 1;
		const pascal = setName.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
		const t = await loadTemplate('SetPart.primitive.svelte');
		const dir = join(ROOT, COMPONENTS, 'primitive', setName);
		for (const part of parts) {
			const base = `${pascal}${part}`;
			await assertUniqueBase(base);
			await write(`${COMPONENTS}/primitive/${setName}/${base}.primitive.svelte`, t.replaceAll('SetName', pascal).replaceAll('PartName', part));
		}
		// 세트 배럴 — 재수출만·같은 폴더만 (SET_BARREL_LEAK 규칙과 정합)
		const index = parts.map((p) => `export { default as ${p} } from './${pascal}${p}.primitive.svelte';`).join('\n') + '\n';
		await write(`${COMPONENTS}/primitive/${setName}/index.ts`, index);
		await seedDirReadme(dir, `${pascal} 세트 (compound) — import * as ${pascal} 네임스페이스 소비`);
	} else {
		console.error('사용법: new <primitive|section|composite|set> …');
		return 1;
	}

	console.log('✓ 생성됨:');
	for (const c of created) console.log(`  · ${c}`);
	console.log('\n다음: @component 역할 1행·TSDoc 채우기 → bun run arch:audit');
	return 0;
}

// ── plan — 기존 프로젝트 이행 플랜 산출·적용 (전수 검사 → 표 → --apply) ──
// 동의 UX 는 도구가 아니라 에이전트 몫: 플랜을 사용자에게 보여주고 "이렇게 옮기겠습니다.
// 진행할까요?" 승인을 받은 뒤에만 --apply 를 실행한다 (스킬 워크플로우 규범).
function pjoin(...parts) {
	const out = [];
	for (const seg of parts.join('/').split('/')) {
		if (seg === '' || seg === '.') continue;
		if (seg === '..') out.pop();
		else out.push(seg);
	}
	return out.join('/');
}

function planTargetFor(rel) {
	let r = norm(rel);
	if (!r.startsWith(`${COMPONENTS}/`)) return null;
	if (r.includes(`${COMPONENTS}/ui/`)) return null; // vendor 불가침
	// composite/ 껍데기 해체
	let to = r.replace(`${COMPONENTS}/composite/`, `${COMPONENTS}/`);
	// 접미사 부여 (.svelte 중 무표만 — live/stories/기존 마킹 유지)
	const b = basename(to);
	if (b.endsWith('.svelte') && !/\.(primitive|composite|live|stories)\.svelte$/.test(b) && !b.startsWith('+')) {
		const marked = to.includes(`${COMPONENTS}/primitive/`)
			? b.replace(/\.svelte$/, '.primitive.svelte')
			: b.replace(/\.svelte$/, '.composite.svelte');
		to = join(dirname(to), marked);
	}
	to = norm(to);
	return to === r ? null : to;
}

async function runPlan(args) {
	// 1) 이동·리네임 매핑 (components 트리 전체 — .ts·.md 부속 포함)
	const moves = [];
	const deletes = [];
	if (!existsSync(join(ROOT, COMPONENTS))) return console.error(`✗ ${COMPONENTS} 없음`), 2;
	for await (const p of walk(join(ROOT, COMPONENTS))) {
		const rel = norm(relative(ROOT, p));
		if (rel.includes(`${COMPONENTS}/ui/`)) continue; // vendor 불가침 — 이동·삭제 대상 아님
		if (basename(rel) === 'index.ts') {
			const isSet = new RegExp(`^${COMPONENTS}/primitive/[^/]+/index\\.ts$`).test(rel);
			if (!isSet) {
				deletes.push(rel); // 비세트 배럴 — 소비처는 딥 임포트로 치환됨
				continue;
			}
		}
		const to = planTargetFor(rel);
		if (to) moves.push({ from: rel, to });
	}
	// 대상 경로가 이미 존재하는 이동은 건너뜀 (자동 덮어쓰기 금지 — 수동 병합 대상)
	const skipped = moves.filter((m) => existsSync(join(ROOT, m.to)));
	const applied = moves.filter((m) => !existsSync(join(ROOT, m.to)));
	moves.length = 0;
	moves.push(...applied);
	const map = new Map(moves.map((m) => [m.from, m.to]));

	// 2) 임포트 재작성 대상 집계 (배럴 named / 절대 딥 / 상대)
	const files = await collectFiles();
	const BARREL_RE = /import\s*\{([^}]+)\}\s*from\s*(['"])\$lib\/components\/primitive\2\s*;?/g;
	const subOf = (rel) => rel.slice(`${COMPONENTS}/`.length);
	function rewriteContent(content, oldRel, newRel) {
		let out = content;
		// (a) 배럴 named import → 새 경로 딥 임포트
		out = out.replace(BARREL_RE, (full, clause) => {
			const indent = full.match(/^[ \t]*/)?.[0] ?? '';
			return clause
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
				.map((n) => `${indent}import ${n} from '$lib/components/primitive/${n}.primitive.svelte';`)
				.join('\n')
				.trimStart();
		});
		// (b) 절대 딥 스펙 치환
		for (const [f, t] of map) out = out.replaceAll(`$lib/components/${subOf(f)}`, `$lib/components/${subOf(t)}`);
		// (c) 상대 스펙 — 옛 위치 기준 해석 → 새 위치 기준 재계산
		out = out.replace(/from\s*(['"])(\.[^'"]+)\1/g, (full, q, spec) => {
			const targetOld = pjoin(dirname(oldRel), spec);
			const targetNew = map.get(targetOld);
			if (!targetNew) return full;
			const myNewDir = dirname(newRel ?? oldRel);
			const rewritten =
				norm(dirname(targetNew)) === norm(myNewDir)
					? `./${basename(targetNew)}`
					: `$lib/components/${subOf(targetNew)}`;
			return `from ${q}${rewritten}${q}`;
		});
		return out;
	}
	let rewriteFiles = 0;
	for (const f of files) {
		const newSelf = map.get(f.rel) ?? f.rel;
		if (rewriteContent(f.content, f.rel, newSelf) !== f.content) rewriteFiles++;
	}

	// 3) 플랜 출력
	const apply = args.has('--apply');
	if (args.has('--json') && !apply) {
		console.log(JSON.stringify({ kit: KIT_VERSION, moves, deletes, rewriteFiles }, null, 2));
		return 0;
	}
	console.log(`# arch-plan · kit v${KIT_VERSION} — 이동/리네임 ${moves.length} · 배럴 삭제 ${deletes.length} · 임포트 재작성 ${rewriteFiles}파일\n`);
	const byGroup = Map.groupBy(moves, (m) => subOf(m.to).split('/')[0]);
	for (const [g, list] of [...byGroup].sort()) {
		console.log(`## ${g} (${list.length})`);
		const show = args.has('--full') ? list : list.slice(0, 6);
		for (const m of show) console.log(`  ${subOf(m.from)}  →  ${subOf(m.to)}`);
		if (list.length > show.length) console.log(`  … ${list.length - show.length}건 더 (--full)`);
	}
	for (const d of deletes) console.log(`## 삭제(배럴): ${d}`);
	for (const s of skipped) console.log(`## ⚠ 건너뜀(대상 존재 — 수동 병합): ${subOf(s.from)} ↛ ${subOf(s.to)}`);

	if (!apply) {
		console.log(`\n실행 전 확인 — 적용은: bun run arch:plan -- --apply  (완전히 깨끗한 작업트리 필수, 롤백=git)`);
		return 0;
	}

	// 4) 적용 게이트 — 구조 변경이므로 staged/unstaged 변경이 1개라도 있으면 거부 (강행 플래그 없음)
	try {
		const dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
		if (dirty) {
			console.error(`✗ 거부 — 작업트리에 변경 ${dirty.split('\n').length}개 존재. 구조 이행은 완전히 깨끗한 트리에서만:`);
			console.error(dirty.split('\n').slice(0, 8).map((l) => `   ${l}`).join('\n'));
			console.error(`   → 커밋 또는 스태시 후 재실행하세요.`);
			return 1;
		}
	} catch {
		console.error('✗ 거부 — git 저장소가 아님. plan --apply 는 git 이 롤백 수단이라 필수.');
		return 1;
	}

	// 5) 적용 — 이동 → 삭제 → 임포트 재작성 (멱등: 재실행 시 이동 대상 0)
	const { rename, unlink } = await import('node:fs/promises');
	for (const m of moves) {
		await mkdir(join(ROOT, dirname(m.to)), { recursive: true });
		await rename(join(ROOT, m.from), join(ROOT, m.to));
	}
	for (const d of deletes) await unlink(join(ROOT, d));
	// 이동 후 남은 빈 디렉토리(구 composite/<d>/ 등) 상향식 제거
	const { rmdir } = await import('node:fs/promises');
	async function pruneEmpty(dir) {
		let entries;
		try {
			entries = await readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const e of entries) if (e.isDirectory()) await pruneEmpty(join(dir, e.name));
		try {
			if ((await readdir(dir)).length === 0) await rmdir(dir);
		} catch {
			/* 사용 중이면 유지 */
		}
	}
	await pruneEmpty(join(ROOT, COMPONENTS, 'composite'));
	let rewritten = 0;
	const deleteSet = new Set(deletes);
	for (const f of files) {
		if (deleteSet.has(f.rel)) continue; // 삭제된 배럴을 재작성으로 되살리지 않기
		const newSelf = map.get(f.rel) ?? f.rel;
		const next = rewriteContent(f.content, f.rel, newSelf);
		if (next !== f.content) {
			await writeFile(join(ROOT, newSelf), next, 'utf-8');
			rewritten++;
		}
	}
	console.log(`\n✓ 적용 완료 — 이동 ${moves.length} · 삭제 ${deletes.length} · 재작성 ${rewritten}파일`);
	console.log(`다음: svelte-check(bun run check 등) → bun run arch:audit → git diff 리뷰 → 커밋`);
	return 0;
}

// ── 엔트리 ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
	const map = new Map();
	for (let i = 0; i < argv.length; i++) {
		if (argv[i].startsWith('--')) {
			const next = argv[i + 1];
			if (argv[i] === '--files') {
				map.set('--files', argv.slice(i + 1).filter((x) => !x.startsWith('--')));
				i += map.get('--files').length;
			} else if (next && !next.startsWith('--')) {
				map.set(argv[i], next);
				i++;
			} else map.set(argv[i], true);
		}
	}
	return {
		get: (k) => (typeof map.get(k) === 'string' ? map.get(k) : undefined),
		getList: (k) => (Array.isArray(map.get(k)) ? map.get(k) : undefined),
		has: (k) => map.has(k)
	};
}

async function main() {
	const [cmd, ...rest] = process.argv.slice(2);
	if (cmd === 'version' || cmd === '--version') {
		console.log(`arch kit v${KIT_VERSION}`);
		return 0;
	}
	if (!existsSync(join(ROOT, 'src'))) {
		console.error('✗ 프로젝트 루트(src/ 보유)에서 실행하세요 — cwd:', ROOT);
		return 2;
	}
	const config = await loadConfig();
	const args = parseArgs(rest);
	const positionals = rest.filter((a) => !a.startsWith('--'));
	if (cmd === 'manifest') return runManifest(args, config);
	if (cmd === 'audit') return runAudit(args, config);
	if (cmd === 'analyze') return runAnalyze(args, config);
	if (cmd === 'new') return runNew(positionals);
	if (cmd === 'plan') return runPlan(args);
	console.error('사용법: arch.mjs <manifest|audit|analyze|new|plan|version> [옵션]');
	return 2;
}

process.exit(await main());
