// Maximum field lengths for validated notification fields.
export const MAX_TITLE_LENGTH = 200;
export const MAX_BODY_LENGTH = 2000;
export const GITHUB_REPO = 'Alitiora-Initiative/WELP-UP';
export const ALLOWED_LINK_PREFIX = `https://github.com/${GITHUB_REPO}`;

export type NotificationItem = {
  id: string;
  kind: 'release' | 'commit';
  title: string;
  body: string;
  url: string;
  publishedAt: string;
};

/** Returns true when a URL is a safe link to this repository only. */
export function isSafeGithubUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(ALLOWED_LINK_PREFIX);
}

/** Truncates a string to maxLength, returning '' for non-strings. */
export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, maxLength);
}

/** Validates an ISO 8601 date string. Returns the string if valid, '' otherwise. */
export function sanitizeDate(value: unknown): string {
  if (typeof value !== 'string') return '';
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? value : '';
}

/**
 * Parse a single raw GitHub release object into a NotificationItem.
 * Missing or invalid fields are replaced with safe defaults.
 * Returns null if the item cannot produce a safe URL.
 */
export function parseRelease(raw: unknown): NotificationItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.html_url === 'string' ? r.html_url : '';
  if (!isSafeGithubUrl(url)) return null;
  return {
    id: `release-${sanitizeText(r.id ?? r.tag_name, 64)}`,
    kind: 'release',
    title: sanitizeText(r.name ?? r.tag_name, MAX_TITLE_LENGTH) || 'Release',
    body: sanitizeText(r.body, MAX_BODY_LENGTH),
    url,
    publishedAt: sanitizeDate(r.published_at),
  };
}

/**
 * Parse a single raw GitHub commit object into a NotificationItem.
 * Returns null if the item cannot produce a safe URL.
 */
export function parseCommit(raw: unknown): NotificationItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const url = typeof r.html_url === 'string' ? r.html_url : '';
  if (!isSafeGithubUrl(url)) return null;
  if (typeof r.commit !== 'object' || r.commit === null) return null;
  const commit = r.commit as Record<string, unknown>;
  const committer = typeof commit.committer === 'object' && commit.committer !== null
    ? (commit.committer as Record<string, unknown>)
    : {};
  const message = sanitizeText(commit.message, MAX_TITLE_LENGTH);
  const title = message.split('\n')[0] || 'Commit';
  return {
    id: `commit-${sanitizeText(r.sha, 40)}`,
    kind: 'commit',
    title,
    body: '',
    url,
    publishedAt: sanitizeDate(committer.date),
  };
}

/**
 * Parse an array of raw GitHub objects (releases or commits).
 * Non-parseable items are silently dropped.
 */
export function parseItems(
  items: unknown,
  parser: (raw: unknown) => NotificationItem | null,
): NotificationItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const parsed = parser(item);
    return parsed !== null ? [parsed] : [];
  });
}
