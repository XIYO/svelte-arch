<!--
@component
<화면 역할 한 문장. Section = +page 가 마운트하는 화면 루트(화면당 1개).>
-->
<script lang="ts">
	// 타입은 wire 계약에서 참조만 (재선언 금지 — Pick/Omit 파생만 허용)
	import type { Item } from '$lib/data/example.remote';
	import EmptyState from '$lib/components/primitive/EmptyState.primitive.svelte';

	type Props = {
		/** undefined = 로딩 — live 의 pending 이 이 dumb 을 재사용해 스켈레톤을 그린다 */
		items: Item[] | undefined;
		/** mutation 은 콜백으로 위임 — dumb 은 remote 를 모른다 */
		onDelete?: (id: string) => void;
	};

	let { items, onDelete }: Props = $props();

	// 순수 뷰 상태($state)·표시 파생($derived)은 dumb 소관 — 서버 재조회를 유발하는 상태는 live 소관
</script>

{#if items === undefined}
	<p>불러오는 중…</p>
{:else if items.length === 0}
	<EmptyState title="항목이 없습니다" />
{:else}
	<ul>
		{#each items as item (item.id)}
			<li>{item.name}</li>
		{/each}
	</ul>
{/if}
