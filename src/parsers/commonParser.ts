import { NotificationIcon } from "~src/parsers/notificationIconsInterface";
import numeral from "numeral";
import { cleanText, splitText } from "~src/stringUtils";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import type { ClassifierInterface, CommonWordsInSentenceResponseInterface } from "~src/classifier";

export interface Subtitle {
    name: string;
    id: string;
}

export class CommonParser {
    protected readonly userAgent: string = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3528.4 Safari/537.36";

    protected logger: LoggerInterface;
    protected notifier: NotifierInterface;
    protected classifier: ClassifierInterface;

    constructor(logger: LoggerInterface, notifier: NotifierInterface, classifier: ClassifierInterface) {
        this.logger = logger;
        this.notifier = notifier;
        this.classifier = classifier;
    }

    findClosestMatch = (filenameNoExtension: string, subtitles: Subtitle[], excludeList: string[]): string => {
        this.logger.info(`Looking for closest match for "${filenameNoExtension}" from: [${subtitles?.map((item) => item.name).join(", ")}]`);
        if (subtitles?.length > 0) {
            let maxCommonWords: CommonWordsInSentenceResponseInterface = this.classifier.commonWordsInSentences(filenameNoExtension, subtitles[0].name, excludeList);
            let maxIndex = 0;
            subtitles.forEach((item, index) => {
                const commonWords: CommonWordsInSentenceResponseInterface = this.classifier.commonWordsInSentences(filenameNoExtension, item.name, excludeList);
                if (commonWords.mark > maxCommonWords.mark) {
                    maxCommonWords = commonWords;
                    maxIndex = index;
                }
            });

            const bestMatch: Subtitle = subtitles[maxIndex];
            this.logger.info(`filename:  "${filenameNoExtension}"`);
            this.logger.info(`best match: "${bestMatch.name}"`);
            this.logger.info(`common words: ["${maxCommonWords.commonWords.join("\", \"")}"]`);
            this.logger.info(`common words mark: ${numeral(maxCommonWords.mark).format("0.00")}`);

            return bestMatch.id;
        }
    };

    protected getMovieExcludeList = (movieName: string, movieYear: number): string[] => {
        return [...splitText(cleanText(movieName)), movieYear.toString()];
    }

    protected getTvSeriesExcludeList = (series: string): string[] => {
        return splitText(cleanText(series));
    }

    protected handleError = (error: any, response) => {
        this.logger.error(error);
        if (response) {
            this.logger.error(JSON.stringify(response));
        }
    }

    protected handleNoSubtitlesFound = (contextMessage: string) => {
        this.logger.info("No subtitle found");
        this.notifier.notif(`No subtitle found for ${contextMessage}`, NotificationIcon.WARNING, true);
    }
}