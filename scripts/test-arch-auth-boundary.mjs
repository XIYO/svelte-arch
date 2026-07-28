#!/usr/bin/env bun

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(import.meta.dirname, "..");
const arch = join(repoRoot, "skills/svelte-arch/kit/scripts/arch.mjs");
const fixture = await mkdtemp(join(tmpdir(), "svelte-arch-v6-"));
const bun = Bun.which("bun");

if (!bun) throw new Error("Bun runtime을 찾지 못했습니다.");

async function write(relativePath, content) {
  const path = join(fixture, relativePath);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, content, "utf-8");
}

function runArch(...args) {
  const result = Bun.spawnSync({
    cmd: [bun, arch, ...args],
    cwd: fixture,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode,
    stdout: new TextDecoder().decode(result.stdout),
    stderr: new TextDecoder().decode(result.stderr),
  };
}

try {
  await write("package.json", '{"name":"svelte-arch-auth-fixture"}\n');
  await write(
    ".svelte-arch/config.mjs",
    `export default {
	authentication: {
		protectedRouteDirs: ['src/routes/(app)'],
		entryPaths: ['/auth'],
		transitionComponents: ['src/routes/(app)/Allowed.container.svelte']
	}
};\n`,
  );
  await write("src/AGENTS.md", "# fixture\n");
  await write(
    "src/routes/(app)/Bad.view.svelte",
    `<script lang="ts">
	import { resolve } from '$app/paths';
	const session = useSession();
</script>
<a href={resolve('/auth')}>login</a>\n`,
  );
  await write(
    "src/routes/(app)/Allowed.container.svelte",
    `<script lang="ts">
	import { resolve } from '$app/paths';
	import AllowedView from './Allowed.view.svelte';
</script>
<AllowedView href={resolve('/auth')} />\n`,
  );
  await write(
    "src/routes/(app)/Allowed.view.svelte",
    `<!-- @component
인증 mutation 전환 fixture
-->
<script lang="ts">
	let { href }: { href: string } = $props();
</script>
<a {href}>logout</a>\n`,
  );
  await write(
    "src/routes/public/Public.view.svelte",
    `<script lang="ts">
	import { resolve } from '$app/paths';
	const session = useSession();
</script>
<a href={resolve('/auth')}>login</a>\n`,
  );
  await write("src/lib/entities/post/AGENTS.md", "# post\n");
  await write(
    "src/lib/entities/post/index.ts",
    "export { default as PostCard } from './ui/PostCard.view.svelte';\n",
  );
  await write(
    "src/lib/entities/post/ui/PostCard.view.svelte",
    "<!-- @component\\n게시물 카드\\n--><p>post</p>\\n",
  );

  const audit = runArch("audit", "--json");
  if (!audit.stdout)
    throw new Error(`audit이 JSON을 출력하지 않았습니다: ${audit.stderr}`);
  const violations = JSON.parse(audit.stdout);
  const authViolations = violations.filter(
    (item) => item.code === "PROTECTED_COMPONENT_AUTH_BRANCH",
  );
  if (authViolations.length !== 2) {
    throw new Error(
      `보호 컴포넌트 인증 분기 2건을 기대했지만 ${authViolations.length}건: ${audit.stdout}`,
    );
  }
  if (authViolations.some((item) => item.file.includes("/public/"))) {
    throw new Error(`공개 route가 인증 경계 룰에 잘못 포함됨: ${audit.stdout}`);
  }

  const manifestRun = runArch("manifest", "--json");
  if (manifestRun.exitCode !== 0)
    throw new Error(`manifest 실행 실패: ${manifestRun.stderr}`);
  const manifest = JSON.parse(manifestRun.stdout);
  if (!manifest.slices.entities.includes("post")) {
    throw new Error(
      `src/lib 공식 좌표의 entity를 찾지 못함: ${JSON.stringify(manifest)}`,
    );
  }

  console.log("✓ 공식 기본 좌표 + 보호 컴포넌트 인증 경계 감사 테스트 통과");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
