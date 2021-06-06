#!/usr/bin/env node

const path = require('path');
const { Command } = require('commander');
const {
    watch,
    Config,
    isConfigFileExists,
    copyFilesListToDestination,
    addExitHandler,
    getMatchingFilesList
} = require('./lib');
const pkg = require('./package.json');

const program = new Command();

const LOCAL_CONFIG_FILENAME = 'rsync.config.js';
const DEFAULT_CONFIG = {
    source: '',
    destination: '',
    glob: '',
    ignore: [],
    ssh: ''
};

const pathToLocalConfigFile = path.join(process.cwd(), LOCAL_CONFIG_FILENAME);

program
    .name(pkg.name)
    .version(pkg.version)
    .option('-v, --version', 'output the version number')
    .option('-i, --init', 'create new config file in current directory', false)
    .option('-c, --config', 'specify config file location', pathToLocalConfigFile);

program.parse(process.argv);

const {
    config: pathToConfigFileFromCmd = pathToLocalConfigFile,
    init
} = program.opts();

if (init) {
    if (isConfigFileExists(pathToConfigFileFromCmd)) {
        console.error('File already exists');
        process.exit(1);
    }

    Config.saveConfigToFile(pathToLocalConfigFile, new Config(DEFAULT_CONFIG));
    process.exit(0);
}

async function main() {
    if (!isConfigFileExists(pathToConfigFileFromCmd)) {
        console.error(`Local config not found in ${path}`);
        process.exit(1);
    }

    const config = Config.getConfigFromFile(pathToLocalConfigFile, DEFAULT_CONFIG);

    const filesList = getMatchingFilesList(config.config.source, config.config.glob, config.config.ignore);

    await copyFilesListToDestination({
        filesList,
        destination: config.getDestination(),
        cwd: process.cwd()
    });

    const unwatch = watch(config.config.source, config.config.glob, config.config.ignore, (filename) => {
        copyFilesListToDestination({
            filesList: [path.join(config.config.source, filename)],
            destination: config.getDestination(),
            cwd: process.cwd()
        });
    });

    addExitHandler(() => {
        unwatch();
    });
}

main();
