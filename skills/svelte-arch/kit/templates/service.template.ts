/**
 * __slice__ service — 업무 규칙·트랜잭션 경계 (repository 를 port 인터페이스로 조합).
 * 규칙: SvelteKit·요청 컨텍스트 접근 금지(명시적 파라미터만) · repository 는 port 로 의존(구상 아님) · 팩토리는 순수(vitest 대상).
 * 조립: 팩토리(테스트 가능) + 기본 배선(이 파일이 조립 지점) — remote 는 배선된 유스케이스만 호출.
 */
import type { ItemRepository } from './__slice__.port';
import { itemRepository } from './__slice__.repository'; // 기본 배선(조립 지점) — 테스트는 makeListItems 에 in-memory 더블 주입

/** 팩토리: port 를 받아 테스트 가능한 순수 유스케이스를 만든다 (vitest 대상 — 더블 주입) */
export function makeListItems(repo: ItemRepository) {
	/** <이 함수의 업무 규칙 한 줄 — 매니페스트 서버 API 설명이 된다> */
	return async function listItems(viewerId: string) {
		console.log('[__slice__.service:listItems]', { viewerId });
		return repo.findItems(viewerId);
	};
}

/** 기본 배선된 유스케이스 — remote 가 호출 */
export const listItems = makeListItems(itemRepository);
