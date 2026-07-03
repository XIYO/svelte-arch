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
4. **기존 구조 감지 시(무표 컴포넌트 존재)** — init 출력이 안내하는 대로:
   - `bun run arch:plan`을 실행해 이행 플랜(이동·리네임·배럴 폐기·임포트 치환 규모)을 **표로 사용자에게 제시**한다.
   - 반드시 이렇게 묻는다: **"디렉토리 체계를 svelte-arch 표준대로 이렇게 옮기겠습니다. 진행할까요?"**
   - **승인한 경우에만** `bun run arch:plan -- --apply` → `svelte-check`·`arch:audit`로 검증. 승인 없이 적용 금지 — 구조 이행은 사용자의 결정이다.
5. `git diff`를 검토해 이상 없으면 `chore(arch): kit vX.Y.Z 설치` 커밋을 제안한다.
6. 규범 상세가 필요하면 `skills/svelte-arch/references/constitution.md`(헌법)와 `references/kit.md`(운영)를 참조한다.
