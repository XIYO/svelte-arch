# resolve() 헌법 조항 + arch.mjs verify Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** kit v5.1.0 → v5.2.0 — 헌법 A11 조항(내부 링크는 `resolve()` 경유) + 감사 룰 `UNRESOLVED_INTERNAL_LINK`(53번째) + 설치 무결손 검증 명령 `arch.mjs verify`를 추가한다.

**Architecture:** 이 저장소는 자체 테스트 러너가 없는 Claude Code 플러그인(문서 + 단일 CLI 스크립트 `arch.mjs`)이다. 검증은 이 저장소의 기존 관행대로 스크래치 fixture 프로젝트(임시 `package.json`+`src/`)에 수정된 `arch.mjs`를 배치해 실제로 실행하고 출력을 눈으로 확인하는 방식이다(단위 테스트 프레임워크를 새로 들이지 않는다 — 기존 CHANGELOG 어디에도 그런 사례가 없다).

**Tech Stack:** Bun, 순수 정규식 기반 정적 분석(AST 없음), Markdown 문서.

## Global Constraints

- 룰 저작 불변식 3조(arch.mjs 헤더에 명문화됨): ① 구문 검사는 라인 단위 금지 — `content.matchAll()`로 문장 단위 매칭 후 `content.slice(0, m.index).split('\n').length`로 라인 역산 ② 배럴은 named import를 star 재수출까지 이름 단위로 해석(이번 작업은 그래프 룰이 아니라 무관) ③ typeOnly는 지정자 단위(무관).
- kit-owned 파일(`arch.mjs`, `constitution.md`, `audit-rules.md`, `claude-block.md`, `VERSION`)은 이 저장소가 정본이고, 소비 프로젝트의 사본은 `arch-init` 재실행으로만 갱신된다 — 이 계획은 정본만 수정한다.
- MINOR 버전(5.1.0→5.2.0) — 기존 동작 비호환 변경 없음, 마이그레이션 스크립트 불필요.
- ESM only, `require()` 금지 — 이 파일들은 이미 순수 ESM이므로 유지만 하면 된다.

---

### Task 1: 헌법 A11 조항 추가

**Files:**
- Modify: `skills/svelte-arch/references/constitution.md` (A10 테이블 뒤, `## 2. 트리 정본` 앞)

**Interfaces:**
- Consumes: 없음(문서 전용)
- Produces: 조항 번호 "A11" — Task 2의 감사 룰 설명文과 Task 5의 claude-block.md 요약이 이 번호·문구를 참조

- [ ] **Step 1: A11 조항 삽입**

`skills/svelte-arch/references/constitution.md`에서 다음 문자열(A10 테이블의 마지막 행과 `## 2.` 사이):

```
| `*.service` / `*.repository` | vitest **의무**(repository는 테스트 DB 통합 포함) | vitest |

## 2. 트리 정본 (svelte.config 수술 포함)
```

를 다음으로 교체:

```
| `*.service` / `*.repository` | vitest **의무**(repository는 테스트 DB 통합 포함) | vitest |

### A11. 내부 링크 — `resolve()` 경유 의무, 원본 경로 문자열 직행 금지

- `<a href>`·`goto()`(`$app/navigation`)·`redirect()`(`@sveltejs/kit`)·`<form action>`에 내부 절대경로(`/`로 시작)를 문자열 리터럴로 직접 쓰지 않는다. `$app/paths`의 `resolve()`로 감싼다.
- **정적**: `resolve('/blog')`. **동적**: `resolve('/blog/[slug]', { slug: post.slug })` — 라우트 ID는 실제 디렉터리 표기(`[slug]`) 그대로 1번째 인자에, 값은 2번째 params 객체로 분리(`` resolve(`/blog/${slug}`) `` 템플릿 리터럴 보간은 타입 체크를 무력화하므로 금지).
- **제외**(감지 대상 아님): `http(s)://`·`mailto:`·`tel:`·`//`(프로토콜 상대)로 시작하는 경로, 파일 확장자가 붙은 정적 자원 경로, `#`만 있는 해시.
- **근거**: base path 변경에도 링크가 깨지지 않고, 존재하지 않는 라우트로의 오타를 컴파일 타임 타입 체크가 잡는다.

