# FSD 2.1 가이드 — SvelteKit 완역판 (어드바이저 본체)

> 이 스킬은 FSD 2.1을 "따르는" 게 아니라 "SvelteKit 방언으로 완역"한다. 이 문서가 원전↔방언 대응의 정본.
> FSD 원전: https://feature-sliced.design (Layers · Slices · Segments · Public API · v2.1 마이그레이션)

## FSD 핵심 3축

| 축 | FSD 표기 | svelte-arch 표기 |
|---|---|---|
| **layer** (책임 깊이) | 디렉토리 1단 — app·pages·widgets·features·entities·shared | 동일 (단 pages는 기본 닫힘 — routes가 겸직) |
| **slice** (비즈니스 도메인) | 디렉토리 2단 — kebab-case | 동일 |
| **segment** (기술 성격) | 디렉토리 3단 — ui·api·model·lib·config | 동일 + 파일명 접미사 오버레이(.view/.container 등 — FSD가 비워둔 데이터 축) |

임포트 규칙: **계층은 아래로만** · **같은 계층 slice 간 금지** · **slice 소비는 public API(index.ts) 경유**. app·shared는 "layer=slice" 예외(내부 상호 참조 자유).

## "Pages first" (v2.1) — 이 스킬 배치 사다리의 원전

FSD v2.0은 entities/features를 먼저 식별하는 bottom-up이었고, 그 경계 판정이 실무 최대 통증이었다. v2.1은 공식적으로 선회: **"페이지에서 시작하고, 여러 페이지가 재사용할 때만 아래 계층으로 추출하라."** 계층 체계 자체는 무변(breaking change 0). SvelteKit 번역: "페이지에 둔다" = **routes 콜로케이션**(라우트 폴더의 `+` 없는 파일 — 프레임워크 공식 지원). 공식 린터 steiger의 `insignificant-slice`(한 페이지만 쓰는 slice는 페이지로 합쳐라)가 회귀 방향까지 규정 — 본 스킬의 배치 사다리 ①·④와 동형.

