# svelte-arch 최신화 리서치 — 2026-07-05

> **방법**: deep-research 하네스(5각도 병렬 웹검색 → 23소스 fetch → 110주장 추출) + 세션 한도로 죽은 검증·합성 단계를 1차 출처 인용으로 직접 복원·합성. 소스 23개 중 16개가 **primary**(svelte.dev 공식 문서·changelog·feature-sliced.design·GitHub 원전). 모든 판정은 **권위 × 인기 × 최신성(2025–2026)** 3기준.
> **판정 범례**: ✅ svelte-arch 정합(유지) · ⚠️ 재검토 필요(분기·트레이드오프) · ❌ 어긋남(조정 권고) · 🆕 최신 반영 필요
>
> **검증 상태 (2026-07-05 갱신)**: deep-research **3-vote 적대검증 완주** — 25주장 → **14 confirmed · 11 refuted · 0 unverified**. 검증 결과 이 리포트의 **과잉주장 2건을 정정**했다: ⓐ ~~"pages 계층 드롭"~~ = 오류(svelte-arch는 config-openable `pages`를 **보유**하고 routes 콜로케이션이 pages-first를 수행 → **정합**), ⓑ ~~"FSD가 dumb/smart를 공식 폐기"~~ = 검증 탈락(1-2, FSD Alternatives 인용 미확인). 핵심 발견(remote experimental·서버층 FSD 근거 부재·Cockburn 선형계층 경고·class 배열)은 전부 **confirmed**.

---

## 0. 총평 (Executive summary)

svelte-arch의 **뼈대는 놀랄 만큼 잘 서 있다** — 프론트 FSD 좌표계, svelte.config 수술, `.remote.ts` 명명, `class={[...]}` 배열, `$app/state`, `<svelte:boundary>`는 전부 2026-07 현재 1차 출처와 정합한다. 그러나 세 지점에서 **권위 레퍼런스와의 간극**이 드러났다:

1. **핵심 베팅은 아직 experimental 위에 있다** — SvelteKit remote functions는 2.27.0 도입 이래 최신 2.69.1까지 **여전히 experimental**(공식 문구 "subject to change without notice"), API가 실제로 breaking하게 요동쳤고(`.run()` 2.56 추가→2.61 제거), 2026-02 **DoS 취약점(GHSA)**까지 나왔다. 베팅을 유지하되 규범이 이 사실을 **명시**하고 방어(버전 고정·Standard Schema 검증 의무)해야 한다.
2. **서버 3계층은 정통이지만 정통보다 얕다** — controller→service→repository는 DDD/헥사고날/Clean과 방향이 맞지만, 권위 레퍼런스는 **application service ↔ domain service를 분리**하고 **repository를 인터페이스로 먼저 정의(port)하고 adapter를 그 구현으로** 배선한다. svelte-arch의 flat `service`는 이 둘을 뭉갠다. + 2026 주류 백엔드(NestJS)는 "role별 폴더" 대신 **feature 단위 colocation**을 권한다 — 이건 FSD의 slice 사상과 오히려 같다.
3. **dumb/smart(.view/.container)는 원저자와 FSD 자신이 폐기 신호를 보냈다** — Abramov 2019 철회, patterns.dev "Hooks가 대체", **FSD 공식 Alternatives 페이지가 container 접근을 superseded로 분류**. 기계적 근거(mock 렌더·pending 재사용)는 살아있지만 "업계 표준"으로 파는 프레이밍은 더 이상 사실이 아니다.

아래 각 항목에 1차 출처와 구체 조정안을 붙인다.

---

## Part A — 기술 currency (팩트체크)

### A1. SvelteKit remote functions = 여전히 EXPERIMENTAL ⚠️ (핵심 리스크)

