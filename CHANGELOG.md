# Changelog

## 5.2.0 — 2026-07-05

**신규 조항 A11 + 룰 `UNRESOLVED_INTERNAL_LINK`(error, 52→53룰)** — 소비 프로젝트에서 반복 발견된 실수: `<a href="/cycle/settings">`처럼 SvelteKit 내부 절대경로를 문자열 리터럴로 직접 쓰고 `$app/paths`의 `resolve()`를 누락. base path 변경 시 깨지고 타입 세이프 라우트 검증이 무력화된다. `<a href>`·`goto()`·`redirect()`·`<form action>` 4개 호출부를 정규식으로 감사(문자열 리터럴 직접 사용만 대상 — `resolve()` 표현식으로 감싼 경우는 애초에 패턴 자체가 다르므로 자연히 제외). 외부 프로토콜·프로토콜 상대·정적 자원(확장자)·해시는 감지 대상 아님.

**신규 명령 `arch.mjs verify`** — kit 설치 풋프린트(CLAUDE.md 마커 블록·pre-commit 마커 블록·package.json scripts 5종·config.mjs·templates/)가 서로 다른 버전을 가리키며 반쪽 상태로 어긋나는 것을 감지한다. "지금 설치가 스킬 최신 버전인가"는 범위 밖(그건 `arch-init` 재실행 시 에이전트가 계속 담당) — 이 명령은 "설치물 자체가 내부적으로 일관되는가"만 본다. `audit` 실행 시 결과에 영향 없는 비차단 배너로 자동 선행.

- **constitution.md**: §1에 A11 조항 신설.
- **audit-rules.md**: B군에 `UNRESOLVED_INTERNAL_LINK` 행 추가(52→53룰), 헤더·B군 카운트 갱신.
- **claude-block.md**: 상시 로드 요약 카드의 "핵심 금칙"에 한 구절 반영.
- **README.md**: 3중 방어 섹션·구성 섹션 룰 카운트 53룰로 갱신.

## 5.1.0 — 2026-07-05

**신규 룰 `CLASS_PROP_STRING_TYPE`(warn, 50→52룰)** — 소비 프로젝트에서 실제로 반복 발견된 실수: `class`·`triggerClass` 등 `*Class` prop을 `string`으로 좁게 타입해 A9의 `class={[...]}` 배열 규약(clsx 스타일 배열·객체 합성)과 어긋나는 경우. Svelte `ClassValue`(`svelte/elements`)로 타입하도록 `extractProps()` 결과를 재사용해 감사(새 라인 단위 정규식 없음 — 룰 저작 불변식 준수).

- **constitution.md**: A9에 prop 타입 항 추가.
- **audit-rules.md**: 룰 표에 `CLASS_PROP_STRING_TYPE` 행 추가.
- **claude-block.md**: 상시 로드 요약 카드의 "핵심 금칙"에 한 구절 반영 — 커밋 시점이 아니라 작성 시점부터 인지.

## 5.0.0 — 2026-07-04

**접미사 표준화(BREAKING)** — smart 접미사 `.live.svelte` → `.container.svelte`로 개명. FSD 진영의 관용어(container/presentational)에 맞춰 dumb/smart 축을 부른다. `.view`는 이미 FSD 공식 블로그 관례와 일치했으나 `.live`는 자기설명적이지 않은 자체 조어였다.

