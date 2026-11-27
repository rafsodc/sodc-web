/* global localStorage, document, window, location, PerformanceObserver, URL, performance, requestAnimationFrame */
import { Buffer } from 'node:buffer';

// Invented data only. This adapter exercises the production SDK transport and
// real application UI; it does not establish authentication or server latency.
export const fixture = Object.freeze({
  uid: 'synthetic-startup-member',
  email: 'startup-member@example.invalid',
  sectionId: '11111111-1111-4111-8111-111111111111',
  eventId: '22222222-2222-4222-8222-222222222222',
  groupId: '33333333-3333-4333-8333-333333333333',
  ticketId: '44444444-4444-4444-8444-444444444444',
  sectionName: 'Synthetic events',
  eventTitle: 'Synthetic startup symposium',
  apiKey: 'bundle-measurement-public-placeholder',
  projectId: 'bundle-measurement',
});
const time = '2026-01-01T12:00:00.000Z';
export const user = { id: fixture.uid, firstName: 'Synthetic', lastName: 'Member',
  email: fixture.email, serviceNumber: 'SYNTHETIC', mobileNumber: null, postNominals: null,
  membershipStatus: 'REGULAR', requestedMembershipStatus: null, isRegular: true,
  isReserve: false, isCivilServant: false, isIndustry: false, rank: null,
  shareContactInfo: false, announcementOptOutAll: false, legacyPasswordMigrated: true,
  profileReviewedAt: '2030-01-01T00:00:00.000Z', createdAt: time, updatedAt: time };
const group = { id: fixture.groupId, name: 'Synthetic members', membershipStatuses: ['REGULAR'] };
export const section = { id: fixture.sectionId, name: fixture.sectionName, type: 'EVENTS',
  description: 'Invented local performance fixture. No live data.',
  purposeLinks: [{ purposes: ['ACCESS', 'MEMBER', 'BOOKER', 'MODERATOR'], userGroup: group }],
  createdAt: time, updatedAt: time };
export const event = { id: fixture.eventId, section: { id: fixture.sectionId },
  title: fixture.eventTitle, location: 'Synthetic venue', guestOfHonour: null, sponsors: null,
  details: '## Synthetic programme\n\nThis **invented** programme exercises the real Markdown panel.\n\n- Arrival\n- Discussion\n- Closing remarks',
  startDateTime: '2030-06-01T12:00:00.000Z', endDateTime: '2030-06-01T18:00:00.000Z',
  bookingStartDateTime: '2020-01-01T00:00:00.000Z', bookingEndDateTime: '2030-05-31T23:00:00.000Z',
  maxGuestsWithoutModeratorApproval: 2, updatedAt: time,
  ticketTypes: [{ id: fixture.ticketId, title: 'Synthetic member ticket', description: 'No purchase is made',
    audience: 'MEMBER', price: 0, includesDinner: false, includesSymposium: true, sortOrder: 0, userGroup: group }] };

