"use strict";
import node_dns_1 from "node:dns";
import node_http_1 from "node:http";
import node_https_1 from "node:https";
import ipaddr_js_1 from "ipaddr.js";
import ws_1 from "ws";
import BareServer_js_1 from "./BareServer.js";
import Meta_js_1 from "./Meta.js";
import V1_js_1 from "./V1.js";
import V2_js_1 from "./V2.js";
import V3_js_1 from "./V3.js";
const validIPFamily = [0, 4, 6];
/**
 * Converts the address and family of a DNS lookup callback into an array if it wasn't already
 */
function toAddressArray(address, family) {
    if (typeof address === 'string')
        return [
            {
                address,
                family,
            },
        ];
    else
        return address;
}
/**
 * Create a Bare server.
 * This will handle all lifecycles for unspecified options (httpAgent, httpsAgent, metaMap).
 */
function createBareServer(directory, init = {}) {
    if (typeof directory !== 'string')
        throw new Error('Directory must be specified.');
    if (!directory.startsWith('/') || !directory.endsWith('/'))
        throw new RangeError('Directory must start and end with /');
    init.logErrors ??= false;
    const cleanup = [];
    if (typeof init.family === 'number' && !validIPFamily.includes(init.family))
        throw new RangeError('init.family must be one of: 0, 4, 6');
    if (init.blockLocal ?? true) {
        init.filterRemote ??= (url) => {
            // if the remote is an IP then it didn't go through the init.lookup hook
            // isValid determines if this is so
            if ((0, ipaddr_js_1.isValid)(url.hostname) && (0, ipaddr_js_1.parse)(url.hostname).range() !== 'unicast')
                throw new RangeError('Forbidden IP');
        };
        init.lookup ??= (hostname, options, callback) => (0, node_dns_1.lookup)(hostname, options, (err, address, family) => {
            if (address &&
                toAddressArray(address, family).some(({ address }) => (0, ipaddr_js_1.parse)(address).range() !== 'unicast'))
                callback(new RangeError('Forbidden IP'), '', -1);
            else
                callback(err, address, family);
        });
    }
    if (!init.httpAgent) {
        const httpAgent = new node_http_1.Agent({
            keepAlive: true,
        });
        init.httpAgent = httpAgent;
        cleanup.push(() => httpAgent.destroy());
    }
    if (!init.httpsAgent) {
        const httpsAgent = new node_https_1.Agent({
            keepAlive: true,
        });
        init.httpsAgent = httpsAgent;
        cleanup.push(() => httpsAgent.destroy());
    }
    if (!init.database) {
        const database = new Map();
        const interval = setInterval(() => (0, Meta_js_1.cleanupDatabase)(database), 1000);
        init.database = database;
        cleanup.push(() => clearInterval(interval));
    }
    const server = new BareServer_js_1.default(directory, {
        ...init,
        database: new Meta_js_1.JSONDatabaseAdapter(init.database),
        wss: new ws_1.WebSocketServer({ noServer: true }),
    });
    init.legacySupport ??= true;
    if (init.legacySupport) {
        (0, V1_js_1.default)(server);
        (0, V2_js_1.default)(server);
    }
    (0, V3_js_1.default)(server);
    server.once('close', () => {
        for (const cb of cleanup)
            cb();
    });
    return server;
}
export { createBareServer, toAddressArray, validIPFamily };