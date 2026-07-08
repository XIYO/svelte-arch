# 도입 플레이북 — 기존 SvelteKit 프로젝트를 FSD 좌표계로

> 신규 프로젝트는 kit 설치(kit.md) + 헌법 트리로 시작하면 끝. 이 문서는 **이미 코드가 쌓인 프로젝트**의 이행 순서. 구조 이행은 사용자의 결정 — 승인 없이 `--apply` 금지.

## 0. kit 설치 (`arch-sync`(`sync.mjs`) 한 명령)

- `.svelte-arch/`(CLI·config·템플릿) + 훅 마커 주입 + package scripts + 루트 CLAUDE.md 마커 블록.
- 구 트리 감지 시 sync가 이행 필요를 알린다. **이행 전 audit·manifest는 룰 폭주 대신 plan 안내만 출력**한다.

## 1. config 수술 (수동 1분 — plan이 정확한 스니펫을 출력)

vite.config 의 `sveltekit()` 인라인(kit 2.62.0+ — `svelte.config.js` 폐지, 권장)으로 `files.lib='src'` · `files.routes='src/app/routes'` · `files.appTemplate='src/app/index.html'` · hooks 경로 · `@` 별칭을 주입한다 (정본·예외 4급·eslint 동반 수정 = fsd-guide.md). plan `--apply`는 **수술이 끝난 상태를 전제**로 거부·안내한다 — vite.config·svelte.config 어느 쪽에 있든 인정.

## 2. 전수 검사 → 제안표 → 동의 (`arch:plan`)

```bash
bun run arch:plan            # 이동·리네임·3계층 분류·배럴 처리·임포트 재작성 규모를 표로
bun run arch:plan -- --full  # 그룹당 5건 요약 대신 전체 목록 (--json 도구용)
```

- **분류는 휴리스틱 제안일 뿐**: `*Section` view/container 페어→widgets · Form/Dialog/Modal/Popup→features · 잔여 표시 부품→entities · 구 layout 셸→블록당 widget slice · 구 primitive→shared/ui(`.view` 리네임) · 구 ui vendor→shared/vendor · remote→entities/api · service·repository→server/<slice> · types→entities/model|shared/model · state→model 분산 · utils→shared/lib(`.util`).
- **에이전트 규범**: 제안표를 사용자에게 보여주고 **"FSD 표준대로 이렇게 옮기겠습니다. 진행할까요?"** 를 반드시 묻는다. 분류 수정은 `.svelte-arch/plan-overrides.json`(`{ "<from>": "<to|skip>" }`)에 기록 → plan이 재산출.
- 휴리스틱은 특정 네이밍 관례(`*Section`·`*Form` 등)에 과적합될 수 있다 — plan이 위치·프레임워크 관례 기반은 확실, 네이밍 추측은 `[?추정]`으로 태깅해 요약에 집계한다. 추정·미분류는 아래 §2.5의 2차 라운드가 확정한다.

## 2.5 2차 LLM 분류 라운드 (추정·미분류 확정)

plan 요약의 `추정 N`·`미분류 K`가 대상. 에이전트 절차:

1. `arch:plan -- --json`으로 `sure:false` 이동과 미분류 목록을 수집한다.
2. 파일마다 판정 — 이름·경로로 확실하면 그대로, 아니면 **내용을 연다**: 업무 개체 표현(명사)→`entities/<개체>` · 사용자 상호작용(동사)→`features/<동사구>` · 자립 조립 블록→`widgets/<블록>` · 업무 어휘 0+승격 4테스트→`shared/*` · 서버 로직→`server/<slice>` · 확신 없음→widgets(FSD 공식 디폴트).
3. 결정을 `plan-overrides.json`에 기록 → plan 재실행 → **미분류 0 + 대상 충돌(✗) 0** 확인 후 사용자 승인.
4. **메타 동시 시딩**: 내용을 연 파일은 분류 근거를 그 자리에서 `@component` 역할 1행(view)·slice CLAUDE.md 1행으로 적는다 — 읽기 비용을 두 번 내지 않고, 이행 직후 `MISSING_COMPONENT_DOC` 부채를 원천 차단한다(적용 후 이행 커밋에 포함).

## 2.7 해체 후보 (⚒ — 이동으로 해결 불가)

`.svelte`가 서버 모듈(`@/server/*`·`.service`·`.repository`·drizzle)을 직접 소비하면 어느 계층으로 옮겨도 audit 위반이 남는다. plan이 `⚒ 해체 후보` 목록으로 분리 보고하며, apply는 그대로 이동만 한다(이동 자체는 무해 — 부채로 계측). 처방 = **이행 커밋과 분리한 별도 승인 리팩토링**: ① 마크업 → `.view` ② 데이터 배선 → `.container` + remote(`entities/<slice>/api`) ③ 서버 로직 → `server/<slice>`의 service·repository 추출. 분할 구조 자체가 없는 프로젝트(god component 다수)는 이 라운드가 사실상 본 공사다 — 파일 단위로 제안→승인→검증을 반복한다.

## 2.8 테스트 배치 정본

| 종류 | 정위치 | 집행 |
|---|---|---|
| 유닛 spec (`X.spec.ts`·`X.svelte.spec.ts`) | 검증 대상과 같은 폴더 (콜로케이션) | audit `SPEC_PLACEMENT` |
| 통합 테스트 (실 DB·컨테이너) | 최상위 `tests/` | src 밖 = FSD 계층 밖 |
| e2e (Playwright) | 최상위 `e2e/` | 〃 |

plan은 콜로케이션 spec을 본체와 페어로 이동하고(`types.spec.ts` 등 별도 대상 보장), `tests/`·`e2e/`는 이동 없이 임포트만 재작성한다.

## 3. 적용 (`arch:plan -- --apply`)

- 완전히 깨끗한 작업트리 필수(롤백=git). 이동·리네임(`.svelte`→`.view.svelte`)·비합법 배럴 삭제·임포트 재작성(`$lib/…`·상대·배럴 named → `@/…` 딥 or slice index)을 한 번에. 코드 로직과 섞이지 않는 순수 구조 커밋.
- 검증: `svelte-check` 신규 에러 0 + `arch:audit`(구조 룰 소멸 확인) + **dev 부팅 스모크** → diff 리뷰 → 커밋.

## 4. 앵커·public API 보강 (점진)

- slice index.ts(plan이 씨앗 생성) 검토 · @component·Props 명명·TSDoc — shared/ui부터(상세 티어 대상).

## 5. 부채 상환 (백로그 운영 — allow 목록은 줄어들기만)

- remote→repository 직접 호출 → 얇은 service 경유화 · view의 `$app/state` → prop 주입 · 클래스 상수 모듈 → variant 승격 · 글루 배선 → container 분리·Snippet 주입 · INSIGNIFICANT slice 회귀.

## 완료 판정

- [ ] 전 `.svelte`·`.ts` 종별 선언(`UNMARKED_*` 0) + 주소·접미사 상호 검증 통과
- [ ] slice public API 전수(`SLICE_PUBLIC_API` 0) · 계층/shared 배럴 0 · 수평 참조 0
- [ ] 서버 계층 룰 0 (`REMOTE_SKIPS_SERVICE`·`SCHEMA_VALUE_OUTSIDE_REPOSITORY` …)
- [ ] 계층·slice 루트 CLAUDE.md 전수 + 루트 마커 블록
- [ ] `arch:manifest` 정상 방출(shared/ui 분류 뷰 파싱 ⚠비정형 0 목표) · pre-commit 마커 작동
