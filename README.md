# Taskmachine

A simple task runner.

You can think of it as a mostly adequate task runner. Why mostly? Well... it's not really a task runner for serious projects. This is not meant to be a dev dependency that you install in your project. No. This is a utility script you can use when you want to run some shell commands and apply a little bit of logic. It's like a makefile but with javascript.

If you are looking for a "real" task runner that looks like this one, you might want to check out [just](https://microsoft.github.io/just/).

## Why?

I was bored. That's why. Also, I wanted to use [ygor](https://github.com/shannonmoeller/ygor) but that didn't work like I expected. So, I took the interesting parts of the task runner and made this one. The credit goes to [Shannon Moeller](http://shannonmoeller.com).

## Getting started

Ensure that you have Node.js >= v11. [Install Node.js via package manager](https://nodejs.org/en/download/package-manager/).

## Installation

### Recomended

Go to the [release page](https://github.com/VonHeikemen/taskmachine/releases), download taskmachine.zip and extract the minified version with all the dependencies included. Now make an alias.

```sh
alias taskmachine='node /path/to/taskmachine.js'
```

You could make it more convenient and add a fixed taskfile.

```sh
alias taskmachine='node /path/to/taskmachine.js ./make.js'
```

This way you can use the `make.js` file of the current directory.

### Using npm

You can use npm to install from the repository. This way you can have the `taskmachine` command available.

Fetch from master.

```
npm install --global github:VonHeikemen/taskmachine
```

Or install it from one of the available [tags](https://github.com/VonHeikemen/taskmachine/tags).

```
npm install --global github:VonHeikemen/taskmachine#<tag>
```

### Install from source

Clone/download the repository and install the dependencies yourself.

```
 git clone https://github.com/VonHeikemen/taskmachine 
 cd taskmachine
 npm install
```

## Usage

Node is the CLI.

```man
Usage: taskmachine <file> [task] [options]

  file   The filename of your script (the "taskfile").
  task   The name of the task to run (default: 'default').

Options:

  -q, --quiet   Suppress logging (default: false).
      --run     Auto-run task (default: true).
```

Create a JavaScript file, write some functions.

```js
// make.js

async function bundle() {
  // bundle something
}

async function instrument() {
  // instrument tests
}

async function test() {
  // test something
}

async function cover() {
  await instrument();
  await test();

  // report coverage
}

module.exports = function(tasks) {
  tasks
    .add('default', bundle)
    .add('test', test);
    .add('cover', cover);
}
```

To run a task, execute the file with Node.js and indicate which task to perform.

```
taskmachine make.js
taskmachine make.js test
taskmachine make.js cover
```

### Subtasks

You may also call `tasks()` within a task callback to create subtasks.

```js
function childA1() { console.log('hi from a1'); }
function childA2() { console.log('hi from a2'); }

function parentA(cli, { tasks }) {
  // Subtasks
  return tasks()
    .add('1', childA1)
    .add('2', childA2);
}

function childB1() { console.log('hi from b1'); }
function childB2() { console.log('hi from b2'); }

function parentB(cli, { tasks }) {
    // Subtasks
    return tasks()
        .add('1', childB1)
        .add('2', childB2);
}

module.exports = function(tasks) {
  tasks
    .add('a', parentA)
    .add('b', parentB);
}
```

Then execute subtasks by passing the parent task name as the first argument and the child task name as the second.

```
taskmachine make.js a 2
hi from a2

taskmachine make.js b 1
hi from b1
```

### Bring Your Own Arguments

You can override the default cli parsing by providing your own arguments object.

```js
function logCli(cli) {
  console.log(cli);
}

tasks({ foo: 'bar' })
  .add('log', logCli);
```

```
taskmachine make.js log
{ foo: 'bar' }
```

## API

### `tasks.add(name, description, callback): tasks`

- `name` `{String}` Unique task identifier.
- `description` `{String}` Describe what is the purpose of the task.
- `callback` `{Function(cli, context)}` Function to run when the task is invoked.

Registers a task. The callback provided will be executed with `tasks.cli` as the first argument and a `context` as the second.

This `context` object exposes the following utilities.

- `color` A utility to print colors on the terminal. This handled by [ansi-colors](https://www.npmjs.com/package/ansi-colors) package.
- `ms`A time convertion utility: [ms](https://www.npmjs.com/package/ms).
- `sh` A function to execute external commands. It uses [execa.command](https://github.com/sindresorhus/execa#execacommandcommand-options) under the hood. There are three variants: 1. `sh` is the default, which directs the result of the commands to the parent process stdout. 2. `sh.quiet` is like `sh` but doesn't show the result of the commands. 3. `sh.safer` is different from `sh`, this one doesn't throw an error when the command fails instead it return a [childProcessResult](https://github.com/sindresorhus/execa#childprocessresult) on success and failure.
- `tasks` A taskmachine instance, useful to make subtasks.
- `time` A utility "curried" function to measure the time spend on a task.

```js
function foo(cli, context) {
  console.log(cli, context);
}

module.exports = function(tasks) {
  tasks.add('foo', 'Do some foo stuff', foo);
}
```

### `tasks.addlist(name): tasks`

- `name` `{String}` Unique task identifier.

Registers a task that list the available subtasks.

### `tasks.run(name): Promise<>`

- `name` `{String}` Unique task identifier.

Tells taskmachine to run a task. This is used internally and generally shouldn't be invoked directly. It is recommended that tasks be declared as standalone functions.

```js
// Avoid

module.exports = function(tasks) {
  tasks.add('foo', function () {
    // do something
  });

  tasks.add('bar', function (cli, { tasks }) {
    tasks.run('foo');
  });
}

// Recommended

function foo() {
  // do something
}

function bar() {
  foo();
}

module.exports = function(tasks) {
  tasks
    .add('foo', foo)
    .add('bar', bar);
}
```

### `tasks(cli, context): tasks`

- `cli` `{Object}` - The `cli` arguments.

Creates a subset of tasks, useful for providing your own cli arguments and [creating subtasks](#subtasks).

