# 설계 — src 밖 spec 소비자 루트(`tests`·`e2e`) 설정화 (`specRoots`)

날짜: 2026-07-10
버전 목표: 채택 시 MINOR (신규 config 키 — 기본값이 현행과 동일해 기존 동작 비호환 변경 없음)
접수 경위: `/arch-feedback` — 소비 프로젝트 **able-gpt**에서 발견

## 요구사항 (원문 요약)

arch.mjs가 e2e 디렉터리명 `e2e`를 하드코딩한 2곳을, e2e 폴더를 다른 이름(예: `playwright/`)으로 쓰는 프로젝트가 소외되지 않도록 `config.mjs` 오버라이드 또는 동적 해석으로 개선해 달라.

## 배경 — 왜 `e2e`라는 이름을 보장할 수 없나

able-gpt는 2026-07-10에 `e2e/` → `playwright/` 리네임을 단행했다. 동기:

1. **Playwright 공식 auth 컨벤션과 네임스페이스 통합** — 공식 문서가 인증 상태 파일을 `playwright/.auth/user.json`(gitignore)에 둘 것을 권장한다. e2e 스위트(`auth.setup.ts`·`global-setup.ts`·spec들)와 그 산출물(`.auth/`·`.tc-state.json`)이 `playwright/` 한 디렉터리로 모인다.
2. **`tests/` 선점** — SvelteKit 공식 스캐폴드의 e2e 기본 폴더는 `tests/`지만, able-gpt는 그 이름을 이미 vitest 통합테스트(Testcontainers, `tests/services/**`)가 쓰고 있어 채택 불가.
3. **생태계 표준 부재** — e2e 폴더명은 사실상 프로젝트 취향이다: SvelteKit 스캐폴드 = `tests/`, cal.com = `playwright/`, Supabase 계열 = `e2e/`. "하나의 최상위 폴더 = 하나의 테스트 러너" 원칙을 지키는 프로젝트라면 어떤 이름이든 나올 수 있다.

즉 `e2e`는 kit이 강제한 적 없는 이름인데, arch.mjs 2곳이 이를 전제한다.

## 현행 동작 분석 — 하드코딩 2곳과 실영향

kit v5.6.0 `kit/scripts/arch.mjs` 기준:

### ① `SPEC_PLACEMENT` 룰의 안내 문구 (661·666행) — 기능 무해, 안내만 어긋남

```js
// spec 배치 — 유닛 spec은 검증 대상과 콜로케이션(같은 폴더 동일 Base). 통합=tests/ · e2e=e2e/ (src 밖, FSD 계층 밖)
… 'src 안 spec은 검증 대상과 콜로케이션(같은 폴더 동일 Base) 의무 — 대상 없는 spec은 통합(tests/)·e2e(e2e/)로'
```

판정 로직 자체는 `locate()`가 `src/` 밖 전부를 `area:'other'`로 분류해 폴더 이름과 무관하게 면제하므로 **오탐·미탐은 없다**. 그러나 위반 시 개발자가 읽는 처방 문구가 "e2e는 `e2e/`로"라고 안내해, `playwright/`를 쓰는 프로젝트에서는 실구조와 어긋난 지시가 된다(신규 합류자가 문구를 따라 `e2e/`를 신설하는 역주행 유도 가능).

### ② `plan()`의 임포트 재작성 소비자 루트 (1249~1251행) — 실손상 가능

```js
// 임포트 재작성 — src 밖 소비자(tests·e2e)도 $lib/@ 절대 스펙을 쓰므로 포함(이동은 없음, 재작성만)
for (const consumerRoot of ['src', 'tests', 'e2e']) {
```