- **kindOf**: `.container.svelte`가 표준. `.live.svelte`는 같은 판정(이행기 페어·룰 적용 동일)을 받되 신설 `LEGACY_SUFFIX`(error)로 즉시 지목된다.
- **룰 개명**: `LIVE_WITHOUT_PAIR`→`CONTAINER_WITHOUT_PAIR`, `LIVE_MARKUP`→`CONTAINER_MARKUP`, `LIVE_IMPORT_OUTSIDE_GLUE`→`CONTAINER_IMPORT_OUTSIDE_GLUE`. 위반 메시지·매니페스트·analyze 출력의 "live" 어휘 전부 "container"로. 51번째 룰 `LEGACY_SUFFIX` 신설(50→51).
- **config**: `allow.liveOutsideGlue` → `allow.containerOutsideGlue`. 구키가 남아있으면 경고 후 값을 승계(1버전 한시 하위호환).
- **kit**: `arch:new`(feature·widget 생성기)가 `.container.svelte` + `${Base}Container` 재수출을 생성. `kit/templates/SliceSection.live.svelte` → `SliceSection.container.svelte`.
- **migrations/5.0.0.mjs 신설**: 소비 프로젝트의 `.live.svelte` → `.container.svelte` 전량 rename(git mv) + 소스·CLAUDE.md 안 문자열 치환(`XxxLive` 재수출 별칭 → `XxxContainer` 포함) + `config.mjs`의 `allow.liveOutsideGlue` 키 rename. 3계층 분류처럼 사람 판단이 필요 없는 기계적 변경이라 v3→v4와 달리 승인 없이 자동 실행. 멱등.
- **INSIGNIFICANT_SLICE 정밀화**: inbound 소비자 집계에서 글루 계열(글루·글루서버·글루유니버설) 엣지를 제외 — 페이지 전속 위젯이 "소비 1곳"으로 오탐되던 것 해소(글루의 위젯 마운트는 steiger 원판에서도 소비로 세지 않는 취지).
- **문서(constitution.md)**: public API(index) 절에 배럴 4원칙 명문화 — ① 배럴은 외부 실소비 진입점 + 계약 타입만 공개하는 화이트리스트 ② 조립 자식은 상대 import 전용·배럴 비공개 ③ 부품 세트 공개는 소비자 직접 조립 계약일 때만 ④ 단일 소비자 전용 파편은 그 소비자 slice로 배치 교정. `HEAVY_REEXPORT` 설명을 이 원칙 관점으로 정리(임계 로직 불변).

## 4.2.2 — 2026-07-04

- audit: `SLICE_NAME_PARITY` 면제에 config `serverInfraSlices` 합류 — 선언된 서버 전용 엔진 slice는 클라 대응이 없는 게 정상인데 parity warn을 받던 비정합 해소. 위반 메시지에 선언 안내 추가.
- docs(code): arch.mjs 헤더에 **룰 저작 불변식 3조** 박제 — ① 구문 검사는 라인 단위 금지(포매터 개행 — content 문장 단위 matchAll) ② 배럴은 star 재수출까지 이름 단위 해석 ③ typeOnly는 지정자 단위. v4.1.1·v4.1.2·v4.2.1 세 릴리스가 전부 이 불변식 위반의 수리였다 — 새 룰 저작 시 선행 체크리스트.

## 4.2.1 — 2026-07-04

- fix(audit): `SLICE_PUBLIC_API`의 배럴 내용 검사가 라인 단위라 **포매터가 개행한 여러 줄 재수출 문장을 위반으로 오탐** — v4.1.2(임포트 그래프)와 같은 계열의 라인 기반 맹점. 재수출 문장 스팬을 content 매칭으로 계산해 스팬 밖 라인만 지목한다.

## 4.2.0 — 2026-07-04

**서버 수평 규칙 정밀화 — 헌법 §3.8과 정합.** 실전 서버는 도메인 service가 여러 slice의 repository를 조합해 오케스트레이션한다 — 전면 금지는 §3.8("service = 여러 repository 조합")과 상충했고, 기계적으로 따르면 도메인 모듈 대부분이 server/shared로 쏠려 slice 구조가 공동화된다.

- audit: `CROSS_SLICE_SERVER_IMPORT` 면제 3종으로 재정의 — ① 인프라 대상(코어 shared·database·auth + 신설 config `serverInfraSlices`) ② type-only ③ **service→타 slice repository**(도메인 규칙 소유자의 데이터 접근 조합 = 정방향). service→service·repository→repository 등 나머지 수평은 여전히 금지 — 처방은 server/shared 이동 또는 인프라 선언.
- config: `serverInfraSlices` 신설 — 도메인 어휘 없는 서버 전용 엔진 slice(예: llm·crypto·email)를 프로젝트가 선언해 대상 면제. 도메인 slice 등재는 규칙 무력화라 금지(템플릿 주석 명기).
- audit: `SCHEMA_VALUE_OUTSIDE_REPOSITORY` 합법 소비자에 **adapter** 추가 — db 클라이언트(drizzle typed client) 조립은 adapter의 본질적 schema 소비(§3.9). 종전 규칙대로면 typed client 파일이 구조적으로 위반을 벗어날 수 없었다.
- docs: constitution §3.8·§3.9 반영·audit-rules 해당 행 갱신.

## 4.1.2 — 2026-07-04

