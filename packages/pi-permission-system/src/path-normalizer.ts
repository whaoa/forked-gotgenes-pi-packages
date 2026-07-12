import { posix as posixPath, win32 as winPath } from "node:path";
import { pathFlavorForPlatform } from "#src/path/path-flavor";
import { AccessPath } from "./access-intent/access-path";
import { classifyWin32BashToken } from "./access-intent/bash/msys-bash-tokens";
import {
  canonicalNormalizePathForComparison,
  normalizePathForComparison,
  normalizePathPolicyLiteral,
} from "./access-intent/path-normalization";

import { isPathOutsideWorkingDirectory } from "./path/path-containment";
import { isPiInfrastructureRead } from "./pi-infrastructure-read";

/**
 * The interpreted effect of a literal `cd` target on the effective base, under
 * the host platform's (and, on win32, Git Bash's) semantics.
 *
 * - `absolute` — the target names a resolvable absolute base (`value`); an
 *   earlier unknown base is recovered.
 * - `relative` — the target folds into the current base.
 * - `unknown` — the target is not deterministically resolvable (a win32
 *   non-mount POSIX absolute like `cd /tmp`, or a device), so the base becomes
 *   conservatively unknown.
 */
export type BashCdTarget =
  | { readonly kind: "absolute"; readonly value: string }
  | { readonly kind: "relative" }
  | { readonly kind: "unknown" };

/**
 * Path-interpretation collaborator, constructed once at the session edge with
 * the two ambient inputs — the host `platform` and the session `cwd` — baked
 * in, and handed raw path tokens thereafter.
 *
 * The bash path pipeline and the per-tool/external-directory gates ask this
 * object the platform-dependent questions ("is this path absolute *under our
 * platform*?", "resolve this `cd` offset *against our cwd*") and receive
 * prepared {@link AccessPath} values, instead of reading `process.platform`
 * ambiently or threading `cwd` through every call. Internally it selects the
 * `win32`/`posix` path flavor once and delegates to the platform-parameterized
 * `path-containment` / `path-normalization` / `AccessPath` primitives.
 */
export class PathNormalizer {
  private readonly impl: typeof posixPath;
  /** Canonical form of the baked cwd, resolved once (the symlink target is stable per session). */
  private readonly canonicalCwd: string;

  constructor(
    private readonly platform: NodeJS.Platform,
    private readonly cwd: string,
  ) {
    this.impl = platform === "win32" ? winPath : posixPath;
    this.canonicalCwd = canonicalNormalizePathForComparison(cwd, cwd, platform);
  }

  /** Build an AccessPath for a token, resolved against `resolveBase` (default cwd). */
  forPath(pathValue: string, options?: { resolveBase?: string }): AccessPath {
    return AccessPath.forPath(pathValue, {
      cwd: this.cwd,
      resolveBase: options?.resolveBase,
      platform: this.platform,
    });
  }

  /** Build a literal-only AccessPath (unknown base after a non-literal `cd`). */
  forLiteral(literal: string, matchAliases?: readonly string[]): AccessPath {
    return AccessPath.forLiteral(literal, matchAliases);
  }

  /**
   * Build an AccessPath for a bash-command token, applying Git Bash/MSYS
   * semantics on a win32 host.
   *
   * Pi core always executes bash through Git Bash on Windows, so a POSIX-shaped
   * absolute token carries MSYS semantics, not `node:path.win32` semantics. On
   * win32 the recognized safe device paths (`/dev/null`, `/dev/std{in,out,err}`)
   * are preserved verbatim as devices instead of being resolved into
   * `c:\dev\null`, and MSYS drive mounts (`/c/…`) are translated to their
   * Windows equivalent (`C:\…`) before resolution; every other token delegates
   * to {@link forPath}. On POSIX this is a straight delegation to
   * {@link forPath}.
   */
  forBashToken(token: string, options?: { resolveBase?: string }): AccessPath {
    if (this.platform !== "win32") return this.forPath(token, options);

    const shape = classifyWin32BashToken(token);
    switch (shape.kind) {
      case "device":
        return AccessPath.forDevice(token);
      case "drive-mount":
        return this.forPath(shape.windowsPath, options);
      case "posix-absolute": {
        // A non-mount POSIX absolute (`/tmp`, `/usr`) has an install-dependent
        // Windows target this package cannot know, so it is kept literal: always
        // external, matched and displayed as typed, never fabricated into
        // `c:\tmp` (#533). The win32 path matcher folds a rule's separators
        // (`/` -> `\`), so a forward-slash value is unmatchable; carry a
        // backslash match alias so a natural `/tmp/*` external_directory rule
        // still resolves, while `value()` stays as typed for display.
        const literal = normalizePathPolicyLiteral(token);
        return this.forLiteral(literal, [literal.replaceAll("/", "\\")]);
      }
      case "plain":
        return this.forPath(token, options);
    }
  }

