/**
 * .svelte-arch/config.mjs — 프로젝트 확장 설정 (project-owned)
 *
 * kit 업데이트가 절대 건드리지 않는 파일. 코어 룰·CLI 는 .svelte-arch/arch.mjs(kit-owned).
 * 코어를 고치고 싶어지면 그건 코어 룰 후보 — svelte-arch 스킬 저장소에 반영할 것.
 */
export default {
	// FSD 계층 스위치 — pages 는 기본 닫힘(routes 콜로케이션이 전담). 필요가 증명되면 true.
	layers: { pages: false },

	// shared/ui 문구 prop 기본값 검사(DOMAIN_DEFAULT_IN_SHARED_UI)의 중립 리터럴 — kit 기본 목록을 대체한다.
	neutralLiterals: ['확인', '취소', '닫기', '저장', '삭제', '검색', '선택', '목록으로', '미리보기', '로딩 중…', '불러오는 중…', '검색 결과가 없습니다'],

	// 공개 부채 목록 — 항목마다 사유·백로그 링크 주석 의무. 줄어드는 것만 허용된다 (이행기 전용).
	allow: {
		crossSlice: [
			// 'src/widgets/foo/ui/Foo.view.svelte', // 예: 하강 이행 전 — 백로그 #NN
		],
		containerOutsideGlue: []
	},

	// 서버 인프라 slice 선언 — CROSS_SLICE_SERVER_IMPORT의 대상(target) 면제 목록.
	// 코어 면제(shared·database·auth)에 더해진다. 도메인 어휘 없는 서버 전용 엔진만
	// (예: 'llm', 'crypto', 'email'). 도메인 slice를 넣는 것은 규칙 무력화 — 그 경우 처방은
	// server/shared 이동 또는 service→repository 조합(§3.8)이다.
	serverInfraSlices: [],

	// slice index 재수출 상한 (HEAVY_REEXPORT warn — 배럴 비대 = slice 분할 신호)
	heavyReexportMax: 12,

	// 프로젝트 확장 룰 — { code, desc, severity, kinds, pattern|check }
	// 승격 절차 5단계(재발방지 룰)가 끝날 때마다 여기 하나씩 쌓인다 = 승격의 역사.
	rules: [
		// {
		// 	code: 'RAW_HEX',
		// 	desc: 'raw hex 사용 (디자인 토큰만)',
		// 	severity: 'error',
		// 	kinds: ['view'],
		// 	pattern: /#[0-9a-fA-F]{3,8}\b/
		// }
	]
};
