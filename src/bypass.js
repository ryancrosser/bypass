import async from 'async';
import 'colors';
import del from 'del';
import fs from 'fs-extra';
import mammoth from 'mammoth';
import officegen from 'officegen';
import path from 'path';

import cliOptions from './cli.js';
import defaults from './defaults.js';

// console.log('cli', cliOptions);

class Bypass {
    constructor() {
        this.config = Object.assign({}, defaults, cliOptions);
        console.log(this.config);
        this.process();
    }

    process() {
        /* eslint-disable no-console */
        if (this.config.help || this.config.processType === 'HELP') {
            fs.createReadStream(`${path.resolve(path.dirname(''))}/src/help.txt`).pipe(process.stdout);
            return;
        } else if (this.config.processType === 'UP' || this.config.processType === 'DOWN') {
            let promises = [];
            Promise.all([this.createOutputDirectory(), this.emptyOutputDirectory()])
                .then(() => {
                    if (this.config.processType === 'UP') {
                        promises.push(this.up());
                    } else if (this.config.processType === 'DOWN') {
                        promises.push(this.down());
                    } else {
                        promises.push(Promise.reject());
                    }

                    Promise.all(promises).then((msg) => {
                        console.log();
                        console.log(msg[0].green);
                        console.log();
                    })
                        .catch((err) => {
                            console.log('12121212', err);
                            console.log();
                            console.log(err.message.red);
                            console.log();
                        });
                });
        } else {
            console.log();
            console.log('Invalid or missing process type. Use --help for information on how to use Bypass.'.red);
            console.log();
        }
        /* eslint-enable no-console */
    }

    up() {
        return new Promise((resolve, reject) => {
            this.walkDirectory(this.config.targetDirectory).then((files) => {
                let textArr = [];

                files.forEach(file => {
                    let relativeFilePath = this.getRelativePath(file);
                    if (this.config.ignoreList.includes(this.determineFileExtension(file))) {
                        // do not process file, just copy to output directory
                        this.copyFile(relativeFilePath);
                    } else {
                        textArr.push(this.buildText(file));
                    }
                });
                let chunks = [textArr[0]];

                for (let i = 1, len = textArr.length; i < len; i++) {
                    if (Buffer.byteLength(chunks[chunks.length - 1], 'utf8') < this.config.chunkSize * 10000000) {
                        chunks[chunks.length - 1] += textArr[i];
                    } else {
                        chunks.push(textArr[i]);
                    }
                }
                console.log(chunks.length);
                const promises = [];
                chunks.forEach((chunk, i) => {
                    let filepath = path.join(this.config.outputDirectory, `${this.config.outputFile}.p${i}.${this.config.format}`);
                    if (this.config.format.toUpperCase() === 'DOCX') {
                        promises.push(this.generateDocxOutput(filepath, chunk));
                    } else {
                        promises.push(this.generateTextOutput(filepath, chunk));
                    }
                });

                Promise.all(promises).then(() => {
                    resolve(`All files in target directory have been processed and are in ${this.config.outputDirectory}.`);
                });
            });
        });
    }

