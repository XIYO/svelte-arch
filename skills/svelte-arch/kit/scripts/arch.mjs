#!/usr/bin/env bun
/**
 * arch.mjs — SvelteKit × FSD 2.1 아키텍처 CLI (svelte-arch kit v4)
 *
 * ⚠ kit-owned — 직접 수정 금지. 업데이트(init 재실행) 시 덮어써진다.
 *    프로젝트 확장(룰·allowlist·중립 리터럴·pages 개방)은 .svelte-arch/config.mjs 에.
 *
 * 사용:
 *   bun arch.mjs manifest [--slice <이름|계층/이름>] [--detail <Base>] [--json]
 *   bun arch.mjs audit    [--files <p...>] [--json]
 *   bun arch.mjs analyze  [--json]
 *   bun arch.mjs new <shared-ui|entity|feature|widget|set|service|repository|adapter> …
 *   bun arch.mjs plan     [--apply] [--full] [--json]   # 구 구조 → FSD 이행 (승인 후에만 --apply)
 *   bun arch.mjs version
 */

import { readdir, readFile, writeFile, mkdir, rename, unlink, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, basename, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const KIT_VERSION = '4.2.1';
const ROOT = process.cwd();
const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = [join(SELF_DIR, 'templates'), join(SELF_DIR, '../templates')].find((d) => existsSync(d));

const LAYERS = ['shared', 'entities', 'features', 'widgets', 'pages', 'app']; // 랭크 순 (낮음→높음)
const SLICED = ['entities', 'features', 'widgets', 'pages'];
const SEGMENTS = ['ui', 'api', 'model', 'lib', 'config'];
const SHARED_SEGMENTS = ['ui', 'vendor', 'lib', 'model', 'config'];
const rank = (layer) => LAYERS.indexOf(layer);
const norm = (p) => p.replaceAll('\\', '/');

// ── config ───────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
	layers: { pages: false },
	neutralLiterals: ['확인', '취소', '닫기', '저장', '삭제', '검색', '선택', '목록으로', '미리보기', '로딩 중…', '불러오는 중…', '검색 결과가 없습니다'],
	allow: { crossSlice: [], liveOutsideGlue: [] },
	// 서버 인프라 slice 선언 — 여기 등재된 slice는 CROSS_SLICE_SERVER_IMPORT의 대상(target) 면제.
	// 코어 면제(shared·database·auth)에 더해진다. 도메인 어휘 없는 서버 전용 엔진(llm·crypto·email 등)용.
	serverInfraSlices: [],
	heavyReexportMax: 12,
	rules: []
};

async function loadConfig() {
	const p = join(ROOT, '.svelte-arch/config.mjs');
	if (!existsSync(p)) return DEFAULT_CONFIG;
	const c = (await import(pathToFileURL(p).href)).default ?? {};
	return {
		...DEFAULT_CONFIG, ...c,
		layers: { ...DEFAULT_CONFIG.layers, ...(c.layers ?? {}) },
		allow: { ...DEFAULT_CONFIG.allow, ...(c.allow ?? {}) }
	};
}

// ── 파일 수집 · 주소(locate) · 종별(kindOf) ──────────────────────────────
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

/** 4단 주소: { area: client|server|routes|app|other, layer, slice, segment, vendor } */
function locate(rel) {
	const parts = norm(rel).split('/');
	if (parts[0] !== 'src') return { area: 'other' };
	const l1 = parts[1];
	if (l1 === 'server') {
		const slice = parts.length > 3 ? parts[2] : null; // src/server/<slice>/file (루트 직파일은 slice null)
		return { area: 'server', slice };
	}
	if (l1 === 'app') {
		if (parts[2] === 'routes') return { area: 'routes' };
		return { area: 'app' };
	}
	if (LAYERS.includes(l1)) {
		if (l1 === 'shared') {
			const segment = parts.length > 3 ? parts[2] : (parts.length === 3 && !parts[2].includes('.') ? parts[2] : parts.length > 2 && SHARED_SEGMENTS.includes(parts[2]) ? parts[2] : null);
			return { area: 'client', layer: 'shared', slice: 'shared', segment: SHARED_SEGMENTS.includes(parts[2]) ? parts[2] : null, vendor: parts[2] === 'vendor' };
		}
		const slice = parts.length > 3 ? parts[2] : null;
		const segment = parts.length > 4 ? parts[3] : null;
		return { area: 'client', layer: l1, slice, segment };
	}
	return { area: 'other' };
}

function kindOf(rel) {
	const b = basename(norm(rel));
	const loc = locate(rel);
	if (loc.vendor) return b.endsWith('.svelte') ? 'vendor-svelte' : 'vendor-ts';
	if (/^\+(page|layout|error)(@[^.]*)?\.svelte$/.test(b)) return 'glue';
	if (/^\+(page|layout)\.server\.(ts|js)$/.test(b)) return 'glue-server';
	if (/^\+(page|layout)\.(ts|js)$/.test(b)) return 'glue-universal';
	if (/^\+server\.(ts|js)$/.test(b)) return 'endpoint';
	if (/^hooks(\.server|\.client)?\.(ts|js)$/.test(b)) return 'hooks';
	if (b.endsWith('.stories.svelte')) return 'stories';
	if (b.endsWith('.spec.ts') || b.endsWith('.test.ts')) return 'spec';
	if (b.endsWith('.view.svelte')) return 'view';
	if (b.endsWith('.live.svelte')) return 'live';
	if (b.endsWith('.svelte')) return 'unmarked-svelte';
	if (b.endsWith('.svelte.ts')) return 'state';
	if (b.endsWith('.remote.ts')) return 'remote';
	if (b.endsWith('.service.ts')) return 'service';
	if (b.endsWith('.repository.ts')) return 'repository';
	if (b.endsWith('.adapter.ts')) return 'adapter';
	if (b.endsWith('.guard.ts')) return 'guard';
	if (b.endsWith('.schema.ts')) return 'schema';
	if (b.endsWith('.config.ts')) return 'config';
	if (b.endsWith('.util.ts')) return 'util';
	if (b === 'types.ts' || b.endsWith('.types.ts')) return 'types';
	if (b === 'index.ts' || b === 'index.js') return 'barrel';
	if (b.endsWith('.d.ts')) return 'dts';
	if (/\.(ts|js)$/.test(b)) return 'unmarked-ts';
	return 'asset';
}

function baseOf(rel) {
	return basename(norm(rel)).replace(/\.(view|live|stories)\.svelte$|\.svelte\.spec\.ts$|\.spec\.ts$|\.test\.ts$|\.svelte$/, '');
}

async function collectFiles() {
	const files = [];
	for await (const abs of walk(join(ROOT, 'src'))) {
		const rel = norm(relative(ROOT, abs));
		if (!/\.(svelte|ts|js|tsx)$/.test(rel)) continue;
		const loc = locate(rel);
		files.push({ abs, rel, loc, kind: kindOf(rel), content: await readFile(abs, 'utf-8') });
	}
	for (const f of files) f.lines = f.content.split('\n');
	return files;
}

function isLegacyTree() {
	return existsSync(join(ROOT, 'src/lib/components')) || existsSync(join(ROOT, 'src/lib/server')) ||
		(existsSync(join(ROOT, 'src/routes')) && !existsSync(join(ROOT, 'src/app/routes')));
}

function legacyNotice(cmd) {
	console.log(`⚠ 구(비-FSD) 구조 감지 — ${cmd}는 FSD 좌표계 전제라 룰을 돌리지 않습니다.`);
	console.log(`  이행 절차: ① bun run arch:plan (제안표) → ② 사용자 승인 + plan-overrides.json 조정 → ③ bun run arch:plan -- --apply`);
	console.log(`  상세 = svelte-arch 스킬 references/adoption.md (svelte.config 수술 포함)`);
}

// ── 임포트 그래프 (배럴 투명 해석 — 상대·@/·$lib/ 전부 resolve) ──────────
function resolveSpec(spec, importerRel, fileSet) {
	let p = null;
	if (spec.startsWith('@/')) p = 'src/' + spec.slice(2);
	else if (spec.startsWith('$lib/')) p = 'src/' + spec.slice(5); // v4: lib=src
	else if (spec === '$lib') p = 'src';
	else if (spec.startsWith('./') || spec.startsWith('../')) {
		const segs = (dirname(importerRel) + '/' + spec).split('/');
		const out = [];
		for (const s of segs) {
			if (s === '' || s === '.') continue;
			if (s === '..') out.pop(); else out.push(s);
		}
		p = out.join('/');
	} else return null; // 외부 패키지·$app 등
	const cands = [p, p + '.ts', p + '.js', p.replace(/\.js$/, '.ts'), p + '/index.ts', p + '/index.js'];
	for (const c of cands) if (fileSet.has(c)) return c;
	return null;
}

/** index.ts 재수출 맵: exportedName → { target(rel), typeOnly } */
function parseBarrel(f, fileSet) {
	const map = new Map();
	for (const m of f.content.matchAll(/export\s+(type\s+)?(?:\{([^}]+)\}|(\*))\s+from\s+['"]([^'"]+)['"]/g)) {
		const typeOnly = !!m[1];
		const target = resolveSpec(m[4], f.rel, fileSet);
		if (!target) continue;
		if (m[3] === '*') { map.set('*' + target, { target, typeOnly, star: true }); continue; }
		for (const entryRaw of m[2].split(',')) {
			const entry = entryRaw.trim();
			if (!entry) continue;
			const em = entry.match(/^(?:type\s+)?(?:default\s+as\s+(\w+)|(\w+)(?:\s+as\s+(\w+))?)$/);
			if (!em) continue;
			const name = em[1] ?? em[3] ?? em[2];
			map.set(name, { target, typeOnly: typeOnly || /^type\s/.test(entry) });
		}
	}
	return map;
}

