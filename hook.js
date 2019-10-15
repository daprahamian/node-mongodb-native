'use strict';

const values = [];

function makeStack() {
  const err = new Error();
  const stack = err.stack.split('\n').map(line => line.trim());
  stack.shift();
  stack.shift();
  stack.shift();

  return stack;
}

function transformForSerialization(arg) {
  if (arg === undefined) {
    return { _contents: 'undefined' }
  }
  try {
    return JSON.parse(JSON.stringify(arg));
  } catch (e) {
    return { __contents: 'circular', ctor: arg.constructor.name };
  }
}

const hook = {
  catcher: function(name, { context, args, stack, cbStack, async, returnValue, err }) {
    args = args.map(transformForSerialization);
    returnValue = transformForSerialization(returnValue);
    values.push({ name, args, stack, cbStack, async, returnValue, err });
  },
  wrapSync: function(name, fn) {
    return function(...args) {
      const context = this;
      const stackTracker = new Error();
      const stack = stackTracker.stack;
      let returnValue, err;
      try {
        const returnValue = fn.apply(this, args);
        return returnValue;
      } catch (e) {
        err = e;
        throw e;
      } finally {
        hook.catcher(name, { context, args, stack, async: false, returnValue, err });
      }
    };
  },
  wrapAsync: function(name, fn) {
    return function(...allArgs) {
      const context = this;
      const stack = makeStack();
      const args = [...allArgs];
      const cb = args.pop();

      const newArgs = [
        ...args,
        (...results) => {
          const [err, returnValue] = results;
          const cbStack = makeStack();
          hook.catcher(name, { context, args, stack, cbStack, async: true, returnValue, err });
          return cb.apply(this, results);
        }
      ];

      return fn.apply(this, newArgs);
    };
  },
  getValues: function() {
    return [...values];
  },
  clear: function() {
    values.length = 0;
  }
};

module.exports = hook;
