/** Profile helpers (React-free; pinned by test/profile.test.ts). */

/**
 * App `UserProfile.displayName()` (ui/profile/data/model/view/UserProfile.kt:44-52): first + last,
 * each dropped when blank / "No Name" / "null".
 */
export function profileDisplayName(u: { first_name?: string | null; last_name?: string | null } | null | undefined): string {
  const part = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return /^(no name|null)$/i.test(t) ? '' : t;
  };
  return [part(u?.first_name), part(u?.last_name)].filter((x) => x.length > 0).join(' ').trim();
}
