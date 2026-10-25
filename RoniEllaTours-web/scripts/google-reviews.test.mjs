import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGoogleReviewsHandler } from '../api/google-reviews.js';

const env = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'secret-fixture', GOOGLE_REFRESH_TOKEN: 'refresh-fixture', GOOGLE_BUSINESS_LOCATION: 'accounts/123/locations/456' };
async function request(handler, url = '/api/google-reviews', method = 'GET') {
  const headers = {};
  const result = { setHeader: (key, value) => { headers[key] = value; }, end: (body) => { result.body = JSON.parse(body); } };
  await handler({ method, url }, result);
  return { status: result.statusCode, body: result.body, headers };
}

test('inactive connection makes no Google requests', async () => {
  const result = await request(createGoogleReviewsHandler({ env: {}, fetchImpl: () => { throw new Error('Must not fetch'); } }));
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'NOT_CONFIGURED');
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('read-only endpoint rejects writes', async () => {
  const result = await request(createGoogleReviewsHandler({ env }), '/api/google-reviews', 'POST');
  assert.equal(result.status, 405);
  assert.equal(result.headers.Allow, 'GET');
});

test('normalizes actual Google schema, forwards pagination, never returns credentials', async () => {
  const calls = [];
  const handler = createGoogleReviewsHandler({ env, fetchImpl: async (url, options) => {
    calls.push([String(url), options]);
    return calls.length === 1
      ? Response.json({ access_token: 'access-fixture' })
      : Response.json({ reviews: [{ reviewId: 'review-1', reviewer: { displayName: 'Test reviewer' }, starRating: 'FOUR', comment: 'Unmodified review.', updateTime: '2026-09-24T10:00:00Z' }], averageRating: 4.2, totalReviewCount: 61, nextPageToken: 'page-3' });
  } });
  const result = await request(handler, '/api/google-reviews?pageToken=page%2B2');
  const url = new URL(calls[1][0]);
  assert.equal(url.searchParams.get('pageToken'), 'page+2');
  assert.equal(url.searchParams.get('pageSize'), '50');
  assert.equal(url.searchParams.get('orderBy'), 'updateTime desc');
  assert.equal(calls[1][1].headers.Authorization, 'Bearer access-fixture');
  assert.equal(result.body.reviews[0].text, 'Unmodified review.');
  assert.equal(result.body.reviews[0].rating, 4);
  assert.equal(result.body.totalReviewCount, 61);
  assert.equal(result.body.nextPageToken, 'page-3');
  assert.doesNotMatch(JSON.stringify(result), /access-fixture|secret-fixture|refresh-fixture/);
});

test('upstream errors stay generic and expose no auth details', async () => {
  const handler = createGoogleReviewsHandler({ env, fetchImpl: async () => Response.json({ error: 'secret-fixture' }, { status: 401 }) });
  assert.deepEqual((await request(handler)).body, { code: 'REVIEWS_UNAVAILABLE' });
});
