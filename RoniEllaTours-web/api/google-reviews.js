// Server-only: credentials must never use Vite's VITE_ prefix.
const ratings = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export function createGoogleReviewsHandler({ env = process.env, fetchImpl = fetch } = {}) {
  return async function googleReviews(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return send(405, { code: 'METHOD_NOT_ALLOWED' }); }
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_BUSINESS_LOCATION } = env;
    if (![GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, GOOGLE_BUSINESS_LOCATION].every(Boolean)) {
      return send(503, { code: 'NOT_CONFIGURED' });
    }
    if (!/^accounts\/[\w-]+\/locations\/[\w-]+$/.test(GOOGLE_BUSINESS_LOCATION)) return send(503, { code: 'NOT_CONFIGURED' });
    const token = new URL(req.url, 'http://localhost').searchParams.get('pageToken');
    if (token?.length > 4096) return send(400, { code: 'INVALID_PAGE_TOKEN' });
    try {
      const auth = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, refresh_token: GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token' }),
        signal: AbortSignal.timeout(8000),
      });
      if (!auth.ok) throw new Error('Authorization unavailable');
      const credentials = await auth.json();
      if (!credentials.access_token) throw new Error('Missing access token');
      const url = new URL(`https://mybusiness.googleapis.com/v4/${GOOGLE_BUSINESS_LOCATION}/reviews`);
      url.searchParams.set('pageSize', '50');
      url.searchParams.set('orderBy', 'updateTime desc');
      if (token) url.searchParams.set('pageToken', token);
      const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${credentials.access_token}` }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Reviews unavailable');
      const data = await response.json();
      if (!Array.isArray(data.reviews) && data.reviews !== undefined) throw new Error('Invalid reviews');
      return send(200, {
        reviews: (data.reviews || []).map(review => ({
          id: review.reviewId,
          author: review.reviewer?.displayName || 'משתמש Google',
          rating: ratings[review.starRating] || null,
          text: review.comment || '',
          date: review.updateTime || review.createTime || null,
        })),
        averageRating: typeof data.averageRating === 'number' ? data.averageRating : null,
        totalReviewCount: data.totalReviewCount ?? 0,
        nextPageToken: data.nextPageToken || null,
      });
    } catch {
      // Do not send Google's raw auth errors or credentials to the client/logs.
      return send(502, { code: 'REVIEWS_UNAVAILABLE' });
    }
  };
}

export default createGoogleReviewsHandler();
