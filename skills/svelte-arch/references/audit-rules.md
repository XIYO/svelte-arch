# 감사 룰 매트릭스 — 49룰 (v4, steiger 흡수)

> 구현 = `.svelte-arch/arch.mjs audit`. R0에 따라 모든 룰은 대상을 지명한다. 원칙: AST 말고 grep — 정규식 한 줄로 표현 안 되는 규율은 체크리스트(비자동)로.
> 이행 전 프로젝트(구 트리 감지 시) audit은 룰을 돌리지 않고 `arch:plan` 안내만 출력한다.

## A군 — 계층·배치 (10 · steiger 흡수분 표기)

| 코드 | 대상 | 위반 | 심각도 |
|---|---|---|---|
| `LAYER_UPWARD_IMPORT` | 전 계층 | 하위 계층이 상위 계층 import (shared→entities, entities→features …) | error |
| `CROSS_SLICE_IMPORT` | widgets·features·entities | 같은 계층 타 slice import — type-only(index 경유)만 예외. 처방 = 하강 | error |
| `SLICE_PUBLIC_API` | sliced 계층 slice | slice 루트 index.ts 부재 / index에 재수출 외 로직 / slice 밖 재수출 (steiger public-api) | error |
| `NO_LAYER_PUBLIC_API` | 계층 루트 | 계층 루트 index.ts (steiger 동명 룰) | error |
| `NO_SHARED_MEGA_BARREL` | shared/ui·shared/lib | 통합 배럴 — 딥 임포트만 (FSD 공식 처방 = Vite 성능 가이드) | error |
| `DEEP_IMPORT_INTO_SLICE` | 전체 | 타 slice 내부 파일 직접 import — public API(index) 경유 의무. shared는 반대로 딥 의무 | error |
| `SEGMENT_UNKNOWN` | slice·shared·pages | slice 내 ui·api·model·lib·config 외 폴더 / shared 루트의 ui·vendor·lib·model·config 외 폴더 / 닫힌 pages 계층에 파일 존재 | error |
| `UNMARKED_COMPONENT` | 전 `.svelte` | 글루·`.view`·`.live`·`.stories` 외 — **routes 콜로케이션 포함**, vendor 면제 | error |
| `INSIGNIFICANT_SLICE` | sliced 계층 | 소비 파일 1개뿐인 slice → 콜로케이션 회귀 제안 (steiger 동명 룰) | warn |
| `HEAVY_REEXPORT` | slice index | 재수출 12개 초과 — slice 분할 신호 | warn |

## B군 — 품질 오버레이·클라 (22)

