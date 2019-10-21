'use strict';

const urlArg = process.argv[2];

const dns = require('dns');
const url = require('url');
const net = require('net');
const tls = require('tls');
const hook = require('./hook');

const dnsFunctions = [
  'lookup',
  'resolve',
  'resolveAny',
  'resolve4',
  'resolve6',
  'resolveCname',
  'resolveMx',
  'resolveNs',
  'resolveTxt',
  'resolveSrv',
  'resolvePtr',
  'resolveNaptr'
];

for (const fnName of dnsFunctions) {
  dns[fnName] = hook.wrapAsync(`dns.${fnName}`, dns[fnName]);
}

const { MongoClient } = require('./index');

if (!urlArg) {
  console.log(`
  Usage:
      node repro.js <url>
  `);
  process.exit(1);
}

const URL = new url.URL(urlArg);
const { hostname, port } = URL;

function execP(fn) {
  return new Promise(resolve => {
    fn((err, result) => {
      resolve({ err, result });
    });
  });
}

function fallback(fns) {
  fns = [].concat(fns);
  return function _fallback(callback) {
    const fn = fns.shift();

    fn((err, result) => {
      if (fns.length === 0 || !err) return callback(err, result);
      _fallback(callback);
    });
  };
}

const lookup0 = callback => dns.lookup(hostname, 0, callback);
const lookup4 = callback => dns.lookup(hostname, 4, callback);
const lookup6 = callback => dns.lookup(hostname, 6, callback);
const resolve0 = callback => dns.resolve(hostname, callback);
const resolve4 = callback => dns.resolve4(hostname, callback);
const resolve6 = callback => dns.resolve6(hostname, callback);

function runConnect(options, callback) {
  const netOptions = {
    family: options.family,
    host: options.hostname,
    port: options.port
  };
  const socket = net.createConnection(netOptions);

  socket.once('connect', () => {
    socket.end(() => callback(null, 'success'));
  });
  socket.once('error', err => callback(err));
  socket.once('timeout', () => callback(new Error('Experienced Timeout')));
}

const connect0 = callback => runConnect({ port: port || 27017, hostname, family: 0 }, callback);
const connect4 = callback => runConnect({ port: port || 27017, hostname, family: 4 }, callback);
const connect6 = callback => runConnect({ port: port || 27017, hostname, family: 6 }, callback);

function runTLS(options, callback) {
  const tlsOptions = {
    family: options.family,
    host: options.hostname,
    port: options.port
  };
  const socket = tls.connect(tlsOptions);

  socket.once('connect', () => {
    socket.end(() => callback(null, 'success'));
  });
  socket.once('error', err => callback(err));
  socket.once('timeout', () => callback(new Error('Experienced Timeout')));
}

const tls0 = callback => runTLS({ port: port || 27017, hostname, family: 0 }, callback);
const tls4 = callback => runTLS({ port: port || 27017, hostname, family: 4 }, callback);
const tls6 = callback => runTLS({ port: port || 27017, hostname, family: 6 }, callback);

async function connectToDB(args = {}) {
  let err, result;
  try {
    const client = new MongoClient(
      urlArg,
      Object.assign({ useNewUrlParser: true, serverSelectionTimeoutMS: 5000 }, args)
    );

    await client.connect();
    await client.close();
    result = 'success';
  } catch (e) {
    err = e;
    result = 'error';
  }

  return { result, err };
}

const dbOldTopologyFamily0 = async () => connectToDB({ useUnifiedTopology: false, family: 0 });
const dbOldTopologyFamily4 = async () => connectToDB({ useUnifiedTopology: false, family: 4 });
const dbOldTopologyFamily6 = async () => connectToDB({ useUnifiedTopology: false, family: 6 });
const dbOldTopologyFamilyN = async () => connectToDB({ useUnifiedTopology: false });
const dbNewTopologyFamily0 = async () => connectToDB({ useUnifiedTopology: true, family: 0 });
const dbNewTopologyFamily4 = async () => connectToDB({ useUnifiedTopology: true, family: 4 });
const dbNewTopologyFamily6 = async () => connectToDB({ useUnifiedTopology: true, family: 6 });
const dbNewTopologyFamilyN = async () => connectToDB({ useUnifiedTopology: true });

