---
name: svelte-arch
description: SvelteKit × FSD 2.1 아키텍처 어드바이저 + 프로젝트 주입 킷. FSD 계층(app/widgets/features/entities/shared)·slice·segment 표준 구조를 SvelteKit 방언(공식 svelte.config 수술)으로 완역해 안내·설치·감사하고, FSD가 비워둔 절반(서버 계층 remote→service→repository, dumb(view)/smart(container) 분리, 실행형 매니페스트 발견성, 클래스 배열 규약)을 자체 규범으로 채운다. Svelte/SvelteKit 프로젝트에서 컴포넌트·remote function·service 파일을 만들거나 배치를 판단할 때, "FSD"·"아키텍처 표준"·"컴포넌트 체계화"·"네이밍 규칙"·"구조 정리/리팩토링" 요청 시, UI·서버 작업 시작 전(매니페스트 주입 의무), 새 프로젝트에 표준을 설치(arch kit)하거나 kit 버전을 업데이트할 때 반드시 사용한다.
---

# SvelteKit × FSD 2.1 아키텍처 (`svelte-arch` v5)

한 문장 정의: **FSD 2.1 표준 구조(계층·slice·segment·public API·pages first)를 SvelteKit 방언으로 완역하고, FSD가 비워둔 절반(서버 계층·view/container 규율·발견성)을 자체 규범으로 채우는** 아키텍처 어드바이저 + 주입 킷. 목적은 하나 — 같은 것을 두 번 만들지 않게 하고, 팀(사람+에이전트)이 실수할 자리를 없앤다.

## 4단 주소 체계 — 모든 파일은 주소로 역할을 선언한다

```text
계층(수직) / slice(도메인) / segment(기술 성격) / 파일명 접미사(데이터 축)
src/widgets / knowledge-list / ui / KnowledgeListSection.view.svelte
```

- 앞 3단 = FSD 표준(디렉토리). 마지막 1단 = svelte-arch 오버레이(파일명 — FSD가 비워둔 dumb/smart 축).
- SvelteKit 수술(공식 config): `files.lib='src'` · `files.routes='src/app/routes'` · `files.appTemplate='src/app/index.html'` + `@/*` 별칭. `src/server` = `$lib/server`(서버 전용 보호).

## 계층 레지스트리 (요약 — 카드 전문은 constitution.md)