## 2. 트리 정본 (svelte.config 수술 포함)
```

- [ ] **Step 2: 육안 확인**

`grep -n "A11" skills/svelte-arch/references/constitution.md` 실행 → 1건 출력 확인.

- [ ] **Step 3: 커밋은 Task 6에서 일괄 진행** (이 저장소 관행상 문서+코드+버전을 한 커밋으로 묶는다 — CHANGELOG 이력 참고)

---

### Task 2: 감사 룰 매트릭스 갱신 (53룰)

**Files:**
- Modify: `skills/svelte-arch/references/audit-rules.md`

**Interfaces:**
- Consumes: Task 1의 "A11" 번호(위반 설명 문구에서 참조)
- Produces: 룰 코드 `UNRESOLVED_INTERNAL_LINK` — Task 3의 `arch.mjs` 구현이 이 정확한 문자열을 `code` 필드로 사용해야 함

- [ ] **Step 1: 헤더 룰 카운트 갱신**

`# 감사 룰 매트릭스 — 52룰 (v5, steiger 흡수)` → `# 감사 룰 매트릭스 — 53룰 (v5, steiger 흡수)`

- [ ] **Step 2: B군 카운트 갱신**

`## B군 — 품질 오버레이·클라 (23)` → `## B군 — 품질 오버레이·클라 (24)`

- [ ] **Step 3: B군 테이블 마지막 행(`VENDOR_IMPORT`) 뒤에 신규 행 추가**

```
| `UNRESOLVED_INTERNAL_LINK` | 전체(`.svelte`·`.ts`) | `<a href>`·`goto()`·`redirect()`·`<form action>`에 내부 절대경로 문자열 리터럴 직접 사용 — `resolve()`(`$app/paths`) 미경유(A11) | error |
```

- [ ] **Step 4: 육안 확인**

`grep -n "UNRESOLVED_INTERNAL_LINK\|53룰\|(24)" skills/svelte-arch/references/audit-rules.md` → 3건 확인.

---

### Task 3: `arch.mjs` — `UNRESOLVED_INTERNAL_LINK` 감사 구현

**Files:**
- Modify: `skills/svelte-arch/kit/scripts/arch.mjs`

**Interfaces:**
- Consumes: 기존 `v(f, line, match, code, severity, desc)` 헬퍼(L549), 파일 단위 루프 안의 `f.content`/`f.rel`/`out.push`
- Produces: `collectViolations()` 출력에 `code: 'UNRESOLVED_INTERNAL_LINK'` 항목 — Task 4의 `runAudit` 배너와는 무관(별개 관심사), Task 6의 fixture 검증이 이 코드 문자열을 grep

- [ ] **Step 1: 파일 단위 룰 루프에 검사 블록 추가**

`skills/svelte-arch/kit/scripts/arch.mjs`에서 "세트 부분 구조분해" 블록(다음 텍스트를 검색):

```js
		// 세트 부분 구조분해
		if (/import\s*\{[^}]*\}\s*from\s+['"][@$][^'"]*shared\/ui\/[^/'".]+['"]/.test(f.content))
			f.lines.forEach((line, i) => { if (/import\s*\{[^}]*\}\s*from\s+['"][@$][^'"]*shared\/ui\/[^/'".]+['"]/.test(line)) out.push(v(f, i + 1, line.trim(), 'SET_PARTIAL_IMPORT', 'error', '세트는 import * as 네임스페이스 의무')); });
```

바로 뒤에 다음 블록 삽입:

