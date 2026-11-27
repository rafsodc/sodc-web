import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { authSeed, fixture, installSyntheticTransport } from './fixture.mjs';

async function transport(options) {
  let handler;
  const ledger = { synthetic: [], blocked: [] };
  await installSyntheticTransport({ addInitScript: async () => {},
    route: async (_pattern, callback) => { handler = callback; }, routeWebSocket: async () => {},
  }, 'http://127.0.0.1:1234', ledger, options);
  return async (url, method = 'POST', data = {}) => {
    const result = { forwarded: 0, fulfilled: 0, aborted: 0 };
    await handler({ request: () => ({ url: () => url, method: () => method, postDataJSON: () => data }),
      continue: async () => { result.forwarded++; }, fulfill: async () => { result.fulfilled++; },
      abort: async () => { result.aborted++; } });
    return { ...result, ledger };
  };
}
const queryUrl = 'https://firebasedataconnect.googleapis.com/v1/projects/bundle-measurement/locations/europe-west2/services/sodc-web-service/connectors/api:executeQuery';
test('named synthetic SDK query is fulfilled without forwarding', async () => {
  const result = await (await transport())(queryUrl, 'POST', { operationName: 'GetCurrentUser' });
  assert.equal(result.fulfilled, 1); assert.equal(result.forwarded, 0); assert.equal(result.aborted, 0);
});
for (const [name, url, method, data] of [
  ['SDK mutation', queryUrl.replace(':executeQuery', ':executeMutation'), 'POST', { operationName: 'UpdateEvent' }],
  ['unknown query', queryUrl, 'POST', { operationName: 'UnknownRead' }],
  ['wrong fixture identifier', queryUrl, 'POST', { operationName: 'GetEventById', variables: { id: fixture.sectionId } }],
  ['real project read', queryUrl.replace('bundle-measurement', 'sodc-web-production'), 'POST', { operationName: 'GetCurrentUser' }],
  ['unknown callable', 'https://europe-west2-bundle-measurement.cloudfunctions.net/submitEventBooking', 'POST', { data: { sectionId: fixture.sectionId } }],
  ['lookalike host', queryUrl.replace('.googleapis.com', '.googleapis.com.invalid'), 'POST', { operationName: 'GetCurrentUser' }],
  ['nonstandard port', queryUrl.replace('.googleapis.com', '.googleapis.com:444'), 'POST', { operationName: 'GetCurrentUser' }],
  ['loopback write', 'http://127.0.0.1:1234/any', 'POST', {}],
]) test(`${name} is blocked without forwarding or fulfillment`, async () => {
  const result = await (await transport())(url, method, data);
  assert.equal(result.forwarded, 0); assert.equal(result.fulfilled, 0); assert.equal(result.aborted, 1);
  assert.equal(result.ledger.blocked.length, 1);
});
test('only loopback GET assets may be forwarded', async () => {
  const result = await (await transport())('http://127.0.0.1:1234/assets/local.js', 'GET');
  assert.equal(result.forwarded, 1); assert.equal(result.fulfilled, 0); assert.equal(result.aborted, 0);
});

test('a signed-out journey refuses private SDK reads and Auth lookups', async () => {
  const request = await transport({ journey: 'public' });
  for (const [url, data] of [[queryUrl, { operationName: 'GetCurrentUser' }],
    ['https://identitytoolkit.googleapis.com/v1/accounts:lookup', {}]]) {
    const result = await request(url, 'POST', data);
    assert.equal(result.forwarded, 0); assert.equal(result.fulfilled, 0); assert.equal(result.aborted, 1);
  }
});

const guestUrl = 'https://europe-west2-bundle-measurement.cloudfunctions.net/getOrganiserGuestTicket';
test('the exact invented guest capability read is fulfilled locally', async () => {
  const result = await (await transport({ journey: 'guest' }))(guestUrl, 'POST', { data: { token: fixture.guestToken } });
  assert.equal(result.forwarded, 0); assert.equal(result.fulfilled, 1); assert.equal(result.aborted, 0);
});

for (const [name, url, data] of [
  ['wrong guest capability', guestUrl, { token: 'unlisted-synthetic-capability' }],
  ['guest payload with extra fields', guestUrl, { token: fixture.guestToken, extra: true }],
  ['guest dietary mutation', guestUrl.replace('getOrganiserGuestTicket', 'updateOrganiserGuestDietary'), { token: fixture.guestToken }],
  ['guest checkout mutation', guestUrl.replace('getOrganiserGuestTicket', 'createOrganiserGuestCheckout'), { token: fixture.guestToken }],
]) test(`${name} is refused without forwarding`, async () => {
  const result = await (await transport({ journey: 'guest' }))(url, 'POST', { data });
  assert.equal(result.forwarded, 0); assert.equal(result.fulfilled, 0); assert.equal(result.aborted, 1);
});

test('the recovery profile uses only its fixed inert Auth identity', () => {
  const seed = authSeed(1790000000000, 'recovery');
  const claims = JSON.parse(Buffer.from(seed.stsTokenManager.accessToken.split('.')[1], 'base64url').toString());
  assert.equal(seed.apiKey, 'demo-deployment-recovery');
  assert.equal(claims.aud, 'demo-sodc-deployment-recovery');
  assert.equal(claims.iss, 'https://securetoken.google.com/demo-sodc-deployment-recovery');
});

test('the recovery profile fulfills only its exact inert Data Connect project', async () => {
  const request = await transport({ deployment: 'recovery' });
  const result = await request(queryUrl.replace('bundle-measurement', 'demo-sodc-deployment-recovery'), 'POST', { operationName: 'GetCurrentUser' });
  assert.equal(result.forwarded, 0); assert.equal(result.fulfilled, 1); assert.equal(result.aborted, 0);
  for (const project of ['bundle-measurement', 'sodc-web-production']) {
    const rejected = await request(queryUrl.replace('bundle-measurement', project), 'POST', { operationName: 'GetCurrentUser' });
    assert.equal(rejected.forwarded, 0); assert.equal(rejected.fulfilled, 0); assert.equal(rejected.aborted, 1);
  }
});

test('an unlisted deployment is rejected before any browser context setup', async () => {
  let initialized = false;
  await assert.rejects(installSyntheticTransport({ addInitScript: async () => { initialized = true; } },
    'http://127.0.0.1:1234', { synthetic: [], blocked: [] }, { deployment: 'sodc-web-production' }), /unlisted-synthetic-deployment/);
  assert.equal(initialized, false);
});
