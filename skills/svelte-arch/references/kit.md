# arch kit — 설치·업데이트·버전 관리

> 킷은 **프로젝트 레포에 커밋되는 로컬 설치물**이다(머신 글로벌 설치 금지 — 머신마다 드리프트하고 CI가 못 쓴다). 이 스킬이 배포 채널: 설치·업데이트·검증을 에이전트가 이 문서대로 수행한다.
>
> **룰 주입은 전부 로컬**: 머신 글로벌 룰 파일은 만들지 않는다(SKILL.md §룰 주입). 프로젝트의 상시 트리거는 kit이 설치하는 루트 CLAUDE.md 마커 블록(그 프로젝트 매 세션 자동 로드)이 전담한다.

## 설치 풋프린트 — 숨김 폴더 하나에 봉인

도구 파일은 프로젝트 트리에 노출하지 않는다(`.storybook/`·`.husky/` 관례). 사용자·에이전트 접점은 명령 이름뿐이므로 경로는 숨겨도 아무것도 안 바뀐다:

```text
<프로젝트>/
├── .svelte-arch/            # 유일한 설치 폴더
│   ├── arch.mjs             # CLI (kit-owned — 버전 기록도 이 파일 헤더)
│   ├── config.mjs           # 프로젝트 확장 (project-owned)
│   └── hooks/pre-commit     # core.hooksPath 가 여기를 가리킴
├── package.json             # arch:manifest·arch:audit 2줄
└── CLAUDE.md                # 마커 블록 (기존 파일 안)
```

README.md들은 설치물이 아니라 **프로젝트 자기서술**(전 디렉토리 의무) — 숨김 대상이 아니다.

## 소유권 경계 (업데이트 안전성의 핵심)

| 파일 | 소유 | init 재실행 시 |
|---|---|---|
| `.svelte-arch/arch.mjs` | **kit** — 헤더에 "kit-owned, 수정 금지" | 덮어씀 |
| `.svelte-arch/hooks/pre-commit` | kit | 덮어씀 |
| `.svelte-arch/config.mjs` | **project** — 확장 룰·allowlist·중립 리터럴 | **불가침** (없을 때만 씨앗) |
| 각 디렉토리 `README.md` | project (씨앗은 kit) | 없는 곳만 씨앗, 기존 불가침 |
| 루트 `CLAUDE.md` 마커 블록 | kit (블록 안만) | 블록 구간만 교체 |
| `package.json` scripts 2줄 | kit (해당 키만) | 해당 키만 갱신 |

프로젝트 확장은 전부 `config.mjs`로 — CLI 본체를 고치고 싶어지면 그건 코어 룰 후보이니 스킬 저장소에 반영이 정답.

## init — 설치·업데이트·마이그레이션이 한 명령 (선언적 수렴)

```bash
bun <스킬경로>/kit/init.mjs   # "이 프로젝트를 kit 현재 버전 상태로 만들어라"
```

- **최초 실행** = 스캐폴드: 위 풋프린트 전체 + README 씨앗(관장 트리 전 디렉토리, 역할 초안 자동 기입) + 마커 블록.
- **재실행** = 업데이트: 설치 버전(`.svelte-arch/arch.mjs` 헤더 `KIT_VERSION` — 별도 상태 파일 없음, 파일이 곧 상태)을 감지해 kit-owned 동기화 + **대기 마이그레이션 자동 적용**.
- **마이그레이션**: `kit/migrations/<ver>.mjs` — 설치 버전과 kit 버전 사이를 semver 순으로 실행. 디렉토리 구조·접미사 체계 같은 비호환 변경(MAJOR)은 마이그레이션 동봉 없이 릴리스 금지. 실행 조건 = 깨끗한 작업트리(`--force` 강행 가능), 멱등 의무, 롤백 = git. 계약 상세 = `kit/migrations/README.md`.
- 완료 후: `bun run arch:audit`(신규 룰 warn 확인) + `git diff` 리뷰 → 커밋 `chore(arch): kit vX.Y.Z`.

## 설치된 프로젝트 전체 업데이트

- **레이지(기본)**: 에이전트는 매 UI 작업마다 `arch:manifest`를 실행하므로 1행의 kit 버전으로 드리프트를 자동 감지 → 그 자리에서 init 재실행 제안. 레지스트리 불요.
- **일괄 스윕**: "전 프로젝트 kit 업데이트" 요청 시 — 프로젝트 루트들을 스캔해 `.svelte-arch/arch.mjs` 보유 레포를 발견(레지스트리 없이 파일 존재 = 설치 증거), 각 레포에서 init 실행 → 레포별 diff 리뷰·커밋. 머신 상태 파일 없이 스캔만으로 동작.
- **(선택) CI 체크**: 공개 배포 후에는 CI가 배포 저장소의 `kit/VERSION`(raw URL)과 로컬 버전을 비교해 구버전이면 경고하는 잡을 추가할 수 있다.

## semver 정책

- **MAJOR** — 규칙 비호환(접미사 변경·트리 개편 등). **`migrations/<ver>.mjs` 코드모드 동봉 의무.**
- **MINOR** — 룰 추가. **신규 룰은 도입 MINOR에서 warn, 다음 MINOR에서 error 승격** — 설치된 프로젝트가 갑자기 깨지지 않게.
- **PATCH** — 버그픽스·오탐 수정.
- 버전 갱신 시: `kit/VERSION` + `arch.mjs` 헤더 상수 + `.claude-plugin/plugin.json` version + CHANGELOG 네 곳 동시.

## 마커 블록 내용 (루트 CLAUDE.md)

`kit/templates/claude-block.md`가 정본. 핵심 3행: ① 파일 종별 규칙 존재 + 이 스킬 참조 ② **README 게이트**("작업 디렉토리와 상위에 README.md가 있으면 편집 전 반드시 읽는다") ③ 프로토콜 명령(UI 작업 전 `arch:manifest`, 커밋 전 `arch:audit`).
