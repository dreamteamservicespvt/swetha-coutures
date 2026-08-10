/**
 * Fingerprint device simulator.
 *
 * Pretends to be a ZKTeco K40 Pro and drives the real request handler, so the whole path —
 * routing, raw logging, parsing, dedup, folding into day records — is proven before anyone
 * touches the hardware or deploys anything.
 *
 * No Firebase project and no credentials needed: it runs against the in-memory store, which
 * implements the same interface as the Firestore one.
 *
 *   npm run test:device
 *
 * Exits non-zero if anything fails, so it can gate a deploy.
 */
import http from 'node:http';
import {
  COLLECTIONS,
  createMemoryStore,
  decodeBody,
  defaultConfig,
  handleDeviceRequest,
} from '../api/_deviceIngest.ts';

const KNOWN_SN = 'BOCK200961014';
const STRANGER_SN = 'HACKER000000001';

/* --------------------------------------------------------------- tiny test kit */

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const section = (title: string) => console.log(`\n\x1b[1m${title}\x1b[0m`);

/* ------------------------------------------------------------------- the device */

const store = createMemoryStore();
const config = defaultConfig({ RAW_LOG_MODE: 'all', DEVICE_TZ_OFFSET: '+05:30' });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://device.local');
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const bodyBuffer = Buffer.concat(chunks);

  const result = await handleDeviceRequest(
    {
      method: (req.method || 'GET').toUpperCase(),
      path: url.pathname,
      query,
      body: decodeBody(bodyBuffer),
      bodyBytes: bodyBuffer.length,
      headers: { 'user-agent': String(req.headers['user-agent'] || '') },
      remoteAddress: '192.168.1.50',
    },
    store,
    config
  );

  res.statusCode = result.status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(result.body);
});

/** Speaks to the server the way the terminal's firmware does. */
function makeDevice(baseUrl: string, serialNumber: string) {
  const call = async (
    path: string,
    { method = 'GET', query = {}, body = '' }: { method?: string; query?: Record<string, string>; body?: string } = {}
  ) => {
    const url = new URL(path, baseUrl);
    url.searchParams.set('SN', serialNumber);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'iClock Proxy/1.09' },
      body: method === 'GET' ? undefined : body,
    });
    return { status: response.status, body: await response.text() };
  };

  return {
    handshake: () => call('/iclock/cdata', { query: { options: 'all', pushver: '2.4.1' } }),
    upload: (table: string, body: string) =>
      call('/iclock/cdata', { method: 'POST', query: { table, Stamp: '9999' }, body }),
    poll: () => call('/iclock/getrequest'),
    test: () => call('/iclock/test'),
  };
}

/** Builds a tab-separated ATTLOG body: pin, time, state, verify, workcode, r1, r2. */
const attlog = (punches: [string, string, string?, string?][]) =>
  punches
    .map(([pin, time, state = '0', verify = '1']) => [pin, time, state, verify, '', '0', '0'].join('\t'))
    .join('\r\n') + '\r\n';

/* ------------------------------------------------------------------------ main */

await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const device = makeDevice(baseUrl, KNOWN_SN);

