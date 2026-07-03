# 헌법 — SvelteKit 풀스택 파일 종별 아키텍처 v3

> 규범 전문. 요약은 SKILL.md, 감사 구현은 audit-rules.md, 매니페스트는 manifest-protocol.md.
> 모든 조항은 도구·프로젝트 무관(도메인 0%). 프로젝트 특화 규칙은 각 레포의 `.svelte-arch/config.mjs`와 CLAUDE.md가 갖는다.

## 0. 메타규칙

- **R0 — 규칙은 종별을 지명한다**: 모든 규칙(감사·문서·체크리스트)은 적용 대상 파일 종별을 명시해야 한다. `.svelte 전체` 같은 몰빵 타깃은 규칙 형식 위반. 종별을 못 짚는 규칙은 덜 설계된 규칙이다.
- **R1 — 파일명이 역할을 선언한다**: 종별은 파일명 접미사(또는 SvelteKit 예약명)로 표현된다. 디렉토리는 **소속**(도메인·선반)을, 파일명은 **역할**(계층·종별)을 말한다 — 두 축은 서로 검증한다.
- **R2 — 규칙에는 근거가 붙는다**: 각 조항은 "왜"를 가진다. 근거가 사라진 규칙은 폐기 후보다.

## 1. 횡단 공리

### A1. 의존 단방향

```text
클라: +page/+layout(글루) → *.live → *.composite → *.primitive → (ui/ vendor: primitive만)
서버: *.remote → *.service → *.repository → db schema
연결: *.live → *.remote (wire 소비) · *.svelte.ts(클라 상태) ← live만
```

역방향·수평(도메인 간) import 전부 금지. 공유가 필요하면 승격(discipline.md)이 유일한 통로.

**근거**: 계층 격리 = 테스트 격리. live/remote는 런타임 결합부라 테스트가 어렵다 — 로직을 0으로 만들어(humble object) 로직 전부를 테스트 가능한 층(dumb·service)으로 밀어낸다.

### A2. 전면 마킹 불변식

레포의 모든 `.svelte` 파일은 다음 중 하나다: **글루**(`+page`/`+layout`/`+error`) · **마킹된 컴포넌트**(`.primitive`/`.composite`/`.live`) · **부속**(`.stories`) · **vendor**(`ui/**`). 여기 안 속하는 `.svelte`는 존재 자체가 위반(`UNMARKED_COMPONENT`). 팀 영역 안에 예외 0 — icons도 `.primitive.svelte`로 마킹한다.

### A3. 타입 SSOT — 같은 모양을 두 번 선언하지 않는다

1. 정본 계보: DB 행(스키마 infer) → service DTO → **remote 반환 타입 = wire 계약 정본**(`export type`) → dumb Props는 참조만.
2. 구조 재타이핑 금지 — 좁힐 땐 `Pick`/`Omit`/`Partial` 파생만.
3. dumb의 참조 경로: `import type { X } from '…remote'` (type-only는 빌드 시 소멸 — cross-domain도 type-only는 허용).
4. `$lib/types/<이름>.ts`는 특정 remote에 종속되지 않는 타입만(여러 remote 공유·클라 전용 뷰모델).
5. primitive는 도메인 타입 import 금지 — 자기 무도메인 타입을 선언하고 그게 정본.
6. 컴포넌트 Props를 밖에서 쓸 땐 `ComponentProps<typeof X>` — 재선언 금지.

### A4. 발견성 = 실행형 매니페스트

"무엇이 있는가"는 파일(문서)이 아니라 **실행**(`arch:manifest`)이 답한다 — 항상 최신, LLM 주입 1순위. 배럴·수기 인벤토리 문서에 발견성 역할을 맡기지 않는다.

### A5. 배럴 정책 — 세트만 합법

- **금지**: 계층·도메인 루트의 집계 배럴(`primitive/index.ts`, `<domain>/index.ts`). 무관 모듈 집계 = 그래프 오염(하나만 써도 전부 로드·HMR 연쇄·순환 위험).
- **허용**: **세트 배럴** `primitive/<set>/index.ts` — compound 위젯 한 개의 부품만 재수출(§5).
- 임포트는 전 계층 **딥 임포트**: `$lib/components/primitive/Button.primitive.svelte`. 세트만 네임스페이스 임포트(`import * as Card from '…/card'`).

### A6. 소비 규율 (5조 — 상세는 discipline.md)

