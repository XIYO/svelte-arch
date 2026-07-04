<!-- SliceSection 데이터 배선 — 마크업 0, 로직이 자라면 ../model/*.svelte.ts 로 추출 -->
<script lang="ts">
	import { getItems, removeItem } from '../api/example.remote';
	import EmptyState from '@/shared/ui/EmptyState.view.svelte';
	import SliceSection from './SliceSection.view.svelte';

	const items = getItems(); // remote 는 최상위에서 — $effect 안 호출 금지(무한루프)

	async function handleDelete(id: string) {
		await removeItem(id);
		await getItems().refresh(); // command 후 무효화할 query 명시 — 목록 미갱신 버그 방지
	}
</script>

<svelte:boundary>
	<SliceSection items={items.current} onDelete={handleDelete} />

	{#snippet pending()}
		<SliceSection items={undefined} onDelete={handleDelete} />
	{/snippet}

	{#snippet failed(error, reset)}
		<EmptyState title="불러오지 못했습니다" description={String(error)} onRetry={reset} />
	{/snippet}
</svelte:boundary>
