export const summary = 'FSD 2.1 좌표계 전환 — kit-owned 동기화는 arch-sync 가 수행, 구조 이행은 arch:plan(사용자 승인 필수)으로 안내';

/**
 * v3(파일 종별 트리) → v4(FSD 좌표계)는 구조 비호환(MAJOR)이지만 자동 코드모드가 아니다:
 * 3계층 분류(entities/features/widgets)가 사람의 승인을 요구하므로(스킬 규범 — 승인 없이 구조 이행 금지)
 * 이 마이그레이션은 파괴적 변경 없이 안내만 수행한다. 멱등.
 */
export default async function migrate({ log }) {
	log('  v3 트리(components/primitive·composite 등)는 그대로 두었습니다.');
	log('  이행 절차: ① svelte.config 수술(fsd-guide.md) ② arch:plan 제안표 검토·승인 ③ arch:plan --apply');
}
