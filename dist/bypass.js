'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _async = require('async');

var _async2 = _interopRequireDefault(_async);

require('babel-polyfill');

require('colors');

var _del = require('del');

var _del2 = _interopRequireDefault(_del);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _cli = require('./cli.js');

var _cli2 = _interopRequireDefault(_cli);

var _defaults = require('./defaults.js');

var _defaults2 = _interopRequireDefault(_defaults);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Bypass = function () {
    function Bypass() {
        _classCallCheck(this, Bypass);

        this.config = Object.assign({}, _defaults2.default, _cli2.default);
        this.process();
    }

    _createClass(Bypass, [{
        key: 'process',
        value: function (_process) {
            function process() {
                return _process.apply(this, arguments);
            }

            process.toString = function () {
                return _process.toString();
            };

            return process;
        }(function () {
            var _this = this;

            /* eslint-disable no-console */
            if (this.config.help) {
                _fsExtra2.default.createReadStream(__dirname + '/help.txt').pipe(process.stdout);
                return;
            } else if (this.config.processType === 'UP' || this.config.processType === 'DOWN') {
                (function () {
                    var promises = [];
                    Promise.all([_this.createOutputDirectory(), _this.emptyOutputDirectory()]).then(function () {
                        if (_this.config.processType === 'UP') {
                            promises.push(_this.up());
                        } else if (_this.config.processType === 'DOWN') {
                            promises.push(_this.down());
                        } else {
                            promises.push(Promise.reject());
                        }

                        Promise.all(promises).then(function (msg) {
                            console.log();
                            console.log(msg[0].green);
                            console.log();
                        }).catch(function (err) {
                            console.log();
                            console.log(err.red);
                            console.log();
                        });
                    });
                })();
            } else {
                console.log();
                console.log('Invalid or missing process type. Use --help for information on how to use Bypass.'.red);
                console.log();
            }
            /* eslint-enable no-console */
        })
    }, {
        key: 'up',
        value: function up() {
            var _this2 = this;

            return new Promise(function (resolve, reject) {
                _this2.walkDirectory(_this2.config.targetDirectory).then(function (files) {
                    var textArr = [];
                    _async2.default.each(files, function (file, callback) {
                        var relativeFilePath = _this2.getRelativePath(file);
                        if (_this2.config.ignoreList.includes(_path2.default.extname(file).slice(1))) {
                            // do not process file, just copy to output directory
                            _this2.copyFile(relativeFilePath);
                        } else {
                            textArr.push(_this2.buildText(file));
                        }
                        callback();
                    }, function (err) {
                        if (err) {
                            reject(err);
                        }
                        var filepath = _path2.default.join(_this2.config.outputDirectory, _this2.config.outputFile);
                        _fsExtra2.default.writeFile(filepath, textArr.join(''), function (writeErr) {
                            if (writeErr) {
                                reject(writeErr);
                            }
                            resolve('All files in target directory have been processed and are in ' + _this2.config.outputFile);
                        });
                    });
                });
            });
        }
    }, {
        key: 'down',
        value: function down() {
            var _this3 = this;

            return new Promise(function (resolve, reject) {
                _this3.walkDirectory(_this3.config.targetDirectory).then(function (files) {
                    var bypassFilePath = files.filter(function (file) {
                        return file.includes(_this3.config.outputFile);
                    })[0];
                    var bypassFilePromise = void 0;
                    var copyFilePromise = void 0;
                    if (!bypassFilePath) {
                        resolve('No Bypass File found in target directory [' + _this3.config.targetDirectory + '].');
                    } else {
                        // remove bypass file from files array
                        files.splice(files.indexOf(bypassFilePath), 1);

                        bypassFilePromise = new Promise(function (bypassFileResolve, bypassFileReject) {
                            _this3.parseBypassFile(bypassFilePath).then(function (bypassFiles) {
                                bypassFiles.forEach(function (bf) {
                                    var destFilepath = _path2.default.join(_this3.config.outputDirectory, bf.relativePath);
                                    _fsExtra2.default.ensureFile(destFilepath, function (err) {
                                        if (err) {
                                            bypassFileReject(err);
                                        }
                                        _fsExtra2.default.writeFile(destFilepath, bf.contents, function (writeErr) {
                                            if (writeErr) {
                                                bypassFileReject(writeErr);
                                            }
                                            bypassFileResolve(true);
                                        });
                                    });
                                });
                            });
                        });

                        copyFilePromise = new Promise(function (copyFileResolve, copyFileReject) {
                            _async2.default.each(files, function (file, callback) {
                                _this3.copyFile(_this3.getRelativePath(file)).then(function () {
                                    callback();
                                });
                            }, function (err) {
                                if (err) {
                                    copyFileReject(err);
                                }
                                copyFileResolve(true);
                            });
                        });
                    }

                    Promise.all([bypassFilePromise, copyFilePromise]).then(function () {
                        resolve('All files in Bypass File [' + _this3.config.outputFile + '] and target directory have been processed and are in ' + _this3.config.outputDirectory);
                    }).catch(function (err) {
                        reject(err);
                    });
                });
            });
        }
    }, {
        key: 'parseBypassFile',
        value: function parseBypassFile(bypassFilePath) {
            var _this4 = this;

            var files = [];
            var BYPASS_FILE_PATTERN = /<BYPASS-FILE>[\s\S]+?<\/BYPASS-FILE>/g;
            return new Promise(function (resolve, reject) {
                _fsExtra2.default.readFile(bypassFilePath, 'utf8', function (err, data) {
                    if (err) {
                        reject(err);
                    }
                    var bypassFiles = [];
                    var match = void 0;
                    while ((match = BYPASS_FILE_PATTERN.exec(data)) !== null) {
                        bypassFiles.push(match[0]);
                        files.push({
                            relativePath: _this4.parseRelativePath(match[0]),
                            contents: _this4.parseFileContents(match[0])
                        });
                    }
                    resolve(files);
                });
            });
        }
    }, {
        key: 'parseRelativePath',
        value: function parseRelativePath(bypassFile) {
            var RELATIVE_FILEPATH_PATTERN = /<RELATIVE-FILEPATH>([\s\S]+?)<\/RELATIVE-FILEPATH>/;
            var relativeFilepath = bypassFile.match(RELATIVE_FILEPATH_PATTERN);
            return relativeFilepath[1];
        }
    }, {
        key: 'parseFileContents',
        value: function parseFileContents(bypassFile) {
            var BYPASS_FILE_CONTENTS_PATTERN = /<BYPASS-FILE-CONTENTS>([\s\S]+?)<\/BYPASS-FILE-CONTENTS>/;
            var fileContents = bypassFile.match(BYPASS_FILE_CONTENTS_PATTERN);
            return fileContents[1];
        }
    }, {
        key: 'copyFile',
        value: function copyFile(relativeFilePath) {
            var _this5 = this;

            return new Promise(function (resolve, reject) {
                var srcFilePath = _path2.default.join(_this5.config.targetDirectory, relativeFilePath);
                var destFilePath = _path2.default.join(_this5.config.outputDirectory, relativeFilePath);
                _fsExtra2.default.copy(srcFilePath, destFilePath, function (err) {
                    if (err) {
                        reject(err);
                    }
                    resolve(destFilePath);
                });
            });
        }
    }, {
        key: 'buildText',
        value: function buildText(file) {
            var text = '<BYPASS-FILE>';
            text += '<RELATIVE-FILEPATH>' + this.getRelativePath(file) + '</RELATIVE-FILEPATH>';
            text += '<BYPASS-FILE-CONTENTS>' + _fsExtra2.default.readFileSync(file) + '</BYPASS-FILE-CONTENTS>';
            text += '</BYPASS-FILE>';
            return text;
        }
    }, {
        key: 'getRelativePath',
        value: function getRelativePath(file) {
            return file.replace(this.config.targetDirectory + _path2.default.sep, '');
        }
    }, {
        key: 'createOutputDirectory',
        value: function createOutputDirectory() {
            var _this6 = this;

            return new Promise(function (resolve, reject) {
                _fsExtra2.default.ensureDir(_this6.config.outputDirectory, function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(_this6.config.outputDirectory);
                    _this6.config.outputDirectory = _path2.default.resolve(_this6.config.outputDirectory);
                });
            });
        }
    }, {
        key: 'emptyOutputDirectory',
        value: function emptyOutputDirectory() {
            var _this7 = this;

            return new Promise(function (resolve, reject) {
                if (_this7.config['clean-output-dir']) {
                    (0, _del2.default)([_this7.config.outputDirectory + '/**', '!' + _this7.config.outputDirectory, _this7.config.outputDirectory + '/**/*']).then(function () {
                        resolve(_this7.config.outputDirectory);
                    }).catch(function (err) {
                        reject(err);
                    });
                }
            });
        }
    }, {
        key: 'walkDirectory',
        value: function walkDirectory(directory) {
            return new Promise(function (resolve) {
                var files = [];
                _fsExtra2.default.walk(directory).on('data', function (file) {
                    if (file.stats.isFile()) {
                        files.push(file.path);
                    }
                }).on('end', function () {
                    resolve(files);
                });
            });
        }
    }]);

    return Bypass;
}();

exports.default = Bypass;