```js
		// 내부 링크 resolve() 누락 (A11)
		{
			const isAssetOrExternal = (p) => /\.[a-zA-Z0-9]{2,5}(?:[?#].*)?$/.test(p);
			const lineOf = (idx) => f.content.slice(0, idx).split('\n').length;
			for (const m of f.content.matchAll(/<a\b[^>]*\bhref\s*=\s*"\/(?!\/)([^"]*)"/g))
				if (!isAssetOrExternal(m[1])) out.push(v(f, lineOf(m.index), m[0].slice(0, 80), 'UNRESOLVED_INTERNAL_LINK', 'error', '<a href>의 내부 절대경로 문자열 리터럴 — resolve() 경유 의무 (A11)'));
			for (const m of f.content.matchAll(/<form\b[^>]*\baction\s*=\s*"\/(?!\/)([^"]*)"/g))
				if (!isAssetOrExternal(m[1])) out.push(v(f, lineOf(m.index), m[0].slice(0, 80), 'UNRESOLVED_INTERNAL_LINK', 'error', '<form action>의 내부 절대경로 문자열 리터럴 — resolve() 경유 의무 (A11)'));
			if (/from\s+['"]\$app\/navigation['"]/.test(f.content))
				for (const m of f.content.matchAll(/\bgoto\s*\(\s*(['"])\/(?!\/)([^'"]*)\1/g))
					if (!isAssetOrExternal(m[2])) out.push(v(f, lineOf(m.index), m[0].slice(0, 80), 'UNRESOLVED_INTERNAL_LINK', 'error', 'goto()의 내부 절대경로 문자열 리터럴 — resolve() 경유 의무 (A11)'));
			if (/from\s+['"]@sveltejs\/kit['"]/.test(f.content))
				for (const m of f.content.matchAll(/\bredirect\s*\(\s*\d+\s*,\s*(['"])\/(?!\/)([^'"]*)\1/g))
					if (!isAssetOrExternal(m[2])) out.push(v(f, lineOf(m.index), m[0].slice(0, 80), 'UNRESOLVED_INTERNAL_LINK', 'error', 'redirect()의 내부 절대경로 문자열 리터럴 — resolve() 경유 의무 (A11)'));
		}
```

설계 근거:
- `href="/(?!\/)…"`·`action="/(?!\/)…"`는 이중 슬래시(프로토콜 상대) 시작을 제외해 `//example.com` 같은 외부 링크를 걸러낸다.
- `href={resolve('/x')}`처럼 중괄호 표현식으로 감싼 경우 애초에 `href\s*=\s*"..."`(따옴표 리터럴) 패턴에 안 걸린다 — 별도 예외 처리 불필요, 정규식 형태 자체가 올바른 사용을 자연히 배제한다.
- `goto`/`redirect`는 파일에 해당 이름의 SvelteKit import가 실제로 있을 때만 검사해 동명 로컬 함수 오탐을 줄인다(기존 `REMOTE_DB_IMPORT` 룰과 동일한 보수적 스타일).
- `isAssetOrExternal`은 경로 끝(쿼리·해시 앞)에 `.` + 2~5자 확장자가 있으면 정적 자원으로 간주해 제외.

- [ ] **Step 2: 룰 수 주석 갱신**

`// ── audit — 50룰 ─────────────────────────────────────────────────────────` → `// ── audit — 53룰 ─────────────────────────────────────────────────────────`

- [ ] **Step 3: 수동 fixture 검증 — 준비**

```bash
mkdir -p /private/tmp/claude-501/-Users-gimtaehui-IdeaProjects-xiyo-svelte-arch/ee111d6a-be36-44ab-aba8-e1b2f9c9b00f/scratchpad/verify-fixture/src/app/routes
mkdir -p /private/tmp/claude-501/-Users-gimtaehui-IdeaProjects-xiyo-svelte-arch/ee111d6a-be36-44ab-aba8-e1b2f9c9b00f/scratchpad/verify-fixture/.svelte-arch
cd /private/tmp/claude-501/-Users-gimtaehui-IdeaProjects-xiyo-svelte-arch/ee111d6a-be36-44ab-aba8-e1b2f9c9b00f/scratchpad/verify-fixture
echo '{"name":"fixture","scripts":{}}' > package.json
cp /Users/gimtaehui/IdeaProjects/xiyo/svelte-arch/skills/svelte-arch/kit/scripts/arch.mjs .svelte-arch/arch.mjs
```

- [ ] **Step 4: 위반/비위반 샘플 파일 작성**

`src/app/routes/link-cases.view.svelte`:

```svelte
<!-- @component 링크 케이스 픽스처 -->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	type Props = { id: string };
	let { id }: Props = $props();
</script>

<a href="/cycle/settings">위반 — 원본 문자열</a>
<a href={resolve('/cycle/settings')}>정상 — resolve 경유</a>
<a href="https://example.com">정상 — 외부</a>
<a href="//example.com">정상 — 프로토콜 상대</a>
<a href="/favicon.ico">정상 — 정적 자원(확장자)</a>
<form action="/search">위반 — form action</form>

<button onclick={() => goto('/dashboard')}>위반 — goto</button>
<button onclick={() => goto(resolve('/dashboard'))}>정상 — goto+resolve</button>
```