  /** Platform-aware absoluteness (`win32` vs `posix` rules). */
  isAbsolute(pathValue: string): boolean {
    return this.impl.isAbsolute(pathValue);
  }

  /**
   * True when the host platform treats a backslash as a path separator (win32).
   *
   * The bash rule-candidate classifier reads this to decide whether a
   * backslash-relative token (`dir\file`) is path-shaped: on win32 `\` is a
   * separator, but on POSIX it is a legal filename character (#520). Keeping the
   * decision here means no bash-layer module re-reads `process.platform`.
   */
  usesWindowsSeparators(): boolean {
    return this.platform === "win32";
  }

  /**
   * Interpret a literal `cd` target's effect on the effective base.
   *
   * On win32 the target carries Git Bash/MSYS semantics: a drive mount
   * (`cd /c/x`) resolves to a translated Windows base (`C:\x`), a non-mount
   * POSIX absolute (`cd /tmp`) is not deterministically resolvable and yields an
   * `unknown` base, and a native/relative target is handled as usual. On POSIX
   * an absolute target is absolute and everything else is relative.
   */
  interpretBashCdTarget(target: string): BashCdTarget {
    if (this.platform !== "win32") {
      return this.impl.isAbsolute(target)
        ? { kind: "absolute", value: target }
        : { kind: "relative" };
    }

    const shape = classifyWin32BashToken(target);
    switch (shape.kind) {
      case "drive-mount":
        return { kind: "absolute", value: shape.windowsPath };
      case "device":
      case "posix-absolute":
        return { kind: "unknown" };
      case "plain":
        return this.impl.isAbsolute(target)
          ? { kind: "absolute", value: target }
          : { kind: "relative" };
    }
  }

  /** Resolve a `cd`-folded offset against the baked cwd (platform-aware). */
  resolveBase(offset: string): string {
    return this.impl.resolve(this.cwd, offset);
  }

  /** Join a `cd` offset with a relative target (platform-aware), for cd-folding. */
  joinBase(offset: string, target: string): string {
    return this.impl.join(offset, target);
  }

  /** Containment of `pathValue` within `directory` (platform-aware). */
  isWithinDirectory(pathValue: string, directory: string): boolean {
    return pathFlavorForPlatform(this.platform).isWithin(pathValue, directory);
  }

  /** Canonical (symlink-resolved) outside-cwd test against the baked cwd. */
  isOutsideWorkingDirectory(pathValue: string): boolean {
    const canonicalPath = canonicalNormalizePathForComparison(
      pathValue,
      this.cwd,
      this.platform,
    );
    return isPathOutsideWorkingDirectory(
      canonicalPath,
      this.canonicalCwd,
      pathFlavorForPlatform(this.platform),
    );
  }

  /**
   * Outside-cwd test for an already-canonical boundary value (from
   * {@link AccessPath.boundaryValue}), against the baked cwd.
   *
   * Unlike {@link isOutsideWorkingDirectory}, it does not re-derive the
   * canonical form — the caller passes a value the {@link AccessPath} already
   * canonicalized, so a device's preserved `/dev/null` reaches the pure check's
   * `isSafeSystemPath` exclusion intact.
   */
  isBoundaryOutsideWorkingDirectory(canonicalPath: string): boolean {
    return isPathOutsideWorkingDirectory(
      canonicalPath,
      this.canonicalCwd,
      pathFlavorForPlatform(this.platform),
    );
  }

  /**
   * Lexical (not symlink-resolved) comparison value, resolved against the baked
   * cwd. Mirrors the as-typed absolute form used for skill-prompt matching;
   * touches no filesystem, unlike {@link forPath}'s canonical alias.
   */
  comparableValue(pathValue: string): string {
    return normalizePathForComparison(pathValue, this.cwd, this.platform);
  }

  /**
   * Pi infrastructure-read containment for a read-only tool, decided against
   * the canonical (symlink-resolved) path and the baked cwd/platform. Takes the
   * already-built {@link AccessPath} so the caller does not re-resolve it.
   */
  isInfrastructureRead(
    toolName: string,
    accessPath: AccessPath,
    infraDirs: readonly string[],
  ): boolean {
    return isPiInfrastructureRead(
      toolName,
      accessPath.boundaryValue(),
      infraDirs,
      this.cwd,
      this.platform,
    );
  }
}
