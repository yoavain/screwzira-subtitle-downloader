import * as fs from 'fs';
import numeral from 'numeral';
import * as path from 'path';
import request from 'request';
import { ICommonWordsInSentenceResponse, ISzClassifier } from './szClassifier';
import { ISzLogger } from './szLogger';
import { ISzNotifier, NotificationIcon } from './szNotifier';

export interface IScrewziraUtils {
    // new(logger: ISzLogger, notifier: ISzNotifier, classifier: ISzClassifier): ScrewziraUtils;
    findClosestMatch: (filenameNoExtension: string, list, excludeList: string[]) => string;
    handleResponse: (error: any, response: request.Response, body: string, excludeList: string[], filenameNoExtension: string, relativePath: string, contextMessage: string) => void;
    handleMovie: (movieName: string, movieYear: number, filenameNoExtension: string, relativePath: string) => void;
    handleEpisode: (series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string) => void;
    downloadBestMatch: (subtitleID: string, filenameNoExtension: string, relativePath: string, contextMessage: string) => void;
}

export interface IFindFilmResponse {
    SubtitleName: string;
    Identifier: string;
}

export class ScrewziraUtils implements IScrewziraUtils {
    // Request Info
    private readonly baseUrl: string = 'http://api.screwzira.com';
    private readonly userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3528.4 Safari/537.36';

    private logger: ISzLogger;
    private notifier: ISzNotifier;
    private classifier: ISzClassifier;

    constructor(logger: ISzLogger, notifier: ISzNotifier, classifier: ISzClassifier) {
        this.logger = logger;
        this.notifier = notifier;
        this.classifier = classifier;
    }

    public findClosestMatch = (filenameNoExtension: string, list: IFindFilmResponse[], excludeList: string[]): string => {
        this.logger.info(`Looking for closest match for "${filenameNoExtension}" from: [${list?.map((item) => item.SubtitleName).join(', ')}]`);
        if (list?.length > 0) {
            let maxCommonWords: ICommonWordsInSentenceResponse = this.classifier.commonWordsInSentences(filenameNoExtension, list[0].SubtitleName, excludeList);
            let maxIndex = 0;
            list.forEach((item, index) => {
                const commonWords: ICommonWordsInSentenceResponse = this.classifier.commonWordsInSentences(filenameNoExtension, item.SubtitleName, excludeList);
                if (commonWords.mark > maxCommonWords.mark) {
                    maxCommonWords = commonWords;
                    maxIndex = index;
                }
            });

            const bestMatch: IFindFilmResponse = list[maxIndex];
            this.logger.info(`filename:  "${filenameNoExtension}"`);
            this.logger.info(`best match: "${bestMatch.SubtitleName}"`);
            this.logger.info(`common words: ["${maxCommonWords.commonWords.join('", "')}"]`);
            this.logger.info(`common words mark: ${numeral(maxCommonWords.mark).format('0.00')}`);

            return bestMatch.Identifier;
        }
    };

    public handleResponse = (error: any, response: request.Response, body: string, excludeList: string[], filenameNoExtension: string, relativePath: string, contextMessage: string): void => {
        if (!error && response.statusCode === 200) {
            const results: IFindFilmResponse[] = body && JSON.parse(body).Results;
            if (Array.isArray(results) && results.length) {
                const subtitleID: string = this.findClosestMatch(filenameNoExtension, results, excludeList);
                this.downloadBestMatch(subtitleID, filenameNoExtension, relativePath, contextMessage);
            }
            else {
                this.logger.info('No subtitle found');
                this.notifier.notif(`No subtitle found for ${contextMessage}`, NotificationIcon.WARNING, true);
            }
        }
        else {
            this.logger.error(error);
            if (response) {
                this.logger.error(JSON.stringify(response));
            }
        }
    };

    public handleMovie = (movieName: string, movieYear: number, filenameNoExtension: string, relativePath: string) => {
        const contextMessage: string = `Movie: "${this.toTitleCase(movieName)}" (${movieYear})`;
        this.logger.info(`Handling ${contextMessage}`);
        const options: request.Options = {
            url: `${this.baseUrl}/FindFilm`,
            method: 'POST',
            headers: { 'User-Agent': this.userAgent },
            json: {
                request: {
                    SearchPhrase: movieName,
                    SearchType: 'FilmName',
                    Version: '1.0',
                    Year: movieYear
                }
            }
        };

        const excludeList: string[] = this.classifier.splitText(this.classifier.cleanText(movieName));
        excludeList.push(movieYear.toString());

        this.logger.debug(`Handle movie request options: ${JSON.stringify(options)}`);

        request(options, (error, response, body) => {
            this.handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath, contextMessage);
        });
    };

    public handleEpisode = (series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string): void => {
        const contextMessage: string = `Series "${this.toTitleCase(series)}" Season ${season} Episode ${episode}`;
        this.logger.info(`Handling ${contextMessage}`);
        const options: request.Options = {
            url: `${this.baseUrl}/FindSeries`,
            method: 'POST',
            headers: { 'User-Agent': this.userAgent },
            json: {
                request: {
                    SearchPhrase: series,
                    SearchType: 'FilmName',
                    Version: '1.0',
                    Season: season,
                    Episode: episode
                }
            }
        };

        const excludeList: string[] = this.classifier.splitText(series);

        this.logger.debug(`Handle episode request options: ${JSON.stringify(options)}`);

        request(options, (error, response, body) => {
            this.handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath, contextMessage);
        });
    };

    public downloadBestMatch = (subtitleID: string, filenameNoExtension: string, relativePath: string, contextMessage: string): void => {
        this.logger.info(`Downloading: ${subtitleID}`);
        const options: request.Options = {
            url: `${this.baseUrl}/Download`,
            method: 'POST',
            headers: { 'User-Agent': this.userAgent, 'Accept': '*/*' },
            encoding: null,
            json: {
                request: {
                    subtitleID
                }
            }
        };

        this.logger.debug(JSON.stringify(options));

        request(options, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                // Check if already exists
                if (this.classifier.isSubtitlesAlreadyExist(relativePath, filenameNoExtension)) {
                    this.logger.warn('Hebrew subtitles already exist');
                    this.notifier.notif(`Hebrew subtitles already exist for ${contextMessage}`, NotificationIcon.WARNING);
                    return;
                }

                const destination: string = path.resolve(relativePath, filenameNoExtension + '.Hebrew.srt');
                this.logger.verbose(`writing response to ${destination}`);
                fs.writeFileSync(destination, body);
                this.notifier.notif(`Successfully downloaded Subtitles for ${contextMessage}`, NotificationIcon.DOWNLOAD);
            }
            else {
                this.logger.error(error);
                this.notifier.notif(`Failed downloading subtitle for ${contextMessage}`, NotificationIcon.FAILED);
            }
        });
    };

    toTitleCase = (str: string): string => {
        return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
}
