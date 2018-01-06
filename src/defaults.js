import path from 'path';

export default {
  ignoreList: [
    '7z',
    'app',
    'asar_',
    'doc',
    'docx',
    'DS_Store',
    'eot',
    'exe',
    'gif',
    'gzip',
    'ico',
    'jpeg',
    'jpg',
    'otf',
    'png',
    'rar',
    'sketch',
    'tgz',
    'ttf',
    'woff',
    'woff2',
    'un~',
    'zip'
  ],
  processType: false,
  targetDirectory: path.resolve(),
  outputDirectory: 'bypass-output',
  outputFile: 'bypass-file.txt',
  format: 'docx',
  'clean-output-dir': true,
  chunkSize: 2 // 2 million bytes
};
