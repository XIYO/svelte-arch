# 헌법 — SvelteKit × FSD 2.1 아키텍처 v5

> 규범 전문. 요약은 SKILL.md, FSD 원전 번역·용어 사전은 fsd-guide.md, 감사 구현은 audit-rules.md.
> 모든 조항은 도구·프로젝트 무관(도메인 0%). 프로젝트 특화는 각 레포의 `.svelte-arch/config.mjs`와 CLAUDE.md가 갖는다.

## 0. 메타규칙 · 용어

- **R0 — 규칙은 대상(계층·segment·종별)을 지명한다**: 몰빵 타깃(".svelte 전체")은 규칙 형식 위반.
- **R1 — 주소가 역할을 선언한다**: `계층/slice/segment/접미사` 4단. 디렉토리(앞 3단)와 파일명(접미사)은 서로 검증한다.
- **R2 — 규칙에는 근거가 붙는다**: 근거가 사라진 규칙은 폐기 후보.

**2×2 매트릭스 (무모순 증명)** — 지식 축은 계층(디렉토리)이, 데이터 축은 접미사가 나른다:

|  | 업무 무지 | 업무 보유 |
|---|---|---|
| **dumb** (props만) | `shared/ui/*.view` | slice `ui/*.view` |
| **smart** (출처를 앎) | ∅ — 존재 금지 | `*.container` |

smart+무지 칸이 공집합인 이유: "데이터를 안다" = "어느 slice의 api를 부를지 안다" = 이미 업무 지식.

**용어 사전(업계 대응)**: view=presentational(Abramov)·recipe의 부품(Frost) / container=container·connected(업계 관용어와 표기 합류 — v5에서 구표기 `.live`를 폐기하고 이 이름을 그대로 채택) / shared/ui=design system component(Frost)·FSD shared/ui — ⚠ 업계 "primitives"(Radix·bits-ui)는 무스타일 headless로 다른 것(우리 스택에선 bits-ui가 그 층, shared/ui가 styled wrapper) / widget=FSD widget("자립적 대형 블록") / slice=FSD slice(도메인).

## 1. 횡단 공리

### A1. 의존 단방향 — 계층은 아래로만, 서버는 건너뛰기 0

```text
클라(수직): app(routes 글루) → [pages(닫힘)] → widgets → features → entities → shared
클라(수평): 같은 계층 slice 간 import 금지 (type-only는 slice index 경유만 허용 — @x 미도입)
경계:      *.container → 자기 slice api(remote) · 하위 계층 api/ui — 서버 값 import는 remote·글루서버·endpoint·hooks만
서버(수직): *.remote → *.guard·*.service → *.repository → *.schema  /  *.adapter ← service·repository
서버(수평): server/<a> → server/<b> 금지 (server/shared만 예외 — 둘째 서버 slice가 호출하는 순간 shared로 이동)
```

**서버는 예외 0** — remote가 repository·adapter를 직접 부르지 않는다(얇은 pass-through service를 감수한다. 예외는 쌓여서 혼란이 된다). **근거**: 계층 격리 = 테스트 격리. container/remote는 런타임 결합부라 로직을 0으로 만들어(humble object) 테스트 가능한 층(view·service)으로 밀어낸다.

### A2. 전면 마킹 불변식

관장 트리(`src/**`, vendor·예약 파일 제외)의 모든 `.svelte`는 **글루**(`+page`/`+layout`/`+error`) · **`.view`** · **`.container`** · **`.stories`** 중 하나다. routes 콜로케이션도 예외 없음(무표 = `UNMARKED_COMPONENT`). 구표기 `.live.svelte`는 즉시 `LEGACY_SUFFIX`(이행기 페어·판정은 `.container`와 동일하게 유지되되 error). 모든 `.ts`는 §3 종별 중 하나로 접미사(또는 지정 위치)를 갖는다(`UNMARKED_TS`).

### A3. 타입 SSOT — wire 계약 정본 = `entities/<slice>/model/types.ts`