- [ ] **Step 5: audit 실행 — 위반 4건만 잡히는지 확인**

```bash
cd /private/tmp/claude-501/-Users-gimtaehui-IdeaProjects-xiyo-svelte-arch/ee111d6a-be36-44ab-aba8-e1b2f9c9b00f/scratchpad/verify-fixture
bun .svelte-arch/arch.mjs audit --files src/app/routes/link-cases.view.svelte --json | bun -e "const v=JSON.parse(await Bun.stdin.text());console.log(v.filter(x=>x.code==='UNRESOLVED_INTERNAL_LINK').map(x=>x.line+': '+x.match))"
```

Expected: 정확히 2줄 출력(`<a href="/cycle/settings">` 줄과 `<form action="/search">` 줄) — `goto('/dashboard')`는 `import { goto } from '$app/navigation'`이 있으므로도 잡혀야 함(총 3건). resolve로 감싼 것·외부·프로토콜 상대·확장자 자원은 나오면 안 됨.

문제가 있으면 정규식을 조정하고 재실행 — 통과할 때까지 반복.

- [ ] **Step 6: fixture 정리**

```bash
rm -rf /private/tmp/claude-501/-Users-gimtaehui-IdeaProjects-xiyo-svelte-arch/ee111d6a-be36-44ab-aba8-e1b2f9c9b00f/scratchpad/verify-fixture
```

---

### Task 4: `arch.mjs verify` 서브커맨드 + `audit` 배너 연동

**Files:**
- Modify: `skills/svelte-arch/kit/scripts/arch.mjs`

**Interfaces:**
- Consumes: `ROOT`, `KIT_VERSION`, `existsSync`, `readFile`, `execSync`(기존 top-level import 재사용)
- Produces: `collectVerifyChecks(): Promise<{name: string, ok: boolean, detail: string}[]>`, `runVerify(args): Promise<number>` — `main()`의 `cmd === 'verify'` 분기와 `runAudit`이 소비

- [ ] **Step 1: `collectVerifyChecks` + `runVerify` 함수 추가**

`printAudit` 함수 정의 뒤(`// ── analyze ──` 주석 바로 앞)에 삽입:

