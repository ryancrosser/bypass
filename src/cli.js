import "babel-polyfill";

import path from 'path';
import minimist from 'minimist';
var argv = minimist(process.argv.slice(2));

let cli = {};

if(argv._.includes('up')){
    cli.processType = 'UP';
}
if(argv._.includes('down')){
    cli.processType = 'DOWN';
}
if(argv.file){
    cli.targetFile = path.resolve(argv.file);
} else if(argv.dir){
    cli.targetDirectory = path.resolve(argv.dir);
}
if(argv.output){
    cli.outputDirectory = argv.output;
}
if(argv['line-length']){
    cli['line-length'] = argv['line-length'];
}
if(argv['clean-output-dir']){
    cli['clean-output-dir'] = argv['clean-output-dir'];
}
if(argv.manifest){
    cli.manifest = argv.manifest;
}
if(argv['ignore-types']){
    let ignoreList = argv['ignore-types'].split(',');
    
    cli['ignore-types'] = ignoreList.map((type) => {
        return type.trim();
    });
}

export default cli;