① 그리기 전 매니페스트 ② 있으면 소비, 모자라면 variant ③ Rule of Two(두 번째 손구현 = 승격 시점) ④ 이스케이프 해치는 일회성(같은 해치값 2파일 = 위반) ⑤ primitive에 도메인 기본값 금지.

### A7. 명명 공리

- **Base 전역 유일**: 컴포넌트 Base명(접미사 앞부분)은 레포 전역 유일 — 도메인어·화면명으로 보장.
- **`Section` 예약어**: "+page가 마운트하는 화면 루트"만 Section. 서브폼·부품에 금지.
- **콜백 = camelCase `onXxx`** (`onConfirm`·`onSearch`·`onTabChange`): 선언 콜백(camel)과 DOM passthrough(`onclick`, lowercase)가 시각 구분되는 게 기능적 신호.
- **상태 prop 표준명**: `loading` / `error` / `disabled` — isLoading·busy 발명 금지. boolean은 형용사형(is/has 접두 금지).
- **`$bindable` 허용**: 입력값(value)·열림(open)·참조(ref)만. 파생 결과 bind 금지.
- 같은 역할 다른 이름(Modal vs Dialog) 금지 — 신설 전 매니페스트 검색.

### A8. 디렉토리 자기서술 (README 체계) — 전 디렉토리 강제

