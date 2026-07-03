---
description: 현재 SvelteKit 프로젝트에 svelte-arch kit(FSD 2.1)을 설치/업데이트한다 (선언적 수렴 — 최초=스캐폴드, 재실행=동기화+마이그레이션)
---

현재 프로젝트를 svelte-arch kit 최신 상태로 수렴시켜라:

1. 프로젝트 루트(package.json + src/ 보유) 확인. 작업트리가 더러우면 사용자에게 알린 뒤 진행 여부 확인.
2. 이 플러그인의 `skills/svelte-arch/kit/init.mjs`를 프로젝트 루트에서 실행 (`${CLAUDE_PLUGIN_ROOT}` 변수가 있으면 그 경로 기준):

   ```bash
   bun "<플러그인 루트>/skills/svelte-arch/kit/init.mjs"
   ```

3. 출력 요약을 사용자에게 보여준다. init 은 기존 `core.hooksPath` 를 존중하고 pre-commit 안의 마커 블록만 관리한다 — 기존 훅 체계를 덮지 않는다.
4. **구(비-FSD) 구조 감지 시** — init 출력이 안내하는 대로:
   - `svelte.config` 수술 스니펫(스킬 `references/fsd-guide.md`)을 사용자에게 제시하고 적용 여부를 확인한다.
   - `bun run arch:plan`으로 이행 제안표(이동·리네임·**3계층 분류 휴리스틱**·임포트 재작성 규모)를 **표로 제시**한다.
   - 반드시 묻는다: **"FSD 표준대로 이렇게 옮기겠습니다. 진행할까요?"** 분류 수정은 `.svelte-arch/plan-overrides.json`.
   - **승인한 경우에만** `bun run arch:plan -- --apply` → `svelte-check`·`arch:audit`·dev 부팅 스모크로 검증. 승인 없이 적용 금지.
5. `git diff` 리뷰 후 이상 없으면 `chore(arch): kit vX.Y.Z 설치` 커밋을 제안한다.
6. 규범 상세 = `references/constitution.md`(헌법) · `references/fsd-guide.md`(FSD 번역) · `references/kit.md`(운영).