1. 정본 계보: DB 행(스키마 infer) → service DTO → **wire 타입(`model/types.ts`)** → view Props는 참조만.
2. 다개체 공용(pagination 등)은 `shared/model/`. remote **로컬 전용** 응답 타입은 remote 안 `export interface`도 합법(SvelteKit 실측: 타입 export는 컴파일 소멸로 안전 — **값 export만 즉사**, `REMOTE_VALUE_EXPORT`).
3. 구조 재타이핑 금지 — 좁힐 땐 `Pick`/`Omit`/`Partial` 파생만. wire 타입에 DB 행(`$inferSelect`) 재수출 금지.
4. 타 slice 타입은 slice index의 type 재수출로 소비(`import type { X } from '@/entities/user'` — type-only는 빌드 소멸).
5. shared/ui는 업무 타입 import 금지 — 자기 무업무 타입이 정본. `ComponentProps<typeof X>`로 재선언 방지.

### A4. 발견성 = 실행형 매니페스트

"무엇이 있는가"는 배럴·수기 문서가 아니라 실행(`arch:manifest`)이 답한다 — 항상 최신, LLM 주입 1순위. slice public API(A5)는 **경계 강제** 용도이지 발견성 용도가 아니다.

### A5. 배럴 정책 — slice 계약 배럴만, 발견성 금지

- **의무**: sliced 계층(widgets·features·entities)의 slice 루트 `index.ts` = public API. **재수출 전용·로직 0·자기 slice 파일만**(`SLICE_PUBLIC_API`). 타 slice 소비는 이 index 경유만(`DEEP_IMPORT_INTO_SLICE`).
- **금지**: 계층 루트 배럴(`NO_LAYER_PUBLIC_API` — steiger 동명 룰) · `shared/ui`·`shared/lib` 통합 배럴(`NO_SHARED_MEGA_BARREL` — FSD 공식 처방이자 Vite 성능 가이드. shared는 **딥 임포트**: `@/shared/ui/Button.view.svelte`).
- **근거**: 무관물 대형 배럴은 dev 그래프 폭발(HMR 연쇄)·무거운 의존 연쇄를 만든다. slice 배럴은 "밀접한 관련물 소수"라 안전(FSD 공식 문구). 세트 배럴(`shared/ui/<set>/index.ts`)은 compound 위젯 부품 재수출만.
- **배럴 4원칙 (화이트리스트 규율)**:
  1. 배럴 = **외부 실소비 진입점 + 계약 타입만** 공개하는 화이트리스트다. 폴더 인벤토리 전량 덤프(있는 파일 다 재수출)는 금지 — 발견성은 배럴이 아니라 매니페스트(A4)가 담당한다.
  2. 조립 자식(내부 부품 — slice 안에서만 조합되는 하위 컴포넌트)은 **상대 import 전용**, 배럴 비공개. 배럴에 오르는 순간 "외부가 직접 써도 되는 것"이라는 계약이 생긴다.
  3. 부품 세트 공개(`shared/ui/<set>/index.ts`의 전 부품 재수출)는 **소비자가 직접 조립하는 계약으로 설계했을 때만** 정당하다(compound 패턴). 조립 순서·내부 배선이 세트 소유인데도 부품을 낱개 공개하면 계약이 아니라 우연한 노출이다.
  4. 단일 소비자 전용 파편이 배럴에 있다 = 공개 축소(비공개 전환)가 아니라 **그 소비자 slice로 배치를 옮기는 것**이 처방이다 — "일단 공개하고 안 쓰면 접자"는 배럴 팽창(`HEAVY_REEXPORT`)의 상시 원인.

### A6. 배치 사다리 (pages first) · 소비 규율

배치: ① 콜로케이션 출생 → ② 둘째 소비자 시점에만 하강(명사→entities·동사→features·블록→widgets·무업무→shared/ui) → ③ 불확실하면 위(widgets 디폴트) → ④ 소비 1로 줄면 회귀. 소비: ① 그리기 전 매니페스트 ② 있으면 소비, 모자라면 variant ③ Rule of Two ④ 해치는 일회성 ⑤ shared/ui에 업무 기본값 금지. 상세 = discipline.md.

### A7. 명명

- **slice = kebab-case**(FSD 관행: `knowledge-list`·`download-document`), **컴포넌트 Base = PascalCase·레포 전역 유일**(매니페스트 `--detail`·스토리 페어링·검색성 근거).
- `Section` 예약어: "글루가 마운트하는 화면 루트" 위젯만. 콜백 = camelCase `onXxx`. 상태 prop 표준명 `loading`/`error`/`disabled`(is/has 접두 금지). `$bindable`은 value·open·ref만.
- 같은 역할 다른 이름(Modal vs Dialog) 금지 — 신설 전 매니페스트 검색.