**v2.1이 명시적으로 후순위화한 것**(공식 discussion #756): entities/features 식별은 이제 "**나중에 익히는 advanced skill**"로 강등됐고, **entities 계층은 공식적으로 "Optional"**("skip the entities layer entirely" 허용)이며, widgets는 "자기 store·비즈니스 로직·API까지 갖는 자립 단위"로 재정의됐다(구 v2.0의 순수 조립 계층 아님). **본 스킬의 배치 사다리는 이미 이와 정합**하나, 서술이 명사(entities)/동사(features)를 1차 분류축으로 전면화하면 v2.0 색채가 남는다 → 서술은 항상 **"먼저 콜로케이션, 재사용될 때만 분해"**를 앞세우고 entities/features는 "그때 익히는 advanced"로 표기한다. **미리 나누지 않는 것이 핵심.**

## 계층 판정 — 원전 정의와 방언 판정 질문

| 계층 | FSD 원전 정의 | 판정 질문 (방언) |
|---|---|---|
| pages | 라우트 단위 조립 | (SvelteKit routes가 겸직 — 글루+콜로케이션) |
| widgets | 자립적 대형 UI 블록 — 여러 페이지 재사용 or 페이지 내 독립 블록 | "이 블록을 통째로 떼서 다른 페이지에 놓아도 스스로 작동하는가" (view/container 페어 = 독립 데이터 섬) |
| features | 사용자에게 실제 가치를 주는 **상호작용** | "사용자가 '하는 일'(동사)인가" — 폼·다이얼로그·액션 |
| entities | 앱이 다루는 실세계 **개념** | "업무 개체(명사)의 표현·타입·API인가" — ui는 view 전용 |
| shared | 비즈니스 무관 재사용 | "업무 어휘 0 + 다른 제품에 복사해도 성립하는가" (승격 4테스트) |

판정 불확실 → **높은 계층에 둔다**(widgets 디폴트 — FSD 공식 FAQ). 미리 나누지 않는다.

## SvelteKit 수술 정본 (FSD 공식 가이드 방식)

```js
// svelte.config.js
const config = {
	kit: {
		files: {
			lib: 'src',                      // $lib = src → src/server가 $lib/server(서버 전용 보호)
			routes: 'src/app/routes',        // 라우팅 = app 계층 소속 (FSD 정통)
			appTemplate: 'src/app/index.html',
			hooks: { server: 'src/app/hooks.server', client: 'src/app/hooks.client' }
		},
		alias: { '@': 'src', '@/*': 'src/*' } // 임포트 표준 표기 — $lib은 내부 존재만
	}
};
```

수술의 소프트 비용 4건(전부 완화됨): ① 생태계 사전지식(`src/routes` 가정) — 루트 CLAUDE.md 마커+audit이 교정 ② 스캐폴딩 도구 별칭 1회 설정(shadcn components.json 등) ③ 이행 규모(arch:plan이 기계 수행) ④ `$lib` 의미 변화(@ 별칭으로 표준화).

## FSD와 의도적으로 다른 점 (사투리 목록 — 각각 근거)

1. **pages 계층 기본 닫힘 (생략 아님)** — `src/pages/`는 **존재하되 닫힘**이고, SvelteKit routes 콜로케이션이 pages-first 역할을 겸한다(재수출 간접층은 순수 보일러플레이트). 공식 FSD SvelteKit 가이드는 pages를 **열어** 쓰지만(page slice를 pages에 두고 `+page.svelte`가 import), 프레임워크 파일 라우팅이 이미 그 역할을 하므로 **닫음이 정당한 방언**이다. `config.layers.pages=true`로 개방 가능.
2. **shared/ui·lib 통합 배럴 금지 = FSD 공식 처방 그대로**, 단 우리는 개별 index 대신 **딥 임포트**로 통일(분석기·매니페스트 정확성).
3. **`@x` 표기 미도입** — cross-slice 타입은 slice index의 type 재수출로 충분(빌드 소멸).
4. **steiger 미도입** — 룰만 arch:audit이 흡수(NO_LAYER_PUBLIC_API·INSIGNIFICANT_SLICE·cross-slice·public API). 근거: 린터 이원화 방지 + steiger가 못 보는 룰(view/container·클래스·앵커·서버)이 절반.
5. **server/ 병렬 스택** — FSD는 명시적 프론트엔드 방법론이라 서버를 **명시적으로 배제**한다(공식: "should not be used to model a backend application"). 서버 계층(remote(controller)→service→repository·adapter, driven **port 인터페이스**·guard·schema)은 svelte-arch 고유 규범이며, 근거는 FSD가 아니라 **헥사고날 ports&adapters·Clean Architecture**(inside/outside 비대칭·의존 내향)에 명시적으로 댄다. slice 이름 1:1로 이음.
6. **접미사 오버레이(.view/.container)** — FSD가 비워둔 dumb/smart 축. ⚠ container/presentational(smart/dumb)은 **원저자 Abramov가 2019 철회**했고("더는 이렇게 나누길 권하지 않는다 … dogma로 삼지 말라"), patterns.dev도 "Hooks가 대체"로 본다 — 즉 **"업계 표준이라서"는 채택 근거가 될 수 없다**. 우리 근거는 **오직 기계적 경계**다: remote·`<svelte:boundary>` 결합 컴포넌트는 mock props만으로 렌더 불가(→ `.view`와 다른 테스트 티어)이고 pending 스켈레톤을 페어 view 재사용으로 얻는다. 이건 Abramov가 철회한 "임의 분리"와 **범주가 다르다**(미학적 취향이 아니라 SvelteKit 결합이 강제하는 물리적 경계). v5 `.live`→`.container` 개명은 관용어 정렬 *편의*일 뿐 근거가 아니다 — 관용어 자체가 deprecated인 만큼 이름은 다음 major에서 재론 여지. (검증 註: "FSD가 공식 폐기 선언"이라는 별도 주장은 적대검증 미통과 — 근거로 쓰지 않는다.)

## 용어 사전 (업계 대응 — 온보딩용)

| svelte-arch | FSD | Frost | Abramov | headless 생태계 |
|---|---|---|---|---|
| `.view` | segment ui의 컴포넌트 | recipe 부품 | presentational(dumb) | — |
| `.container` | api+ui 결합부 | — | container(smart)·connected | — |
| `shared/ui` | shared/ui | **design system component** | — | ⚠ "primitives"(Radix·bits-ui)는 무스타일 headless로 **다른 층** — 우리 스택에선 bits-ui가 그 층 |
| widget slice | widget | — | — | — |
| `<slice>Section` | widget의 화면 루트 | — | — | — |
| 배치 사다리 | pages first (v2.1) | "move down" (recipes→system) | — | — |
