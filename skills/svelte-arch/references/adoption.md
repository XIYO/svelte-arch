# 도입 플레이북 — 기존 SvelteKit 프로젝트에 표준 적용

> 신규 프로젝트는 kit 설치(kit.md) + 헌법대로 시작하면 끝. 이 문서는 **이미 코드가 쌓인 프로젝트**의 무중단 이행 순서. 각 단계 = 독립 커밋(리뷰·bisect 보존), 전부 기계 변환 + `svelte-check` 검증.

## 0. kit 설치 (kit.md — init 한 명령)

- init이 arch.mjs·config·훅·package scripts·README 씨앗·마커 블록을 깐다. 무표 컴포넌트가 있으면 init이 이행 필요를 알린다.
- 전체 감사 baseline 수를 박제(부채 잔고). pre-commit은 `--files`라 도입 첫날부터 작동 — 손대는 파일부터 점진 정화.

## 1. 전수 검사 → 플랜 제시 → 동의 (`arch:plan`)

```bash
bun run arch:plan            # 전수 검사: 접미사 부여·composite/ 해체·배럴 폐기·임포트 재작성 규모를 표로
bun run arch:analyze         # 보조: 중복·승격 후보·고아 등 진화 신호
```

- **에이전트 규범**: 플랜을 사용자에게 표로 보여주고 **"디렉토리 체계를 표준대로 이렇게 옮기겠습니다. 진행할까요?"**를 반드시 묻는다. 승인 없이 적용 금지.

## 2. 적용 (`arch:plan -- --apply`)

- 승인 후 실행 — 이동·리네임·비세트 배럴 삭제·임포트 재작성(배럴 named→딥, 절대·상대 스펙 갱신)을 한 번에. 코드 로직 수정과 섞이지 않는 순수 구조 커밋.
- 검증: `svelte-check` 0 신규 에러 + `arch:audit`(UNMARKED·NO_BARREL 계열 소멸 확인) → diff 리뷰 → 커밋.

## 4. 앵커 보강 (점진)

- @component 헤더·Props 명명·TSDoc — 전량 일괄이 부담이면 primitive부터(매니페스트 상세 티어 대상), composite는 손댈 때마다.

## 5. 중복 승격 (최다 복붙부터)

- 스캔 ③의 1위 패턴을 승격 절차 6단계(discipline.md)로 — 요구 매트릭스 → primitive → **전 콜사이트 이관 + 재발방지 룰**을 한 커밋에. 1위가 끝나면 "이게 이 체계다"라는 레퍼런스가 생긴다.

## 6. 잔여 정렬 (백로그 운영)

- 글루 배선·dumb의 live 마운트 → live 분리·Snippet 주입으로 순수화 (allowlist에서 하나씩 제거)
- Section 오용 리네임 · 콜백 lowercase → camelCase · 고아 정리 · 테스트 티어 충족(A10)

## 완료 판정

- [ ] 관장 트리 전 파일이 종별 선언 (`UNMARKED_COMPONENT` 0) + 접미사↔디렉토리 일치
- [ ] 배럴 = 세트만 (`NO_BARREL_*` 0) · 딥 임포트 전면
- [ ] 코어 룰 전체 모드 error 0 · allowlist = 사유 달린 공개 부채만
- [ ] 전 디렉토리 README 존재 (`MISSING_README` 0) + 루트 CLAUDE.md 마커 블록
- [ ] `arch:manifest` 정상 방출(primitive 전량 분류 뷰 파싱, ⚠비정형 0 목표)
- [ ] pre-commit 작동 · 글루 전수 마운트 전용
