import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as path from 'path';
import {ScrewziraUtils} from './screwziraUtils';
import {IMovieFileClassification, ITvEpisodeFileClassification, SzClassifier} from './szClassifier';
import {SzConfig} from './szConfig';
import {SzLogger} from './szLogger';
import {SzNotifier} from './szNotifier';

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
const handleSingleFile = (fullpath: string, fileExists: boolean) => {
    const relativePath = fullpath.substr(0, fullpath.lastIndexOf("/"));
    const split = fullpath.split('/');
    const filename = split[split.length - 1];
    const filenameNoExtension = filename.substr(0, filename.lastIndexOf("."));
    const parentFolder = fileExists && split.length > 1 ? split[split.length - 2] : undefined;
    const classification = szClassifier.classify(filenameNoExtension, parentFolder);

    szLogger.log('verbose', `Classification response: ${JSON.stringify(classification)}`);

    if (classification && classification.type === "movie") {
        const movieFile = classification as IMovieFileClassification;
        screwziraUtils.handleMovie(movieFile.movieName, movieFile.movieYear, filenameNoExtension, relativePath);
    }
    else if (classification && classification.type === "episode") {
        const tvEpisode = classification as ITvEpisodeFileClassification;
        screwziraUtils.handleEpisode(tvEpisode.series, tvEpisode.season, tvEpisode.episode, filenameNoExtension, relativePath);
    }
    else {
        szNotifier.notif(`Unable to classify input file as movie or episode`);
    }
};


// Batch
const batchInterval = 3000; // milliseconds
let batchCounter = 0;
const getWaitTimeMs = (): number => {
    batchCounter += 1;
    return batchCounter * batchInterval;
};

const getFileExtension = (fullPath: string): string => {
    const ext = path.extname(fullPath);
    return ext && ext.length > 1 && ext.startsWith(".") ? ext.substr(1) : undefined;
};

const handleFolder = (dir: string) => {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file).replace(/\\/g, "/");
        if (fs.lstatSync(fullPath).isDirectory()) {
            szLogger.log('verbose', `Handling sub-folder ${fullPath}`);
            handleFolder(fullPath);
        }
        else {
            if (szConfig.getExtensions().includes(getFileExtension(fullPath))) {
                const waitTimeMs = getWaitTimeMs();
                szLogger.log('verbose', `Waiting ${waitTimeMs}ms to handle file ${fullPath}`);
                setTimeout(handleSingleFile, waitTimeMs, fullPath, true);
            }
        }
    });
};

// Main
if (process.argv.length > 2) {
    szLogger.log('info', `*** Looking for subtitle for "${process.argv[2]}" ***`);
    const fullpath = process.argv[2].replace(/\\/g, "/");
    try {
        if (fs.lstatSync(fullpath).isDirectory()) {
            handleFolder(fullpath)
        }
        else {
            handleSingleFile(fullpath, false);
        }
    } catch (e) {
        if(e.code === 'ENOENT'){
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