const cases = new Set([
//   {
//     name: 'lookup()',
//     fn: lookup0
//   },
  {
    name: 'lookup(4)',
    fn: lookup4
  },
  {
    name: 'lookup(6)',
    fn: lookup6
  },
  {
    name: 'lookup(6) -> lookup(4)',
    fn: fallback([lookup6, lookup4])
  },
//   {
//     name: 'lookup(6) -> lookup(0)',
//     fn: fallback([lookup6, lookup0])
//   },
//   {
//     name: 'lookup(6) -> lookup(4) -> lookup(0)',
//     fn: fallback([lookup6, lookup4, lookup0])
//   },
//   {
//     name: 'resolve',
//     fn: resolve0
//   },
//   {
//     name: 'resolve4',
//     fn: resolve4
//   },
//   {
//     name: 'resolve6',
//     fn: resolve6
//   },
//   {
//     name: 'resolve6 -> resolve4',
//     fn: fallback([resolve6, resolve4])
//   },
//   {
//     name: 'resolve6 -> resolve',
//     fn: fallback([resolve6, resolve0])
//   },
//   {
//     name: 'resolve6 -> resolve4 -> resolve',
//     fn: fallback([resolve6, resolve4, resolve0])
//   },
//   {
//     name: 'net.createConnection(0)',
//     fn: connect0
//   },
//   {
//     name: 'net.createConnection(4)',
//     fn: connect4
//   },
//   {
//     name: 'net.createConnection(6)',
//     fn: connect6
//   },
//   {
//     name: 'net.createConnection(6) -> net.createConnection(4)',
//     fn: fallback([connect6, connect4])
//   },
//   {
//     name: 'net.createConnection(6) -> net.createConnection(0)',
//     fn: fallback([connect6, connect0])
//   },
//   {
//     name: 'net.createConnection(6) -> net.createConnection(4) -> net.createConnection(0)',
//     fn: fallback([connect6, connect4, connect0])
//   },
//   {
//     name: 'tls.connect(0)',
//     fn: tls0
//   },
//   {
//     name: 'tls.connect(4)',
//     fn: tls4
//   },
//   {
//     name: 'tls.connect(6)',
//     fn: tls6
//   },
//   {
//     name: 'tls.connect(6) -> tls.connect(4)',
//     fn: fallback([tls6, tls4])
//   },
//   {
//     name: 'tls.connect(6) -> tls.connect(0)',
//     fn: fallback([tls6, tls0])
//   },
//   {
//     name: 'tls.connect(6) -> tls.connect(4) -> tls.connect(0)',
//     fn: fallback([tls6, tls4, tls0])
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: false, family: 0 })',
//     promisified: true,
//     fn: dbOldTopologyFamily0
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: false, family: 4 })',
//     promisified: true,
//     fn: dbOldTopologyFamily4
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: false, family: 6 })',
//     promisified: true,
//     fn: dbOldTopologyFamily6
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: false })',
//     promisified: true,
//     fn: dbOldTopologyFamilyN
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: true, family: 0 })',
//     promisified: true,
//     fn: dbNewTopologyFamily0
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: true, family: 4 })',
//     promisified: true,
//     fn: dbNewTopologyFamily4
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: true, family: 6 })',
//     promisified: true,
//     fn: dbNewTopologyFamily6
//   },
//   {
//     name: 'client.connect({ useUnifiedTopology: true })',
//     promisified: true,
//     fn: dbNewTopologyFamilyN
//   }
]);

async function run() {
  const tests = [];

  for (const { name, fn, promisified } of cases) {
    hook.clear();
    const result = Object.assign({ name }, await (promisified ? fn() : execP(fn)));
    result.hooks = hook.getValues();
    tests.push(result);
  }

  const final = {
    version: 2,
    url: URL,
    tests
  };

  console.log(JSON.stringify(final, null, 2));
}

run().catch(console.dir);
