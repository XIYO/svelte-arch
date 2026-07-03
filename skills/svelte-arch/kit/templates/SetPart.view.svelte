<!--
@component
SetName 세트의 PartName 부품 — <역할 한 문장>. 단독 사용 금지, SetName 세트로만 소비.
사용: <SetName.PartName>…</SetName.PartName>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** 부품 내용 */
		children?: Snippet;
	};

	let { children }: Props = $props();

	// 부품 간 협조가 필요하면 Root 가 setContext, 부품이 getContext (세트형 판별 신호 2번)
</script>

<div>
	{@render children?.()}
</div>
