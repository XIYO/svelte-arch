---
description: 현재 SvelteKit 프로젝트에 svelte-arch kit을 설치/업데이트한다 (선언적 수렴 — 최초=스캐폴드, 재실행=동기화+마이그레이션)
---

현재 프로젝트를 svelte-arch kit 최신 상태로 수렴시켜라:

1. 프로젝트 루트(package.json + src/ 보유) 확인. 작업트리가 깨끗한지 확인하고, 더러우면 사용자에게 알린 뒤 진행 여부를 확인한다.
2. 이 플러그인의 `skills/svelte-arch/kit/init.mjs`를 프로젝트 루트에서 실행한다 (`${CLAUDE_PLUGIN_ROOT}` 변수가 있으면 그 경로 기준):

   ```bash
   bun "<플러그인 루트>/skills/svelte-arch/kit/init.mjs"
   ```

3. 출력 요약을 사용자에게 보여주고, `bun run arch:audit`로 baseline 위반 수를 확인해 보고한다 (기존 프로젝트면 이 수가 갚아야 할 부채 잔고다).
4. `git diff`를 검토해 이상 없으면 `chore(arch): kit vX.Y.Z 설치` 커밋을 제안한다.
5. 규범 상세가 필요하면 `skills/svelte-arch/references/constitution.md`(헌법)와 `references/kit.md`(운영)를 참조한다.
