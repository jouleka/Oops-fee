/**
 * SEO metadata for the public web build (https://oopsfee.app).
 *
 * Only the routes listed in PUBLIC_PAGES are meant to be indexed and must stay
 * in sync with public/sitemap.xml. Every other route (app-only screens, auth,
 * private share/invite/claim links) is rendered with `noindex`.
 */

export const SITE_URL = 'https://oopsfee.app';
export const SITE_NAME = 'OopsFee';
export const OG_IMAGE_URL = `${SITE_URL}/og-image.png`;
export const LOGO_URL = `${SITE_URL}/icon-512.png`;
export const THEME_COLOR = '#070B16';

export const DEFAULT_TITLE = 'OopsFee – Put Money on Your Promises | Accountability App';
export const DEFAULT_DESCRIPTION =
  'OopsFee is an accountability app for iOS and Android: make a promise, stake real money, and prove you did it with photo proof or a friend as witness — or lose the stake.';

export type PageSeo = {
  title: string;
  description: string;
};

export const PUBLIC_PAGES: Record<string, PageSeo> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  },
  '/privacy': {
    title: 'Privacy Policy | OopsFee',
    description:
      'How OopsFee collects, uses, and protects your personal data, and how to exercise your privacy rights.',
  },
  '/terms': {
    title: 'Terms of Service | OopsFee',
    description:
      'The terms that govern your use of OopsFee, including promises with financial stakes, payments, and fees.',
  },
  '/delete-account': {
    title: 'Delete Your Account | OopsFee',
    description:
      'How to delete your OopsFee account and associated data, and what happens to your information after deletion.',
  },
};
