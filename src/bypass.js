import async from 'async';
import colors from 'colors/safe';
import del from 'del';
import fs from 'fs-extra';
import isBinaryFile from 'isbinaryfile';
import klaw from 'klaw';
import mammoth from 'mammoth';
import officegen from 'officegen';
import pathUtil from 'path';

import cliOptions from './cli.js';
import defaults from './defaults.js';

class Bypass {
  constructor() {
    this.config = Object.assign({}, defaults, cliOptions);

    if (this.config.debug) {
      this.debugProperties = {};
      this.debugProperties.extensions = new Set();
      console.log(
        `${colors.underline.yellow('CLI Arguments:')} \n${colors.yellow(
          JSON.stringify(cliOptions, null, 2)
        )}`
      );
    }

    this.process();
  }

  async process() {
    /* eslint-disable no-console */
    if (this.config.help || this.config.processType === 'HELP') {
      return this.showHelpMessage();
    } else if (this.config.processType === 'UP' || this.config.processType === 'DOWN') {
      try{
        await this.createOutputDirectory();
        await this.emptyOutputDirectory();

        let message;
        if (this.config.processType === 'UP') {
          message = await this.up();
        } else if (this.config.processType === 'DOWN') {
          message = await this.down();
        } else {
          promises.push(Promise.reject());
        }
        this.outputMessage(message, 'green');
      } catch (err) {
        this.outputMessage(err.message, 'red');
      }
    } else {
      this.outputMessage('Invalid or missing process type. Use --help for information on how to use Bypass.', 'red');
    }
    /* eslint-enable no-console */
  }

  up() {
    return new Promise((resolve, reject) => {
      this.walkDirectory(this.config.targetDirectory).then(files => {
        let textArr = [];

        files.forEach(file => {
          let relativeFilePath = this.getRelativePath(file);
          const extension = this.determineFileExtension(file);
          if (this.config.debug) {
            this.debugProperties.extensions.add(extension);
          }
          if (isBinaryFile.sync(file) || this.config.ignoreList.includes(extension)) {
            // do not process file, just copy to output directory
            this.copyFile(relativeFilePath);
          } else {
            textArr.push(this.buildText(file));
          }
        });

        let chunks = [textArr[0]];

        for (let i = 1, len = textArr.length; i < len; i++) {
          if (
            Buffer.byteLength(chunks[chunks.length - 1], 'utf8') <
            this.config.chunkSize * 10000000
          ) {
            chunks[chunks.length - 1] += textArr[i];
          } else {
            chunks.push(textArr[i]);
          }
        }

        const promises = [];
        chunks.forEach((chunk, i) => {
          let filepath = pathUtil.join(
            this.config.outputDirectory,
            `${this.config.outputFile}.p${i}.${this.config.format}`
          );
          if (this.config.format.toUpperCase() === 'DOCX') {
            promises.push(this.generateDocxOutput(filepath, chunk));
          } else {
            promises.push(this.generateTextOutput(filepath, chunk));
          }
        });

        Promise.all(promises).then(() => {
          if (this.config.debug) {
            console.log(
              `${colors.underline.yellow('Processed File Extensions:')} \n ${colors.yellow(
                JSON.stringify(
                  Array.from(this.debugProperties.extensions).sort((a, b) => {
                    if (a.toUpperCase() < b.toUpperCase()) {
                      return -1;
                    } else if (a.toUpperCase() > b.toUpperCase()) {
                      return 1;
                    } else {
                      return 0;
                    }
                  }),
                  null,
                  2
                )
              )}`
            );
          }
          resolve(
            `All files in target directory have been processed and are in ${
              this.config.outputDirectory
            }.`
          );
        });
      });
    });
  }

  down() {
    return new Promise((resolve, reject) => {
      this.walkDirectory(this.config.targetDirectory).then(files => {
        const re = new RegExp(`${this.config.outputFile}.p\\d+.${this.config.format}`, 'i');
        let bypassFilesPath = files.filter(file => re.test(file));

        let bypassFilePromise;
        let copyFilePromise;
        if (!bypassFilesPath) {
          resolve(`No Bypass File found in target directory [${this.config.targetDirectory}].`);
        } else {
          // remove all bypass files from files array
          bypassFilesPath.forEach(file => {
            files.splice(files.indexOf(file), 1);
          });

          bypassFilePromise = new Promise((bypassFileResolve, bypassFileReject) => {
            this.parseBypassFiles(bypassFilesPath).then(bypassFiles => {
              bypassFiles.forEach(bf => {
                let destFilepath = pathUtil.join(this.config.outputDirectory, bf.relativePath);
                fs.ensureFile(destFilepath, err => {
                  if (err) {
                    bypassFileReject(err);
                  }
                  fs.writeFile(destFilepath, bf.contents, writeErr => {
                    if (writeErr) {
                      bypassFileReject(writeErr);
                    }
                    bypassFileResolve(true);
                  });
                });
              });
            });
          });

          copyFilePromise = new Promise((copyFileResolve, copyFileReject) => {
            async.each(
              files,
              (file, callback) => {
                this.copyFile(this.getRelativePath(file)).then(() => {
                  callback();
                });
              },
              err => {
                if (err) {
                  copyFileReject(err);
                }
                copyFileResolve(true);
              }
            );
          });
        }

        Promise.all([bypassFilePromise, copyFilePromise])
          .then(() => {
            resolve(
              `All files in Bypass File [${this.config.outputFile}.${
                this.config.format
              }] and target directory have been processed and are in ${this.config.outputDirectory}`
            );
          })
          .catch(err => {
            reject(err);
          });
      });
    });
  }

