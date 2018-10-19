import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import * as path from 'path';
import {IScrewziraUtils, ScrewziraUtils} from './screwziraUtils';
import {ISzArgsParser, SzArgsParser} from "./szArgsParser";
import {IMovieFileClassification, ISzClassifier, ITvEpisodeFileClassification, SzClassifier} from './szClassifier';
import {ISzConfig, SzConfig} from './szConfig';
import {ISzLogger, SzLogger} from './szLogger';
import {ISzNotifier, SzNotifier} from './szNotifier';

// Make sure the log directory is there
fsextra.ensureDirSync(path.resolve(process.env.ProgramData, 'Screwzira-Downloader'));

// CLI Args Parser
const szArgsParser: ISzArgsParser = new SzArgsParser(process.argv);

// Logger
const logFile: string = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader.log');
const szLogger: ISzLogger = new SzLogger(logFile);

// Notifier
const snoreToastPath: string = process.argv[0].endsWith("screwzira-downloader.exe") ? path.join(process.argv[0], "../", "SnoreToast.exe") : null;
const szNotifier: ISzNotifier = new SzNotifier(szLogger, snoreToastPath, szArgsParser.isQuiet());

// Config
const confFile: string = path.resolve(process.env.ProgramData, 'Screwzira-Downloader', 'screwzira-downloader-config.json');
const szConfig: ISzConfig = new SzConfig(confFile, szLogger);
szLogger.setLogLevel(szConfig.getLogLevel());

// File classifier
const szClassifier: ISzClassifier = new SzClassifier(szLogger, szConfig);

// Screwzira Utils
const screwziraUtils: IScrewziraUtils = new ScrewziraUtils(szLogger, szNotifier, szClassifier);

// handle single file
const handleSingleFile = (fullpath: string, fileExists: boolean) => {
    const relativePath: string = fullpath.substr(0, fullpath.lastIndexOf("/"));
    const split: string[] = fullpath.split('/');
    const filename: string = split[split.length - 1];
    const filenameNoExtension: string = filename.substr(0, filename.lastIndexOf("."));
    const parentFolder: string = fileExists && split.length > 1 ? split[split.length - 2] : undefined;

    // Check if already exists
    if (szClassifier.isSubtitlesAlreadyExist(relativePath, filenameNoExtension)) {
        szLogger.warn(`Hebrew subtitles already exist`);
        szNotifier.notif(`Hebrew subtitles already exist`);
        return;
    }

    const classification: IMovieFileClassification | ITvEpisodeFileClassification = szClassifier.classify(filenameNoExtension, parentFolder);

    szLogger.verbose(`Classification response: ${JSON.stringify(classification)}`);

    if (classification && classification.type === "movie") {
        const movieFile: IMovieFileClassification = classification as IMovieFileClassification;
        screwziraUtils.handleMovie(movieFile.movieName, movieFile.movieYear, filenameNoExtension, relativePath);
    }
    else if (classification && classification.type === "episode") {
        const tvEpisode: ITvEpisodeFileClassification = classification as ITvEpisodeFileClassification;
        screwziraUtils.handleEpisode(tvEpisode.series, tvEpisode.season, tvEpisode.episode, filenameNoExtension, relativePath);
    }
    else {
        szNotifier.notif(`Unable to classify input file as movie or episode`);
    }
};


// Batch
const batchInterval: number = 3000; // milliseconds
let batchCounter: number = 0;
const getWaitTimeMs = (): number => {
    batchCounter += 1;
    return batchCounter * batchInterval;
};

const getFileExtension = (fullPath: string): string => {
    const ext: string = path.extname(fullPath);
    return ext && ext.length > 1 && ext.startsWith(".") ? ext.substr(1) : undefined;
};

const handleFolder = (dir: string) => {
    let noFileHandled: boolean = true;
    fs.readdirSync(dir).forEach(file => {
        const fullPath: string = path.join(dir, file).replace(/\\/g, "/");
        if (fs.lstatSync(fullPath).isDirectory()) {
            szLogger.verbose(`Handling sub-folder ${fullPath}`);
            handleFolder(fullPath);
        }
        else {
            if (szConfig.getExtensions().includes(getFileExtension(fullPath))) {
                noFileHandled = true;
                const waitTimeMs: number = getWaitTimeMs();
                szLogger.verbose(`Waiting ${waitTimeMs}ms to handle file ${fullPath}`);
                setTimeout(handleSingleFile, waitTimeMs, fullPath, true);
            }
        }
    });
    if (noFileHandled) {
        szLogger.warn(`No file handled`);
        szNotifier.notif(`No file handled`);
    }
};

// Main
const input: string = szArgsParser.getInput();
if (input && typeof input === "string") {
    szLogger.info(`*** Looking for subtitle for "${input}" ***`);
    const fullpath: string = input.replace(/\\/g, "/");
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
            szLogger.error(`Cannot handle ${fullpath}`);
        }
    }
}
else {
    szLogger.error('*** Missing input file ***');
    szNotifier.notif(`Missing input file`);
}
