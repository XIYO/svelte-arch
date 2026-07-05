# 업스트림 기여 — 요구사항 → PR

> 소비 프로젝트(또는 이 저장소 자체)에서 발견된 kit 개선 필요를 `XIYO/svelte-arch` 업스트림 PR로 formalize하는 프로토콜. 트리거 = `/arch-feedback`(자동 발동 없음 — 항상 명시적 호출). 배경·대안 비교 = `docs/superpowers/specs/2026-07-05-arch-feedback-design.md`.

## 규모 판정 — 기계적 vs 설계급

| 신호 | 기계적(즉시 구현) | 설계급(제안 문서만) |
|---|---|---|
| 대상 | 오탈자·문구 수정, 기존 패턴을 복제하는 감사 룰 1개, 카운트/버전 문자열 갱신, 이미 결론난 사항의 문서 반영 | 신규 계층/segment, 기존 룰과 상충 가능한 변경, 여러 파일에 걸친 트레이드오프, 실사용 사례가 1건뿐이라 일반화 근거 부족 |
| 산출물 | 코드/문서 diff + 버전 bump + CHANGELOG | `docs/superpowers/specs/<날짜>-<슬러그>-design.md` 신규 파일만 |
| 후속 | 없음(완결) | 사람(또는 별도 세션)이 plan → 구현 |

애매하면 설계급(안전 쪽)으로 취급한다. `arch.mjs`를 직접 건드리는 기계적 변경은 룰 저작 불변식 3조(① 문장 단위 매칭 — `content.matchAll()`, 라인 단위 금지 ② 배럴은 star 재수출까지 이름 단위로 해석 ③ typeOnly는 지정자 단위)를 재확인한다 — 위반은 이미 세 차례(CHANGELOG 4.1.1·4.1.2·4.2.1) 실사용 버그로 이어진 전례가 있다.

## PR 제목 — Conventional Commits (신규 컨벤션 아님)

이 저장소 git log가 이미 쓰는 `feat:`/`fix:`/`feat!:`/`fix(scope):`/`docs:`를 그대로 재사용한다. scope는 아래 라벨의 `area:*` 접미사와 1:1 대응시켜 제목만 보고도 라벨을 예측할 수 있게 한다.

- 기계적 예: `feat(audit): REQUIRE_ZOD_ON_REMOTE 룰 추가`, `fix(constitution): A9 클래스 배열 예외 조건 정정`
- 설계급 예: `docs(specs): server actions 지원 여부 설계 제안` — 실례: `07ecbd6 docs: resolve() 헌법 조항 + arch.mjs verify 설계 스펙`

## PR 본문 템플릿

```markdown
## Summary
<요구사항 원문 1~2문장 요약>

## Motivation
<왜 필요한지 — 어느 소비 프로젝트/상황에서 발견됐는지>

## Environment
- OS: <platform> <release> (<arch>)
- Runtime: bun <version>
- kit version: <KIT_VERSION>
- Reported from: <소비 프로젝트명 또는 "svelte-arch 저장소 자체">
- (해당 시) arch:verify 결과: <통과/불일치 항목>

## Changes
<기계적: 무엇을 바꿨는지 / 설계급: 어떤 제안 문서를 추가했는지>

## Checklist (기계적일 때만)
- [ ] 룰 저작 불변식 3조 재확인
- [ ] 스크래치 fixture 육안 검증
- [ ] 버전 4소스(kit/VERSION·KIT_VERSION·plugin.json·CHANGELOG) 동기화
- [ ] `bun scripts/check-version-sync.mjs` 통과

---
🤖 `/arch-feedback`로 접수·작성 — Claude Code on behalf of XIYO.
```

커밋에는 기존 관행대로 `Co-Authored-By: Claude <noreply@anthropic.com>` 트레일러를 붙인다.

## 환경정보 수집 — 크로스플랫폼

셸별 분기(`uname` vs `ver`) 대신 이미 의존 중인 런타임으로 일원화한다(ESM only — `require()` 금지):

```bash
bun -e "const os = await import('node:os'); console.log(os.platform(), os.release(), os.arch())"
bun --version
```

OS는 라벨이 아니라 본문 Environment 섹션에만 남긴다 — 분류 카테고리가 아니라 재현·트리아지용 인스턴스 메타데이터라서.

## 라벨 택소노미

| 라벨 | 색상 | 용도 |
|---|---|---|
| `type:bug` | `#d73a4a` | 버그 |
| `type:enhancement` | `#a2eeef` | 기능/규칙 추가·개선 |
| `type:docs` | `#0075ca` | 문서 전용 |
| `area:constitution` | `#5319e7` | 헌법(constitution.md) 조항 |
| `area:audit` | `#5319e7` | 감사 룰(arch.mjs·audit-rules.md) |
| `area:manifest` | `#5319e7` | 매니페스트 |
| `area:kit` | `#5319e7` | sync.mjs·설치 풋프린트·버전 체계 |
| `area:server` | `#5319e7` | 서버 계층(port/service/repository) |
| `area:docs` | `#5319e7` | README·CHANGELOG·references 일반 |
| `scope:mechanical` | `#0e8a16` | 즉시 구현 완료된 PR |
| `scope:proposal` | `#fbca04` | 제안 문서만 담은 PR — 후속 판단 필요 |
| `source:agent-filed` | `#ededed` | 에이전트가 `/arch-feedback`로 자동 작성(provenance) |

GitHub 기본 라벨(`bug`·`enhancement`·`documentation` 등)은 삭제하지 않되 이 워크플로우에서는 쓰지 않는다(의미 중복 방지). 저장소에 라벨이 없으면 `gh label list`로 확인 후 부족분만 사용자 확인 하에 `gh label create`.

## 안전장치

- push·PR 생성 전 항상 브랜치·diff·PR 제목/라벨/본문 전문을 프리뷰하고 승인받는다.
- 라벨 신규 생성도 별도로 확인한다(저장소의 살아있는 상태를 바꾸는 행동).
- git identity는 사용자의 기존 설정을 그대로 쓴다(변경 금지).
- 버전 가드(`.githooks/pre-push` → `check-version-sync.mjs`)가 기계적 경로의 버전 갱신 누락을 이미 막아준다 — 별도 검증 로직 불필요.
