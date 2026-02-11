import { Context, MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

// Auth0 configuration from environment
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN || '';
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE || '';

// JWKS (JSON Web Key Set) for validating Auth0 tokens
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!jwks && AUTH0_DOMAIN) {
    jwks = createRemoteJWKSet(new URL(`https://${AUTH0_DOMAIN}/.well-known/jwks.json`));
  }
  return jwks;
}

// User context added to requests
export interface AuthUser {
  userId: string; // Auth0 sub claim
  email?: string;
  scopes: string[];
}

// Extend Hono context with auth user
declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser | null;
  }
}

interface AuthOptions {
  required?: boolean;
  scopes?: string[];
}

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7);
}

/**
 * Verify JWT and extract user info
 */
async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const jwksSet = getJWKS();
    if (!jwksSet) {
      console.error('JWKS not configured - AUTH0_DOMAIN not set');
      return null;
    }

    const { payload } = await jwtVerify(token, jwksSet, {
      issuer: `https://${AUTH0_DOMAIN}/`,
      audience: AUTH0_AUDIENCE,
    });

    const sub = payload.sub;
    if (!sub) {
      return null;
    }

    // Extract scopes from token (Auth0 uses 'scope' claim)
    const scopeString = (payload as JWTPayload & { scope?: string }).scope || '';
    const scopes = scopeString.split(' ').filter((s) => s.length > 0);

    // Extract email if present
    const email = (payload as JWTPayload & { email?: string }).email;

    return {
      userId: sub,
      email,
      scopes,
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Check if user has required scopes
 */
function hasRequiredScopes(userScopes: string[], requiredScopes: string[]): boolean {
  if (requiredScopes.length === 0) {
    return true;
  }
  return requiredScopes.every((scope) => userScopes.includes(scope));
}

/**
 * Auth middleware factory
 *
 * @param options.required - If true, rejects unauthenticated requests with 401
 * @param options.scopes - Required scopes (rejects with 403 if missing)
 *
 * Usage:
 * ```typescript
 * // Optional auth - populates user if token present
 * app.use('/deals/*', authMiddleware({ required: false }));
 *
 * // Required auth - rejects if no valid token
 * app.use('/me/*', authMiddleware({ required: true, scopes: ['user'] }));
 * ```
 */
export function authMiddleware(options: AuthOptions = {}): MiddlewareHandler {
  const { required = false, scopes: requiredScopes = [] } = options;

  return async (c: Context, next) => {
    const authHeader = c.req.header('Authorization');
    const token = extractBearerToken(authHeader);

    // No token provided
    if (!token) {
      c.set('user', null);

      if (required) {
        return c.json({ error: 'Authentication required' }, 401);
      }

      return next();
    }

    // Verify token
    const user = await verifyToken(token);

    if (!user) {
      c.set('user', null);

      if (required) {
        return c.json({ error: 'Invalid token' }, 401);
      }

      return next();
    }

    // Check scopes
    if (!hasRequiredScopes(user.scopes, requiredScopes)) {
      return c.json(
        { error: 'Insufficient permissions', required: requiredScopes },
        403
      );
    }

    // Set user in context
    c.set('user', user);

    return next();
  };
}

/**
 * Helper to get authenticated user from context
 * Throws if user is not authenticated (use in routes with required auth)
 */
export function getAuthUser(c: Context): AuthUser {
  const user = c.get('user');
  if (!user) {
    throw new Error('User not authenticated');
  }
  return user;
}

/**
 * Helper to check if user is authenticated
 */
export function isAuthenticated(c: Context): boolean {
  return c.get('user') !== null;
}

/**
 * Helper to check if user has a specific scope
 */
export function hasScope(c: Context, scope: string): boolean {
  const user = c.get('user');
  return user?.scopes.includes(scope) || false;
}
