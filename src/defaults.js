export default {
    ignoreList: ['jpeg', 'jpg', 'png', 'doc', 'docx', 'gif'],
    processType: false,
    targetDirectory: __dirname,
    outputDirectory: 'output',
    outputFile: 'bypass-file.txt',
    'clean-output-dir': true,
    manifestFile: `_manifest.${Date.now()}.json`,
    fileDelimiter: '###FILE_DELIMITER###'.repeat(3)
};
