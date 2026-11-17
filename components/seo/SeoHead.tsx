/**
 * Per-route <head> tags for the web build (title, description, canonical,
 * Open Graph / Twitter, robots, JSON-LD). Rendered into the static HTML by
 * `expo export --platform web` (web.output: "static"). No-op on native.
 */

import Head from 'expo-router/head';
import { usePathname } from 'expo-router';
import { Platform } from 'react-native';

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  OG_IMAGE_URL,
  PUBLIC_PAGES,
  SITE_NAME,
  SITE_URL,
} from '@/constants/seo';

const APP_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'MobileApplication',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  description: DEFAULT_DESCRIPTION,
  operatingSystem: 'iOS, Android',
  applicationCategory: 'LifestyleApplication',
  image: OG_IMAGE_URL,
  publisher: { '@id': `${SITE_URL}/#organization` },
  featureList: [
    'Promises with real money at stake',
    'Voice commitment recordings',
    'Photo proof verification',
    'Friend verification',
    'Escalating stakes after a failed promise',
    'Friends can sponsor your stake',
    'Roast messages revealed only if you fail',
    'Graveyard of broken promises',
  ],
};

function normalizePath(pathname: string | undefined): string {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

function WebSeoHead() {
  const path = normalizePath(usePathname());
  const page = PUBLIC_PAGES[path];
  const indexable = Boolean(page);
  const title = page?.title ?? DEFAULT_TITLE;
  const description = page?.description ?? DEFAULT_DESCRIPTION;
  const url = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="robots"
        content={indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow'}
      />
      {indexable ? <link rel="canonical" href={url} /> : null}

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      {indexable ? <meta property="og:url" content={url} /> : null}
      <meta property="og:image" content={OG_IMAGE_URL} />
      <meta property="og:image:width" content="1024" />
      <meta property="og:image:height" content="500" />
      <meta property="og:image:alt" content="OopsFee – Put money on your promises. Break them, pay up." />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE_URL} />

      {path === '/' ? (
        <script type="application/ld+json">{JSON.stringify(APP_JSON_LD)}</script>
      ) : null}
    </Head>
  );
}

export function SeoHead() {
  if (Platform.OS !== 'web') return null;
  return <WebSeoHead />;
}
