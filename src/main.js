#! /usr/bin/env node

const { resolve } = require('path');

const execa = require('execa');
const ms = require('ms');
const color_support = require('color-support').hasBasic;
const c = require('ansi-colors');

c.enabled = color_support;

const is_truthy = str => {
  return str.length && str !== '0'
}

function get_args({
  aliases = {},
  flags = [],
  stopAtPositional = false,
  argv,
} = {}) {
  const result = { _: [] };

  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];

    if (stopAtPositional && result._.length > 0) {
      result._ = result._.concat(argv.slice(i));
      break;
    }

    if(arg == '--') {
      result._ = result._.concat(argv.slice(i + 1));
      break;
    }

    const is_alias = arg[0] == '-' && arg.split('=', 1) in aliases;

    if (is_alias) {
      if(arg.includes('=')) {
        const parts = arg.split(/=(.*)/, 2);
        arg = aliases[parts[0]] + (parts[1] ? `=${parts[1]}` : '=0');
      } else {
        arg = aliases[arg]; 
      }
    }

    const is_flag = arg.startsWith('--'); 

    if(!is_flag) {
      result._.push(arg);
      continue;
    }

    const [key, rest] = arg.split(/=(.*)/, 2);

    if (rest) {
      const name = key.slice(2);
      result[name] = flags.includes(name) ? is_truthy(rest) : rest;
    } else {
      const next = argv[i + 1] || null;
      const name = key.slice(2);

      if(next === null) {
        result[name] = arg.includes('=') ? false : true;
        break;
      }

      if (next.startsWith('-') || flags.includes(name)) {
        result[name] = arg.includes('=') ? false : true;
      } else {
        result[name] = flags.includes(name) ? is_truthy(next) : next;
        i++;
      }
    }
  }

  return result;
}

const shell = (options) => (cmd) => execa.command(cmd, options);

function logTime(time, message) {
  const stamp = time.toTimeString().slice(0, 8);
  console.error(`[${c.gray(stamp)}] ${message}`);
}

function time(options, name) {
  if (options.quiet) {
    return (val) => val;
  }

  const startTime = new Date();

  logTime(startTime, `Starting '${c.cyan(name)}' ...`);

  return (val) => {
    const endTime = new Date();
    const duration = ms(endTime - startTime);

    logTime(endTime, `Finished '${c.cyan(name)}' (${c.magenta(duration)})`);

    return val;
  };
}

function list(registry) {
  let str = '';
  for (let [key, value] of Object.entries(registry)) {
    str += `* ${key}`;
    str += value.description ? `: ${value.description}` : '';
    str += '\n';
  }
  return str;
}

function tasks(args = cli) {
  const registry = Object.create(null);

  const subtasks = (opts) => tasks(opts);

  subtasks.addlist = (name = 'list') => {
    registry[name] = () => console.log(`\nAvailable tasks:\n${list(registry)}`);
    registry[name].description = 'List available tasks';

    return subtasks;
  };

  subtasks.add = (name, ...rest) => {
    if (typeof name != 'string') {
      throw new TypeError('Task name must be a string.');
    }

    if (rest.length === 1) {
      var [task] = rest;
      var description = '';
    } else if (rest.length >= 2) {
      var [description, task] = rest;

      if (typeof description != 'string') {
        throw new TypeError('Task description must be a string.');
      }
    }

    if (typeof task != 'function') {
      throw new TypeError('Task must be a function.');
    }

    task.description = description;
    registry[name] = task;

    return subtasks;
  };

  subtasks.run = async (name) => {
    const keys = Object.keys(registry);

    if (keys.length == 0) {
      return;
    }

    name = name || args._.shift() || 'default';

    const task = registry[name];

    if (!task) {
      return console.error(`\nAvailable tasks:\n${list(registry)}`);
    }

    const done = time(args, name);
    const result = await task(args, {
      tasks: subtasks,
      sh,
      color: c,
      time: time.bind(null, args),
      ms,
    });
    done();

    return result;
  };

  const promise = new Promise((resolve) => {
    return process.nextTick(() => resolve(subtasks.run()));
  });

  subtasks.then = promise.then.bind(promise);
  subtasks.catch = promise.catch.bind(promise);

  return subtasks;
}

function handleError(error = 'An unknown error has occurred.') {
  const { code } = error;

  process.exitCode = code === undefined ? 1 : code;

  console.error(error);
}

const taskfile = process.argv[2];

const sh = shell({ stdio: 'inherit' });
sh.quiet = shell();
sh.build = shell;
sh.safe = (...args) =>
  sh(...args)
    .then((arg) => arg)
    .catch((arg) => arg);

const cli = get_args({
  flags: ['run', 'quiet', 'list'],
  aliases: { '-r': '--run', '-l': '--list', '-q': '--quiet' },
  argv: process.argv.slice(3),
  stopAtPositional: false,
});

// Register error handlers
process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);

const usertasks = require(resolve(taskfile));

if (typeof usertasks != 'function') {
  throw new TypeError('Task file must export a function');
}

usertasks(tasks());
