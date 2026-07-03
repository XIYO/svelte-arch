/**
 * __slice__ service — 업무 규칙·트랜잭션 경계.
 * 규칙: SvelteKit·요청 컨텍스트 접근 금지(명시적 파라미터만) · repository/adapter 조합 · 순수 함수는 export(vitest 대상).
 */
// import { findItems } from './__slice__.repository';

/** <이 함수의 업무 규칙 한 줄 — 매니페스트 서버 API 설명이 된다> */
export async function listItems(viewerId: string) {
	console.log('[__slice__.service:listItems]', { viewerId });
	// return findItems(viewerId);
	return [];
}
