import { posix as posixPath, win32 as winPath } from "node:path";

import { AccessPath } from "./access-intent/access-path";
import {
  isPathOutsideWorkingDirectory,
  isPathWithinDirectory,
} from "./path-utils";

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
 * `path-utils` / `AccessPath` primitives.
 */
export class PathNormalizer {
  private readonly impl: typeof posixPath;

  constructor(
    private readonly platform: NodeJS.Platform,
    private readonly cwd: string,
  ) {
    this.impl = platform === "win32" ? winPath : posixPath;
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
  forLiteral(literal: string): AccessPath {
    return AccessPath.forLiteral(literal);
  }

  /** Platform-aware absoluteness (`win32` vs `posix` rules). */
  isAbsolute(pathValue: string): boolean {
    return this.impl.isAbsolute(pathValue);
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
    return isPathWithinDirectory(pathValue, directory, this.platform);
  }

  /** Canonical (symlink-resolved) outside-cwd test against the baked cwd. */
  isOutsideWorkingDirectory(pathValue: string): boolean {
    return isPathOutsideWorkingDirectory(pathValue, this.cwd, this.platform);
  }
}
