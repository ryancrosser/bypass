# bypass.js

## Simple file transformation process to assist in file transfer

## Installation

With [npm](http://npmjs.org) do:

```
npm install bypass
```

to get the library, or

```
npm install -g bypass
```

to get the command.

## Usage

```
bypass [options] [--flags]

Options:
  up    process bundle the directory or file for transfer
  down  unbundle the 'bypass-directory'
  
Flags:

  -d, --dir                 source directory [current directory]
  -o, --out                 output directory [subdirectory named bypass-output in the current directory]
  --out-file                the manifest file generated by Bypass [bypass-file.txt]
  -i, --ignore-list         list of file extensions that will copied to the bypass-file, 
                            typically non-text files [jpeg, jpg, png, doc, docx, gif]
  -c, --clean-output-dir    whether or not to clean the output directory before processing [true]
  -h, --help                show help
```

## License

MIT