### A8. 자기서술 = CLAUDE.md (계층 루트 + slice 루트)

- **계층 루트와 slice 루트는 `CLAUDE.md` 의무**(`MISSING_CLAUDE_MD`). segment 폴더는 면제 — 디렉토리 CLAUDE.md는 해당 폴더 파일 작업 시 하네스가 **자동 로드**하므로(README 게이트 같은 규범 의존이 기계 보장으로 대체된 것) 밀도가 곧 컨텍스트 비용이다. **짧게**: 역할 1행 + 두는 것/두지 않는 것. 규칙 본문 미러링 금지(link, don't mirror).
- kit 설치·생성기가 씨앗을 자동 생성. 1행은 매니페스트의 slice 설명으로 추출된다.

### A9. 클래스 합성 — `class={[...]}` 배열 단일 규약

- 조건부·합성 클래스는 Svelte 5.16+ 내장 배열만: `class={['rounded p-2', active && 'bg-accent']}`. 팀 레이어에서 `cn`/`clsx`/`tailwind-merge`/`classnames` import 금지, 템플릿 리터럴 클래스 금지, 컴포넌트 태그 문자열 `class="…"` 금지. 클래스 문자열 상수 모듈로의 우회도 금지(`CLASS_CONST_EXPORT` — 해치 복붙의 세탁).
- **근거**: 배열 리터럴이어야 린터·정렬·감사·매니페스트가 클래스를 읽는다. 내장 배열이 clsx를 내장하므로 외부 유틸은 중복. twMerge가 하던 "class 덮어쓰기 충돌 해소"는 규율(variant 우선·REPLACE형 해치)이 대체한다.
- 예외: `shared/vendor/`(§3.14)는 자기 유틸(cn·tv)을 쓴다 — 원본 보존이 우선.
- **prop 타입**: 소비자가 넘기는 `class`(`triggerClass` 등 `*Class`)는 항상 Svelte `ClassValue`(`svelte/elements`)로 타입한다. `string`으로 좁히면 배열·객체 형태(clsx 스타일)를 못 받아 배열 규약과 모순된다(`CLASS_PROP_STRING_TYPE`).

### A10. 테스트 티어

| 대상 | 의무 | 도구 |
|---|---|---|
| `shared/ui/*.view` | 상태 매트릭스 격리 렌더 **의무** | 스토리 또는 `*.svelte.spec.ts` |
| slice `ui/*.view` (Section) | 4상태(loading/empty/error/filled) 권장 | mock props 스토리 |
| `*.container` / `*.remote` | 전용 불요 — 로직 0이 규칙 | e2e가 배선 커버 |
| `model/*.svelte.ts` | 테스트 가능해야 함(추출의 존재 이유) | vitest client |
| `*.service` / `*.repository` | vitest **의무**(repository는 테스트 DB 통합 포함) | vitest |

### A11. 내부 링크 — `resolve()` 경유 의무, 원본 경로 문자열 직행 금지

- `<a href>`·`goto()`(`$app/navigation`)·`redirect()`(`@sveltejs/kit`)·`<form action>`에 내부 절대경로(`/`로 시작)를 문자열 리터럴로 직접 쓰지 않는다. `$app/paths`의 `resolve()`로 감싼다.
- **정적**: `resolve('/blog')`. **동적**: `resolve('/blog/[slug]', { slug: post.slug })` — 라우트 ID는 실제 디렉터리 표기(`[slug]`) 그대로 1번째 인자에, 값은 2번째 params 객체로 분리(`` resolve(`/blog/${slug}`) `` 템플릿 리터럴 보간은 타입 체크를 무력화하므로 금지).
- **제외**(감지 대상 아님): `http(s)://`·`mailto:`·`tel:`·`//`(프로토콜 상대)로 시작하는 경로, 파일 확장자가 붙은 정적 자원 경로, `#`만 있는 해시.
- **근거**: base path 변경에도 링크가 깨지지 않고, 존재하지 않는 라우트로의 오타를 컴파일 타임 타입 체크가 잡는다.

## 2. 트리 정본 (svelte.config 수술 포함)

```js
// svelte.config — FSD 공식 SvelteKit 수술
kit: { files: { lib: 'src', routes: 'src/app/routes', appTemplate: 'src/app/index.html' } }
// + vite alias: '@' → 'src'  (임포트 표준 표기 — $lib은 내부 존재만)
```

```text
src/
├── app/                       # 초기화 계층
│   ├── index.html · app.css · hooks.server.ts
│   └── routes/                # 글루(+page/+layout) + pages first 콜로케이션(.view/.container 마킹)
├── pages/                     # 닫힘(기본) — config.layers.pages=true 로만 개방
├── widgets/<slice>/           # {ui/, model/?, lib/?, index.ts, CLAUDE.md}
├── features/<slice>/          # {ui/, api/?, model/?, index.ts, CLAUDE.md}
├── entities/<slice>/          # {ui/(view 전용), api/<slice>.remote.ts, model/types.ts, index.ts, CLAUDE.md}
├── shared/
│   ├── ui/                    # 디자인 시스템 — flat + icons/ + <set>/ (배럴 금지, 딥 임포트)
│   ├── vendor/                # shadcn 산출물 원본 보존(불가침) — shared/ui만 래핑 소비
│   ├── lib/ · model/ · config/
└── server/                    # = $lib/server (컴파일러 보호)
    ├── <slice>/               # <slice>.service.ts · <slice>.repository.ts · *.adapter.ts
    ├── auth/                  # *.guard.ts · auth.adapter.ts
    ├── database/              # *.schema.ts · db.adapter.ts
    └── shared/                # 횡단 서버 slice (notification 등)
```

- **remote가 `entities/api`에 사는 근거**: `$lib/server` 안이면 클라 import가 차단되어 remote가 성립 불가. api segment = 클라에 보이는 유일한 서버 표면, server/ = 서버 전용 — 배치가 곧 보안 경계.
- **server slice 이름 = 대응 클라 slice 이름**(`SLICE_NAME_PARITY`, entities↔server 기준. features의 remote는 소속 업무 도메인의 server slice를 호출).

## 3. 카드 (계층·segment·종별)

> 카드 스키마: 정의 / 허용 임포트 / 금지 / 앵커 / 금칙. 편집할 파일의 카드 하나만 보면 된다.

### 3.1 글루 (`+page.svelte`·`+layout.svelte`·`+error.svelte`)

container·view 마운트, 라우트 파라미터 추출(`$derived(page.params.x)`)·prop 전달, **Snippet 주입**(셸 위젯 view의 슬롯에 container를 끼움), `<svelte:head>`만. **금지**: `$state`·`$effect`·remote import(`GLUE_LOGIC`). view는 container를 마운트하지 않는다 — 셸이 데이터 위젯을 품을 땐 Snippet prop을 열고 글루가 주입.

### 3.2 routes 콜로케이션 — pages first의 1차 거처

라우트 폴더의 `+` 없는 파일. `.view`/`.container` 마킹 의무, `.ts`도 종별 의무. 둘째 라우트가 소비하려는 순간 하강 관문(discipline.md)으로.

### 3.3 `*.view.svelte` — dumb (표현)

- **정의**: props만 받아 그리는 컴포넌트. 판정: **mock props만으로 렌더되는가**. 상태 소유는 §4 — "정본이 컴포넌트 밖에 있는 상태" 금지(URL·전역·서버), 로컬 순수 뷰 상태(open·hover·펼침)는 합법.
- **허용**: 하위 계층 view(딥/index)·shared/ui·`import type`(wire — index 경유)·util·아이콘. **금지**: `.remote` 값(`REMOTE_IN_VIEW`)·`*.svelte.ts` 값(`STATE_MODULE_IN_VIEW`)·`$app/state`·`$app/navigation`(`APP_STATE_IN_VIEW` — `active` 등은 prop 주입)·`.container` import.
- **앵커**: `<!-- @component -->` 1행 + `type Props` 명명 + (shared/ui는 전 prop TSDoc). mutation은 콜백 `onXxx`로 위임.

### 3.4 `*.container.svelte` — smart (데이터 섬 배선)

- **정의**: remote를 **페어 view 1개**에 결합하는 humble 배선. 같은 폴더·같은 Base + `.container.svelte`(`CONTAINER_WITHOUT_PAIR`). **거주지**: routes 콜로케이션·widgets·features의 ui — **entities/ui 금지**(`ENTITY_UI_VIEW_ONLY`, container 욕구 = widget 승격 신호).
- **허용**: 페어 view · slice api(자기·하위 계층, index 경유) · model `*.svelte.ts` · `$app/navigation`·`$app/state`(URL 동기화는 container 소관) · shared/ui(pending/failed 표시용).
- **마크업 0**(`CONTAINER_MARKUP`): `<svelte:boundary>` + 페어 마운트 + pending/failed 스니펫만. 글루 외 import 금지(`CONTAINER_IMPORT_OUTSIDE_GLUE`).
- **금칙**: `$effect` 안 remote 호출(무한루프 — 파라미터 반응은 `$derived(getX({p}))`) · remote `form()` `.as()` 스프레드를 팀 컴포넌트에(네이티브 input만) · 로직 성장(→ model `*.svelte.ts` 추출) · command 후 관련 query `refresh()` 누락.
- **구표기**: `.live.svelte`는 `LEGACY_SUFFIX`로 즉시 지목 — 신규·기존 파일 모두 `.container.svelte`만 허용(개명 근거는 §0 용어 사전 — FSD 진영의 container/presentational 관용어 정렬).

```svelte
<svelte:boundary>
	<FooListSection foos={foos.current} onDelete={handleDelete} />
	{#snippet pending()}<FooListSection foos={undefined} onDelete={handleDelete} />{/snippet}
	{#snippet failed(error, reset)}<EmptyState title="불러오지 못했습니다" onRetry={reset} />{/snippet}
</svelte:boundary>
```

### 3.5 `api/<slice>.remote.ts` — wire 경계 (humble)

- **얇음의 책임 목록**: 인증 가드(`*.guard`) · 입력 검증(스키마) · **service 호출만**(`REMOTE_SKIPS_SERVICE` — repository·adapter 직접 금지) · 전송 매핑. db/schema/drizzle 값 import 금지(`REMOTE_DB_IMPORT`).
- **export**: remote function만(query/command/form/prerender). 그 외 **값** export = 서버 트랜스폼 즉사(`REMOTE_VALUE_EXPORT`). 타입(export type/interface)은 합법.

### 3.6 `model/` — 타입 + 클라 상태

- `types.ts`(·`*.types.ts`) = wire 타입 정본, 런타임 export 금지(`TYPES_ONLY`).
- `*.svelte.ts` = runes 상태·상태기계. **소비 = container(와 글루)만** — view가 import하면 mock 격리가 깨진다. 무도메인 전역은 `shared/model/`.

### 3.7 `lib/*.util.ts` — 순수 함수

부수효과 0. import는 타입·다른 util만 — `$app/*`·server·api·model 상태 금지(`IMPURE_UTIL`).

### 3.8 `*.service.ts` / `*.repository.ts` — 서버 로직

service = 업무 규칙·트랜잭션 경계(여러 repository 조합·adapter 소비 — **타 slice repository 조합도 합법**: 도메인 규칙 소유자가 데이터 접근을 정방향으로 조합한다. 반대로 service→타 service·repository→타 repository 수평은 `CROSS_SLICE_SERVER_IMPORT` — 공용 능력은 server/shared 또는 인프라 선언(config `serverInfraSlices`)으로). repository = 데이터 접근(schema 값 import 합법처 — `SCHEMA_VALUE_OUTSIDE_REPOSITORY`. adapter의 db 클라이언트 조립도 합법, 시드도 예외 없음). 둘 다 SvelteKit(`$app/*`·`getRequestEvent`) import 금지(`SERVICE_SVELTEKIT_IMPORT`, `$env`는 허용하되 해석은 config 소유 권장). 위치 = `server/<slice|shared>/`(`SERVER_KIND_PLACEMENT`).

### 3.9 `*.adapter.ts` — 외부 시스템 어댑터

db 인스턴스·S3·SMTP·LLM SDK·better-auth 등 외부 세계의 래퍼. 소비 = **service·repository·adapter**만(`ADAPTER_CONSUMER`).

### 3.10 `*.guard.ts` — 인증·인가 가드

`requireUser`류. 소비 = **remote·글루서버(+page.server 등)·endpoint·hooks**만(`GUARD_OUTSIDE_BOUNDARY`).

### 3.11 `*.schema.ts` / `*.config.ts`

schema = drizzle 테이블 정의(`server/database/`). config = 값 상수·env 해석(로직 0).

### 3.12 글루서버 (`+page.server.ts`·`+layout.server.ts`) · `+server.ts` · hooks

- **+page.server/+layout.server = 가드·리디렉트·메타 전용**(`PAGE_SERVER_DATA_FETCH` — service/repository/db import 금지, guard만). 데이터는 컴포넌트가 remote로 수급.
- **+server.ts(raw endpoint) = remote 표현 한계 5종만**: 스트림·바이너리·커스텀 헤더·외부 라이브러리의 URL 직접 fetch·웹훅 수신. 얇음 의무 — guard+service 경유(`ENDPOINT_THICK`).
- **hooks.server.ts** = 핸들 체인·transformPageChunk·locals 주입만, 로직은 service 위임.
- **데이터 수급 사다리**: ① container의 remote(기본) → ② `+page.ts` universal load(라우트 레벨 필요 — load에서 remote query await 가능) → ③ `+page.server.ts`(시크릿·server-only일 때만) → ④ `+server.ts`(한계 5종). 각 단계는 위 단계의 불가능을 말할 수 있어야 내려간다.

### 3.13 세트 (compound) — `shared/ui/<set>/`

판별(신호 2+): 부품 자유 배치·컨텍스트 협조·부품 사이 소비자 마크업. 아니면 스니펫 슬롯형 단일 컴포넌트. `index.ts`는 부품 재수출만, 소비는 `import * as Card` 네임스페이스 의무(`SET_PARTIAL_IMPORT`). 허용 위치 = shared/ui 한정.

### 3.14 `shared/vendor/` — shadcn 보존 구역

shadcn-svelte 산출물 원본(ui 컴포넌트 + cn 유틸) 보존, 수정 금지(재다운로드 가능해야). 소비는 **shared/ui의 래핑만**(`VENDOR_IMPORT`). **장기 방향**: 종착지는 shared/ui 흡수 — 흡수 시 cn·tv를 제거하고 `class={[...]}` 배열로 정규화(twMerge의 충돌 해소는 variant 규율이 대체, 흡수 후 시각 스모크 필수). 착수 시점은 프로젝트가 결정한다.

## 4. 판정표

### 4.1 상태 거주지 — 최상위 질문: "이 상태의 정본이 컴포넌트 밖에 있는가?"

| 판정 (위에서부터) | 거주지 | 소유 |
|---|---|---|
| 링크 공유·새로고침·뒤로가기로 복원돼야 하는가 | URL searchParams | container (goto/replaceState — hydration 전 replaceState는 throw, 초기화 가드) |
| URL엔 과하지만 뒤로가기 제스처는 존중해야 하는가 | shallow routing `pushState`+`page.state` | container |
| 라우트를 떠나도 살아야 하는가 | `model/*.svelte.ts` | container만 소비 |
| 바뀌면 서버 재조회인가 (URL 불요 시) | container 로컬 `$state` | container |
| 컴포넌트 안에서만 의미인가 (open·hover·펼침) | view 로컬 `$state` | view — **합법** |

push↔replace: 명시적 탐색 단위(탭·페이지 이동)=pushState, 연속 입력(타이핑·슬라이더)=replaceState.

### 4.2 하강 관문 판정례 (케이스 로우)

| 사례 | 판정 |
|---|---|
| Button·Input·Dialog·EmptyState·icons | shared/ui (승격 4테스트 통과) |
| StatCard·PageHeader | 정본 테스트(T3)로: 스타일 가이드 등재 시 shared/ui, 화면 Figma뿐이면 콜로케이션/widget |
| KnowledgeListItem·KnowledgeCard | entities/knowledge/ui (명사의 표현) |
| DownloadReasonDialog·SignInForm | features (동사 — download-document·sign-in) |
| KnowledgeListSection + container | widgets/knowledge-list (자립 조립 블록) |
| AppSidebar·AdminSidebar·ToastHost | 셸 블록당 widget slice (widgets/app-sidebar 등) |
| "entity ui에 container를 두고 싶다" | widget 승격 신호 — entities/ui는 view 전용 |