- fix(audit): 임포트 그래프가 **여러 줄 import 문을 통째로 놓치던 집행 구멍** — 라인 단위 정규식이라 포매터가 개행한 `import Default, {\n type X\n} from '…'` 문이 그래프에 안 잡혀, 그 임포트에 걸리는 룰 전부(DEEP·CROSS_SLICE·CROSS_SLICE_SERVER·REMOTE_SKIPS_SERVICE 등)가 침묵했다. prettier 기본 printWidth에서 지정자 3개 이상이면 개행되므로 실전 코드의 상당수가 감사 밖이었던 치명 결함 — content 전체 문장 단위 매칭으로 교체(clause 문자 클래스를 식별자·중괄호·콤마·공백으로 한정해 `export const x = 1` 등 from 없는 문장을 넘어 삼키지 않음, 위반 라인 번호 = 문장 시작 라인).

## 4.1.1 — 2026-07-04

- fix(audit): 임포트 그래프의 배럴 투명화가 **star 재수출(`export * from`)을 관통하지 못하던 집행 구멍** — named import가 star로 재수출된 이름이면 가상 엣지가 생성되지 않아 그래프 기반 룰 전부(GLUE_LOGIC·REMOTE_IN_VIEW·LIVE_IMPORT_OUTSIDE_GLUE·CROSS_SLICE 등)가 침묵했다. slice public API 경유가 의무(딥 임포트 금지)인 좌표계에서 배럴 뒤가 안 보이면 감사가 무력화되므로 치명 — 대상 모듈의 export 이름 집합을 추출(배럴 체인 재귀·순환 가드)해 이름 단위로 해석한다.
- fix(audit): 가상 엣지의 `typeOnly`가 문장 단위로만 판정되던 것을 **지정자 단위로 정밀화** — 인라인 `type X` 지정자와 배럴의 `export type {…} from` 재수출을 type-only로 인식(값·타입이 같은 실파일로 섞이면 값 우선). 값 import로 오인된 type 지정자가 REMOTE_IN_VIEW 등을 오탐하던 것 제거.

## 4.1.0 — 2026-07-04

**plan 3단 이행 파이프라인** — 1차 기계(휴리스틱) · 2차 LLM(내용 판정) · 3차 해체(리팩토링). 휴리스틱이 특정 네이밍 관례에 과적합될 수 있다는 전제를 명시하고, 기계가 확신 못 하는 분류를 LLM 단계로 넘긴다.

- plan: 이동마다 확신도 태깅 — 위치·프레임워크 관례 기반=확실 / 네이밍 추측(3계층 분류·types·state·utils)=`[?추정]`. 요약 줄에 확실/추정 집계 + 2차 검토 안내, `--json`에 `sure` 필드. overrides 지정은 항상 확실.
- plan: 해체 후보(⚒) 분리 보고 — `.svelte`가 서버 모듈(`@/server`·`.service`·`.repository`·drizzle)을 직접 소비하면 이동으로 해결 불가. view/live 분리·server 추출 대상 목록화(`--json`에 `teardown`), apply는 이동만 수행.
- audit: `SPEC_PLACEMENT` 신설(49→**50룰**) — src 안 spec은 같은 폴더 동일 Base 검증 대상과 콜로케이션 의무. 테스트 배치 정본 성문화: 유닛=콜로케이션 · 통합=최상위 `tests/` · e2e=최상위 `e2e/`.
- skill: 온보딩 규범을 3단 파이프라인으로 개정 — 2차 LLM 분류 절차(판정 질문 → `plan-overrides.json` 확정)와 **메타 동시 시딩**(내용을 연 파일은 그 자리에서 `@component` 역할 1행 작성 — 이행 직후 `MISSING_COMPONENT_DOC` 부채 원천 차단), 3차 해체 별도 승인 플로우. 정본 = adoption.md §2.5·§2.7·§2.8.

## 4.0.2 — 2026-07-04

- fix(plan): 미분류 파일이 `plan-overrides.json` 조회 없이 followups로 빠지던 것 — 이동 루프 진입에서 overrides 최우선 적용(휴리스틱 밖 파일도 대상 지정 가능, `skip` 포함).
- fix(plan): `types/X.ts`와 `types/X.spec.ts`가 같은 대상(`…/types.ts`)으로 계산돼 spec이 본체를 **덮어쓰던 자료 소실** — spec은 `types.spec.ts`로 분리. 더해서 동일 대상 충돌을 전수 감지해 플랜에 `✗` 표기하고 `--apply`를 강제 중단(휴리스틱·overrides 어느 경로든 재발 차단).
- fix(plan): 임포트 재작성 커버리지 3구멍 — ① 동적 `import()`의 상대 스펙 미재작성 ② `.ts` 소스의 `.js` 확장자 임포트(vanilla vendor 패턴)와 `index.ts`의 디렉토리 배럴 스펙 미매칭 ③ src 밖 소비자(`tests/`·`e2e/`) 전체 미포함.
- plan `--json` 출력에 `dupes` 필드 추가.

