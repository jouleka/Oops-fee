/**
 * Share Links API
 *
 * Client-side functions for interacting with share link edge functions.
 */

import { supabase } from '@/lib/supabase/client';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type ShareLinkType = 'friend' | 'partner';

export interface CreateShareLinkResponse {
  token: string;
  url: string;
  expiresAt?: string;
}

export interface ShareContext {
  type: ShareLinkType;
  promiseText: string;
  deadlinePassed: boolean;
  ownerFirstName?: string;
  status: 'active' | 'resolved';
  // Friend link - combined sponsor + roast
  currentSponsorTotal?: number;
  sponsorCount?: number;
  hasRoast?: boolean;
  hasSponsor?: boolean;
  // Partner-specific
  partnerState?: 'awaiting' | 'resolved';
}

export interface SubmitSponsorResponse {
  success: boolean;
  newTotal: number;
  sponsorCount: number;
}

export interface SubmitRoastResponse {
  success: boolean;
}

export interface SubmitPartnerDecisionResponse {
  success: boolean;
  status: 'completed' | 'failed';
}

// ─────────────────────────────────────────────────────────────
// AUTHENTICATED ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * Create a share link for a promise.
 * Requires authentication - only promise owner can create links.
 */
export async function createShareLink(
  promiseId: string,
  type: ShareLinkType
): Promise<CreateShareLinkResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-share-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ promiseId, type }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to create share link');
  }

  return data;
}

// ─────────────────────────────────────────────────────────────
// PUBLIC ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * Get share context for a token (public endpoint).
 * Used to render the share page.
 */
export async function getShareContext(token: string): Promise<ShareContext> {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/get-share-context?token=${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to get share context');
  }

  return data;
}

/**
 * Submit a sponsor pledge (public endpoint).
 */
export async function submitSponsor(
  token: string,
  amount: number,
  fromName: string
): Promise<SubmitSponsorResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-sponsor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, amount, fromName }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit sponsor pledge');
  }

  return data;
}

/**
 * Submit a roast message (public endpoint).
 */
export async function submitRoast(
  token: string,
  message: string,
  fromName: string
): Promise<SubmitRoastResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-roast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, message, fromName }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit roast message');
  }

  return data;
}

/**
 * Submit partner verification decision (public endpoint).
 */
export async function submitPartnerDecision(
  token: string,
  approved: boolean
): Promise<SubmitPartnerDecisionResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/submit-partner-decision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, approved }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to submit partner decision');
  }

  return data;
}

