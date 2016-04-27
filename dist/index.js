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
    var manifest = buildManifest(fileList, config);

    if (config.processType === 'UP') {
        // write the directory tree to the output directory
        _fsExtra2.default.writeFile(_path2.default.join(_path2.default.resolve(config.outputDirectory), config.manifestFile), JSON.stringify(manifest, null, 4), function (err) {
            if (err) {
                throw Error(err);
            }
        });
    }

    processFiles(manifest, config);
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
    var pathSeparatorPattern = new RegExp('\\' + _path2.default.sep, 'g');
    return filePaths.map(function (filePath) {
        return {
            fileName: _path2.default.basename(filePath),
            filePath: filePath.slice(config.targetDirectory.length + 1),
            filePathConverted: filePath.slice(config.targetDirectory.length + 1).replace(pathSeparatorPattern, config.fileDelimiter)
        };
    });
}

function parseManifest(manifestFile, config) {
    var manifestPattern = new RegExp(/manifest\.\d{13}\.json/, '');
    if (!manifestPattern.test(config.manifestFile)) {
        manifestPattern = new RegExp(config.manifestFile);
    }
    var manifestFilePath = manifestFile.filter(function (manifest) {
        return manifestPattern.test(manifest.fileName);
    });
    var targetFilePath = _path2.default.join(_path2.default.resolve(config.targetDirectory), manifestFilePath[0].fileName);

    var data = _fsExtra2.default.readFileSync(targetFilePath, 'utf8');

    return JSON.parse(data).map(function (d) {
        return {
            fileName: d.fileName,
            filePath: _path2.default.join(config.outputDirectory, d.filePath),
            filePathConverted: d.filePathConverted
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

function processFiles(manifestFile, config) {
    if (config.processType === 'UP') {
        manifestFile.map(function (manifest) {
            var targetFilePath = _path2.default.resolve(_path2.default.join(config.outputDirectory, manifest.filePathConverted));
            if (config.ignoreList.includes(_path2.default.extname(manifest.fileName).slice(1))) {
                // do not process file, just copy to output directory
                var fromFilePath = _path2.default.resolve(_path2.default.join(config.targetDirectory, manifest.filePath));
                _fsExtra2.default.writeFileSync(targetFilePath, _fsExtra2.default.readFileSync(fromFilePath));
            } else {
                processFileForUp(_path2.default.resolve(_path2.default.join(config.targetDirectory, manifest.filePath)), config).then(function (data) {
                    writeFile(targetFilePath, data);
                });
            }
        });
    } else if (config.processType === 'DOWN') {
        var fileDelimiterPattern = new RegExp(config.fileDelimiter, 'g');
        var filePaths = parseManifest(manifestFile, config);
        filePaths.map(function (fp) {
            var targetFilePath = _path2.default.join(_path2.default.resolve(config.outputDirectory), fp.filePath);

            _fsExtra2.default.ensureFileSync(targetFilePath);
            if (config.ignoreList.includes(_path2.default.extname(fp.fileName).slice(1))) {
                // do not process file, just copy to output directory
                var fromFilePath = _path2.default.resolve(_path2.default.join(config.targetDirectory, fp.filePathConverted));
                _fsExtra2.default.writeFileSync(targetFilePath, _fsExtra2.default.readFileSync(fromFilePath));
            } else {
                processFileForDown(_path2.default.join(config.targetDirectory, fp.filePathConverted)).then(function (data) {
                    writeFile(targetFilePath, data);
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
            } else {
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
            }
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