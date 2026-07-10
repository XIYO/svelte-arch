---
description: kit 개선 요구사항을 업스트림(XIYO/svelte-arch)에 접수한다 — 권한·kit 소스 유무로 전달 경로 자동 분기(직접 push / 이슈 / PR), 규모별 자동 분기(기계적=즉시 구현, 설계급=제안 문서만). 항상 실행 전 사용자 확인(같은 턴의 명시 지시는 승인으로 간주)
---

사용자의 kit 개선 요구를 업스트림에 접수해라:

1. **요구사항 확인** — 사용자 발화를 요약해 "이렇게 이해했습니다: …"로 되짚어 확인한다.
2. **전달 경로 판정** — 두 사실을 확인해 경로를 고른다:
   - **push 권한**: `gh api repos/XIYO/svelte-arch --jq .permissions.push` (gh 미인증·조회 실패 = false 취급)
   - **kit 소스(git 클론)**: ① cwd의 `.claude-plugin/plugin.json`의 `name`이 `svelte-arch`이면 cwd ② `${CLAUDE_PLUGIN_ROOT}` 환경변수 경로 ③ 플러그인 marketplace 설치 경로(`~/.claude/plugins/marketplaces/svelte-arch`) — **플러그인 cache(`plugins/cache/...`)는 버전 스냅샷(비-git)이고 marketplace 쪽이 origin 연결된 실제 클론이다**(2026-07-10 실측) ④ 전부 없으면 `gh repo clone XIYO/svelte-arch <tmp>` 가능 여부.

   | push 권한 | kit 소스 확보 | 경로 |
   |---|---|---|
   | O | O | **A. 직접 push** — 이 저장소 관행(main 직접 커밋). 브랜치·PR 불필요 |
   | O | X — 다른 컴퓨터·kit 미설치 환경·클론 여건 없음 | **B. 이슈 등록** — 풍부한 컨텍스트를 담아 접수만, 주 작업기에서 이슈를 보고 후속 분석·구현 |
   | X | — | **C. PR** — 외부 기여자 경로(fork → 브랜치 → PR) |

   A·C는 해당 클론에서 작업트리 클린 확인 → `git fetch && git rebase origin/main`으로 최신화.
3. **환경정보 수집**:

   ```bash
   bun -e "const os = await import('node:os'); console.log(os.platform(), os.release(), os.arch())"
   bun --version
   ```

   kit 버전은 kit 소스 자체에서 작업 중이면 `kit/VERSION`, 소비 프로젝트에서 발견된 요구사항이면 설치된 `.svelte-arch/arch.mjs`의 `KIT_VERSION` 헤더에서 읽는다.
4. **규모 판정**(기계적 vs 설계급 — 기준표는 `references/contribution.md`) — 애매하면 설계급으로 취급한다. `arch.mjs`를 직접 건드리는 기계적 변경은 룰 저작 불변식 3조(파일 헤더 주석)를 반드시 재확인한다. B(이슈) 경로는 구현하지 않으므로 판정 결과를 이슈 본문의 제안 수위로만 기록한다.
5. **경로별 산출물**:
   - **A. 직접 push**: 기계적 = 최소 구현 → (`arch.mjs` 변경 시) 스크래치 fixture 육안 검증 → 버전 4소스(`kit/VERSION`·`arch.mjs` `KIT_VERSION`·`plugin.json`·`CHANGELOG.md`) 동시 갱신 / 설계급 = `docs/superpowers/specs/<날짜>-<슬러그>-design.md` 신설(코드·버전 변경 없음) → 커밋 → `git push origin main`.
   - **B. 이슈**: `gh issue create --repo XIYO/svelte-arch` — 본문 템플릿·라벨 택소노미는 `references/contribution.md`(§이슈 본문 템플릿). 클론·코드 변경 불필요.
   - **C. PR**: 브랜치 생성 → A와 동일한 규모별 산출물 → 커밋 → push → `gh pr create --repo XIYO/svelte-arch`(제목·본문·라벨 규격은 `references/contribution.md`).
6. **라벨 확인**(B·C) — `gh label list --repo XIYO/svelte-arch`로 필요한 라벨 존재를 확인한다. 없으면 생성 목록을 사용자에게 제시하고 승인 후 `gh label create`.
7. **확인 게이트(필수)** — 산출물 전문(A·C = 브랜치·`git diff --stat`·커밋/PR 제목·본문 / B = 이슈 제목·라벨·본문)을 보여주고 실행 여부를 반드시 묻는다. **단 사용자가 같은 턴에서 이미 push/등록을 명시적으로 지시했다면 그 지시가 곧 승인이다** — 재확인으로 되묻지 않는다.
8. **결과 보고** — 커밋/이슈/PR URL을 전달한다. B 경로는 "주 작업기에서 이 이슈를 보고 분석·구현"이 후속임을 명시한다.

규범 상세 = `references/contribution.md`(본문 템플릿 전문·라벨 택소노미·규모 판정 체크리스트).
