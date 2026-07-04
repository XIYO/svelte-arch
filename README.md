# svelte-arch

**SvelteKit × FSD 2.1 아키텍처 어드바이저 + 프로젝트 주입 킷.**
FSD 2.1 표준 구조(계층·slice·segment·public API·pages first)를 SvelteKit 방언으로 완역하고, FSD가 비워둔 절반(서버 계층·view/container 규율·실행형 매니페스트 발견성)을 자체 규범으로 채운다 — 목적은 하나, **같은 것을 두 번 만들지 않게** 하고 팀(사람+AI 에이전트)이 실수할 자리를 없앤다.

> A Feature-Sliced Design 2.1 advisor & injectable kit for SvelteKit — FSD layers/slices/segments translated into SvelteKit's official config surgery, plus the half FSD leaves blank: a server layer standard (remote→service→repository), a dumb/smart suffix overlay (.view/.container), and an executable manifest that feeds fresh metadata to LLM agents.

## 4단 주소 체계

```text
계층 / slice / segment / 접미사
src/widgets / knowledge-list / ui / KnowledgeListSection.view.svelte
```

| 계층 | 역할 |
|---|---|
| `src/app/` | 초기화 — index.html·hooks·app.css·**routes/**(글루 + pages first 콜로케이션) |
| `src/widgets/` | 자립 대형 블록 (view/container 페어 = 독립 데이터 섬) |
| `src/features/` | 사용자 상호작용(동사) — 폼·다이얼로그·액션 |
| `src/entities/` | 업무 개체(명사) — 표시 view·wire 타입(model)·remote(api) |
| `src/shared/` | 업무 무관 — ui(디자인 시스템)·vendor(shadcn 보존)·lib·model·config |
| `src/server/` | FSD 밖 병렬 스택(`$lib/server` 보호) — slice별 service·repository·adapter |

핵심 규칙: 계층은 아래로만 · 같은 계층 slice 수평 금지 · slice 소비는 public API(index)로만, shared는 딥 임포트만 · remote → service만(건너뛰기 0) · 클래스는 내장 `class={[...]}` 배열만 · **배치 사다리** = 새 코드는 라우트 콜로케이션에서 태어나 둘째 소비자가 생길 때만 하강(FSD 2.1 pages first).

## 3중 방어

1. **몰라서 만든다** → `bun run arch:manifest`(+`--slice`)가 shared/ui API·slice·서버 시그니처·wire 타입을 주입
2. **알아도 안 쓴다** → 배치 사다리 + 소비 규율(소비 → variant → 신설)
3. **그래도 만들면** → `bun run arch:audit`(52룰 — steiger의 no-layer-public-api·insignificant-slice 등 흡수)이 커밋 차단

## 빠른 시작

```bash
# Claude Code — 마켓플레이스 등록 + 플러그인 설치 (1회)
/plugin marketplace add XIYO/svelte-arch
/plugin install svelte-arch@svelte-arch

# 아무 SvelteKit 프로젝트에서 — 설치·업데이트·마이그레이션이 한 명령
bun <플러그인 경로>/skills/svelte-arch/kit/init.mjs
# 또는 에이전트에게: "이 프로젝트에 svelte-arch 설치해줘"
```

설치 풋프린트: `.svelte-arch/`(CLI·config·템플릿) + package.json 5줄 + CLAUDE.md 마커 블록 + **기존 훅 파일 안 마커 블록**(hooksPath 불가침 — 미설정 시에만 `.githooks` 지정) + 계층·slice CLAUDE.md 씨앗(없는 곳만). 룰은 레포에 커밋된 것만 존재 — 머신 글로벌 0.

기존(비-FSD) 프로젝트는 `arch:plan`이 이행 제안표(svelte.config 수술 + 이동·리네임 + **entities/features/widgets 3계층 분류 휴리스틱**)를 산출하고, 사용자 승인 후에만 `--apply`한다.

## 버전·업데이트

- 설치 버전 = `.svelte-arch/arch.mjs` 헤더(파일이 곧 상태), 매니페스트 1행에 노출 → 에이전트가 드리프트 자동 감지.
- `init.mjs` 재실행 = 업데이트. semver: MAJOR=비호환(마이그레이션 또는 승인형 plan 경로 동봉) · MINOR=룰 추가 · PATCH=수정.

## 구성

```text
skills/svelte-arch/
├── SKILL.md          # 에이전트 진입점 (주소 체계·배치 사다리·프로토콜)
├── references/       # 헌법·fsd-guide(FSD 완역)·규율·감사 52룰·매니페스트·도입·kit
└── kit/              # init.mjs·arch.mjs(CLI)·템플릿·마이그레이션
```

## License

[MIT](LICENSE) © 2026 XIYO

## 팀 배포 (프로젝트 핀 고정)

```json
{
	"extraKnownMarketplaces": {
		"svelte-arch": { "source": { "source": "github", "repo": "XIYO/svelte-arch" } }
	},
	"enabledPlugins": { "svelte-arch@svelte-arch": true }
}
```
