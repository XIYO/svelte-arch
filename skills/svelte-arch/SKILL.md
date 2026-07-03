---
name: svelte-arch
description: SvelteKit 풀스택 파일 종별 아키텍처 표준 + 프로젝트 주입 킷. 모든 파일이 이름으로 역할을 선언하고(.primitive/.composite/.live/.remote/.service/.repository…), 규칙은 종별 단위로만 걸리며, 실행형 매니페스트(arch:manifest)가 최신 컴포넌트 메타데이터를 LLM에 주입해 중복 생성을 차단한다. Svelte/SvelteKit 프로젝트에서 컴포넌트·remote function·service 파일을 만들거나 배치를 판단할 때, "컴포넌트 체계화"·"아키텍처 표준"·"네이밍 규칙"·"컴포넌트 정리/리팩토링" 요청 시, UI 작업 시작 전(매니페스트 주입 의무), 새 프로젝트에 표준을 설치(arch kit)하거나 kit 버전을 업데이트할 때 반드시 사용한다.
---

# SvelteKit 풀스택 파일 종별 아키텍처 (`svelte-arch`)

한 문장 정의: **파일명이 역할을 선언하고, 규칙은 종별에만 걸리고, 발견성은 실행형 매니페스트가 전담하는** SvelteKit 표준. 목적은 하나 — 같은 것을 두 번 만들지 않게 하고, 팀(사람+에이전트)이 실수할 자리를 없앤다.

## 룰 주입 = 전부 프로젝트 로컬 (머신 글로벌 주입 0)

**원칙: 규칙은 레포에 커밋된 것만 존재한다.** 머신 글로벌 룰 주입은 금지 — 머신마다 드리프트하고, CI·협업자가 못 받고, 로컬/글로벌 이원 관리가 된다. 이 스킬 자체는 에이전트의 지식·배포 채널일 뿐, 프로젝트에 규칙을 주입하는 건 오직 kit 설치물이다:

| 채널 (전부 레포 커밋) | 로드·발동 시점 | 내용 |
|---|---|---|
| 루트 CLAUDE.md **마커 블록** | 그 프로젝트 **매 세션 자동** | 상시 트리거 카드 — 종별 선언·매니페스트 의무·금칙 요약·README 게이트 |
| 각 디렉토리 `README.md` | 게이트 지시로 편집 전 필독 | 폴더 로컬 규칙 서술 |
| `.svelte-arch/`(CLI·config·훅 — 숨김 폴더 하나) | 실행·커밋 시 | 집행 — 위반 메시지 자체가 규칙 요약+처방 |

이 스킬(`references/`)은 규범 **전문의 정본**으로 필요할 때 읽는 법전이다 — kit 미설치 프로젝트에는 어떤 규칙도 "적용 중"이 아니며, 설치 제안부터 한다.

## 이 스킬의 구조 (progressive disclosure)

| 필요한 것 | 읽을 파일 |
|---|---|
| **헌법 전문** — 공리·파일 종별 카드 전체·트리·네이밍·세트 규칙·테스트 티어 | `references/constitution.md` |
| 매니페스트 프로토콜 — 출력 명세·추출 앵커·소스 규약·버전 체인 | `references/manifest-protocol.md` |
| 소비 규율·승격/강등 절차·Rule of Two·이스케이프 해치 규율 | `references/discipline.md` |
| 감사 룰 매트릭스 — 코어 룰 전체·종별 셀렉터·프로젝트 확장법 | `references/audit-rules.md` |
| kit 설치·업데이트·버전 관리 — 소유권 경계·마커 블록·semver | `references/kit.md` |
| 기존 프로젝트 도입 플레이북 (스캔→접미사 코드모드→kit 설치→승격) | `references/adoption.md` |
| **설치 페이로드** (CLI·config·템플릿·훅·README 씨앗) | `kit/` |

## 3중 방어 — 왜 이 시스템인가

AI·사람이 이미 있는 컴포넌트를 두고 또 만드는 원인은 셋이고, 각각 기계적으로 막는다:

1. **몰라서 만든다** → `bun run arch:manifest`가 최신 컴포넌트 API를 작업 컨텍스트에 주입 (§프로토콜)
2. **알아도 안 쓴다** → 소비 규율 5조 + 이 스킬의 워크플로우가 소비→variant→신설 순서를 강제
3. **그래도 만들면** → `bun run arch:audit`(pre-commit)가 커밋을 차단

## 파일 종별 레지스트리 (요약 — 카드 전문은 constitution.md)

**불변식**: 레포의 모든 `.svelte`·데이터 계층 `.ts`는 아래 종별 중 하나로 자기 역할을 **파일명으로** 선언한다. 무표 파일은 존재 자체가 위반.

