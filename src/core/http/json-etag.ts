import { createHash } from 'node:crypto';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Only the API's own reads; Swagger UI (`/docs`) and Socket.IO sit outside. */
export const JSON_ETAG_PREFIX = '/api/v2';

/**
 * Revalidate on every use, never share. A portal poll still reaches the server,
 * but an unchanged answer comes back as an empty 304 instead of the whole
 * book; `private` keeps one account's rows out of any shared proxy.
 */
export const JSON_CACHE_CONTROL = 'private, no-cache';

/**
 * **An ETag on every successful `GET` JSON answer under `/api/v2`**, and a
 * `304` with no body when the client already holds it.
 *
 * The tag is a strong hash of the JSON exactly as serialised — before
 * `@fastify/compress`, whose per-route `onSend` runs after this root hook — so
 * a gzip and a plain answer of the same rows carry the same tag. Comparison is
 * the weak one RFC 9110 prescribes for `If-None-Match`, so a proxy that
 * weakened the tag to `W/"…"` still matches.
 *
 * It never changes a body it sends: it adds headers, or turns the reply into
 * an empty 304. Writes, errors, non-JSON answers and anything outside the
 * prefix pass through untouched.
 */
export function registerJsonEtag(fastify: FastifyInstance): void {
  fastify.addHook('onSend', (request, reply, payload: unknown, done) => {
    if (!isTaggable(request, reply, payload)) {
      done(null, payload);

      return;
    }

    const etag = `"${createHash('sha1').update(payload).digest('base64url')}"`;

    reply.header('ETag', etag);
    if (!reply.hasHeader('Cache-Control')) {
      reply.header('Cache-Control', JSON_CACHE_CONTROL);
    }

    if (matches(request.headers['if-none-match'], etag)) {
      reply.code(304);
      reply.removeHeader('Content-Type');
      reply.removeHeader('Content-Length');
      done(null, '');

      return;
    }

    done(null, payload);
  });
}

function isTaggable(
  request: FastifyRequest,
  reply: FastifyReply,
  payload: unknown,
): payload is string | Buffer {
  if (request.method !== 'GET' || reply.statusCode !== 200) return false;
  if (reply.hasHeader('ETag')) return false;

  const path = request.url.split('?', 1)[0];

  if (path !== JSON_ETAG_PREFIX && !path.startsWith(`${JSON_ETAG_PREFIX}/`)) {
    return false;
  }

  const type = reply.getHeader('Content-Type');

  if (typeof type !== 'string' || !type.startsWith('application/json')) {
    return false;
  }

  return typeof payload === 'string' || Buffer.isBuffer(payload);
}

/** RFC 9110 §13.1.2: weak comparison, any tag in the list, or `*`. */
function matches(header: string | undefined, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === '*') return true;

  return header
    .split(',')
    .map((tag) => tag.trim().replace(/^W\//, ''))
    .includes(etag);
}
