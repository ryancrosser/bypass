import "babel-polyfill";

import _ from 'lodash';
import directoryTree from 'directory-tree';
import fs from 'fs-extra';
import path from 'path';
import ProgressBar from 'progress';

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
    let manifest = buildManifest(fileList, config);

    if (config.processType === 'UP') {
        // write the directory tree to the output directory
        fs.writeFile(path.join(path.resolve(config.outputDirectory), config.manifestFile), JSON.stringify(manifest, null, 4), (err) => {
            if (err) {
                throw Error(err);
            }
        });
    }

    processFiles(manifest, config);
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
    let pathSeparatorPattern = new RegExp('\\' + path.sep, 'g');
    return filePaths.map((filePath) => {
        return {
            fileName: path.basename(filePath),
            filePath: filePath.slice(config.targetDirectory.length + 1),
            filePathConverted: filePath.slice(config.targetDirectory.length + 1).replace(pathSeparatorPattern, config.fileDelimiter)
        };
    });
}

function parseManifest(manifestFile, config) {
    let manifestPattern = new RegExp(/manifest\.\d{13}\.json/, '');
    if (!manifestPattern.test(config.manifestFile)) {
        manifestPattern = new RegExp(config.manifestFile);
    }
    let manifestFilePath = manifestFile.filter((manifest) => {
        return manifestPattern.test(manifest.fileName);
    });
    let targetFilePath = path.join(path.resolve(config.targetDirectory), manifestFilePath[0].fileName); 

    let data = fs.readFileSync(targetFilePath, 'utf8');
    
    return JSON.parse(data).map((d) => { 
        return {
            fileName: d.fileName,
            filePath: path.join(config.outputDirectory, d.filePath),
            filePathConverted: d.filePathConverted
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

function processFiles(manifestFile, config) {
    if (config.processType === 'UP') {
        manifestFile.forEach((manifest) => {
            let targetFilePath = path.resolve(path.join(config.outputDirectory, manifest.filePathConverted));
            if(config.ignoreList.includes(path.extname(manifest.fileName).slice(1))){
                // do not process file, just copy to output directory
                let fromFilePath = path.resolve(path.join(config.targetDirectory, manifest.filePath));
                fs.writeFileSync(targetFilePath, fs.readFileSync(fromFilePath));
            } else {
                processFileForUp(path.resolve(path.join(config.targetDirectory, manifest.filePath)), config).then((data) => {
                    writeFile(targetFilePath, data);
                });
            }
        });
    } else if (config.processType === 'DOWN') {
        let fileDelimiterPattern = new RegExp(config.fileDelimiter, 'g');
        let filePaths = parseManifest(manifestFile, config);
        filePaths.forEach((fp) => {
            let targetFilePath = path.join(path.resolve(config.outputDirectory), fp.filePath);
            fs.ensureFileSync(targetFilePath);
            if(config.ignoreList.includes(path.extname(fp.fileName).slice(1))){
                // do not process file, just copy to output directory
                let fromFilePath = path.resolve(path.join(config.targetDirectory, fp.filePathConverted));
                fs.writeFileSync(targetFilePath, fs.readFileSync(fromFilePath));
            } else {
                processFileForDown(path.join(config.targetDirectory, fp.filePathConverted)).then((data) => {
                    writeFile(targetFilePath, data);
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
            } else {
                // remove line breaks
                let newData = data.replace(/\r\n/g, '__BACKSLASH_R_BACKSLASH_N__')
                    .replace(/\n/g, '__BACKSLASH_N__')
                    .replace(/\r/g, '__BACKSLASH_R__');

                for (let r in replacers) {
                    if (replacers.hasOwnProperty(r)) {
                        // remove character that can throw errors
                        newData = newData.replace(replacers[r], r);
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
                    let re = new RegExp(r, 'g');
                    // console.log(replacers[r].source.replace(/\\/g, ''))
                    newData = newData.replace(re, replacers[r].source.replace(/\\/g, ''));

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