`arch:plan --apply`(구 구조 → FSD 이행)가 파일을 이동시킨 뒤 `$lib/`·`@/` 절대 임포트를 재작성할 때 순회하는 소비자 루트가 하드코딩이다. e2e 폴더가 `playwright/`(또는 다른 이름)인 프로젝트는 **그 폴더의 spec·헬퍼가 이동된 모듈을 계속 옛 경로로 import**하게 되어, 이행 직후 e2e 스위트가 모듈 해석 실패로 전멸한다. 단 `plan`은 이행기 1회성 도구라 이미 FSD 이행이 끝난 프로젝트(able-gpt 포함)에는 현재 실피해가 없다 — 앞으로 이행할 프로젝트에서 터지는 지뢰다.

## 대안 비교

### A. `config.mjs` 오버라이드 — `specRoots` (권장)

```js
// .svelte-arch/config.mjs (project-owned)
export default {
	// src 밖 spec 소비자 루트 — kit 기본값과 다를 때만 선언
	specRoots: { integration: 'tests', e2e: 'playwright' },
	…
};
```

- arch.mjs는 `config.specRoots ?? { integration: 'tests', e2e: 'e2e' }`로 읽어 ①의 문구를 동적 생성(`통합(${r.integration}/)·e2e(${r.e2e}/)`)하고 ②의 순회 목록을 `['src', r.integration, r.e2e]`로 구성.
- 장점: `config.mjs`가 이미 프로젝트 확장 단일 지점으로 존재(`neutralLiterals`·`serverInfraSlices`·`heavyReexportMax` 전례) — 새 메커니즘 0. 기본값이 현행과 동일해 기존 소비 프로젝트 무영향(순수 additive MINOR). 결정적(파싱·추측 없음)이라 arch.mjs의 "정규식·무 AST" 순수 CLI 성격 유지.
- 단점: 리네임한 프로젝트가 한 줄 선언해야 함(선언 안 하면 현행과 동일하게 소외 — 단 `arch:plan` 실행 시 선언 안 된 비표준 루트를 감지해 followup 경고를 내는 보강 가능).

### B. `playwright.config.*`의 `testDir` 동적 해석

- 장점: 프로젝트 설정 0.
- 단점: `testDir`이 변수·계산식·다중 프로젝트(`projects[].testDir`)면 정규식 파싱이 깨진다. e2e 러너가 Playwright가 아닐 수도 있다(WebdriverIO·Cypress). arch.mjs에 외부 도구 설정 파싱이라는 새 결이 생긴다 — "정규식·무 AST" 원칙과 정면 충돌. 기각.

### C. 후보 목록 확장 하드코딩 — `['e2e', 'playwright']`

- 장점: diff 최소.
- 단점: 다음 이름(`tests-e2e/`, `integration-e2e/`…)에서 재발. 존재하지 않는 폴더를 매번 순회(무해하나 무의미). ①의 문구는 여전히 특정 이름을 박아야 해 근본 해결이 아님. 기각.

## 권고

**대안 A(`specRoots` config 키)** 채택. 구현 시:

1. `arch.mjs` — config 로드부에 `specRoots` 기본값 병합, ① 문구 동적 생성, ② 순회 목록 치환. 룰 저작 불변식 3조 재확인 대상(①은 메시지 문자열만이라 매칭 로직 무변경, ②는 plan 경로라 감사 룰 아님).
2. `kit/config.template.mjs`(초기 스캐폴드) — 주석으로 `specRoots` 키 안내 추가(기본값 선언은 생략 — 다를 때만 선언).
3. `references/constitution.md`·`audit-rules.md` — SPEC_PLACEMENT 항의 "통합=tests/ · e2e=e2e/" 서술을 "통합·e2e 루트(기본 `tests`/`e2e`, `config.specRoots`로 오버라이드)"로 갱신.
4. `arch:plan` 보강(선택) — 루트 후보 스캔에서 spec 파일을 품은 미선언 최상위 폴더를 발견하면 followup으로 `specRoots` 선언을 제안.

## 후속

이 문서는 제안만 담는다(설계급 — 코드·버전 변경 없음). 채택 시 별도 세션이 plan → 구현하며, 그 시점에 MINOR bump + CHANGELOG + 버전 4소스 동기화를 수행한다.
