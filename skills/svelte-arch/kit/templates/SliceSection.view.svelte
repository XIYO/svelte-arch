<!--
@component
<이 view 의 역할 한 문장. 화면 루트 위젯이면 Base 를 <이름>Section 으로.>
-->
<script lang="ts">
	// 타입은 wire 계약(model/types)에서 참조만 — 재선언 금지 (Pick/Omit 파생만)
	import type { Item } from '../model/types';
	import EmptyState from '@/shared/ui/EmptyState.view.svelte';

	type Props = {
		/** undefined = 로딩 — live 의 pending 이 이 view 를 재사용해 스켈레톤을 그린다 */
		items: Item[] | undefined;
		/** mutation 은 콜백으로 위임 — view 는 remote 를 모른다 */
		onDelete?: (id: string) => void;
	};

	let { items, onDelete }: Props = $props();

	// 정본이 이 컴포넌트 밖에 있는 상태(URL·전역·서버)는 prop 주입.
	// 로컬 순수 뷰 상태(open·hover·펼침)의 $state 는 view 소관 — 합법.
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
