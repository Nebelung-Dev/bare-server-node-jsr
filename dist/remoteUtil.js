"use strict";
/*
 * Utilities for converting remotes to URLs
 */
function remoteToURL(remote) {
    return new URL(`${remote.protocol}${remote.host}:${remote.port}${remote.path}`);
}
function resolvePort(url) {
    if (url.port)
        return Number(url.port);
    switch (url.protocol) {
        case 'ws:':
        case 'http:':
            return 80;
        case 'wss:':
        case 'https:':
            return 443;
        default:
            // maybe blob
            return 0;
    }
}
function urlToRemote(url) {
    return {
        protocol: url.protocol,
        host: url.hostname,
        port: resolvePort(url),
        path: url.pathname + url.search,
    };
}

export { urlToRemote, resolvePort, remoteToURL };