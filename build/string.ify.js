"use strict";

function _objectValues(obj) {
    var values = [];
    var keys = Object.keys(obj);

    for (var k = 0; k < keys.length; ++k) values.push(obj[keys[k]]);

    return values;
}

function _objectEntries(obj) {
    var entries = [];
    var keys = Object.keys(obj);

    for (var k = 0; k < keys.length; ++k) entries.push([keys[k], obj[keys[k]]]);

    return entries;
}

const bullet = require('string.bullet'),
      isBrowser = typeof window !== 'undefined' && window.window === window && window.navigator,
      isURL = x => typeof URL !== 'undefined' && x instanceof URL,
      maxOf = (arr, pick) => arr.reduce((max, s) => Math.max(max, pick ? pick(s) : s), 0),
      isInteger = Number.isInteger || (value => typeof value === 'number' && isFinite(value) && Math.floor(value) === value),
      isTypedArray = x => x instanceof Float32Array || x instanceof Float64Array || x instanceof Int8Array || x instanceof Uint8Array || x instanceof Uint8ClampedArray || x instanceof Int16Array || x instanceof Int32Array || x instanceof Uint32Array;

const assignProps = (to, from) => {
    for (const prop in from) {
        Object.defineProperty(to, prop, Object.getOwnPropertyDescriptor(from, prop));
    };return to;
};

