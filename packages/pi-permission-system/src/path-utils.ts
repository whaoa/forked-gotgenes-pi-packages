import { posix as posixPath, win32 as winPath } from "node:path";

import { canonicalizePath } from "./canonicalize-path";
import { expandHomePath } from "./expand-home";
import { isSafeSystemPath } from "./safe-system-paths";

export function normalizePathForComparison(
  pathValue: string,
  cwd: string,
  platform: NodeJS.Platform,
): string {
  const trimmed = pathValue.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) {
    return "";
  }

  let normalizedPath = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  normalizedPath = expandHomePath(normalizedPath);

  const impl = platform === "win32" ? winPath : posixPath;
  const absolutePath = impl.resolve(cwd, normalizedPath);
  const normalizedAbsolutePath = impl.normalize(absolutePath);
  return platform === "win32"
    ? normalizedAbsolutePath.toLowerCase()
    : normalizedAbsolutePath;
}

/**
 * Returns true when `pathValue` is `directory` itself or nested inside it.
 *
 * Containment is decided with Node's platform-native `path.relative` rather
 * than a hand-rolled prefix check: on `win32` the comparison folds case (and
 * tolerates either separator), matching the case-insensitive filesystem.
 * `platform` is injected from the composition root so Windows behavior is
 * testable on a POSIX CI.
 */
export function isPathWithinDirectory(
  pathValue: string,
  directory: string,
  platform: NodeJS.Platform,
): boolean {
  if (!pathValue || !directory) {
    return false;
  }

  if (pathValue === directory) {
    return true;
  }

  const impl = platform === "win32" ? winPath : posixPath;
  const rel = impl.relative(directory, pathValue);
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${impl.sep}`) &&
    !impl.isAbsolute(rel)
  );
}

export interface PathPolicyValueOptions {
  /**
   * Current Pi working directory. When provided, returned values include a
   * project-relative alias for paths that resolve inside this directory.
   */
  cwd?: string;
  /**
   * Directory used to resolve `pathValue` into an absolute policy value.
   * Defaults to `cwd`. Bash uses this for tokens seen after a literal `cd`.
   */
  resolveBase?: string;
}

/**
 * Normalize a single path-like lookup value without resolving it against CWD.
 *
 * Preserves compatibility with existing relative path rules (`src/*`, `*.env`)
 * while applying the same lexical cleanup as
 * {@link normalizePathForComparison}: trim, strip simple wrapping quotes,
 * strip the OpenCode-style leading `@`, and expand `~` / `$HOME`.
 */
export function normalizePathPolicyLiteral(pathValue: string): string {
  const trimmed = pathValue.trim().replace(/^['"]|['"]$/g, "");
  if (!trimmed) return "";
  const unprefixed = trimmed.startsWith("@") ? trimmed.slice(1) : trimmed;
  return expandHomePath(unprefixed);
}

/**
 * Return equivalent lookup values for path-policy matching.
 *
 * The first value is the cwd/effective-base normalized absolute path when a
 * base is available. The later values preserve project-relative and raw
 * relative forms so existing rules like `src/*` and `*.env` continue to match.
 */
export function getPathPolicyValues(
  pathValue: string,
  options: PathPolicyValueOptions,
  platform: NodeJS.Platform,
): string[] {
  const literal = normalizePathPolicyLiteral(pathValue);
  if (!literal) return [];
  if (literal === "*") return ["*"];

  return [
    ...new Set([
      ...getAbsolutePathPolicyValues(pathValue, options, platform),
      literal,
    ]),
  ];
}

function getAbsolutePathPolicyValues(
  pathValue: string,
  options: PathPolicyValueOptions,
  platform: NodeJS.Platform,
): string[] {
  const resolveBase = options.resolveBase ?? options.cwd;
  if (!resolveBase) return [];

  const absolute = normalizePathForComparison(pathValue, resolveBase, platform);
  if (!absolute) return [];

  return [
    absolute,
    ...getCwdRelativePathPolicyValues(absolute, options.cwd, platform),
  ];
}

function getCwdRelativePathPolicyValues(
  absolute: string,
  cwd: string | undefined,
  platform: NodeJS.Platform,
): string[] {
  if (!cwd) return [];

  const normalizedCwd = normalizePathForComparison(cwd, cwd, platform);
  if (!normalizedCwd) return [];
  if (
    absolute !== normalizedCwd &&
    !isPathWithinDirectory(absolute, normalizedCwd, platform)
  ) {
    return [];
  }

  const impl = platform === "win32" ? winPath : posixPath;
  const relativeValue = impl.relative(normalizedCwd, absolute);
  return relativeValue ? [relativeValue] : [];
}

/**
 * Like {@link normalizePathForComparison} but also resolves symlinks via
 * `realpathSync` (best-effort). Use this for containment decisions where the
 * OS-followed path matters, not for pattern matching.
 */
export function canonicalNormalizePathForComparison(
  pathValue: string,
  cwd: string,
  platform: NodeJS.Platform,
): string {
  const lexical = normalizePathForComparison(pathValue, cwd, platform);
  if (!lexical) return "";
  const canonical = canonicalizePath(lexical, platform);
  return platform === "win32" ? canonical.toLowerCase() : canonical;
}

/**
 * Pure geometry: is `canonicalPath` outside `canonicalCwd`?
 *
 * Both operands must already be canonical (symlink-resolved, win32-lowercased)
 * — the caller prepares them (see {@link PathNormalizer.isOutsideWorkingDirectory}).
 * This predicate touches no filesystem and does no derivation.
 */
export function isPathOutsideWorkingDirectory(
  canonicalPath: string,
  canonicalCwd: string,
  platform: NodeJS.Platform,
): boolean {
  if (!canonicalCwd || !canonicalPath) {
    return false;
  }
  if (isSafeSystemPath(canonicalPath)) {
    return false;
  }
  return !isPathWithinDirectory(canonicalPath, canonicalCwd, platform);
}
