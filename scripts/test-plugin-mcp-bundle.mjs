#!/usr/bin/env bun

import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const endpoint = 'https://mcp.svelte.dev/mcp';

async function readJson(relativePath) {
	return JSON.parse(await Bun.file(resolve(repoRoot, relativePath)).text());
}

const manifest = await readJson('.codex-plugin/plugin.json');
if (manifest.mcpServers !== './.mcp.json') {
	throw new Error('Codex manifest가 ./.mcp.json을 mcpServers로 선언해야 합니다.');
}

const mcp = await readJson('.mcp.json');
if (
	Object.keys(mcp).length !== 1 ||
	mcp.mcpServers?.svelte?.type !== 'http' ||
	mcp.mcpServers.svelte.url !== endpoint
) {
	throw new Error(`공식 Svelte MCP만 정확히 번들해야 합니다: ${JSON.stringify(mcp)}`);
}

if ('command' in mcp.mcpServers.svelte || 'args' in mcp.mcpServers.svelte) {
	throw new Error('Svelte MCP는 로컬 stdio 서버가 아니라 공식 원격 endpoint여야 합니다.');
}

console.log('✓ Codex plugin의 공식 Svelte MCP 번들 계약 통과');
