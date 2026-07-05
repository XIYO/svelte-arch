/**
 * __slice__ repository — 데이터 접근(쿼리)만. port(__slice__.port.ts) 인터페이스의 구현.
 * 규칙: schema 값 import 유일 합법처 · SvelteKit import 금지 · 명시적 파라미터만(요청 컨텍스트 무지) · vitest+테스트DB 의무.
 * 교체 가능: 같은 port 를 만족하는 다른 구현(in-memory·타 ORM)으로 갈아끼워도 service·port 불변 → ORM 중립.
 */
import type { ItemRepository, Item } from './__slice__.port';
// import { db } from '@/server/database/db.adapter';
// import { item } from '@/server/database/schema';

/** __slice__ port 의 drizzle 구현 */
export const itemRepository: ItemRepository = {
	/** <이 쿼리의 의미 한 줄> */
	async findItems(viewerId: string): Promise<Item[]> {
		console.log('[__slice__.repository:findItems]', { viewerId });
		// return db.select().from(item).where(…);
		return [];
	}
};