- **관장 트리(`src/lib/**` — routes 제외)의 모든 디렉토리는 `README.md` 의무.** 그 디렉토리가 무엇인지 서술하지 않는 폴더는 존재 자체가 위반(`MISSING_README`, error). 형식: `# <폴더> — 역할 한 줄` + 여기 두는 것/두지 않는 것 + 헌법 카드 링크. 규칙 본문 미러링 금지(link, don't mirror).
- 강제가 현실이 되도록 **kit 설치·업데이트가 README 씨앗을 자동 생성**한다(빈 폴더 포함) — 사람은 씨앗의 역할 1행을 다듬을 뿐, 부재 상태가 생기지 않는다.
- 루트 CLAUDE.md의 게이트 지시(마커 블록): **"작업 디렉토리(및 상위)에 README.md가 있으면 편집 전 반드시 읽는다."**
- README 1행은 매니페스트의 도메인 설명으로 추출된다 — 폴더 서술도 LLM 주입에 합류.

### A9. 클래스 합성 — `class={[...]}` 배열 단일 규약 (강제)

- 조건부·합성 클래스는 **Svelte 5.16+ 내장 `class={[...]}` 배열만** 사용한다: `class={['rounded p-2', active && 'bg-accent']}`.
- 팀 레이어(primitive·composite·live·글루)에서 `cn`/`clsx`/`tailwind-merge`/`classnames` import 금지, 템플릿 리터럴 클래스(`` class={`… ${x}`} ``) 금지, 컴포넌트 태그에 문자열 `class="…"` 금지(배열로).
- **근거**: 배열 리터럴이어야 정적 분석이 정확하다 — 린터·클래스 정렬(prettier-plugin-tailwindcss)·감사 정규식·매니페스트가 클래스를 읽을 수 있다. `cn()` 래퍼와 템플릿 문자열은 클래스를 분석기에서 숨긴다. 그리고 내장 배열이 clsx를 이미 내장하므로 외부 유틸은 순수 중복.
- 예외: `ui/`(vendor)는 자기 유틸(cn 등)을 쓴다 — 불가침 원칙이 우선.

### A10. 테스트 티어

| 종별 | 의무 | 도구 |
|---|---|---|
| `.primitive` | 상태 매트릭스 격리 렌더 **의무** (variant×상태) | 스토리 또는 `*.svelte.spec.ts` |
| `.composite`(Section) | 4상태(loading/empty/error/filled) **권장** | mock props 스토리 |
| `.live` / `.remote` | 전용 테스트 **불요** — 로직 0이 규칙 (로직이 생기면 추출이 처방) | e2e가 배선만 커버 |
| `*.svelte.ts` | 테스트 가능해야 함 (추출의 존재 이유) | vitest client |
| `.service` / `.repository` | vitest **의무** | 통합(테스트 DB) 포함 |

## 2. 디렉토리 트리 (정본)

```text
src/lib/components/
├── ui/                      # vendor 보존 — 불가침, primitive만 래핑 소비
├── primitive/               # 도메인 무지 선반 — flat (기능군 하위폴더 금지)
│   ├── Button.primitive.svelte
│   ├── icons/               # 커스텀 아이콘 (정리용 폴더 — 파일은 동일 마킹)
│   │   └── MicIcon.primitive.svelte
│   └── card/                # 세트 폴더 (compound 위젯일 때만)
│       ├── index.ts
│       └── CardRoot.primitive.svelte …
├── layout/                  # 앱 셸 = 특수 도메인 (도메인 폴더와 상호 참조 금지)
└── <domain>/                # 도메인 폴더 (composite 껍데기 없음 — 도메인이 1급)
    ├── FooListSection.composite.svelte
    ├── FooListSection.live.svelte
    └── FooListItem.composite.svelte

src/lib/data/<domain>.remote.ts        # wire 경계
src/lib/server/**/<이름>.service.ts    # 업무 규칙
src/lib/server/**/<이름>.repository.ts # 데이터 접근
src/lib/state/<이름>.svelte.ts         # 클라 전역 상태 (live 전용 소비)
```

- 도메인 폴더 신설 기준: 사이드바 IA 1급 단위(라우트 그룹)당 1폴더. 화면 1개짜리는 기존 도메인에.
- primitive 선반은 **flat** — 분류는 매니페스트·접미사가 하고, 폴더 분류는 논쟁만 낳는다. 하위 폴더는 icons/(정리용)와 세트 폴더만.
- 도메인 파일 정렬: Base가 화면명으로 시작하므로 알파벳 정렬 = 화면별 클러스터링. 화면 하위폴더 금지.

## 3. 파일 종별 카드

> 카드 스키마: 정의 / 위치·이름 / 임포트 허용·금지 / 필수 앵커 / 소유·책임 / 금칙 / 테스트 / 매니페스트 / 대표 감사 룰. 팀원·에이전트는 **편집할 파일의 카드 하나만** 보면 된다.

### 3.1 `*.primitive.svelte` — 디자인 시스템

- **정의**: 도메인을 전혀 모르는 재사용 UI. 판정: 다른 제품에 폴더째 복사해도 그대로 성립하는가.
- **위치·이름**: `primitive/` (선반 flat) · `<Role>.primitive.svelte` — Base에 도메인어 금지. 원자성은 기준 아님(내부가 조립이어도 도메인 무지면 primitive).
- **임포트 허용**: 다른 primitive(딥) · headless 라이브러리(bits-ui 등) · `ui/` vendor 래핑 · 아이콘 라이브러리 · 순수 유틸.
- **임포트 금지**: `$lib/data` · `$lib/server` · `$lib/state` · `.composite`/`.live` · `$app/navigation`·`$app/state`(링크는 `href` prop으로 받아 렌더만).
- **필수 앵커**: `<!-- @component -->`(역할 1문장 + 사용 예 1줄) · `type Props` 명명 선언 · **전 prop TSDoc** · 기본값은 `$props()` 구조분해에.
- **소유**: 토큰 스타일링 · a11y 배선 · 인터랙션 물리학(IME 가드·키보드·포커스) · 로컬 인터랙션 `$state`.
- **금칙**: 문구성 prop(placeholder·label·title류)에 도메인 어휘 기본값 · raw 색/치수(토큰만) · 자체 데이터 페치.
- **테스트**: 상태 매트릭스 격리 렌더 의무. **매니페스트**: Props 원문+TSDoc+기본값+소비처 (상세 티어).

### 3.2 `*.composite.svelte` — 조립 (dumb)

- **정의**: primitive·같은 도메인 부품의 조립. "도메인을 알기도(도메인 폴더) 모르기도(layout=앱 셸) 한다". 판정: **mock props만으로 렌더되는가**.
- **위치·이름**: `<domain>/` 또는 `layout/` · `<화면|기능><부품>.composite.svelte` · 화면 루트만 `<화면>Section.composite.svelte`.
- **임포트 허용**: primitive(딥·세트) · **같은 폴더** composite · `import type`(remote wire 타입 — cross-domain도 type-only 허용) · 순수 유틸 · 아이콘.
- **임포트 금지**: 타 도메인 composite(값) · `.live` · `.remote`(값) · `$lib/state` 모듈 · `$lib/server`.
- **필수 앵커**: `@component` 역할 1행 · `type Props` 명명 (TSDoc 권장).
- **소유**: 화면 구성 · 순수 뷰 상태(`$state` — 아코디언 펼침·다이얼로그 open 등 데이터와 무관한 것) · 표시용 파생(`$derived`).
- **금칙**: 데이터 페치 · mutation 직접 호출(콜백 `onXxx` props로 위임) · 이스케이프 해치 복붙.
- **테스트**: Section은 4상태 스토리 권장. **매니페스트**: 1줄(역할·Section/부품·⚡live·📖·소비처), `--detail`로 상세.

### 3.3 `*.live.svelte` — 데이터 섬 배선

- **정의**: remote를 **페어 dumb 1개**에 결합하는 humble 배선. 화면 조립은 글루의 몫, 부품 조립은 dumb의 몫 — live의 조립은 "데이터×페어 dumb" 결합뿐.
- **위치·이름**: 페어 dumb과 같은 폴더 · 같은 Base + `.live.svelte`. 페어 없는 live 금지.
- **단위**: live = **독립 데이터 섬** 단위. 한 화면에 화면 루트 1 + 독립 위젯 N 허용. 위반 판정은 개수가 아니라 **"두 live가 같은 데이터를 중복 조회"**(→ 상위 승격).
- **임포트 허용**: 페어 dumb · `$lib/data/*.remote` · `$lib/state/*.svelte.ts` · primitive(pending/failed 스니펫 상태 표시용).
- **임포트 금지**: 타 composite · 타 live · `$lib/server`.
- **마크업**: `<svelte:boundary>` + 페어 마운트 + pending/failed 스니펫만. **HTML 요소 태그 0** — 본 콘텐츠가 필요해지면 dumb에 prop을 추가할 때다.
- **소유**: 서버 데이터 · 쿼리 파라미터(변경 시 재조회를 유발하는 상태) · mutation 함수(+ 완료 후 관련 query `refresh()` 명시 — 목록 미갱신 버그의 단골 원인).
- **금칙**: `$effect` 안 remote 호출(무한루프 — 파라미터 반응은 `$derived(getX({p}))`, 1회성 부수효과는 `onMount`) · remote `form()` 객체를 dumb의 팀 Input에 `.as()` 스프레드로 전달(SSR throw — 네이티브 input에만) · 로직 성장(분기·상태기계가 자라면 `*.svelte.ts` 추출).
- **테스트**: 전용 불요(로직 0이 규칙). **매니페스트**: 페어에 ⚡ 표시.

기본형:

```svelte
<!-- FooListSection 데이터 배선 -->
<script lang="ts">
	import { getFoos, removeFoo } from '$lib/data/foo.remote';
	import EmptyState from '$lib/components/primitive/EmptyState.primitive.svelte';
	import FooListSection from './FooListSection.composite.svelte';

	const foos = getFoos();
	async function handleDelete(id: string) {
		await removeFoo(id);
		await getFoos().refresh();
	}
</script>

<svelte:boundary>
	<FooListSection foos={foos.current} onDelete={handleDelete} />
	{#snippet pending()}<FooListSection foos={undefined} onDelete={handleDelete} />{/snippet}
	{#snippet failed(error, reset)}<EmptyState title="불러오지 못했습니다" onRetry={reset} />{/snippet}
</svelte:boundary>
```

(dumb의 props가 `foos: Foo[] | undefined`로 로딩을 표현해야 pending에서 dumb 재사용 = 스켈레톤이 실제 레이아웃과 항상 일치.)

### 3.4 `+page.svelte` / `+layout.svelte` — 최종 조립자 (글루)

- **정의**: **live 마운트들로 이루어진 최종 조립**. 화면 = 글루가 조립한 데이터 섬들의 합.
- **허용**: live·dumb Section 마운트 · 라우트 파라미터 추출(`$derived(page.params.x)`)과 prop 전달 · **Snippet 주입**(셸 dumb의 슬롯에 live를 끼움) · `<svelte:head>`.
- **금지**: `$state` · `$effect` · remote import · 배선 로직 — **셸의 sign-out 버튼조차 layout 도메인 live가 배선한다**. 글루 배선 0에 예외 없음.
- dumb은 live를 마운트하지 않는다(순수형) — 셸(dumb)이 데이터 위젯을 품을 땐 Snippet prop을 열고 글루가 주입:

```svelte
<!-- +layout.svelte -->
<AppShell>
	{#snippet sidebarList()}<ChatList.live … />{/snippet}
	{@render children()}
</AppShell>
```

### 3.5 `*.svelte.ts` — 클라 상태·로직 (runes 모듈)

- **정의**: 반응 상태·상태기계를 담는 runes 모듈. live가 비대해질 때의 추출 목적지.
- **위치**: 전역 상태는 `src/lib/state/`, 화면 종속 로직은 해당 도메인 폴더 옆자리.
- **소비**: **live(와 글루)만**. dumb·primitive가 import하면 mock 렌더 격리가 깨진다.
- **테스트**: vitest client로 테스트 가능해야 함 — 이게 추출의 존재 이유.

### 3.6 `*.remote.ts` — wire 경계 (humble)

- **정의**: SvelteKit remote functions(query/command/form)의 선언부. **얇음의 책임 목록**: 인증 가드 · 입력 검증(스키마) · service 호출 · 전송 매핑(redirect/refresh/에러 성형). 그 이상 금지.
- **금지**: 업무 규칙 · 직접 쿼리(전부 service/repository로).
- **타입**: 반환 타입 `export type` = wire 계약 정본 (A3).
- **테스트**: 전용 불요 — service가 커버. 남는 리스크는 배선 실수 → 체크리스트("command는 무효화할 query 명시").

### 3.7 `*.service.ts` / `*.repository.ts` — 서버 로직

- service = 업무 규칙·트랜잭션 경계 소유. repository = 데이터 접근(쿼리)만.
- **테스트**: vitest 의무 (repository는 테스트 DB 통합 포함). 로직이 humble 껍데기(remote)에 새지 않았다면 이 층 테스트가 곧 기능 테스트다.

### 3.8 `*.stories.svelte` / `*.svelte.spec.ts` — 격리 렌더 검증

- 옆자리 콜로케이션. 파일명 = `<Base>.stories.svelte` / `<Base>.svelte.spec.ts` (Base 전역 유일이 페어 링크 보장 — 계층 접미사는 생략).
- 도구 중립: 격리 렌더 의무(A9)를 스토리로 하든 컴포넌트 스펙으로 하든 프로젝트 선택. 매니페스트는 존재를 📖로 표시.

### 3.9 `ui/**` — vendor 보존영역 (= shadcn-svelte 구역)

- **정의**: 사실상 **shadcn-svelte의 구역**이다 — `shadcn-svelte add`가 내려주는 vanilla 산출물 원본. **수정 금지**(재다운로드 가능해야 함) · **소비는 primitive의 래핑만**.
- **두 가지 적법 상태**(프로젝트 선택): ① **존속** — 보존 구역으로 유지하고 primitive가 래핑 ② **완전 흡수** — 부품을 primitive로 재작성·흡수하고 폴더 삭제. 어느 쪽이든 합법이며, 부분 흡수 진행 중 상태도 허용된다(흡수된 부품부터 ui/에서 제거).
- vendor 내부의 배럴·유틸(cn 등)은 불가침 — 팀 레이어에서 import 금지. ui/의 README.md가 이 구역의 정체(shadcn-svelte·버전·흡수 상태)를 서술한다.

### 3.10 세트 (compound) — `primitive/<set>/`

- **판별(신호 2개 이상일 때만 세트)**: ① 부품 자유 배치·반복·생략 ② 부품 간 컨텍스트 협조(open 상태 등) ③ 부품 사이에 소비자 임의 마크업. 아니면 **스니펫 슬롯형 단일 컴포넌트가 기본**(틀은 컴포넌트 소유, 내용만 소비자).
- **구조**: 폴더=세트 하나, `index.ts`는 부품 재수출만(로직 0·세트 밖 재수출 금지), 부품 파일은 `CardHeader.primitive.svelte`(전면 마킹 유지).
- **소비**: `import * as Card from '…/card'` 네임스페이스 의무 → `<Card.Root>`. 부분 구조분해 금지.
- **허용 위치 = primitive 한정** — 컨텍스트 협조형 다부품 위젯은 본질적으로 도메인 무지 패턴. 도메인의 다부품 나열은 세트가 아니라 그냥 부품들(배럴 불요).
- **매니페스트**: 세트 단위 1엔트리(Root의 @component가 세트 설명) + 부품 서브행.

## 4. 상태 소유권 판정표

| 상태 | 소유 | 판정 |
|---|---|---|
| 서버 데이터 | live | 출처를 아는 유일한 층 |
| 쿼리 파라미터(검색어·페이지·탭) | live → dumb에 value+onChange | **바뀌면 서버를 다시 불러야 하는가** = live 소유 |
| 순수 뷰 상태(펼침·hover·open) | dumb | mock props만으로도 동작해야 하므로 |
| 인터랙션 물리(포커스·IME 조합) | primitive | 물리학은 디자인 시스템 소관 |
| 클라 전역 상태 | `$lib/state/*.svelte.ts` | live만 소비 |
