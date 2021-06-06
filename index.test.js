const {
    Config,
    isConfigFileExists,
    copyFilesListToDestination,
    watch,
    isFileMatches,
    getMatchingFilesList,
} = require('./lib');
const path = require('path');
const fs = require('fs');
const temp = require('temp');

temp.track();

class TempFile {
    constructor(relativePath, pathToSourceFile, pathToDestinationFile) {
        this.relativePath = relativePath;
        this.pathToSourceFile = pathToSourceFile;
        this.pathToDestinationFile = pathToDestinationFile;
    }

    create() {
        this.write('');
    }

    write(data) {
        fs.writeFileSync(this.pathToSourceFile, data);
    }

    read() {
        return fs.readFileSync(this.pathToSourceFile);
    }

    isExistsInDestinyLocation() {
        try {
            fs.accessSync(this.pathToDestinationFile);
            return true;
        }
        catch {
            return false;
        }
    }

    isDestinationFileHaveSameContentAsSource() {
        const sourceContent = fs.readFileSync(this.pathToSourceFile);
        const destinationContent = fs.readFileSync(this.pathToDestinationFile);

        return sourceContent.compare(destinationContent) === 0;
    }
}

function createDataPlayground(localConfig = {}, filesToCreate = [], directoriesToCreate = []) {
    const sourceDirectory = temp.mkdirSync('source');
    const destinationDirectory = temp.mkdirSync('destination');
    const otherDirectory = temp.mkdirSync('other');

    directoriesToCreate.forEach(directory => {
        fs.mkdirSync(path.join(sourceDirectory, directory));
    });

    const tempFiles = filesToCreate.map(relativePath => {
        const pathToSourceFile = path.join(sourceDirectory, relativePath);
        const pathToDestinationFile = path.join(destinationDirectory, relativePath);

        const file = new TempFile(relativePath, pathToSourceFile, pathToDestinationFile);

        file.create();

        return file;
    });

    const { path: pathToConfigFile } = temp.openSync('config.js');

    fs.writeFileSync(pathToConfigFile, Buffer.from(`module.exports=${JSON.stringify({
        source: sourceDirectory,
        destination: destinationDirectory,
        ...localConfig,
    })};`));

    return {
        sourceDirectory,
        destinationDirectory,
        otherDirectory,
        tempFiles,
        pathToConfigFile,
        getFileByRelativePath: relativePath => tempFiles.find(file => file.relativePath === relativePath),
        getFileListFromSource: () => tempFiles,
        getFileListFromDestination: () => tempFiles.filter(file => file.isExistsInDestinyLocation()),
        checkIfFilesInSourceAndDestinationAreSynced: (config) => {
            for (const file of tempFiles ) {
                if (isFileMatches(file.relativePath, config.glob, config.ignore)) {
                    if (!file.isExistsInDestinyLocation())
                        return false;

                    if (!file.isDestinationFileHaveSameContentAsSource())
                        return false;
                }
            }

            return true;
        },
        destroy: () => temp.cleanupSync(),
    };
}

let dataPlayground = createDataPlayground();

const FILES = {
    testTxt: 'test.txt',
    testJs: 'test.js',
    nodeModulesIndexJs: 'node_modules/index.js',
    myDirIndexJs: 'myDir/index.js',
    myDirXyzTxt: 'myDir/xyz.txt'
};

beforeEach(() => {
    dataPlayground = createDataPlayground(
        {
            glob: '**/*.js',
            ignore: ['*.txt', 'node_modules/**/*'],
        },
        Object.values(FILES),
        [
            'node_modules',
            'myDir'
        ]
    );
});

afterEach(() => {
    dataPlayground.destroy();
});

describe('Config class', () => {
    test('Should create configuration with remote ssh destination', () => {
        const config = new Config({
            ssh: 'user@host',
            destination: '/test/mydir/'
        });

        expect(config.getDestination()).toBe('user@host:/test/mydir/');
    });

    test('Should create configuration with local directory destination', () => {
        const config = new Config({
            destination: '/test/mydir/'
        });

        expect(config.getDestination()).toBe('/test/mydir/');
    });

    test('Should create new config file from template, save it in temp folder and then read', () => {
        const testConfigTemplate = new Config({
            source: 'xyz',
            destination: 'qwe',
            glob: '**/*',
            ignore: ['node_modules/**/*'],
            ssh: 'user@host'
        });

        const pathToTestConfigFile = path.join(dataPlayground.otherDirectory, 'config.js');

        Config.saveConfigToFile(pathToTestConfigFile, testConfigTemplate)

        const configFileContent = Config.createConfigFileContentString(Config.getConfigFromFile(pathToTestConfigFile));

        expect(configFileContent).toBe(Config.createConfigFileContentString(testConfigTemplate));
    });
});

