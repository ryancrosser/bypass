'use strict';

require('babel-polyfill');

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _directoryTree = require('directory-tree');

var _directoryTree2 = _interopRequireDefault(_directoryTree);

var _cli = require('./cli.js');

var _cli2 = _interopRequireDefault(_cli);

var _replacers = require('./replacers.js');

var _replacers2 = _interopRequireDefault(_replacers);

var _defaults = require('./defaults.js');

var _defaults2 = _interopRequireDefault(_defaults);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var config = _lodash2.default.extend({}, _defaults2.default, _cli2.default);

// create the output folder
_fsExtra2.default.ensureDirSync(config.outputDirectory);

process(config);

function process() {
    var directory = _directoryTree2.default.directoryTree(config.targetDirectory);

    // empty output directory
    if (config['clean-output-dir']) {
        _fsExtra2.default.emptyDirSync(_path2.default.resolve(config.outputDirectory));
    }
    var fileList = parseDirectory(directory);

    if (config.processType === 'UP') {
        // write the directory tree to the output directory
        _fsExtra2.default.writeFile(_path2.default.join(_path2.default.resolve(config.outputDirectory), config.manifestFile), JSON.stringify(buildManifest(fileList, config), null, 4), function (err) {
            if (err) {
                throw Error(err);
            }
        });
    }

    processFiles(fileList, config);
}

function parseDirectory(directory) {
    var temp = [];
    var filePaths = void 0;
    if (directory.children && Array.isArray(directory.children)) {
        filePaths = recuseChildren(directory.children, temp);
    }
    return filePaths;
}

function buildManifest(filePaths, config) {
    return filePaths.map(function (file) {
        return {
            fileName: _path2.default.basename(file),
            // filePath: file.slice(config.targetDirectory.length + 1).replace(/\\/g, config.fileDelimiter),
            filePath: file.slice(config.targetDirectory.length + 1)
        };
    });
}

function parseManifest(fileList, config) {
    var manifestPattern = new RegExp(/manifest\.\d{13}\.json/, '');

    if (!manifestPattern.test(config.manifestFile)) {
        manifestPattern = new RegExp(config.manifestFile);
    }

    var manifestFilePath = fileList.filter(function (file) {
        return manifestPattern.test(file);
    });

    var data = _fsExtra2.default.readFileSync(manifestFilePath[0], 'utf8');

    return JSON.parse(data).map(function (d) {
        return {
            fileName: d.fileName,
            filePath: _path2.default.join(config.outputDirectory, d.filePath)
        };
    });
}

function recuseChildren(nodeTree, holdingArr) {
    nodeTree.forEach(function (node) {
        if (node.children) {
            return recuseChildren(node.children, holdingArr);
        } else {
            holdingArr.push(_path2.default.join(config.targetDirectory, node.path));
        }
    });

    return holdingArr;
}

function processFiles(fileList, config) {
    if (config.processType === 'UP') {
        fileList.map(function (filePath) {
            var fileName = _path2.default.basename(filePath);
            if (config.ignoreList.includes(_path2.default.extname(filePath).slice(1))) {
                // do not process file, just copy to output directory
                _fsExtra2.default.writeFileSync(_path2.default.join(config.outputDirectory, fileName), _fsExtra2.default.readFileSync(filePath));
            } else {
                processFileForUp(filePath, config).then(function (data) {
                    var filePath = _path2.default.join(_path2.default.resolve(config.outputDirectory), fileName);
                    writeFile(filePath, data);
                });
            }
        });
    } else if (config.processType === 'DOWN') {
        var filePaths = parseManifest(fileList, config);
        filePaths.map(function (fp) {
            if (config.ignoreList.includes(_path2.default.extname(fp.fileName).slice(1))) {
                // copy file for target to output
                _fsExtra2.default.ensureFileSync(fp.filePath);
                _fsExtra2.default.writeFileSync(_path2.default.resolve(fp.filePath), _fsExtra2.default.readFileSync(_path2.default.join(config.targetDirectory, fp.fileName)));
            } else {
                _fsExtra2.default.ensureFileSync(fp.filePath);
                processFileForDown(_path2.default.join(config.targetDirectory, fp.fileName)).then(function (data) {
                    writeFile(fp.filePath, data);
                });
            }
        });
    }
}

function writeFile(filePath, fileContent) {
    _fsExtra2.default.writeFile(filePath, fileContent, function (err) {
        if (err) {
            throw Error(err);
        }
    });
}

function processFileForUp(filePath, config) {
    return new Promise(function (resolve, reject) {
        _fsExtra2.default.readFile(filePath, 'utf8', function (err, data) {
            if (err) {
                reject(err);
            }

            // remove line breaks
            var newData = data.replace(/\r\n/g, '__BACKSLASH_R_BACKSLASH_N__').replace(/\n/g, '__BACKSLASH_N__').replace(/\r/g, '__BACKSLASH_R__');

            for (var r in _replacers2.default) {
                if (_replacers2.default.hasOwnProperty(r)) {
                    // remove character that can throw errors
                    var re = new RegExp(r, 'ig');
                    newData = newData.replace(re, _replacers2.default[r]);
                }
            }
            if (config['line-length']) {
                newData = breakAtLineLength(newData, config['line-length']);
            }

            resolve(newData);
        });
    });
}

function breakAtLineLength(file, lineLength) {
    var insertStr = '__GENERATED_LINE_BREAK__\n';
    var loopCount = 1;
    var start = 0;
    while (start < file.length) {
        var first = file.slice(0, start + lineLength);
        var last = file.slice(start + lineLength);

        file = first + insertStr + last;
        start = lineLength * loopCount + insertStr.length;
        loopCount++;
    }
    return file;
}

function processFileForDown(filePath) {
    return new Promise(function (resolve, reject) {
        _fsExtra2.default.readFile(filePath, 'utf8', function (err, data) {
            if (err) {
                reject(err);
            }

            var newData = removeGeneratedLineBreak(data);
            for (var r in _replacers2.default) {
                if (_replacers2.default.hasOwnProperty(r)) {
                    // remove character that can throw errors
                    var re = new RegExp(_replacers2.default[r], 'g');
                    newData = newData.replace(re, r.replace(/\\/g, ''));

                    // remove line breaks
                    newData = newData.replace(/__BACKSLASH_R_BACKSLASH_N__/g, '\r\n').replace(/__BACKSLASH_N__/g, '\n').replace(/__BACKSLASH_R__/g, '\r');
                }
            }

            resolve(newData);
        });
    });
}

function removeGeneratedLineBreak(file) {
    return file.replace(/__GENERATED_LINE_BREAK__\n/g, '');
}