| 계층 | 역할 한 줄 |
|---|---|
| `src/app/` | 초기화 — index.html·hooks·app.css·**routes/**(글루 + pages first 콜로케이션) |
| `src/pages/` | **닫힘**(기본) — routes 콜로케이션이 전담. config로만 개방 |
| `src/widgets/` | 자립 대형 블록 — `*Section` view/container 페어·앱 셸(app-sidebar 등) |
| `src/features/` | 사용자 상호작용(동사) — 폼·다이얼로그·액션 |
| `src/entities/` | 업무 개체(명사) — 표시 view·wire 타입(model/types)·remote(api) |
| `src/shared/` | 업무 무관 — `ui/`(디자인 시스템)·`vendor/`(shadcn 원본 보존)·`lib/`·`model/`·`config/` |
| `src/server/` | FSD 밖 병렬 스택 — `<slice>/`에 port(계약 인터페이스)·service·repository·adapter (+`auth/guard`·`database/schema`·`shared/`) |

**segment**: `ui/`(`.view`+`.container` 페어) · `api/`(`<slice>.remote.ts`) · `model/`(`types.ts` wire 정본 + `*.svelte.ts` 클라 상태) · `lib/`(`*.util.ts`) · `config/`. 비표준 segment = 위반.

**접미사(전면 마킹 — 무표 = 위반)**: `.view`(dumb — mock props만으로 렌더) · `.container`(smart — remote 결합, 마크업 0. 근거 = remote/`<svelte:boundary>` 결합의 **기계적 경계**이지 "업계 표준이라서"가 아님 — Abramov 2019 철회 인지, fsd-guide §6. 구표기 `.live` 폐기 = `LEGACY_SUFFIX`) · `.stories` · `.remote` · `.svelte.ts` · `.util` · `.service` · `.repository` · `.port`(계약 인터페이스, 타입만) · `.adapter` · `.guard` · `.schema` · `.config` · `types.ts`.

## 배치 사다리 (pages first — 이 스킬의 심장)

```text
① 출생: 모든 새 코드는 라우트 콜로케이션에서 태어난다 (routes/<경로>/X.view.svelte — 접미사 의무)
② 하강 관문: 둘째 소비자(다른 라우트)가 등장하는 순간에만 내린다
   명사(개체 표현·타입·API) → entities/<개체> · 동사(상호작용) → features/<동사구>
   자립 조립 블록 → widgets/<블록> · 업무 어휘 0 + 승격 4테스트 → shared/ui
③ 판정 불확실 → 높은 계층에 둔다 (widgets 디폴트 — FSD 2.1 공식)
④ 회귀: 소비자가 1로 줄면 콜로케이션으로 되돌린다 (INSIGNIFICANT_SLICE)
```

entity의 ui에 container를 만들고 싶다 = widget 승격 신호(entities/ui는 view 전용).

## 3중 방어

1. **몰라서 만든다** → `bun run arch:manifest`가 shared/ui API 전체 + `--slice <이름>`으로 관련 slice·서버 API·wire 타입을 주입
2. **알아도 안 쓴다** → 배치 사다리 + 소비 규율(있으면 소비 → variant → 신설)
3. **그래도 만들면** → `bun run arch:audit`(55룰, steiger 흡수)이 커밋을 차단 (pre-commit)

## 프로토콜 — 작업 전 의무 실행

```bash
bun run arch:manifest                        # shared/ui 상세 + 전 계층 slice 요약
bun run arch:manifest -- --slice <이름>      # 관련 slice 스윕 + server API + wire 타입 원문
bun run arch:new -- <shared-ui|entity|feature|widget|set|service|repository|adapter|port> …
bun run arch:analyze                         # 진화 신호: 고아·해치 클러스터·INSIGNIFICANT
bun run arch:plan [-- --apply]               # 구 구조 → FSD 이행 제안표 (승인 후에만 --apply)
bun run arch:audit                           # 커밋 전 (pre-commit 자동)
```

## 워크플로우 (에이전트 행동 계약)

```text
UI·서버 작업 감지
→ ① arch:manifest 실행·주입 (kit 미설치면 설치 제안 — references/kit.md)
→ ② 소비 결정: 있으면 소비 → 모자라면 variant → 없으면 배치 사다리 ①(콜로케이션 출생)
→ ③ 신설: arch:new 생성기 (segment 골격·public API·앵커 선재)
→ ④ arch:audit 통과
```

**기존 프로젝트 온보딩 — 3단 이행 파이프라인 (동의 필수 규범)**: 구 구조 감지 시:

1. **1차(기계)** `arch:plan` — 위치·프레임워크 관례 기반 이동은 확실, 네이밍 추측은 `[?추정]` 태깅. 제안표를 사용자에게 제시.
2. **2차(LLM)** — `[?추정]`·미분류 전수를 에이전트가 검토. 이름으로 판정이 서지 않으면 **파일 내용을 열어** 판정(명사 표현→entities · 동사 상호작용→features · 자립 블록→widgets · 업무 어휘 0→shared · 불확실→widgets)하고 `plan-overrides.json`에 확정 기록. **읽은 김에 메타 동시 시딩** — 그 파일의 `@component` 역할 1행을 분류 근거 그대로 작성(이행 직후 `MISSING_COMPONENT_DOC` 부채 원천 차단). 절차 상세 = adoption.md §2.5.
3. **3차(해체)** — plan의 `⚒ 해체 후보`(.svelte의 서버 직접 소비)는 이동으로 해결 불가. **이행 커밋과 분리**해 별도 승인 후 view/container 분리·server 3계층 추출 리팩토링. adoption.md §2.7.

반드시 묻는다: "FSD 표준대로 이렇게 옮기겠습니다. 진행할까요?" — 승인 후에만 `--apply`.

## 룰 주입 = 전부 프로젝트 로컬 (머신 글로벌 0)

| 채널 (전부 레포 커밋) | 발동 | 내용 |
|---|---|---|
| 루트 CLAUDE.md 마커 블록 | 매 세션 자동 | 상시 트리거 카드 — 주소 체계·배치 사다리·매니페스트 의무 |
| 계층·slice 루트 `CLAUDE.md` | 폴더 파일 작업 시 자동 로드 | 폴더 자기서술 (segment는 면제 — 밀도=컨텍스트 비용) |
| `.svelte-arch/` (CLI·config·훅 마커) | 실행·커밋 시 | 집행 — 위반 메시지 = 규칙 요약+처방 |

## progressive disclosure

| 필요한 것 | 파일 |
|---|---|
| 헌법 전문 — 공리·계층/segment/종별 카드·판정표 2종(상태 거주지·하강 판정례)·2×2 매트릭스 | `references/constitution.md` |
| FSD 2.1 번역·용어 사전(업계 대응어)·svelte.config 수술 정본 | `references/fsd-guide.md` |
| 배치 사다리·승격 관문 4테스트·강등·Rule of Two·해치 규율 | `references/discipline.md` |
| 감사 룰 55 전량 (steiger 흡수분 인라인 표기) | `references/audit-rules.md` |
| 매니페스트 출력 명세·추출 앵커·버전 체인 | `references/manifest-protocol.md` |
| 기존 프로젝트 이행 플레이북 | `references/adoption.md` |
| kit 설치·업데이트·소유권·semver | `references/kit.md` |
| 업스트림 기여(요구사항→PR) 프로토콜 | `references/contribution.md` |

## 흔한 실수

- **entity ui에 container 생성** — entities/ui는 view 전용. 자기 데이터를 무는 블록 = widget.
- **같은 계층 slice 수평 import** — 금지(type-only는 slice index 경유 허용). 처방 = 하강.
- **shared/ui·shared/lib에 통합 배럴** — 딥 임포트만(FSD 공식 처방 = Vite 성능 가이드).
- **container에 마크업·로직이 자란다** — 마크업은 view의 prop 부족, 로직은 model `*.svelte.ts` 추출 신호.
- **view가 `$app/state`로 URL을 읽는다** — 외부 정본은 prop 주입(`active` 등). container·글루 소관.
- **`.live.svelte` 잔존** — kit v5 구표기, `LEGACY_SUFFIX`가 즉시 지목. 신규는 처음부터 `.container.svelte`, 기존 프로젝트는 `arch-sync` 재실행 시 `migrations/5.0.0.mjs`가 자동 rename.
- **remote에 값 export** — remote function 외 값 export는 서버 트랜스폼에서 즉사. 타입은 합법.
- **remote를 stable로 취급** — SvelteKit remote functions는 **experimental**(opt-in flags·"subject to change"·minor 간 breaking 이력). SvelteKit **버전 고정** + remote 경계는 **Standard Schema(Zod) 검증**(공개 HTTP 엔드포인트 — 미검증 DoS 실증 사례).
- **`cn()`·템플릿 리터럴 클래스** — 내장 `class={[...]}` 배열만 (vendor 내부만 예외).
- **+page.server.ts에서 데이터 로딩** — 가드·메타 전용. 수급 사다리: remote → universal load → +page.server → raw endpoint.
