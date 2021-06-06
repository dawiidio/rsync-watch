const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const pm = require('picomatch');
const glob = require('glob');

class Config {
    constructor(config) {
        this.config = config;
    }

    getDestination() {
        let base = ``;

        if (this.config.ssh)
            base = `${this.config.ssh}:`;

        return `${base}${this.config.destination}`;
    }

    static getConfigFromFile(path, defaultConfig = {}) {
        const rawLocalConfig = require(path);

        return new Config({
            ...defaultConfig,
            ...rawLocalConfig,
        });
    }

    static saveConfigToFile(path, config) {
        fs.writeFileSync(path, Buffer.from(Config.createConfigFileContentString(config)));
    }

    static createConfigFileContentString(config) {
        return `module.exports = ${config};\n`;
    }

    toString() {
        return JSON.stringify(this.config, null, 4);
    }
}

function isConfigFileExists(path) {
    try {
        fs.accessSync(path);
        return true;
    }
    catch {
        return false;
    }
}

function getMatchingFilesList(sourcePath, globString, ignore = []) {
    return glob.sync(path.join(sourcePath, globString), {
        ignore: ignore.map(x => path.join(sourcePath, x)),
        nodir: true
    });
}

function isFileMatches(filename, globString, ignoreGlobStrings) {
    const isMatch = pm(globString);
    const ignoreMatchersList = ignoreGlobStrings.map(ignoreGlob => pm(ignoreGlob));

    if (ignoreMatchersList.findIndex(match => match(filename)) > -1)
        return false;

    return isMatch(filename);
}

function watch(sourcePath, globString, ignore = [], cb) {
    const listener = (eventType, filename) => {
        if (isFileMatches(filename, globString, ignore))
            cb(filename, sourcePath);
    };

    const watcher = fs.watch(sourcePath, { recursive: true }, listener);

    return () => {
        watcher.close();
        fs.unwatchFile(sourcePath, listener);
    }
}

function copyFilesListToDestination({ filesList, destination, cwd }) {
    return new Promise((res, rej) => {
        const filesListString = filesList.join(' ');

        const out = childProcess.exec(`rsync -RazP --delete ${filesListString} ${destination}`, {
            cwd,
        });

        out.stdout.on('data', console.log);

        out.on('message', console.log);
        out.on('error', rej);
        out.on('disconnect', rej);
        out.on('close', res);
        out.on('exit', res);
    });
}

function addExitHandler(exitHandler) {
    let called = false;

    const exitHandlerWrapper = () => {
        if (called)
            return;

        exitHandler();
        called = true;
        process.exit();
    };

    process.on('exit', exitHandlerWrapper);
    process.on('SIGINT', exitHandlerWrapper);
    process.on('SIGUSR1', exitHandlerWrapper);
    process.on('SIGUSR2', exitHandlerWrapper);
    process.on('uncaughtException', exitHandlerWrapper);
}

module.exports = {
    isConfigFileExists,
    getMatchingFilesList,
    watch,
    copyFilesListToDestination,
    isFileMatches,
    addExitHandler,
    Config,
}
