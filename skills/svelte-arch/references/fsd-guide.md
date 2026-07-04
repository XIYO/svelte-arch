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

1. **pages 계층 기본 닫힘** — SvelteKit routes가 파일 라우팅+콜로케이션으로 이미 그 역할. 재수출 간접층은 순수 보일러플레이트. `config.layers.pages=true`로만 개방.
2. **shared/ui·lib 통합 배럴 금지 = FSD 공식 처방 그대로**, 단 우리는 개별 index 대신 **딥 임포트**로 통일(분석기·매니페스트 정확성).
3. **`@x` 표기 미도입** — cross-slice 타입은 slice index의 type 재수출로 충분(빌드 소멸).
4. **steiger 미도입** — 룰만 arch:audit이 흡수(NO_LAYER_PUBLIC_API·INSIGNIFICANT_SLICE·cross-slice·public API). 근거: 린터 이원화 방지 + steiger가 못 보는 룰(view/container·클래스·앵커·서버)이 절반.
5. **server/ 병렬 스택** — FSD는 명시적 프론트엔드 방법론. 서버 계층(remote→service→repository·adapter·guard·schema)은 svelte-arch 고유 규범. slice 이름 1:1로 이음.
6. **접미사 오버레이(.view/.container)** — FSD가 비워둔 dumb/smart 축. Abramov의 2019 철회("임의 분리 불요")에 대한 답: 이 분리는 임의가 아니라 기계적(remote 결합 = mock 렌더 불가·pending 스켈레톤 재사용·테스트 티어). v5에서 `.live`→`.container`로 개명 — container/presentational은 업계 관용어라 dumb/smart 축을 그 이름으로 직접 부르는 편이 자기설명적이다.

## 용어 사전 (업계 대응 — 온보딩용)

| svelte-arch | FSD | Frost | Abramov | headless 생태계 |
|---|---|---|---|---|
| `.view` | segment ui의 컴포넌트 | recipe 부품 | presentational(dumb) | — |
| `.container` | api+ui 결합부 | — | container(smart)·connected | — |
| `shared/ui` | shared/ui | **design system component** | — | ⚠ "primitives"(Radix·bits-ui)는 무스타일 headless로 **다른 층** — 우리 스택에선 bits-ui가 그 층 |
| widget slice | widget | — | — | — |
| `<slice>Section` | widget의 화면 루트 | — | — | — |
| 배치 사다리 | pages first (v2.1) | "move down" (recipes→system) | — | — |
