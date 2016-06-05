import async from 'async';
import 'babel-polyfill';
import 'colors';
import del from 'del';
import fs from 'fs-extra';
import pathUtil from 'path';

import cliOptions from './cli.js';
import defaults from './defaults.js';

class Bypass {
    constructor() {
        this.config = Object.assign({}, defaults, cliOptions);
        this.process();
    }

    process() {
        if (this.config.help) {
            fs.createReadStream(__dirname + '/help.txt').pipe(process.stdout);
            return;
        }

        let promises = [];
        Promise.all([this.createOutputDirectory(), this.emptyOutputDirectory()])
            .then(() => {
                if (this.config.processType === 'UP') {
                    promises.push(this.up());
                } else if (this.config.processType === 'DOWN') {
                    promises.push(this.down());
                } else {
                    promises.push(Promise.reject('Invalid or missing process type. Use --help for information on how to use Bypass.'));
                }

                Promise.all(promises).then((msg) => {
                    /* eslint-disable no-console */
                    console.log();
                    console.log(msg[0].green);
                    console.log();
                    /* eslint-enable no-console */
                })
                    .catch((err) => {
                        /* eslint-disable no-console */
                        console.log();
                        console.log(err.red);
                        console.log();
                        /* eslint-enable no-console */
                    });
            });
    }

    up() {
        return new Promise((resolve, reject) => {
            this.walkDirectory(this.config.targetDirectory).then((files) => {
                let textArr = [];
                async.each(files, (file, callback) => {
                    let relativeFilePath = this.getRelativePath(file);
                    if (this.config.ignoreList.includes(pathUtil.extname(file).slice(1))) {
                        // do not process file, just copy to output directory
                        this.copyFile(relativeFilePath);
                    } else {
                        textArr.push(this.buildText(file));
                    }
                    callback();
                }, (err) => {
                    if (err) {
                        reject(err);
                    }
                    let filepath = pathUtil.join(this.config.outputDirectory, this.config.outputFile);
                    fs.writeFile(filepath, textArr.join(''), (writeErr) => {
                        if (writeErr) {
                            reject(writeErr);
                        }
                        resolve(`All files in target directory have been processed and are in ${this.config.outputFile}`);
                    });
                });
            });
        });
    }

    down() {
        return new Promise((resolve, reject) => {
            this.walkDirectory(this.config.targetDirectory).then((files) => {
                let bypassFilePath = files.filter(file => file.includes(this.config.outputFile))[0];
                let bypassFilePromise;
                let copyFilePromise;
                if (!bypassFilePath) {
                    resolve(`No Bypass File found in target directory [${this.config.targetDirectory}].`);
                } else {
                    // remove bypass file from files array
                    files.splice(files.indexOf(bypassFilePath), 1);

                    bypassFilePromise = new Promise((bypassFileResolve, bypassFileReject) => {
                        this.parseBypassFile(bypassFilePath).then((bypassFiles) => {
                            bypassFiles.forEach((bf) => {
                                let destFilepath = pathUtil.join(this.config.outputDirectory, bf.relativePath);
                                fs.ensureFile(destFilepath, (err) => {
                                    if (err) {
                                        bypassFileReject(err);
                                    }
                                    fs.writeFile(destFilepath, bf.contents, (writeErr) => {
                                        if (writeErr) {
                                            bypassFileReject(writeErr);
                                        }
                                        bypassFileResolve(true);
                                    });
                                });
                            });
                        });
                    });

                    copyFilePromise = new Promise((copyFileResolve, copyFileReject) => {
                        async.each(files, (file, callback) => {
                            this.copyFile(this.getRelativePath(file)).then(() => {
                                callback();
                            });
                        }, (err) => {
                            if (err) {
                                copyFileReject(err);
                            }
                            copyFileResolve(true);
                        });
                    });
                }

                Promise.all([bypassFilePromise, copyFilePromise])
                    .then(() => {
                        resolve(`All files in Bypass File [${this.config.outputFile}] and target directory have been processed and are in ${this.config.outputDirectory}`);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        });
    }

    parseBypassFile(bypassFilePath) {
        let files = [];
        const BYPASS_FILE_PATTERN = /<BYPASS-FILE>[\s\S]+?<\/BYPASS-FILE>/g;
        return new Promise((resolve, reject) => {
            fs.readFile(bypassFilePath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                }
                let bypassFiles = [];
                let match;
                while ((match = BYPASS_FILE_PATTERN.exec(data)) !== null) {
                    bypassFiles.push(match[0]);
                    files.push({
                        relativePath: this.parseRelativePath(match[0]),
                        contents: this.parseFileContents(match[0])
                    });
                }
                resolve(files);
            });
        });
    }

    parseRelativePath(bypassFile) {
        const RELATIVE_FILEPATH_PATTERN = /<RELATIVE-FILEPATH>([\s\S]+?)<\/RELATIVE-FILEPATH>/;
        let relativeFilepath = bypassFile.match(RELATIVE_FILEPATH_PATTERN);
        return relativeFilepath[1];
    }

    parseFileContents(bypassFile) {
        const BYPASS_FILE_CONTENTS_PATTERN = /<BYPASS-FILE-CONTENTS>([\s\S]+?)<\/BYPASS-FILE-CONTENTS>/;
        let fileContents = bypassFile.match(BYPASS_FILE_CONTENTS_PATTERN);
        return fileContents[1];
    }

    copyFile(relativeFilePath) {
        return new Promise((resolve, reject) => {
            let srcFilePath = pathUtil.join(this.config.targetDirectory, relativeFilePath);
            let destFilePath = pathUtil.join(this.config.outputDirectory, relativeFilePath);
            fs.copy(srcFilePath, destFilePath, (err) => {
                if (err) {
                    reject(err);
                }
                resolve(destFilePath);
            });
        });
    }

    buildText(file) {
        let text = '<BYPASS-FILE>';
        text += `<RELATIVE-FILEPATH>${this.getRelativePath(file)}</RELATIVE-FILEPATH>`;
        text += `<BYPASS-FILE-CONTENTS>${fs.readFileSync(file)}</BYPASS-FILE-CONTENTS>`;
        text += '</BYPASS-FILE>';
        return text;
    }

    getRelativePath(file) {
        return file.replace(this.config.targetDirectory + pathUtil.sep, '');
    }

    createOutputDirectory() {
        return new Promise((resolve, reject) => {
            fs.ensureDir(this.config.outputDirectory, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.config.outputDirectory);
                this.config.outputDirectory = pathUtil.resolve(this.config.outputDirectory);
            });
        });
    }

    emptyOutputDirectory() {
        return new Promise((resolve, reject) => {
            if (this.config['clean-output-dir']) {
                del([
                    `${this.config.outputDirectory}/**`,
                    `!${this.config.outputDirectory}`,
                    `${this.config.outputDirectory}/**/*`
                ]).then(() => {
                    resolve(this.config.outputDirectory);
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    walkDirectory(directory) {
        return new Promise((resolve) => {
            let files = [];
            fs.walk(directory)
                .on('data', (file) => {
                    if (file.stats.isFile()) {
                        files.push(file.path);
                    }
                })
                .on('end', () => {
                    resolve(files);
                });
        });
    }
}

export default Bypass;
