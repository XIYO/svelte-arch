---
description: kit 개선 요구사항을 업스트림(XIYO/svelte-arch)에 PR로 접수한다 (규모별 자동 분기 — 기계적=즉시 구현, 설계급=제안 문서만. 항상 push 전 사용자 확인)
---

사용자의 kit 개선 요구를 업스트림 PR로 만들어라:

1. **요구사항 확인** — 사용자 발화를 요약해 "이렇게 이해했습니다: …"로 되짚어 확인한다.
2. **kit 소스 위치 해석**:
   - cwd의 `.claude-plugin/plugin.json`의 `name`이 `svelte-arch`이면 cwd 자체를 kit 소스로 쓴다.
   - 아니면 `${CLAUDE_PLUGIN_ROOT}` 환경변수 경로를 쓴다.
   - 둘 다 없으면 로컬 클론 경로를 묻거나 `gh repo clone XIYO/svelte-arch <tmp>`(임시 클론, 작업 후 정리)를 제안한다.
   - 해당 경로에서 작업트리 클린 확인 → `git fetch && git rebase origin/main`으로 최신화.
3. **환경정보 수집**:

   ```bash
   bun -e "const os = await import('node:os'); console.log(os.platform(), os.release(), os.arch())"
   bun --version
   ```

   kit 버전은 kit 소스 자체에서 작업 중이면 `kit/VERSION`, 소비 프로젝트에서 발견된 요구사항이면 설치된 `.svelte-arch/arch.mjs`의 `KIT_VERSION` 헤더에서 읽는다.
4. **규모 판정**(기계적 vs 설계급 — 기준표는 `references/contribution.md`) — 애매하면 설계급으로 취급한다. `arch.mjs`를 직접 건드리는 기계적 변경은 룰 저작 불변식 3조(파일 헤더 주석)를 반드시 재확인한다.
5. **분기 구현**:
   - **기계적**: 브랜치 생성 → 최소 구현 → (`arch.mjs` 변경 시) 스크래치 fixture로 육안 검증 → 버전 4소스(`kit/VERSION`·`arch.mjs` `KIT_VERSION`·`plugin.json`·`CHANGELOG.md`) 동시 갱신 → 커밋.
   - **설계급**: 브랜치 생성 → `docs/superpowers/specs/<날짜>-<슬러그>-design.md` 신설(요구사항·배경·대안) → 코드·버전 변경 없음 → 커밋.
6. **PR 제목·본문·라벨 초안** — 템플릿·라벨 택소노미는 `references/contribution.md`. 제목은 이 저장소 기존 Conventional Commits 관행 그대로, scope는 `area:*` 라벨과 1:1 대응.
7. **라벨 확인** — `gh label list --repo XIYO/svelte-arch`로 필요한 라벨 존재를 확인한다. 없으면 생성 목록을 사용자에게 제시하고 승인 후 `gh label create`.
8. **확인 게이트(필수)** — 브랜치명·`git diff --stat`·PR 제목/라벨/본문 전문을 보여주고 **"이대로 push 하고 PR을 만들까요?"**를 반드시 묻는다. 승인 후에만 push + `gh pr create --repo XIYO/svelte-arch`.
9. **결과 보고** — PR URL을 전달한다.

규범 상세 = `references/contribution.md`(본문 템플릿 전문·라벨 택소노미·규모 판정 체크리스트).
