import type { FastifyInstance } from 'fastify';

/**
 * Let a request carry `Content-Type: application/json` and **no body**.
 *
 * Fastify's JSON parser answers a zero-length body with
 * `FST_ERR_CTP_EMPTY_JSON_BODY`, and it does so while parsing the body —
 * before routing, before the auth guard, before the DTO. So every route that
 * takes no `@Body()` (an approve or a resync button on the HO portal) would
 * answer 400 to a browser whatever the token said, because `fetch` sends that
 * header whether or not there is a body to go with it.
 *
 * Fixed on the server rather than in each client: the portal, the app and
 * anything added later would each have to remember the same rule, and a
 * body-less POST meaning `{}` is what all of them already assume.
 *
 * **Call it after `app.init()`**, which is where the Nest adapter registers
 * its own JSON parser — and only that one is replaced. Registering ours first
 * instead would make Nest skip the whole step, taking the
 * `x-www-form-urlencoded` parser with it.
 */
export function allowEmptyJsonBody(fastify: FastifyInstance): void {
  const { bodyLimit, onProtoPoisoning, onConstructorPoisoning } =
    fastify.initialConfig;

  // The adapter's parser is this same default one. Keeping it is what leaves
  // `__proto__` in a payload an error rather than an assignment.
  const parseJson = fastify.getDefaultJsonParser(
    onProtoPoisoning ?? 'error',
    onConstructorPoisoning ?? 'error',
  );

  fastify.removeContentTypeParser('application/json');
  fastify.addContentTypeParser<string>(
    'application/json',
    { parseAs: 'string', bodyLimit },
    (request, body, done) => {
      if (body.length === 0) {
        done(null, {});

        return;
      }

      // Typed as returning a promise, but it answers through `done` like any
      // other parser — there is nothing here to await.
      void parseJson(request, body, done);
    },
  );
}