  parseBypassFiles(bypassFilePaths) {
    return new Promise((resolve, reject) => {
      const promises = [];
      bypassFilePaths.forEach(file => {
        const ext = this.determineFileExtension(file);
        if (ext.toUpperCase() === 'DOCX') {
          promises.push(this.parseDocxBypassFile(file));
        } else {
          promises.push(this.parseTextBypassFile(file));
        }
      });

      Promise.all(promises)
        .then(results => {
          resolve(results[0]);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  parseTextBypassFile(filePath) {
    return new Promise((resolve, reject) => {
      let files = [];
      const BYPASS_FILE_PATTERN = /<REPLACER-FILE>[\s\S]+?<\/REPLACER-FILE>/g;
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
        }
        let match;
        while ((match = BYPASS_FILE_PATTERN.exec(data)) !== null) {
          files.push({
            relativePath: this.parseRelativePath(match[0]),
            contents: this.parseFileContents(match[0])
          });
        }
        resolve(files);
      });
    });
  }

  parseDocxBypassFile(filePath) {
    return new Promise((resolve, reject) => {
      let files = [];
      const BYPASS_FILE_PATTERN = /<REPLACER-FILE>[\s\S]+?<\/REPLACER-FILE>/g;
      mammoth
        .extractRawText({ path: filePath })
        .then(result => {
          const content = result.value;
          let match;
          while ((match = BYPASS_FILE_PATTERN.exec(content)) !== null) {
            files.push({
              relativePath: this.parseRelativePath(match[0]),
              contents: this.parseFileContents(match[0])
            });
          }
          resolve(files);
        })
        .catch(err => {
          reject(err);
        });
    });
  }

  parseRelativePath(bypassFile) {
    const RELATIVE_FILEPATH_PATTERN = /<RELATIVE-FILEPATH>([\s\S]+?)<\/RELATIVE-FILEPATH>/;
    let relativeFilepath = bypassFile.match(RELATIVE_FILEPATH_PATTERN);
    return relativeFilepath[1];
  }

  parseFileContents(bypassFile) {
    const BYPASS_FILE_CONTENTS_PATTERN = /<REPLACER-FILE-CONTENTS>([\s\S]+?)<\/REPLACER-FILE-CONTENTS>/;
    let fileContents = bypassFile.match(BYPASS_FILE_CONTENTS_PATTERN);
    return fileContents[1];
  }

  copyFile(relativeFilePath) {
    return new Promise((resolve, reject) => {
      let srcFilePath = pathUtil.join(this.config.targetDirectory, relativeFilePath);
      let destFilePath = pathUtil.join(this.config.outputDirectory, relativeFilePath);

      fs.copy(srcFilePath, destFilePath, err => {
        if (err) {
          reject(err);
        }
        resolve(destFilePath);
      });
    });
  }

  buildText(file) {
    let text = '<REPLACER-FILE>';
    text += `<RELATIVE-FILEPATH>${this.getRelativePath(file)}</RELATIVE-FILEPATH>`;
    text += `<REPLACER-FILE-CONTENTS>${fs.readFileSync(file, 'utf8')}</REPLACER-FILE-CONTENTS>`;
    text += '</REPLACER-FILE>';
    return text;
  }

  getRelativePath(file) {
    return file.replace(this.config.targetDirectory + pathUtil.sep, '');
  }

  createOutputDirectory() {
    return new Promise((resolve, reject) => {
      fs.ensureDir(this.config.outputDirectory, err => {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.config.outputDirectory);
        this.config.outputDirectory = pathUtil.resolve(this.config.outputDirectory);
      });
    });
  }

  emptyOutputDirectory() {
    return new Promise((resolve, reject) => {
      if (this.config['clean-output-dir'] === true) {
        del([
          `${this.config.outputDirectory}/**`,
          `!${this.config.outputDirectory}`,
          `${this.config.outputDirectory}/**/*`
        ])
          .then(() => {
            resolve(this.config.outputDirectory);
          })
          .catch(err => {
            reject(err);
          });
      } else {
        resolve(this.config.outputDirectory);
      }
    });
  }

  walkDirectory(directory) {
    return new Promise(resolve => {
      let files = [];
      klaw(directory)
        .on('data', file => {
          if (file.stats.isFile()) {
            files.push(file.path);
          }
        })
        .on('end', () => {
          resolve(files);
        });
    });
  }

  determineFileExtension(filePath) {
    let ext = pathUtil.extname(filePath).slice(1);

    if (ext) {
      return ext;
    }

    ext = filePath.slice(filePath.lastIndexOf('/') + 1);

    if (ext.startsWith('.')) {
      ext = ext.slice(1);
    }
    return ext;
  }

  generateTextOutput(filePath, fileContents) {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, fileContents, err => {
        if (err) {
          reject(err);
        }
        resolve(true);
      });
    });
  }

  generateDocxOutput(filePath, fileContents) {
    return new Promise((resolve, reject) => {
      const docx = officegen({
        type: 'docx',
        orientation: 'portrait'
      });

      // Remove this comment in case of debugging Officegen:
      // officegen.setVerboseMode ( true );

      docx.on('error', err => {
        return reject(err);
      });

      const pObj = docx.createP();

      pObj.addText(fileContents);

      const out = fs.createWriteStream(filePath);

      out.on('error', err => {
        return reject(err);
      });

      async.parallel(
        [
          done => {
            out.on('close', () => {
              resolve(true);
              done(null);
            });
            docx.generate(out);
          }
        ],
        err => {
          if (err) {
            reject(err);
          }
        }
      );
    });
  }
  showHelpMessage() {
    return fs
      .createReadStream(`${pathUtil.resolve(pathUtil.dirname(''))}/src/help.txt`)
      .pipe(process.stdout);
  }

  outputMessage(message, color) {
    console.log();
    console.log(colors[color](message));
    console.log();
  }
}

export default Bypass;
