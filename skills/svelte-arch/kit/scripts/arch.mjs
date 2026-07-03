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
 *   bun scripts/arch.mjs version
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const KIT_VERSION = '3.0.0';
const ROOT = process.cwd();
const COMPONENTS = 'src/lib/components';

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

async function runAudit(args, config) {
	const filesArg = args.getList('--files');
	let files = await collectFiles();
	for (const f of files) f.lines = f.content.split('\n');

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
	if (cmd === 'manifest') return runManifest(args, config);
	if (cmd === 'audit') return runAudit(args, config);
	console.error('사용법: arch.mjs <manifest|audit|version> [옵션]');
	return 2;
}

process.exit(await main());
