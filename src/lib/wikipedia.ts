const API_BASE = 'https://en.wikipedia.org/w/api.php';

interface RandomPage {
  title: string;
  id: number;
}

interface ArticleContent {
  title: string;
  html: string;
}

async function apiRequest(params: Record<string, string>): Promise<any> {
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
  return data;
}

// Minimum article size in bytes to filter out stubs
const MIN_ARTICLE_SIZE = 5000;

// Maximum number of random pages to fetch per batch
const BATCH_SIZE = 25;

// Maximum total fetch attempts to avoid infinite loops
const MAX_FETCH_ATTEMPTS = 10;

interface PageWithSize {
  title: string;
  id: number;
  size: number;
}

async function fetchRandomBatch(batchSize: number): Promise<PageWithSize[]> {
  const data = await apiRequest({
    action: 'query',
    generator: 'random',
    grnnamespace: '0',
    grnlimit: String(batchSize),
    prop: 'info',
    inprop: 'size',
  });

  if (!data.query?.pages) return [];

  return Object.values(data.query.pages)
    .filter((p: any) => p.length !== undefined)
    .map((p: any) => ({
      title: p.title,
      id: p.pageid ?? p.id ?? 0,
      size: p.length,
    }));
}

export async function getRandomArticles(count: number = 2): Promise<RandomPage[]> {
  const largePages: PageWithSize[] = [];
  let attempts = 0;

  while (largePages.length < count && attempts < MAX_FETCH_ATTEMPTS) {
    attempts++;
    const batch = await fetchRandomBatch(BATCH_SIZE);

    for (const page of batch) {
      if (page.size >= MIN_ARTICLE_SIZE &&
          !largePages.some((p) => p.id === page.id)) {
        largePages.push(page);
        if (largePages.length >= count) break;
      }
    }
  }

  if (largePages.length === 0) {
    throw new Error('Could not find articles of sufficient size');
  }

  return largePages.slice(0, count).map((p) => ({
    title: p.title,
    id: p.id,
  }));
}

export async function getArticleContent(title: string): Promise<ArticleContent> {
  const data = await apiRequest({
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
