# arch kit — 설치·업데이트·버전 관리 (v7.2)

> 킷은 **프로젝트 레포에 커밋되는 로컬 설치물**(머신 글로벌 0 — 머신 드리프트·CI 불가 방지). 이 스킬이 배포 채널.

> **실행 런타임 = Bun 전용.** sync·audit·migration·릴리스 검증은 Bun을 요구하며 Node fallback을 두지 않는다. 소스의 `node:` import는 Bun 호환 API 사용이다.

## Codex Svelte MCP 소유권

Codex용 `svelte-arch` 플러그인이 공식 원격 Svelte MCP를 번들한다. 이는 **plugin runtime** 의존성이지 아래 프로젝트 kit 설치 풋프린트가 아니다. 따라서 Codex에서 플러그인을 설치·활성화하고 새 세션을 시작했다면, 같은 서버를 프로젝트 `.mcp.json`이나 `.codex/config.toml`에 별도 등록하지 않는다.

`svelte-check`는 반대로 대상 프로젝트의 Svelte·TypeScript·preprocessor·tsconfig를 함께 읽어야 하는 **프로젝트 devDependency**다. 그래서 kit은 이 바이너리를 플러그인 안에 숨겨 실행하지 않고, 최초 `arch-sync`에서 없으면 `bun add -d svelte-check`, 선언만 있고 설치본이 없으면 `bun install`로 멱등 보장한다. MCP는 문법·권장 패턴 보조 도구이고, `bun run check`는 네트워크와 무관한 최종 컴파일·타입·a11y 보장으로 항상 남는다. Codex 플러그인을 지원하지 않는 호스트는 해당 호스트의 MCP 설정을 별도로 소유한다.

## 설치 풋프린트

```text
<프로젝트>/
├── .svelte-arch/            # 유일한 설치 폴더
│   ├── arch.mjs             # CLI (kit-owned — 버전 기록 = 헤더 KIT_VERSION)
│   ├── config.mjs           # 프로젝트 확장 (project-owned)
│   ├── plan-overrides.json  # (선택) plan 분류 수정 (project-owned)
│   └── templates/           # arch:new 템플릿 (kit-owned)
├── <core.hooksPath>/pre-commit  # 기존 훅 파일 안 마커 블록만 kit 관리
├── .prettierignore           # kit CLI 한 파일만 제외하는 마커 블록 (기존 규칙 불가침)
├── package.json             # arch:* 스크립트 5줄
└── AGENTS.md                # 루트 마커 블록 (블록 안만 kit 관리)
```

## 소유권 경계 (업데이트 안전성의 핵심)

| 대상 | 소유 | init 재실행 시 |
|---|---|---|
| `.svelte-arch/arch.mjs`·`templates/` | kit | 덮어씀 |
| `.svelte-arch/config.mjs`·`plan-overrides.json` | **project** | 불가침 (없을 때만 씨앗) |
| 훅 `pre-commit`의 **마커 블록 안** | kit | 블록만 교체 — **hooksPath와 블록 밖은 불가침** (기존 훅 체계 존중, 없으면 `.githooks` 생성) |
| `.prettierignore`의 **kit CLI 마커 블록 안** | kit | `.svelte-arch/arch.mjs`만 제외 — 프로젝트 포맷 규칙·다른 파일은 불가침 |
| 계층·slice `AGENTS.md` | project (씨앗은 kit) | 없는 곳만 씨앗 |
| 루트 AGENTS.md 마커 블록 | kit (블록 안만) | 블록만 교체 |
| package.json arch:* 키 | kit (해당 키만) | 해당 키만 갱신 |

## arch-sync — 설치·업데이트·마이그레이션이 한 명령 (선언적 수렴)

```bash
bun <스킬경로>/kit/sync.mjs   # 최초=스캐폴드 / 재실행=kit-owned 동기화 + 대기 마이그레이션
```

- 설치 버전 = `arch.mjs` 헤더 `KIT_VERSION`(파일이 곧 상태). 마이그레이션 = `kit/migrations/<ver>.mjs` semver 순 실행(깨끗한 트리 필수·멱등·롤백=git).
- **v3→v4는 구조 비호환(MAJOR)**이지만 자동 코드모드가 아니다 — 3계층 분류가 사람 승인을 요구하므로 `migrations/4.0.0.mjs`는 kit-owned 동기화 + `arch:plan` 안내만 수행한다(스킬 규범: 승인 없이 구조 이행 금지).
- **v4→v5는 접미사 개명(MAJOR)**이지만 판단 없는 기계적 rename+문자열 치환이라 `migrations/5.0.0.mjs`가 승인 없이 자동 수행한다(`.live.svelte`→`.container.svelte` git mv + 소스·AGENTS.md 안 문자열 치환 + `config.mjs`의 `allow.liveOutsideGlue`→`containerOutsideGlue` 키 rename, 멱등).
- **v5→v6는 좌표계 개명(MAJOR)**이다. 공식 기본 좌표를 이미 쓰는 프로젝트는 `migrations/6.0.0.mjs`가 멱등 통과한다. 구 커스텀 좌표가 남아 있으면 디렉터리·deprecated `kit.files`·별칭·도구 설정을 함께 검토해야 하므로 자동 rename하지 않고 정확한 매핑을 출력해 중단한다. 구조 커밋으로 전환한 뒤 sync를 재실행한다.
- **v6→v7은 문법 집행(MAJOR)**이다. 구조 이동 없이 Svelte 5 runes·Snippet·event callback·attachment 규칙을 audit과 AGENTS 카드에 추가한다. sync 뒤 `arch:audit`와 `bun run check`로 기존 부채를 확인한다.
- **v7.1은 최신 attachment 정합(MINOR)**이다. `*.attach.ts`를 UI 종별로 인식하고 `use:`를 `{@attach}`로 올리며, 빈 구 디렉터리는 실제 이행 대상으로 오인하지 않는다.
- **v7.2는 Codex Svelte MCP 번들(MINOR)**이다. 플러그인 manifest가 공식 원격 MCP를 소유하므로 프로젝트별 중복 등록 없이 `svelte_autofixer`를 쓴다.
- 구 트리 감지 시: plan 안내 출력. 완료 후: `arch:audit` + `git diff` 리뷰 → `chore(arch): kit vX.Y.Z`.

## 업데이트 감지

에이전트는 매 작업 `arch:manifest`를 실행하므로 1행의 kit 버전으로 드리프트 자동 감지 → init 재실행 제안. 일괄 스윕은 `.svelte-arch/arch.mjs` 보유 레포 스캔(파일 존재 = 설치 증거).

## semver

- **MAJOR** — 규칙 비호환(좌표계·접미사 개편). 마이그레이션(또는 승인형 plan 경로) 동봉 의무.
- **MINOR** — 룰 추가(도입 시 warn → 다음 MINOR error 승격은 외부 소비자가 생긴 뒤 재개하는 정책 — 현 단계는 소비자가 자기 프로젝트뿐이라 바로 error 허용).
- **PATCH** — 버그픽스. 버전 갱신 = `kit/VERSION` + `arch.mjs` 헤더 + Claude/Codex `plugin.json` + CHANGELOG + SKILL 제목 여섯 곳 동시.

## 루트 AGENTS.md 마커 블록

`kit/templates/agents-block.md`가 정본. root 카드에는 4단 주소·배치 사다리·작업 프로토콜과 범위별 정본 포인터만 둔다. 계층/slice는 씨앗의 역할 1행 + 두는 것/두지 않는 것만 유지하며, audit의 32KiB(root)/16KiB(범위) 경고가 중복 누적을 감시한다.
