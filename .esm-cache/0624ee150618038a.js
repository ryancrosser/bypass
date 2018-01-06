let path;_061‍.w('path',[["default",function(v){path=v}]]);

_061‍.d({
    ignoreList: ['DS_Store', 'jpeg', 'jpg', 'png', 'doc', 'docx', 'gif', 'zip', '7z', 'exe', 'app', 'tar', 'rar', 'gzip'],
    processType: false,
    targetDirectory: path.resolve(),
    outputDirectory: 'bypass-output',
    outputFile: 'bypass-file',
    format: 'docx',
    'clean-output-dir': true,
    chunkSize: 2 // in mB
});
