/**
 * Friends API
 *
 * Client-side functions for friend operations.
 */

import { supabase } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface FriendProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  friendship_id: string;
  created_at: string;
}

export interface FriendRequest {
  friendship_id: string;
  user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  created_at: string;
}

export interface GetFriendsResponse {
  friends: FriendProfile[];
  pendingReceived: FriendRequest[];
  pendingSent: FriendRequest[];
}

export interface SearchUserResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface SearchUsersResponse {
  users: SearchUserResult[];
}

export interface SendFriendRequestResponse {
  success: boolean;
  friendship_id: string;
  auto_accepted?: boolean;
  message?: string;
}

export interface RespondFriendRequestResponse {
  success: boolean;
  status: string;
  friendship_id: string;
}

export interface FriendProfileData {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface FriendPromise {
  id: string;
  text: string;
  stake: number;
  deadline_at: string;
  verification_type: string;
  sponsor_total: number;
  sponsor_count: number;
  has_roast: boolean;
  created_at: string;
}

export interface FriendStats {
  totalPromises: number;
  completed: number;
  failed: number;
  successRate: number;
  currentStreak: number;
  longestStreak: number;
  totalSaved: number;
  totalLost: number;
}

export interface FriendHistoryItem {
  id: string;
  text: string;
  stake: number;
  status: string;
  completed_at: string | null;
  failed_at: string | null;
}

export interface GetFriendProfileResponse {
  profile: FriendProfileData;
  activePromises: FriendPromise[];
  stats: FriendStats;
  recentHistory: FriendHistoryItem[];
}

export interface CreateFriendInviteResponse {
  success: boolean;
  invite_token: string;
  invite_url: string;
  expires_at: string;
}

export interface ClaimFriendInviteResponse {
  success: boolean;
  inviter: {
    id: string;
    username: string | null;
    display_name: string | null;
  };
  already_claimed?: boolean;
  already_friends?: boolean;
}

// ─────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────

/**
 * Get all friends and pending requests for the current user.
 */
export async function getFriends(): Promise<GetFriendsResponse> {
  const response = await supabase.functions.invoke('get-friends', {
    body: {},
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch friends');
  }

  return response.data;
}

/**
 * Search for users by username prefix.
 */
export async function searchUsers(query: string): Promise<SearchUserResult[]> {
  const response = await supabase.functions.invoke('search-users', {
    body: { query, limit: 20 },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to search users');
  }

  return response.data.users ?? [];
}

/**
 * Send a friend request to another user.
 */
export async function sendFriendRequest(addresseeId: string): Promise<SendFriendRequestResponse> {
  const response = await supabase.functions.invoke('send-friend-request', {
    body: { addressee_id: addresseeId },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to send friend request');
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

/**
 * Respond to a friend request (accept or reject).
 */
export async function respondFriendRequest(
  friendshipId: string,
  action: 'accept' | 'reject'
): Promise<RespondFriendRequestResponse> {
  const response = await supabase.functions.invoke('respond-friend-request', {
    body: { friendship_id: friendshipId, action },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to respond to friend request');
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

/**
 * Get a friend's profile, active promises, and stats.
 * Requires an accepted friendship.
 */
export async function getFriendProfile(friendId: string): Promise<GetFriendProfileResponse> {
  const response = await supabase.functions.invoke('get-friend-profile', {
    body: { friend_id: friendId },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to fetch friend profile');
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

/**
 * Get display name for a friend (username preferred, fallback to display_name).
 */
export function getFriendDisplayName(
  user: { username: string | null; display_name: string | null } | null
): string {
  if (!user) return 'Unknown';
  return user.username ? `@${user.username}` : user.display_name || 'User';
}

/**
 * Get initials for avatar.
 */
export function getInitials(
  user: { username: string | null; display_name: string | null } | null
): string {
  if (!user) return '?';
  const name = user.display_name || user.username || '';
  return name.charAt(0).toUpperCase() || '?';
}

/**
 * Create a shareable friend invite link.
 * The link can be shared with non-users who will auto-connect on signup.
 */
export async function createFriendInvite(): Promise<CreateFriendInviteResponse> {
  const response = await supabase.functions.invoke('create-friend-invite', {
    body: {},
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to create invite');
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

/**
 * Claim a friend invite token after signup.
 * Creates an accepted friendship with the inviter.
 */
export async function claimFriendInvite(inviteToken: string): Promise<ClaimFriendInviteResponse> {
  const response = await supabase.functions.invoke('claim-friend-invite', {
    body: { invite_token: inviteToken },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Failed to claim invite');
  }

  if (response.data.error) {
    throw new Error(response.data.error);
  }

  return response.data;
}

