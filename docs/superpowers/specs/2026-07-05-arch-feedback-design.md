# 설계 — 업스트림 요구사항→PR 기여 프로토콜 (`/arch-feedback`)

날짜: 2026-07-05
버전 목표: kit v5.4.0 → v5.5.0 (MINOR — 신규 명령·문서, 기존 동작 비호환 변경 없음)

## 배경

svelte-arch는 여러 소비 프로젝트(이 저장소 자체 포함, macOS·Windows 양쪽에서 작업된 이력 확인 — `docs/superpowers/plans/2026-07-05-resolve-rule-and-verify.md`의 `/Users/gimtaehui/...` 경로 vs 이 세션의 `Z:\Projects\svelte-arch`)에 설치되어 쓰인다. 실사용 중 kit 개선 필요가 발견되면 지금은 대화 중 흘러가는 요청으로 남거나(세션 종료 시 유실), 있다 해도 "일단 로컬에서 우회" 수준에 그친다. 이 설계는 그 요청을 **항상 업스트림(`XIYO/svelte-arch`)에 대한 PR**로 formalize하는 프로토콜을 정의한다 — 이슈가 아니라 PR인 이유는 (a) 요청자 자신이 이 kit의 유일한 실사용자이자 메인테이너라 "논의 후 누군가 구현"이 아니라 "가능하면 그 자리에서 실물 diff"가 더 유용하고, (b) 이 저장소는 이미 설계 문서조차 실제 커밋(`docs: ... 설계 스펙`)으로 남기는 관행이 있다 — PR은 그 연장.

## 범위 — 이번 설계에 포함되지 않는 것

- 자동/암묵적 트리거는 없다. **항상 명시적 슬래시 커맨드**(`/arch-feedback`)로만 시작한다 — PR·push는 최상위 CLAUDE.md의 "visible to others" 액션 범주라 자동 발동 대상이 아니다.
- push·PR 생성 직전에는 **항상 사용자 확인**을 거친다(브랜치·diff·PR 제목/본문/라벨 프리뷰 제시 후 승인). 이 설계는 확인 없이 진행되는 경로를 만들지 않는다.
- 요구사항의 규모 판정(기계적 vs 설계급)은 **자동 분기**하되(사용자 결정: "규모별 자동 분기(권장)"), 최종 push 여부는 규모와 무관하게 항상 사람이 확인한다 — 판정 자체를 별도로 재확인받지는 않는다(승인 지점은 1곳으로 단순화).
- `arch.mjs`에 새 서브커맨드를 추가하지 않는다 — 이 워크플로우는 자연어 이해·PR 본문 작성 등 LLM 판단이 핵심이라 "정규식·무 AST" 원칙의 `arch.mjs`(순수 결정적 CLI)에 넣기에 성격이 다르다. 대신 **슬래시 커맨드**(`commands/arch-feedback.md`, `arch-sync.md`와 동급)로 분리.

## 기능 1 — 슬래시 커맨드 `/arch-feedback`

### kit 소스 위치 해석 (fallback 체인)

1. cwd의 `.claude-plugin/plugin.json`의 `name === "svelte-arch"` → cwd 자체가 kit 소스, 그대로 사용
2. 아니면 `${CLAUDE_PLUGIN_ROOT}` 환경변수 존재 → 그 경로가 kit 소스(대부분의 실사용 경로 — 소비 프로젝트에서 이 커맨드를 부를 때)
3. 둘 다 없으면 사용자에게 로컬 클론 경로를 묻거나 `gh repo clone XIYO/svelte-arch <tmp>`(임시 클론, 작업 후 정리)를 제안

### 워크플로우

```text
① 요구사항 이해 — 사용자 발화를 요약해 "이렇게 이해했습니다" 되짚어 확인
② kit 소스 위치 해석(위 fallback) → cd, 작업트리 클린 확인 → git fetch && git rebase origin/main(또는 최신 pull)
③ 환경정보 수집(아래 "환경정보 블록")
④ 규모 판정(기계적 / 설계급 — "기능 2" 기준)
⑤-A [기계적] 브랜치 생성 → 최소 구현 → (arch.mjs 변경 시) 룰 저작 불변식 3조 재확인 +
     스크래치 fixture로 육안 검증(이 저장소 관행 — 단위테스트 없음) →
     버전 4소스 동시 갱신(kit/VERSION·KIT_VERSION·plugin.json·CHANGELOG) → 커밋
⑤-B [설계급] 브랜치 생성 → docs/superpowers/specs/<날짜>-<슬러그>-design.md 신설(요구사항·배경·대안) →
     코드·버전 변경 없음 → 커밋
⑥ PR 제목·본문·라벨 초안 작성("기능 3" 규격)
⑦ **사용자에게 프리뷰 제시 + 확인 질문** — 승인 시에만 push + `gh pr create`
⑧ PR URL 보고
```

