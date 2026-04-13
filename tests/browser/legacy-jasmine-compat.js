/* eslint-disable */
(function() {
    'use strict';

    var DEFAULT_BODY = '<div id="placeholder" style="width: 600px; height: 400px"></div>';
    var originalGlobals = {};
    var globalNames = ['describe', 'xdescribe', 'it', 'xit', 'beforeEach', 'afterEach', 'expect', 'spyOn', 'setFixtures', 'appendSetStyleFixtures', 'fail', 'jasmine'];

    window.__legacyJasmine = {
        runFile: runFile
    };

    function runFile(path, options) {
        options = options || {};
        resetBody();
        var registry = createRegistry();
        var fakeClock = createFakeClock();
        installGlobals(registry, fakeClock);

        return fetch(path)
            .then(function(response) {
                if (!response.ok) {
                    throw new Error('failed to load ' + path + ': ' + response.status + ' ' + response.statusText);
                }
                return response.text();
            })
            .then(function(source) {
                try {
                    window.eval(source + '\n//# sourceURL=' + path);
                } catch (error) {
                    return {
                        path: path,
                        loadError: formatError(error),
                        results: []
                    };
                }

                applySkipList(registry.tests, options.skipTests || []);

                return runRegisteredTests(registry.tests, fakeClock).then(function(results) {
                    return {
                        path: path,
                        loadError: null,
                        results: results
                    };
                });
            })
            .finally(function() {
                fakeClock.uninstall();
                restoreGlobals();
                resetBody();
            });
    }

    function applySkipList(testCases, skipTests) {
        if (!skipTests || skipTests.length === 0) {
            return;
        }

        for (var i = 0; i < testCases.length; i++) {
            if (skipTests.indexOf(testCases[i].fullName) !== -1) {
                testCases[i].skipped = true;
            }
        }
    }

    function createRegistry() {
        var rootSuite = {
            name: '',
            parent: null,
            beforeEach: [],
            afterEach: []
        };

        return {
            currentSuite: rootSuite,
            tests: [],
            customMatchers: {}
        };
    }

    function installGlobals(registry, fakeClock) {
        saveGlobals();

        window.describe = function(name, fn) {
            var parent = registry.currentSuite;
            var suite = {
                name: name,
                parent: parent,
                beforeEach: [],
                afterEach: []
            };

            registry.currentSuite = suite;
            try {
                fn();
            } finally {
                registry.currentSuite = parent;
            }
        };

        window.xdescribe = function() {
            return undefined;
        };

        window.it = function(name, fn) {
            registry.tests.push({
                fullName: joinSuiteName(registry.currentSuite, name),
                fn: fn,
                suite: registry.currentSuite,
                skipped: false
            });
        };

        window.xit = function(name, fn) {
            registry.tests.push({
                fullName: joinSuiteName(registry.currentSuite, name),
                fn: fn,
                suite: registry.currentSuite,
                skipped: true
            });
        };

        window.beforeEach = function(fn) {
            registry.currentSuite.beforeEach.push(fn);
        };

        window.afterEach = function(fn) {
            registry.currentSuite.afterEach.push(fn);
        };

        window.expect = function(actual) {
            return buildMatchers(actual, registry.customMatchers, false);
        };

        window.spyOn = function(obj, methodName) {
            if (!obj) {
                throw new Error('spyOn target is required');
            }

            var original = obj[methodName];
            if (original != null && typeof original !== 'function') {
                throw new Error('spyOn target "' + methodName + '" is not a function');
            }

            return createSpy(methodName, obj, methodName, original);
        };

        window.setFixtures = function(html) {
            document.body.innerHTML = html;
            return window.jQuery(document.body);
        };

        window.appendSetStyleFixtures = function(css) {
            var style = document.createElement('style');
            style.setAttribute('data-legacy-style-fixture', 'true');
            style.textContent = css;
            document.head.appendChild(style);
            return style;
        };

        window.fail = function(message) {
            throw new Error(message || 'explicit failure');
        };

        window.jasmine = {
            addMatchers: function(matchers) {
                for (var key in matchers) {
                    registry.customMatchers[key] = matchers[key];
                }
            },
            any: function(expectedType) {
                return {
                    __jasmineAny: true,
                    expectedType: expectedType
                };
            },
            createSpy: function(name) {
                return createSpy(name || 'anonymous');
            },
            clock: function() {
                return fakeClock.api;
            }
        };
    }

    function saveGlobals() {
        for (var i = 0; i < globalNames.length; i++) {
            var name = globalNames[i];
            originalGlobals[name] = Object.prototype.hasOwnProperty.call(window, name) ? window[name] : undefined;
        }
    }

    function restoreGlobals() {
        for (var i = 0; i < globalNames.length; i++) {
            var name = globalNames[i];
            if (originalGlobals[name] === undefined) {
                try {
                    delete window[name];
                } catch (error) {
                    window[name] = undefined;
                }
            } else {
                window[name] = originalGlobals[name];
            }
        }
        originalGlobals = {};
    }

    function runRegisteredTests(testCases, fakeClock) {
        return testCases.reduce(function(chain, testCase) {
            return chain.then(function(results) {
                if (testCase.skipped) {
                    results.push({
                        fullName: testCase.fullName,
                        status: 'skipped'
                    });
                    return results;
                }

                return runTestCase(testCase, fakeClock).then(function(result) {
                    results.push(result);
                    return results;
                });
            });
        }, Promise.resolve([]));
    }

    function runTestCase(testCase, fakeClock) {
        resetBody();
        fakeClock.uninstall();

        var beforeHooks = collectBeforeEach(testCase.suite);
        var afterHooks = collectAfterEach(testCase.suite);
        var failure = null;

        return beforeHooks.reduce(function(chain, hook) {
            return chain.then(function() {
                return invokeSpecFunction(hook);
            });
        }, Promise.resolve())
            .then(function() {
                return invokeSpecFunction(testCase.fn);
            })
            .catch(function(error) {
                failure = error;
            })
            .then(function() {
                return afterHooks.reduce(function(chain, hook) {
                    return chain.then(function() {
                        return invokeSpecFunction(hook).catch(function(error) {
                            if (!failure) {
                                failure = error;
                            }
                        });
                    });
                }, Promise.resolve());
            })
            .then(function() {
                fakeClock.uninstall();

                if (failure) {
                    return {
                        fullName: testCase.fullName,
                        status: 'failed',
                        message: formatError(failure)
                    };
                }

                return {
                    fullName: testCase.fullName,
                    status: 'passed'
                };
            });
    }

    function invokeSpecFunction(fn) {
        if (typeof fn !== 'function') {
            return Promise.resolve();
        }

        if (fn.length > 0) {
            return new Promise(function(resolve, reject) {
                var settled = false;
                function done(error) {
                    if (settled) {
                        return;
                    }
                    settled = true;
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                }

                try {
                    fn(done);
                } catch (error) {
                    reject(error);
                }
            });
        }

        try {
            var result = fn();
            if (result && typeof result.then === 'function') {
                return result;
            }
            return Promise.resolve();
        } catch (error) {
            return Promise.reject(error);
        }
    }

    function collectBeforeEach(suite) {
        var chain = [];
        while (suite) {
            chain.unshift(suite);
            suite = suite.parent;
        }

        var hooks = [];
        for (var i = 0; i < chain.length; i++) {
            hooks = hooks.concat(chain[i].beforeEach);
        }
        return hooks;
    }

    function collectAfterEach(suite) {
        var hooks = [];
        while (suite) {
            hooks = hooks.concat(suite.afterEach);
            suite = suite.parent;
        }
        return hooks;
    }

    function buildMatchers(actual, customMatchers, inverted) {
        var matchers = {
            get not() {
                return buildMatchers(actual, customMatchers, !inverted);
            },
            toBe: function(expected) {
                assert(Object.is(actual, expected), 'Expected ' + stringify(actual) + ' to be ' + stringify(expected), inverted);
            },
            toEqual: function(expected) {
                assert(deepEqual(actual, expected), 'Expected ' + stringify(actual) + ' to equal ' + stringify(expected), inverted);
            },
            toBeCloseTo: function(expected, precision) {
                var digits = precision == null ? 2 : precision;
                var threshold = Math.pow(10, -digits) / 2;
                assert(Math.abs(actual - expected) < threshold, 'Expected ' + stringify(actual) + ' to be close to ' + stringify(expected) + ' with precision ' + digits, inverted);
            },
            toBeTruthy: function() {
                assert(!!actual, 'Expected value to be truthy but got ' + stringify(actual), inverted);
            },
            toBeFalsy: function() {
                assert(!actual, 'Expected value to be falsy but got ' + stringify(actual), inverted);
            },
            toBeNull: function() {
                assert(actual === null, 'Expected value to be null but got ' + stringify(actual), inverted);
            },
            toBeDefined: function() {
                assert(actual !== undefined, 'Expected value to be defined', inverted);
            },
            toBeUndefined: function() {
                assert(actual === undefined, 'Expected value to be undefined but got ' + stringify(actual), inverted);
            },
            toContain: function(expected) {
                var pass = false;
                if (typeof actual === 'string') {
                    pass = actual.indexOf(expected) !== -1;
                } else if (actual && typeof actual.indexOf === 'function') {
                    pass = actual.indexOf(expected) !== -1;
                }

                assert(pass, 'Expected ' + stringify(actual) + ' to contain ' + stringify(expected), inverted);
            },
            toBeGreaterThan: function(expected) {
                assert(actual > expected, 'Expected ' + stringify(actual) + ' to be greater than ' + stringify(expected), inverted);
            },
            toBeGreaterThanOrEqual: function(expected) {
                assert(actual >= expected, 'Expected ' + stringify(actual) + ' to be greater than or equal to ' + stringify(expected), inverted);
            },
            toBeLessThan: function(expected) {
                assert(actual < expected, 'Expected ' + stringify(actual) + ' to be less than ' + stringify(expected), inverted);
            },
            toBeLessThanOrEqual: function(expected) {
                assert(actual <= expected, 'Expected ' + stringify(actual) + ' to be less than or equal to ' + stringify(expected), inverted);
            },
            toHaveBeenCalled: function() {
                assert(isSpy(actual) && actual.calls.count() > 0, 'Expected spy to have been called', inverted);
            },
            toHaveBeenCalledTimes: function(expected) {
                assert(isSpy(actual) && actual.calls.count() === expected, 'Expected spy to have been called ' + expected + ' times but was ' + (isSpy(actual) ? actual.calls.count() : 'not a spy'), inverted);
            },
            toHaveBeenCalledWith: function() {
                var expectedArgs = Array.prototype.slice.call(arguments);
                var pass = false;
                if (isSpy(actual)) {
                    var calls = actual.calls.allArgs();
                    for (var i = 0; i < calls.length; i++) {
                        if (argsMatch(calls[i], expectedArgs)) {
                            pass = true;
                            break;
                        }
                    }
                }

                assert(pass, 'Expected spy to have been called with ' + stringify(expectedArgs), inverted);
            },
            toThrow: function() {
                var threw = false;
                try {
                    actual();
                } catch (error) {
                    threw = true;
                }
                assert(threw, 'Expected function to throw', inverted);
            }
        };

        for (var matcherName in customMatchers) {
            attachCustomMatcher(matchers, matcherName, customMatchers[matcherName], actual, inverted);
        }

        return matchers;
    }

    function attachCustomMatcher(matchers, matcherName, factory, actual, inverted) {
        matchers[matcherName] = function(expected) {
            var matcher = factory(null, null);
            var result = matcher.compare(actual, expected);
            var message = result && result.message ? result.message : 'Custom matcher "' + matcherName + '" failed';
            assert(!!(result && result.pass), message, inverted);
        };
    }

    function assert(pass, message, inverted) {
        var finalPass = inverted ? !pass : pass;
        if (!finalPass) {
            throw new Error(inverted ? 'Negated expectation failed: ' + message : message);
        }
    }

    function createSpy(name, owner, methodName, originalFn) {
        var strategy = 'stub';
        var implementation = function() {};
        var returnValue;

        var spy = function() {
            var args = Array.prototype.slice.call(arguments);
            spy.calls._push(args);

            if (strategy === 'callThrough' && originalFn) {
                return originalFn.apply(this, args);
            }
            if (strategy === 'callFake') {
                return implementation.apply(this, args);
            }
            if (strategy === 'returnValue') {
                return returnValue;
            }
            return undefined;
        };

        spy.and = {
            callThrough: function() {
                strategy = 'callThrough';
                return spy;
            },
            callFake: function(fn) {
                strategy = 'callFake';
                implementation = fn;
                return spy;
            },
            returnValue: function(value) {
                strategy = 'returnValue';
                returnValue = value;
                return spy;
            }
        };

        spy.calls = {
            list: [],
            _push: function(args) {
                this.list.push(args);
            },
            count: function() {
                return this.list.length;
            },
            argsFor: function(index) {
                return this.list[index];
            },
            allArgs: function() {
                return this.list.slice();
            },
            all: function() {
                return this.list.map(function(args) {
                    return { args: args };
                });
            }
        };

        spy.__isSpy = true;

        if (owner && methodName) {
            owner[methodName] = spy;
        }

        return spy;
    }

    function isSpy(value) {
        return !!(value && value.__isSpy);
    }

    function argsMatch(actualArgs, expectedArgs) {
        if (!actualArgs || actualArgs.length !== expectedArgs.length) {
            return false;
        }

        for (var i = 0; i < actualArgs.length; i++) {
            if (!deepEqual(actualArgs[i], expectedArgs[i])) {
                return false;
            }
        }

        return true;
    }

    function deepEqual(actual, expected) {
        if (expected && expected.__jasmineAny) {
            return actual instanceof expected.expectedType || typeof actual === expectedTypeName(expected.expectedType);
        }

        if (Object.is(actual, expected)) {
            return true;
        }

        if (actual instanceof Date && expected instanceof Date) {
            return actual.getTime() === expected.getTime();
        }

        if (typeof actual !== typeof expected) {
            return false;
        }

        if (actual == null || expected == null) {
            return actual === expected;
        }

        if (Array.isArray(actual) && Array.isArray(expected)) {
            if (actual.length !== expected.length) {
                return false;
            }
            for (var i = 0; i < actual.length; i++) {
                if (!deepEqual(actual[i], expected[i])) {
                    return false;
                }
            }
            return true;
        }

        if (typeof actual === 'object') {
            var actualKeys = Object.keys(actual);
            var expectedKeys = Object.keys(expected);
            if (actualKeys.length !== expectedKeys.length) {
                return false;
            }
            for (var j = 0; j < expectedKeys.length; j++) {
                var key = expectedKeys[j];
                if (!deepEqual(actual[key], expected[key])) {
                    return false;
                }
            }
            return true;
        }

        return actual === expected;
    }

    function expectedTypeName(expectedType) {
        if (expectedType === Function) {
            return 'function';
        }
        if (expectedType === String) {
            return 'string';
        }
        if (expectedType === Number) {
            return 'number';
        }
        if (expectedType === Boolean) {
            return 'boolean';
        }
        return 'object';
    }

    function createFakeClock() {
        var originalSetTimeout = window.setTimeout;
        var originalClearTimeout = window.clearTimeout;
        var originalSetInterval = window.setInterval;
        var originalClearInterval = window.clearInterval;
        var originalRequestAnimationFrame = window.requestAnimationFrame;
        var originalCancelAnimationFrame = window.cancelAnimationFrame;
        var OriginalDate = window.Date;
        var now = Date.now();
        var timerId = 1;
        var timers = new Map();
        var installed = false;

        function FakeDate() {
            if (!(this instanceof FakeDate)) {
                return new OriginalDate(now).toString();
            }

            if (arguments.length === 0) {
                return new OriginalDate(now);
            }

            return new (Function.prototype.bind.apply(OriginalDate, [null].concat(Array.prototype.slice.call(arguments))))();
        }

        FakeDate.now = function() {
            return now;
        };
        FakeDate.parse = OriginalDate.parse;
        FakeDate.UTC = OriginalDate.UTC;
        FakeDate.prototype = OriginalDate.prototype;

        function install() {
            if (installed) {
                return api;
            }

            installed = true;
            window.Date = FakeDate;
            window.setTimeout = function(fn, delay) {
                var args = Array.prototype.slice.call(arguments, 2);
                return scheduleTimer('timeout', fn, delay, args);
            };
            window.clearTimeout = function(id) {
                timers.delete(id);
            };
            window.setInterval = function(fn, delay) {
                var args = Array.prototype.slice.call(arguments, 2);
                return scheduleTimer('interval', fn, delay, args);
            };
            window.clearInterval = function(id) {
                timers.delete(id);
            };
            window.requestAnimationFrame = function(fn) {
                return scheduleTimer('raf', fn, 16, []);
            };
            window.cancelAnimationFrame = function(id) {
                timers.delete(id);
            };
            return api;
        }

        function uninstall() {
            if (!installed) {
                return api;
            }

            installed = false;
            timers.clear();
            window.Date = OriginalDate;
            window.setTimeout = originalSetTimeout;
            window.clearTimeout = originalClearTimeout;
            window.setInterval = originalSetInterval;
            window.clearInterval = originalClearInterval;
            window.requestAnimationFrame = originalRequestAnimationFrame;
            window.cancelAnimationFrame = originalCancelAnimationFrame;
            return api;
        }

        function mockDate(date) {
            now = date ? new OriginalDate(date).getTime() : OriginalDate.now();
            return api;
        }

        function tick(ms) {
            var target = now + ms;

            while (true) {
                var nextTimer = nextDueTimer(target);
                if (!nextTimer) {
                    break;
                }

                now = nextTimer.time;
                timers.delete(nextTimer.id);
                invokeTimer(nextTimer);
            }

            now = target;
            return api;
        }

        function scheduleTimer(type, fn, delay, args) {
            var id = timerId++;
            var wait = typeof delay === 'number' ? delay : 0;
            timers.set(id, {
                id: id,
                fn: fn,
                time: now + wait,
                delay: wait,
                type: type,
                args: args
            });
            return id;
        }

        function nextDueTimer(target) {
            var candidate = null;
            timers.forEach(function(timer) {
                if (timer.time > target) {
                    return;
                }

                if (!candidate || timer.time < candidate.time || (timer.time === candidate.time && timer.id < candidate.id)) {
                    candidate = timer;
                }
            });

            return candidate;
        }

        function invokeTimer(timer) {
            if (timer.type === 'raf') {
                timer.fn(now);
            } else {
                timer.fn.apply(window, timer.args);
            }

            if (timer.type === 'interval') {
                timer.time = now + timer.delay;
                timers.set(timer.id, timer);
            }
        }

        var api = {
            install: install,
            uninstall: uninstall,
            mockDate: mockDate,
            tick: tick
        };

        return {
            api: api,
            install: install,
            uninstall: uninstall
        };
    }

    function joinSuiteName(suite, testName) {
        var parts = [testName];
        while (suite && suite.name) {
            parts.unshift(suite.name);
            suite = suite.parent;
        }
        return parts.join(' ');
    }

    function resetBody() {
        document.body.innerHTML = DEFAULT_BODY;
        var styles = document.querySelectorAll('style[data-legacy-style-fixture="true"]');
        for (var i = 0; i < styles.length; i++) {
            styles[i].remove();
        }
    }

    function stringify(value) {
        if (typeof value === 'string') {
            return '"' + value + '"';
        }
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }

    function formatError(error) {
        if (!error) {
            return 'Unknown error';
        }
        if (error.stack) {
            return String(error.stack);
        }
        if (error.message) {
            return String(error.message);
        }
        return String(error);
    }
})();
