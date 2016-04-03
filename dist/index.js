'use strict';

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _recursiveReaddir = require('recursive-readdir');

var _recursiveReaddir2 = _interopRequireDefault(_recursiveReaddir);

var _yargs = require('yargs');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var processType = false;

if (_yargs.argv.up) {
    processType = 'UP';
}
if (_yargs.argv.down) {
    processType = 'DOWN';
}

var targetDirectory = __dirname;
if (_yargs.argv.dir) {
    targetDirectory = _yargs.argv.dir;
    targetDirectory = _path2.default.resolve(targetDirectory);
}

console.log(targetDirectory);

var targetFile = '';
if (_yargs.argv.file) {
    targetFile = _yargs.argv.file = targetFile;
}
var outputDirectory = 'output';
if (_yargs.argv.output) {
    outputDirectory = _yargs.argv.output;
}
_fsExtra2.default.ensureDirSync(outputDirectory);

var lineLength = false;
if (_yargs.argv.lineLength) {
    lineLength = _yargs.argv.lineLength;
}

process(processType, targetDirectory, outputDirectory, lineLength);

var replacers = {
    '"': '__DOUBLE_QUOTE__',
    '\'': '__SINGLE_QUOTE__',
    ';': '__SEMI_COLON__',
    ':': '__COLON__',
    '=': '__EQUAL_SIGN__',
    '\\(': '__LEFT_PAREN__',
    '\\)': '__RIGHT_PAREN__',
    '\\[': '__LEFT_SQUARE__',
    '\\]': '__RIGHT_SQUARE__',
    '\\{': '__LEFT_CURLY',
    '\\}': '__RIGHT_CURLY',
    'return': '__RETURN__',
    'function': '__FUNCTION__'
};

function process(processType, targetDirectory, outputDirectory, lineLength) {
    // empty output directory
    _fsExtra2.default.emptyDirSync(_path2.default.resolve(outputDirectory));
    getAllFileInDirectory(targetDirectory).then(function (files) {
        files.forEach(function (file) {
            _fsExtra2.default.readFile(file, 'utf8', function (err, data) {
                if (err) {
                    throw Error(err);
                }
                var fileName = _path2.default.basename(file);
                var fileContent = '';
                if (processType === 'UP') {
                    fileContent = processFileForUp(data, lineLength);
                } else if (processType === 'DOWN') {
                    fileContent = processFileForDown(data);
                }

                _fsExtra2.default.writeFile(_path2.default.join(_path2.default.resolve(outputDirectory), fileName), fileContent, function (err) {
                    if (err) {
                        throw Error(err);
                    }
                });
            });
        });
    }).catch(function (err) {
        throw Error(err);
    });
}

function getAllFileInDirectory(targetDirectory) {
    return new Promise(function (resolve, reject) {
        (0, _recursiveReaddir2.default)(targetDirectory, function (err, files) {
            if (err) {
                reject(err);
            }

            // Files is an array of filename
            resolve(files);
        });
    });
}

function processFileForUp(file, lineLength) {
    var newFile = file;
    var temp = '';
    for (var r in replacers) {
        if (replacers.hasOwnProperty(r)) {
            // remove line breaks
            newFile = newFile.replace(/\r\n/g, '__BACKSLASH_R_BACKSLASH_N__');
            newFile = newFile.replace(/\n/g, '__BACKSLASH_N__');
            newFile = newFile.replace(/\r/g, '__BACKSLASH_R__');

            // remove character that can throw errors
            var re = new RegExp(r, 'ig');
            newFile = newFile.replace(re, replacers[r]);

            temp = newFile;
            if (lineLength) {
                temp = breakAtLineLength(newFile, lineLength);
            }
        }
    }

    return temp;
}

function spliceSlice(str, index, count, add) {
    return str.slice(0, index) + (add || "") + str.slice(index + count);
}

function breakAtLineLength(file, lineLength) {
    var insertStr = '__ARBITRARY_LINE_BREAK__\n';

    start = 0;
    while (index < file.length) {
        file.slice(start, index) + insertStr + file.slice(index + count);

        newFile.push(temp.splice(0, lineLength).join(''));
        console.log(temp.length);

        start = index + count + insertStr.length;
    }
    return newFile.join('__ARBITRARY_LINE_BREAK__\n');
}

function processFileForDown(file) {
    var newFile = file;
    newFile = removeArbitaryLineBreak(file);

    for (var r in replacers) {
        if (replacers.hasOwnProperty(r)) {
            // remove character that can throw errors
            var re = new RegExp(replacers[r], 'g');
            console.log(r.replace(/\\/g, ''));
            newFile = newFile.replace(re, r.replace(/\\/g, ''));

            // remove line breaks
            newFile = newFile.replace(/__BACKSLASH_R_BACKSLASH_N__/g, '\r\n');
            newFile = newFile.replace(/__BACKSLASH_N__/g, '\n');
            newFile = newFile.replace(/__BACKSLASH_R__/g, '\r');
        }
    }
    return newFile;
}

function removeArbitaryLineBreak(file) {
    return file.replace(/__ARBITRARY_LINE_BREAK__\n/g, '');
}