### 규모 판정이 애매할 때

기계적 신호와 설계급 신호가 혼재하면 **설계급으로 취급**(안전 쪽) — 코드 변경 없는 제안 PR이 되므로 리스크가 낮다.

`arch.mjs`를 직접 건드리는 기계적 변경은 특히 주의: 이 저장소는 룰 저작 불변식(① 문장 단위 매칭, content.matchAll() — 라인 단위 금지 ② 배럴 star 재수출까지 이름 단위 해석 ③ typeOnly는 지정자 단위) 위반으로 이미 세 차례 실사용 버그를 냈다(CHANGELOG 4.1.1·4.1.2·4.2.1 — 전부 이 3조 위반의 수리). 기계적으로 보여도 이 3개 불변식 체크리스트를 반드시 재확인한 뒤 구현한다.

## 기능 2 — 규모 판정 기준 (기계적 vs 설계급)

| 신호 | 기계적(즉시 구현) | 설계급(제안 문서만) |
|---|---|---|
| 대상 | 오탈자·문구 수정, 기존 패턴을 그대로 복제하는 감사 룰 1개, 카운트/버전 문자열 갱신, 이미 결론난 사항의 문서 반영 | 신규 계층/segment, 기존 룰과 상충 가능한 변경, 여러 파일에 걸친 트레이드오프, 실사용 사례가 1건뿐이라 일반화 근거 부족 |
| 근거 확보 | 즉시 자명 | 리서치·대안 비교 필요(이 저장소는 헌법 조항 도입 시 권위 레퍼런스 딥리서치 + 3-vote 적대검증을 거친 전례 — `research/modernization-research-2026-07.md`) |
| 산출물 | 코드/문서 diff + 버전 bump + CHANGELOG | `docs/superpowers/specs/` 신규 파일만 |
| 후속 | 없음(완결) | 사람(또는 별도 세션)이 나중에 plan → 구현 |

## 기능 3 — PR 제목·본문·라벨 규격

### 제목 — Conventional Commits (이 저장소 기존 관행 그대로 재사용)

이미 git log가 `feat:`/`fix:`/`feat!:`/`fix(release):`/`docs:` 등을 쓰고 있으므로 새 컨벤션을 만들지 않는다. scope는 아래 라벨의 `area:*` 접미사와 1:1 대응시켜 제목만 보고도 라벨을 예측 가능하게 한다.

- 기계적 예: `feat(audit): REQUIRE_ZOD_ON_REMOTE 룰 추가`, `fix(constitution): A9 클래스 배열 예외 조건 정정`
- 설계급 예: `docs(specs): server actions 지원 여부 설계 제안` — 이 저장소가 이미 쓴 실례가 있다: `07ecbd6 docs: resolve() 헌법 조항 + arch.mjs verify 설계 스펙`

### 본문 템플릿

