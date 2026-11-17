/**
 * Root HTML document for the static web export (web only, never runs on native).
 * Per-route title/description/canonical/OG tags come from components/seo/SeoHead.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

import { LOGO_URL, SITE_NAME, SITE_URL, THEME_COLOR } from '@/constants/seo';

const SITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: LOGO_URL,
      email: 'support@oopsfee.app',
      contactPoint: [
        { '@type': 'ContactPoint', contactType: 'customer support', email: 'support@oopsfee.app' },
        { '@type': 'ContactPoint', contactType: 'privacy', email: 'privacy@oopsfee.app' },
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
};

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="application-name" content={SITE_NAME} />
        <meta name="apple-mobile-web-app-title" content={SITE_NAME} />
        <link rel="apple-touch-icon" href={LOGO_URL} />
        <link rel="icon" type="image/png" sizes="512x512" href={LOGO_URL} />
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />

        {/* Keep the default Expo web reset so layouts behave like before. */}
        <ScrollViewStyleReset />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
