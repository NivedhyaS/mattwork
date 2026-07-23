import { OAuth2Client } from 'google-auth-library';
import { logger } from '../config/logger';
import { env } from '../config/env';

/**
 * Shared Google OIDC client — Google Pub/Sub push subscriptions authenticate
 * their HTTP push requests using a Google-signed OIDC JWT in the Authorization
 * header (Bearer <token>).
 *
 * Per Google's documentation:
 *  https://cloud.google.com/pubsub/docs/push#authentication_and_authorization
 *
 * The token is an OIDC token issued by Google, and the audience claim is the
 * full URL of the push endpoint.
 */
const oidcClient = new OAuth2Client();

export interface VerifiedPubSubClaim {
  email?: string;
  sub: string;
  aud: string | string[];
  iss: string;
}

/**
 * Verifies a Google Pub/Sub push OIDC bearer token extracted from the
 * Authorization header of an inbound push request.
 *
 * Checks:
 *  - JWT signature (against Google's public JWKS)
 *  - Issuer: must be accounts.google.com or https://accounts.google.com
 *  - Audience: must match the configured push endpoint URL
 *  - Expiration: google-auth-library handles automatically
 *
 * Returns the verified payload, or throws if invalid.
 */
export async function verifyPubSubJwt(
  bearerToken: string,
  expectedAudience: string
): Promise<VerifiedPubSubClaim> {
  try {
    const ticket = await oidcClient.verifyIdToken({
      idToken: bearerToken,
      audience: expectedAudience,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Empty payload from OIDC token verification');
    }

    const iss = payload.iss ?? '';
    if (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') {
      throw new Error(`Invalid token issuer: ${iss}`);
    }

    logger.info(`[PubSubAuth] JWT verified | sub=${payload.sub} email=${payload.email}`);

    return {
      email: payload.email,
      sub: payload.sub ?? '',
      aud: payload.aud ?? '',
      iss,
    };
  } catch (err: any) {
    logger.warn(`[PubSubAuth] JWT verification failed: ${err?.message}`);
    throw err;
  }
}

/**
 * Extracts the raw bearer token string from an Authorization header value.
 * Returns null if the header is missing or malformed.
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1] || null;
}
