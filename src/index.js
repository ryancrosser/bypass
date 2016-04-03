import fs from 'fs-extra';
import path from 'path';
import recursive from 'recursive-readdir';
import {argv} from 'yargs';

let processType = false;

if(argv.up){
    processType = 'UP';
}
if(argv.down){
    processType = 'DOWN';
}

let targetDirectory = __dirname;
if(argv.dir){
    targetDirectory = argv.dir;
    targetDirectory = path.resolve(targetDirectory)
}

console.log(targetDirectory);

let targetFile = '';
if(argv.file){
    targetFile = argv.file = targetFile;
}
let outputDirectory = 'output';
if(argv.output){
    outputDirectory = argv.output;
}
fs.ensureDirSync(outputDirectory);
 
let lineLength  = false;
if(argv.lineLength){
    lineLength = argv.lineLength;
}

process(processType, targetDirectory, outputDirectory, lineLength);

let replacers = {
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

function process(processType, targetDirectory, outputDirectory, lineLength){
    // empty output directory
    fs.emptyDirSync(path.resolve(outputDirectory));
    getAllFileInDirectory(targetDirectory).then((files) => {
        files.forEach((file) => {
            fs.readFile(file, 'utf8', (err, data) => {
                if (err) {
                    throw Error(err);
                }
                let fileName = path.basename(file);
                let fileContent = '';
                if(processType === 'UP') {
                    fileContent = processFileForUp(data, lineLength)
                } else if(processType === 'DOWN'){
                    fileContent = processFileForDown(data)
                }

                fs.writeFile(path.join(path.resolve(outputDirectory), fileName), fileContent, (err) => {
                    if (err) {
                        throw Error(err);
                    }
                });
            });
        });
    }).catch((err) => {
        throw Error(err);
    });
}

function getAllFileInDirectory(targetDirectory){
    return new Promise((resolve, reject) => {
        recursive(targetDirectory, function (err, files) {
            if(err){
                reject(err);
            }

            // Files is an array of filename
            resolve(files);

        });
    });
}

function processFileForUp(file, lineLength){
    let newFile = file;
    let temp = '';
    for(let r in replacers){
        if(replacers.hasOwnProperty(r)){
            // remove line breaks
            newFile = newFile.replace(/\r\n/g, '__BACKSLASH_R_BACKSLASH_N__');
            newFile = newFile.replace(/\n/g, '__BACKSLASH_N__');
            newFile = newFile.replace(/\r/g, '__BACKSLASH_R__');

            // remove character that can throw errors
            let re = new RegExp(r, 'ig');
            newFile = newFile.replace(re, replacers[r]);

            temp = newFile;
            if(lineLength){
                temp = breakAtLineLength(newFile, lineLength);
            }
        }
    }

    return temp;
}

function spliceSlice(str, index, count, add) {
    return str.slice(0, index) + (add || "") + str.slice(index + count);
}

function breakAtLineLength(file, lineLength){
    let insertStr = '__ARBITRARY_LINE_BREAK__\n';


    start = 0;
    while(index < file.length){
        file.slice(start, index) + insertStr + file.slice(index + count);


        newFile.push(temp.splice(0, lineLength).join(''));
        console.log(temp.length)

        start = index + count + insertStr.length;
    }
    return newFile.join('__ARBITRARY_LINE_BREAK__\n');
}

function processFileForDown(file){
    let newFile = file;
    newFile = removeArbitaryLineBreak(file);

    for(let r in replacers){
        if(replacers.hasOwnProperty(r)){
            // remove character that can throw errors
            let re = new RegExp(replacers[r], 'g');
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

function removeArbitaryLineBreak(file){
    return file.replace(/__ARBITRARY_LINE_BREAK__\n/g, '');
}