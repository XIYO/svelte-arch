# arch kit — 설치·업데이트·버전 관리 (v5)

> 킷은 **프로젝트 레포에 커밋되는 로컬 설치물**(머신 글로벌 0 — 머신 드리프트·CI 불가 방지). 이 스킬이 배포 채널.

## 설치 풋프린트

```text
<프로젝트>/
├── .svelte-arch/            # 유일한 설치 폴더
│   ├── arch.mjs             # CLI (kit-owned — 버전 기록 = 헤더 KIT_VERSION)
│   ├── config.mjs           # 프로젝트 확장 (project-owned)
│   ├── plan-overrides.json  # (선택) plan 분류 수정 (project-owned)
│   └── templates/           # arch:new 템플릿 (kit-owned)
├── <core.hooksPath>/pre-commit  # 기존 훅 파일 안 마커 블록만 kit 관리
├── package.json             # arch:* 스크립트 5줄
└── CLAUDE.md                # 루트 마커 블록 (블록 안만 kit 관리)
```

## 소유권 경계 (업데이트 안전성의 핵심)

| 대상 | 소유 | init 재실행 시 |
|---|---|---|
| `.svelte-arch/arch.mjs`·`templates/` | kit | 덮어씀 |
| `.svelte-arch/config.mjs`·`plan-overrides.json` | **project** | 불가침 (없을 때만 씨앗) |
| 훅 `pre-commit`의 **마커 블록 안** | kit | 블록만 교체 — **hooksPath와 블록 밖은 불가침** (기존 훅 체계 존중, 없으면 `.githooks` 생성) |
| 계층·slice `CLAUDE.md` | project (씨앗은 kit) | 없는 곳만 씨앗 |
| 루트 CLAUDE.md 마커 블록 | kit (블록 안만) | 블록만 교체 |
| package.json arch:* 키 | kit (해당 키만) | 해당 키만 갱신 |

## init — 설치·업데이트·마이그레이션이 한 명령 (선언적 수렴)

```bash
bun <스킬경로>/kit/init.mjs   # 최초=스캐폴드 / 재실행=kit-owned 동기화 + 대기 마이그레이션
```

- 설치 버전 = `arch.mjs` 헤더 `KIT_VERSION`(파일이 곧 상태). 마이그레이션 = `kit/migrations/<ver>.mjs` semver 순 실행(깨끗한 트리 필수·멱등·롤백=git).
- **v3→v4는 구조 비호환(MAJOR)**이지만 자동 코드모드가 아니다 — 3계층 분류가 사람 승인을 요구하므로 `migrations/4.0.0.mjs`는 kit-owned 동기화 + `arch:plan` 안내만 수행한다(스킬 규범: 승인 없이 구조 이행 금지).
- **v4→v5는 접미사 개명(MAJOR)**이지만 판단 없는 기계적 rename+문자열 치환이라 `migrations/5.0.0.mjs`가 승인 없이 자동 수행한다(`.live.svelte`→`.container.svelte` git mv + 소스·CLAUDE.md 안 문자열 치환 + `config.mjs`의 `allow.liveOutsideGlue`→`containerOutsideGlue` 키 rename, 멱등).
- 구 트리 감지 시: plan 안내 출력. 완료 후: `arch:audit` + `git diff` 리뷰 → `chore(arch): kit vX.Y.Z`.

## 업데이트 감지

에이전트는 매 작업 `arch:manifest`를 실행하므로 1행의 kit 버전으로 드리프트 자동 감지 → init 재실행 제안. 일괄 스윕은 `.svelte-arch/arch.mjs` 보유 레포 스캔(파일 존재 = 설치 증거).

## semver

- **MAJOR** — 규칙 비호환(좌표계·접미사 개편). 마이그레이션(또는 승인형 plan 경로) 동봉 의무.
- **MINOR** — 룰 추가(도입 시 warn → 다음 MINOR error 승격은 외부 소비자가 생긴 뒤 재개하는 정책 — 현 단계는 소비자가 자기 프로젝트뿐이라 바로 error 허용).
- **PATCH** — 버그픽스. 버전 갱신 = `kit/VERSION` + `arch.mjs` 헤더 + `plugin.json` + CHANGELOG 네 곳 동시.

## 루트 CLAUDE.md 마커 블록

`kit/templates/claude-block.md`가 정본. 핵심: ① 4단 주소 체계 + 배치 사다리 요약 ② 폴더 CLAUDE.md 자동 로드 전제(짧게 유지) ③ 프로토콜(작업 전 `arch:manifest`, 커밋 전 `arch:audit`).
