import type { ArgsParserInterface } from "~src/argsParser";
import { ArgsParser } from "~src/argsParser";
import type { LoggerInterface } from "~src/logger";
import { Logger } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import { NotificationType, Notifier } from "~src/notifier";
import { Config } from "~src/config";
import type { ClassifierInterface } from "~src/classifier";
import { Classifier } from "~src/classifier";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";
import type { ParserInterface } from "~src/parsers/parserInterface";
import { PROGRAM_CACHE_FOLDER, PROGRAM_CONFIG_FILENAME, PROGRAM_LOG_FILENAME, PROGRAM_NAME, PROGRAM_TV_SHOW_ID_CACHE_NAME } from "~src/commonConsts";
import { ensureDirSync, isDirectory, readDir } from "~src/fileUtils";
import { TvShowIdCache } from "~src/parsers/ktuvit/tvShowIdCache";
import { handleSingleFile } from "~src/singleFileHandler";
import { OllamaClient } from "~src/sync/ollamaClient";
import { MkvExtractor } from "~src/sync/mkvExtractor";
import { EnglishSourceFinder } from "~src/sync/englishSourceFinder";
import { SubtitleSyncer } from "~src/sync/subtitleSyncer";
import * as path from "node:path";

// Make sure the log directory is there
ensureDirSync(path.resolve(process.env.ProgramData, PROGRAM_NAME));

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

// TV show ID cache
const cacheFolder: string = path.resolve(process.env.ProgramData, PROGRAM_NAME, PROGRAM_CACHE_FOLDER);
const tvShowIdCache: TvShowIdCache = new TvShowIdCache(PROGRAM_TV_SHOW_ID_CACHE_NAME, cacheFolder, logger);

// Ktuvit parser
const ktuvitParser: ParserInterface = new KtuvitParser(KTUVIT_EMAIL, KTUVIT_PASSWORD, logger, notifier, classifier, tvShowIdCache);

// Subtitle syncer (used when invoked with "sync" flag)
const ollamaClient = new OllamaClient(config.getSyncConfig().ollamaBaseUrl, logger);
const mkvExtractor = new MkvExtractor(argsParser.getMkvtoolnixDir(), logger);
const englishSourceFinder = new EnglishSourceFinder(mkvExtractor, logger);
const subtitleSyncer = new SubtitleSyncer(config.getSyncConfig(), config.getSubtitlesSuffix(), ollamaClient, englishSourceFinder, logger, notifier);

const embeddedSubtitleChecker = async (p: string): Promise<boolean> => {
    if (!config.getCheckEmbeddedSubtitles()) {
        return false;
    }
    if (!p.toLowerCase().endsWith(".mkv")) {
        return false;
    }
    return mkvExtractor.hasHebrewSubtitleTrack(p);
};

// handle single file. Returns true if a call to provider was made
const handleSingleFileLocal = async (fullpath: string, useParentFolder: boolean): Promise<boolean> => {
    logger.verbose(`Handling file: ${fullpath}`);
    const downloaded = await handleSingleFile(fullpath, useParentFolder, classifier, notifier, ktuvitParser, embeddedSubtitleChecker);
    if (downloaded && argsParser.isSync()) {
        await subtitleSyncer.sync(fullpath);
    }
    return downloaded;
};

// Batch
const BATCH_DELAY = 3000; // milliseconds

export const sleep = async (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const getFileExtension = (fullPath: string): string => {
    const ext: string = path.extname(fullPath);
    return ext?.length > 1 && ext.startsWith(".") ? ext.substring(1) : undefined;
};

const handleFolder = async (dir: string): Promise<void> => {
    let noFileHandled = true;

    const items: string[] = await readDir(dir);

    let needToWait = false;
    for (const fileOrFolder of items) {
        const fullPath: string = path.join(dir, fileOrFolder).replace(/\\/g, "/");
        if (await isDirectory(fullPath)) {
            logger.verbose(`Handling sub-folder ${fullPath}`);
            await handleFolder(fullPath);
        }
        else {
            if (config.getExtensions().includes(getFileExtension(fullPath))) {
                noFileHandled = false;
                if (needToWait) {
                    logger.verbose(`Waiting ${BATCH_DELAY}ms to handle file ${fullPath}`);
                    await sleep(BATCH_DELAY);
                }
                needToWait = await handleSingleFileLocal(fullPath, true);
            }
        }
    }

    if (noFileHandled) {
        notifier.notif("No file handled", NotificationType.WARNING);
    }
};

const main = async () => {
    // Main
    logger.verbose(`Argv: ${process.argv.join(" ")}`);
    logger.verbose(`Sonar Mode: ${argsParser.isSonarrMode()}`);
    logger.verbose(`Quiet Mode: ${argsParser.isQuiet()}`);
    const input: string = argsParser.getInput();
    if (typeof input === "string") {
        logger.info(`*** Looking for subtitle for "${input}" ***`);
        const fullpath: string = input.replace(/\\/g, "/");
        try {
            if (await isDirectory(fullpath)) {
                await handleFolder(fullpath);
            }
            else {
                await handleSingleFileLocal(fullpath, false);
            }
        }
        catch (e) {
            if ((e as NodeJS.ErrnoException).code === "ENOENT") {
                // no such file or directory - treat as file
                await handleSingleFileLocal(fullpath, false);
            }
            else {
                logger.error(`Cannot handle ${fullpath}`);
            }
        }
    }
    else {
        notifier.notif("Missing input file", NotificationType.FAILED);
        // tslint:disable-next-line:no-console
        // eslint-disable-next-line no-console
        console.log(`Usage:${argsParser.getHelp()}`);
    }
};

main().catch(logger.error);
