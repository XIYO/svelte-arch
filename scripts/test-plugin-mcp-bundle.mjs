#!/usr/bin/env bun

import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const endpoint = 'https://mcp.svelte.dev/mcp';

async function readJson(relativePath) {
	return JSON.parse(await Bun.file(resolve(repoRoot, relativePath)).text());
}

const manifest = await readJson('.codex-plugin/plugin.json');
if (manifest.mcpServers !== './.mcp.json') {
	throw new Error('Codex 배포 어댑터가 공용 ./.mcp.json을 mcpServers로 참조해야 합니다.');
}

const claude = await readJson('.claude-plugin/plugin.json');
if (claude.name !== manifest.name || claude.version !== manifest.version) {
	throw new Error('Claude Code와 Codex 배포 어댑터의 플러그인 식별자·버전이 다릅니다.');
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

console.log('✓ 공용 Svelte MCP 설정 + Claude/Codex 배포 어댑터 계약 통과');
