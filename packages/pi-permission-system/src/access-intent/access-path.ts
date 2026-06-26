import {
  canonicalNormalizePathForComparison,
  getPathPolicyValues,
  normalizePathForComparison,
} from "#src/path-utils";

/**
 * A path's two representations held behind type-distinct accessors.
 *
 * A single `string` carrying both meanings was the root cause of [#418]:
 * both external-directory gates matched config patterns against the
 * symlink-resolved (canonical) path instead of the typed (lexical) path,
 * defeating a configured `/tmp/*` allow.
 *
 * `AccessPath` makes the misuse a compile error:
 * - {@link matchValues} returns `string[]` — the lexical alias union ∪ canonical,
 *   for `external_directory` pattern matching.
 * - {@link boundaryValue} returns `string` — the canonical form, for
 *   outside-CWD containment and infra-read checks.
 * - {@link value} returns `string` — the lexical absolute form, for display,
 *   approval patterns, decision values, and logs.
 *
 * Construct via {@link forExternalDirectory}; the constructor is private.
 */
export class AccessPath {
  private constructor(
    private readonly lexical: string,
    private readonly matchAliases: readonly string[],
    private readonly canonical: string,
  ) {}

  /**
   * Pattern-match values for the `external_directory` surface: the lexical
   * alias union plus the canonical alias, so a config pattern on either the
   * typed form (`/tmp/*`) or the symlink-resolved form (`/private/tmp/*`)
   * matches (#418).
   *
   * Collapses to the lexical aliases when the canonical equals one of them
   * (e.g. when the path is not a symlink).
   */
  matchValues(): string[] {
    return this.canonical
      ? [...new Set([...this.matchAliases, this.canonical])]
      : [...this.matchAliases];
  }

  /**
   * Canonical (symlink-resolved, win32-lowercased) form, for the outside-CWD
   * boundary decision and Pi infrastructure-read containment checks.
   *
   * Returns `""` when the path could not be resolved (empty input).
   */
  boundaryValue(): string {
    return this.canonical;
  }

  /**
   * Lexical (as-typed, normalized but not symlink-resolved) form, for display,
   * approval patterns, decision values, and log messages.
   *
   * Returns `""` for empty input.
   */
  value(): string {
    return this.lexical;
  }

  /**
   * Build an `AccessPath` for a tool-input or bash-token path resolved against
   * `cwd`.
   *
   * - `matchValues()` returns the same set as the former
   *   `getExternalDirectoryPolicyValues(pathValue, cwd)` — the lexical alias
   *   union from `getPathPolicyValues` plus the canonical alias from
   *   `canonicalNormalizePathForComparison` (#418).
   * - `boundaryValue()` returns `canonicalNormalizePathForComparison(pathValue, cwd)`,
   *   which is win32-lowercased (#382) — do not substitute a raw
   *   `canonicalizePath` output here.
   * - `value()` returns `normalizePathForComparison(pathValue, cwd)`, the
   *   absolute lexical form.
   */
  static forExternalDirectory(pathValue: string, cwd: string): AccessPath {
    return new AccessPath(
      normalizePathForComparison(pathValue, cwd),
      getPathPolicyValues(pathValue, { cwd }),
      canonicalNormalizePathForComparison(pathValue, cwd),
    );
  }
}
