/**
 * .svelte-arch/config.mjs — 프로젝트 확장 설정 (project-owned)
 *
 * kit 업데이트가 절대 건드리지 않는 파일. 코어 룰·CLI 는 .svelte-arch/arch.mjs(kit-owned).
 * 코어를 고치고 싶어지면 그건 코어 룰 후보 — svelte-arch 스킬 저장소에 반영할 것.
 */
export default {
	// 문구 prop 기본값 검사(DOMAIN_DEFAULT_IN_PRIMITIVE)의 중립 리터럴 — kit 기본 목록을 "대체"한다.
	// 기본 목록: 확인·취소·닫기·저장·삭제·검색·선택·목록으로·미리보기·로딩 중…·불러오는 중…·검색 결과가 없습니다
	neutralLiterals: ['확인', '취소', '닫기', '저장', '삭제', '검색', '선택', '목록으로', '미리보기', '로딩 중…', '불러오는 중…', '검색 결과가 없습니다'],

	// 공개 부채 목록 — 항목마다 사유·백로그 링크 주석 의무. 줄어드는 것만 허용된다.
	allow: {
		crossDomain: [
			// 'src/lib/components/chat/RagSourceList.composite.svelte', // 예: knowledge 다이얼로그 결합 — 승격 백로그 #NN
		],
		liveOutsideGlue: [
			// 'src/lib/components/layout/AppSidebar.composite.svelte', // 예: Snippet 주입 이행 전 — 백로그 #NN
		]
	},

	// README 의무 예외 (관장 트리 기본: src/lib 전체, vendor 내부 하위폴더는 kit 기본 예외)
	readmeExempt: [],

	// 프로젝트 확장 룰 — 코어와 같은 스키마 { code, desc, severity, kinds, pattern|check }
	// 승격 절차 5단계(재발방지 룰)가 끝날 때마다 여기 하나씩 쌓인다 = 승격의 역사.
	rules: [
		// {
		// 	code: 'RAW_HEX',
		// 	desc: 'raw hex 사용 (디자인 토큰만)',
		// 	severity: 'error',
		// 	kinds: ['primitive', 'composite'],
		// 	pattern: /#[0-9a-fA-F]{3,8}\b/
		// }
	]
};
