import getopts from 'getopts';
import path from 'path';

import defaults from './defaults';

const cli = {};

const options = getopts(process.argv.slice(2), {
  alias: {
    c: 'clean-output-dir',
    d: 'dir',
    o: 'output',
    out: 'output',
    n: 'output-file-name',
    f: 'format',
    i: 'ignore-list',
    h: 'help'
  },
  default: defaults
});

if (options._.includes('up') || options._.includes('UP')) {
  cli.processType = 'UP';
} else if (options._.includes('down') || options._.includes('DOWN')) {
  cli.processType = 'DOWN';
} else if (
  options._.includes('h') ||
  options._.includes('H') ||
  options._.includes('help') ||
  options._.includes('HELP')
) {
  cli.processType = 'HELP';
}

if (options.file) {
  cli.targetFile = path.resolve(options.file);
} else if (options.dir) {
  cli.targetDirectory = path.resolve(options.dir);
}

if (options.output) {
  cli.outputDirectory = options.output;
}

if (options['clean-output-dir']) {
  cli['clean-output-dir'] = options['clean-output-dir'];
}
if (options['output-file-name']) {
  cli.outputFile = options['output-file-name'];
}

if (options.format) {
  cli.fileType = options.format;
}

if (options['ignore-types']) {
  let ignoreList = options['ignore-types'].split(',');
  cli.ignoreList = ignoreList.map(type => type.trim());
}

if (options.help) {
  cli.help = true;
}
if (options.debug) {
  cli.debug = true;
}

export default cli;
