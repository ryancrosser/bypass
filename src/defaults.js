export default {
    ignoreList: ['jpeg', 'jpg', 'png', 'doc', 'docx', 'gif'],
    processType: false,
    targetDirectory: __dirname,
    outputDirectory: 'output',
    'line-length': 100,
    'clean-output-dir': true,
    manifestFile: '_manifest.' + Date.now() + '.json',
    fileDelimiter: '___'
};