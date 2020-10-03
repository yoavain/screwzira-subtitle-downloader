import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as path from "path";
import { ArgsParser, ArgsParserInterface } from "~src/argsParser";
import { Logger, LoggerInterface } from "~src/logger";
import { Notifier, NotifierInterface } from "~src/notifier";
import { Config } from "~src/config";
import { NotificationIcon } from "~src/parsers/notificationIconsInterface";
import { Classifier, ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import { ParserInterface } from "~src/parsers/parserInterface";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";

// Make sure the log directory is there
fsextra.ensureDirSync(path.resolve(process.env.ProgramData, "Screwzira-Downloader"));

// CLI Args Parser
const szArgsParser: ArgsParserInterface = new ArgsParser(process.argv);

// Logger
const logFile: string = path.resolve(process.env.ProgramData, "Screwzira-Downloader", "screwzira-downloader.log");
const logger: LoggerInterface = new Logger(logFile);

// Notifier
const notifier: NotifierInterface = new Notifier(logger, szArgsParser.getSnoreToastPath(), szArgsParser.isQuiet());

// Config
const confFile: string = path.resolve(process.env.ProgramData, "Ktuvit-Downloader", "ktuvit-downloader-config.json");
const config: Config = new Config(confFile, logger);
logger.setLogLevel(config.getLogLevel());

// File classifier
const classifier: ClassifierInterface = new Classifier(logger, config);

// Ktuvit parser
const email: string = process.env.KTUVIT_EMAIL;
const password: string = process.env.KTUVIT_EMAIL;
const ktuvitParser: ParserInterface = new KtuvitParser(email, password, logger, notifier, classifier);

// handle single file
const handleSingleFile = async (fullpath: string, fileExists: boolean): Promise<void> => {
    const relativePath: string = fullpath.substr(0, fullpath.lastIndexOf("/"));
    const split: string[] = fullpath.split("/");
    const filename: string = split[split.length - 1];
    const filenameNoExtension: string = filename.substr(0, filename.lastIndexOf("."));
    const parentFolder: string = fileExists && split.length > 1 ? split[split.length - 2] : undefined;

    // Check if already exists
    if (classifier.isSubtitlesAlreadyExist(relativePath, filenameNoExtension)) {
        logger.warn("Hebrew subtitles already exist");
        notifier.notif("Hebrew subtitles already exist", NotificationIcon.WARNING);
        return;
    }

    const classification: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = classifier.classify(filenameNoExtension, parentFolder);

    logger.verbose(`Classification response: ${JSON.stringify(classification)}`);

    if (classification?.type === "movie") {
        const movieFile: MovieFileClassificationInterface = classification as MovieFileClassificationInterface;
        await ktuvitParser.handleMovie(movieFile.movieName, movieFile.movieYear, filenameNoExtension, relativePath);
    }
    else if (classification?.type === "episode") {
        const tvEpisode: TvEpisodeFileClassificationInterface = classification as TvEpisodeFileClassificationInterface;
        await ktuvitParser.handleEpisode(tvEpisode.series, tvEpisode.season, tvEpisode.episode, filenameNoExtension, relativePath);
    }
    else {
        notifier.notif("Unable to classify input file as movie or episode", NotificationIcon.FAILED);
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
    const ext: string = path.extname(fullPath);
    return ext?.length > 1 && ext.startsWith(".") ? ext.substr(1) : undefined;
};

const handleFolder = (dir: string): void => {
    let noFileHandled = true;
    fs.readdirSync(dir).forEach((file) => {
        const fullPath: string = path.join(dir, file).replace(/\\/g, "/");
        if (fs.lstatSync(fullPath).isDirectory()) {
            logger.verbose(`Handling sub-folder ${fullPath}`);
            handleFolder(fullPath);
        }
        else {
            if (config.getExtensions().includes(getFileExtension(fullPath))) {
                noFileHandled = false;
                const waitTimeMs: number = getWaitTimeMs();
                logger.verbose(`Waiting ${waitTimeMs}ms to handle file ${fullPath}`);
                setTimeout(handleSingleFile, waitTimeMs, fullPath, true);
            }
        }
    });
    if (noFileHandled) {
        logger.warn("No file handled");
        notifier.notif("No file handled", NotificationIcon.WARNING);
    }
};

// Main
logger.verbose(`Argv: ${process.argv.join(" ")}`);
logger.verbose(`Sonar Mode: ${szArgsParser.isSonarrMode()}`);
logger.verbose(`Quiet Mode: ${szArgsParser.isQuiet()}`);
const input: string = szArgsParser.getInput();
if (typeof input === "string") {
    logger.info(`*** Looking for subtitle for "${input}" ***`);
    const fullpath: string = input.replace(/\\/g, "/");
    try {
        if (fs.lstatSync(fullpath).isDirectory()) {
            handleFolder(fullpath);
        }
        else {
            handleSingleFile(fullpath, false);
        }
    }
    catch (e) {
        if (e.code === "ENOENT") {
            // no such file or directory - treat as file
            handleSingleFile(fullpath, false);
        }
        else {
            logger.error(`Cannot handle ${fullpath}`);
        }
    }
}
else {
    logger.error("*** Missing input file ***");
    notifier.notif("Missing input file", NotificationIcon.FAILED);
    // tslint:disable-next-line:no-console
    console.log(`Usage:${szArgsParser.getHelp()}`);
}
