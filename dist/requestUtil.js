"use strict";
import node_crypto_1 from "node:crypto";
import node_http_1 from "node:http";
import node_https_1 from "node:https";
import ws_1 from "ws";
import BareServer_js_1 from "./BareServer.js";
function randomHex(byteLength) {
    const bytes = new Uint8Array(byteLength);
    (0, node_crypto_1.getRandomValues)(bytes);
    let hex = '';
    for (const byte of bytes)
        hex += byte.toString(16).padStart(2, '0');
    return hex;
}
function outgoingError(error) {
    if (error instanceof Error) {
        switch (error.code) {
            case 'ENOTFOUND':
                return new BareServer_js_1.BareError(500, {
                    code: 'HOST_NOT_FOUND',
                    id: 'request',
                    message: 'The specified host could not be resolved.',
                });
            case 'ECONNREFUSED':
                return new BareServer_js_1.BareError(500, {
                    code: 'CONNECTION_REFUSED',
                    id: 'response',
                    message: 'The remote rejected the request.',
                });
            case 'ECONNRESET':
                return new BareServer_js_1.BareError(500, {
                    code: 'CONNECTION_RESET',
                    id: 'response',
                    message: 'The request was forcibly closed.',
                });
            case 'ETIMEOUT':
                return new BareServer_js_1.BareError(500, {
                    code: 'CONNECTION_TIMEOUT',
                    id: 'response',
                    message: 'The response timed out.',
                });
        }
    }
    return error;
}
async function fetch(request, signal, requestHeaders, remote, options) {
    if (options.filterRemote)
        await options.filterRemote(remote);
    const req = {
        method: request.method,
        headers: requestHeaders,
        setHost: false,
        signal,
        localAddress: options.localAddress,
        family: options.family,
        lookup: options.lookup,
    };
    let outgoing;
    // NodeJS will convert the URL into HTTP options automatically
    // see https://github.com/nodejs/node/blob/e30e71665cab94118833cc536a43750703b19633/lib/internal/url.js#L1277
    if (remote.protocol === 'https:')
        outgoing = (0, node_https_1.request)(remote, {
            ...req,
            agent: options.httpsAgent,
        });
    else if (remote.protocol === 'http:')
        outgoing = (0, node_http_1.request)(remote, {
            ...req,
            agent: options.httpAgent,
        });
    else
        throw new RangeError(`Unsupported protocol: '${remote.protocol}'`);
    request.body.pipe(outgoing);
    return await new Promise((resolve, reject) => {
        outgoing.on('response', (response) => {
            resolve(response);
        });
        outgoing.on('upgrade', (req, socket) => {
            reject('Remote did not send a response');
            socket.destroy();
        });
        outgoing.on('error', (error) => {
            reject(outgoingError(error));
        });
    });
}
async function upgradeFetch(request, signal, requestHeaders, remote, options) {
    if (options.filterRemote)
        await options.filterRemote(remote);
    const req = {
        headers: requestHeaders,
        method: request.method,
        timeout: 12e3,
        setHost: false,
        signal,
        localAddress: options.localAddress,
        family: options.family,
        lookup: options.lookup,
    };
    let outgoing;
    // NodeJS will convert the URL into HTTP options automatically
    // see https://github.com/nodejs/node/blob/e30e71665cab94118833cc536a43750703b19633/lib/internal/url.js#L1277
    // calling .replace on remote may look like it replaces other occurrences of wss:, but it only replaces the first which is remote.protocol
    if (remote.protocol === 'wss:')
        outgoing = (0, node_https_1.request)(remote.toString().replace('wss:', 'https:'), {
            ...req,
            agent: options.httpsAgent,
        });
    else if (remote.protocol === 'ws:')
        outgoing = (0, node_http_1.request)(remote.toString().replace('ws:', 'http:'), {
            ...req,
            agent: options.httpAgent,
        });
    else
        throw new RangeError(`Unsupported protocol: '${remote.protocol}'`);
    outgoing.end();
    return await new Promise((resolve, reject) => {
        outgoing.on('response', (res) => {
            reject(new Error('Remote did not upgrade the WebSocket'));
            res.destroy();
        });
        outgoing.on('upgrade', (res, socket, head) => {
            resolve([res, socket, head]);
        });
        outgoing.on('error', (error) => {
            reject(outgoingError(error));
        });
    });
}
async function webSocketFetch(request, requestHeaders, remote, protocols, options) {
    if (options.filterRemote)
        await options.filterRemote(remote);
    const req = {
        headers: requestHeaders,
        method: request.method,
        timeout: 12e3,
        setHost: false,
        localAddress: options.localAddress,
        family: options.family,
        lookup: options.lookup,
    };
    let outgoing;
    if (remote.protocol === 'wss:')
        outgoing = new ws_1.default(remote, protocols, {
            ...req,
            agent: options.httpsAgent,
        });
    else if (remote.protocol === 'ws:')
        outgoing = new ws_1.default(remote, protocols, {
            ...req,
            agent: options.httpAgent,
        });
    else
        throw new RangeError(`Unsupported protocol: '${remote.protocol}'`);
    return await new Promise((resolve, reject) => {
        let request;
        const cleanup = () => {
            outgoing.removeEventListener('open', openListener);
            outgoing.removeEventListener('open', openListener);
        };
        outgoing.on('upgrade', (req) => {
            request = req;
        });
        const openListener = () => {
            cleanup();
            resolve([request, outgoing]);
        };
        const errorListener = (event) => {
            cleanup();
            reject(outgoingError(event.error));
        };
        outgoing.addEventListener('open', openListener);
        outgoing.addEventListener('error', errorListener);
    });
}

export { webSocketFetch, upgradeFetch, fetch, randomHex };