```js
// ── verify — 설치 풋프린트 버전·무결손 검증 ─────────────────────────────
async function collectVerifyChecks() {
	const checks = [];
	const readIfExists = async (p) => (existsSync(p) ? await readFile(p, 'utf-8') : null);

	const claudeMd = await readIfExists(join(ROOT, 'CLAUDE.md'));
	const claudeM = claudeMd?.match(/svelte-arch:begin\s*\(kit v([\d.]+)/);
	checks.push(claudeM
		? { name: 'CLAUDE.md 마커 블록', ok: claudeM[1] === KIT_VERSION, detail: `v${claudeM[1]}` }
		: { name: 'CLAUDE.md 마커 블록', ok: false, detail: '마커 블록 없음' });

	let hooksPath = '.githooks';
	try { hooksPath = execSync('git config core.hooksPath', { cwd: ROOT }).toString().trim() || hooksPath; } catch { /* 미설정 — 기본값 사용 */ }
	const hook = await readIfExists(join(ROOT, hooksPath, 'pre-commit'));
	const hookM = hook?.match(/svelte-arch:begin\s*\(kit v([\d.]+)/);
	checks.push(hookM
		? { name: `${hooksPath}/pre-commit 마커 블록`, ok: hookM[1] === KIT_VERSION, detail: `v${hookM[1]}` }
		: { name: `${hooksPath}/pre-commit 마커 블록`, ok: false, detail: '마커 블록 없음' });

	checks.push({ name: '.svelte-arch/config.mjs', ok: existsSync(join(ROOT, '.svelte-arch/config.mjs')), detail: '' });
	checks.push({ name: '.svelte-arch/templates/', ok: existsSync(join(ROOT, '.svelte-arch/templates')), detail: '' });

	const want = {
		'arch:manifest': 'bun .svelte-arch/arch.mjs manifest',
		'arch:audit': 'bun .svelte-arch/arch.mjs audit',
		'arch:analyze': 'bun .svelte-arch/arch.mjs analyze',
		'arch:new': 'bun .svelte-arch/arch.mjs new',
		'arch:plan': 'bun .svelte-arch/arch.mjs plan'
	};
	const pkgRaw = await readIfExists(join(ROOT, 'package.json'));
	const scripts = pkgRaw ? (JSON.parse(pkgRaw).scripts ?? {}) : {};
	const missing = Object.entries(want).filter(([k, v2]) => scripts[k] !== v2).map(([k]) => k);
	checks.push({ name: 'package.json scripts', ok: missing.length === 0, detail: missing.length ? `불일치: ${missing.join(', ')}` : `${Object.keys(want).length}/${Object.keys(want).length}` });

	return checks;
}

async function runVerify(args) {
	const checks = await collectVerifyChecks();
	const fail = checks.filter((c) => !c.ok);
	if (args?.has('--json')) {
		console.log(JSON.stringify({ kit: KIT_VERSION, checks, ok: fail.length === 0 }, null, 2));
		return fail.length ? 1 : 0;
	}
	for (const c of checks) console.log(`${c.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
	console.log(fail.length
		? `\n${fail.length}건 불일치 — arch-init 재실행 필요 (bun <플러그인경로>/skills/svelte-arch/kit/init.mjs)`
		: `\n✓ 설치 무결손 확인 (kit v${KIT_VERSION})`);
	return fail.length ? 1 : 0;
}
```

- [ ] **Step 2: `runAudit`에 비차단 배너 연동**

기존:

```js
async function runAudit(args, config, files) {
	const filesArg = args.getList('--files');
	const violations = await collectViolations(files, config, filesArg);
	if (args.has('--json')) console.log(JSON.stringify(violations, null, 2));
	else printAudit(violations);
	return violations.some((x) => x.severity === 'error') ? 1 : 0;
}
```

교체:

```js
async function runAudit(args, config, files) {
	if (!args.has('--json')) {
		const verifyFails = (await collectVerifyChecks()).filter((c) => !c.ok);
		if (verifyFails.length) console.log(`\x1b[33m⚠ 설치 무결손 ${verifyFails.length}건 — bun .svelte-arch/arch.mjs verify 로 확인\x1b[0m\n`);
	}
	const filesArg = args.getList('--files');
	const violations = await collectViolations(files, config, filesArg);
	if (args.has('--json')) console.log(JSON.stringify(violations, null, 2));
	else printAudit(violations);
	return violations.some((x) => x.severity === 'error') ? 1 : 0;
}
```

(의도적으로 exit code는 `violations`만 반영 — verify 실패가 audit·pre-commit을 차단하지 않는다, 스펙의 "비차단" 요구사항.)

- [ ] **Step 3: `main()` 커맨드 분기 + usage 문자열 + 헤더 주석 갱신**

기존:

```js
	if (cmd === 'plan') return runPlan(args);
	if (cmd === 'new') return runNew(positionals);
	if (isLegacyTree() && ['manifest', 'audit', 'analyze'].includes(cmd)) { legacyNotice(`arch:${cmd}`); return 0; }
	const files = await collectFiles();
	if (cmd === 'manifest') return runManifest(args, config, files);
	if (cmd === 'audit') return runAudit(args, config, files);
	if (cmd === 'analyze') return runAnalyze(args, config, files);
	console.error('사용법: arch.mjs <manifest|audit|analyze|new|plan|version> [옵션]');
	return 2;
```

교체:

```js
	if (cmd === 'plan') return runPlan(args);
	if (cmd === 'new') return runNew(positionals);
	if (cmd === 'verify') return runVerify(args);
	if (isLegacyTree() && ['manifest', 'audit', 'analyze'].includes(cmd)) { legacyNotice(`arch:${cmd}`); return 0; }
	const files = await collectFiles();
	if (cmd === 'manifest') return runManifest(args, config, files);
	if (cmd === 'audit') return runAudit(args, config, files);
	if (cmd === 'analyze') return runAnalyze(args, config, files);
	console.error('사용법: arch.mjs <manifest|audit|analyze|new|plan|verify|version> [옵션]');
	return 2;