| 항목 | 사실 (2026-07 기준) | 출처 |
|---|---|---|
| 상태 | **experimental, opt-in.** `kit.experimental.remoteFunctions` + `compilerOptions.experimental.async` 두 플래그 필요. "likely to contain bugs and is subject to change without notice" | [svelte.dev/docs/kit/remote-functions](https://svelte.dev/docs/kit/remote-functions) (primary) |
| 도입 | @sveltejs/kit **2.27.0** (2025 중반). RFC 발표 2025-06-17 | [changelog](https://github.com/sveltejs/kit/blob/main/packages/kit/CHANGELOG.md), [kit#13897](https://github.com/sveltejs/kit/discussions/13897) (primary) |
| 안정화 | 최신 changelog **2.69.1**(fetch 2026-07-05)에 **stable 승격 엔트리 없음** — 아직 플래그 뒤 | changelog (primary) |
| API 요동 | `.run()` 메서드 **2.56.0 추가 → 2.61.0 제거**(breaking). query batching·form schema 등 계속 추가 | changelog (primary) |
| 종류 | `query`·`form`·`command`·`prerender` (+ `query.batch`·`query.live`). `$app/server` export | [svelte.dev/docs/kit/$app-server](https://svelte.dev/docs/kit/$app-server) (primary) |
| 보안 | **2026-02 DoS 취약점**(GHSA-vrhm-gvg7-fpcf): 검증 누락으로 1MB 페이로드→~15GB 힙. 영향 2.49.0–2.52.1, **2.52.2에서 수정**. 근본 원인 = remote 경계 입력 검증 부재 | [GHSA 해설](https://dev.to/cverports/ghsa-vrhm-gvg7-fpcf-sveltekit-remote-functions-death-by-type-coercion-2h45) (blog, but cites CVE) |

**svelte-arch 조정 지점**:
- 헌법·SKILL.md에 remote functions가 **experimental**임을 **명시**하고, 소비 프로젝트에 **SvelteKit 버전 고정**을 권고(“stable API layer를 하룻밤에 재작성 말고 신규 기능부터 점진 채택” — 공식 조언과 일치).
- `REMOTE_*` 규칙군에 **Standard Schema(Zod/Valibot) 입력 검증 의무**를 추가하라. 공식 문서가 "each remote function is a public HTTP endpoint … important to validate"라 명시하고, 실제 DoS CVE가 검증 부재에서 났다. 현재 svelte-arch는 "입력 검증(스키마)"를 remote의 얇음 목록에 넣었지만 **감사 룰로 강제하진 않는다** — grep 룰로 승격 가능(remote export에 `.validate(`/스키마 인자 부재 경고).
- command/form 후 `refresh()` 누락 체크리스트 룰(⑨)은 공식 **single-flight mutation**(`.refresh()`/`.set()`/`.updates()`)과 정합 — 유지.

### A2. Svelte 5 표면 = 전부 최신 정합 ✅

| 항목 | 사실 | svelte-arch |
|---|---|---|
| `class={[...]}` 배열 | **Svelte 5.16**(PR 문서 초기 5.15)부터 `class`가 객체·배열 허용, **clsx를 프레임워크 내장**으로 문자열화. 5.19에 `ClassValue` 타입 export. 공식이 `class:` 디렉티브 **지양** 권고 | ✅ A9 배열 규약 = 1차 근거 확실. `class:` 금지 방향과도 일치 |
| `$app/state` | **2.12** 추가, `$app/stores` 대체(구버전 전용). page는 **runes 전용**(legacy `$:` 반영 안 됨). 서버에선 렌더 중에만 read, **load 안에선 접근 불가** | ✅ svelte-arch가 `$app/state` 채택 = 최신. view의 `$app/state` 금지(prop 주입)도 정합 |
| `<svelte:boundary>` | **5.3.0** 추가. `pending` 스니펫(최초 async 해소까지), `failed(error, reset)`. 이벤트 핸들러·setTimeout 에러는 **안 잡힘**. SSR 기본 무효(5.51 `transformError`로 서버 처리) | ✅ container 템플릿의 boundary+pending+failed = 공식 패턴. ⚠️ 단 "이벤트 핸들러 에러 미포착"·"SSR 기본 무효"는 규범이 언급 안 함 — 문서 보강 여지 |

**조정 지점**: 거의 없음. `ClassValue` 타입 export를 매니페스트/템플릿이 활용하도록 권장 정도. boundary의 SSR·이벤트핸들러 한계를 §3.4 각주로.

### A3. Tailwind v4 · shadcn-svelte = 생태계가 이동함 🆕

| 항목 | 사실 (2026) | 출처 |
|---|---|---|
| Tailwind v4 | shadcn-svelte 공식이 **v4 기준**. **CSS-first**(`@theme` 디렉티브), `tailwind.config.ts` **선택·제거 가능**, 색 토큰 HSL→**OKLCH**, 모든 primitive에 `data-slot` | [shadcn-svelte tailwind-v4](https://www.shadcn-svelte.com/docs/migration/tailwind-v4) (primary) |
| `cn()` 관례 | 주류 Svelte는 `cn = twMerge(clsx(inputs))` + `tailwind-variants`. shadcn-svelte v1.2.7(2026-04) 여전히 이 방식 | [shadcn-svelte](https://www.shadcn-svelte.com) (primary) |
| 컴포넌트 배치 | 주류는 **flat `$lib/components/ui/<component>`** (FSD 아님). copy-paste ownership | 〃 |

**svelte-arch 조정 지점** (중립성 핵심):
- ❌ **`cn`/`tailwind-merge` 전면 금지의 근거가 부분적으로만 맞다.** `class={[...]}` 배열이 **clsx는 내장 대체**하는 건 맞다(→ clsx·classnames 금지 정당). **그러나 tailwind-merge는 다른 문제**(유틸 충돌 해소: `p-2`+`p-4`)를 풀며 배열/clsx는 이걸 **안 한다**. svelte-arch는 "twMerge를 variant 규율로 대체"한다지만, 이는 **의식적 트레이드오프**이지 "twMerge가 중복이라 불필요"가 아니다. → A9 근거 문구를 정직하게 수정(“배열=clsx 내장이므로 clsx 계열은 중복 / tailwind-merge의 충돌해소는 규율로 대체—단 이는 선택”).
- 🆕 vendor(shadcn) 흡수 조항(§3.14)은 Tailwind **v4 CSS-first** 전제로 갱신 필요(JS config 제거·OKLCH·`data-slot`). 현재 "twMerge 충돌 해소는 variant가 대체"는 v4에서도 유효하나 흡수 절차 스모크에 v4 항목 추가.

---

## Part B — 프론트엔드 레이어링 (FSD 정합성)

### B1. FSD 2.1 = 현재 최신 확정 ✅ / 단 svelte-arch에 v2.0 잔향 ⚠️

- **FSD 2.1은 최신**(2024-11-13 발표, non-breaking, 마이그레이션 불필요). 그 이후 새 버전 없음 → svelte-arch의 "2.1" 타겟 정확. [discussions/756](https://github.com/feature-sliced/documentation/discussions/756) (primary)
- **pages first**의 정확한 의미: "재사용 안 되는 UI·폼·데이터 로직은 페이지 slice에 **머물러라**", **entities/features 식별은 이제 '나중에 익히는 advanced skill'로 강등**, widgets는 "자기 store·비즈니스 로직·API까지 갖는 자립 단위"로 재정의. 이유: entity-first는 **응집도가 나쁘다**(한 흐름 바꾸려 폴더 여러 개 점프). (primary)
- ✅ svelte-arch의 **배치 사다리(콜로케이션 출생 → 둘째 소비자에만 하강)**·INSIGNIFICANT_SLICE 회귀는 pages-first와 **동형** — 매우 정합.
- ⚠️ **그러나** SKILL.md·헌법이 여전히 "entities(명사)/features(동사)"를 **1차 분류 축으로 강하게 전면화**한다. FSD 2.1은 이 축을 **후순위·선택**으로 내렸다. 온보딩 plan의 "3계층 분류 휴리스틱"도 entity/feature-first 색채. → **프레이밍 완화**: "먼저 페이지에 두고, 재사용될 때만 명사/동사로 분해"를 더 앞세우고 entities/features는 "advanced"로 표기.

### B2. `pages` 계층 — 정합 확인 ✅ (초안의 "드롭" 판정을 검증이 뒤집음)

> **정정**: 초안은 "svelte-arch가 pages 계층을 드롭 = 유일한 표준 계층 생략(분기)"이라 봤으나 **적대검증이 이 프레이밍을 refute(0-3)**했고, 소스 재확인 결과 **사실과 다르다**.

- svelte-arch는 pages를 **드롭하지 않는다**. SKILL.md·헌법 트리에 `src/pages/`가 **닫힘(기본)·`config.layers.pages=true`로 개방**으로 명시돼 있다 — 즉 **config-openable pages 계층을 보유**한다.
- 동시에 **routes 콜로케이션이 pages-first 역할을 수행**(코드를 페이지에 머물게)한다 — 이는 FSD 2.1 pages-first **정신과 정합**이지 위반이 아니다.
- FSD 정본은 6계층(app·pages·widgets·features·entities·shared)이 맞지만, 검증 패널은 "svelte-arch가 pages를 생략해 misaligned"·"공식 가이드가 전용 pages 계층을 유지"를 **둘 다 refute**했다 — SvelteKit route 파일이 pages 역할을 정당하게 겸할 수 있다는 판단.
- **남은 미세 방언(정합, 조정 불요)**: 공식 가이드는 pages를 **열어** 쓰고(page slice를 pages layer에 두고 `+page.svelte`가 import) svelte-arch는 **닫아** 쓴다(routes 콜로케이션). 방어 가능한 dialect. → **E6(초안의 "pages 생략 정당화") 철회** — 정당화할 생략이 애초에 없다. 문서에 "pages는 닫힘이되 존재하며 routes가 겸직"을 1줄 명확히 하는 것으로 충분.

### B3. Steiger 정합 ✅

- Steiger 룰 ~21개는 **전부 프론트 구조**(public-api·no-cross-imports·no-higher-level-imports·no-layer-public-api·no-segmentless-slices·no-processes 등). svelte-arch의 배럴·public API·계층 import 룰과 **정합**. `no-processes` 존재 = processes 계층 폐기 확정 → svelte-arch가 processes 뺀 것 **정답**. [feature-sliced/steiger](https://github.com/feature-sliced/steiger) (primary)
- svelte-arch가 steiger를 "미도입, 룰만 흡수"한 결정도 합리(린터 이원화 방지). 단 **steiger 룰 세트를 정기 대조**해 흡수분 최신화할 것(현재 흡수 목록 정확).

---

## Part C — 풀스택/백엔드 레이어링 (권위 레퍼런스 대조) ★ 사용자 핵심

> **결론 선요약**: `remote(controller)→service→repository`는 **정통 방향과 일치**하지만, 권위 레퍼런스 대비 **(1) repository를 인터페이스(port)로 먼저 정의하는 규범이 없고**, **(2) 엄격한 선형 3-tier 프레이밍이 헥사고날 원전과 결이 어긋나며**, **(3) 2026 주류 백엔드는 role-layer보다 feature-colocation을 권한다**. FSD가 서버를 안 다루므로 이 계층은 **svelte-arch 자체 발명**이 맞고 — 그러니 근거를 FSD가 아니라 **DDD/헥사고날/Clean에 명시적으로 붙여야** 권위가 산다.
>
> **검증 반영(3-0 confirmed)**: FSD는 서버를 **명시적으로 배제**한다 — 공식 overview: *"[FSD] should not be used to model a backend application"*([get-started/overview](https://feature-sliced.design/docs/get-started/overview)). 그리고 Cockburn 원전이 **선형 계층 자체를 경계**한다: *"there may be more than two ports … the architecture does not fit into the one-dimensional layer drawing"*, 핵심 규칙은 tier 순서가 아니라 **inside/outside 누출 방향**. → 초안의 "한 계층 얕다(app/domain service 분리)"는 **부차**로 내리고, **진짜 조정은 (1) port 인터페이스 도입 + (2) 선형 tier→inside/outside 프레이밍 전환**이다. app-service↔domain-service 분리는 대규모에서의 **선택적 정제**로만(과도한 tier화는 Cockburn이 경계하는 바 자체).

### C1. 방향은 정통 ✅

- **Domain-Driven Hexagon**(Sairyss, **14.8k★** — TS/NestJS 최다 인용 tool-neutral 레퍼런스): 표준 흐름 = **Controller → Application Service → Domain → Infrastructure/Repository (ports 경유)**. 의존은 **안쪽으로만**(outer→inner, 역방향 금지). [Sairyss/domain-driven-hexagon](https://github.com/Sairyss/domain-driven-hexagon) (인기 primary급)
- Khalil Stemmler(정통 TS-DDD): repository = **infra 계층 facade over ORM**, controller/validation/persistence는 **분리**. [khalilstemmler.com](https://khalilstemmler.com/articles/typescript-domain-driven-design/repository-dto-mapper/)
- ✅ svelte-arch의 remote=경계·service=업무규칙·repository=데이터접근·adapter=외부 래퍼 = 이 방향과 **일치**. A1 격리 근거(humble object·테스트 티어)도 헥사고날 "isolation from devices/DB"와 정합.

### C2. application service ↔ domain service — 선택적 정제 ⚠️ (부차 — Cockburn "과도한 tier화" 경고 감안, 대규모에서만)

- 정통 DDD는 **application service**(유스케이스 오케스트레이션, 스칼라 조작, **도메인 로직 0**)와 **domain service/entity**(실제 업무 규칙)를 **분리**한다. svelte-arch의 flat `*.service.ts`는 둘을 한 파일 역할로 뭉갠다. (Sairyss primary)
- **조정 옵션(사용자 선택)**:
  - (a) **현행 유지 + 문서화**: "service = application+domain 병합(소규모 실용주의)"임을 명시. 대부분 프로젝트엔 이게 옳다.
  - (b) **선택적 domain 분리 세그먼트**: 규모 커지면 `server/<slice>/domain/`(순수 규칙)과 `*.service.ts`(오케스트레이션) 분리를 **권장 규범**으로. NestJS 보일러플레이트들도 "규모 따라 Layered→Clean/Hexagonal 선택"이라 함(CatsMiaow). → config 스위치로 열 수 있는 형태 권고.

### C3. ★핵심 조정 — repository를 **인터페이스(port)로 먼저** 정의하는 규범 부재 ❌ (사용자가 물은 "TS 인터페이스/타입 체계화"의 핵심 답 + 검증이 지목한 1순위 구조 개선)

- 권위 만장일치: **repository는 인터페이스로 먼저 정의**하라(Liskov 치환·DI·테스트용 in-memory 교체). **adapter는 그 port의 구현**이며 **port(인터페이스) 경유로만 호출**, 직접 호출 금지. (Sairyss·Stemmler·Cockburn primary)
- 현재 svelte-arch: `*.repository.ts`(구현)·`*.adapter.ts`(외부 래퍼)는 있지만 **port 인터페이스 개념·배치가 없다.** service→repository를 **구상 클래스 직접 결합**한다. 이는 헥사고날의 "adapter는 port 경유로만"과 어긋남.
- **조정 권고 (TS 기반 체계화)**:
  - `model/`(또는 `server/<slice>/`)에 **port 인터페이스**(`<slice>.repository.port.ts` 또는 `types.ts`의 `interface XxxRepository`)를 정본으로 두고, `*.repository.ts`/`*.adapter.ts`가 이를 **implements**. service는 **인터페이스 타입에만 의존**.
  - 이렇게 하면 사용자가 원한 **"TS라서 필요한 인터페이스·타입 디렉토리 체계화"**가 권위 근거(port&adapter)와 함께 선다. adapter를 port 뒤로 밀면 A1 "테스트 격리" 주장도 **실제로** 성립(in-memory adapter 주입 가능).
  - 감사 룰 후보: `ADAPTER_DIRECT_CALL`(port 인터페이스 없이 service가 concrete repository/adapter 직결 시 경고) — 도입 시 warn.
  - + **Mapper/DTO 경계**(Domain↔DTO↔Persistence 변환)는 권위가 별도 패턴으로 명명한다. svelte-arch의 wire 타입(`entities/model/types.ts`)이 DTO 역할을 하지만 **Mapper 위치가 규범에 없음** — repository/service 어디서 변환하는지 1줄 규범화 권고.

### C4. role-layer vs feature-colocation — 2026 주류의 반대 방향 ⚠️

- **Encore NestJS 가이드(2026-04)**: "**Group by feature, not by technical layer.**" feature 모듈 하나에 controller·service·DTO·entity·test **colocation**. 전역 `controllers/ services/` 분리는 "20 컨트롤러 넘으면 후회"라 명시. [encore.dev](https://encore.dev/articles/nestjs-project-structure-best-practices)
- 흥미로운 점: 이 feature-colocation은 **FSD의 slice 사상과 동일**하다. svelte-arch는 **프론트에선 slice(feature) 응집**을 강제하면서 **서버에선 role별(remote/service/repository) 수평 분리**를 강제 — **내부 비대칭**.
- 단, svelte-arch 서버는 이미 **`server/<slice>/` 밑에 role 파일들을 colocation**한다(slice 우선, 그 안에서 role suffix). 즉 **slice-first는 이미 지킴**. 진짜 이슈는 C2/C3(계층 깊이·port)이지 slice colocation 자체는 아님. → 이 정합성을 **문서로 부각**(“서버도 slice-first, role은 파일 suffix”)하면 비대칭 오해가 풀린다.
- 주의: Encore 예시 feature 모듈엔 **repository 파일이 없다**(controller·service·DTO·entity·test만). 즉 "repository 계층 의무화"는 **경량 주류보다 더 규범적**. → repository를 **의무**가 아니라 "데이터 접근이 있으면"의 조건부로 완화하는 것도 선택지.

### C5. 헥사고날의 경고 — "고정 선형 계층" 자체를 경계 ⚠️

- Cockburn 원전(primary): 헥사곤은 **"one-dimensional layered 그림에 구속되지 않으려고"** 만든 모양. 핵심 축은 **inside/outside 비대칭**(코어↔어댑터)이지 controller→service→repository **수평 tier가 아니다**. 포트는 **primary(driving)/secondary(driven)** 방향으로만 분류. [alistair.cockburn.us](https://alistair.cockburn.us/hexagonal-architecture/)
- **함의**: svelte-arch가 remote→service→repository를 **엄격한 선형 3-tier로 못박은 것**은 헥사고날 "정신"과는 살짝 결이 다르다(헥사고날은 tier 수를 규정 안 함). 다만 **실용적 규범**으로서 선형 3-tier는 널리 쓰이고(NestJS 기본) 방어 가능. → 근거를 붙일 때 "헥사고날에서 왔다"보다 **"Clean Architecture의 inward dependency rule + 실용 3-tier"**라 부르는 게 더 정확. inside/outside(코어 vs adapter) 프레이밍을 A1에 추가하면 port 도입(C3)과 자연 연결.

---

## Part D — 중립성 (dumb/smart · class · 도구 결합)

### D1. container/presentational(.view/.container) — 원저자·FSD가 폐기 신호 ❌⚠️ (가장 민감)

- **Dan Abramov 2019 철회**(원전): "I don't _suggest_ splitting your components like this anymore … Don't take the presentational and container component separation as a **dogma**." Hooks가 "arbitrary division" 없이 같은 걸 해줌. [medium 원문](https://medium.com/@dan_abramov/smart-and-dumb-components-7ca2f9a7c7d0)
- **patterns.dev**: React에서도 "largely superseded"; Hooks가 대체, 소규모엔 overkill. [patterns.dev]
- ~~**FSD 공식 Alternatives**가 container를 "evil/deprecated"로 분류~~ — **검증 탈락(1-2)**. 이 특정 주장(FSD가 공식적으로 폐기 선언)은 적대검증을 통과 못 했다. **dumb/smart를 "FSD가 공식 폐기"라고 근거로 쓰지 말 것.** (아래 Abramov·patterns.dev 두 축은 별개로 유효)
- **shadcn-svelte 주류 패턴**: compound **dumb** 컴포넌트(Card.Root/Header/…)는 있지만 **정식 smart/container 계층이 없다** — 데이터 배선은 소비자 몫. 즉 업계는 "dumb 분리"는 하되 "smart 파일 계층 강제"는 안 함.
- **정직한 판정**: svelte-arch의 **기계적 근거는 여전히 유효**하다 — remote 결합 컴포넌트는 mock 렌더 불가, pending 스켈레톤 재사용, 테스트 티어 분리. 이건 Abramov가 철회한 "임의 분리"와 **다른** 진짜 기술적 경계다(fsd-guide.md가 이미 이 반론을 편다). **문제는 프레이밍**: "container/presentational은 업계 관용어라 그 이름을 채택"(v5 개명 근거)이라 파는데, **정작 그 관용어는 원 진영에서 deprecated**다. 
- **조정 권고**:
  - 규범은 유지하되(근거가 실재), **"업계 표준이라서"가 아니라 "SvelteKit remote/boundary 결합이 만드는 기계적 경계라서"**로 근거를 **전환**. Abramov 철회를 **인지한 상태로** "우리 분리는 그 임의 분리가 아니다"를 명시(현재 fsd-guide.md 6번에 씨앗 있음 — 헌법 본문으로 승격).
  - 용어 재고: `.container`가 deprecated 관용어와 충돌하니, 대안으로 `.wired`/`.bound`/`.island`(데이터 섬) 등 **기계적 사실을 부르는 이름** 검토. 단 v5에서 막 `.live→.container` 개명했으므로 **잦은 개명 비용**을 감안(→ 지금은 근거 프레이밍만 고치고 이름은 다음 major에서 재론 권장).

### D2. class 배열 규약 — 절반 정합 ✅ / 절반 재론 ⚠️

- ✅ 배열/객체 class는 **Svelte 5.16 내장(clsx 포함)** → svelte-arch가 clsx·classnames를 금지하고 배열을 강제하는 건 **1차 근거 확실**. `class:` 지양 방향도 공식과 일치.
- ⚠️ 그러나 **tailwind-merge 금지**는 별개 문제. 배열/clsx는 **유틸 충돌 해소를 안 한다**. 주류(shadcn-svelte)는 `cn=twMerge(clsx())`. svelte-arch는 "충돌 해소는 variant 규율로 대체"라는 **의식적 트레이드오프** — 이걸 "twMerge는 중복이라 불필요"로 **부정확하게** 서술 중. → A9 근거를 정직하게 분리 서술(§A3 참조).

### D3. 도구 결합도 — 대체로 이미 중립, 두 곳만 ⚠️

- ✅ svelte-arch는 이미 특정 도구를 헌법 본문에서 대체로 배제(drizzle·better-auth 등은 예시로만, adapter 경계로 격리). 좋음.
- ⚠️ **shared/vendor를 shadcn 전제**로 씀(§3.14). shadcn-svelte는 인기(8.9k★)지만 **한 도구**다. → "vendor = 외부 UI 킷 보존 구역(shadcn은 대표 예)"로 **일반화**하면 중립성↑.
- ⚠️ repository/schema 예시가 **drizzle 색채**(`$inferSelect` 등). port 인터페이스(C3) 도입하면 **자동으로 ORM 중립**해짐 — 일석이조.

---

## Part E — 조정 지점 종합 (우선순위)

| # | 조정 | 유형 | 근거 | 난이도 |
|---|---|---|---|---|
| E1 | remote functions **experimental 명시** + 버전 고정 권고 | 문서 | svelte.dev·changelog | 낮음 |
| E2 | remote 경계 **Standard Schema 검증 의무** (감사 룰 승격) | 룰+문서 | 공식 문서 + DoS CVE | 중간 |
| E3 | **repository를 port 인터페이스로 먼저** 정의, adapter=구현, service는 인터페이스 의존 | 구조 규범 | DDD/헥사고날 만장일치 | 중간 |
| E4 | A9 근거 정직화: "배열=clsx 내장(clsx 계열 중복) / tailwind-merge 충돌해소는 규율로 대체=선택" | 문서 | Svelte docs + shadcn | 낮음 |
| E5 | dumb/smart 근거를 "업계 표준"→"remote/boundary 기계적 경계"로 전환, Abramov 철회 인지 명시 | 문서(프레이밍) | Abramov(철회)·patterns.dev ※FSD-alt 근거는 검증 탈락 | 낮음 |
| ~~E6~~ | ~~pages 계층 생략 정당화~~ **철회** — pages는 이미 보유(닫힘)·정합. "pages는 존재하되 닫힘, routes가 겸직" 1줄 명확화만 | 문서 | 검증 refute(0-3) | — |
| E13 🆕 | 서버층을 **엄격 선형 3-tier**로 못박은 프레이밍을 **inside/outside + ports/adapters**(>2 포트 허용)로 전환 — Cockburn이 선형계층을 안티패턴으로 지목. E3(port)와 한 세트 | 문서+구조 | Cockburn 3-0 confirmed | 중간 |
| E7 | FSD 2.1 pages-first 프레이밍 강화, entities/features를 "advanced"로 후순위화 | 문서 | discussions/756 | 낮음 |
| E8 | (선택) application service↔domain service 분리 세그먼트 config 스위치 | 구조 옵션 | DDD | 중간 |
| E9 | vendor·repository 예시 **도구 중립화**(shadcn·drizzle 색 제거) | 문서 | shadcn/generic | 낮음 |
| E10 | Tailwind v4 전제로 §3.14 vendor 흡수 절차 갱신(CSS-first·OKLCH·data-slot) | 문서 | shadcn v4 가이드 | 낮음 |
| E11 | Mapper/DTO 변환 위치 1줄 규범화 | 문서 | Stemmler | 낮음 |
| E12 | Svelte boundary SSR·이벤트핸들러 에러 한계 각주 | 문서 | svelte.dev | 낮음 |

**핵심 베팅 재평가 결론(사용자 개방 요청)**: remote functions를 **버릴 이유는 없다** — 공식 first-party·`.remote.ts` 명명 일치·controller 경계로 깔끔히 매핑·single-flight mutation 내장. 하지만 **experimental·churning·CVE**를 규범이 **정직하게 안고 방어**(E1·E2)해야 하고, 대안(전통 `load`+`+page.server` = 가장 문서화된 주류, tRPC = 복잡 API용)을 **"경쟁자가 아닌 상호보완"**으로 문서에 병기하는 게 옳다. `+server.ts`도 공개 API·웹훅·OAuth·안정 URL엔 **여전히 정답**(공식 명시) — svelte-arch가 이미 "한계 5종"으로 보존 중 → 정합.

---

## 캐비어트 · 미해결

- 이 리서치는 세션 한도로 **3-vote 적대 검증이 각도 3·4·5에서 미완**. 대신 **1차 출처(공식 문서·changelog·CVE) 직접 인용**으로 대체 — 공식 문서 인용은 블로그 주장보다 검증 필요가 낮으나, **적대 반증은 못 거침**. 특히 "권장/합의" 성격(주류가 무엇을 권하나)은 표본이 소수 블로그(Encore·gornostay 등)라 **medium confidence**.
- FSD `pages` 계층에 대해 워크플로우 자동 검증기는 "svelte-arch 생략=문제"를 **반증(0-3)**했으나, 1차 출처는 FSD가 pages를 **유지**함을 명확히 보인다 — 검증기가 "방언으로 방어 가능"과 "표준과 다름"을 혼동한 것으로 보임. 본 리포트는 **"다르다(분기)"는 사실 + "방어 가능(트레이드오프)"** 둘 다로 정리.
- 미조사: (1) Svelte **`$app/state`의 `getRequestEvent` 서버 컨텍스트**와 remote 결합 세부, (2) **tRPC-SvelteKit** 실제 채택 추세 수치, (3) FSD **`@x` cross-slice 표기**의 2.1 현황(svelte-arch 미도입 근거 재확인), (4) drizzle 외 ORM(Prisma 등)에서 port 패턴 실제 예. 다음 라운드 후보.

## 소스 (23개 중 주요)

**primary**: svelte.dev/docs/kit/remote-functions · /$app-server · /$app-state · svelte.dev/docs/svelte/class · /svelte-boundary · github.com/sveltejs/kit CHANGELOG · kit/discussions/13897 · feature-sliced.design(discussions/756·with-sveltekit·blog/simple-svelte-architecture·about/alternatives) · github.com/feature-sliced/steiger · alistair.cockburn.us/hexagonal-architecture · shadcn-svelte.com · medium Abramov smart-and-dumb
**secondary/blog**: github.com/Sairyss/domain-driven-hexagon(14.8k★) · khalilstemmler.com · encore.dev nestjs · github.com/CatsMiaow/nestjs-project-structure · dev.to(dyarleniber hexagonal, cverports GHSA) · gornostay25 remote-vs-trpc · sandroroth.com