**심층 검토 라운드 수정판** — 4중 병렬 리뷰(문서 정합·룰 패리티·킷 실측·템플릿 자기준수)의 발견 전량 반영. 룰 카탈로그 골격은 문서↔구현 **49=49 완전 패리티** 확인(유령 룰 0·미구현 룰 0·심각도 불일치 0).

- fix(audit): `ENDPOINT_THICK`가 `+server.ts`의 db(database slice) 직접 접근을 놓치던 집행 구멍 — 형제 룰 `PAGE_SERVER_DATA_FETCH`와 동일 조건으로 정합.
- fix(manifest): ① 서버 export 함수 TSDoc이 파일 헤더 블록코멘트에 브리지로 삼켜져 소실 — tempered 정규식(내부 `*/` 금지)으로 인접 doc만 인식 ② 한 줄 `export interface` 침묵 누락 — 중괄호 밸런스 스캔(`extractInterfaces`)으로 교체 ③ kebab-case slice(A7 의무 형식)의 CLAUDE.md 1행이 ASCII 하이픈에서 절단 — 구분자를 em-dash(—)로 한정 ④ `--slice` 별첨 #5(remote가 참조하는 shared/model 원문) 미구현이던 것 구현.
- fix(new·plan): 생성기와 `plan --apply`가 **계층 루트 CLAUDE.md를 시드하지 않아** 새 계층 첫 생성 직후 자체 감사가 `MISSING_CLAUDE_MD`로 실패하던 갭 — `seedLayerClaude` 도입(new 전 경로 + plan 적용 시 계층·slice·server slice 전부).
- fix(analyze): SKILL이 광고하던 해치 클러스터 신호(v3 유산)가 v4 재작성에서 빠졌던 것 복원 — `DUPLICATE_ESCAPE_HATCH` 군집 리포트.
- fix(templates): ① Component.view `variant` prop TSDoc 누락(생성 직후 `UNDOCUMENTED_PROP` 자기 warn) ② view 템플릿 역할 placeholder가 `<`로 시작해 매니페스트 role/usage 오분류 ③ SliceSection.view에 생성기 치환 토큰(`SliceSection`·`example`) 부재 ④ adapter 주석의 합법 소비자에 adapter 누락.
- docs: 룰 수 표기 48→**49** 정정(구 48은 B군 병합 행 기준 행 수 — `SET_PARTIAL_IMPORT`/`VENDOR_IMPORT` 분리 기재) · SKILL 접미사 목록 `.stories` 추가·"판정표 2종"·"steiger 흡수분 표기" 정밀화 · 룰 발화조건 서술 정합(PAGE_SERVER/ENDPOINT 대상 열거·CROSS_SLICE_SERVER 면제 3종·SEGMENT_UNKNOWN pages 맥락) · config `heavyReexportMax` 문서화 · plan `--full`/`--json` 표기 · 설치 풋프린트에 CLAUDE.md 씨앗·hooksPath 조건 기재 · migrations README 버전 판독 위치 정정.

## 4.0.0 — 2026-07-04

**FSD 2.1 전면 채택 — 스킬 재정의: "SvelteKit × FSD 2.1 아키텍처 어드바이저".** 자체 발명(파일 종별 트리)보다 성문화된 표준을 흡수하는 방향 전환. 상세 설계 근거는 references/fsd-guide.md.

