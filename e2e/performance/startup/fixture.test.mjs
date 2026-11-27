import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture, installSyntheticTransport } from './fixture.mjs';

async function transport() {
  let handler;
  const ledger = { synthetic: [], blocked: [] };
  await installSyntheticTransport({ addInitScript: async () => {},
    route: async (_pattern, callback) => { handler = callback; }, routeWebSocket: async () => {},
  }, 'http://127.0.0.1:1234', ledger);
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
