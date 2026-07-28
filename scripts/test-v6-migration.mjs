#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import migrate from "../skills/svelte-arch/kit/migrations/6.0.0.mjs";

const fixtures = [];

async function fixture(name) {
  const root = await mkdtemp(join(tmpdir(), `svelte-arch-${name}-`));
  fixtures.push(root);
  return root;
}

async function write(root, relativePath, content = "") {
  const path = join(root, relativePath);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, content, "utf-8");
}

try {
  const standard = await fixture("v6-standard");
  await write(standard, "CLAUDE.md", "# root manual\n");
  await write(standard, "src/lib/entities/post/CLAUDE.md", "# post manual\n");
  const logs = [];
  await migrate({ ROOT: standard, log: (message) => logs.push(message) });
  if (
    existsSync(join(standard, "CLAUDE.md")) ||
    existsSync(join(standard, "src/lib/entities/post/CLAUDE.md"))
  ) {
    throw new Error("v6 migration이 기존 CLAUDE.md를 남겼습니다.");
  }
  if (
    (await readFile(join(standard, "AGENTS.md"), "utf-8")) !== "# root manual\n"
  ) {
    throw new Error("루트 매뉴얼 rename에서 내용이 바뀌었습니다.");
  }
  if (
    (await readFile(
      join(standard, "src/lib/entities/post/AGENTS.md"),
      "utf-8",
    )) !== "# post manual\n"
  ) {
    throw new Error("하위 매뉴얼 rename에서 내용이 바뀌었습니다.");
  }
  if (!logs.some((message) => message.includes("공식 기본 좌표 확인"))) {
    throw new Error(
      `공식 좌표 프로젝트가 멱등 통과하지 않았습니다: ${JSON.stringify(logs)}`,
    );
  }

  const legacy = await fixture("v6-legacy");
  await write(legacy, "CLAUDE.md", "# legacy manual\n");
  await write(legacy, "src/app/routes/+page.svelte", "<p>legacy</p>\n");
  let error;
  try {
    await migrate({ ROOT: legacy, log: () => {} });
  } catch (caught) {
    error = caught;
  }
  if (
    !(error instanceof Error) ||
    !error.message.includes("자동 이동을 중단했습니다")
  ) {
    throw new Error(`구 좌표를 안전하게 중단하지 않았습니다: ${String(error)}`);
  }
  if (!existsSync(join(legacy, "src/app/routes/+page.svelte"))) {
    throw new Error("v6 migration이 구 좌표를 자동 이동했습니다.");
  }
  if (
    !existsSync(join(legacy, "AGENTS.md")) ||
    existsSync(join(legacy, "CLAUDE.md"))
  ) {
    throw new Error("구 좌표 중단 전 매뉴얼 rename 계약을 지키지 않았습니다.");
  }

  console.log(
    "✓ v6 매뉴얼 rename·공식 좌표 통과·구 좌표 안전 중단 테스트 통과",
  );
} finally {
  await Promise.all(
    fixtures.map((root) => rm(root, { recursive: true, force: true })),
  );
}
