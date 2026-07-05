# 설계 — `resolve()` 헌법 조항 + 설치 무결손 검증 (`arch.mjs verify`)

날짜: 2026-07-05
버전 목표: kit v5.1.0 → v5.2.0 (MINOR — 룰 추가 + 신규 명령어)

## 배경

`<a href="/cycle/settings">`처럼 SvelteKit 내부 절대경로를 문자열 리터럴로 직접 쓰고 `$app/paths`의 `resolve()`를 누락하는 실수가 반복 발생. base path 변경 시 깨지고, 타입 세이프 라우트 검증(`resolve()`가 실제 라우트 존재 여부를 컴파일 타임에 검증)이 무력화된다. 이를 헌법 조항 + 감사 룰로 고정한다.

동시에, kit 버전이 올라갈 때 프로젝트에 설치된 여러 풋프린트(`​.svelte-arch/arch.mjs`, 루트 `CLAUDE.md` 마커 블록, pre-commit 훅 마커 블록, `package.json` scripts)가 **부분적으로만 갱신되어 서로 다른 버전을 가리키는 상태**(반쪽 설치)를 감지할 수단이 없다. `arch-init` 재실행 시점의 마이그레이션 로직(`init.mjs`)은 있으나, 그 사이 기간에 설치 상태를 스스로 점검할 방법이 없다. `arch.mjs verify` 명령으로 이를 메운다.

## 범위 — 이번 설계에 포함되지 않는 것

- "지금 설치가 스킬의 **최신** 버전인가"는 이 설계의 범위 밖이다. 설치된 `.svelte-arch/arch.mjs`는 플러그인 소스에 대한 참조가 없는 독립 사본이라 네트워크·플러그인 경로 접근이 불가능하다. 이 판단은 지금처럼 `arch-init` 재실행 시 에이전트가 `kit/VERSION`과 프로젝트 매니페스트 1행을 비교하는 방식으로 계속 담당한다.
- `verify`는 "설치물 자체가 내부적으로 일관된 상태인가"만 검증한다.

## 기능 1 — 헌법 조항 A11 + 감사 룰 `UNRESOLVED_INTERNAL_LINK`

### 헌법(`constitution.md`) §1 신설 조항 A11

> **A11. 내부 링크 = `resolve()` 경유 — 원본 경로 문자열 직행 금지**
>
> `<a href>`·`goto()`(`$app/navigation`)·`redirect()`(`@sveltejs/kit`)·`<form action>`에 내부 절대경로(`/`로 시작)를 문자열 리터럴로 직접 쓰지 않는다. `$app/paths`의 `resolve()`로 감싼다.
> - 정적: `resolve('/blog')`
> - 동적: `resolve('/blog/[slug]', { slug: post.slug })` — 라우트 ID는 실제 디렉터리 표기(`[slug]`) 그대로 1번째 인자에, 값은 2번째 params 객체로 분리. 템플릿 리터럴 보간(`resolve(\`/blog/${slug}\`)`)은 타입 체크를 무력화하므로 금지.
> - **제외**(정적/외부 자원 — 룰 감지 대상 아님): `http(s)://`·`mailto:`·`tel:`·`//`(프로토콜 상대)로 시작하는 경로, 파일 확장자(`.png`·`.svg`·`.pdf`·`.ico` 등)가 붙은 정적 자원 경로, `#`만 있는 순수 해시.
> - **근거**: base path 변경에도 링크가 깨지지 않고, 존재하지 않는 라우트로의 오타를 컴파일 타임 타입 체크가 잡는다.

### 감사 룰 (audit-rules.md B군 — 24번째 항목으로 추가, 총 53룰)

| 코드 | 대상 | 위반 | 심각도 |
|---|---|---|---|
| `UNRESOLVED_INTERNAL_LINK` | 전체(`.svelte`·`.ts`) | `<a href="/…">`·`goto('/…')`·`redirect(status, '/…')`·`<form action="/…">`에 내부 절대경로 문자열 리터럴 직접 사용 — `resolve()` 미경유 | error |

### 구현 방침 (`arch.mjs` 감사 엔진)

- 기존 감사 원칙 유지: AST 파싱 대신 정규식 매칭.
- 4개 호출부 패턴을 개별 정규식으로 매칭한 뒤, 다음 제외 패턴에 걸리면 스킵:
  - `^https?://`, `^mailto:`, `^tel:`, `^//`
  - 확장자 보유(`\.[a-z0-9]{2,5}$` 형태의 경로 끝)
  - `^#`만 있는 경우
