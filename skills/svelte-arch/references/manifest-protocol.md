# 매니페스트 프로토콜 — 실행형 발견성 (v5 계층 뷰)

> "무엇이 있는가"는 파일이 아니라 실행이 답한다. LLM 주입이 1순위 소비자 — stale 0%가 존재 이유. slice public API는 경계 강제용, 발견성은 여기가 전담.

## 계약 = 명령 이름 (전 프로젝트 동일)

```bash
bun run arch:manifest                     # shared/ui 상세 티어 + 전 계층 slice 1줄 요약
bun run arch:manifest -- --slice <이름>   # 이름 부분일치 전 계층 스윕 + server/<이름> API + wire 타입 원문
bun run arch:manifest -- --slice entities/knowledge   # 정밀 지정 (계층/이름)
bun run arch:manifest -- --detail <Base>  # 특정 컴포넌트 심층 (Props 전체)
bun run arch:manifest -- --json           # 도구용
```

## 출력 명세

헤더(버전 체인 노출점):

```text
# arch-manifest · kit v5.0.0 · <프로젝트> · shared/ui 23 · widgets 6 · features 4 · entities 5 · server 7
```

**shared/ui 엔트리** (상세 티어 — 분류 뷰): `### SearchInput · shared/ui · 소비 12곳 · 📖` + 역할 1행 + 사용 예 + 주입/양방향/콜백/스니펫/통과 분류(Props 선언에서 기계 도출 — `$bindable`=양방향, `Snippet`=스니펫, `on[A-Z]`=콜백, `...rest`=통과). **로컬 타입 별칭 인용**: props가 참조하는 같은 파일 `type X = …` 선언을 함께 인용(variant 값이 안 보이는 별칭 불투명 방지). parse-or-quote: 파싱 실패 시 원문 인용 + `⚠비정형`.

**slice 엔트리** (1줄 티어): `knowledge-list · widgets · ⚡container · 📖 · <CLAUDE.md 1행> · 소비 N곳`

**--slice 별첨** (한 주입에 관련 전부):
1. 일치 slice들의 ui 상세(view Props) — 계층 표기
2. `api/*.remote.ts`의 export 시그니처 + 로컬 export interface 원문
3. `model/types.ts` **원문 인용** (wire 타입 — 추출기는 타입 해석기가 아니다, 인용으로 해결)
4. `server/<이름>/`의 service·repository **export 함수 시그니처**(이름·파라미터·반환·TSDoc 1행) — 서버 중복 생성 방지
5. import type 그래프 추적: remote가 참조하는 `shared/model` 파일도 별첨

## 소스 측 추출 앵커 (작성 규약 — 미적 규칙이 아니라 기능 규칙)

| 앵커 | 추출 대상 | 겸용 소비자 |
|---|---|---|
| `<!-- @component -->` 최상단 | 1행=역할, `사용:` 행=예시 | IDE 호버(Svelte 공식) |
| `type Props = {…}` 명명 | 타입·필수/옵션·분류 | svelte-check |
| prop TSDoc `/** … */` | prop 설명 (타입·기본값 반복 금지 — 코드가 SSOT) | IDE 호버 |
| `$props()` 구조분해 기본값 | defaults·`$bindable` 판별 | 런타임 그 자체 |
| slice `CLAUDE.md` 1행 | slice 설명 | 하네스 자동 로드 |
| 서버 export 함수 TSDoc 1행 | 서버 API 설명 | IDE 호버 |

- Props 멤버에 인라인 객체 리터럴 지양(비정형 유발) — 타입 별칭 추출(별칭은 매니페스트가 인용).
- 소비자 맵은 상대경로·`@/`·`$lib/`·slice index 경유를 전부 해석(resolve)한다 — 배럴·상대 임포트 블라인드 금지.

## 버전 체인

```text
스킬 저장소 → kit/VERSION → .svelte-arch/arch.mjs 헤더 → 매니페스트 1행
```

에이전트는 매 작업 매니페스트를 실행하므로 1행의 kit 버전으로 드리프트를 그 자리에서 감지 → init 재실행 제안. 구 트리 감지 시 매니페스트는 `arch:plan` 안내를 함께 출력한다.
