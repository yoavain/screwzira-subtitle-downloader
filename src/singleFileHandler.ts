import type { ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import { FileClassification } from "~src/classifier";
import type { NotifierInterface } from "~src/notifier";
import { NotificationType } from "~src/notifier";
import type { ParserInterface } from "~src/parsers/parserInterface";
import * as path from "path";

export const handleSingleFile = async (
    fullpath: string,
    fileExists: boolean,
    classifier: ClassifierInterface,
    notifier: NotifierInterface,
    parser: ParserInterface
): Promise<boolean> => {
    const relativePath: string = path.dirname(fullpath);
    const filename: string = path.basename(fullpath);
    const filenameNoExtension: string = path.parse(filename).name;
    const parentFolder: string = fileExists ? path.basename(relativePath) || undefined : undefined;

    // Check if already exists
    if (await classifier.isSubtitlesAlreadyExist(relativePath, filenameNoExtension)) {
        notifier.notif("Hebrew subtitles already exist", NotificationType.WARNING);
        return false;
    }

    const classification: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = classifier.classify(filenameNoExtension, relativePath, parentFolder);

    if (classification?.type === FileClassification.MOVIE) {
        await parser.handleMovie(classification);
        return true;
    }
    else if (classification?.type === FileClassification.EPISODE) {
        await parser.handleEpisode(classification);
        return true;
    }
    else {
        notifier.notif("Unable to classify input file as movie or episode", NotificationType.FAILED);
        return false;
    }
};
