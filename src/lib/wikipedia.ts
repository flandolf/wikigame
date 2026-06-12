const API_BASE = 'https://en.wikipedia.org/w/api.php';

interface RandomPage {
  title: string;
  id: number;
}

interface ArticleContent {
  title: string;
  html: string;
}

interface WikiApiError {
  error?: {
    info?: string;
  };
}

interface WikiQueryPage {
  pageid?: number;
  id?: number;
  title?: string;
  length?: number;
  pageprops?: {
    disambiguation?: string;
  };
  links?: unknown[];
}

interface WikiQueryResponse extends WikiApiError {
  query?: {
    pages?: Record<string, WikiQueryPage>;
  };
}

interface WikiParseResponse extends WikiApiError {
  parse: {
    title: string;
    text: {
      '*': string;
    };
  };
}

// Constants

/** Minimum article size in bytes. Larger = more content, more links. */
const MIN_ARTICLE_SIZE = 10_000;

/** Minimum outgoing links to other main-namespace articles. */
const MIN_LINKS = 25;

/** How many random pages to request in one API batch. */
const BATCH_SIZE = 30;

/** Max iteration count to avoid infinite loops. */
const MAX_FETCH_ATTEMPTS = 15;

/** Number of candidate articles to keep in the pre-fetch pool. */
const POOL_TARGET = 10;

/** localStorage keys */
const STORAGE_USED_KEY = 'wikigame_used_articles';
const STORAGE_POOL_KEY = 'wikigame_candidate_pool';

// Types

interface PageWithSize {
  title: string;
  id: number;
  size: number;
  links: number; // confirmed link count
}

interface PoolEntry {
  page: RandomPage;
  expiresAt: number; // epoch ms
}

// API helper

async function apiRequest<TResponse extends WikiApiError>(
  params: Record<string, string>
): Promise<TResponse> {
  const url = new URL(API_BASE);
  Object.entries({ ...params, format: 'json', origin: '*' }).forEach(([k, v]) => {
    url.searchParams.set(k, v);
  });
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Wikipedia API error: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(`Wikipedia API error: ${data.error.info}`);
  }
  return data as TResponse;
}

// Recently used tracking

function getUsedArticleIds(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_USED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function markArticleUsed(id: number): void {
  try {
    const used = getUsedArticleIds();
    used.add(id);
    // Keep only the last 200 entries to avoid unbounded growth
    const arr = Array.from(used).slice(-200);
    localStorage.setItem(STORAGE_USED_KEY, JSON.stringify(arr));
  } catch {
    // localStorage may be full — silently ignore
  }
}

// Candidate pool

function loadPool(): PoolEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_POOL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PoolEntry[];
  } catch {
    return [];
  }
}

function savePool(pool: PoolEntry[]): void {
  try {
    localStorage.setItem(STORAGE_POOL_KEY, JSON.stringify(pool));
  } catch {
    // silently ignore
  }
}

/** Drain `count` articles from the pool. Removes them so they won't be reused. */
function takeFromPool(count: number): RandomPage[] {
  const pool = loadPool();
  const now = Date.now();
  const valid = pool.filter((e) => e.expiresAt > now);
  const taken = valid.splice(0, count);
  savePool(valid);
  return taken.map((e) => e.page);
}

function addToPool(pages: RandomPage[]): void {
  const pool = loadPool();
  const now = Date.now();
  const existingIds = new Set(pool.map((e) => e.page.id));
  const fresh: PoolEntry[] = pages
    .filter((p) => !existingIds.has(p.id))
    .map((p) => ({ page: p, expiresAt: now + 3_600_000 })); // 1 hour
  const merged = [...pool, ...fresh].slice(-50); // keep latest 50
  savePool(merged);
}

// Batch fetching

/** Fetch a batch of random pages with size + disambiguation info. */
async function fetchRandomBatch(batchSize: number): Promise<PageWithSize[]> {
  const data = await apiRequest<WikiQueryResponse>({
    action: 'query',
    generator: 'random',
    grnnamespace: '0',
    grnlimit: String(batchSize),
    prop: 'info|pageprops',
    inprop: 'size',
    ppprop: 'disambiguation',
  });

  if (!data.query?.pages) return [];

  const pages = Object.values(data.query.pages);

  return pages
    .filter((p) => p.title !== undefined && p.length !== undefined && p.pageprops?.disambiguation === undefined)
    .map((p) => ({
      title: p.title ?? '',
      id: p.pageid ?? p.id ?? 0,
      size: p.length ?? 0,
      links: 0, // will be verified below
    }));
}

/**
 * Verify which candidate pages have sufficient outgoing links.
 * Accepts pages with **at least MIN_LINKS** links in main-namespace articles
 * (including pages that have so many links that the first batch is full).
 */
