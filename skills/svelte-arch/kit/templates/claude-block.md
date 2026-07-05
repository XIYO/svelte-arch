<!-- svelte-arch:begin (kit v{VERSION} — 이 블록은 kit 이 관리한다. 직접 수정 금지, 갱신은 svelte-arch 업데이트로) -->

## 아키텍처 = SvelteKit × FSD 2.1 (svelte-arch — 상시 트리거 카드)

- **4단 주소**: `계층/slice/segment/접미사`. 계층 = `app(routes 글루+콜로케이션)`·`widgets`·`features`·`entities`·`shared(ui·vendor·lib·model·config)` + 병렬 `server/<slice>`. segment = `ui·api·model·lib·config`. 접미사 = `.view`(dumb — mock props만으로 렌더)/`.container`(smart — remote 배선·마크업 0)/`.stories`/`.remote`/`.svelte.ts`(model 상태)/`.service`/`.repository`/`.adapter`/`.guard`/`.schema`/`.config`/`.util`/`types.ts`. **무표 파일 생성 금지** (routes 콜로케이션 포함). 규범 전문 = svelte-arch 스킬 `references/constitution.md`.
- **배치 사다리(pages first)**: 새 코드는 라우트 콜로케이션에서 태어난다 → 둘째 소비자 등장 시에만 하강(명사→entities · 동사→features · 자립 블록→widgets · 업무 어휘 0→shared/ui) → 불확실하면 widgets. entities/ui에 container 금지(= widget 승격 신호).
- **작업 전 의무**: `bun run arch:manifest`(+`-- --slice <이름>`)로 기존 컴포넌트·서버 API를 주입받은 뒤 **소비 → variant → 신설** 순서. 있는 것을 다시 만들면 안 된다.
- **핵심 금칙**: 같은 계층 slice 수평 import 금지(type-only는 index 경유만) · 타 slice는 public API(index)로만, shared는 딥 임포트만 · remote → service만(건너뛰기 0)·값 export 금지 · +page.server는 가드·메타 전용(수급: remote→universal→page.server→endpoint) · 클래스는 내장 `class={[...]}` 배열만, `class`/`*Class` prop은 `string`이 아닌 `ClassValue`(svelte/elements)로 타입 · view의 `$app/state` 금지(prop 주입) · 내부 링크(`<a href>`·`goto`·`redirect`·`<form action>`)는 `resolve()`(`$app/paths`) 경유 — 원본 경로 문자열 직행 금지.
- **커밋 전**: `bun run arch:audit` (pre-commit 훅 마커가 staged 자동 검사).

<!-- svelte-arch:end -->