const escapeStr = x => x.replace(/\n/g, '\\n').replace(/\'/g, "\\'").replace(/\"/g, '\\"');

const { first, strlen } = require('printable-characters'); // handles ANSI codes and invisible characters

const limit = (s, n) => s && (strlen(s) <= n ? s : first(s, n - 1) + '…');

const configure = cfg => {

    const stringify = x => {

        const state = Object.assign({ parents: new Set(), siblings: new Map() }, cfg);

        if (cfg.pretty === 'auto') {
            const oneLine = stringify.configure({ pretty: false, siblings: new Map() })(x);
            return oneLine.length <= cfg.maxLength ? oneLine : stringify.configure({ pretty: true, siblings: new Map() })(x);
        }

        var customFormat = cfg.formatter && cfg.formatter(x, stringify);

        if (typeof customFormat === 'string') {
            return customFormat;
        }

        if (typeof jQuery !== 'undefined' && x instanceof jQuery) {
            x = x.toArray();
        } else if (isTypedArray(x)) {
            x = Array.from(x);
        } else if (isURL(x)) {
            x = x.toString();
        }

        if (isBrowser && x === window) {
            return 'window';
        } else if (!isBrowser && typeof global !== 'undefined' && x === global) {
            return 'global';
        } else if (x === null) {
            return 'null';
        } else if (x instanceof Date) {
            return state.pure ? x.getTime() : "📅  " + x.toString();
        } else if (x instanceof RegExp) {
            return state.json ? '"' + x.toString() + '"' : x.toString();
        } else if (state.parents.has(x)) {
            return state.pure ? undefined : '<cyclic>';
        } else if (!state.pure && state.siblings.has(x)) {
            return '<ref:' + state.siblings.get(x) + '>';
        } else if (x && typeof Symbol !== 'undefined' && (customFormat = x[Symbol.for('String.ify')]) && typeof customFormat === 'function' && typeof (customFormat = customFormat.call(x, stringify.configure(state))) === 'string') {

            return customFormat;
        } else if (typeof x === 'function') {
            return cfg.pure ? x.toString() : x.name ? '<function:' + x.name + '>' : '<function>';
        } else if (typeof x === 'string') {
            return '"' + escapeStr(limit(x, cfg.pure ? Number.MAX_SAFE_INTEGER : cfg.maxStringLength)) + '"';
        } else if (x instanceof Promise && !state.pure) {
            return '<Promise>';
        } else if (typeof x === 'object') {

            state.parents.add(x);
            state.siblings.set(x, state.siblings.size);

            const result = stringify.configure(Object.assign({}, state, { pretty: state.pretty === false ? false : 'auto', depth: state.depth + 1 })).object(x);

            state.parents.delete(x);

            return result;
        } else if (typeof x === 'number' && !isInteger(x) && cfg.precision > 0) {
            return x.toFixed(cfg.precision);
        } else {
            return String(x);
        }
    };

    /*  API  */

    assignProps(stringify, {

        state: cfg,

        configure: newConfig => configure(Object.assign({}, cfg, newConfig)),

        /*  TODO: generalize generation of these chain-style .configure helpers (maybe in a separate library, as it looks like a common pattern)    */

        get pretty() {
            return stringify.configure({ pretty: true });
        },
        get noPretty() {
            return stringify.configure({ pretty: false });
        },
        get noFancy() {
            return stringify.configure({ fancy: false });
        },
        get noRightAlignKeys() {
            return stringify.configure({ rightAlignKeys: false });
        },

        get json() {
            return stringify.configure({ json: true, pure: true });
        },
        get pure() {
            return stringify.configure({ pure: true });
        },

        maxStringLength(n = Number.MAX_SAFE_INTEGER) {
            return stringify.configure({ maxStringLength: n });
        },
        maxArrayLength(n = Number.MAX_SAFE_INTEGER) {
            return stringify.configure({ maxArrayLength: n });
        },
        maxObjectLength(n = Number.MAX_SAFE_INTEGER) {
            return stringify.configure({ maxObjectLength: n });
        },
        maxDepth(n = Number.MAX_SAFE_INTEGER) {
            return stringify.configure({ maxDepth: n });
        },
        maxLength(n = Number.MAX_SAFE_INTEGER) {
            return stringify.configure({ maxLength: n });
        },
        indentation(n) {
            return stringify.configure({ indentation: n });
        },

        precision(p) {
            return stringify.configure({ precision: p });
        },
        formatter(f) {
            return stringify.configure({ formatter: f });
        },

        /*  Some undocumented internals    */

        limit,

        rightAlign: strings => {
            var max = maxOf(strings, s => s.length);
            return strings.map(s => ' '.repeat(max - s.length) + s);
        },

        object: x => {

            if (x instanceof Set) {
                x = Array.from(x.values());
            } else if (x instanceof Map) {
                x = Array.from(x.entries());
            }

            const isArray = Array.isArray(x);

            if (isBrowser) {

                if (x instanceof Element) {
                    return '<' + (x.tagName.toLowerCase() + (x.id && '#' + x.id || '') + (x.className && '.' + x.className || '')) + '>';
                } else if (x instanceof Text) {
                    return '@' + stringify.limit(x.wholeText, 20);
                }
            }

            const entries = _objectEntries(x);

            const tooDeep = cfg.depth > cfg.maxDepth,
                  tooBig = isArray ? entries.length > cfg.maxArrayLength : entries.length > cfg.maxObjectLength;

            if (!cfg.pure && (tooDeep || tooBig)) {
                return '<' + (isArray ? 'array' : 'object') + '[' + entries.length + ']>';
            }

            const quoteKey = cfg.json ? k => '"' + escapeStr(k) + '"' : k => /^[A-z][A-z0-9]*$/.test(k) ? k : "'" + escapeStr(k) + "'";

            if (cfg.pretty) {

                const values = _objectValues(x),
                      right = cfg.rightAlignKeys && cfg.fancy,
                      printedKeys = (right ? stringify.rightAlign : x => x)(Object.keys(x).map(k => quoteKey(k) + ': ')),
                      printedValues = values.map(stringify),
                      brace = isArray ? '[' : '{',
                      endBrace = isArray ? ']' : '}';

                if (cfg.fancy) {

                    const leftPaddings = printedValues.map((x, i) => !right ? 0 : x[0] === '[' || x[0] === '{' ? 3 : typeof values[i] === 'string' ? 1 : 0),
                          maxLeftPadding = maxOf(leftPaddings),
                          items = leftPaddings.map((padding, i) => {
                        const value = ' '.repeat(maxLeftPadding - padding) + printedValues[i];
                        return isArray ? value : bullet(printedKeys[i], value);
                    }),
                          printed = bullet(brace + ' ', items.join(',\n')),
                          lines = printed.split('\n'),
                          lastLine = lines[lines.length - 1];

                    return printed + (' '.repeat(maxOf(lines, l => l.length) - lastLine.length) + ' ' + endBrace);
                } else {

                    const indent = cfg.indentation.repeat(cfg.depth);

                    return brace + '\n' + printedValues.map((x, i) => indent + (isArray ? x : printedKeys[i] + x)).join(',\n') + '\n' + cfg.indentation.repeat(cfg.depth - 1) + endBrace;
                }
            } else {

                const items = entries.map(kv => (isArray ? '' : quoteKey(kv[0]) + ': ') + stringify(kv[1])),
                      content = items.join(', ');

                return isArray ? '[' + content + ']' : '{ ' + content + ' }';
            }
        }
    });

    return stringify;
};

module.exports = configure({

    depth: 0,
    pure: false,
    json: false,
    //  color:           false, // not supported yet
    maxDepth: 5,
    maxLength: 50,
    maxArrayLength: 60,
    maxObjectLength: 200,
    maxStringLength: 60,
    precision: undefined,
    formatter: undefined,
    pretty: 'auto',
    rightAlignKeys: true,
    fancy: true,
    indentation: '    '
});

//# sourceMappingURL=data:application/json;charset=utf-8;base64,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LENBQVgsQ0FBaEUsQ0FBaEI7QUFBQSxzQkFDTSxVQUFVLE1BQU0sSUFBTixDQUFZLElBQVosQ0FEaEI7O0FBR0EsdUJBQU8sVUFDSSxNQUFPLE9BQVAsR0FBa0IsR0FEdEIsR0FFSSxPQUFPLE9BQVAsR0FBaUIsSUFGNUI7QUFHSDtBQUNKO0FBbEhtQixLQUF4Qjs7QUFxSEEsV0FBTyxTQUFQO0FBQ0gsQ0ExTUw7O0FBNE1BLE9BQU8sT0FBUCxHQUFpQixVQUFXOztBQUVSLFdBQWlCLENBRlQ7QUFHUixVQUFpQixLQUhUO0FBSVIsVUFBaUIsS0FKVDtBQUtaO0FBQ0ksY0FBaUIsQ0FOVDtBQU9SLGVBQWlCLEVBUFQ7QUFRUixvQkFBaUIsRUFSVDtBQVNSLHFCQUFpQixHQVRUO0FBVVIscUJBQWlCLEVBVlQ7QUFXUixlQUFpQixTQVhUO0FBWVIsZUFBaUIsU0FaVDtBQWFSLFlBQWdCLE1BYlI7QUFjUixvQkFBaUIsSUFkVDtBQWVSLFdBQWlCLElBZlQ7QUFnQlIsaUJBQWdCO0FBaEJSLENBQVgsQ0FBakIiLCJmaWxlIjoic3RyaW5nLmlmeS5qcyIsInNvdXJjZXNDb250ZW50IjpbIlwidXNlIHN0cmljdFwiO1xuXG5jb25zdCBidWxsZXQgICAgICAgPSByZXF1aXJlICgnc3RyaW5nLmJ1bGxldCcpLFxuICAgICAgaXNCcm93c2VyICAgID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKSAmJiAod2luZG93LndpbmRvdyA9PT0gd2luZG93KSAmJiB3aW5kb3cubmF2aWdhdG9yLFxuICAgICAgaXNVUkwgICAgICAgID0geCA9PiAodHlwZW9mIFVSTCAhPT0gJ3VuZGVmaW5lZCcpICYmICh4IGluc3RhbmNlb2YgVVJMKSxcbiAgICAgIG1heE9mICAgICAgICA9IChhcnIsIHBpY2spID0+IGFyci5yZWR1Y2UgKChtYXgsIHMpID0+IE1hdGgubWF4IChtYXgsIHBpY2sgPyBwaWNrIChzKSA6IHMpLCAwKSxcbiAgICAgIGlzSW50ZWdlciAgICA9IE51bWJlci5pc0ludGVnZXIgfHwgKHZhbHVlID0+ICh0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInKSAmJiBpc0Zpbml0ZSAodmFsdWUpICYmIChNYXRoLmZsb29yICh2YWx1ZSkgPT09IHZhbHVlKSksXG4gICAgICBpc1R5cGVkQXJyYXkgPSB4ID0+ICh4IGluc3RhbmNlb2YgRmxvYXQzMkFycmF5KSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAoeCBpbnN0YW5jZW9mIEZsb2F0NjRBcnJheSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKHggaW5zdGFuY2VvZiBJbnQ4QXJyYXkpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICh4IGluc3RhbmNlb2YgVWludDhBcnJheSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKHggaW5zdGFuY2VvZiBVaW50OENsYW1wZWRBcnJheSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKHggaW5zdGFuY2VvZiBJbnQxNkFycmF5KSB8fFxuICAgICAgICAgICAgICAgICAgICAgICAgICAoeCBpbnN0YW5jZW9mIEludDMyQXJyYXkpIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICh4IGluc3RhbmNlb2YgVWludDMyQXJyYXkpXG5cbmNvbnN0IGFzc2lnblByb3BzID0gKHRvLCBmcm9tKSA9PiB7IGZvciAoY29uc3QgcHJvcCBpbiBmcm9tKSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSAodG8sIHByb3AsIE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IgKGZyb20sIHByb3ApKSB9OyByZXR1cm4gdG8gfVxuXG5jb25zdCBlc2NhcGVTdHIgPSB4ID0+IHgucmVwbGFjZSAoL1xcbi9nLCAnXFxcXG4nKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UgKC9cXCcvZywgXCJcXFxcJ1wiKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UgKC9cXFwiL2csICdcXFxcXCInKVxuXG5jb25zdCB7IGZpcnN0LCBzdHJsZW4gfSA9IHJlcXVpcmUgKCdwcmludGFibGUtY2hhcmFjdGVycycpIC8vIGhhbmRsZXMgQU5TSSBjb2RlcyBhbmQgaW52aXNpYmxlIGNoYXJhY3RlcnNcblxuY29uc3QgbGltaXQgPSAocywgbikgPT4gcyAmJiAoKHN0cmxlbiAocykgPD0gbikgPyBzIDogKGZpcnN0IChzLCBuIC0gMSkgKyAn4oCmJykpXG5cbmNvbnN0IGNvbmZpZ3VyZSA9IGNmZyA9PiB7XG5cbiAgICBjb25zdCBzdHJpbmdpZnkgPSB4ID0+IHtcblxuICAgICAgICAgICAgY29uc3Qgc3RhdGUgPSBPYmplY3QuYXNzaWduICh7IHBhcmVudHM6IG5ldyBTZXQgKCksIHNpYmxpbmdzOiBuZXcgTWFwICgpIH0sIGNmZylcblxuICAgICAgICAgICAgaWYgKGNmZy5wcmV0dHkgPT09ICdhdXRvJykge1xuICAgICAgICAgICAgICAgIGNvbnN0ICAgb25lTGluZSA9ICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBwcmV0dHk6IGZhbHNlLCBzaWJsaW5nczogbmV3IE1hcCAoKSB9KSAoeClcbiAgICAgICAgICAgICAgICByZXR1cm4gKG9uZUxpbmUubGVuZ3RoIDw9IGNmZy5tYXhMZW5ndGgpID8gb25lTGluZSA6IHN0cmluZ2lmeS5jb25maWd1cmUgKHsgcHJldHR5OiB0cnVlLCAgc2libGluZ3M6IG5ldyBNYXAgKCkgfSkgKHgpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHZhciBjdXN0b21Gb3JtYXQgPSBjZmcuZm9ybWF0dGVyICYmIGNmZy5mb3JtYXR0ZXIgKHgsIHN0cmluZ2lmeSlcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXN0b21Gb3JtYXQgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1c3RvbUZvcm1hdCB9XG5cbiAgICAgICAgICBcbiAgICAgICAgICAgIGlmICgodHlwZW9mIGpRdWVyeSAhPT0gJ3VuZGVmaW5lZCcpICYmICh4IGluc3RhbmNlb2YgalF1ZXJ5KSkge1xuICAgICAgICAgICAgICAgIHggPSB4LnRvQXJyYXkgKCkgfVxuICAgICAgICAgIFxuICAgICAgICAgICAgZWxzZSBpZiAoaXNUeXBlZEFycmF5ICh4KSkge1xuICAgICAgICAgICAgICAgIHggPSBBcnJheS5mcm9tICh4KSB9XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIGVsc2UgaWYgKGlzVVJMICh4KSkge1xuICAgICAgICAgICAgICAgIHggPSB4LnRvU3RyaW5nICgpIH1cblxuICAgICAgICAgIFxuICAgICAgICAgICAgaWYgKGlzQnJvd3NlciAmJiAoeCA9PT0gd2luZG93KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnd2luZG93JyB9XG5cbiAgICAgICAgICAgIGVsc2UgaWYgKCFpc0Jyb3dzZXIgJiYgKHR5cGVvZiBnbG9iYWwgIT09ICd1bmRlZmluZWQnKSAmJiAoeCA9PT0gZ2xvYmFsKSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnZ2xvYmFsJyB9XG5cbiAgICAgICAgICAgIGVsc2UgaWYgKHggPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ251bGwnIH1cblxuICAgICAgICAgICAgZWxzZSBpZiAoeCBpbnN0YW5jZW9mIERhdGUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gc3RhdGUucHVyZSA/IHguZ2V0VGltZSAoKSA6IFwi8J+ThSAgXCIgKyB4LnRvU3RyaW5nICgpIH1cblxuICAgICAgICAgICAgZWxzZSBpZiAoeCBpbnN0YW5jZW9mIFJlZ0V4cCkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0ZS5qc29uID8gJ1wiJyArIHgudG9TdHJpbmcgKCkgKyAnXCInIDogeC50b1N0cmluZyAoKSB9XG5cbiAgICAgICAgICAgIGVsc2UgaWYgKHN0YXRlLnBhcmVudHMuaGFzICh4KSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBzdGF0ZS5wdXJlID8gdW5kZWZpbmVkIDogJzxjeWNsaWM+JyB9XG5cbiAgICAgICAgICAgIGVsc2UgaWYgKCFzdGF0ZS5wdXJlICYmIHN0YXRlLnNpYmxpbmdzLmhhcyAoeCkpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJzxyZWY6JyArIHN0YXRlLnNpYmxpbmdzLmdldCAoeCkgKyAnPicgfVxuXG4gICAgICAgICAgICBlbHNlIGlmICh4ICYmICh0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJylcbiAgICAgICAgICAgICAgICAgICAgICAgJiYgKGN1c3RvbUZvcm1hdCA9IHhbU3ltYm9sLmZvciAoJ1N0cmluZy5pZnknKV0pXG4gICAgICAgICAgICAgICAgICAgICAgICYmICh0eXBlb2YgY3VzdG9tRm9ybWF0ID09PSAnZnVuY3Rpb24nKVxuICAgICAgICAgICAgICAgICAgICAgICAmJiAodHlwZW9mIChjdXN0b21Gb3JtYXQgPSBjdXN0b21Gb3JtYXQuY2FsbCAoeCwgc3RyaW5naWZ5LmNvbmZpZ3VyZSAoc3RhdGUpKSkgPT09ICdzdHJpbmcnKSkge1xuXG4gICAgICAgICAgICAgICAgcmV0dXJuIGN1c3RvbUZvcm1hdCB9XG5cbiAgICAgICAgICAgIGVsc2UgaWYgKHggaW5zdGFuY2VvZiBGdW5jdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiAoY2ZnLnB1cmUgPyB4LnRvU3RyaW5nICgpIDogKHgubmFtZSA/ICgnPGZ1bmN0aW9uOicgKyB4Lm5hbWUgKyAnPicpIDogJzxmdW5jdGlvbj4nKSkgfVxuXG4gICAgICAgICAgICBlbHNlIGlmICh0eXBlb2YgeCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJ1wiJyArIGVzY2FwZVN0ciAobGltaXQgKHgsIGNmZy5wdXJlID8gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIgOiBjZmcubWF4U3RyaW5nTGVuZ3RoKSkgKyAnXCInIH1cblxuICAgICAgICAgICAgZWxzZSBpZiAoKHggaW5zdGFuY2VvZiBQcm9taXNlKSAmJiAhc3RhdGUucHVyZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiAnPFByb21pc2U+JyB9XG5cbiAgICAgICAgICAgIGVsc2UgaWYgKHR5cGVvZiB4ID09PSAnb2JqZWN0Jykge1xuXG4gICAgICAgICAgICAgICAgc3RhdGUucGFyZW50cy5hZGQgKHgpXG4gICAgICAgICAgICAgICAgc3RhdGUuc2libGluZ3Muc2V0ICh4LCBzdGF0ZS5zaWJsaW5ncy5zaXplKVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoT2JqZWN0LmFzc2lnbiAoe30sIHN0YXRlLCB7IHByZXR0eTogc3RhdGUucHJldHR5ID09PSBmYWxzZSA/IGZhbHNlIDogJ2F1dG8nLCBkZXB0aDogc3RhdGUuZGVwdGggKyAxIH0pKS5vYmplY3QgKHgpXG5cbiAgICAgICAgICAgICAgICBzdGF0ZS5wYXJlbnRzLmRlbGV0ZSAoeClcblxuICAgICAgICAgICAgICAgIHJldHVybiByZXN1bHQgfVxuXG4gICAgICAgICAgICBlbHNlIGlmICgodHlwZW9mIHggPT09ICdudW1iZXInKSAmJiAhaXNJbnRlZ2VyICh4KSAmJiAoY2ZnLnByZWNpc2lvbiA+IDApKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHgudG9GaXhlZCAoY2ZnLnByZWNpc2lvbikgfVxuXG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gU3RyaW5nICh4KSB9XG4gICAgICAgIH1cblxuICAgIC8qICBBUEkgICovXG5cbiAgICAgICAgYXNzaWduUHJvcHMgKHN0cmluZ2lmeSwge1xuXG4gICAgICAgICAgICBzdGF0ZTogY2ZnLFxuXG4gICAgICAgICAgICBjb25maWd1cmU6IG5ld0NvbmZpZyA9PiBjb25maWd1cmUgKE9iamVjdC5hc3NpZ24gKHt9LCBjZmcsIG5ld0NvbmZpZykpLFxuXG4gICAgICAgIC8qICBUT0RPOiBnZW5lcmFsaXplIGdlbmVyYXRpb24gb2YgdGhlc2UgY2hhaW4tc3R5bGUgLmNvbmZpZ3VyZSBoZWxwZXJzIChtYXliZSBpbiBhIHNlcGFyYXRlIGxpYnJhcnksIGFzIGl0IGxvb2tzIGxpa2UgYSBjb21tb24gcGF0dGVybikgICAgKi9cblxuICAgICAgICAgICAgZ2V0IHByZXR0eSAgICAgICAgICAgKCkgeyByZXR1cm4gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBwcmV0dHk6IHRydWUgfSkgfSxcbiAgICAgICAgICAgIGdldCBub1ByZXR0eSAgICAgICAgICgpIHsgcmV0dXJuIHN0cmluZ2lmeS5jb25maWd1cmUgKHsgcHJldHR5OiBmYWxzZSB9KSB9LFxuICAgICAgICAgICAgZ2V0IG5vRmFuY3kgICAgICAgICAgKCkgeyByZXR1cm4gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBmYW5jeTogIGZhbHNlIH0pIH0sXG4gICAgICAgICAgICBnZXQgbm9SaWdodEFsaWduS2V5cyAoKSB7IHJldHVybiBzdHJpbmdpZnkuY29uZmlndXJlICh7IHJpZ2h0QWxpZ25LZXlzOiBmYWxzZSB9KSB9LFxuXG4gICAgICAgICAgICBnZXQganNvbiAoKSB7IHJldHVybiBzdHJpbmdpZnkuY29uZmlndXJlICh7IGpzb246IHRydWUsIHB1cmU6IHRydWUgfSkgfSxcbiAgICAgICAgICAgIGdldCBwdXJlICgpIHsgcmV0dXJuIHN0cmluZ2lmeS5jb25maWd1cmUgKHsgcHVyZTogdHJ1ZSB9KSB9LFxuXG4gICAgICAgICAgICBtYXhTdHJpbmdMZW5ndGggKG4gPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikgeyByZXR1cm4gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBtYXhTdHJpbmdMZW5ndGg6IG4gfSkgfSxcbiAgICAgICAgICAgIG1heEFycmF5TGVuZ3RoICAobiA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7IHJldHVybiBzdHJpbmdpZnkuY29uZmlndXJlICh7IG1heEFycmF5TGVuZ3RoOiBuIH0pIH0sXG4gICAgICAgICAgICBtYXhPYmplY3RMZW5ndGggKG4gPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikgeyByZXR1cm4gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBtYXhPYmplY3RMZW5ndGg6IG4gfSkgfSxcbiAgICAgICAgICAgIG1heERlcHRoICAgICAgICAobiA9IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7IHJldHVybiBzdHJpbmdpZnkuY29uZmlndXJlICh7IG1heERlcHRoOiBuIH0pIH0sXG4gICAgICAgICAgICBtYXhMZW5ndGggICAgICAgKG4gPSBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikgeyByZXR1cm4gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBtYXhMZW5ndGg6IG4gfSkgfSxcbiAgICAgICAgICAgIGluZGVudGF0aW9uICAgICAobikgICAgICAgICAgICAgICAgICAgICAgICAgICB7IHJldHVybiBzdHJpbmdpZnkuY29uZmlndXJlICh7IGluZGVudGF0aW9uOiBuIH0pIH0sXG5cbiAgICAgICAgICAgIHByZWNpc2lvbiAocCkgeyByZXR1cm4gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBwcmVjaXNpb246IHAgfSkgfSxcbiAgICAgICAgICAgIGZvcm1hdHRlciAoZikgeyByZXR1cm4gc3RyaW5naWZ5LmNvbmZpZ3VyZSAoeyBmb3JtYXR0ZXI6IGYgfSkgfSxcblxuICAgICAgICAvKiAgU29tZSB1bmRvY3VtZW50ZWQgaW50ZXJuYWxzICAgICovXG5cbiAgICAgICAgICAgIGxpbWl0LFxuXG4gICAgICAgICAgICByaWdodEFsaWduOiBzdHJpbmdzID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXIgbWF4ID0gbWF4T2YgKHN0cmluZ3MsIHMgPT4gcy5sZW5ndGgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHN0cmluZ3MubWFwIChzID0+ICcgJy5yZXBlYXQgKG1heCAtIHMubGVuZ3RoKSArIHMpIH0sXG5cbiAgICAgICAgICAgIG9iamVjdDogeCA9PiB7XG5cbiAgICAgICAgICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIFNldCkge1xuICAgICAgICAgICAgICAgICAgICB4ID0gQXJyYXkuZnJvbSAoeC52YWx1ZXMgKCkpIH1cblxuICAgICAgICAgICAgICAgIGVsc2UgaWYgKHggaW5zdGFuY2VvZiBNYXApIHtcbiAgICAgICAgICAgICAgICAgICAgeCA9IEFycmF5LmZyb20gKHguZW50cmllcyAoKSkgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgaXNBcnJheSA9IEFycmF5LmlzQXJyYXkgKHgpXG5cbiAgICAgICAgICAgICAgICBpZiAoaXNCcm93c2VyKSB7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoeCBpbnN0YW5jZW9mIEVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnPCcgKyAoeC50YWdOYW1lLnRvTG93ZXJDYXNlICgpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICgoeC5pZCAmJiAoJyMnICsgeC5pZCkpIHx8ICcnKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoKHguY2xhc3NOYW1lICYmICgnLicgKyB4LmNsYXNzTmFtZSkpIHx8ICcnKSkgKyAnPicgfVxuICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoeCBpbnN0YW5jZW9mIFRleHQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiAnQCcgKyBzdHJpbmdpZnkubGltaXQgKHgud2hvbGVUZXh0LCAyMCkgfSB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMgKHgpXG5cbiAgICAgICAgICAgICAgICBjb25zdCB0b29EZWVwID0gKGNmZy5kZXB0aCA+IGNmZy5tYXhEZXB0aClcbiAgICAgICAgICAgICAgICAgICAgLCB0b29CaWcgID0gKGlzQXJyYXkgPyAoZW50cmllcy5sZW5ndGggPiBjZmcubWF4QXJyYXlMZW5ndGgpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZW50cmllcy5sZW5ndGggPiBjZmcubWF4T2JqZWN0TGVuZ3RoKSlcblxuICAgICAgICAgICAgICAgIGlmICghY2ZnLnB1cmUgJiYgKHRvb0RlZXAgfHwgdG9vQmlnKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gJzwnICsgKGlzQXJyYXkgPyAnYXJyYXknIDogJ29iamVjdCcpICsgJ1snICsgZW50cmllcy5sZW5ndGggKyAnXT4nXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcXVvdGVLZXkgPSAoY2ZnLmpzb24gPyAoayA9PiAnXCInICsgZXNjYXBlU3RyIChrKSArICdcIicpIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChrID0+IC9eW0Etel1bQS16MC05XSokLy50ZXN0IChrKSA/IGsgOiAoXCInXCIgKyBlc2NhcGVTdHIgKGspICsgXCInXCIpKSlcblxuICAgICAgICAgICAgICAgIGlmIChjZmcucHJldHR5KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWVzICAgICAgICA9IE9iamVjdC52YWx1ZXMgKHgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICByaWdodCAgICAgICAgID0gY2ZnLnJpZ2h0QWxpZ25LZXlzICYmIGNmZy5mYW5jeSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbnRlZEtleXMgICA9IChyaWdodCA/IHN0cmluZ2lmeS5yaWdodEFsaWduIDogeCA9PiB4KSAoT2JqZWN0LmtleXMgKHgpLm1hcCAoayA9PiBxdW90ZUtleSAoaykgKyAnOiAnKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByaW50ZWRWYWx1ZXMgPSB2YWx1ZXMubWFwIChzdHJpbmdpZnkpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBicmFjZSAgICAgICAgID0gaXNBcnJheSA/ICdbJyA6ICd7JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kQnJhY2UgICAgICA9IGlzQXJyYXkgPyAnXScgOiAnfSdcblxuICAgICAgICAgICAgICAgICAgICBpZiAoY2ZnLmZhbmN5KSB7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxlZnRQYWRkaW5ncyA9IHByaW50ZWRWYWx1ZXMubWFwICgoeCwgaSkgPT4gKCFyaWdodCA/IDAgOiAoKHhbMF0gPT09ICdbJykgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKHhbMF0gPT09ICd7JykpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgID8gM1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6ICgodHlwZW9mIHZhbHVlc1tpXSA9PT0gJ3N0cmluZycpID8gMSA6IDApKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBtYXhMZWZ0UGFkZGluZyA9IG1heE9mIChsZWZ0UGFkZGluZ3MpLFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpdGVtcyA9IGxlZnRQYWRkaW5ncy5tYXAgKChwYWRkaW5nLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9ICcgJy5yZXBlYXQgKG1heExlZnRQYWRkaW5nIC0gcGFkZGluZykgKyBwcmludGVkVmFsdWVzW2ldXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gaXNBcnJheSA/IHZhbHVlIDogYnVsbGV0IChwcmludGVkS2V5c1tpXSwgdmFsdWUpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcmludGVkICAgID0gYnVsbGV0IChicmFjZSArICcgJywgaXRlbXMuam9pbiAoJyxcXG4nKSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lcyAgICAgID0gcHJpbnRlZC5zcGxpdCAoJ1xcbicpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdExpbmUgICA9IGxpbmVzW2xpbmVzLmxlbmd0aCAtIDFdXG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBwcmludGVkICsgICgnICcucmVwZWF0IChtYXhPZiAobGluZXMsIGwgPT4gbC5sZW5ndGgpIC0gbGFzdExpbmUubGVuZ3RoKSArICcgJyArIGVuZEJyYWNlKVxuXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGluZGVudCA9IGNmZy5pbmRlbnRhdGlvbi5yZXBlYXQgKGNmZy5kZXB0aClcblxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGJyYWNlICsgJ1xcbicgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJpbnRlZFZhbHVlcy5tYXAgKCh4LCBpKSA9PiBpbmRlbnQgKyAoaXNBcnJheSA/IHggOiAocHJpbnRlZEtleXNbaV0gKyB4KSkpLmpvaW4gKCcsXFxuJykgKyAnXFxuJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjZmcuaW5kZW50YXRpb24ucmVwZWF0IChjZmcuZGVwdGggLSAxKSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5kQnJhY2VcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcblxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpdGVtcyAgID0gZW50cmllcy5tYXAgKGt2ID0+IChpc0FycmF5ID8gJycgOiAocXVvdGVLZXkgKGt2WzBdKSArICc6ICcpKSArIHN0cmluZ2lmeSAoa3ZbMV0pKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudCA9IGl0ZW1zLmpvaW4gKCcsICcpXG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlzQXJyYXlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA/ICgnWycgICsgY29udGVudCArICAnXScpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgOiAoJ3sgJyArIGNvbnRlbnQgKyAnIH0nKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICByZXR1cm4gc3RyaW5naWZ5XG4gICAgfVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvbmZpZ3VyZSAoe1xuXG4gICAgICAgICAgICAgICAgICAgIGRlcHRoOiAgICAgICAgICAgMCxcbiAgICAgICAgICAgICAgICAgICAgcHVyZTogICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAganNvbjogICAgICAgICAgICBmYWxzZSxcbiAgICAgICAgICAgICAgICAvLyAgY29sb3I6ICAgICAgICAgICBmYWxzZSwgLy8gbm90IHN1cHBvcnRlZCB5ZXRcbiAgICAgICAgICAgICAgICAgICAgbWF4RGVwdGg6ICAgICAgICA1LFxuICAgICAgICAgICAgICAgICAgICBtYXhMZW5ndGg6ICAgICAgIDUwLFxuICAgICAgICAgICAgICAgICAgICBtYXhBcnJheUxlbmd0aDogIDYwLFxuICAgICAgICAgICAgICAgICAgICBtYXhPYmplY3RMZW5ndGg6IDIwMCxcbiAgICAgICAgICAgICAgICAgICAgbWF4U3RyaW5nTGVuZ3RoOiA2MCxcbiAgICAgICAgICAgICAgICAgICAgcHJlY2lzaW9uOiAgICAgICB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgICAgIGZvcm1hdHRlcjogICAgICAgdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgICAgICBwcmV0dHk6ICAgICAgICAgJ2F1dG8nLFxuICAgICAgICAgICAgICAgICAgICByaWdodEFsaWduS2V5czogIHRydWUsXG4gICAgICAgICAgICAgICAgICAgIGZhbmN5OiAgICAgICAgICAgdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgaW5kZW50YXRpb246ICAgICcgICAgJyxcbiAgICAgICAgICAgICAgICB9KVxuXG5cbiJdfQ==