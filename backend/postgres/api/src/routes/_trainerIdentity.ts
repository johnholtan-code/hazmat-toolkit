import type { FastifyInstance } from 'fastify';
import { TrainerAuthError, readTrainerRefHeader } from './_trainerAuth.js';

type SupabaseUserResponse = {
  email?: string | null;
  user_metadata?: {
    name?: string | null;
    full_name?: string | null;
    display_name?: string | null;
  } | null;
};

export type TrainerIdentity = {
  trainerRef: string;
  displayName: string;
  authSource: 'supabase' | 'header';
};

export async function requireTrainerIdentity(
  app: FastifyInstance,
  headers: { authorization?: string; ['x-trainer-ref']?: string | string[] | undefined }
): Promise<TrainerIdentity> {
  const bearer = extractBearerToken(headers.authorization);
  if (bearer && app.config.supabaseUrl && app.config.supabaseAnonKey) {
    const identity = await fetchSupabaseTrainerIdentity(app, bearer);
    if (identity) {
      return identity;
    }
    throw new TrainerAuthError('Invalid or expired trainer sign-in.');
  }

  const trainerRef = readTrainerRefHeader(headers);
  if (!trainerRef) {
    throw new TrainerAuthError('Trainer authentication is required.');
  }

  return {
    trainerRef,
    displayName: trainerRef,
    authSource: 'header'
  };
}

function extractBearerToken(authorization?: string): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(/\s+/, 2);
  if (!scheme || !token) return null;
  return scheme.toLowerCase() === 'bearer' ? token.trim() : null;
}

async function fetchSupabaseTrainerIdentity(app: FastifyInstance, accessToken: string): Promise<TrainerIdentity | null> {
  const supabaseUrl = app.config.supabaseUrl;
  const anonKey = app.config.supabaseAnonKey;
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(new URL('/auth/v1/user', supabaseUrl), {
    method: 'GET',
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json'
    }
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Supabase auth lookup failed with HTTP ${response.status}.`);
  }

  const body = (await response.json()) as SupabaseUserResponse;
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    throw new TrainerAuthError('Authenticated trainer account is missing an email address.');
  }

  const displayName =
    body.user_metadata?.full_name?.trim() ||
    body.user_metadata?.display_name?.trim() ||
    body.user_metadata?.name?.trim() ||
    email;

  return {
    trainerRef: email,
    displayName,
    authSource: 'supabase'
  };
}