try {
  /* ------------------------------------------------------------ 1. handshake */
  section('1. Registration handshake');
  {
    const response = await device.handshake();
    check('responds 200', response.status === 200, `got ${response.status}`);
    check(
      'returns a GET OPTION block naming the device',
      response.body.startsWith(`GET OPTION FROM: ${KNOWN_SN}`),
      JSON.stringify(response.body.slice(0, 60))
    );
    check('asks for realtime delivery', response.body.includes('Realtime=1'));
    check('sends the device timezone as decimal hours', response.body.includes('TimeZone=5.5'));

    const saved = await store.get(COLLECTIONS.devices, KNOWN_SN);
    check('device registered on first contact', !!saved);
    check('unknown serial is quarantined, not trusted', saved?.status === 'pending', String(saved?.status));
    check('heartbeat recorded', !!saved?.lastSeenAt);
  }

  /* --------------------------------------------- 2. punches while unapproved */
  section('2. Punches from an unapproved device are kept but not counted');
  {
    await device.upload('ATTLOG', attlog([['9001', '2026-08-08 08:00:00']]));
    const punches = store.dump(COLLECTIONS.punches);
    check('punch stored as evidence', punches.length === 1, `${punches.length} stored`);
    check('and flagged as parked', punches[0]?.parked === true);
    check('no attendance record reaches payroll', store.dump(COLLECTIONS.records).length === 0);
    check('no employee auto-created', store.dump(COLLECTIONS.employees).length === 0);
  }

  // The admin approves the device on the Attendance page.
  await store.set(COLLECTIONS.devices, KNOWN_SN, { status: 'approved' });

  /* -------------------------------------------------------- 3. a normal batch */
  section('3. A normal ATTLOG batch');
  {
    const response = await device.upload(
      'ATTLOG',
      attlog([
        ['1001', '2026-08-08 09:14:22'],
        ['1002', '2026-08-08 09:15:03'],
        ['1001', '2026-08-08 13:02:10', '1'],
        ['1001', '2026-08-08 14:05:41', '0'],
        ['1001', '2026-08-08 18:30:00', '1'],
      ])
    );

    check('responds with exactly "OK"', response.body === 'OK', JSON.stringify(response.body));
    check('all punches stored', store.dump(COLLECTIONS.punches).length === 6);

    const one = store.dump(COLLECTIONS.punches).find((p) => p.punchTimeLocal === '2026-08-08 09:14:22');
    check('raw device string kept verbatim', one?.punchTimeRaw === '2026-08-08 09:14:22');
    check(
      'IST converted to the right UTC instant',
      one?.punchTimeUtc === '2026-08-08T03:44:22.000Z',
      String(one?.punchTimeUtc)
    );
    check('punch state labelled', one?.punchStateLabel === 'Check in', String(one?.punchStateLabel));

    const employees = store.dump(COLLECTIONS.employees);
    check('unseen PINs became employees', employees.length === 2, `${employees.length}`);
    check(
      'new employees need pay setup before payroll counts them',
      employees.every((e) => e.salaryMode === null && e.salaryAmount === 0)
    );

    const day = await store.get(COLLECTIONS.records, '1001_2026-08-08');
    check('day record created', !!day);
    check('check-in is the earliest punch', day?.checkIn === '09:14', String(day?.checkIn));
    check(
      'check-out is the latest punch, not the first "out"',
      day?.checkOut === '18:30',
      `${day?.checkOut} — a lunch break must not end the day`
    );
    check('hours computed across the whole day', day?.hoursWorked === 9.27, String(day?.hoursWorked));
    check('every punch kept for audit', (day?.punches as string[])?.length === 4);
    check('status is present', day?.status === 'present');
  }

  /* ----------------------------------------------------- 4. duplicate batch */
  section('4. The identical batch replayed (device retry)');
  {
    const before = {
      punches: store.dump(COLLECTIONS.punches).length,
      records: store.dump(COLLECTIONS.records).length,
      employees: store.dump(COLLECTIONS.employees).length,
    };

    const response = await device.upload(
      'ATTLOG',
      attlog([
        ['1001', '2026-08-08 09:14:22'],
        ['1002', '2026-08-08 09:15:03'],
        ['1001', '2026-08-08 13:02:10', '1'],
        ['1001', '2026-08-08 14:05:41', '0'],
        ['1001', '2026-08-08 18:30:00', '1'],
      ])
    );

    check('still responds "OK"', response.body === 'OK');
    check('no duplicate punches', store.dump(COLLECTIONS.punches).length === before.punches);
    check('no duplicate day records', store.dump(COLLECTIONS.records).length === before.records);
    check('no duplicate employees', store.dump(COLLECTIONS.employees).length === before.employees);

    const day = await store.get(COLLECTIONS.records, '1001_2026-08-08');
    check('the day record is unchanged', day?.checkIn === '09:14' && day?.checkOut === '18:30');
  }

  /* ------------------------------------------ 5. an admin edit is protected */
  section('5. A hand-corrected record survives the next upload');
  {
    await store.set(COLLECTIONS.records, '1002_2026-08-08', {
      checkIn: '09:00',
      checkOut: '17:00',
      manuallyEdited: true,
    });

    await device.upload('ATTLOG', attlog([['1002', '2026-08-08 19:45:00', '1']]));

    const day = await store.get(COLLECTIONS.records, '1002_2026-08-08');
    check("admin's check-in kept", day?.checkIn === '09:00', String(day?.checkIn));
    check("admin's check-out kept", day?.checkOut === '17:00', String(day?.checkOut));
    check(
      'but the new punch is still on the audit trail',
      (day?.punches as string[])?.includes('19:45'),
      JSON.stringify(day?.punches)
    );
  }

  /* --------------------------------------------------- 6. malformed bodies */
  section('6. Malformed and hostile bodies');
  {
    const cases: [string, string][] = [
      ['garbage text', 'this is not attendance data at all'],
      ['empty body', ''],
      ['half a row', '1001\t'],
      ['impossible date', '1001\t2026-02-31 09:00:00\t0\t1\t\t0\t0'],
      ['impossible time', '1001\t2026-08-08 99:99:99\t0\t1\t\t0\t0'],
      ['no pin', '\t2026-08-08 09:00:00\t0\t1\t\t0\t0'],
      ['binary noise', '\x00\x01\x02\xff\xfe'],
    ];

    const before = store.dump(COLLECTIONS.punches).length;
    let allOk = true;

    for (const [label, body] of cases) {
      const response = await device.upload('ATTLOG', body);
      if (response.status !== 200 || response.body !== 'OK') {
        allOk = false;
        check(`"${label}" answered OK`, false, `${response.status} ${JSON.stringify(response.body)}`);
      }
    }

    if (allOk) check('every malformed body still answered "OK" (no retry storm)', true);
    check('nothing bogus was stored', store.dump(COLLECTIONS.punches).length === before);

    // A good row alongside a bad one must still land — failing the batch would make the
    // device replay it forever and block every punch behind it.
    await device.upload(
      'ATTLOG',
      ['1001\tNOT-A-DATE\t0\t1\t\t0\t0', '1003\t2026-08-09 10:00:00\t0\t1\t\t0\t0'].join('\n')
    );
    check('a good row is kept even when the batch has a bad one', !!(await store.get(COLLECTIONS.records, '1003_2026-08-09')));

    /**
     * Space-separated rows. The timestamp itself contains a space, so a naive whitespace
     * split tears the date from the time and drops a real punch silently — which is
     * exactly what this parser did until 2026-08-08.
     */
    await device.upload('ATTLOG', '1004 2026-08-09 11:30:00 0 1\n');
    const spaced = await store.get(COLLECTIONS.records, '1004_2026-08-09');
    check('space-separated rows are parsed, not dropped', !!spaced);
    check('with the timestamp kept intact', spaced?.checkIn === '11:30', String(spaced?.checkIn));
  }

  /* --------------------------------------------------- 7. unknown serial */
  section('7. A stranger finds the endpoint');
  {
    const stranger = makeDevice(baseUrl, STRANGER_SN);

    check('handshake answered (never left in a retry loop)', (await stranger.handshake()).status === 200);
    check('upload answered "OK"', (await stranger.upload('ATTLOG', attlog([['1001', '2026-08-08 03:00:00']]))).body === 'OK');

    const saved = await store.get(COLLECTIONS.devices, STRANGER_SN);
    check('the stranger is quarantined as pending', saved?.status === 'pending', String(saved?.status));

    const day = await store.get(COLLECTIONS.records, '1001_2026-08-08');
    check("cannot touch a real employee's attendance", day?.checkIn === '09:14', `check-in became ${day?.checkIn}`);

    await store.set(COLLECTIONS.devices, STRANGER_SN, { status: 'blocked' });
    const beforeBlocked = store.dump(COLLECTIONS.punches).length;
    await stranger.upload('ATTLOG', attlog([['1001', '2026-08-08 04:00:00']]));
    check('a blocked device stores nothing at all', store.dump(COLLECTIONS.punches).length === beforeBlocked);
  }

  /* ---------------------------------------------------- 8. command polls */
  section('8. Command polling and connection test');
  {
    const poll = await device.poll();
    check('getrequest returns exactly "OK" when nothing is queued', poll.body === 'OK', JSON.stringify(poll.body));
    const test = await device.test();
    check('the connection test passes', test.status === 200 && test.body === 'OK');
  }

  /* ------------------------------------------------------ 9. user names */
  section('9. USERINFO fills in employee names');
  {
    await device.upload(
      'USERINFO',
      'PIN=1001\tName=Asha Rani\tPri=0\tPasswd=\tCard=\tGrp=1\nPIN=1002\tName=Meena K\tPri=0\n'
    );
    check('name applied from the device', (await store.get(COLLECTIONS.employees, '1001'))?.name === 'Asha Rani');

    // An admin's spelling must win over whatever was typed on the terminal keypad.
    await store.set(COLLECTIONS.employees, '1002', { name: 'Meena Kumari' });
    await device.upload('USERINFO', 'PIN=1002\tName=Meena K\tPri=0\n');
    check("an admin's name is not overwritten", (await store.get(COLLECTIONS.employees, '1002'))?.name === 'Meena Kumari');
  }

  /* --------------------------------------------------- 10. raw logging */
  section('10. Raw request log');
  {
    const logs = store.dump(COLLECTIONS.rawLogs);
    check('requests were logged', logs.length > 0, `${logs.length} entries`);

    const garbage = logs.find((entry) => entry.body === 'this is not attendance data at all');
    check('the exact malformed body is recoverable', !!garbage);
    check('with its method and path', garbage?.method === 'POST' && garbage?.path === '/iclock/cdata');
    check('and the serial that sent it', String(garbage?.query).includes(`SN=${KNOWN_SN}`));
    check('credentials are not among the stored headers', !('authorization' in ((garbage?.headers as object) || {})));
    check('logs carry an expiry for the TTL policy', !!garbage?.expiresAt);
  }

  /* -------------------------------------------------- 11. serial allowlist */
  section('11. DEVICE_SERIALS allowlist');
  {
    const locked = defaultConfig({ DEVICE_SERIALS: `${KNOWN_SN}, OTHER` });
    const before = store.dump(COLLECTIONS.punches).length;

    const result = await handleDeviceRequest(
      {
        method: 'POST',
        path: '/iclock/cdata',
        query: { SN: 'NOT_ON_THE_LIST', table: 'ATTLOG' },
        body: '1001\t2026-08-10 09:00:00\t0\t1\n',
        bodyBytes: 30,
        headers: {},
        remoteAddress: '10.0.0.9',
      },
      store,
      locked
    );

    check('unlisted serial answered "OK"', result.body === 'OK');
    check('and stored nothing', store.dump(COLLECTIONS.punches).length === before);
  }
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log(`\n${'─'.repeat(60)}`);
if (failures.length === 0) {
  console.log(`\x1b[32m✓ All ${passed} checks passed.\x1b[0m The device endpoint is behaving correctly.`);
  process.exit(0);
} else {
  console.log(`\x1b[31m✗ ${failures.length} of ${passed + failures.length} checks FAILED:\x1b[0m\n`);
  for (const failure of failures) console.log(`  • ${failure}`);
  process.exit(1);
}