- 이미 `resolve(` 호출로 감싸진 경우(즉 문자열 리터럴이 `resolve(...)` 인자 안에 있는 경우)는 당연히 위반 아님 — 매칭 대상은 `href=`/`action=` 속성 값이 **문자열 리터럴 자체**이거나, `goto`/`redirect` 인자가 **문자열 리터럴 자체**인 경우로 한정(표현식·변수·`resolve()` 호출 결과는 대상 아님).
- 상세 정규식·엣지 케이스(예: 삼항식 안의 href, 템플릿 리터럴 href)는 구현 계획(writing-plans) 단계에서 기존 코드 스타일(예: `CLASS_PROP_STRING_TYPE` 구현부)을 참고해 확정한다.

## 기능 2 — `arch.mjs verify`

### 검사 항목

자기 자신(`이 스크립트 파일`)에 박힌 `KIT_VERSION` 상수를 기준점으로 삼아 아래를 비교:

| 항목 | 확인 방법 | 불일치 시 |
|---|---|---|
| 루트 `CLAUDE.md` 마커 블록 버전 | `<!-- svelte-arch:begin (kit vX.Y.Z` 정규식 추출 → `KIT_VERSION`과 일치? | ✗ 보고 |
| pre-commit 훅 마커 블록 버전 | `git config core.hooksPath`(미설정 시 `.githooks`) 하위 `pre-commit` 파일의 `# >>> svelte-arch:begin (kit vX.Y.Z` 추출 → 일치? | ✗ 보고 |
| `.svelte-arch/config.mjs` 존재 | 파일 존재 여부 | ✗ 보고 (project-owned 씨앗 유실) |
| `.svelte-arch/templates/` 존재 | 디렉터리 존재·비어있지 않음 | ✗ 보고 |
| `package.json` scripts 5종 | `arch:manifest`·`arch:audit`·`arch:analyze`·`arch:new`·`arch:plan` 키와 값이 `init.mjs`의 `want` 목록과 정확히 일치 | ✗ 보고 |

### 출력 형식

```
bun .svelte-arch/arch.mjs verify

✓ CLAUDE.md 마커 블록 (v5.1.0)
✗ pre-commit 마커 블록 (v5.0.0 — arch.mjs v5.1.0과 불일치)
✓ .svelte-arch/config.mjs
✓ .svelte-arch/templates/
✓ package.json scripts (5/5)

1건 불일치 — arch-init 재실행 필요 (bun <플러그인경로>/skills/svelte-arch/kit/init.mjs)
```

전체 통과 시 `exit 0`, 하나라도 불일치 시 `exit 1`(CI 게이팅 가능).

### `audit`와의 연동

`arch.mjs audit` 진입부에서 동일 검증 로직을 내부 호출해 결과를 배너로 먼저 출력한다. **비차단** — 아키텍처 룰 위반(52+1룰)과는 별개 관심사이므로 verify 실패가 audit의 exit code나 커밋 차단에 영향을 주지 않는다. 배너만 노출해 사용자가 인지하도록 한다.

## CHANGELOG / 버전

- `kit/VERSION`: `5.1.0` → `5.2.0` (MINOR — 룰 추가 + 신규 명령어, 기존 동작 비호환 변경 없음)
- `CHANGELOG.md`에 조항 A11·룰 `UNRESOLVED_INTERNAL_LINK`(53번째)·`arch.mjs verify` 신설 기록
- README.md 룰 카운트 "52룰" → "53룰" 갱신 필요 (3중 방어 섹션)

## 영향받는 파일 (구현 계획에서 상세화)

- `skills/svelte-arch/references/constitution.md` — A11 조항 추가
- `skills/svelte-arch/references/audit-rules.md` — B군 룰 표 갱신, 헤더 "52룰" → "53룰"
- `skills/svelte-arch/kit/scripts/arch.mjs` — `KIT_VERSION` 값 갱신, `UNRESOLVED_INTERNAL_LINK` 검사 추가, `verify` 서브커맨드 추가, `audit`에서 verify 배너 호출, `--help`/사용법 문자열에 `verify` 추가
- `skills/svelte-arch/kit/VERSION` — `5.2.0`
- `README.md` — 룰 카운트 갱신
- `CHANGELOG.md` — 항목 추가
