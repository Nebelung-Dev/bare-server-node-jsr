"use strict";
function objectFromRawHeaders(raw) {
    const result = Object.create(null);
    for (let i = 0; i < raw.length; i += 2) {
        const [header, value] = raw.slice(i, i + 2);
        if (header in result) {
            const v = result[header];
            if (Array.isArray(v))
                v.push(value);
            else
                result[header] = [v, value];
        }
        else
            result[header] = value;
    }
    return result;
}
function rawHeaderNames(raw) {
    const result = [];
    for (let i = 0; i < raw.length; i += 2) {
        if (!result.includes(raw[i]))
            result.push(raw[i]);
    }
    return result;
}
function mapHeadersFromArray(from, to) {
    for (const header of from) {
        if (header.toLowerCase() in to) {
            const value = to[header.toLowerCase()];
            delete to[header.toLowerCase()];
            to[header] = value;
        }
    }
    return to;
}
/**
 * Converts a header into an HTTP-ready comma joined header.
 */
function flattenHeader(value) {
    return Array.isArray(value) ? value.join(', ') : value;
}

export { flattenHeader, mapHeadersFromArray, rawHeaderNames, objectFromRawHeaders };