- **좌표계**: 4단 주소(계층/slice/segment/접미사). FSD 공식 SvelteKit 수술(`files.lib='src'`·`files.routes='src/app/routes'`) — `src/server` = `$lib/server` 보호. pages 계층은 기본 닫힘(routes 콜로케이션이 pages first를 전담, config로만 개방).
- **접미사 개편**: `.primitive`/`.composite` 폐기 → **`.view`**(dumb)/**`.live`**(smart) — 지식 축은 계층(디렉토리)이, 데이터 축만 접미사가 나른다. 구 primitive = `shared/ui`(승격 4테스트: 어휘·이식·정본·수요, "태어나지 않고 승격된다").
- **배치 사다리(pages first)**: 콜로케이션 출생 → 둘째 소비자 시점 하강(명사→entities·동사→features·블록→widgets) → 불확실=widgets → 소비 1이면 회귀. entities/ui는 view 전용(live 욕구=widget 승격 신호).
- **서버 표준(FSD 밖 절반)**: `server/<slice>/` 도메인 격리 + 종별(service·repository·adapter·guard·schema·config) + 건너뛰기 0(remote→service만) + wire 타입 정본=`entities/<slice>/model/types.ts`.
- **감사 48룰**: steiger 흡수(NO_LAYER_PUBLIC_API·INSIGNIFICANT_SLICE·SLICE_PUBLIC_API·cross-slice) + 서버 11룰 + 글루서버 2룰(PAGE_SERVER_DATA_FETCH·ENDPOINT_THICK — 수급 사다리) + APP_STATE_IN_VIEW·REMOTE_VALUE_EXPORT·CLASS_CONST_EXPORT 등. 임포트 그래프 기반(배럴 투명 해석 — 상대·@/·$lib·index 경유 전부 resolve, v3의 소비자 맵 블라인드 버그 해소). 구 트리에선 룰 폭주 대신 plan 안내만 출력.
- **배럴 정책**: slice 계약 배럴만(재수출 전용·HEAVY_REEXPORT 경고), 계층·shared 통합 배럴 금지 — FSD 공식 처방=Vite 성능 가이드와 합류, 트리쉐이킹 철학 무손실.
- **manifest**: 계층 뷰 + `--slice <이름>` 스윕(관련 slice ui 상세 + remote 시그니처 + wire 타입 원문 + **server service/repository export 시그니처**) + 로컬 타입 별칭 인용(variant 값 불투명 해소).
- **plan**: 구 트리 → FSD 이행 제안표(3계층 분류 휴리스틱 + `.svelte-arch/plan-overrides.json` 수정 루프) — svelte.config 수술 선행 게이트, 승인 후에만 `--apply`, slice index·CLAUDE.md 씨앗 동반.
- **init**: hooksPath **불가침** — 기존 훅 pre-commit 안에 마커 블록만 주입(구 githooks 통째 소유 방식 폐기). 자기서술 = README → **CLAUDE.md**(계층·slice 루트만, 하네스 자동 로드 전제·짧게).
- **new**: `shared-ui`·`entity`·`feature`·`widget`(view/live 페어+index+CLAUDE 씨앗)·`set`·`service`·`repository`·`adapter` 생성기.
- **버그 픽스(v3 유산)**: 소비자 맵 상대경로·배럴 블라인드(고아 오탐) · `.svelte.spec.ts` 페어링 불능 · NO_BARREL_IMPORT 이중 계상 · plan의 잡파일(.DS_Store) 이동.
- **migrations/4.0.0.mjs**: 구조 이행은 자동 코드모드가 아니라 승인형 plan 경로 — 안내만 수행(멱등).

## 3.1.1 — 2026-07-03

- fix(plan): vendor `ui/**`를 이동·삭제 대상에서 완전 제외 — ui 세트 배럴 6개를 삭제 계획에 올리던 오판 수정 (불가침 원칙 위반이었음).

## 3.1.0 — 2026-07-03

- **`arch plan`**: 기존 프로젝트 전수 검사 → 이행 플랜 산출(접미사 부여·composite/ 해체·배럴 폐기·임포트 재작성). `--apply`로만 실행 — 에이전트는 플랜을 사용자에게 제시하고 **"이렇게 옮기겠습니다. 진행할까요?" 승인 후에만** 적용한다(스킬 규범).
- **`arch analyze`**: 진화 신호 리포트 — 종별·커버리지(live 페어·@component·TSDoc·스토리) 통계, 고아/저소비 primitive, 유사 해치 클러스터(variant 승격 후보), live 비대(>100줄), 네이티브 요소 다빈도(primitive 부재 신호), Props 비정형, 감사 잔고.
- **`arch new`**: 앵커 선재 스캐폴드 생성기 — `primitive`·`section`(live 페어 동시)·`composite`·`set`(부품들+**index.ts 세트 배럴 자동 생성**, Base 전역 유일 검증, README 씨앗).
- init: `.svelte-arch/templates` 동봉(생성기 오프라인 동작), package.json 스크립트 5종, 무표 컴포넌트 감지 시 plan 안내 출력.

## 3.0.0 — 2026-07-03

- 최초 공개: 헌법(파일 종별 카드·공리) · 실행형 매니페스트(티어링·TSDoc 분류 뷰) · 감사 CLI(24 코어 룰, 종별 지명) · `init.mjs`(선언적 수렴, 마이그레이션 러너) · `.svelte-arch/` 단일 설치 풋프린트 · Claude Code 플러그인/마켓플레이스 매니페스트.
