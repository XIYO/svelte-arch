/**
 * __slice__ port — driven port 계약(인터페이스). 서버 내부 계약의 타입 SSOT.
 * 규칙(PORT_TYPES_ONLY): 인터페이스·타입만 export — 런타임 값 0(구현은 repository·adapter).
 * service 는 이 인터페이스에만 의존한다 → repository/adapter 를 갈아끼워(in-memory 더블) service 격리 테스트가 실제로 성립(A1 근거).
 * 이름(ItemRepository·Item)은 placeholder — 도메인 어휘로 개명.
 */

/** __slice__ 데이터 접근 계약 — 구현: __slice__.repository.ts (drizzle 등, 교체 가능) */
export interface ItemRepository {
	/** <이 쿼리의 의미 한 줄 — 매니페스트 port 계약에 노출> */
	findItems(viewerId: string): Promise<Item[]>;
}

/** repository 반환 형태(서버 내부). 클라 대면 wire 타입은 entities/__slice__/model/types.ts */
export interface Item {
	id: string;
}
