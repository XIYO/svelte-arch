# 도입 플레이북 — 기존 SvelteKit 프로젝트를 FSD 좌표계로

> 신규 프로젝트는 kit 설치(kit.md) + 헌법 트리로 시작하면 끝. 이 문서는 **이미 코드가 쌓인 프로젝트**의 이행 순서. 구조 이행은 사용자의 결정 — 승인 없이 `--apply` 금지.

## 0. kit 설치 (`init.mjs` 한 명령)

- `.svelte-arch/`(CLI·config·템플릿) + 훅 마커 주입 + package scripts + 루트 CLAUDE.md 마커 블록.
- 구 트리 감지 시 init이 이행 필요를 알린다. **이행 전 audit·manifest는 룰 폭주 대신 plan 안내만 출력**한다.

## 1. svelte.config 수술 (수동 1분 — plan이 정확한 스니펫을 출력)

`files.lib='src'` · `files.routes='src/app/routes'` · `files.appTemplate='src/app/index.html'` · hooks 경로 · `@` 별칭 (정본 = fsd-guide.md). plan `--apply`는 **수술이 끝난 상태를 전제**로 거부·안내한다.

## 2. 전수 검사 → 제안표 → 동의 (`arch:plan`)

```bash
bun run arch:plan            # 이동·리네임·3계층 분류·배럴 처리·임포트 재작성 규모를 표로
bun run arch:plan -- --full  # 그룹당 5건 요약 대신 전체 목록 (--json 도구용)
```

- **분류는 휴리스틱 제안일 뿐**: `*Section` view/live 페어→widgets · Form/Dialog/Modal/Popup→features · 잔여 표시 부품→entities · 구 layout 셸→블록당 widget slice · 구 primitive→shared/ui(`.view` 리네임) · 구 ui vendor→shared/vendor · remote→entities/api · service·repository→server/<slice> · types→entities/model|shared/model · state→model 분산 · utils→shared/lib(`.util`).
- **에이전트 규범**: 제안표를 사용자에게 보여주고 **"FSD 표준대로 이렇게 옮기겠습니다. 진행할까요?"** 를 반드시 묻는다. 분류 수정은 `.svelte-arch/plan-overrides.json`(`{ "<from>": "<계층/slice>" }`)에 기록 → plan이 재산출.

## 3. 적용 (`arch:plan -- --apply`)

- 완전히 깨끗한 작업트리 필수(롤백=git). 이동·리네임(`.svelte`→`.view.svelte`)·비합법 배럴 삭제·임포트 재작성(`$lib/…`·상대·배럴 named → `@/…` 딥 or slice index)을 한 번에. 코드 로직과 섞이지 않는 순수 구조 커밋.
- 검증: `svelte-check` 신규 에러 0 + `arch:audit`(구조 룰 소멸 확인) + **dev 부팅 스모크** → diff 리뷰 → 커밋.

## 4. 앵커·public API 보강 (점진)

- slice index.ts(plan이 씨앗 생성) 검토 · @component·Props 명명·TSDoc — shared/ui부터(상세 티어 대상).

## 5. 부채 상환 (백로그 운영 — allow 목록은 줄어들기만)

- remote→repository 직접 호출 → 얇은 service 경유화 · view의 `$app/state` → prop 주입 · 클래스 상수 모듈 → variant 승격 · 글루 배선 → live 분리·Snippet 주입 · INSIGNIFICANT slice 회귀.

## 완료 판정

- [ ] 전 `.svelte`·`.ts` 종별 선언(`UNMARKED_*` 0) + 주소·접미사 상호 검증 통과
- [ ] slice public API 전수(`SLICE_PUBLIC_API` 0) · 계층/shared 배럴 0 · 수평 참조 0
- [ ] 서버 계층 룰 0 (`REMOTE_SKIPS_SERVICE`·`SCHEMA_VALUE_OUTSIDE_REPOSITORY` …)
- [ ] 계층·slice 루트 CLAUDE.md 전수 + 루트 마커 블록
- [ ] `arch:manifest` 정상 방출(shared/ui 분류 뷰 파싱 ⚠비정형 0 목표) · pre-commit 마커 작동