| 코드 | 대상 | 위반 | 심각도 |
|---|---|---|---|
| `LIVE_WITHOUT_PAIR` | live | 같은 폴더 동일 Base `.view.svelte` 부재 | error |
| `ENTITY_UI_VIEW_ONLY` | entities/ui | `.live` 존재 — live 욕구 = widget 승격 신호 | error |
| `LIVE_MARKUP` | live | HTML 요소 태그 (boundary+페어+스니펫만) | error |
| `LIVE_IMPORT_OUTSIDE_GLUE` | 전체 | `.live`를 글루 외 파일이 import (view는 Snippet 주입) | error |
| `REMOTE_IN_VIEW` | view | `.remote` 값 import (live 페어가 배선) | error |
| `STATE_MODULE_IN_VIEW` | view | `*.svelte.ts` 값 import (live 전용) | error |
| `APP_STATE_IN_VIEW` | view | `$app/state`·`$app/navigation` import — 외부 정본은 prop 주입 | error |
| `GLUE_LOGIC` | +page/+layout/+error.svelte | `$state(`·`$effect`·remote import | error |
| `SEGMENT_SUFFIX_MISMATCH` | 접미사 전종 | `.view/.live`가 ui·routes 콜로케이션 밖 / `.remote`가 api 밖 / `.svelte.ts`가 model 밖 / `.util`이 lib 밖 / `types.ts`가 model 밖 | error |
| `SHARED_UI_PURITY` | shared/** | `$app/*`·`.remote`·server·업무 계층 import | error |
| `DOMAIN_DEFAULT_IN_SHARED_UI` | shared/ui | 문구 prop 기본값에 비중립 어휘 (중립 목록 = config) | warn |
| `CLASS_MERGE_IMPORT` | 팀 레이어 | cn/clsx/tailwind-merge/classnames import (vendor 면제) | error |
| `TEMPLATE_LITERAL_CLASS` | view | `` class={`…${}`} `` 템플릿 합성 | error |
| `STRING_CLASS_ON_COMPONENT` | view·live·글루 | 컴포넌트 태그 문자열 `class="…"` — 배열로 | error |
| `DUPLICATE_ESCAPE_HATCH` | view | 동일 `*Class` 리터럴(토큰 정렬, ≥4토큰) 2파일+ | error |
| `CLASS_CONST_EXPORT` | 팀 `.ts` | 클래스형 문자열(≥4토큰) 상수 export — 해치 세탁 | warn |
| `MISSING_COMPONENT_DOC` | view | `<!-- @component -->` 부재 | error |
| `UNNAMED_PROPS_TYPE` | view·live | `$props()` 인라인 타입 — `type Props` 명명 필수 | error |
| `UNDOCUMENTED_PROP` | shared/ui view | TSDoc 없는 prop (매니페스트 주입 품질) | warn |
| `CALLBACK_NAME_STYLE` | view | 콜백 prop `on소문자` — camelCase `onXxx` | error |
| `SET_PARTIAL_IMPORT` | 전체 | 세트 부품 부분 구조분해 — `import * as` 네임스페이스 의무 | error |
| `VENDOR_IMPORT` | 전체 | `shared/vendor` 소비가 shared/ui 래핑 밖 | error |

## C군 — 서버 (11)

| 코드 | 대상 | 위반 | 심각도 |
|---|---|---|---|
| `SERVER_KIND_PLACEMENT` | service·repository·adapter·guard·schema·config | `src/server/**` 밖 (서버 전용 보호 상실) + service·repository·adapter는 `server/<slice|shared>/` 밖 | error |
| `SERVER_BOUNDARY` | 전체 | `src/server/**` 값 import가 remote·글루서버·endpoint·hooks 밖 | error |
| `REMOTE_SKIPS_SERVICE` | remote | `.repository`·`.adapter` 값 import — 건너뛰기 0, 예외 없음 | error |
| `REMOTE_DB_IMPORT` | remote | db·schema·drizzle 값 import | error |
| `REMOTE_VALUE_EXPORT` | remote | remote function(query/command/form/prerender) 외 값 export — 런타임 즉사 선제 차단. 타입은 합법 | error |
| `SERVICE_SVELTEKIT_IMPORT` | service·repository | `$app/*`·`@sveltejs/kit`·`getRequestEvent` (`$env` 허용) | error |
| `SCHEMA_VALUE_OUTSIDE_REPOSITORY` | 전체 | `.schema` 값 import가 repository·schema 밖 (시드 포함 예외 0 — type-only 자유) | error |
| `CROSS_SLICE_SERVER_IMPORT` | server/<slice> | 타 server slice 값 import (shared·database·auth 인프라 slice 면제 — 둘째 호출자 시점에 shared로 이동) | error |
| `ADAPTER_CONSUMER` | 전체 | `.adapter` 값 import가 service·repository·adapter 밖 | error |
| `GUARD_OUTSIDE_BOUNDARY` | 전체 | `.guard` import가 remote·글루서버·endpoint·hooks 밖 | error |
| `SLICE_NAME_PARITY` | server/<slice> | 대응하는 클라 slice명 부재 (entities 기준, shared·database·auth 면제) | warn |

## D군 — 글루서버 (2)

| 코드 | 대상 | 위반 | 심각도 |
|---|---|---|---|
| `PAGE_SERVER_DATA_FETCH` | +page.server·+layout.server | service·repository·schema·adapter·db(database slice) 값 import — 가드·리디렉트·메타 전용 | error |
| `ENDPOINT_THICK` | +server.ts | repository·schema·adapter·db(database slice) 값 import — guard+service 경유 의무 | error |

## E군 — 공용 (4)

| 코드 | 대상 | 위반 | 심각도 |
|---|---|---|---|
| `UNMARKED_TS` | 관장 `.ts` 전체 | §3 종별 밖 무표 (vendor·예약·`*.d.ts` 면제) | error |
| `IMPURE_UTIL` | util | `$app/*`·server·api·model 상태 import | error |
| `TYPES_ONLY` | types.ts·*.types.ts | 런타임 값 export (enum 포함 — union 타입 권장) | error |
| `MISSING_CLAUDE_MD` | 계층·slice 루트 | CLAUDE.md 부재 (segment 면제 — kit이 씨앗 생성) | error |

## 체크리스트 룰 (비자동 — 카드·리뷰·에이전트 워크플로우에서 확인, 13)

① `$effect` 안 remote 호출 금지 ② command 후 무효화 query `refresh()` 명시 ③ remote `form().as()`는 네이티브 input만 ④ 상태 prop 표준명·`$bindable`은 value/open/ref만 ⑤ live ≈100줄+ → model `*.svelte.ts` 추출 ⑥ 수급 사다리 하강 사유(remote→universal→page.server→endpoint) ⑦ raw endpoint 합법 사유 5종 ⑧ push↔replace(탐색=push·연속 입력=replace) ⑨ replaceState hydration 가드 ⑩ env 해석은 `.config.ts` 소유 ⑪ wire 타입에 `$inferSelect` 재수출 금지 ⑫ CLAUDE.md 짧게(자동 로드 = 컨텍스트 비용) ⑬ vendor 흡수 시 cn·tv 제거 + 시각 스모크(§3.14 장기 조항)

## 프로젝트 확장 (`.svelte-arch/config.mjs` — project-owned)

```js
export default {
	layers: { pages: false },                 // pages 계층 개방 스위치
	neutralLiterals: ['확인', '취소', '닫기', '저장', '검색'],
	allow: { crossSlice: [], liveOutsideGlue: [] }, // 이행기 전용 공개 부채 — 사유 주석 의무, 줄어들기만
	heavyReexportMax: 12,                     // HEAVY_REEXPORT 임계 (slice index 재수출 상한)
	rules: [ /* { code, desc, severity, kinds|where, pattern|check } — 승격 절차 5단계마다 +1 */ ]
};
```

## pre-commit 배선 — kit은 hooksPath를 소유하지 않는다

init이 기존 `core.hooksPath`(없으면 `.githooks` 생성)를 존중하고, 그 `pre-commit` 파일 안에 **마커 블록**(`# svelte-arch:begin…end`)으로 자기 구간만 관리한다 — 마커 밖에는 프로젝트가 다른 검사를 자유롭게 추가. 검사 내용 = staged 파일만 `arch.mjs audit --files`(기존 위반 baseline 유지, 새 변경만 차단). Bypass: `git commit --no-verify`.