export function authSeed(now = Date.now()) {
  const seconds = Math.floor(now / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  // A locally constructed, unsigned token. It is never accepted by a backend.
  const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    aud: fixture.projectId, iss: `https://securetoken.google.com/${fixture.projectId}`,
    sub: fixture.uid, user_id: fixture.uid, email: fixture.email, email_verified: true,
    auth_time: seconds, iat: seconds, exp: seconds + 86400, enabled: true, admin: true,
    securityVersion: 1, firebase: { sign_in_provider: 'password', identities: { email: [fixture.email] } },
  })}.synthetic`;
  return { uid: fixture.uid, email: fixture.email, emailVerified: true, displayName: 'Synthetic Member',
    isAnonymous: false, providerData: [{ providerId: 'password', uid: fixture.email,
      displayName: 'Synthetic Member', email: fixture.email, phoneNumber: null, photoURL: null }],
    stsTokenManager: { refreshToken: 'synthetic-refresh-not-a-credential', accessToken: token,
      expirationTime: now + 86400000 }, createdAt: String(now), lastLoginAt: String(now),
    apiKey: fixture.apiKey, appName: '[DEFAULT]' };
}

const queries = {
  GetCurrentUser: () => ({ user }),
  GetSectionsForUser: () => ({ user: { id: fixture.uid, membershipStatus: 'REGULAR',
    userGroups: [{ userGroup: { ...group, purposeLinks: [{ purposes: ['ACCESS', 'MODERATOR'], section }] } }] }, allUserGroups: [] }),
  GetUserAccessGroups: () => ({ user: { id: fixture.uid, userGroups: [{ userGroup: group }] } }),
  GetEventsForSection: () => ({ section: { id: fixture.sectionId, events: [event] } }),
  GetEventById: () => ({ event }),
  GetSectionAnnouncementOptOut: () => ({ sectionAnnouncementOptOut: null, user: { id: fixture.uid, sectionAnnouncementOptOuts: [] } }),
  GetMyAnnouncementPreferences: () => ({ user: { id: fixture.uid, announcementOptOutAll: false, sectionAnnouncementOptOuts: [] } }),
  GetMyBookingsForEvent: () => ({ user: { id: fixture.uid, bookings: [], bookingTicketOrders: [] } }),
  ListSectionTicketAccessGroups: () => ({ userGroups: [group] }),
};

/** No request.continue fallback: unknown traffic is refused, never forwarded. */
export async function installSyntheticTransport(context, localOrigin, ledger, { journey = 'member' } = {}) {
  const seed = authSeed();
  await context.addInitScript(({ seed, storageKey, fixture, journey }) => {
    localStorage.setItem(storageKey, JSON.stringify(seed));
    document.cookie = 'sodc-cookie-preferences=rejected; path=/; SameSite=Lax';
    // The observer is installed before the production entry module executes.
    window.__startupObservations = { longTasks: [], paints: [], shifts: [] };
    window.__startupReadiness = {};
    document.addEventListener('click', () => { window.__startupActionStart = performance.now(); }, true);
    let coldFirstCorrect;
    const observeCold = () => {
      const homeCorrect = journey === 'member' && location.pathname === '/' && document.querySelector('h1')?.textContent.includes('Welcome, Synthetic') &&
        document.querySelector('#account-menu-button') && [...document.querySelectorAll('h2')].some(el => el.textContent === 'Your sections') &&
        [...document.querySelectorAll('a')].some(el => el.textContent.includes(fixture.eventTitle)) && !document.querySelector('[role="progressbar"]');
      const adminCorrect = journey === 'admin' && location.pathname === `/sections/${fixture.sectionId}/manage` &&
        document.querySelector('#account-menu-button') &&
        !![...document.querySelectorAll('.page-header h4')].find(el => el.textContent === `Administer — ${fixture.sectionName}`) &&
        document.querySelector(`a[href="/sections/${fixture.sectionId}/manage/events"]`) &&
        document.querySelector(`a[href="/sections/${fixture.sectionId}/manage/files"]`) && !document.querySelector('[role="progressbar"]');
      if (!homeCorrect && !adminCorrect) coldFirstCorrect = undefined;
      else if (coldFirstCorrect !== undefined) {
        window.__startupColdReady = { firstCorrectAt: coldFirstCorrect, confirmedAt: performance.now() }; return;
      } else coldFirstCorrect = performance.now();
      requestAnimationFrame(observeCold);
    };
    requestAnimationFrame(observeCold);
    for (const [type, key] of [['longtask', 'longTasks'], ['paint', 'paints'], ['layout-shift', 'shifts']]) {
      try { new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__startupObservations[key].push({
          startTime: entry.startTime, duration: entry.duration, name: entry.name,
          value: entry.value ?? null, hadRecentInput: entry.hadRecentInput ?? null,
        });
      }).observe({ type, buffered: true }); } catch { /* Browser-supported entries only. */ }
    }
  }, { seed, fixture, journey, storageKey: `firebase:authUser:${fixture.apiKey}:[DEFAULT]` });
  const fulfill = (route, data, type = 'application/json') => route.fulfill({ status: 200,
    contentType: type, headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
    body: type === 'application/json' ? JSON.stringify(data) : data });
  await context.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === localOrigin && ['GET', 'HEAD'].includes(request.method())) {
      await route.continue(); return;
    }
    const record = { method: request.method(), origin: url.origin, path: url.pathname, operation: null };
    try {
      if (url.protocol !== 'https:' || url.port || url.username || url.password) throw new Error('unlisted-origin');
      if (url.hostname === 'www.google.com' && url.pathname === '/recaptcha/enterprise.js' && request.method() === 'GET') {
        ledger.synthetic.push({ ...record, operation: 'synthetic-recaptcha-loader' });
        await fulfill(route, 'window.grecaptcha={enterprise:{ready:function(fn){fn()},render:function(container,options){options.callback();return 0},execute:function(){return Promise.resolve("synthetic-recaptcha-no-credential")}}};', 'application/javascript'); return;
      }
      if (['firebaseappcheck.googleapis.com', 'content-firebaseappcheck.googleapis.com'].includes(url.hostname) && /:exchangeRecaptchaEnterpriseToken$/.test(url.pathname) && request.method() === 'POST') {
        ledger.synthetic.push({ ...record, operation: 'synthetic-app-check-exchange' });
        await fulfill(route, { token: 'synthetic-app-check-no-credential', ttl: '3600s' }); return;
      }
      if (url.hostname === 'identitytoolkit.googleapis.com' && url.pathname === '/v1/accounts:lookup' && request.method() === 'POST') {
        ledger.synthetic.push({ ...record, operation: 'synthetic-auth-lookup' });
        await fulfill(route, { users: [{ localId: fixture.uid, email: fixture.email, emailVerified: true,
          displayName: 'Synthetic Member', passwordUpdatedAt: 0, providerUserInfo: [{ providerId: 'password', rawId: fixture.email, email: fixture.email }],
          createdAt: seed.createdAt, lastLoginAt: seed.lastLoginAt }] }); return;
      }
      if (url.hostname === 'securetoken.googleapis.com' && url.pathname === '/v1/token' && request.method() === 'POST') {
        ledger.synthetic.push({ ...record, operation: 'synthetic-auth-refresh' });
        await fulfill(route, { access_token: seed.stsTokenManager.accessToken, id_token: seed.stsTokenManager.accessToken,
          expires_in: '86400', token_type: 'Bearer', refresh_token: seed.stsTokenManager.refreshToken,
          user_id: fixture.uid, project_id: fixture.projectId }); return;
      }
      if (url.hostname === 'firebasedataconnect.googleapis.com' && url.pathname === '/v1/projects/bundle-measurement/locations/europe-west2/services/sodc-web-service/connectors/api:executeQuery' && request.method() === 'POST') {
        const body = request.postDataJSON();
        const name = body.operationName;
        record.operation = name;
        if (!Object.hasOwn(queries, name)) throw new Error('unlisted-read-operation');
        if (['GetEventsForSection', 'GetSectionAnnouncementOptOut', 'ListSectionTicketAccessGroups'].includes(name) && body.variables?.sectionId !== fixture.sectionId) throw new Error('unexpected-fixture-id');
        if (name === 'GetEventById' && body.variables?.id !== fixture.eventId) throw new Error('unexpected-fixture-id');
        if (name === 'GetMyBookingsForEvent' && body.variables?.eventId !== fixture.eventId) throw new Error('unexpected-fixture-id');
        ledger.synthetic.push(record);
        await fulfill(route, { data: queries[name]() }); return;
      }
      if (url.hostname === 'europe-west2-bundle-measurement.cloudfunctions.net' && request.method() === 'POST') {
        const name = url.pathname.slice(1);
        const data = request.postDataJSON().data;
        record.operation = name;
        if (data.sectionId !== fixture.sectionId && !['getEventForUser'].includes(name)) throw new Error('unexpected-fixture-id');
        let result;
        if (name === 'getSectionEventsForUser') result = { events: [event] };
        else if (name === 'getEventForUser' && data.eventId === fixture.eventId) result = { event };
        else if (name === 'getSectionForUser') result = { section, hasAccess: true, canModerate: true,
          ...(data.content === 'EVENT' ? { content: { kind: 'EVENT', status: 'ready', event } }
            : data.content === 'SECTION' ? { content: { kind: 'EVENTS', status: 'ready', events: [event] } } : {}) };
        else throw new Error('unlisted-callable');
        ledger.synthetic.push(record);
        await fulfill(route, { data: result }); return;
      }
      throw new Error('unlisted-request');
    } catch (error) {
      ledger.blocked.push({ ...record, reason: error.message });
      await route.abort('blockedbyclient');
    }
  });
  await context.routeWebSocket('**/*', socket => { ledger.blocked.push({ method: 'WEBSOCKET', origin: new URL(socket.url()).origin,
    path: new URL(socket.url()).pathname, operation: null, reason: 'unlisted-websocket' }); socket.close(); });
}
