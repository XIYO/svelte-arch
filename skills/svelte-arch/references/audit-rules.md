# 감사 룰 매트릭스

> 구현 = `kit/scripts/arch.mjs audit`. R0에 따라 **모든 룰은 종별(kinds)을 지명**한다. 원칙: AST 말고 grep — 정규식 한 줄로 표현 안 되는 규율은 감사가 아니라 체크리스트(비자동)로 둔다.

## 코어 룰 (kit 소유 — 전 프로젝트 공통)

| 코드 | kinds | 위반 | 심각도 |
|---|---|---|---|
| `UNMARKED_COMPONENT` | (무표 .svelte) | routes 밖 `.svelte`가 종별 미선언 | error |
| `SUFFIX_DIR_MISMATCH` | primitive·composite·live | 접미사↔디렉토리 불일치(.primitive가 primitive/ 밖 등) — 두 채널 상호 검증 | error |
| `LIVE_WITHOUT_PAIR` | live | 같은 폴더에 동일 Base의 `.composite` 페어 부재 | error |
| `UPWARD_IMPORT_IN_PRIMITIVE` | primitive | `$lib/data`·`$lib/server`·`$lib/state`·composite/live·`$app/navigation`·`$app/state` import | error |
| `CROSS_DOMAIN_IMPORT` | composite·live | 타 도메인 폴더 import (type-only 제외, layout↔도메인 상호 포함) | error |
| `REMOTE_IN_DUMB` | composite | `.remote` 값 import (type 제외) | error |
| `STATE_MODULE_IN_DUMB` | composite·primitive | `*.svelte.ts` 상태 모듈 값 import (live 전용) | error |
| `GLUE_LOGIC` | glue(+page·+layout) | `$state(`·`$effect`·remote import — 글루 배선 0 | error |
| `LIVE_IMPORT_OUTSIDE_GLUE` | (전체) | `.live.svelte`를 글루 외 파일이 import (live→live 포함) | error |
| `LIVE_MARKUP` | live | `<svelte:`·script·style 외 HTML 요소 태그 | error |
| `UI_VENDOR_IMPORT` | (primitive·vendor 제외 전체) | `components/ui/` import | error |
| `NO_BARREL_FILE` | (구조) | primitive·도메인 루트의 index.ts (세트 폴더 제외) | error |
| `NO_BARREL_IMPORT` | (전체) | 디렉토리 경로 import(`…/primitive'` 등 파일명 없는 형태, 세트 폴더 제외) | error |
| `SET_BARREL_LEAK` | 세트 index.ts | 세트 밖 파일 재수출 / 재수출 외 로직 | error |
| `SET_PARTIAL_IMPORT` | (전체) | 세트를 `import {…}` 부분 구조분해 (네임스페이스 `* as` 의무) | error |
| `DUPLICATE_ESCAPE_HATCH` | primitive·composite | 동일 `*Class="…"` 리터럴(토큰 **정렬** 정규화, ≥4토큰)이 2개 파일+ (primitive 내부 1파일은 합법) | error |
| `CLASS_MERGE_IMPORT` | primitive·composite·live·glue | `cn`/`clsx`/`tailwind-merge`/`classnames` import — 내장 `class={[...]}` 배열 사용 | error |
| `STRING_CLASS_ON_COMPONENT` | primitive·composite·live·glue | 컴포넌트 태그에 문자열 `class="…"` — `class={[...]}` 배열 사용 | error |
| `TEMPLATE_LITERAL_CLASS` | primitive·composite | `` class={`…${}…`} `` 템플릿 합성 — 배열 사용(정적 분석 가능해야) | error |
| `MISSING_COMPONENT_DOC` | primitive·composite | `<!-- @component -->` 부재 | error |
| `UNNAMED_PROPS_TYPE` | primitive·composite | `$props()` 사용하며 `type/interface Props` 명명 부재 | error |
| `UNDOCUMENTED_PROP` | primitive | TSDoc 없는 Props 멤버 | warn |
| `DOMAIN_DEFAULT_IN_PRIMITIVE` | primitive | 문구 prop 기본값에 비중립 어휘(중립 목록은 config) | warn |
| `CALLBACK_NAME_STYLE` | primitive·composite | Props 선언 콜백이 `on소문자`(camelCase `onXxx` 의무) | warn→error |
| `MISSING_README` | (디렉토리) | 관장 트리(`src/lib/**`, routes 제외) **모든 디렉토리**의 README.md 부재 — kit 설치가 씨앗을 자동 생성하므로 부재는 항상 위반 | error |

`warn→error` = semver 정책(kit.md): 신규 룰은 도입 MINOR에서 warn, 다음 MINOR에서 error 승격.

## 체크리스트 룰 (비자동 — 리뷰·에이전트 워크플로우에서 확인)

- `$effect` 안 remote 호출 금지 (정규식 신뢰도 낮음 — live 카드 금칙)
- command 후 무효화할 query `refresh()` 명시
- remote `form()` `.as()` 스프레드는 네이티브 input에만
- 상태 prop 표준명(loading/error/disabled) · `$bindable`은 value/open/ref만
- live 로직 비대(≈100줄+·상태기계) → `*.svelte.ts` 추출

## 프로젝트 확장 룰 (`.svelte-arch/config.mjs` — project-owned)

토큰 강제·네이티브 컨트롤 금지·승격 재발방지 룰은 프로젝트마다 다르다. config의 `rules` 배열에 코어와 같은 스키마로 추가:

```js
// .svelte-arch/config.mjs (예시 — kit 업데이트가 건드리지 않는 파일)
export default {
	neutralLiterals: ['확인', '취소', '닫기', '저장', '검색'],
	allow: {
		crossDomain: [],        // 공개 부채 목록 — 항목마다 백로그 사유 주석 의무
		liveOutsideGlue: []
	},
	rules: [
		{
			code: 'RAW_HEX',
			desc: 'raw hex 사용 (디자인 토큰만)',
			kinds: ['primitive', 'composite'],
			severity: 'error',
			pattern: /#[0-9a-fA-F]{3,8}\b/g
		}
		// NATIVE_FORM_CONTROL·IME_MISSING·RAW_PX… — 승격할 때마다 재발방지 룰 추가
	]
};
```

- **allowlist = 공개 부채**: 예외는 숨기지 않고 config에 사유와 함께 명시 — 줄어드는 것만 허용되는 목록.
- 패턴: 승격 절차 5단계(discipline.md)가 끝날 때마다 룰이 하나 늘어난다 — 룰 목록이 곧 승격의 역사.

## pre-commit 배선

```bash
#!/usr/bin/env bash
# .svelte-arch/hooks/pre-commit — staged만 감사 (기존 위반 baseline 유지, 새 변경만 차단)
set -e
cd "$(git rev-parse --show-toplevel)"
STAGED=$(git diff --cached --name-only --diff-filter=ACMR | grep -E '\.(svelte|ts)$' || true)
[ -z "$STAGED" ] && exit 0
echo "$STAGED" | xargs bun .svelte-arch/arch.mjs audit --files
```

`git config core.hooksPath .svelte-arch/hooks`(init이 설정, package.json `prepare`가 새 클론 커버). 전체 모드 0건 달성 후 CI에 전체 모드 승격.