```

(`verify`는 소스 파일 스캔이 불필요하므로 `collectFiles()` 이전, `plan`/`new`와 같은 자리에 배치 — legacy 트리 여부와도 무관하게 항상 동작해야 한다.)

파일 상단 사용법 주석(L8-14)의:

```
 *   bun arch.mjs audit    [--files <p...>] [--json]
 *   bun arch.mjs analyze  [--json]
```

사이에 한 줄 추가:

```
 *   bun arch.mjs audit    [--files <p...>] [--json]
 *   bun arch.mjs verify   [--json]
 *   bun arch.mjs analyze  [--json]
```

- [ ] **Step 4: 수동 검증**

Task 3의 fixture를 재사용(또는 재생성)해 아래 실행:

```bash
cd <fixture 경로>
bun .svelte-arch/arch.mjs verify
```

Expected: `CLAUDE.md`·pre-commit 마커·config.mjs·templates/·package.json scripts 5종 전부 `✗`(fixture엔 아무것도 없으므로) + 마지막 줄 "N건 불일치 — arch-init 재실행 필요" 출력, exit code 1(`echo $?`로 확인). 크래시 없이 끝까지 실행되는지가 핵심 — 필드별 ok/detail 값은 위 항목대로 전부 false여야 정상.

이어서 `bun .svelte-arch/arch.mjs audit --files src/app/routes/link-cases.view.svelte` 실행 시 맨 위에 노란 "⚠ 설치 무결손 5건 …" 배너가 뜨고, 그 아래 룰 위반 목록이 정상 출력되며 exit code는 룰 위반(error 존재) 기준으로만 결정되는지 확인.

---

### Task 5: 버전 범프 + 부속 문서 갱신

**Files:**
- Modify: `skills/svelte-arch/kit/VERSION`
- Modify: `skills/svelte-arch/kit/scripts/arch.mjs` (KIT_VERSION 상수)
- Modify: `skills/svelte-arch/kit/templates/claude-block.md`
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: Task 1~4에서 확정된 조항 번호(A11)·룰 코드(`UNRESOLVED_INTERNAL_LINK`)·명령어(`verify`)
- Produces: kit v5.2.0 — 이후 소비 프로젝트의 `arch-init` 재실행 시 이 버전으로 수렴

- [ ] **Step 1: VERSION 파일**

`skills/svelte-arch/kit/VERSION` 내용을 `5.1.0` → `5.2.0`으로 교체(개행 유지).

- [ ] **Step 2: arch.mjs의 KIT_VERSION 상수**

`const KIT_VERSION = '5.1.0';` → `const KIT_VERSION = '5.2.0';`

- [ ] **Step 3: claude-block.md 핵심 금칙에 한 구절 추가**

기존:

```
- **핵심 금칙**: 같은 계층 slice 수평 import 금지(type-only는 index 경유만) · 타 slice는 public API(index)로만, shared는 딥 임포트만 · remote → service만(건너뛰기 0)·값 export 금지 · +page.server는 가드·메타 전용(수급: remote→universal→page.server→endpoint) · 클래스는 내장 `class={[...]}` 배열만, `class`/`*Class` prop은 `string`이 아닌 `ClassValue`(svelte/elements)로 타입 · view의 `$app/state` 금지(prop 주입).
```

교체:

```
- **핵심 금칙**: 같은 계층 slice 수평 import 금지(type-only는 index 경유만) · 타 slice는 public API(index)로만, shared는 딥 임포트만 · remote → service만(건너뛰기 0)·값 export 금지 · +page.server는 가드·메타 전용(수급: remote→universal→page.server→endpoint) · 클래스는 내장 `class={[...]}` 배열만, `class`/`*Class` prop은 `string`이 아닌 `ClassValue`(svelte/elements)로 타입 · view의 `$app/state` 금지(prop 주입) · 내부 링크(`<a href>`·`goto`·`redirect`·`<form action>`)는 `resolve()`(`$app/paths`) 경유 — 원본 경로 문자열 직행 금지.
```

- [ ] **Step 4: README.md 룰 카운트**

`3. **그래도 만들면** → \`bun run arch:audit\`(52룰 — steiger의 no-layer-public-api·insignificant-slice 등 흡수)가 커밋 차단` → `52룰` → `53룰`.

