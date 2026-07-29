<!-- svelte-arch:begin (kit v{VERSION} — 이 블록은 kit 이 관리한다. 직접 수정 금지, 갱신은 svelte-arch 업데이트로) -->

## 아키텍처 = SvelteKit × FSD 2.1 (svelte-arch)

- **공식 좌표**: `src/routes`·`src/lib`·`src/app.html`·`src/app.css`·`src/hooks.*`를 유지한다. `kit.files` 재배치와 임의 `@/` 별칭을 만들지 않으며, 서버는 `src/lib/server`다.
- **4단 주소**: `계층/slice/segment/접미사`. 계층은 `shared·entities·features·widgets·pages` + 병렬 `server`, segment는 `ui·api·model·lib·config`다. `.view`=dumb, `.container`=remote 배선·마크업 0, `.attach`=DOM attachment, `.remote/.service/.repository/.port/.adapter/.guard/.schema/.config/.util`은 역할을 파일명으로 선언한다.
- **배치 사다리**: 새 코드는 route 콜로케이션에서 시작하고 둘째 소비자가 생길 때만 하강한다. 명사→entities, 동사→features, 자립 블록→widgets, 업무 어휘 0→shared/ui, 불확실하면 widgets다. entities/ui의 container는 widget 승격 신호다.
- **작업 전/후**: `bun run arch:manifest`(+`-- --slice <이름>`)로 기존 API를 확인한 뒤 **소비 → variant → 신설** 순서로 작업하고, 커밋 전 `bun run arch:audit`을 실행한다.
- **코딩 게이트**: 새 Svelte는 runes만 쓴다(`$props`·`$state`·`$derived`·`$effect`). `export let`·`$:`·`on:`·`use:`·`createEventDispatcher`·`<slot>`·`$$props`·`$app/stores`·`beforeUpdate/afterUpdate`를 쓰지 않는다. event는 `onclick` 등 속성, DOM lifecycle은 `Attachment<T>`+`{@attach}`(`ui/*.attach.ts`), 컴포넌트 통신은 `onXxx` callback prop, 콘텐츠 주입은 Snippet+`{@render}`다.
- **Svelte 검증**: Codex에서는 설치된 `svelte-arch` 플러그인이 번들한 공식 Svelte MCP의 `svelte_autofixer`로 `.svelte` 변경 전후를 확인한다. 같은 endpoint를 프로젝트 MCP 설정에 중복 등록하지 않는다. 마지막에는 프로젝트 전체 `bun run check`로 컴파일·타입·a11y를 확인하며, MCP 미연결도 이 검사는 생략하지 않는다.
- **테스트 경계**: unit은 대상 옆, 통합/e2e는 `config.specRoots` 루트에 둔다. E2E는 독립 fixture·사용자 가시 assertion·role/label locator를 쓰고, Page Object는 셀렉터만 숨기며 업무 결과는 테스트 본문에서 단언한다.
- **핵심 경계**: 같은 계층 slice 수평 import 금지(type-only는 index 경유), 타 slice는 public API, shared는 딥 import, remote→service만, `+page.server`는 가드·메타 전용, view는 `$app/state` 대신 prop, 클래스는 `class={[...]}` 배열만 쓴다.
- **인증 경계**: hooks가 locals를 적재하고 보호 `+layout.server`가 렌더 전 차단한다. protected view/container는 세션을 재조회·분기하지 않으며 remote/API/action은 요청마다 guard한다.
- **AGENTS.md 위생**: root는 전 작업 공통 불변식과 정본 포인터만, 계층·slice는 역할 1행과 두는 것/두지 않는 것만 둔다. 코드 인벤토리·사고 서사·규칙 복붙은 링크로 대체한다. audit의 32KiB(root)/16KiB(범위) 경고를 해소하기 전에 확장하지 않는다.
- kit 개선은 `/arch-feedback`으로 업스트림에 남긴다.

<!-- svelte-arch:end -->
