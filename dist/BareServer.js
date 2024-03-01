"use strict";
import node_events_1 from "node:events";
import node_fs_1 from "node:fs";
import node_path_1 from "node:path";
import http_errors_1 from "http-errors";
import AbstractMessage_js_1 from "./AbstractMessage.js";
class BareError extends Error {
    status;
    body;
    constructor(status, body) {
        super(body.message || body.code);
        this.status = status;
        this.body = body;
    }
}
const pkg = JSON.parse((0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'package.json'), 'utf-8'));
const project = {
    name: 'bare-server-node',
    description: 'TOMPHTTP NodeJS Bare Server',
    repository: 'https://github.com/tomphttp/bare-server-node',
    version: pkg.version,
};
function json(status, json) {
    const send = Buffer.from(JSON.stringify(json, null, '\t'));
    return new AbstractMessage_js_1.Response(send, {
        status,
        headers: {
            'content-type': 'application/json',
            'content-length': send.byteLength.toString(),
        },
    });
}
class Server extends node_events_1.default {
    routes = new Map();
    socketRoutes = new Map();
    versions = [];
    closed = false;
    directory;
    options;
    /**
     * @internal
     */
    constructor(directory, options) {
        super();
        this.directory = directory;
        this.options = options;
    }
    /**
     * Remove all timers and listeners
     */
    close() {
        this.closed = true;
        this.emit('close');
    }
    shouldRoute(request) {
        return (!this.closed &&
            request.url !== undefined &&
            request.url.startsWith(this.directory));
    }
    get instanceInfo() {
        return {
            versions: this.versions,
            language: 'NodeJS',
            memoryUsage: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            maintainer: this.options.maintainer,
            project,
        };
    }
    async routeUpgrade(req, socket, head) {
        const request = new AbstractMessage_js_1.Request(req, {
            method: req.method,
            path: req.url,
            headers: req.headers,
        });
        const service = request.url.pathname.slice(this.directory.length - 1);
        if (this.socketRoutes.has(service)) {
            const call = this.socketRoutes.get(service);
            try {
                await call(request, socket, head, this.options);
            }
            catch (error) {
                if (this.options.logErrors) {
                    console.error(error);
                }
                socket.end();
            }
        }
        else {
            socket.end();
        }
    }
    async routeRequest(req, res) {
        const request = new AbstractMessage_js_1.Request(req, {
            method: req.method,
            path: req.url,
            headers: req.headers,
        });
        const service = request.url.pathname.slice(this.directory.length - 1);
        let response;
        try {
            if (request.method === 'OPTIONS') {
                response = new AbstractMessage_js_1.Response(undefined, { status: 200 });
            }
            else if (service === '/') {
                response = json(200, this.instanceInfo);
            }
            else if (this.routes.has(service)) {
                const call = this.routes.get(service);
                response = await call(request, res, this.options);
            }
            else {
                throw new http_errors_1.default.NotFound();
            }
        }
        catch (error) {
            if (this.options.logErrors)
                console.error(error);
            if (http_errors_1.default.isHttpError(error)) {
                response = json(error.statusCode, {
                    code: 'UNKNOWN',
                    id: `error.${error.name}`,
                    message: error.message,
                    stack: error.stack,
                });
            }
            else if (error instanceof Error) {
                response = json(500, {
                    code: 'UNKNOWN',
                    id: `error.${error.name}`,
                    message: error.message,
                    stack: error.stack,
                });
            }
            else {
                response = json(500, {
                    code: 'UNKNOWN',
                    id: 'error.Exception',
                    message: error,
                    stack: new Error(error).stack,
                });
            }
            if (!(response instanceof AbstractMessage_js_1.Response)) {
                if (this.options.logErrors) {
                    console.error('Cannot', request.method, request.url.pathname, ': Route did not return a response.');
                }
                throw new http_errors_1.default.InternalServerError();
            }
        }
        response.headers.set('x-robots-tag', 'noindex');
        response.headers.set('access-control-allow-headers', '*');
        response.headers.set('access-control-allow-origin', '*');
        response.headers.set('access-control-allow-methods', '*');
        response.headers.set('access-control-expose-headers', '*');
        // don't fetch preflight on every request...
        // instead, fetch preflight every 10 minutes
        response.headers.set('access-control-max-age', '7200');
        (0, AbstractMessage_js_1.writeResponse)(response, res);
    }
}

export { json, pkg, BareError };