/** edges: { from, to, typeOnly, line, spec, viaIndex } — 배럴 named import는 실파일로 확장 */
function buildGraph(files) {
	const fileSet = new Map(files.map((f) => [f.rel, f]));
	const barrels = new Map();
	for (const f of files) if (f.kind === 'barrel') barrels.set(f.rel, parseBarrel(f, fileSet));
	// star 재수출(export * from) 해석용 — 모듈이 export하는 이름 집합 (배럴 체인 재귀, 순환 가드)
	const exportNamesCache = new Map();
	function exportedNames(rel, seen = new Set()) {
		if (exportNamesCache.has(rel)) return exportNamesCache.get(rel);
		if (seen.has(rel)) return new Set();
		seen.add(rel);
		const f = fileSet.get(rel);
		const names = new Set();
		if (f) {
			for (const m of f.content.matchAll(/^\s*export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
			for (const m of f.content.matchAll(/^\s*export\s+(?:type\s+)?\{([^}]*)\}/gm))
				for (const raw of m[1].split(',')) {
					const em = raw.trim().match(/^(?:type\s+)?(?:default\s+as\s+([\w$]+)|([\w$]+)(?:\s+as\s+([\w$]+))?)$/);
					if (em) names.add(em[1] ?? em[3] ?? em[2]);
				}
			if (/^\s*export\s+default\b/m.test(f.content)) names.add('default');
			for (const m of f.content.matchAll(/export\s+(?:type\s+)?\*\s+from\s+['"]([^'"]+)['"]/g)) {
				const t = resolveSpec(m[1], rel, fileSet);
				if (t) for (const n of exportedNames(t, seen)) names.add(n);
			}
		}
		exportNamesCache.set(rel, names);
		return names;
	}
	const edges = [];
	// 문장 단위 매칭 — 여러 줄 import(포매터 개행)도 그래프에 잡히도록 content 전체를 스캔.
	// clause 문자 클래스가 식별자·중괄호·콤마·공백만 허용해 `export const x = 1` 등 from 없는 문장을 넘어 삼키지 않는다.
	const IMPORT_RE = /^[ \t]*(import|export)\s+(type\s+)?([\w$*,{}\s]+?)\s+from\s+['"]([^'"]+)['"]/gm;
	for (const f of files) {
		f.lines.forEach((line, i) => {
			const side = line.match(/^\s*import\s+['"]([^'"]+)['"]/); // side-effect import
			if (side) {
				const t = resolveSpec(side[1], f.rel, fileSet);
				if (t && t !== f.rel) edges.push({ from: f, to: fileSet.get(t), typeOnly: false, line: i + 1, spec: side[1] });
			}
		});
		for (const m of f.content.matchAll(IMPORT_RE)) {
			const i = f.content.slice(0, m.index).split('\n').length - 1; // 문장 시작 라인(0-based)
			const [, , typeKw, clauseRaw, spec] = m;
			const clause = clauseRaw.replace(/\s+/g, ' ').trim();
			const typeOnly = !!typeKw;
			const target = resolveSpec(spec, f.rel, fileSet);
			if (!target || target === f.rel) { edges.push({ from: f, to: null, typeOnly, line: i + 1, spec, clause }); continue; }
			const tf = fileSet.get(target);
			edges.push({ from: f, to: tf, typeOnly, line: i + 1, spec, clause });
			// 배럴 투명화 — named import를 실파일 가상 엣지로 확장.
			// star 재수출은 대상 모듈의 export 이름 조회로 해석하고, typeOnly는 지정자 단위
			// (인라인 `type X`·`export type` 재수출 포함 — 같은 실파일로 값·타입이 섞이면 값 우선).
			const bmap = barrels.get(target);
			if (bmap) {
				const raws = [...(clause.match(/\{([^}]*)\}/)?.[1] ?? '').split(',')].map((s) => s.trim()).filter(Boolean);
				const expand = new Map(); // target rel → typeOnly
				if (clause.includes('* as')) {
					for (const v2 of bmap.values()) expand.set(v2.target, typeOnly);
				} else {
					for (const raw of raws) {
						const inlineType = /^type\s/.test(raw);
						const name = raw.replace(/^type\s+/, '').replace(/\s+as\s+[\w$]+$/, '');
						let entry = bmap.get(name);
						if (!entry) for (const v2 of bmap.values()) if (v2.star && exportedNames(v2.target).has(name)) { entry = v2; break; }
						if (!entry) continue;
						const eType = typeOnly || inlineType || !!entry.typeOnly;
						expand.set(entry.target, expand.has(entry.target) ? expand.get(entry.target) && eType : eType);
					}
				}
				for (const [t2, eType] of expand) {
					const tf2 = fileSet.get(t2);
					if (tf2 && tf2.rel !== f.rel) edges.push({ from: f, to: tf2, typeOnly: eType, line: i + 1, spec, viaIndex: true });
				}
			}
		}
	}
	return { edges, fileSet, barrels };
}

function buildConsumerMap(files, edges) {
	const map = new Map(files.map((f) => [f.rel, new Set()]));
	// 배럴의 재수출은 소비가 아니다 — 실소비자만 집계 (고아·INSIGNIFICANT 오탐 방지)
	for (const e of edges) if (e.to && !e.typeOnly && e.from.kind !== 'barrel') map.get(e.to.rel)?.add(e.from.rel);
	return map;
}

// ── 컴포넌트 메타 추출 (v3 계승 + 로컬 타입 별칭 인용) ───────────────────
function extractDoc(content) {
	const m = content.match(/<!--\s*@component([\s\S]*?)-->/);
	if (!m) return { role: '', usage: '' };
	const lines = m[1].split('\n').map((l) => l.trim()).filter(Boolean);
	const usage = lines.find((l) => l.startsWith('사용:') || l.startsWith('<'));
	return { role: lines.find((l) => l !== usage) ?? '', usage: usage ?? '' };
}

