# migrations — 버전 간 구조 변경 코드모드

> init.mjs가 프로젝트의 설치 버전(scripts/arch.mjs 헤더 `KIT_VERSION`)과 kit/VERSION 사이의 마이그레이션을 semver 순으로 자동 실행한다.

## 계약

- 파일명 = **도입 버전** `<major>.<minor>.<patch>.mjs` (예: `4.0.0.mjs`)
- 형식:

```js
export const summary = '트리 개편: components/composite/<d> → components/<d> + 임포트 치환';
export default async function migrate({ ROOT, log }) {
	// 프로젝트 파일 이동·리네임·임포트 치환 코드모드. 반드시 멱등으로 작성.
}
```

- **MAJOR 릴리스 규약**: 디렉토리 구조·접미사 체계 등 비호환 변경은 마이그레이션 동봉 없이 릴리스 금지. MINOR는 additive라 대개 불필요(신규 룰은 warn 도입이 마이그레이션을 대신함).
- 멱등 의무 — 중단 후 재실행이 안전해야 한다. 실행 전제(깨끗한 작업트리)는 init.mjs가 강제하고, 롤백 수단은 git.
- 검증: 마이그레이션 후 init 요약이 `svelte-check`·`arch:audit` 실행을 안내한다 — 코드모드 결과 확인은 그 두 개가 정본.
