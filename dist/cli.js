'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var argv = (0, _minimist2.default)(process.argv.slice(2), {
    alias: {
        c: 'clean-output-dir',
        d: 'dir',
        i: 'ignore-types',
        o: 'output',
        h: 'help'
    }
});

var cli = {};

if (argv._.includes('up') || argv._.includes('UP')) {
    cli.processType = 'UP';
} else if (argv._.includes('down') || argv._.includes('DOWN')) {
    cli.processType = 'DOWN';
}

if (argv.file) {
    cli.targetFile = _path2.default.resolve(argv.file);
} else if (argv.dir) {
    console.log(argv.dir);
    cli.targetDirectory = _path2.default.resolve(argv.dir);
}

if (argv.output) {
    cli.outputDirectory = argv.output;
}

if (argv['clean-output-dir']) {
    cli['clean-output-dir'] = argv['clean-output-dir'];
}
if (argv['out-file']) {
    cli.outputFile = argv['out-file'];
}

if (argv['ignore-types']) {
    var ignoreList = argv['ignore-types'].split(',');
    cli.ignoreList = ignoreList.map(function (type) {
        return type.trim();
    });
}

if (argv.help) {
    cli.help = true;
}

exports.default = cli;