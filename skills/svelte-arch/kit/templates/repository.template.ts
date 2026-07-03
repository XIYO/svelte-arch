/**
 * __slice__ repository — 데이터 접근(쿼리)만.
 * 규칙: schema 값 import 유일 합법처 · SvelteKit import 금지 · 명시적 파라미터만(요청 컨텍스트 무지) · vitest+테스트DB 의무.
 */
// import { db } from '@/server/database/db.adapter';
// import { item } from '@/server/database/schema';

/** <이 쿼리의 의미 한 줄> */
export async function findItems(viewerId: string) {
	console.log('[__slice__.repository:findItems]', { viewerId });
	// return db.select().from(item).where(…);
	return [];
}
