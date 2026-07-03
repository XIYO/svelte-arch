# 매니페스트 프로토콜 — 실행형 발견성

> "무엇이 있는가"를 파일이 아니라 실행이 답한다. LLM 주입이 1순위 소비자 — stale 0%가 문서 대비 존재 이유.

## 계약 = 명령 이름

스킬·에이전트는 **파일 경로가 아니라 package.json 스크립트명**만 안다. 모든 프로젝트 동일:

```jsonc
"arch:manifest": "bun .svelte-arch/arch.mjs manifest",
"arch:audit":    "bun .svelte-arch/arch.mjs audit"
```

```bash
bun run arch:manifest -- --layer primitive    # UI 작업 시 항상 (디자인 시스템 API 전체)
bun run arch:manifest -- --domain <d>         # 해당 도메인 작업 시 (+wire 타입 별첨)
bun run arch:manifest -- --detail <Base>      # 특정 컴포넌트 심층 (composite 포함 전체 props)
bun run arch:manifest                          # 전체 요약 (primitive 상세 + 전 도메인 1줄)
bun run arch:manifest -- --json               # 도구용
```

## 출력 명세 (티어링 하이브리드)

헤더(버전 체인의 노출점):

```text
# arch-manifest · kit v3.0.0 · <프로젝트명> · primitive 23 · domains knowledge(31) chat(19) …
```

**primitive 엔트리** (상세 티어 — 분류 뷰):

```text
### SearchInput · primitive · 소비 12곳 · 📖
검색 인풋 — IME 안전 Enter 확정. box/pill 변형.
사용: <SearchInput bind:value placeholder="…" onSearch={fn} variant="pill" />
주입   placeholder: string (필수) — 도메인 문구는 소비자가 공급
       variant?: 'box'|'pill' = 'box' — box=목록 필터 · pill=히어로
양방향  value?: string = ''
콜백   onSearch?: (value: string) => void — 확정 검색어
스니펫  (없음)
통과   HTMLInputAttributes (…rest)
```

- 분류(주입/양방향/콜백/스니펫/통과)는 Props 선언에서 **기계 도출** — `$bindable`(양방향), `Snippet` 타입(스니펫), `on[A-Z]` 함수(콜백), `...rest`(통과).
- 각 줄의 `— 설명` = 그 prop의 TSDoc. `@deprecated`는 `⛔폐기예정`으로 표시.
- **parse-or-quote**: prop 단위 파싱 실패(비정형 타입) 시 Props 블록 원문 인용 + `⚠비정형` — 매니페스트는 절대 깨지지 않고, 비정형은 눈에 보인다.

**세트 엔트리**: 세트 단위 1엔트리(Root의 @component = 세트 설명) + 부품별 서브행. 소비처는 세트 단위 집계.

**composite 엔트리** (1줄 티어): `KnowledgeListSection · 화면루트 · ⚡live · 📖 · 목록 화면 · 소비 1곳` — 역할은 @component 1행에서. 도메인 헤더 설명은 그 폴더 README 1행에서.

**--domain 별첨**: 해당 도메인 remote 파일의 `export type` 블록 **원문 인용** — dumb props가 참조하는 wire 타입을 같은 주입 안에서 해석 가능(추출기는 타입 해석기가 아니다).

## 소스 측 추출 앵커 (컴포넌트 작성 규약 — 미적 규칙이 아니라 기능 규칙)

| 앵커 | 추출 대상 | 겸용 소비자 |
|---|---|---|
| `<!-- @component -->` 파일 최상단 | 1행=역할, `사용:` 행=사용 예 | IDE 호버(Svelte 공식) |
| `type Props = {…}` 명명 선언 | 타입·필수/옵션·분류 | svelte-check |
| prop 위 TSDoc `/** … */` | prop 설명 | IDE 호버(TS 표준) |
| `$props()` 구조분해 기본값 | defaults · `$bindable` 판별 | 런타임 그 자체 |
| 폴더 `README.md` 1행 | 도메인 설명 | 사람·타 에이전트 |

- 주석에 타입·기본값 반복 금지(드리프트 원천 — 코드가 SSOT). TSDoc은 의미·제약만.
- 인라인 props 타입(`let {…}: {a: string} = $props()`) 금지 — 앵커 부재(`UNNAMED_PROPS_TYPE`).
- **Props 멤버 타입에 인라인 객체 리터럴 지양** — `icon?: Component<{ size?: number }>` 같은 중첩 `{}`는 멤버 파싱을 비정형(⚠원문 인용)으로 떨어뜨린다. 타입 별칭(`IconComponent`)으로 추출하면 분류 뷰 유지 + 재사용.
- 앵커가 IDE에서 매일 보이는 주석이라는 점이 핵심 — 보이는 주석은 썩지 않는다.

## 버전 체인

```text
스킬 저장소(git) → kit/VERSION → 프로젝트 .svelte-arch/arch.mjs 헤더 상수 → 매니페스트 1행
```

에이전트는 매니페스트를 어차피 매 작업 실행하므로, 1행의 kit 버전을 스킬의 `kit/VERSION`과 비교해 드리프트를 그 자리에서 감지 → 업데이트 제안(kit.md). 별도 점검 절차 없음.