describe('Data playground', () => {
    test('Should get empty list of files in destination directory', () => {
        expect(dataPlayground.getFileListFromDestination().length).toBe(0);
    });

    test('Should get full list of temp files in source directory', () => {
        expect(dataPlayground.getFileListFromSource().length).toBe(5);
    });
});

describe('Main', () => {
    test('Should be able to find config file', () => {
        expect(isConfigFileExists(dataPlayground.pathToConfigFile)).toBe(true);
    });

    test('Should match files with glob pattern from config file', () => {
        const config = Config.getConfigFromFile(dataPlayground.pathToConfigFile).config;

        expect(getMatchingFilesList(config.source, config.glob, config.ignore).length).toBe(2);
    });

    test('Should match files to glob patter', () => {
        expect(isFileMatches('file.js', '**/*', [])).toBe(true);
        expect(isFileMatches('file.js', '**/*.(js|ts)', [])).toBe(true);
        expect(isFileMatches('test/file.js', '**/*.(js|ts)', [])).toBe(true);
        expect(isFileMatches('test/file.js', '**/*.js', [])).toBe(true);
    });

    test('Should ignore files matching patterns defined in array of globs', () => {
        expect(isFileMatches('node_modules/file.js', '**/*', ['node_modules/**/*'])).toBe(false);
        expect(isFileMatches('node_modules/test/file.jsx', '**/*', ['node_modules/**/*'])).toBe(false);
        expect(isFileMatches('dir/file.png', '**/*', ['node_modules/**/*', '**/*.png'])).toBe(false);
        expect(isFileMatches('node_modules/file.js', '**/*.js', ['node_modules/**/*'])).toBe(false);
    });

    test('Should watch files changes which matching glob', (done) => {
        const callback = jest.fn();

        const config = Config.getConfigFromFile(dataPlayground.pathToConfigFile).config;
        const unwatch = watch(config.source, config.glob, config.ignore, callback);

        dataPlayground.getFileByRelativePath(FILES.testJs).write('test');
        dataPlayground.getFileByRelativePath(FILES.myDirIndexJs).write('test');

        setTimeout(() => {
            unwatch();
            expect(callback).toHaveBeenCalledTimes(2);
            done();
        }, 10);
    });

    test('Should ignore changes in files matching ignore glob patterns', (done) => {
        const callback = jest.fn();

        const config = Config.getConfigFromFile(dataPlayground.pathToConfigFile).config;
        const unwatch = watch(config.source, config.glob, config.ignore, callback);

        dataPlayground.getFileByRelativePath(FILES.testTxt).write('test');
        dataPlayground.getFileByRelativePath(FILES.nodeModulesIndexJs).write('test');
        dataPlayground.getFileByRelativePath(FILES.myDirXyzTxt).write('test');

        setTimeout(() => {
            unwatch();
            expect(callback).not.toBeCalled();
            done();
        }, 1);
    });

    test('Should copy matched files from source to destination directory', async () => {
        const config = Config.getConfigFromFile(dataPlayground.pathToConfigFile);
        const rawConfig = config.config;
        const matchingFilesList = getMatchingFilesList(rawConfig.source, rawConfig.glob, rawConfig.ignore);

        await copyFilesListToDestination({
            filesList: matchingFilesList.map(x => x.replace(rawConfig.source+'/', '')),
            destination: config.getDestination(),
            cwd: rawConfig.source
        });

        expect(dataPlayground.checkIfFilesInSourceAndDestinationAreSynced(rawConfig)).toBe(true);
    });

    test('Should watch files and on change copy them from source to destination directory', (done) => {
        const config = Config.getConfigFromFile(dataPlayground.pathToConfigFile);
        const rawConfig = config.config;

        const unwatch = watch(rawConfig.source, rawConfig.glob, rawConfig.ignore, async (filename) => {
            await copyFilesListToDestination({
                filesList: [filename],
                destination: config.getDestination(),
                cwd: rawConfig.source
            });
        });

        dataPlayground.getFileByRelativePath(FILES.testJs).write('test');
        dataPlayground.getFileByRelativePath(FILES.testJs).write('lorem ipsum dolor');
        dataPlayground.getFileByRelativePath(FILES.testJs).write('lorem ipsum dolor sit amet');

        setTimeout(() => {
            unwatch();
            expect(dataPlayground.getFileByRelativePath(FILES.testJs).isDestinationFileHaveSameContentAsSource()).toBe(true);
            done();
        }, 100);
    });
});