```markdown
## Summary
<요구사항 원문 1~2문장 요약>

## Motivation
<왜 필요한지 — 어느 소비 프로젝트/상황에서 발견됐는지>

## Environment
- OS: <platform> <release> (<arch>)
- Runtime: bun <version> (또는 node <version>)
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

커밋 자체에는 기존 관행대로 `Co-Authored-By: Claude <noreply@anthropic.com>` 트레일러를 붙인다(이 하네스의 기존 커밋 컨벤션과 동일 — 새 규칙 아님).

### 환경정보 블록 — 수집 방법(크로스플랫폼)

셸별 분기(`uname` vs `ver`) 대신 이미 의존 중인 런타임으로 일원화:

```bash
bun -e "const os = await import('node:os'); console.log(os.platform(), os.release(), os.arch())"
bun --version
```

(ESM only — `require()` 금지, 동적 `import()`로 통일.)

`platform()` 값은 `win32`/`darwin`/`linux`로 나오므로 라벨(`area:*`)과는 별개로 PR 본문에만 텍스트로 남긴다 — OS는 라벨로 분류할 "카테고리"가 아니라 재현/트리아지용 "인스턴스 메타데이터"라 라벨 남발보다 본문 기재가 맞다(레퍼런스 조사 결과와 일치 — 아래 참고자료).

### 라벨 택소노미 (신규 — 저장소는 현재 GitHub 기본 라벨만 보유, 커스텀 0)

| 라벨 | 색상(제안) | 용도 |
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

기존 GitHub 기본 라벨(`bug`·`enhancement`·`documentation` 등)은 삭제하지 않되 이 워크플로우에서는 쓰지 않는다(중복 의미 방지 — `type:*`로 대체). 저장소에 라벨이 없으면 커맨드가 `gh label list`로 확인 후 **부족분만 생성 제안**(사용자 확인 후 `gh label create`) — 최초 1회성 일괄 세팅 스크립트에 의존하지 않고 커맨드 자체가 자기 충족적으로 동작.

## 기능 4 — 안전장치

- push·PR 생성 전 **항상** 브랜치명·`git diff --stat`·PR 제목/라벨/본문 전문을 사용자에게 보여주고 "이대로 push 하고 PR을 만들까요?"를 묻는다.
- 라벨이 새로 필요하면(저장소에 없으면) 그 생성도 별도로 확인받는다 — 라벨 생성은 그 자체로 저장소의 살아있는 상태를 바꾸는 행동.
- git identity는 건드리지 않는다(사용자의 기존 `user.name`/`user.email` 그대로 사용).
- **버전 가드가 이미 이 워크플로우의 안전망 역할** — 기계적 경로에서 버전 4소스 갱신을 빠뜨려도 기존 `.githooks/pre-push`(`check-version-sync.mjs`)가 push 자체를 막는다. 이 설계가 별도 검증 로직을 새로 만들 필요가 없다.

## 레퍼런스 문서 신설 — `references/contribution.md`

이번 설계의 상세(규모 판정 체크리스트·PR 템플릿·라벨 택소노미·환경정보 수집법)를 이 파일로 옮긴다. `SKILL.md`의 progressive disclosure 표에 한 행 추가:

| 필요한 것 | 파일 |
|---|---|
| 업스트림 기여(요구사항→PR) 프로토콜 | `references/contribution.md` |

## `claude-block.md` — 1줄 추가 (전 소비 프로젝트 전파)

밀도=컨텍스트 비용 원칙상 전체 프로토콜은 넣지 않고, 존재만 알리는 포인터 1줄만 "핵심 금칙" 다음 줄에 추가:

```
- **킷 개선이 필요하면**: `/arch-feedback`(또는 에이전트에게 "kit에 이거 요청으로 남겨줘")로 업스트림에 PR을 남길 수 있다.
```

## CHANGELOG / 버전

- `kit/VERSION`: `5.4.0` → `5.5.0` (MINOR — 신규 명령·문서, 기존 동작 비호환 변경 없음)
- 신설: `commands/arch-feedback.md`, `skills/svelte-arch/references/contribution.md`
- 갱신: `SKILL.md`(progressive disclosure 표), `claude-block.md`(1줄), `README.md`(구성 섹션에 커맨드 언급), `CHANGELOG.md`
- 저장소 라벨 12종 신규 생성(코드 변경 아님 — `gh label create` 1회성 작업, 구현 단계에서 별도 확인 후 실행)

## 영향받는 파일 (구현 계획에서 상세화)

- `commands/arch-feedback.md` — 신설(이번 설계의 "기능 1" 워크플로우를 `arch-sync.md`와 같은 프로즈 스타일로)
- `skills/svelte-arch/references/contribution.md` — 신설
- `skills/svelte-arch/SKILL.md` — progressive disclosure 표 1행
- `skills/svelte-arch/kit/templates/claude-block.md` — 1줄
- `skills/svelte-arch/kit/VERSION`, `arch.mjs` `KIT_VERSION`, `plugin.json`, `README.md`, `CHANGELOG.md` — 버전 4소스 + 문서
- (파일 아님) GitHub 저장소 라벨 12종 생성

## 참고자료(리서치 출처)

- 라벨 프리픽스 컨벤션(`type:`/`area:`/`priority:`) — [Sane GitHub Labels](https://medium.com/@dave_lunny/sane-github-labels-c5d2e6004b63), [GitHub Labels that are logical, colorful and sensible](https://seantrane.com/posts/logical-colorful-github-labels-18230/), [Managing labels – GitHub Docs](https://docs.github.com/en/issues/using-labels-and-milestones-to-track-work/managing-labels)
- 환경정보 섹션 컨벤션(OS/런타임 버전 기재) — [Configuring issue templates – GitHub Docs](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/configuring-issue-templates-for-your-repository), [actions/toolkit bug_report.md](https://github.com/actions/toolkit/blob/main/.github/ISSUE_TEMPLATE/bug_report.md)
- PR 제목 = Conventional Commits — [amannn/action-semantic-pull-request](https://github.com/amannn/action-semantic-pull-request)
- 에이전트 저작 커밋/PR 표시 관행(Co-Authored-By) — [Claude Code Git Guide](https://www.deployhq.com/blog/how-to-use-git-with-claude-code-understanding-the-co-authored-by-attribution)