| 종별 | 역할 한 줄 |
|---|---|
| `*.primitive.svelte` | 도메인 무지 디자인 시스템 (다른 제품에 복사해도 성립) |
| `*.composite.svelte` | 도메인/셸 조립, dumb (mock props만으로 렌더) |
| `*.live.svelte` | 데이터 섬 배선 — 페어 dumb 1개에 remote 결합, 마크업 0 |
| `+page/+layout.svelte` | **최종 조립자** — live 마운트·Snippet 주입·파라미터 전달만, 배선 로직 0 |
| `*.svelte.ts` | 클라 상태·로직(runes 모듈) — live 전용 소비, vitest 테스트 가능 |
| `*.remote.ts` | wire 경계(humble) — 가드·검증·서비스 호출·전송 매핑만. `export type` = wire 타입 정본 |
| `*.service.ts` / `*.repository.ts` | 업무 규칙 / 데이터 접근 — 로직의 실체, vitest 의무 |
| `*.stories.svelte` / `*.svelte.spec.ts` | 격리 렌더 검증 — 옆자리 콜로케이션 |
| `ui/**` | shadcn-svelte 구역(vendor 보존) — 불가침, primitive만 래핑 소비. 완전 흡수·존속 둘 다 적법 |
| `primitive/<set>/index.ts` | **세트 배럴**(유일한 합법 배럴) — compound 위젯 부품 재수출만 |

**메타규칙 R0**: 모든 규칙은 적용 종별을 지명해야 한다. `.svelte 전체` 같은 몰빵 타깃은 규칙 형식 위반.

## 프로토콜 — UI 작업 전 의무 실행

```bash
bun run arch:manifest -- --layer primitive              # 항상: 디자인 시스템 API 전체
bun run arch:manifest -- --domain <작업도메인>           # 해당 시: 도메인 부품 목록 + wire 타입
bun run arch:manifest -- --detail <Base>                 # 특정 컴포넌트 심층 (props+TSDoc)
bun run arch:new -- <primitive|section|composite|set> …  # 신설은 생성기로 (앵커 선재·세트 배럴 자동)
bun run arch:analyze                                     # 진화 신호: 승격 후보·고아·비대·커버리지
bun run arch:plan [-- --apply]                           # 기존 구조 → 표준 이행 플랜 (승인 후에만 --apply)
```

출력(티어링: primitive는 Props 원문+TSDoc+기본값, composite는 1줄)을 읽고 나서 UI를 그린다. 매니페스트 1행의 kit 버전이 이 스킬의 `kit/VERSION`보다 낮으면 업데이트를 제안한다.

## 워크플로우 (에이전트 행동 계약)

```text
UI 작업 감지
→ ① arch:manifest 실행·주입 (없으면 kit 설치 제안 — references/kit.md)
→ ② 소비 결정: 있으면 소비 → 모자라면 variant 추가 → 없으면 신설 (discipline.md)
→ ③ 신설: 배치 결정트리(constitution.md) → arch:new 생성기 (종별 접미사·@component/TSDoc 앵커 선재)
→ ④ arch:audit 통과 (pre-commit 백스톱)
```

**기존 프로젝트 온보딩 — 동의 필수 규범**: init 후 무표 컴포넌트가 감지되면,

```text
① arch:plan 실행 → 이행 플랜(이동·리네임·배럴 폐기·임포트 치환 규모)을 표로 사용자에게 제시
② 반드시 물어본다: "디렉토리 체계를 표준대로 이렇게 옮기겠습니다. 진행할까요?"
③ 승인 후에만 arch:plan -- --apply → svelte-check·arch:audit 검증 → diff 리뷰 → 커밋
```

승인 없이 `--apply`를 실행하지 않는다 — 구조 이행은 사용자의 결정이다.

배치 결정트리(요약): 데이터 배선? → `.live` / 도메인·셸 지식? → `.composite` (도메인 폴더/layout) / 도메인 무지+토큰만? → `.primitive` — 원자성은 기준 아님, 도메인 무지가 기준.

## 흔한 실수

- **"공용이니까 도메인끼리 공유"** — cross-domain import 금지. 공유 욕구 = primitive 승격 신호.
- **live에 마크업·로직이 자란다** — 마크업은 dumb의 prop 부족, 로직은 `*.svelte.ts` 추출 신호.
- **호출부에서 이스케이프 해치로 스타일 덮기부터 시작** — variant 추가가 먼저. 같은 해치값 2파일 = 감사 위반.
- **primitive에 도메인 문구 기본값** — 문구성 prop은 기본값 없이 소비자가 공급.
- **+page/+layout에 배선 로직** — 셸의 sign-out 버튼조차 layout 도메인의 live가 배선한다. 글루는 끝까지 마운트+주입만.
- **선반/도메인 배럴 부활** — 배럴은 세트 폴더(compound 위젯)만 합법.
- **`cn()`·템플릿 리터럴로 클래스 합성** — 내장 `class={[...]}` 배열만(강제). 배열이어야 린트·정렬·감사가 클래스를 정확히 읽는다.
