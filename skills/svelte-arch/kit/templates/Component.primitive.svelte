<!--
@component
<역할 한 문장 — 매니페스트의 설명 필드가 된다. 도메인 어휘 금지.>
사용: <Component bind:value label="…" onConfirm={fn} variant="…" />
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		/** <이 prop의 의미·제약 — 타입·기본값 반복 금지, 코드가 SSOT> */
		value?: string;
		/** 문구성 prop 은 기본값 없이 필수로 — 도메인 문구는 소비자가 공급 */
		label: string;
		/** 콜백은 camelCase onXxx — DOM passthrough(onclick 소문자)와 시각 구분 */
		onConfirm?: (value: string) => void;
		/** variant 값의 의미를 여기 적는다: a=…, b=… */
		variant?: 'a' | 'b';
		/** 마크업 주입 슬롯 */
		children?: Snippet;
	};

	let {
		value = $bindable(''), // $bindable 은 value·open·ref 만
		label,
		onConfirm,
		variant = 'a',
		children
	}: Props = $props();
</script>

<!-- 토큰 클래스만. 조건부 합성은 내장 class={[...]} 배열만 (cn/clsx/템플릿 리터럴 금지) -->
<div class={['rounded p-2', variant === 'b' && 'font-medium']}>
	{label}
	{@render children?.()}
</div>
