<!--
@component
Component — 역할 한 문장으로 교체 (매니페스트의 설명 필드가 된다. 업무 어휘 금지 — shared/ui).
사용: <Component bind:value label="…" onConfirm={fn} variant="…" />
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	/** variant 값 의미: a=…, b=… (별칭으로 빼면 매니페스트가 값을 인용한다) */
	type ComponentVariant = 'a' | 'b';

	type Props = {
		/** <이 prop의 의미·제약 — 타입·기본값 반복 금지, 코드가 SSOT> */
		value?: string;
		/** 문구성 prop은 기본값 없이 필수로 — 업무 문구는 소비자가 공급 */
		label: string;
		/** 콜백은 camelCase onXxx — DOM passthrough(onclick 소문자)와 시각 구분 */
		onConfirm?: (value: string) => void;
		/** 시각 변형 — 값 의미는 위 별칭 TSDoc 참조 (shared/ui는 전 prop TSDoc 의무) */
		variant?: ComponentVariant;
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

<!-- 토큰 클래스만. 조건부 합성은 내장 class={[...]} 배열만 (cn/clsx/tv/템플릿 리터럴 금지) -->
<div class={['rounded p-2', variant === 'b' && 'font-medium']}>
	{label}
	{@render children?.()}
</div>
