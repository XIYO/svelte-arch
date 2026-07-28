#!/usr/bin/env bun

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const repoRoot = resolve(import.meta.dirname, "..");
const arch = join(repoRoot, "skills/svelte-arch/kit/scripts/arch.mjs");
const fixture = await mkdtemp(join(tmpdir(), "svelte-arch-agents-budget-"));
const bun = Bun.which("bun");

if (!bun) throw new Error("Bun runtime을 찾지 못했습니다.");

async function write(relativePath, content) {
  const path = join(fixture, relativePath);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, content, "utf-8");
}

function audit(args = []) {
  const result = Bun.spawnSync({
    cmd: [bun, arch, "audit", ...args, "--json"],
    cwd: fixture,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(result.stdout);
  if (result.exitCode !== 0 || !stdout) {
    throw new Error(
      `audit 실행 실패: ${new TextDecoder().decode(result.stderr)}`,
    );
  }
  return JSON.parse(stdout);
}

try {
  await write("package.json", '{"name":"svelte-arch-agents-budget-fixture"}\n');
  await write("src/AGENTS.md", "# src\n");
  await write("AGENTS.md", `# root\n${"a".repeat(32 * 1024)}\n`);
  await write("manual/AGENTS.md", `# manual\n${"b".repeat(16 * 1024)}\n`);

  const warnings = audit().filter(
    (item) => item.code === "AGENTS_CONTEXT_BUDGET",
  );
  const warnedFiles = warnings.map((item) => item.file).toSorted();
  const expectedFiles = ["AGENTS.md", "manual/AGENTS.md"];
  if (JSON.stringify(warnedFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      `AGENTS 예산 경고 대상이 다릅니다: ${JSON.stringify(warnings)}`,
    );
  }
  if (warnings.some((item) => item.severity !== "warn")) {
    throw new Error(
      `AGENTS 예산은 warning이어야 합니다: ${JSON.stringify(warnings)}`,
    );
  }
  const staged = audit(["--files", "src/AGENTS.md"]).filter(
    (item) => item.code === "AGENTS_CONTEXT_BUDGET",
  );
  if (staged.length) {
    throw new Error(
      `staged audit에 전역 AGENTS 예산 경고가 섞였습니다: ${JSON.stringify(staged)}`,
    );
  }

  await write("AGENTS.md", "# root\n");
  await write("manual/AGENTS.md", "# manual\n");
  const remaining = audit().filter(
    (item) => item.code === "AGENTS_CONTEXT_BUDGET",
  );
  if (remaining.length) {
    throw new Error(
      `예산 안의 AGENTS.md가 오탐됐습니다: ${JSON.stringify(remaining)}`,
    );
  }

  console.log("✓ AGENTS.md root/scoped 컨텍스트 예산 감사 테스트 통과");
} finally {
  await rm(fixture, { recursive: true, force: true });
}
