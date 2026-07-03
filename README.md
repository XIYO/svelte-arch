# svelte-arch

**SvelteKit 풀스택 파일 종별 아키텍처 표준 + 프로젝트 주입 킷.**
파일명이 역할을 선언하고, 규칙은 종별에만 걸리고, 발견성은 실행형 매니페스트가 전담한다 — 목적은 하나, **같은 것을 두 번 만들지 않게** 하고 팀(사람+AI 에이전트)이 실수할 자리를 없앤다.

> A file-kind architecture standard & injectable kit for SvelteKit — every file declares its role in its name, rules target kinds only, and an executable manifest feeds fresh component metadata to LLM agents so they stop re-creating what already exists.

## 왜

AI 에이전트(그리고 사람)가 이미 있는 컴포넌트를 두고 또 만드는 원인은 셋이고, 각각 기계적으로 막는다:

1. **몰라서 만든다** → `bun run arch:manifest`가 최신 컴포넌트 API(Props 원문·TSDoc·기본값·소비처)를 작업 컨텍스트에 주입
2. **알아도 안 쓴다** → 스킬 워크플로우가 소비 → variant 추가 → 신설 순서를 강제
3. **그래도 만들면** → `bun run arch:audit`(pre-commit)가 커밋을 차단

## 핵심 규칙 (헌법 요약)

| 종별 | 역할 |
|---|---|
| `*.primitive.svelte` | 도메인 무지 디자인 시스템 — 다른 제품에 복사해도 성립 |
| `*.composite.svelte` | 도메인/셸 조립(dumb) — mock props만으로 렌더 |
| `*.live.svelte` | 데이터 섬 배선 — 페어 dumb 1개에 remote 결합, 마크업 0 |
| `+page` / `+layout` | 최종 조립자 — live 마운트·Snippet 주입만, 배선 로직 0 |
| `*.remote.ts` | wire 경계(humble) — 가드·검증·service 호출·전송 매핑만 |
| `*.service.ts` / `*.repository.ts` | 로직의 실체 — vitest 의무 |
| `ui/**` | vendor 보존(shadcn-svelte 구역) — primitive만 래핑 소비 |

- 무표 `.svelte` = 존재 자체가 위반 · 배럴 금지(compound 세트 폴더만 예외) · 전 계층 딥 임포트
- 클래스 합성은 내장 `class={[...]}` 배열만(cn/clsx 금지 — 배열이어야 린트·정렬·감사가 정확)
- 도메인 간 import 금지 — 공유 욕구 = primitive 승격 신호(Rule of Two)
- 전 디렉토리 `README.md` 의무(자기서술) — init이 씨앗을 자동 생성

전문: [`skills/svelte-arch/references/constitution.md`](skills/svelte-arch/references/constitution.md)

## 빠른 시작

```bash
# Claude Code — 마켓플레이스 등록 + 플러그인 설치 (1회)
/plugin marketplace add XIYO/svelte-arch
/plugin install svelte-arch@svelte-arch

# 아무 SvelteKit 프로젝트에서 — 설치·업데이트·마이그레이션이 한 명령 (선언적 수렴)
bun <플러그인 경로>/skills/svelte-arch/kit/init.mjs
# 또는 에이전트에게: "이 프로젝트에 svelte-arch 설치해줘"
```

설치 풋프린트는 숨김 폴더 하나: `.svelte-arch/`(CLI·config·훅) + package.json 2줄 + CLAUDE.md 마커 블록. 룰은 **레포에 커밋된 것만 존재**한다 — 머신 글로벌 주입 없음, CI·협업자도 동일 강제.

```bash
bun run arch:manifest -- --layer primitive   # UI 작업 전: 디자인 시스템 API 주입
bun run arch:manifest -- --domain <d>        # 도메인 부품 + wire 타입
bun run arch:audit                           # 규칙 감사 (pre-commit 자동)
```

## 버전·업데이트

- 설치 버전 = `.svelte-arch/arch.mjs` 헤더(파일이 곧 상태). 매니페스트 1행에 항상 노출 → 에이전트가 드리프트 자동 감지.
- `init.mjs` 재실행 = 업데이트. 구조 변경(MAJOR)은 `kit/migrations/<ver>.mjs` 코드모드가 자동 적용(깨끗한 작업트리 필수, 롤백=git).
- semver: MAJOR=비호환(마이그레이션 동봉 의무) · MINOR=룰 추가(warn 도입→다음 MINOR error) · PATCH=수정.

## 구성

```text
skills/svelte-arch/
├── SKILL.md                    # 에이전트 진입점 (워크플로우·종별 레지스트리)
├── references/                 # 헌법·매니페스트 프로토콜·소비 규율·감사 룰·도입 플레이북
└── kit/                        # 주입 킷 — init.mjs·arch.mjs(CLI)·템플릿·훅·마이그레이션
```

## License

[MIT](LICENSE) © 2026 XIYO

## 팀 배포 (프로젝트 핀 고정)

프로젝트 `.claude/settings.json`에 선언해 커밋하면, 레포를 여는 팀원의 Claude Code가 자동으로 설치를 제안한다:

```json
{
	"extraKnownMarketplaces": {
		"svelte-arch": { "source": { "source": "github", "repo": "XIYO/svelte-arch" } }
	},
	"enabledPlugins": { "svelte-arch@svelte-arch": true }
}
```
