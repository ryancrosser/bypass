import path from 'path';

export default {
    ignoreList: ['DS_Store', 'jpeg', 'jpg', 'png', 'doc', 'docx', 'gif', 'zip', '7z', 'exe', 'app', 'tar', 'rar', 'gzip'],
    processType: false,
    targetDirectory: path.resolve(),
    outputDirectory: 'bypass-output',
    outputFile: 'bypass-file',
    format: 'docx',
    'clean-output-dir': true,
    chunkSize: 2 // 2 million bytes
};