    down() {
        return new Promise((resolve, reject) => {
            this.walkDirectory(this.config.targetDirectory).then((files) => {
                const re = new RegExp(`${this.config.outputFile}.p\\d+.${this.config.format}`, 'i');
                let bypassFilesPath = files.filter(file => re.test(file));

                let bypassFilePromise;
                let copyFilePromise;
                if (!bypassFilesPath) {
                    resolve(`No Bypass File found in target directory [${this.config.targetDirectory}].`);
                } else {
                    // remove all bypass files from files array
                    bypassFilesPath.forEach((file) => {
                        files.splice(files.indexOf(file), 1);
                    });

                    bypassFilePromise = new Promise((bypassFileResolve, bypassFileReject) => {
                        this.parseBypassFiles(bypassFilesPath).then((bypassFiles) => {
                            console.log(22222, bypassFilesPath);
                            bypassFiles.forEach((bf) => {
                                let destFilepath = path.join(this.config.outputDirectory, bf.relativePath);
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
                        resolve(`All files in Bypass File [${this.config.outputFile}.${this.config.format}] and target directory have been processed and are in ${this.config.outputDirectory}`);
                    })
                    .catch((err) => {
                        reject(err);
                    });
            });
        });
    }

    parseBypassFiles(bypassFilePaths) {
        return new Promise((resolve, reject) => {
            const promises = [];
            bypassFilePaths.forEach(file => {
                const ext = this.determineFileExtension(file);
                if (ext.toUpperCase() === 'TXT') {
                    promises.push(this.parseTextBypassFile(file));
                } else if (ext.toUpperCase() === 'DOCX') {
                    promises.push(this.parseDocxBypassFile(file));
                }
            });

            Promise.all(promises).then((results) => {
                console.log('33333', results);
                resolve(results);
            }).catch(err => {
                reject(err);
            });
        });
    }

    parseTextBypassFile(filePath) {
        return new Promise((resolve, reject) => {
            let files = [];
            const BYPASS_FILE_PATTERN = /<REPLACER-FILE>[\s\S]+?<\/REPLACER-FILE>/g;
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    reject(err);
                }
                let match;
                while ((match = BYPASS_FILE_PATTERN.exec(data)) !== null) {
                    files.push({
                        relativePath: this.parseRelativePath(match[0]),
                        contents: this.parseFileContents(match[0])
                    });
                }
                resolve(files);
            });
        });
    }

    parseDocxBypassFile(filePath) {
        return new Promise((resolve, reject) => {
            let files = [];
            const BYPASS_FILE_PATTERN = /<REPLACER-FILE>[\s\S]+?<\/REPLACER-FILE>/g;
            mammoth.extractRawText({path: filePath}).then(result => {
                const content = result.value;
                let match;
                while ((match = BYPASS_FILE_PATTERN.exec(content)) !== null) {
                    console.log('files', match);
                    files.push({
                        relativePath: this.parseRelativePath(match[0]),
                        contents: this.parseFileContents(match[0])
                    });
                }
                resolve(files);
            }).catch(err => {
                reject(err);
            });
        });
    }

    parseRelativePath(bypassFile) {
        const RELATIVE_FILEPATH_PATTERN = /<RELATIVE-FILEPATH>([\s\S]+?)<\/RELATIVE-FILEPATH>/;
        let relativeFilepath = bypassFile.match(RELATIVE_FILEPATH_PATTERN);
        return relativeFilepath[1];
    }

    parseFileContents(bypassFile) {
        const BYPASS_FILE_CONTENTS_PATTERN = /<REPLACER-FILE-CONTENTS>([\s\S]+?)<\/REPLACER-FILE-CONTENTS>/;
        let fileContents = bypassFile.match(BYPASS_FILE_CONTENTS_PATTERN);
        return fileContents[1];
    }

    copyFile(relativeFilePath) {
        return new Promise((resolve, reject) => {
            let srcFilePath = path.join(this.config.targetDirectory, relativeFilePath);
            let destFilePath = path.join(this.config.outputDirectory, relativeFilePath);

            fs.copy(srcFilePath, destFilePath, (err) => {
                if (err) {
                    reject(err);
                }
                resolve(destFilePath);
            });
        });
    }

    buildText(file) {
        let text = '<REPLACER-FILE>';
        text += `<RELATIVE-FILEPATH>${this.getRelativePath(file)}</RELATIVE-FILEPATH>`;
        text += `<REPLACER-FILE-CONTENTS>${fs.readFileSync(file, 'utf8')}</REPLACER-FILE-CONTENTS>`;
        text += '</REPLACER-FILE>';
        return text;
    }

    getRelativePath(file) {
        return file.replace(this.config.targetDirectory + path.sep, '');
    }

    createOutputDirectory() {
        return new Promise((resolve, reject) => {
            fs.ensureDir(this.config.outputDirectory, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.config.outputDirectory);
                this.config.outputDirectory = path.resolve(this.config.outputDirectory);
            });
        });
    }

    emptyOutputDirectory() {
        return new Promise((resolve, reject) => {
            if (this.config['clean-output-dir'] === true) {
                del([
                    `${this.config.outputDirectory}/**`,
                    `!${this.config.outputDirectory}`,
                    `${this.config.outputDirectory}/**/*`
                ]).then(() => {
                    resolve(this.config.outputDirectory);
                }).catch((err) => {
                    reject(err);
                });
            } else {
                resolve(this.config.outputDirectory);
            }
        });
    }

    walkDirectory(directory) {
        console.log('walkDirectory');
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

    determineFileExtension(filePath) {
        let ext = path.extname(filePath).slice(1);

        if (ext) {
            return ext;
        }

        ext = filePath.slice(filePath.lastIndexOf('/') + 1);

        if (ext.startsWith('.')) {
            ext = ext.slice(1);
        }
        return ext;
    }

    generateTextOutput(filePath, fileContents) {
        return new Promise((resolve, reject) => {
            fs.writeFile(filePath, fileContents, (err) => {
                if (err) {
                    reject(err);
                }
                resolve(true);
            });
        });
    }

    generateDocxOutput(filePath, fileContents) {
        return new Promise((resolve, reject) => {
            const docx = officegen({
                type: 'docx',
                orientation: 'portrait'
            });

            // Remove this comment in case of debugging Officegen:
            // officegen.setVerboseMode ( true );

            docx.on('error', (err) => {
                return reject(err);
            });

            const pObj = docx.createP();

            pObj.addText(fileContents);

            const out = fs.createWriteStream(filePath);

            out.on('error', (err) => {
                return reject(err);
            });

            async.parallel([
                (done) => {
                    out.on('close', () => {
                        resolve(true);
                        done(null);
                    });
                    docx.generate(out);
                }
            ], (err) => {
                if (err) {
                    reject(err);
                }
            });
        });
    }
}

export default Bypass;