function extractProps(content) {
	const anchor = content.match(/(?:type|interface)\s+Props\b[^={]*[={]/);
	if (!anchor) return null;
	const start = content.indexOf(anchor[0]) + anchor[0].length - 1;
	let i = content.indexOf('{', anchor[0].endsWith('{') ? start : start);
	if (i === -1) return null;
	const prefix = content.slice(content.indexOf(anchor[0]) + anchor[0].length - 1, i).replace(/[=&\s]+/g, ' ').trim();
	let depth = 0, end = -1;
	for (let j = i; j < content.length; j++) {
		if (content[j] === '{') depth++;
		else if (content[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
	}
	if (end === -1) return null;
	const inner = content.slice(i + 1, end).replace(/\/\/[^\n]*/g, '').replace(/\/\*(?!\*)[\s\S]*?\*\//g, '');
	const raw = content.slice(content.indexOf(anchor[0]), end + 1);
	const irregular = /\{/.test(inner);
	const members = [];
	if (!irregular) {
		const re = /(?:\/\*\*([\s\S]*?)\*\/\s*)?([A-Za-z_$][\w$]*)(\?)?\s*:\s*([^;\n]+)[;\n]/g;
		let m;
		while ((m = re.exec(inner)) !== null) {
			members.push({
				doc: (m[1] ?? '').replace(/^[\s*]+/gm, '').trim().split('\n')[0] ?? '',
				deprecated: /@deprecated/.test(m[1] ?? ''), name: m[2], optional: !!m[3], type: m[4].trim()
			});
		}
	}
	const defaults = new Map(); const bindables = new Set(); let rest = null;
	const dm = content.match(/(?:let|const)\s*\{([\s\S]*?)\}\s*(?::\s*\w+)?\s*=\s*\$props\(\)/);
	if (dm) {
		for (const entryRaw of splitTopLevel(dm[1], ',')) {
			const entry = entryRaw.trim();
			if (!entry) continue;
			if (entry.startsWith('...')) { rest = entry.slice(3).trim(); continue; }
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
	// 로컬 타입 별칭 인용 — variant 값 불투명 방지
	const aliases = new Map();
	for (const am of content.matchAll(/^\s*(?:export\s+)?type\s+(\w+)\s*=\s*([^\n;]+);?\s*$/gm)) {
		if (am[1] !== 'Props') aliases.set(am[1], am[2].trim());
	}
	const usedAliases = [...aliases.keys()].filter((a) => members.some((m) => new RegExp(`\\b${a}\\b`).test(m.type)));
	return { raw, prefix, irregular, members, defaults, bindables, rest, aliases, usedAliases };
}

/** export interface 원문 추출 — 중괄호 밸런스 스캔 (한 줄 바디·중첩 객체 안전) */
function extractInterfaces(content) {
	const out = [];
	const re = /export\s+interface\s+\w+[^{]*\{/g;
	let m;
	while ((m = re.exec(content)) !== null) {
		let depth = 0, end = -1;
		for (let j = m.index + m[0].length - 1; j < content.length; j++) {
			if (content[j] === '{') depth++;
			else if (content[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
		}
		if (end !== -1) { out.push(content.slice(m.index, end + 1)); re.lastIndex = end + 1; }
	}
	return out;
}

/** TSDoc 블록 원문 → 장식(*) 벗긴 첫 유효 행 */
const docFirstLine = (raw) => (raw ?? '').split('\n').map((s) => s.replace(/^[\s*]+/, '').trim()).filter(Boolean)[0] ?? '';

function splitTopLevel(s, sep) {
	const out = []; let depth = 0, cur = '';
	for (const ch of s) {
		if ('([{'.includes(ch)) depth++;
		else if (')]}'.includes(ch)) depth--;
		if (ch === sep && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
	}
	out.push(cur);
	return out;
}

const classifyMember = (m, bindables) =>
	bindables.has(m.name) ? '양방향' : /\bSnippet\b/.test(m.type) ? '스니펫' : /^on[A-Z]/.test(m.name) && m.type.includes('=>') ? '콜백' : '주입';

function renderDetail(f, consumers, files, indent = '') {
	const base = baseOf(f.rel);
	const { role, usage } = extractDoc(f.content);
	const props = extractProps(f.content);
	const hasStory = files.some((x) => (x.kind === 'stories' || x.kind === 'spec') && baseOf(x.rel) === base);
	const where = f.loc.layer === 'shared' ? 'shared/ui' : `${f.loc.layer}/${f.loc.slice}`;
	const lines = [`${indent}### ${base} · ${where} · 소비 ${consumers.get(f.rel)?.size ?? 0}곳${hasStory ? ' · 📖' : ''}`];
	lines.push(`${indent}${role || '(역할 주석 없음 — @component 헤더 필요)'}`);
	if (usage) lines.push(`${indent}${usage.startsWith('사용:') ? usage : `사용: ${usage}`}`);
	if (!props) { lines.push(`${indent}⚠ Props 명명 선언 없음 (type Props 앵커 필요)`); return lines; }
	if (props.irregular) {
		lines.push(`${indent}⚠비정형 — Props 원문:`, ...props.raw.split('\n').map((l) => indent + l));
		return lines;
	}
	const byClass = { 주입: [], 양방향: [], 콜백: [], 스니펫: [] };
	for (const m of props.members) {
		const def = props.defaults.has(m.name) ? ` = ${props.defaults.get(m.name)}` : '';
		const req = !m.optional && !props.defaults.has(m.name) ? ' (필수)' : '';
		byClass[classifyMember(m, props.bindables)].push(
			`${m.name}${m.optional ? '?' : ''}: ${m.type}${def}${req}${m.deprecated ? ' ⛔폐기예정' : ''}${m.doc ? ` — ${m.doc}` : ''}`
		);
	}
	for (const [label, items] of Object.entries(byClass))
		if (items.length) lines.push(`${indent}${label.padEnd(3, '　')} ${items.join(`\n${indent}     `)}`);
	for (const a of props.usedAliases) lines.push(`${indent}타입   ${a} = ${props.aliases.get(a)}`);
	if (props.rest || props.prefix) lines.push(`${indent}통과   ${props.prefix || ''}${props.rest ? ` (...${props.rest})` : ''}`.trimEnd());
	return lines;
}

async function claudeFirstLine(dir) {
	try {
		const c = await readFile(join(dir, 'CLAUDE.md'), 'utf-8');
		// 구분자는 em-dash(—)만 — ASCII 하이픈을 자르면 kebab-case slice명(A7 의무)이 붕괴한다
		return c.split('\n')[0]?.replace(/^#\s*[^—]*—\s*/, '').replace(/^#\s*/, '').trim() ?? '';
	} catch { return ''; }
}

async function readPkgName() {
	try { return JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf-8')).name ?? '(이름없음)'; } catch { return '(이름없음)'; }
}

function slicesOf(files, layer) {
	const set = new Map(); // slice → files
	for (const f of files) {
		if (f.loc.area !== 'client' || f.loc.layer !== layer || !f.loc.slice || f.loc.slice === 'shared') continue;
		(set.get(f.loc.slice) ?? set.set(f.loc.slice, []).get(f.loc.slice)).push(f);
	}
	return set;
}

// ── manifest ─────────────────────────────────────────────────────────────
async function runManifest(args, config, files) {
	const { edges } = buildGraph(files);
	const consumers = buildConsumerMap(files, edges);
	const sharedUi = files.filter((f) => f.kind === 'view' && f.loc.layer === 'shared' && f.loc.segment === 'ui');
	const layerSlices = Object.fromEntries(SLICED.map((l) => [l, slicesOf(files, l)]));
	const serverSlices = new Map();
	for (const f of files) if (f.loc.area === 'server' && f.loc.slice) (serverSlices.get(f.loc.slice) ?? serverSlices.set(f.loc.slice, []).get(f.loc.slice)).push(f);
	const pkgName = await readPkgName();

	if (args.has('--json')) {
		console.log(JSON.stringify({
			kit: KIT_VERSION, project: pkgName,
			sharedUi: sharedUi.map((f) => ({ rel: f.rel, base: baseOf(f.rel), consumers: consumers.get(f.rel)?.size ?? 0 })),
			slices: Object.fromEntries(SLICED.map((l) => [l, [...layerSlices[l].keys()]])),
			server: [...serverSlices.keys()]
		}, null, 2));
		return 0;
	}

	const out = [];
	const counts = SLICED.map((l) => `${l} ${layerSlices[l].size}`).join(' · ');
	out.push(`# arch-manifest · kit v${KIT_VERSION} · ${pkgName} · shared/ui ${sharedUi.length} · ${counts} · server ${serverSlices.size}`);

	const detail = args.get('--detail');
	if (detail) {
		const f = files.find((x) => ['view', 'live'].includes(x.kind) && baseOf(x.rel) === detail);
		if (!f) { console.error(`✗ '${detail}' 컴포넌트를 찾지 못함`); return 1; }
		out.push('', ...renderDetail(f, consumers, files));
		console.log(out.join('\n'));
		return 0;
	}

	const sliceQ = args.get('--slice');
	if (sliceQ) {
		const [qLayer, qName] = sliceQ.includes('/') ? sliceQ.split('/') : [null, sliceQ];
		const sharedModelRefs = new Set(); // 별첨 5: remote가 참조하는 shared/model 파일
		for (const l of SLICED) {
			if (qLayer && l !== qLayer) continue;
			for (const [slice, sfiles] of layerSlices[l]) {
				if (!slice.includes(qName)) continue;
				out.push('', `## ${l}/${slice} — ${(await claudeFirstLine(join(ROOT, 'src', l, slice))) || '(CLAUDE.md 1행 없음)'}`);
				for (const f of sfiles.filter((x) => x.kind === 'view')) out.push('', ...renderDetail(f, consumers, files));
				for (const f of sfiles.filter((x) => x.kind === 'remote')) {
					out.push('', `### api/${basename(f.rel)} — remote 시그니처`);
					for (const m of f.content.matchAll(/export\s+const\s+(\w+)\s*=\s*(query|command|form|prerender)/g)) out.push(`${m[1]} · ${m[2]}`);
					for (const it of extractInterfaces(f.content)) out.push(it);
					for (const e2 of edges) if (e2.from.rel === f.rel && e2.to?.loc.layer === 'shared' && e2.to.loc.segment === 'model') sharedModelRefs.add(e2.to.rel);
				}
				for (const f of sfiles.filter((x) => x.kind === 'types')) out.push('', `### model/${basename(f.rel)} — wire 타입 원문`, f.content.trim());
			}
		}
		for (const [slice, sfiles] of serverSlices) {
			if (!slice.includes(qName)) continue;
			out.push('', `## server/${slice} — 서버 API`);
			for (const f of sfiles.filter((x) => ['service', 'repository'].includes(x.kind))) {
				out.push(`### ${basename(f.rel)}`);
				// TSDoc 그룹은 tempered — 내부에 */ 금지라 파일 헤더 블록코멘트가 함수 doc을 삼키지(브리지) 못한다
				for (const m of f.content.matchAll(/(?:\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*)?export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(:\s*[^{]+)?/g)) {
					const d = docFirstLine(m[1]);
					out.push(`${m[2]}(${m[3].replaceAll('\n', ' ').trim()})${(m[4] ?? '').trim()}${d ? ` — ${d}` : ''}`);
				}
				for (const m of f.content.matchAll(/(?:\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*)?export\s+const\s+(\w+)\s*=/g)) {
					const d = docFirstLine(m[1]);
					out.push(`${m[2]} (const)${d ? ` — ${d}` : ''}`);
				}
			}
		}
		for (const rel of [...sharedModelRefs].sort()) {
			const mf = files.find((x) => x.rel === rel);
			if (mf) out.push('', `### ${rel} — shared/model 참조 원문 (remote 경유 별첨)`, mf.content.trim());
		}
		console.log(out.join('\n'));
		return 0;
	}

	// 기본: shared/ui 상세 + 전 계층 slice 1줄
	out.push('', '## shared/ui');
	const sets = new Map(); const flat = [];
	for (const f of sharedUi) {
		const sm = norm(f.rel).match(/shared\/ui\/([^/]+)\/[^/]+$/);
		if (sm && sm[1] !== 'icons') (sets.get(sm[1]) ?? sets.set(sm[1], []).get(sm[1])).push(f);
		else flat.push(f);
	}
	for (const f of flat.sort((a, b) => baseOf(a.rel).localeCompare(baseOf(b.rel)))) out.push('', ...renderDetail(f, consumers, files));
	for (const [set, parts] of sets) {
		const root = parts.find((p) => /Root/.test(p.rel)) ?? parts[0];
		out.push('', `### ${set} (세트) · 부품 ${parts.length}`, extractDoc(root.content).role || '(역할 주석 없음)');
		for (const p of parts) out.push(...renderDetail(p, consumers, files, '  '));
	}
	for (const l of SLICED) {
		if (!layerSlices[l].size) continue;
		out.push('', `## ${l}`);
		for (const [slice, sfiles] of [...layerSlices[l]].sort()) {
			const views = sfiles.filter((x) => x.kind === 'view').length;
			const lives = sfiles.filter((x) => x.kind === 'live').length;
			const hasStory = sfiles.some((x) => ['stories', 'spec'].includes(x.kind));
			const one = await claudeFirstLine(join(ROOT, 'src', l, slice));
			const consumed = new Set(sfiles.flatMap((x) => [...(consumers.get(x.rel) ?? [])])).size;
			out.push(`${slice} · view ${views}${lives ? ` · ⚡live ${lives}` : ''}${hasStory ? ' · 📖' : ''} · ${one || '(CLAUDE.md 1행 없음)'} · 소비 ${consumed}곳`);
		}
	}
	if (serverSlices.size) out.push('', `## server — ${[...serverSlices.keys()].sort().join(' · ')} (상세는 --slice <이름>)`);
	console.log(out.join('\n'));
	return 0;
}

// ── audit — 50룰 ─────────────────────────────────────────────────────────
const v = (f, line, match, code, severity, desc) => ({ file: typeof f === 'string' ? f : f.rel, line, match: String(match).slice(0, 110), code, severity, desc });
const TEAM_SVELTE = new Set(['view', 'live', 'glue']);

async function collectViolations(files, config, filesArg = null) {
	const { edges, fileSet, barrels } = buildGraph(files);
	const consumers = buildConsumerMap(files, edges);
	const out = [];
	const inScope = (f) => !filesArg?.length || filesArg.some((t) => norm(t) === f.rel || norm(t).endsWith(f.rel));
	const push = (viol) => { const f = files.find((x) => x.rel === viol.file); if (!f || inScope(f)) out.push(viol); };

	// ── 엣지 기반 룰 ──
	for (const e of edges) {
		const F = e.from, T = e.to, fl = F.loc, tl = T?.loc;
		const spec = e.spec ?? '';
		// 외부 스펙 기반
		if (!T) {
			if (/^\$app\/(state|navigation)$/.test(spec) && F.kind === 'view' && !e.typeOnly)
				push(v(F, e.line, spec, 'APP_STATE_IN_VIEW', 'error', 'view의 $app/state·navigation — 외부 정본은 prop 주입 (live·글루 소관)'));
			if (/^(clsx|classnames|tailwind-merge|tw-merge|tailwind-variants)$/.test(spec) && (TEAM_SVELTE.has(F.kind) || ['state', 'util'].includes(F.kind)) && !fl.vendor)
				push(v(F, e.line, spec, 'CLASS_MERGE_IMPORT', 'error', '클래스 합성 유틸 import — 내장 class={[...]} 배열만 (vendor 내부만 예외)'));
			if (/^\$app\//.test(spec) && ['service', 'repository'].includes(F.kind))
				push(v(F, e.line, spec, 'SERVICE_SVELTEKIT_IMPORT', 'error', 'service·repository의 SvelteKit import 금지 ($env는 허용)'));
			if (spec === '@sveltejs/kit' && ['service', 'repository'].includes(F.kind) && !e.typeOnly)
				push(v(F, e.line, spec, 'SERVICE_SVELTEKIT_IMPORT', 'error', 'service·repository의 SvelteKit import 금지'));
			if (/^\$app\//.test(spec) && F.kind === 'util')
				push(v(F, e.line, spec, 'IMPURE_UTIL', 'error', 'util은 순수 함수 — $app/* 금지'));
			if (/^(drizzle-orm)/.test(spec) && F.kind === 'remote' && !e.typeOnly)
				push(v(F, e.line, spec, 'REMOTE_DB_IMPORT', 'error', 'remote의 db 직접 접근 — service 경유'));
			if (fl.layer === 'shared' && !fl.vendor && /^\$app\/(state|navigation)/.test(spec) && !e.typeOnly)
				push(v(F, e.line, spec, 'SHARED_UI_PURITY', 'error', 'shared의 $app/* import — 업무·앱 무지 위반'));
			continue;
		}
		// 내부 엣지
		// 계층 상향
		if (fl.area === 'client' && tl.area === 'client' && rank(tl.layer) > rank(fl.layer))
			push(v(F, e.line, spec, 'LAYER_UPWARD_IMPORT', 'error', `하위 계층(${fl.layer})이 상위 계층(${tl.layer}) import — 계층은 아래로만`));
		// 동일 계층 수평 (sliced)
		if (fl.area === 'client' && tl.area === 'client' && fl.layer === tl.layer && SLICED.includes(fl.layer) && fl.slice && tl.slice && fl.slice !== tl.slice) {
			const viaIndexType = e.typeOnly && (T.kind === 'barrel' || e.viaIndex);
			if (!viaIndexType && !config.allow.crossSlice.includes(F.rel))
				push(v(F, e.line, spec, 'CROSS_SLICE_IMPORT', 'error', `같은 계층 slice 수평 import (${fl.slice}→${tl.slice}) — 처방: 하강(entities/features/widgets) 또는 type-only(index 경유)`));
		}
		// 타 slice 딥 임포트 (index 우회)
		if (tl?.area === 'client' && SLICED.includes(tl.layer) && tl.slice && T.kind !== 'barrel' && !e.viaIndex) {
			const sameSlice = fl.area === 'client' && fl.layer === tl.layer && fl.slice === tl.slice;
			if (!sameSlice)
				push(v(F, e.line, spec, 'DEEP_IMPORT_INTO_SLICE', 'error', `타 slice 내부 직접 접근 — public API(@/${tl.layer}/${tl.slice}) 경유 의무`));
		}
		// live 소비
		if (T.kind === 'live' && F.kind !== 'glue' && !(fl.area === 'client' && fl.layer === tl?.layer && fl.slice === tl?.slice && F.kind === 'barrel') && !config.allow.liveOutsideGlue.includes(F.rel))
			push(v(F, e.line, spec, 'LIVE_IMPORT_OUTSIDE_GLUE', 'error', '.live는 글루만 마운트 — view는 Snippet으로 주입받는다'));
		// view 금지 소비
		if (F.kind === 'view' && !e.typeOnly) {
			if (T.kind === 'remote') push(v(F, e.line, spec, 'REMOTE_IN_VIEW', 'error', 'view의 remote 값 import — live 페어가 배선'));
			if (T.kind === 'state') push(v(F, e.line, spec, 'STATE_MODULE_IN_VIEW', 'error', '상태 모듈(*.svelte.ts)은 live 전용'));
		}
		// vendor
		if (tl?.vendor && !(fl.layer === 'shared' && fl.segment === 'ui') && !fl.vendor)
			push(v(F, e.line, spec, 'VENDOR_IMPORT', 'error', 'shared/vendor 소비는 shared/ui 래핑만'));
		// shared 순수성 (상향은 LAYER 룰이 잡음 — server·remote만 추가)
		if (fl.layer === 'shared' && !fl.vendor && !e.typeOnly && (tl?.area === 'server' || T.kind === 'remote'))
			push(v(F, e.line, spec, 'SHARED_UI_PURITY', 'error', 'shared의 server·remote 접근 — 업무 무지 위반'));
		// 서버 경계
		if (tl?.area === 'server' && fl.area !== 'server' && !e.typeOnly && !['remote', 'glue-server', 'endpoint', 'hooks'].includes(F.kind))
			push(v(F, e.line, spec, 'SERVER_BOUNDARY', 'error', 'src/server 값 import는 remote·글루서버·endpoint·hooks만'));
		// remote 체인
		if (F.kind === 'remote' && !e.typeOnly) {
			if (['repository', 'adapter'].includes(T.kind)) push(v(F, e.line, spec, 'REMOTE_SKIPS_SERVICE', 'error', 'remote → service만 (건너뛰기 0, 얇은 service를 감수)'));
			if (T.kind === 'schema' || norm(T.rel).includes('server/database/')) push(v(F, e.line, spec, 'REMOTE_DB_IMPORT', 'error', 'remote의 db·schema 접근 — service 경유'));
		}
		// schema 값 — adapter 포함: db 클라이언트(drizzle typed client) 조립은 adapter의 본질적 schema 소비(§3.9)
		if (T.kind === 'schema' && !e.typeOnly && !['repository', 'schema', 'adapter'].includes(F.kind))
			push(v(F, e.line, spec, 'SCHEMA_VALUE_OUTSIDE_REPOSITORY', 'error', 'schema 값 import는 repository·adapter만 (시드 포함 예외 0 — type은 자유)'));
		// server 수평 — 면제 3종: ① 인프라 slice 대상(코어 shared·database·auth + config.serverInfraSlices)
		// ② type-only ③ service→타 slice repository(§3.8 "service = 여러 repository 조합" — 도메인 규칙 소유자가
		// 데이터 접근을 조합하는 정방향). service→service·repository→repository 등 나머지 수평은 여전히 금지.
		if (fl.area === 'server' && tl?.area === 'server' && fl.slice && tl.slice && fl.slice !== tl.slice
			&& !['shared', 'database', 'auth', ...config.serverInfraSlices].includes(tl.slice) && !e.typeOnly
			&& !(F.kind === 'service' && T.kind === 'repository'))
			push(v(F, e.line, spec, 'CROSS_SLICE_SERVER_IMPORT', 'error', `서버 slice 수평 import (${fl.slice}→${tl.slice}) — service의 타 slice repository 조합만 합법, 공용 모듈은 server/shared 또는 인프라 선언(serverInfraSlices)`));
		// adapter·guard 소비자
		if (T.kind === 'adapter' && !e.typeOnly && !['service', 'repository', 'adapter'].includes(F.kind))
			push(v(F, e.line, spec, 'ADAPTER_CONSUMER', 'error', 'adapter 소비는 service·repository만'));
		if (T.kind === 'guard' && !['remote', 'glue-server', 'endpoint', 'hooks'].includes(F.kind))
			push(v(F, e.line, spec, 'GUARD_OUTSIDE_BOUNDARY', 'error', 'guard 소비는 remote·글루서버·endpoint·hooks만'));
		// 글루서버·endpoint 두께
		if (F.kind === 'glue-server' && !e.typeOnly && (['service', 'repository', 'schema', 'adapter'].includes(T.kind) || tl?.slice === 'database'))
			push(v(F, e.line, spec, 'PAGE_SERVER_DATA_FETCH', 'error', '+page.server는 가드·리디렉트·메타 전용 — 데이터는 remote로'));
		if (F.kind === 'endpoint' && !e.typeOnly && (['repository', 'schema', 'adapter'].includes(T.kind) || tl?.slice === 'database'))
			push(v(F, e.line, spec, 'ENDPOINT_THICK', 'error', '+server.ts는 guard+service 경유 의무 (db 직접 접근 포함)'));
		// 글루 로직 (remote import)
		if (F.kind === 'glue' && T.kind === 'remote' && !e.typeOnly)
			push(v(F, e.line, spec, 'GLUE_LOGIC', 'error', '글루의 remote import — 글루는 마운트·Snippet 주입·파라미터 전달만'));
		// util 순수성
		if (F.kind === 'util' && !e.typeOnly && (tl?.area === 'server' || ['remote', 'state'].includes(T.kind)))
			push(v(F, e.line, spec, 'IMPURE_UTIL', 'error', 'util은 순수 함수 — server·remote·상태 접근 금지'));
	}

	// ── 파일 단위 룰 ──
	for (const f of files) {
		if (!inScope(f)) continue;
		const loc = f.loc, kind = f.kind;
		if (kind === 'unmarked-svelte')
			out.push(v(f, 1, basename(f.rel), 'UNMARKED_COMPONENT', 'error', '무표 .svelte — .view/.live/.stories/글루로 역할 선언 (routes 콜로케이션 포함)'));
		if (kind === 'unmarked-ts' && loc.area !== 'other')
			out.push(v(f, 1, basename(f.rel), 'UNMARKED_TS', 'error', '무표 .ts — 종별 접미사(.util/.service/…·types.ts) 또는 지정 위치 필요'));
		// spec 배치 — 유닛 spec은 검증 대상과 콜로케이션(같은 폴더 동일 Base). 통합=tests/ · e2e=e2e/ (src 밖, FSD 계층 밖)
		if (kind === 'spec' && loc.area !== 'other') {
			const base = baseOf(f.rel);
			const dir = norm(dirname(f.rel));
			const paired = files.some((x) => x !== f && !['spec', 'stories'].includes(x.kind) && norm(dirname(x.rel)) === dir && (basename(x.rel) === `${base}.ts` || basename(x.rel).startsWith(`${base}.`)));
			if (!paired) out.push(v(f, 1, basename(f.rel), 'SPEC_PLACEMENT', 'error', 'src 안 spec은 검증 대상과 콜로케이션(같은 폴더 동일 Base) 의무 — 대상 없는 spec은 통합(tests/)·e2e(e2e/)로'));
		}
		if (kind === 'live') {
			if (loc.layer === 'entities') out.push(v(f, 1, basename(f.rel), 'ENTITY_UI_VIEW_ONLY', 'error', 'entities/ui는 view 전용 — live 욕구 = widget 승격 신호'));
			const pair = join(dirname(f.abs), `${baseOf(f.rel)}.view.svelte`);
			if (!existsSync(pair)) out.push(v(f, 1, `${baseOf(f.rel)}.view.svelte 없음`, 'LIVE_WITHOUT_PAIR', 'error', 'live는 같은 폴더 동일 Base의 .view 페어 필수'));
			let inScript = false;
			f.lines.forEach((line, i) => {
				if (/<script\b/.test(line)) inScript = true;
				if (/<\/script>/.test(line)) { inScript = false; return; }
				if (!inScript && /<(?!\/|svelte:|script\b|style\b|!--)[a-z]/.test(line))
					out.push(v(f, i + 1, line.trim(), 'LIVE_MARKUP', 'error', 'live 마크업 0 — boundary+페어+스니펫만'));
			});
		}
		if (kind === 'glue') {
			f.lines.forEach((line, i) => {
				if (/\$state\s*\(|\$effect\b/.test(line)) out.push(v(f, i + 1, line.trim(), 'GLUE_LOGIC', 'error', '글루의 $state/$effect — 배선은 live로'));
			});
		}
		// 접미사↔segment
		if (['view', 'live'].includes(kind) && loc.area === 'client' && !(loc.segment === 'ui' || (loc.layer === 'shared' && loc.segment === 'ui')))
			out.push(v(f, 1, f.rel, 'SEGMENT_SUFFIX_MISMATCH', 'error', '.view/.live는 ui segment 또는 routes 콜로케이션에만'));
		if (kind === 'remote' && !(loc.area === 'client' && loc.segment === 'api'))
			out.push(v(f, 1, f.rel, 'SEGMENT_SUFFIX_MISMATCH', 'error', '.remote는 slice의 api segment에만'));
		if (kind === 'state' && loc.area === 'client' && loc.segment && loc.segment !== 'model')
			out.push(v(f, 1, f.rel, 'SEGMENT_SUFFIX_MISMATCH', 'error', '*.svelte.ts 상태는 model segment에만'));
		if (kind === 'util' && loc.area === 'client' && loc.segment && loc.segment !== 'lib')
			out.push(v(f, 1, f.rel, 'SEGMENT_SUFFIX_MISMATCH', 'error', '*.util.ts는 lib segment에만'));
		if (kind === 'types' && loc.area === 'client' && loc.segment && loc.segment !== 'model')
			out.push(v(f, 1, f.rel, 'SEGMENT_SUFFIX_MISMATCH', 'error', 'types는 model segment에만'));
		// 서버 배치
		if (['service', 'repository', 'adapter', 'guard', 'schema'].includes(kind)) {
			if (loc.area !== 'server') out.push(v(f, 1, f.rel, 'SERVER_KIND_PLACEMENT', 'error', `서버 종별(.${kind})은 src/server/** 의무 — 서버 전용 보호`));
			else if (['service', 'repository', 'adapter'].includes(kind) && !loc.slice) out.push(v(f, 1, f.rel, 'SERVER_KIND_PLACEMENT', 'error', 'service·repository·adapter는 server/<slice|shared>/ 폴더 의무'));
		}
		// remote 값 export
		if (kind === 'remote') {
			f.lines.forEach((line, i) => {
				const m = line.match(/^\s*export\s+(async\s+function|function|class|let|var|const)\s+(\w+)/);
				if (!m) return;
				const window = line + ' ' + (f.lines[i + 1] ?? '');
				if (m[1] === 'const' && /\b(query|command|form|prerender)\s*(\.|\()/.test(window)) return;
				out.push(v(f, i + 1, line.trim(), 'REMOTE_VALUE_EXPORT', 'error', 'remote는 remote function만 export — 그 외 값은 런타임 즉사 (타입은 합법)'));
			});
			if (/getRequestEvent|\bdb\b\s*\./.test(f.content) && /from\s+['"][^'"]*database/.test(f.content))
				out.push(v(f, 1, 'db 사용 흔적', 'REMOTE_DB_IMPORT', 'error', 'remote의 직접 쿼리 금지'));
		}
		if (['service', 'repository'].includes(kind)) {
			f.lines.forEach((line, i) => {
				const t = line.trim();
				if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return; // 주석 면제
				if (/\bgetRequestEvent\b/.test(line))
					out.push(v(f, i + 1, t.slice(0, 80), 'SERVICE_SVELTEKIT_IMPORT', 'error', 'service·repository는 요청 컨텍스트 무지 — 명시적 파라미터로'));
			});
		}
		if (kind === 'types') {
			f.lines.forEach((line, i) => {
				if (/^\s*export\s+(const|let|var|function|class|enum)\b/.test(line))
					out.push(v(f, i + 1, line.trim(), 'TYPES_ONLY', 'error', '타입 전용 모듈의 런타임 export — union 타입·상수는 config로'));
			});
		}
		// 클래스 규약 (팀 svelte)
		if (['view', 'live', 'glue'].includes(kind) && !loc.vendor) {
			if (kind === 'view' && /\bclass=\{`/.test(f.content))
				f.lines.forEach((line, i) => { if (/\bclass=\{`/.test(line)) out.push(v(f, i + 1, line.trim(), 'TEMPLATE_LITERAL_CLASS', 'error', '템플릿 리터럴 클래스 — class={[...]} 배열로')); });
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
				out.push(v(f, before.split('\n').length, m[0].slice(0, 80), 'STRING_CLASS_ON_COMPONENT', 'error', '컴포넌트 태그 문자열 class — class={[...]} 배열로'));
			}
		}
		// 앵커 (view)
		if (kind === 'view') {
			if (!/<!--\s*@component/.test(f.content)) out.push(v(f, 1, basename(f.rel), 'MISSING_COMPONENT_DOC', 'error', '@component 헤더 부재 (IDE·매니페스트·감사 앵커)'));
			if (f.content.includes('$props()') && !/(?:type|interface)\s+Props\b/.test(f.content))
				out.push(v(f, 1, basename(f.rel), 'UNNAMED_PROPS_TYPE', 'error', 'Props 명명 선언 필수 (추출 앵커)'));
			const p = extractProps(f.content);
			if (p && !p.irregular) {
				for (const mem of p.members.filter((x) => /^on[a-z]/.test(x.name) && x.type.includes('=>')))
					out.push(v(f, 1, `${mem.name} → on${mem.name[2]?.toUpperCase()}${mem.name.slice(3)}`, 'CALLBACK_NAME_STYLE', 'error', '콜백 prop은 camelCase onXxx'));
				if (loc.layer === 'shared')
					for (const mem of p.members.filter((x) => !x.doc))
						out.push(v(f, 1, mem.name, 'UNDOCUMENTED_PROP', 'warn', 'shared/ui는 전 prop TSDoc 의무 (매니페스트 품질)'));
			}
			if (loc.layer === 'shared') {
				const dre = /\b\w*(?:[pP]laceholder|[lL]abel|[tT]itle|[dD]escription)\s*(?:=|\?\?)\s*['"]([^'"]*[가-힣]{2}[^'"]*)['"]/g;
				f.lines.forEach((line, i) => {
					let dm;
					dre.lastIndex = 0;
					while ((dm = dre.exec(line)) !== null)
						if (!config.neutralLiterals.includes(dm[1].trim())) out.push(v(f, i + 1, dm[0].slice(0, 80), 'DOMAIN_DEFAULT_IN_SHARED_UI', 'warn', 'shared/ui 문구 prop의 업무 어휘 기본값 — 소비자가 공급'));
				});
			}
		}
		// 세트 부분 구조분해
		if (/import\s*\{[^}]*\}\s*from\s+['"][@$][^'"]*shared\/ui\/[^/'".]+['"]/.test(f.content))
			f.lines.forEach((line, i) => { if (/import\s*\{[^}]*\}\s*from\s+['"][@$][^'"]*shared\/ui\/[^/'".]+['"]/.test(line)) out.push(v(f, i + 1, line.trim(), 'SET_PARTIAL_IMPORT', 'error', '세트는 import * as 네임스페이스 의무')); });
		// 클래스 상수 세탁 (팀 ts)
		if (['util', 'config', 'unmarked-ts', 'state'].includes(kind) && loc.area === 'client' && !loc.vendor) {
			f.lines.forEach((line, i) => {
				const cm = line.match(/export\s+const\s+\w+\s*=\s*['"`]([^'"`]+)['"`]/);
				if (!cm) return;
				const tokens = cm[1].split(/\s+/).filter(Boolean);
				if (tokens.length >= 4 && tokens.some((t) => /^(flex|grid|hidden|rounded|border|bg-|text-|p[xytrbl]?-|m[xytrbl]?-|w-|h-|gap-|items-|justify-|hover:|focus)/.test(t)))
					out.push(v(f, i + 1, cm[0].slice(0, 80), 'CLASS_CONST_EXPORT', 'warn', '클래스 문자열 상수 export — 해치 세탁, variant 승격이 처방'));
			});
		}
	}

	// ── 구조 룰 (배럴·slice·CLAUDE.md·해치·INSIGNIFICANT) ──
	const hatch = new Map();
	for (const f of files.filter((x) => x.kind === 'view' && !x.loc.vendor)) {
		for (const m of f.content.matchAll(/\b([a-z][A-Za-z]*Class)=(?:"([^"]+)"|\{'([^']+)'\})/g)) {
			const tokens = (m[2] ?? m[3]).split(/\s+/).filter(Boolean);
			if (tokens.length < 4) continue;
			const key = `${m[1]}::${tokens.toSorted().join(' ')}`;
			(hatch.get(key) ?? hatch.set(key, []).get(key)).push({ f, line: f.content.slice(0, m.index).split('\n').length });
		}
	}
	for (const [key, sites] of hatch) {
		if (new Set(sites.map((s) => s.f.rel)).size < 2) continue;
		for (const s of sites) if (inScope(s.f)) out.push(v(s.f, s.line, key.split('::')[0], 'DUPLICATE_ESCAPE_HATCH', 'error', '동일 이스케이프 해치 복붙 — shared/ui variant로 승격'));
	}
	if (!filesArg?.length) {
		// 배럴 위치·내용
		for (const f of files.filter((x) => x.kind === 'barrel' && !x.loc.vendor)) {
			const r = norm(f.rel);
			const layerRoot = LAYERS.some((l) => r === `src/${l}/index.ts`);
			if (layerRoot) { out.push(v(f, 1, 'index.ts', 'NO_LAYER_PUBLIC_API', 'error', '계층 루트 배럴 금지 (steiger 동명 룰)')); continue; }
			if (/^src\/shared\/(ui|lib)\/index\.ts$/.test(r)) { out.push(v(f, 1, 'index.ts', 'NO_SHARED_MEGA_BARREL', 'error', 'shared/ui·lib 통합 배럴 금지 — 딥 임포트 (FSD 공식 처방)')); continue; }
			const sliceIndex = SLICED.some((l) => new RegExp(`^src/${l}/[^/]+/index\\.ts$`).test(r)) || /^src\/shared\/ui\/[^/]+\/index\.ts$/.test(r);
			if (!sliceIndex) { out.push(v(f, 1, r, 'SLICE_PUBLIC_API', 'error', 'index.ts는 slice 루트(또는 shared/ui 세트)만 합법')); continue; }
			// 문장 단위 검사 — 포매터가 개행한 여러 줄 재수출도 인정. 재수출 문장 스팬 밖의
			// 비어있지 않은 라인(로직·외부 재수출)만 위반으로 지목한다.
			let reexports = 0;
			const reexportLines = new Set();
			for (const m of f.content.matchAll(/^[ \t]*export\s+(type\s+)?(\{[^}]*\}|\*)\s+from\s+['"]\.\/[^'"]+['"];?/gm)) {
				reexports++;
				const start = f.content.slice(0, m.index).split('\n').length - 1;
				const span = m[0].split('\n').length;
				for (let k = start; k < start + span; k++) reexportLines.add(k);
			}
			f.lines.forEach((line, i) => {
				if (reexportLines.has(i)) return;
				const t = line.trim();
				if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
				out.push(v(f, i + 1, t.slice(0, 80), 'SLICE_PUBLIC_API', 'error', 'slice index는 자기 slice 재수출 전용 (로직·외부 재수출 금지)'));
			});
			if (reexports > config.heavyReexportMax) out.push(v(f, 1, `재수출 ${reexports}개`, 'HEAVY_REEXPORT', 'warn', 'slice 분할 신호 — 배럴 비대'));
		}
		// slice public API 부재 + segment 검사 + CLAUDE.md + INSIGNIFICANT
		for (const l of SLICED) {
			const dir = join(ROOT, 'src', l);
			if (!existsSync(dir)) continue;
			if (l === 'pages' && !config.layers.pages) {
				if ((await readdir(dir).catch(() => [])).length) out.push(v(`src/pages/`, 1, 'pages 계층', 'SEGMENT_UNKNOWN', 'error', 'pages 계층은 닫힘 — routes 콜로케이션이 전담 (config.layers.pages로만 개방)'));
				continue;
			}
			for (const e of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
				if (!e.isDirectory()) continue;
				const sliceDir = join(dir, e.name);
				if (!existsSync(join(sliceDir, 'index.ts'))) out.push(v(`src/${l}/${e.name}/`, 1, 'index.ts 없음', 'SLICE_PUBLIC_API', 'error', 'slice public API(index.ts) 의무'));
				if (!existsSync(join(sliceDir, 'CLAUDE.md'))) out.push(v(`src/${l}/${e.name}/`, 1, 'CLAUDE.md 없음', 'MISSING_CLAUDE_MD', 'error', 'slice 루트 자기서술 의무 (kit이 씨앗 생성)'));
				for (const s of await readdir(sliceDir, { withFileTypes: true }).catch(() => []))
					if (s.isDirectory() && !SEGMENTS.includes(s.name))
						out.push(v(`src/${l}/${e.name}/${s.name}/`, 1, s.name, 'SEGMENT_UNKNOWN', 'error', 'segment는 ui·api·model·lib·config만'));
				const sliceFiles = files.filter((x) => x.loc.layer === l && x.loc.slice === e.name);
				const inbound = new Set(edges.filter((ed) => ed.to && sliceFiles.some((sf) => sf.rel === ed.to.rel) && !(ed.from.loc.layer === l && ed.from.loc.slice === e.name)).map((ed) => ed.from.rel));
				if (inbound.size === 1) out.push(v(`src/${l}/${e.name}/`, 1, `소비 1곳(${[...inbound][0]})`, 'INSIGNIFICANT_SLICE', 'warn', '한 곳만 쓰는 slice — 콜로케이션 회귀 검토 (steiger insignificant-slice)'));
			}
		}
		for (const l of [...LAYERS.filter((x) => x !== 'pages' || config.layers.pages), 'server']) {
			const dir = join(ROOT, 'src', l === 'app' ? 'app' : l);
			if (existsSync(dir) && !existsSync(join(dir, 'CLAUDE.md')))
				out.push(v(`src/${l}/`, 1, 'CLAUDE.md 없음', 'MISSING_CLAUDE_MD', 'error', '계층 루트 자기서술 의무'));
		}
		// shared segment 검사
		if (existsSync(join(ROOT, 'src/shared')))
			for (const s of await readdir(join(ROOT, 'src/shared'), { withFileTypes: true }).catch(() => []))
				if (s.isDirectory() && !SHARED_SEGMENTS.includes(s.name))
					out.push(v(`src/shared/${s.name}/`, 1, s.name, 'SEGMENT_UNKNOWN', 'error', 'shared segment는 ui·vendor·lib·model·config만'));
		// server slice 검사 + parity
		if (existsSync(join(ROOT, 'src/server'))) {
			const clientSlices = new Set(SLICED.flatMap((l) => [...slicesOf(files, l).keys()]));
			for (const e of await readdir(join(ROOT, 'src/server'), { withFileTypes: true }).catch(() => [])) {
				if (!e.isDirectory()) continue;
				if (!existsSync(join(ROOT, 'src/server', e.name, 'CLAUDE.md')))
					out.push(v(`src/server/${e.name}/`, 1, 'CLAUDE.md 없음', 'MISSING_CLAUDE_MD', 'error', 'server slice 자기서술 의무'));
				if (!['shared', 'database', 'auth'].includes(e.name) && ![...clientSlices].some((s) => s === e.name || s.includes(e.name) || e.name.includes(s)))
					out.push(v(`src/server/${e.name}/`, 1, e.name, 'SLICE_NAME_PARITY', 'warn', '대응 클라 slice명 부재 — 이름 1:1 권장'));
			}
		}
	}

	// 프로젝트 확장 룰
	for (const rule of config.rules) {
		const kinds = new Set(rule.kinds ?? []);
		for (const f of files) {
			if (kinds.size && !kinds.has(f.kind)) continue;
			if (!inScope(f)) continue;
			if (rule.check) for (const x of rule.check(f, { config, files })) out.push({ ...x, code: rule.code, severity: rule.severity, desc: rule.desc });
			else if (rule.pattern) f.lines.forEach((line, i) => { if (rule.pattern.test(line)) out.push(v(f, i + 1, line.trim(), rule.code, rule.severity, rule.desc)); });
		}
	}
	// 중복 제거 (같은 파일:줄:코드)
	const seen = new Set();
	return out.filter((x) => { const k = `${x.code}:${x.file}:${x.line}:${x.match}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

async function runAudit(args, config, files) {
	const filesArg = args.getList('--files');
	const violations = await collectViolations(files, config, filesArg);
	if (args.has('--json')) console.log(JSON.stringify(violations, null, 2));
	else printAudit(violations);
	return violations.some((x) => x.severity === 'error') ? 1 : 0;
}

function printAudit(violations) {
	if (!violations.length) { console.log(`\x1b[32m✓\x1b[0m arch:audit 통과 — 위반 0건 (kit v${KIT_VERSION})`); return; }
	for (const [code, list] of Map.groupBy(violations, (x) => x.code)) {
		const tag = list[0].severity === 'error' ? '\x1b[31m■\x1b[0m' : '\x1b[33m▲\x1b[0m';
		console.log(`\n${tag} \x1b[1m${code}\x1b[0m (${list.length}건) — ${list[0].desc}`);
		for (const x of list.slice(0, 5)) console.log(`   ${x.file}:${x.line}  \x1b[90m${x.match}\x1b[0m`);
		if (list.length > 5) console.log(`   \x1b[90m… ${list.length - 5}건 더\x1b[0m`);
	}
	const e = violations.filter((x) => x.severity === 'error').length;
	console.log(`\n총 \x1b[31m${e}\x1b[0m error, \x1b[33m${violations.length - e}\x1b[0m warning (kit v${KIT_VERSION})`);
}

// ── analyze ──────────────────────────────────────────────────────────────
async function runAnalyze(args, config, files) {
	const { edges } = buildGraph(files);
	const consumers = buildConsumerMap(files, edges);
	const sharedUi = files.filter((f) => f.kind === 'view' && f.loc.layer === 'shared');
	const R = { kit: KIT_VERSION };
	R.kinds = Object.fromEntries(['view', 'live', 'glue', 'remote', 'service', 'repository', 'adapter', 'guard', 'state', 'util'].map((k) => [k, files.filter((f) => f.kind === k).length]));
	R.orphans = sharedUi.filter((f) => (consumers.get(f.rel)?.size ?? 0) === 0).map((f) => baseOf(f.rel));
	R.fatLives = files.filter((f) => f.kind === 'live' && f.lines.length > 100).map((f) => `${f.rel} (${f.lines.length}줄)`);
	const NATIVE = ['button', 'input', 'table', 'dialog', 'textarea', 'select', 'nav', 'progress'];
	const nativeCount = Object.fromEntries(NATIVE.map((t) => [t, 0]));
	for (const f of files.filter((x) => x.kind === 'view' && x.loc.layer !== 'shared'))
		for (const t of NATIVE) nativeCount[t] += (f.content.match(new RegExp(`<${t}\\b`, 'g')) ?? []).length;
	R.nativeSignals = Object.entries(nativeCount).filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<${t}> ${n}회 — shared/ui 부재 신호`);
	const violations = await collectViolations(files, config);
	R.insignificant = violations.filter((x) => x.code === 'INSIGNIFICANT_SLICE').map((x) => x.file);
	R.hatchClusters = [...Map.groupBy(violations.filter((x) => x.code === 'DUPLICATE_ESCAPE_HATCH'), (x) => x.match)]
		.map(([k, list]) => `${k} ×${list.length}곳`);
	const err = violations.filter((x) => x.severity === 'error').length;
	R.auditSummary = `${err} error / ${violations.length - err} warn`;
	if (args.has('--json')) return console.log(JSON.stringify(R, null, 2)), 0;
	const out = [`# arch-analyze · kit v${KIT_VERSION} · ${await readPkgName()}`, ''];
	out.push(`종별: ${Object.entries(R.kinds).filter(([, n]) => n).map(([k, n]) => `${k} ${n}`).join(' · ')}`);
	out.push(`감사 잔고: ${R.auditSummary}`, '');
	if (R.orphans.length) out.push(`⚠ 고아 shared/ui (소비 0): ${R.orphans.join(', ')} — 두 릴리스 연속이면 삭제 검토`);
	if (R.insignificant.length) out.push(`🔺 INSIGNIFICANT slice (소비 1곳): ${R.insignificant.join(', ')} — 콜로케이션 회귀 검토`);
	if (R.hatchClusters.length) out.push('', '🔺 해치 클러스터 (동일 *Class 복붙 — shared/ui variant 승격 후보):', ...R.hatchClusters.map((s) => `   ${s}`));
	if (R.fatLives.length) out.push('', '🔺 live 비대 (>100줄 — model *.svelte.ts 추출):', ...R.fatLives.map((s) => `   ${s}`));
	if (R.nativeSignals.length) out.push('', '🔺 네이티브 요소 다빈도:', ...R.nativeSignals.map((s) => `   ${s}`));
	console.log(out.join('\n'));
	return 0;
}

// ── new — 생성기 ─────────────────────────────────────────────────────────
async function loadTemplate(name) {
	if (!TEMPLATE_DIR) throw new Error('템플릿 디렉토리 없음 — init 재실행으로 .svelte-arch/templates 복원');
	return readFile(join(TEMPLATE_DIR, name), 'utf-8');
}

async function assertUniqueBase(base) {
	for await (const p of walk(join(ROOT, 'src'))) {
		if (p.endsWith('.svelte') && baseOf(norm(relative(ROOT, p))) === base) {
			console.error(`✗ Base '${base}' 이미 존재: ${norm(relative(ROOT, p))} — Base는 레포 전역 유일`);
			process.exit(1);
		}
	}
}

const isPascal = (s) => /^[A-Z][A-Za-z0-9]*$/.test(s);
const isKebab = (s) => /^[a-z][a-z0-9-]*$/.test(s);

// 계층 루트 역할 1행 (init.mjs LAYER_ROLES와 동일 문안) — new·plan이 계층을 새로 만들 때도 시드해
// "생성 직후 자체 감사(MISSING_CLAUDE_MD) 실패"가 없게 한다.
const LAYER_ROLES = {
	app: '초기화 계층 — index.html·hooks·app.css·routes(글루 + pages first 콜로케이션)',
	widgets: '자립 대형 블록 slice들 (view/live 페어 = 독립 데이터 섬)',
	features: '사용자 상호작용(동사) slice들 — 폼·다이얼로그·액션',
	entities: '업무 개체(명사) slice들 — 표시 view·wire 타입(model)·remote(api). ui는 view 전용',
	shared: '업무 무관 — ui(디자인 시스템, 딥 임포트)·vendor(shadcn 원본 보존)·lib·model·config',
	server: '서버 스택($lib/server 보호) — slice별 service·repository·adapter, 이름은 클라 slice와 1:1'
};

async function seedClaude(dir, role) {
	if (existsSync(join(dir, 'CLAUDE.md'))) return false;
	try {
		const t = await loadTemplate('CLAUDE.template.md');
		await writeFile(join(dir, 'CLAUDE.md'), t.replaceAll('{DIR}', norm(relative(ROOT, dir))).replaceAll('{역할 한 줄}', role), 'utf-8');
		return true;
	} catch { return false; /* audit이 알림 */ }
}

/** 계층 루트 CLAUDE.md 보장 — layer = 'widgets'·'server' 등 src/ 하위 1단 이름 */
async function seedLayerClaude(layer) {
	return seedClaude(join(ROOT, 'src', layer), LAYER_ROLES[layer] ?? `${layer} 계층`);
}

async function runNew(positionals) {
	const [cmd, ...rest] = positionals;
	const created = [];
	const write = async (rel, content) => {
		const abs = join(ROOT, rel);
		if (existsSync(abs)) { console.error(`✗ 이미 존재: ${rel}`); process.exit(1); }
		await mkdir(dirname(abs), { recursive: true });
		await writeFile(abs, content, 'utf-8');
		created.push(rel);
	};
	const sliceScaffold = async (layer, slice, base, withLive) => {
		if (!isKebab(slice) || !isPascal(base)) return console.error(`사용법: new ${cmd} <kebab-slice> <PascalBase>`), 1;
		await assertUniqueBase(base);
		const dir = join(ROOT, 'src', layer, slice);
		await mkdir(join(dir, 'ui'), { recursive: true });
		await seedLayerClaude(layer);
		await seedClaude(dir, `${slice} ${layer} slice`);
		const view = await loadTemplate('SliceSection.view.svelte');
		await write(`src/${layer}/${slice}/ui/${base}.view.svelte`, view.replaceAll('SliceSection', base).replaceAll('example', slice));
		let index = `export { default as ${base} } from './ui/${base}.view.svelte';\n`;
		if (withLive) {
			const live = await loadTemplate('SliceSection.live.svelte');
			await write(`src/${layer}/${slice}/ui/${base}.live.svelte`, live.replaceAll('SliceSection', base).replaceAll('example', slice));
			index += `export { default as ${base}Live } from './ui/${base}.live.svelte';\n`;
		}
		if (!existsSync(join(dir, 'index.ts'))) await write(`src/${layer}/${slice}/index.ts`, index);
		return 0;
	};

	if (cmd === 'shared-ui') {
		const [name] = rest;
		if (!name || !isPascal(name)) return console.error('사용법: new shared-ui <PascalName>'), 1;
		await assertUniqueBase(name);
		const t = await loadTemplate('Component.view.svelte');
		await write(`src/shared/ui/${name}.view.svelte`, t.replaceAll('Component', name));
		await seedLayerClaude('shared');
	} else if (cmd === 'entity') {
		const [slice, base] = rest;
		const r = await sliceScaffold('entities', slice, base, false);
		if (r) return r;
	} else if (cmd === 'feature' || cmd === 'widget') {
		const [slice, base] = rest;
		const r = await sliceScaffold(cmd === 'feature' ? 'features' : 'widgets', slice, base, true);
		if (r) return r;
	} else if (cmd === 'set') {
		const [setName, ...parts] = rest;
		if (!setName || !isKebab(setName) || parts.length < 2 || !parts.every(isPascal))
			return console.error('사용법: new set <kebab-set> <Root> <Part...> (부품 2+)'), 1;
		const pascal = setName.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase());
		const t = await loadTemplate('SetPart.view.svelte');
		for (const part of parts) {
			await assertUniqueBase(`${pascal}${part}`);
			await write(`src/shared/ui/${setName}/${pascal}${part}.view.svelte`, t.replaceAll('SetName', pascal).replaceAll('PartName', part));
		}
		await write(`src/shared/ui/${setName}/index.ts`, parts.map((p) => `export { default as ${p} } from './${pascal}${p}.view.svelte';`).join('\n') + '\n');
		await seedLayerClaude('shared');
	} else if (['service', 'repository', 'adapter'].includes(cmd)) {
		const [slice, name] = rest;
		if (!slice || !isKebab(slice)) return console.error(`사용법: new ${cmd} <slice> [Name]`), 1;
		const t = await loadTemplate(`${cmd}.template.ts`);
		const file = cmd === 'adapter' ? `${(name ?? slice).toLowerCase()}.adapter.ts` : `${slice}.${cmd}.ts`;
		await mkdir(join(ROOT, 'src/server', slice), { recursive: true });
		await seedLayerClaude('server');
		await seedClaude(join(ROOT, 'src/server', slice), `${slice} 서버 slice`);
		await write(`src/server/${slice}/${file}`, t.replaceAll('__slice__', slice));
	} else {
		console.error('사용법: new <shared-ui|entity|feature|widget|set|service|repository|adapter> …');
		return 1;
	}
	console.log('✓ 생성됨:');
	for (const c of created) console.log(`  · ${c}`);
	console.log('\n다음: @component 역할 1행·TSDoc 채우기 → bun run arch:audit');
	return 0;
}

// ── plan — 구(비-FSD) 구조 → FSD 이행 (제안표 → 승인 → --apply) ──────────
// 동의 UX는 에이전트 몫: 제안표 제시 → "FSD 표준대로 이렇게 옮기겠습니다. 진행할까요?" 승인 후에만 --apply.
// 분류(entities/features/widgets)는 휴리스틱 제안 — .svelte-arch/plan-overrides.json 으로 수정.
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

async function loadOverrides() {
	const p = join(ROOT, '.svelte-arch/plan-overrides.json');
	if (!existsSync(p)) return {};
	try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return {}; }
}

async function runPlan(args) {
	if (!isLegacyTree()) {
		console.log('✓ 이미 FSD 좌표계(또는 구 트리 없음) — plan 불요. 감사는 arch:audit.');
		return 0;
	}
	const overrides = await loadOverrides();
	const moves = []; // { from, to, note, sure } — sure: 위치·프레임워크 관례 기반=true / 네이밍 추측=false(2차 LLM 검토 대상)
	const deletes = [];
	const followups = [];
	const addMove = (from, to, note = '', sure = true) => {
		if (overrides[from] === 'skip') return;
		moves.push({ from: norm(from), to: norm(overrides[from] ?? to), note, sure: from in overrides ? true : sure });
	};
	const legacyFiles = [];
	for await (const abs of walk(join(ROOT, 'src'))) legacyFiles.push(norm(relative(ROOT, abs)));

	const domains = new Set();
	for (const rel of legacyFiles) {
		const dm = rel.match(/^src\/lib\/components\/(?:composite\/)?([^/]+)\//);
		if (dm && !['primitive', 'ui', 'composite', 'layout'].includes(dm[1])) domains.add(dm[1]);
	}

	for (const rel of legacyFiles) {
		const b = basename(rel);
		if (b === '.DS_Store' || b === 'CLAUDE.md' || b === 'README.md') continue; // 문서·잡파일은 이동 계획 밖 (수동 정리)
		if (rel in overrides) { addMove(rel, overrides[rel]); continue; } // overrides 최우선 — 휴리스틱 밖(미분류) 파일도 대상 지정 가능
		// routes → app/routes
		if (rel.startsWith('src/routes/')) { addMove(rel, rel.replace('src/routes/', 'src/app/routes/')); continue; }
		if (rel === 'src/app.html') { addMove(rel, 'src/app/index.html'); continue; }
		if (rel === 'src/app.css') { addMove(rel, 'src/app/app.css'); continue; }
		if (/^src\/hooks(\.server|\.client)?\.(ts|js)$/.test(rel)) { addMove(rel, rel.replace('src/', 'src/app/')); continue; }
		// vendor
		if (rel.startsWith('src/lib/components/ui/')) { addMove(rel, rel.replace('src/lib/components/ui/', 'src/shared/vendor/')); continue; }
		if (rel === 'src/lib/utils.ts') { addMove(rel, 'src/shared/vendor/utils.ts', 'vendor cn 유틸'); continue; }
		// shared/ui (구 primitive)
		const pm = rel.match(/^src\/lib\/components\/primitive\/(.+)$/);
		if (pm) {
			let to = 'src/shared/ui/' + pm[1];
			if (b === 'index.ts' && !pm[1].includes('/')) { deletes.push(rel); continue; } // 통합 배럴 폐기
			if (b.endsWith('.svelte') && !/\.(view|live|stories)\.svelte$/.test(b)) to = to.replace(/\.svelte$/, '.view.svelte');
			addMove(rel, to);
			continue;
		}
		// 도메인 컴포넌트 → 3계층 분류 (휴리스틱)
		const cm = rel.match(/^src\/lib\/components\/(?:composite\/)?([^/]+)\/(.+\.svelte)$/);
		if (cm) {
			const [, domain, file] = cm;
			const base = baseOf(rel);
			const suffix = file.endsWith('.live.svelte') ? '.live.svelte' : /\.(view|stories)\.svelte$/.test(file) ? file.slice(file.indexOf('.')) : '.view.svelte';
			let target;
			if (base.endsWith('Section')) target = `src/widgets/${kebab(base.replace(/Section$/, ''))}/ui/${base}${suffix}`;
			else if (/(Form|Dialog|Modal|Popup|Drawer)$/.test(base)) target = `src/features/${kebab(base)}/ui/${base}${suffix}`;
			else if (domain === 'layout') target = `src/widgets/${kebab(base)}/ui/${base}${suffix}`;
			else target = `src/entities/${domain}/ui/${base}${suffix}`;
			// 3계층 분류는 네이밍 관례 추측 — sure=false (2차 LLM이 내용 열람으로 확정)
			addMove(rel, target, base.endsWith('Section') ? 'widget' : /(Form|Dialog|Modal|Popup|Drawer)$/.test(base) ? 'feature' : domain === 'layout' ? 'widget(셸)' : 'entity', false);
			continue;
		}
		// data 계층
		const rm = rel.match(/^src\/lib\/data\/([^/]+)\.remote\.ts$/);
		if (rm) { addMove(rel, `src/entities/${rm[1]}/api/${rm[1]}.remote.ts`); continue; }
		const sm = rel.match(/^src\/lib\/data\/([^/]+)\.(service|repository)\.ts$/);
		if (sm) { addMove(rel, `src/server/${sm[1]}/${sm[1]}.${sm[2]}.ts`); continue; }
		if (rel.startsWith('src/lib/server/')) { addMove(rel, rel.replace('src/lib/server/', 'src/server/')); continue; }
		// types·state·utils
		const tm = rel.match(/^src\/lib\/types\/([^/]+?)(\.spec)?\.ts$/);
		if (tm) {
			const [, name, spec = ''] = tm;
			const stem = domains.has(name) ? `src/entities/${name}/model/types` : `src/shared/model/${name}.types`;
			addMove(rel, `${stem}${spec}.ts`, '', false); // spec은 본체와 별도 대상 — 동일 대상 덮어쓰기 금지. 도메인 매칭=추측
			continue;
		}
		const stm = rel.match(/^src\/lib\/state\/([^/]+)\.svelte(\.spec)?\.ts$/);
		if (stm) {
			const name = stm[1];
			const home = domains.has(name) ? `src/entities/${name}/model/` : 'src/shared/model/';
			addMove(rel, home + basename(rel), '', false);
			continue;
		}
		const um = rel.match(/^src\/lib\/utils\/(.+)$/);
		if (um) {
			let to = 'src/shared/lib/' + um[1];
			if (to.endsWith('.ts') && !/\.(util|spec|test|svelte)\.ts$/.test(to) && !to.endsWith('.d.ts')) to = to.replace(/\.ts$/, '.util.ts');
			addMove(rel, to, '', false); // 업무 로직 util일 수 있음 — shared/lib 배치는 추정
			continue;
		}
		if (rel.startsWith('src/lib/')) followups.push(rel); // 미분류 — overrides 필요
	}

	// 충돌(대상 선점) 건너뜀
	const skipped = moves.filter((m) => existsSync(join(ROOT, m.to)) && m.from !== m.to);
	const applied = moves.filter((m) => !existsSync(join(ROOT, m.to)));
	const map = new Map(applied.map((m) => [m.from, m.to]));
	// 동일 대상 충돌 — 두 소스가 한 대상으로 계산되면 나중 rename이 앞선 것을 덮어쓴다(자료 소실). apply 강제 중단 대상.
	const dupes = [...Map.groupBy(applied, (m) => m.to).values()].filter((l) => l.length > 1);

	// 임포트 재작성 — src 밖 소비자(tests·e2e)도 $lib/@ 절대 스펙을 쓰므로 포함(이동은 없음, 재작성만)
	const files = [];
	for (const consumerRoot of ['src', 'tests', 'e2e']) {
		const dir = join(ROOT, consumerRoot);
		if (!existsSync(dir)) continue;
		for await (const abs of walk(dir)) {
			const rel = norm(relative(ROOT, abs));
			if (!/\.(svelte|ts|js|tsx|html|css)$/.test(rel)) continue;
			files.push({ abs, rel, content: await readFile(abs, 'utf-8') });
		}
	}
	// 해체 후보 — .svelte가 서버 모듈·service/repository를 직접 문다 = 이동만으론 부족(view/live 분리·server 추출 필요)
	const TEARDOWN_RE = /from\s*['"](?:\$lib\/server\/|@\/server\/)[^'"]*['"]|from\s*['"][^'"]*\.(?:service|repository)['"]|from\s*['"]drizzle-orm/;
	const teardown = files.filter((x) => x.rel.endsWith('.svelte') && TEARDOWN_RE.test(x.content)).map((x) => x.rel);
	const pjoin = (...parts) => {
		const out = [];
		for (const seg of parts.join('/').split('/')) {
			if (seg === '' || seg === '.') continue;
			if (seg === '..') out.pop(); else out.push(seg);
		}
		return out.join('/');
	};
	const toAlias = (rel) => '@/' + rel.replace(/^src\//, '');
	const BARREL_RE = /import\s*(type\s*)?\{([^}]+)\}\s*from\s*(['"])\$lib\/components\/primitive\3\s*;?/g;
	function rewrite(content, oldRel, newRel) {
		let out = content;
		out = out.replace(BARREL_RE, (full, typeKw, clause) =>
			clause.split(',').map((s) => s.trim()).filter(Boolean)
				.map((n) => `import ${typeKw ?? ''}${n} from '@/shared/ui/${n}.view.svelte';`).join('\n'));
		// 절대 스펙 ($lib = 구세계 src/lib)
		for (const [f, t] of map) {
			const oldSpecs = [f.replace(/^src\/lib\//, '$lib/'), f.replace(/^src\//, '$lib/../'), toAlias(f), f];
			for (const os of oldSpecs) {
				out = out.replaceAll(`'${os}'`, `'${toAlias(t)}'`).replaceAll(`"${os}"`, `"${toAlias(t)}"`);
				if (!os.endsWith('.ts')) continue;
				const noExt = os.replace(/\.ts$/, '');
				out = out.replaceAll(`'${noExt}'`, `'${toAlias(t).replace(/\.ts$/, '')}'`).replaceAll(`"${noExt}"`, `"${toAlias(t).replace(/\.ts$/, '')}"`);
				// vanilla vendor 등은 .ts 소스를 .js 확장자로 임포트한다(moduleResolution bundler)
				const asJs = os.replace(/\.ts$/, '.js');
				out = out.replaceAll(`'${asJs}'`, `'${toAlias(t).replace(/\.ts$/, '.js')}'`).replaceAll(`"${asJs}"`, `"${toAlias(t).replace(/\.ts$/, '.js')}"`);
				// index.ts 는 디렉토리 배럴 스펙으로도 소비된다 ('$lib/components/ui/popover')
				if (basename(f) === 'index.ts') {
					const dirSpec = noExt.replace(/\/index$/, '');
					const dirTarget = toAlias(t).replace(/\/index\.ts$/, '');
					out = out.replaceAll(`'${dirSpec}'`, `'${dirTarget}'`).replaceAll(`"${dirSpec}"`, `"${dirTarget}"`);
				}
			}
		}
		// 상대 스펙 — 옛 위치 기준 해석 → 새 좌표
		out = out.replace(/(from\s*|import\s*\(\s*)(['"])(\.[^'"]+)\2/g, (full, lead, q, spec) => {
			let target = pjoin(dirname(oldRel), spec);
			let mapped = map.get(target) ?? map.get(target + '.ts') ?? map.get(target.replace(/\.js$/, '.ts'));
			if (!mapped) return full;
			const myNewDir = dirname(newRel ?? oldRel);
			const rewritten = norm(dirname(mapped)) === norm(myNewDir) ? `./${basename(mapped)}` : toAlias(mapped);
			return `${lead}${q}${rewritten.replace(/\.ts$/, spec.endsWith('.ts') ? '.ts' : '')}${q}`;
		});
		return out;
	}
	let rewriteCount = 0;
	for (const f of files) {
		const newSelf = map.get(f.rel) ?? f.rel;
		if (rewrite(f.content, f.rel, newSelf) !== f.content) rewriteCount++;
	}

	// ── 출력 ──
	const apply = args.has('--apply');
	if (args.has('--json') && !apply) {
		console.log(JSON.stringify({ kit: KIT_VERSION, moves: applied, deletes, skipped, dupes, followups, teardown, rewriteCount }, null, 2));
		return 0;
	}
	const guesses = applied.filter((m) => !m.sure);
	console.log(`# arch-plan · kit v${KIT_VERSION} — 이동 ${applied.length}(확실 ${applied.length - guesses.length} · 추정 ${guesses.length}) · 삭제(배럴) ${deletes.length} · 임포트 재작성 ${rewriteCount}파일 · 미분류 ${followups.length} · 해체 후보 ${teardown.length}`);
	if (guesses.length || followups.length) console.log(`  추정·미분류 = 2차 LLM 검토 대상 — 내용을 열어 계층 판정 후 plan-overrides.json 확정 (스킬 adoption.md §2.5)`);
	console.log(`\n## 0단계(수동 1분): svelte.config 수술 — files.lib='src' · files.routes='src/app/routes' · files.appTemplate='src/app/index.html' · alias '@'→'src' (정본: 스킬 fsd-guide.md)`);
	const byGroup = Map.groupBy(applied, (m) => m.to.split('/').slice(1, 3).join('/'));
	for (const [g, list] of [...byGroup].sort()) {
		console.log(`\n## ${g} (${list.length})`);
		for (const m of (args.has('--full') ? list : list.slice(0, 5))) console.log(`  ${m.from}  →  ${m.to}${m.note ? `  [${m.note}]` : ''}${m.sure ? '' : '  [?추정]'}`);
		if (!args.has('--full') && list.length > 5) console.log(`  … ${list.length - 5}건 더 (--full)`);
	}
	for (const d of deletes) console.log(`## 삭제(통합 배럴): ${d}`);
	for (const s of skipped) console.log(`## ⚠ 건너뜀(대상 존재): ${s.from} ↛ ${s.to}`);
	for (const l of dupes) console.log(`## ✗ 대상 충돌(자료 소실 위험): ${l.map((m) => m.from).join(' + ')}  →  ${l[0].to} — plan-overrides.json 으로 대상 분리 필요`);
	if (teardown.length) {
		console.log(`\n## ⚒ 해체 후보 (${teardown.length}) — .svelte가 서버 모듈을 직접 소비. 이동해도 audit 위반 잔존 → view/live 분리·server 추출(대규모 리팩토링, 이행 커밋과 분리·별도 승인):`);
		for (const t of teardown.slice(0, 20)) console.log(`  ${t}`);
		if (teardown.length > 20) console.log(`  … ${teardown.length - 20}건 더`);
	}
	if (followups.length) {
		console.log(`\n## 미분류 (plan-overrides.json 으로 지정 후 재실행 — {"<from>": "<to|skip>"}):`);
		for (const f of followups.slice(0, 20)) console.log(`  ${f}`);
		if (followups.length > 20) console.log(`  … ${followups.length - 20}건 더`);
	}
	console.log(`\n분류는 휴리스틱 제안입니다 — [widget|feature|entity] 표기를 검토하고, 수정은 .svelte-arch/plan-overrides.json 에.`);

	if (!apply) {
		console.log(`적용: bun run arch:plan -- --apply  (svelte.config 수술 선행 + 완전히 깨끗한 작업트리 필수, 롤백=git)`);
		return 0;
	}

	// ── 적용 게이트 ──
	if (dupes.length) {
		console.error(`✗ 거부 — 동일 대상 충돌 ${dupes.length}건(위 ✗ 목록). plan-overrides.json 으로 대상을 분리한 뒤 재실행.`);
		return 1;
	}
	const cfgFile = ['svelte.config.js', 'svelte.config.ts'].map((f) => join(ROOT, f)).find(existsSync);
	if (!cfgFile || !(await readFile(cfgFile, 'utf-8')).includes('src/app/routes')) {
		console.error(`✗ 거부 — svelte.config 에 files.routes='src/app/routes' 수술이 선행돼야 합니다 (fsd-guide.md).`);
		return 1;
	}
	try {
		const dirty = execSync('git status --porcelain', { cwd: ROOT }).toString().trim();
		if (dirty) {
			console.error(`✗ 거부 — 작업트리에 변경 ${dirty.split('\n').length}개. 구조 이행은 깨끗한 트리에서만 (커밋/스태시 후 재실행).`);
			return 1;
		}
	} catch {
		console.error('✗ 거부 — git 저장소가 아님 (git이 롤백 수단).');
		return 1;
	}

	for (const m of applied) {
		await mkdir(join(ROOT, dirname(m.to)), { recursive: true });
		await rename(join(ROOT, m.from), join(ROOT, m.to));
	}
	for (const d of deletes) if (existsSync(join(ROOT, d))) await unlink(join(ROOT, d));
	async function pruneEmpty(dir) {
		let entries;
		try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
		for (const e of entries) if (e.isDirectory()) await pruneEmpty(join(dir, e.name));
		try { if ((await readdir(dir)).length === 0) await rmdir(dir); } catch { /* keep */ }
	}
	await pruneEmpty(join(ROOT, 'src/lib'));
	await pruneEmpty(join(ROOT, 'src/routes'));
	let rewritten = 0;
	const deleteSet = new Set(deletes);
	for (const f of files) {
		if (deleteSet.has(f.rel)) continue;
		const newSelf = map.get(f.rel) ?? f.rel;
		const next = rewrite(f.content, f.rel, newSelf);
		if (next !== f.content) { await writeFile(join(ROOT, newSelf), next, 'utf-8'); rewritten++; }
	}
	// slice index·CLAUDE 씨앗 (계층 루트 포함 — 이행 직후 audit이 MISSING_CLAUDE_MD로 실패하지 않게)
	let seeded = 0, claudeSeeded = 0;
	for (const l of ['entities', 'features', 'widgets']) {
		const dir = join(ROOT, 'src', l);
		if (!existsSync(dir)) continue;
		if (await seedLayerClaude(l)) claudeSeeded++;
		for (const e of await readdir(dir, { withFileTypes: true })) {
			if (!e.isDirectory()) continue;
			const sliceDir = join(dir, e.name);
			if (await seedClaude(sliceDir, `${e.name} ${l} slice — {역할 한 줄 다듬기}`)) claudeSeeded++;
			if (!existsSync(join(sliceDir, 'index.ts'))) {
				const lines = [];
				for await (const p of walk(sliceDir)) {
					const r = norm(relative(sliceDir, p));
					if (r.endsWith('.view.svelte')) lines.push(`export { default as ${baseOf(r)} } from './${r}';`);
					else if (r.endsWith('.live.svelte')) lines.push(`export { default as ${baseOf(r)}Live } from './${r}';`);
					else if (r.endsWith('.remote.ts')) lines.push(`export * from './${r.replace(/\.ts$/, '')}';`);
					else if (basename(r) === 'types.ts') lines.push(`export * from './${r.replace(/\.ts$/, '')}';`);
				}
				if (lines.length) { await writeFile(join(sliceDir, 'index.ts'), lines.sort().join('\n') + '\n', 'utf-8'); seeded++; }
			}
		}
	}
	for (const l of ['app', 'shared', 'server']) {
		if (!existsSync(join(ROOT, 'src', l))) continue;
		if (await seedLayerClaude(l)) claudeSeeded++;
	}
	if (existsSync(join(ROOT, 'src/server')))
		for (const e of await readdir(join(ROOT, 'src/server'), { withFileTypes: true }))
			if (e.isDirectory() && (await seedClaude(join(ROOT, 'src/server', e.name), `${e.name} 서버 slice — {역할 한 줄 다듬기}`))) claudeSeeded++;
	console.log(`\n✓ 적용 완료 — 이동 ${applied.length} · 삭제 ${deletes.length} · 재작성 ${rewritten}파일 · index 씨앗 ${seeded} · CLAUDE.md 씨앗 ${claudeSeeded}`);
	console.log(`다음: svelte-check → bun run arch:audit → dev 부팅 스모크 → git diff 리뷰 → 커밋`);
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
			} else if (next && !next.startsWith('--')) { map.set(argv[i], next); i++; }
			else map.set(argv[i], true);
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
	if (cmd === 'version' || cmd === '--version') { console.log(`arch kit v${KIT_VERSION}`); return 0; }
	if (!existsSync(join(ROOT, 'src'))) { console.error('✗ 프로젝트 루트(src/ 보유)에서 실행하세요 — cwd:', ROOT); return 2; }
	const config = await loadConfig();
	const args = parseArgs(rest);
	const positionals = rest.filter((a) => !a.startsWith('--') && !(rest[rest.indexOf(a) - 1] ?? '').match(/^--(slice|detail|files)$/));
	if (cmd === 'plan') return runPlan(args);
	if (cmd === 'new') return runNew(positionals);
	if (isLegacyTree() && ['manifest', 'audit', 'analyze'].includes(cmd)) { legacyNotice(`arch:${cmd}`); return 0; }
	const files = await collectFiles();
	if (cmd === 'manifest') return runManifest(args, config, files);
	if (cmd === 'audit') return runAudit(args, config, files);
	if (cmd === 'analyze') return runAnalyze(args, config, files);
	console.error('사용법: arch.mjs <manifest|audit|analyze|new|plan|version> [옵션]');
	return 2;
}

process.exit(await main());
