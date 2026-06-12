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
const STORAGE_COMMON_KEY = 'wikigame_common_pool';

/** How long to keep the most-linked article cache (7 days). */
const COMMON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/** Minimum incoming links for a page to be considered "common." */
const MIN_INCOMING_LINKS = 500;

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

// ======================== Common article pool ========================

interface CommonPoolPage {
  title: string;
  id: number;
  size: number;
}

interface CommonPoolCache {
  pages: CommonPoolPage[];
  cachedAt: number;
}

function loadCommonPool(): CommonPoolCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_COMMON_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CommonPoolCache;
  } catch {
    return null;
  }
}

function saveCommonPool(pages: CommonPoolPage[]): void {
  try {
    const cache: CommonPoolCache = { pages, cachedAt: Date.now() };
    localStorage.setItem(STORAGE_COMMON_KEY, JSON.stringify(cache));
  } catch {
    // silently ignore
  }
}

/**
 * Fetch the top ~500 most-linked Wikipedia articles and filter them by
 * size, namespace, and disambiguation status. These are the articles with
 * the most incoming links — naturally the most well-known/common pages.
 */
async function fetchMostLinkedPages(): Promise<CommonPoolPage[]> {
  // Step 1: Get the top 500 most-linked page titles
  const listData = await apiRequest<WikiQueryResponse>({
    action: 'query',
    list: 'querypage',
    qppage: 'mostlinked',
    qplimit: '500',
  });

  type MostLinkedResult = { ns: number; title: string; value: number };
  const results: MostLinkedResult[] =
    (listData.query as any)?.querypage?.results ?? [];

  if (results.length === 0) return [];

  // Filter to main namespace (ns=0) and reasonably linked
  const titles = results
    .filter((r) => r.ns === 0 && r.value >= MIN_INCOMING_LINKS)
    .map((r) => r.title);

  if (titles.length === 0) return [];

  // Step 2: Get page IDs, sizes, and disambiguation status in one batch
  // Split into chunks of 50 to avoid URI too long errors
  const candidates: CommonPoolPage[] = [];

  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50);
    const infoData = await apiRequest<WikiQueryResponse>({
      action: 'query',
      titles: chunk.join('|'),
      prop: 'info|pageprops',
      inprop: 'size',
      ppprop: 'disambiguation',
    });

    const pages = infoData.query?.pages ?? {};
    for (const pageId in pages) {
      const page = pages[pageId];
      if (!page.title || (page.ns ?? -1) !== 0) continue;
      if ((page.length ?? 0) < MIN_ARTICLE_SIZE) continue;
      if (page.pageprops?.disambiguation !== undefined) continue;

      candidates.push({
        title: page.title,
        id: page.pageid ?? page.id ?? 0,
        size: page.length ?? 0,
      });
    }
  }

  return candidates;
}

/**
 * Returns the cached common pool if valid and fresh, or fetches a new one.
 */
async function getOrRefreshCommonPool(): Promise<CommonPoolPage[]> {
  const cached = loadCommonPool();
  if (cached && Date.now() - cached.cachedAt < COMMON_CACHE_TTL) {
    return cached.pages;
  }

  try {
    const pages = await fetchMostLinkedPages();
    if (pages.length > 0) {
      saveCommonPool(pages);
    }
    return pages;
  } catch {
    // If fetch fails, return stale cache if available
    return cached?.pages ?? [];
  }
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
 * Keep fetching & verifying pages until we have enough candidates.
 * Draws from a cached pool of most-linked (common) articles first,
 * then falls back to random pages for any remaining slots.
 */
async function fetchFreshCandidates(
  needed: number,
  usedIds: Set<number>
): Promise<PageWithSize[]> {
  const verified: PageWithSize[] = [];

  // 1. Try the most-linked common pool first
  try {
    const commonPool = await getOrRefreshCommonPool();
    if (commonPool.length > 0) {
      // Shuffle to get variety across games
      const shuffled = [...commonPool].sort(() => Math.random() - 0.5);
      const candidates: PageWithSize[] = shuffled
        .filter((p) => !usedIds.has(p.id))
        .slice(0, needed + 5) // grab extras since some may fail link check
        .map((p) => ({ title: p.title, id: p.id, size: p.size, links: 0 }));

      if (candidates.length > 0) {
        const withLinks = await verifyLinkCounts(candidates);
        for (const page of withLinks) {
          verified.push(page);
          if (verified.length >= needed) break;
        }
      }
    }
  } catch {
    // Common pool is best-effort — fall through to random
  }

  // 2. Fall back to random fetching if still not enough
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

    // Silently refresh the common pool in the background for future games
    getOrRefreshCommonPool().catch(() => {});
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
