# Changelog

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
