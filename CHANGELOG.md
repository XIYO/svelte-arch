# Changelog

## 3.1.1 — 2026-07-03

- fix(plan): vendor `ui/**`를 이동·삭제 대상에서 완전 제외 — ui 세트 배럴 6개를 삭제 계획에 올리던 오판 수정 (불가침 원칙 위반이었음).

## 3.1.0 — 2026-07-03

- **`arch plan`**: 기존 프로젝트 전수 검사 → 이행 플랜 산출(접미사 부여·composite/ 해체·배럴 폐기·임포트 재작성). `--apply`로만 실행 — 에이전트는 플랜을 사용자에게 제시하고 **"이렇게 옮기겠습니다. 진행할까요?" 승인 후에만** 적용한다(스킬 규범).
- **`arch analyze`**: 진화 신호 리포트 — 종별·커버리지(live 페어·@component·TSDoc·스토리) 통계, 고아/저소비 primitive, 유사 해치 클러스터(variant 승격 후보), live 비대(>100줄), 네이티브 요소 다빈도(primitive 부재 신호), Props 비정형, 감사 잔고.
- **`arch new`**: 앵커 선재 스캐폴드 생성기 — `primitive`·`section`(live 페어 동시)·`composite`·`set`(부품들+**index.ts 세트 배럴 자동 생성**, Base 전역 유일 검증, README 씨앗).
- init: `.svelte-arch/templates` 동봉(생성기 오프라인 동작), package.json 스크립트 5종, 무표 컴포넌트 감지 시 plan 안내 출력.

## 3.0.0 — 2026-07-03

- 최초 공개: 헌법(파일 종별 카드·공리) · 실행형 매니페스트(티어링·TSDoc 분류 뷰) · 감사 CLI(24 코어 룰, 종별 지명) · `init.mjs`(선언적 수렴, 마이그레이션 러너) · `.svelte-arch/` 단일 설치 풋프린트 · Claude Code 플러그인/마켓플레이스 매니페스트.