async function verifyLinkCounts(candidates: PageWithSize[]): Promise<PageWithSize[]> {
  if (candidates.length === 0) return [];

  const ids = candidates.map((p) => p.id);
  const data = await apiRequest<WikiQueryResponse>({
    action: 'query',
    pageids: ids.join('|'),
    prop: 'links',
    plnamespace: '0',
    pllimit: String(MIN_LINKS),
  });

  if (!data.query?.pages) return [];

  const pageMap = Object.values(data.query.pages);

  return candidates.filter((candidate) => {
    const result = pageMap.find(
      (p) => (p.pageid ?? p.id) === candidate.id
    );
    if (!result) return false;

    const links = result.links ?? [];
    // If we got at least MIN_LINKS results, the article passes.
    // The API returns exactly pllimit items when there are more available.
    return links.length >= MIN_LINKS;
  });
}

// Public API

/**
 * Returns `count` random articles suitable for the game.
 *
 * Selection criteria:
 *  1. At least 10 KB size
 *  2. Not a disambiguation page
 *  3. At least 25 outgoing main-namespace links
 *  4. Not among the 200 most recently used articles
 *
 * Pre-fetched candidates are drawn from a localStorage pool first,
 * and the pool is topped up in the background for faster future starts.
 */
export async function getRandomArticles(count: number = 2): Promise<RandomPage[]> {
  const usedIds = getUsedArticleIds();

  // 1. Try to take from the pool first
  const fromPool = takeFromPool(count);
  const unpooledNeeded = count - fromPool.length;

  let freshPages: PageWithSize[] = [];

  if (unpooledNeeded > 0) {
    freshPages = await fetchFreshCandidates(unpooledNeeded, usedIds);
  }

  const selected: RandomPage[] = [
    ...fromPool,
    ...freshPages.map((p) => ({ title: p.title, id: p.id })),
  ].slice(0, count);

  if (selected.length < count) {
    throw new Error(
      `Could not find enough good articles. Found ${selected.length} of ${count} needed.`
    );
  }

  // Mark as used
  for (const article of selected) {
    markArticleUsed(article.id);
  }

  // 3. Top up the pool in the background (fire-and-forget)
  topUpPool(usedIds);

  return selected;
}

/**
 * Keep fetching & verifying random pages until we have enough candidates.
 */
async function fetchFreshCandidates(
  needed: number,
  usedIds: Set<number>
): Promise<PageWithSize[]> {
  const verified: PageWithSize[] = [];
  let attempts = 0;

  while (verified.length < needed && attempts < MAX_FETCH_ATTEMPTS) {
    attempts++;
    const batch = await fetchRandomBatch(BATCH_SIZE);

    // Filter by size and not recently used
    const sized = batch.filter(
      (p) => p.size >= MIN_ARTICLE_SIZE && !usedIds.has(p.id) && !verified.some((v) => v.id === p.id)
    );

    if (sized.length === 0) continue;

    // Verify link counts
    const withLinks = await verifyLinkCounts(sized);

    for (const page of withLinks) {
      verified.push(page);
      if (verified.length >= needed) break;
    }
  }

  return verified;
}

/**
 * Quietly fetch and verify extra candidates for the pool so
 * future game starts are near-instant.
 */
async function topUpPool(usedIds: Set<number>): Promise<void> {
  try {
    const existing = loadPool();
    if (existing.length >= POOL_TARGET) return;

    const needed = POOL_TARGET - existing.length;
    const fresh = await fetchFreshCandidates(needed, usedIds);
    addToPool(fresh.map((p) => ({ title: p.title, id: p.id })));
  } catch {
    // Pooling is best-effort, never block the UI.
  }
}

// Article content / link helpers

export async function getArticleContent(title: string): Promise<ArticleContent> {
  const data = await apiRequest<WikiParseResponse>({
    action: 'parse',
    page: title,
    prop: 'text',
    disablelimitreport: '1',
  });
  return {
    title: data.parse.title,
    html: data.parse.text['*'],
  };
}

export function extractArticleTitleFromHref(href: string): string | null {
  if (!href.startsWith('/wiki/')) return null;

  const title = decodeURIComponent(href.replace('/wiki/', ''));

  // Skip special namespaces
  const skipPrefixes = [
    'File:', 'Category:', 'Help:', 'Template:', 'Special:',
    'Wikipedia:', 'Talk:', 'Portal:', 'User:', 'Draft:', 'Module:',
    'Book:', 'MediaWiki:', 'MOS:', 'WT:', 'WP:',
  ];

  for (const prefix of skipPrefixes) {
    if (title.startsWith(prefix)) return null;
  }

  // Remove any fragment/anchor
  const cleanTitle = title.split('#')[0];
  if (!cleanTitle) return null;

  return cleanTitle.replace(/_/g, ' ');
}

export function isSameArticle(title1: string, title2: string): boolean {
  return normalizeTitle(title1) === normalizeTitle(title2);
}

function normalizeTitle(title: string): string {
  return decodeURIComponent(title)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
