# svelte-arch — 흡수됨 · Archived

**이 독립 플러그인은 [`XIYO/plug-hole`](https://github.com/XIYO/plug-hole) 의 `workbench` 플러그인
(`plugins/workbench`)으로 흡수됐습니다.** 이 저장소는 더 이상 갱신되지 않으며 읽기 전용입니다.
마지막 릴리스는 kit v7.2.1(2026-07-29)이고, 그 이후 개발은 전부 plug-hole 에서 이어집니다.

> This standalone plugin has been absorbed into the `workbench` plugin of
> [`XIYO/plug-hole`](https://github.com/XIYO/plug-hole). The repository is archived and read-only.

## 설치 — 이 저장소가 아닙니다

아래 명령은 **더 이상 동작하지 않습니다.** 이 저장소는 마켓플레이스에서 내려갔습니다.

```bash
# 폐기됨 — 쓰지 마세요
/plugin marketplace add XIYO/svelte-arch
/plugin install svelte-arch@svelte-arch
```

`workbench` 를 설치하면 `svelte-arch` 스킬·kit·슬래시 커맨드가 함께 들어옵니다.
plug-hole 은 비공개 저장소라 설치에는 접근 권한이 필요합니다.

```bash
# Claude Code
/plugin marketplace add XIYO/plug-hole
/plugin install workbench@xiyo

# Codex
codex plugin marketplace add XIYO/plug-hole
codex plugin add workbench@xiyo
```

슬래시 커맨드 이름에는 플러그인 접두사가 붙습니다 — `/arch-sync` → `/workbench:arch-sync`,
`/arch-feedback` → `/workbench:arch-feedback`.

## 무엇이 어디로 갔나

| 이 저장소 | plug-hole 안의 자리 |
| --- | --- |
| `skills/svelte-arch/**` | `plugins/workbench/skills/svelte-arch/**` |
| `skills/playwright-e2e/**` | `plugins/workbench/skills/playwright-e2e/**` |
| `commands/arch-sync.md`, `commands/arch-feedback.md` | `plugins/workbench/commands/` |
| `.mcp.json`(공식 Svelte MCP) | `plugins/workbench/.mcp.json` |
| `CHANGELOG.md`(kit v3.0.0–v7.2.1) | `plugins/workbench/docs/svelte-arch-kit-changelog-001.md` |
| `research/`, `docs/superpowers/**` | `plugins/workbench/docs/svelte-arch-*.md` |

업스트림 기여(`/arch-feedback`)의 대상도 plug-hole 입니다. 이 저장소에는 이슈·PR 을 열지 마세요.

## 히스토리

이 저장소의 커밋 34개(2026-07-03 … 2026-07-29)는 파일 스냅샷으로 흡수돼 plug-hole 의 히스토리에는
없습니다. 커밋 객체 전체는 소유자가 `git bundle`(HEAD `2bf2c6b`)로 따로 보관하며, SHA·날짜 표는
plug-hole 의 `plugins/workbench/docs/svelte-arch-kit-changelog-001.md` 에 남아 있습니다.

## License

[MIT](LICENSE) © 2026 XIYO
