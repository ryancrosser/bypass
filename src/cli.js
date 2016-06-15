import pathUtil from 'path';
import minimist from 'minimist';

let argv = minimist(process.argv.slice(2), {
    alias: {
        c: 'clean-output-dir',
        d: 'dir',
        i: 'ignore-types',
        o: 'output',
        h: 'help'
    }
});

const cli = {};

if (argv._.includes('up') || argv._.includes('UP')) {
    cli.processType = 'UP';
} else if (argv._.includes('down') || argv._.includes('DOWN')) {
    cli.processType = 'DOWN';
}

if (argv.file) {
    cli.targetFile = pathUtil.resolve(argv.file);
} else if (argv.dir) {
    console.log(argv.dir);
    cli.targetDirectory = pathUtil.resolve(argv.dir);
}

if (argv.output) {
    cli.outputDirectory = argv.output;
}

if (argv['clean-output-dir']) {
    cli['clean-output-dir'] = argv['clean-output-dir'];
}
if (argv['out-file']) {
    cli.outputFile = argv['out-file'];
}

if (argv['ignore-types']) {
    let ignoreList = argv['ignore-types'].split(',');
    cli.ignoreList = ignoreList.map(type => type.trim());
}

if (argv.help) {
    cli.help = true;
}

export default cli;
