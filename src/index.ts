import type { ArgsParserInterface } from "~src/argsParser";
import { ArgsParser } from "~src/argsParser";
import type { LoggerInterface } from "~src/logger";
import { Logger } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import { NotificationType, Notifier } from "~src/notifier";
import { Config } from "~src/config";
import type { ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import { Classifier, FileClassification } from "~src/classifier";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";
import * as fs from "fs";
import * as fsextra from "fs-extra";
import * as path from "path";
import type { ParserInterface } from "~src/parsers/parserInterface";
import { PROGRAM_CONFIG_FILENAME, PROGRAM_LOG_FILENAME, PROGRAM_NAME } from "~src/commonConsts";

// Make sure the log directory is there
fsextra.ensureDirSync(path.resolve(process.env.ProgramData, PROGRAM_NAME));

// CLI Args Parser
const argsParser: ArgsParserInterface = new ArgsParser(process.argv);

// Logger
const logFile: string = path.resolve(process.env.ProgramData, PROGRAM_NAME, PROGRAM_LOG_FILENAME);
const logger: LoggerInterface = new Logger(logFile);

// Notifier
const notifier: NotifierInterface = new Notifier(logger, argsParser.getSnoreToastPath(), argsParser.isQuiet());

// Config
const confFile: string = path.resolve(process.env.ProgramData, PROGRAM_NAME, PROGRAM_CONFIG_FILENAME);
const config: Config = new Config(confFile, logger);
logger.setLogLevel(config.getLogLevel());

// File classifier
const classifier: ClassifierInterface = new Classifier(logger, config);

// Ktuvit parser
const ktuvitParser: ParserInterface = new KtuvitParser(KTUVIT_EMAIL, KTUVIT_PASSWORD, logger, notifier, classifier);

// handle single file
const handleSingleFile = async (fullpath: string, fileExists: boolean): Promise<void> => {
    const relativePath: string = fullpath.substr(0, fullpath.lastIndexOf("/"));
    const split: string[] = fullpath.split("/");
    const filename: string = split[split.length - 1];
    const filenameNoExtension: string = filename.substr(0, filename.lastIndexOf("."));
    const parentFolder: string = fileExists && split.length > 1 ? split[split.length - 2] : undefined;

    // Check if already exists
    if (classifier.isSubtitlesAlreadyExist(relativePath, filenameNoExtension)) {
        notifier.notif("Hebrew subtitles already exist", NotificationType.WARNING);
        return;
    }

    const classification: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = classifier.classify(filenameNoExtension, relativePath, parentFolder);

    logger.verbose(`Classification response: ${JSON.stringify(classification)}`);

    if (classification?.type === FileClassification.MOVIE) {
        await ktuvitParser.handleMovie(classification);
    }
    else if (classification?.type === FileClassification.EPISODE) {
        await ktuvitParser.handleEpisode(classification);
    }
    else {
        notifier.notif("Unable to classify input file as movie or episode", NotificationType.FAILED);
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
        notifier.notif("No file handled", NotificationType.WARNING);
    }
};

// Main
logger.verbose(`Argv: ${process.argv.join(" ")}`);
logger.verbose(`Sonar Mode: ${argsParser.isSonarrMode()}`);
logger.verbose(`Quiet Mode: ${argsParser.isQuiet()}`);
const input: string = argsParser.getInput();
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
    notifier.notif("Missing input file", NotificationType.FAILED);
    // tslint:disable-next-line:no-console
    console.log(`Usage:${argsParser.getHelp()}`);
}
