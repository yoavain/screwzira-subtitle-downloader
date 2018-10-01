const fs = require('fs');
const fsextra = require('fs-extra');
const path = require('path');
const SzLogger = require('./szLogger');
const SzNotifier = require('./szNotifier');
const SzConfig = require('./szConfig');
const SzClassifier = require('./szClassifier');
const ScrewziraUtils = require('./screwziraUtils');

// Make sure the log directory is there
fsextra.ensureDirSync(path.resolve(process.env.ProgramData, 'Screwzira-Downloader'));

// Logger
const logFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader.log');
const szLogger = new SzLogger(logFile);

// Notifier
const snoreToastPath = process.argv[0].endsWith("screwzira-downloader.exe") ? path.join(process.argv[0], "../", "SnoreToast.exe") : null;
const szNotifier = new SzNotifier(szLogger, snoreToastPath);

// Config
const confFile = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader-config.json');
const szConfig = new SzConfig(confFile, szLogger);
szLogger.setLogLevel(szConfig.getLogLevel());

// File classifier
const szClassifier = new SzClassifier(szLogger, szConfig);

// Screwzira Utils
const screwziraUtils = new ScrewziraUtils(szLogger, szNotifier, szClassifier);

// handle single file
let handleSingleFile = (fullpath: string, fileExists: boolean) => {
    let relativePath = fullpath.substr(0, fullpath.lastIndexOf("/"));
    let split = fullpath.split('/');
    let filename = split[split.length - 1];
    let filenameNoExtension = filename.substr(0, filename.lastIndexOf("."));
    let parentFolder = fileExists && split.length > 1 ? split[split.length - 2] : undefined;
    let classification = szClassifier.classify(filenameNoExtension, parentFolder);

    szLogger.log('verbose', `Classification response: ${JSON.stringify(classification)}`);

    if (classification && classification.type === "movie") {
        screwziraUtils.handleMovie(classification.movieName, classification.movieYear, filenameNoExtension, relativePath);
    }
    else if (classification && classification.type === "episode") {
        screwziraUtils.handleEpisode(classification.series, classification.season, classification.episode, filenameNoExtension, relativePath);
    }
    else {
        szNotifier.notif(`Unable to classify input file as movie or episode`);
    }
};


// Batch
const batchInterval = 3000; // milliseconds
let batchCounter = 0;
let getWaitTimeMs = (): number => {
    batchCounter += 1;
    return batchCounter * batchInterval;
};

let getFileExtension = (fullPath: string): string => {
    let ext = path.extname(fullPath);
    return ext && ext.length > 1 && ext.startsWith(".") ? ext.substr(1) : undefined;
};

let handleFolder = (dir: string) => {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file).replace(/\\/g, "/");
        if (fs.lstatSync(fullPath).isDirectory()) {
            szLogger.log('verbose', `Handling sub-folder ${fullPath}`);
            handleFolder(fullPath);
        }
        else {
            if (szConfig.getExtensions().includes(getFileExtension(fullPath))) {
                let waitTimeMs = getWaitTimeMs();
                szLogger.log('verbose', `Waiting ${waitTimeMs}ms to handle file ${fullPath}`);
                console.log(``);
                setTimeout(handleSingleFile, waitTimeMs, fullPath, true);
            }
        }
    });
};

// Main
if (process.argv.length > 2) {
    szLogger.log('info', `*** Looking for subtitle for "${process.argv[2]}" ***`);
    let fullpath = process.argv[2].replace(/\\/g, "/");
    try {
        if (fs.lstatSync(fullpath).isDirectory()) {
            handleFolder(fullpath)
        }
        else {
            handleSingleFile(fullpath, false);
        }
    } catch (e) {
        if(e.code == 'ENOENT'){
            // no such file or directory - treat as file
            handleSingleFile(fullpath, false);
        }
        else {
            szLogger.log('error', `Cannot handle ${fullpath}`);
        }
    }
}
else {
    szLogger.log('error', '*** Missing input file ***');
    szNotifier.notif(`Missing input file`);
}
