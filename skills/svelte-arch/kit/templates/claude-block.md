<!-- svelte-arch:begin (kit v{VERSION} — 이 블록은 kit 이 관리한다. 직접 수정 금지, 갱신은 svelte-arch 업데이트로) -->

## 파일 종별 아키텍처 (svelte-arch — 이 블록이 이 프로젝트의 상시 트리거 카드)

- **파일명 = 역할 선언**: 모든 `.svelte`는 `.primitive`(도메인 무지 디자인시스템) / `.composite`(dumb 조립 — mock props만으로 렌더) / `.live`(데이터 배선, 마크업 0) / `+page`·`+layout`(최종 조립자 — 배선 로직 0) 중 하나. **무표 `.svelte` 생성 금지.** 서버도 동일: `.remote`(얇은 wire 경계)·`.service`·`.repository`. 편집할 파일의 접미사에 해당하는 종별 카드를 따른다 — 규범 전문 = svelte-arch 스킬 `references/constitution.md`.
- **README 게이트**: 작업 디렉토리(및 상위 경로)에 `README.md`가 있으면 **편집 전 반드시 읽는다.**
- **UI 작업 전 의무**: `bun run arch:manifest -- --layer primitive` (+해당 시 `--domain <d>`)를 실행해 기존 컴포넌트 API를 주입받은 뒤 **소비 → variant 추가 → 신설** 순서로 판단한다. 있는 것을 다시 만들면 안 된다.
- **핵심 금칙**: 클래스 합성은 내장 `class={[...]}` 배열만(cn/clsx/템플릿 리터럴 금지) · 배럴 금지(세트 폴더 `primitive/<set>/`만 예외, `import * as` 소비) · 도메인 간 composite import 금지(공유 욕구 = primitive 승격 신호) · primitive에 도메인 문구 기본값 금지 · 콜백 prop은 camelCase `onXxx` · 같은 이스케이프 해치값 2파일 = 위반(variant 승격).
- **커밋 전**: `bun run arch:audit` (pre-commit이 staged 자동 검사).

<!-- svelte-arch:end -->
