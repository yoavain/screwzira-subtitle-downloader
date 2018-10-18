import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request';
import {ISzClassifier} from './szClassifier';
import {ISzLogger} from './szLogger';
import {ISzNotifier} from './szNotifier';

export interface IScrewziraUtils {
    // new(logger: ISzLogger, notifier: ISzNotifier, classifier: ISzClassifier): ScrewziraUtils;
    findClosestMatch(filenameNoExtension: string, list, excludeList: string[]): string;
    handleResponse(error: any, response: request.Response, body: string, excludeList: string[], filenameNoExtension: string, relativePath: string);
    handleMovie(movieName: string, movieYear: number, filenameNoExtension: string, relativePath: string);
    handleEpisode(series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string);
    downloadBestMatch(subtitleID: string, filenameNoExtension: string, relativePath: string);
}

export interface IFindFilmResponse {
    SubtitleName: string,
    Identifier: string
}

export class ScrewziraUtils implements IScrewziraUtils {
    // Request Info
    public baseUrl: string = 'http://api.screwzira.com';
    public userAgent: string = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3528.4 Safari/537.36';

    public logger: ISzLogger;
    public notifier: ISzNotifier;
    public classifier: ISzClassifier;

    constructor(logger: ISzLogger, notifier: ISzNotifier, classifier: ISzClassifier) {
        this.logger = logger;
        this.notifier = notifier;
        this.classifier = classifier;
    }


    public findClosestMatch = (filenameNoExtension: string, list: IFindFilmResponse[], excludeList: string[]): string => {
        this.logger.log('info', `Looking for closest match for "${filenameNoExtension}" from: [${list && list.map(item => item.SubtitleName).join(', ')}]`);
        if (list && list.length > 0) {
            let maxCommonWords: string[] = this.classifier.commonWordsInSentences(filenameNoExtension, list[0].SubtitleName, excludeList);
            let maxIndex: number = 0;
            list.forEach((item, index) => {
                const commonWords: string[] = this.classifier.commonWordsInSentences(filenameNoExtension, item.SubtitleName, excludeList);
                if (commonWords.length > maxCommonWords.length) {
                    maxCommonWords = commonWords;
                    maxIndex = index;
                }
            });

            const bestMatch: IFindFilmResponse = list[maxIndex];
            this.logger.log('info', `filename:  "${filenameNoExtension}"`);
            this.logger.log('info', `best match: "${bestMatch.SubtitleName}"`);
            this.logger.log('info', `common words: [\"${maxCommonWords.join('\", \"')}\"]`);

            return bestMatch.Identifier;
        }
    };


    public handleResponse = (error: any, response: request.Response, body: string, excludeList: string[], filenameNoExtension: string, relativePath: string) => {
        if (!error && response.statusCode === 200) {
            const results: IFindFilmResponse[] = body && JSON.parse(body).Results;
            if (Array.isArray(results) && results.length) {
                const subtitleID: string = this.findClosestMatch(filenameNoExtension, results, excludeList);
                this.downloadBestMatch(subtitleID, filenameNoExtension, relativePath);
            }
            else {
                this.logger.log('info', "No subtitle found");
                this.notifier.notif(`No subtitle found`);
            }
        }
        else {
            this.logger.log('error', error);
            if (response) {
                this.logger.log('error', JSON.stringify(response));
            }
        }
    };

    public handleMovie = (movieName: string, movieYear: number, filenameNoExtension: string, relativePath: string) =>{
        this.logger.log('info', `Handling Movie: "${movieName}" (${movieYear})`);
        const options: request.Options = {
            url: `${this.baseUrl}/FindFilm`,
            method: 'POST',
            headers: { "User-Agent": this.userAgent },
            json: {
                request: {
                    SearchPhrase: movieName,
                    SearchType: "FilmName",
                    Version:"1.0",
                    Year: movieYear
                }
            }
        };

        const excludeList: string[] = this.classifier.splitText(this.classifier.cleanText(movieName));
        excludeList.push(movieYear.toString());

        this.logger.log('debug', `Handle movie request options: ${JSON.stringify(options)}`);

        request(options, (error, response, body) => {
            this.handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
        });
    };

    public handleEpisode = (series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string) => {
        this.logger.log('info', `Handling Series "${series}" Season ${season} Episode ${episode}`);
        const options: request.Options = {
            url: `${this.baseUrl}/FindSeries`,
            method: 'POST',
            headers: { "User-Agent": this.userAgent },
            json: {
                request: {
                    SearchPhrase: series,
                    SearchType: "FilmName",
                    Version:"1.0",
                    Season: season,
                    Episode: episode
                }
            }
        };

        const excludeList: string[] = this.classifier.splitText(series);

        this.logger.log('debug', `Handle episode request options: ${JSON.stringify(options)}`);

        request(options, (error, response, body) => {
            this.handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
        });
    };

    public downloadBestMatch = (subtitleID: string, filenameNoExtension: string, relativePath: string) => {
        this.logger.log('info', `Downloading: ${subtitleID}`);
        const options: request.Options = {
            url: `${this.baseUrl}/Download`,
            method: 'POST',
            headers: {"User-Agent": this.userAgent, "Accept": "*/*"},
            encoding: null,
            json: {
                request: {
                    subtitleID
                }
            }
        };

        this.logger.log('debug', JSON.stringify(options));

        request(options, (error, response, body) => {
            if (!error && response.statusCode === 200) {
                // Check if already exists
                if (this.classifier.isSubtitlesAlreadyExist(relativePath, filenameNoExtension)) {
                    this.logger.log('warning', `Hebrew subtitles already exist`);
                    this.notifier.notif(`Hebrew subtitles already exist`);
                    return;
                }

                const destination: string = path.resolve(relativePath, filenameNoExtension + ".Hebrew.srt");
                this.logger.log('verbose', `writing response to ${destination}`);
                fs.writeFileSync(destination, body);
                this.notifier.notif(`Successfully downloaded "${destination}"`);
            }
            else {
                this.logger.log('error', error);
                this.notifier.notif(`Failed downloading subtitle`);
            }
        });
    };
}
