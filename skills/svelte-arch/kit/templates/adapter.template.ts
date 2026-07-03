/**
 * __slice__ adapter — 외부 시스템 래퍼(S3·SMTP·LLM SDK·db 인스턴스 …).
 * 규칙: 소비는 service·repository·adapter만 · env 해석은 .config.ts 소유 권장 · 외부 장애를 의미 있는 에러로 변환.
 */

/** <이 어댑터가 감싸는 외부 시스템 한 줄> */
export function createClient() {
	// return new ExternalSdk({ … });
	throw new Error('adapter 미구현');
}
