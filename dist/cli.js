'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

require('babel-polyfill');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _minimist = require('minimist');

var _minimist2 = _interopRequireDefault(_minimist);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var argv = (0, _minimist2.default)(process.argv.slice(2));

var cli = {};

if (argv._.includes('up')) {
    cli.processType = 'UP';
}
if (argv._.includes('down')) {
    cli.processType = 'DOWN';
}
if (argv.file) {
    cli.targetFile = _path2.default.resolve(argv.file);
} else if (argv.dir) {
    cli.targetDirectory = _path2.default.resolve(argv.dir);
}
if (argv.output) {
    cli.outputDirectory = argv.output;
}
if (argv['line-length']) {
    cli['line-length'] = argv['line-length'];
}
if (argv['clean-output-dir']) {
    cli['clean-output-dir'] = argv['clean-output-dir'];
}
if (argv.manifest) {
    cli.manifest = argv.manifest;
}
if (argv['ignore-types']) {
    var ignoreList = argv['ignore-types'].split(',');

    cli['ignore-types'] = ignoreList.map(function (type) {
        return type.trim();
    });
}

exports.default = cli;