import "babel-polyfill";

import _ from 'lodash';
import fs from 'fs-extra';
import path from 'path';
import directoryTree from 'directory-tree';

import cliOptions from './cli.js';
import replacers from './replacers.js';
import defaults from './defaults.js';

let config = _.extend({}, defaults, cliOptions);

// create the output folder
fs.ensureDirSync(config.outputDirectory);

process(config);

function process() {
    let directory = directoryTree.directoryTree(config.targetDirectory);

    // empty output directory
    if (config['clean-output-dir']) {
        fs.emptyDirSync(path.resolve(config.outputDirectory));
    }
    let fileList = parseDirectory(directory);

    if (config.processType === 'UP') {
        // write the directory tree to the output directory
        fs.writeFile(path.join(path.resolve(config.outputDirectory), config.manifestFile), JSON.stringify(buildManifest(fileList, config), null, 4), (err) => {
            if (err) {
                throw Error(err);
            }
        });
    }

    processFiles(fileList, config);
}

function parseDirectory(directory) {
    let temp = [];
    let filePaths;
    if (directory.children && Array.isArray(directory.children)) {
        filePaths = recuseChildren(directory.children, temp);
    }
    return filePaths;
}

function buildManifest(filePaths, config) {
    return filePaths.map((file) => {
        return {
            fileName: path.basename(file),
            // filePath: file.slice(config.targetDirectory.length + 1).replace(/\\/g, config.fileDelimiter),
            filePath: file.slice(config.targetDirectory.length + 1)
        };
    });
}

function parseManifest(fileList, config) {
    let manifestPattern = new RegExp(/manifest\.\d{13}\.json/, '');
 
    if (!manifestPattern.test(config.manifestFile)) {
        manifestPattern = new RegExp(config.manifestFile);
    }

    let manifestFilePath = fileList.filter((file) => {
        return manifestPattern.test(file);
    });

    let data = fs.readFileSync(manifestFilePath[0], 'utf8');

    return JSON.parse(data).map((d) => {
        return {
            fileName: d.fileName,
            filePath: path.join(config.outputDirectory, d.filePath)
        }
    });
}

function recuseChildren(nodeTree, holdingArr) {
    nodeTree.forEach((node) => {
        if (node.children) {
            return recuseChildren(node.children, holdingArr)
        } else {
            holdingArr.push(path.join(config.targetDirectory, node.path));
        }
    });

    return holdingArr; 
}

function processFiles(fileList, config) {
    if (config.processType === 'UP') {
        fileList.map((filePath) => {
            let fileName = path.basename(filePath);
            if(config.ignoreList.includes(path.extname(filePath).slice(1))){
                // do not process file, just copy to output directory
                fs.writeFileSync(path.join(config.outputDirectory, fileName), fs.readFileSync(filePath));
            } else {
                processFileForUp(filePath, config).then((data) => {
                    let filePath = path.join(path.resolve(config.outputDirectory), fileName);
                    writeFile(filePath, data);
                });
            }
        });

    } else if (config.processType === 'DOWN') {
        let filePaths = parseManifest(fileList, config);
        filePaths.map((fp) => {
            if(config.ignoreList.includes(path.extname(fp.fileName).slice(1))){
                // copy file for target to output
                fs.ensureFileSync(fp.filePath);
                fs.writeFileSync(path.resolve(fp.filePath), fs.readFileSync(path.join(config.targetDirectory, fp.fileName)));
            } else {
                fs.ensureFileSync(fp.filePath);
                processFileForDown(path.join(config.targetDirectory, fp.fileName)).then((data) => {
                    writeFile(fp.filePath, data);
                });
            }

        });
    }
}

function writeFile(filePath, fileContent) {
    fs.writeFile(filePath, fileContent, (err) => {
        if (err) {
            throw Error(err);
        }
    });
}

function processFileForUp(filePath, config) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }

            // remove line breaks
            let newData = data
                .replace(/\r\n/g, '__BACKSLASH_R_BACKSLASH_N__')
                .replace(/\n/g, '__BACKSLASH_N__')
                .replace(/\r/g, '__BACKSLASH_R__');

            for (let r in replacers) {
                if (replacers.hasOwnProperty(r)) {
                    // remove character that can throw errors
                    let re = new RegExp(r, 'ig');
                    newData = newData.replace(re, replacers[r]);
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
    let insertStr = '__GENERATED_LINE_BREAK__\n';
    let loopCount = 1;
    let start = 0;
    while (start < file.length) {
        let first = file.slice(0, start + lineLength);
        let last = file.slice(start + lineLength);

        file = first + insertStr + last;
        start = (lineLength * loopCount) + insertStr.length;
        loopCount++;
    }
    return file;
}

function processFileForDown(filePath) {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                reject(err);
            }

            let newData = removeGeneratedLineBreak(data);
            for (let r in replacers) {
                if (replacers.hasOwnProperty(r)) {
                    // remove character that can throw errors
                    let re = new RegExp(replacers[r], 'g');
                    newData = newData.replace(re, r.replace(/\\/g, ''));

                    // remove line breaks
                    newData = newData
                        .replace(/__BACKSLASH_R_BACKSLASH_N__/g, '\r\n')
                        .replace(/__BACKSLASH_N__/g, '\n')
                        .replace(/__BACKSLASH_R__/g, '\r');
                }
            }

            resolve(newData);
        });
    });
}

function removeGeneratedLineBreak(file) {
    return file.replace(/__GENERATED_LINE_BREAK__\n/g, '');
}
