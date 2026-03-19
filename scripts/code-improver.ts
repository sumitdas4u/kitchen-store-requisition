#!/usr/bin/env tsx
/**
 * Code Improvement Agent
 *
 * Scans project files and suggests improvements for readability,
 * performance, and best practices. Run with:
 *
 *   npx tsx scripts/code-improver.ts [path] [--focus=readability|performance|all]
 *
 * Examples:
 *   npx tsx scripts/code-improver.ts
 *   npx tsx scripts/code-improver.ts apps/backend/src
 *   npx tsx scripts/code-improver.ts apps/backend/src/auth --focus=performance
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import path from "path";

// ── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const focusArg = args.find((a) => a.startsWith("--focus="));
const targetArg = args.find((a) => !a.startsWith("--"));

const focus: string = focusArg ? focusArg.split("=")[1] : "all";
const targetPath: string = targetArg
  ? path.resolve(targetArg)
  : path.resolve(".");

const FOCUS_INSTRUCTIONS: Record<string, string> = {
  readability:
    "Focus exclusively on readability: naming clarity, code structure, dead code, overly complex logic, and missing/misleading comments.",
  performance:
    "Focus exclusively on performance: unnecessary re-renders, expensive computations in hot paths, N+1 queries, missing memoization, and inefficient data structures.",
  all: "Cover all three areas equally: readability, performance, and best practices (type safety, error handling, security, design patterns).",
};

const focusInstruction =
  FOCUS_INSTRUCTIONS[focus] ?? FOCUS_INSTRUCTIONS["all"];

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert code reviewer specializing in TypeScript, NestJS, and React/Next.js.

Your job: scan source files in the target directory and produce a clear, actionable code improvement report.

${focusInstruction}

## Report Format

For each issue found, output a section using EXACTLY this markdown structure:

---
### Issue N — <Short Title>
**File:** \`relative/path/to/file.ts\` (line X–Y)
**Category:** Readability | Performance | Best Practice
**Severity:** Low | Medium | High

**Problem**
One or two sentences explaining what is wrong and why it matters.

**Current Code**
\`\`\`typescript
// paste the relevant snippet (≤30 lines)
\`\`\`

**Improved Code**
\`\`\`typescript
// paste the improved snippet
\`\`\`

**Why This Matters**
One sentence on the concrete benefit (faster, safer, more readable, etc.).

---

## Rules
- Skip auto-generated files (shadcn ui/, ui-zip/, node_modules/, dist/, .next/).
- Skip config files (tsconfig.json, nest-cli.json, package.json, etc.).
- Focus on hand-written application code: services, controllers, components, hooks, DTOs, entities.
- Report at most 10 issues total, prioritised by severity (High first).
- If a file has no issues, do not mention it.
- After listing all issues, end with a one-paragraph **Summary** that describes the overall code health and top priority action.
- Be specific: always include line numbers and file paths.
- Do not suggest changes that would require new dependencies.`;

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍 Code Improvement Agent`);
  console.log(`   Target : ${targetPath}`);
  console.log(`   Focus  : ${focus}`);
  console.log(`   Model  : claude-opus-4-6 (Agent SDK)\n`);
  console.log("─".repeat(60));

  const prompt = `Scan the source files under: ${targetPath}

Start by listing all relevant files with Glob, then read each one.
Skip: node_modules, dist, .next, ui-zip, app/ui/ui (shadcn), and any auto-generated files.

After reading the files, produce the full improvement report following the system prompt format.`;

  let issueCount = 0;

  for await (const message of query({
    prompt,
    options: {
      cwd: targetPath,
      allowedTools: ["Read", "Glob", "Grep"],
      systemPrompt: SYSTEM_PROMPT,
      maxTurns: 40,
      model: "claude-opus-4-6",
    },
  })) {
    if ("result" in message) {
      // Final result — print it
      console.log("\n" + message.result);

      // Count issues found
      const matches = message.result.match(/^### Issue \d+/gm);
      issueCount = matches ? matches.length : 0;
    } else if (
      message.type === "assistant" &&
      Array.isArray(message.message?.content)
    ) {
      // Stream tool use activity as progress dots
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          const toolName = block.name;
          const input = block.input as Record<string, unknown>;
          if (toolName === "Glob") {
            process.stdout.write(`\n  [Glob] ${input.pattern ?? ""} ...`);
          } else if (toolName === "Read") {
            const filePath = String(input.file_path ?? "");
            const rel = path.relative(targetPath, filePath);
            process.stdout.write(`\n  [Read] ${rel} ...`);
          } else if (toolName === "Grep") {
            process.stdout.write(`\n  [Grep] ${input.pattern ?? ""} ...`);
          }
        }
      }
    }
  }

  console.log("\n" + "─".repeat(60));
  console.log(`\n✅ Done — ${issueCount} issue(s) reported.\n`);
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