- [ ] **Step 5: CHANGELOG.md 최상단에 신규 항목 추가**

`# Changelog` 바로 뒤, 기존 `## 5.1.0 — 2026-07-05` 항목 앞에 삽입:

```
## 5.2.0 — 2026-07-05

**신규 조항 A11 + 룰 `UNRESOLVED_INTERNAL_LINK`(error, 52→53룰)** — 소비 프로젝트에서 반복 발견된 실수: `<a href="/cycle/settings">`처럼 SvelteKit 내부 절대경로를 문자열 리터럴로 직접 쓰고 `$app/paths`의 `resolve()`를 누락. base path 변경 시 깨지고 타입 세이프 라우트 검증이 무력화된다. `<a href>`·`goto()`·`redirect()`·`<form action>` 4개 호출부를 정규식으로 감사(문자열 리터럴 직접 사용만 대상 — `resolve()` 표현식으로 감싼 경우는 애초에 패턴 자체가 다르므로 자연히 제외). 외부 프로토콜·프로토콜 상대·정적 자원(확장자)·해시는 감지 대상 아님.

**신규 명령 `arch.mjs verify`** — kit 설치 풋프린트(CLAUDE.md 마커 블록·pre-commit 마커 블록·package.json scripts 5종·config.mjs·templates/)가 서로 다른 버전을 가리키며 반쪽 상태로 어긋나는 것을 감지한다. "지금 설치가 스킬 최신 버전인가"는 범위 밖(그건 `arch-init` 재실행 시 에이전트가 계속 담당) — 이 명령은 "설치물 자체가 내부적으로 일관되는가"만 본다. `audit` 실행 시 결과에 영향 없는 비차단 배너로 자동 선행.

- **constitution.md**: §1에 A11 조항 신설.
- **audit-rules.md**: B군에 `UNRESOLVED_INTERNAL_LINK` 행 추가(52→53룰), 헤더·B군 카운트 갱신.
- **claude-block.md**: 상시 로드 요약 카드의 "핵심 금칙"에 한 구절 반영.
- **README.md**: 3중 방어 섹션 룰 카운트 53룰로 갱신.

```

(기존 5.1.0 항목 이하는 그대로 둔다.)

- [ ] **Step 6: 육안 확인**

```bash
grep -n "5.2.0" skills/svelte-arch/kit/VERSION skills/svelte-arch/kit/scripts/arch.mjs CHANGELOG.md
```

3개 파일 모두에서 매치되는지 확인.

---

### Task 6: 최종 검토 · 커밋 · 푸시

**Files:** 없음(git 작업만)

- [ ] **Step 1: 전체 diff 리뷰**

```bash
git status
git diff
```

Task 1~5에서 의도한 파일만 변경됐는지 확인(스크래치 fixture는 저장소 밖이라 diff에 나오지 않아야 함).

- [ ] **Step 2: 커밋**

```bash
git add skills/svelte-arch/references/constitution.md \
        skills/svelte-arch/references/audit-rules.md \
        skills/svelte-arch/kit/scripts/arch.mjs \
        skills/svelte-arch/kit/VERSION \
        skills/svelte-arch/kit/templates/claude-block.md \
        README.md CHANGELOG.md
git commit -m "$(cat <<'EOF'
feat: v5.2.0 — 헌법 A11(resolve() 경유) + 신규 룰 UNRESOLVED_INTERNAL_LINK(53룰) + arch.mjs verify

소비 프로젝트에서 반복된 실수(<a href="/...">가 resolve() 누락)를 헌법
조항과 감사 룰로 고정하고, kit 설치 풋프린트(CLAUDE.md 마커·pre-commit
마커·package.json scripts)가 반쪽 상태로 어긋나는 것을 감지하는
arch.mjs verify 명령을 추가한다.
EOF
)"
```

- [ ] **Step 3: 커밋 확인**

```bash
git log -1 --stat
```

- [ ] **Step 4: 푸시**

```bash
git push
```

(사용자가 명시적으로 커밋·푸시를 요청했으므로 이 단계는 승인 재확인 없이 진행한다.)

- [ ] **Step 5: 결과 보고**

푸시 완료 후 커밋 해시·변경 파일 목록·`git push` 출력(원격 브랜치 갱신 여부)을 사용자에게 보고한다.
