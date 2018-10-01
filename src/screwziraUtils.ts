const fs = require('fs');
const path = require('path');
const request = require('request');
import {Response} from 'request';
import {ISzNotifier} from './szNotifier';
import {ISzClassifier} from './szClassifier';
import {ISzLogger} from './szLogger';


class ScrewziraUtils {
    // Request Info
    baseUrl = 'http://api.screwzira.com';
    userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3528.4 Safari/537.36';

    logger: ISzLogger;
    notifier: ISzNotifier;
    classifier: ISzClassifier;

    constructor(logger: ISzLogger, notifier: ISzNotifier, classifier: ISzClassifier) {
        this.logger = logger;
        this.notifier = notifier;
        this.classifier = classifier;
    }

    findClosestMatch = (filenameNoExtension: string, list, excludeList: string[]): string => {
        this.logger.log('info', `Looking for closest match for "${filenameNoExtension}" from: [${list && list.map(item => item.SubtitleName).join(', ')}]`);
        if (list && list.length > 0) {
            let maxCommonWords = this.classifier.commonWordsInSentences(filenameNoExtension, list[0].SubtitleName, excludeList);
            let maxIndex = 0;
            list.forEach((item, index) => {
                let commonWords = this.classifier.commonWordsInSentences(filenameNoExtension, item.SubtitleName, excludeList);
                if (commonWords.length > maxCommonWords.length) {
                    maxCommonWords = commonWords;
                    maxIndex = index;
                }
            });

            let bestMatch = list[maxIndex];
            this.logger.log('info', `filename:  "${filenameNoExtension}"`);
            this.logger.log('info', `best match: "${bestMatch.SubtitleName}"`);
            this.logger.log('info', `common words: [\"${maxCommonWords.join('\", \"')}\"]`);

            return bestMatch.Identifier;
        }
    };


    handleResponse = (error: any, response: Response, body: string, excludeList: string[], filenameNoExtension: string, relativePath: string) => {
        if (!error && response.statusCode == 200) {
            let results = body && JSON.parse(body).Results;
            if (Array.isArray(results) && results.length) {
                let subtitleID = this.findClosestMatch(filenameNoExtension, results, excludeList);
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

    handleMovie(movieName, movieYear, filenameNoExtension, relativePath) {
        this.logger.log('info', `Handling Movie: "${movieName}" (${movieYear})`);
        const options = {
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

        let excludeList = this.classifier.splitText(this.classifier.cleanText(movieName));
        excludeList.push(movieYear.toString());

        this.logger.log('debug', `Handle movie request options: ${JSON.stringify(options)}`);

        request(options, (error, response, body) => {
            this.handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
        });
    }

    handleEpisode(series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string) {
        this.logger.log('info', `Handling Series "${series}" Season ${season} Episode ${episode}`);
        const options = {
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

        let excludeList = this.classifier.splitText(series);

        this.logger.log('debug', `Handle episode request options: ${JSON.stringify(options)}`);

        request(options, (error, response, body) => {
            this.handleResponse(error, response, body, excludeList, filenameNoExtension, relativePath);
        });
    }

    downloadBestMatch = (subtitleID: string, filenameNoExtension: string, relativePath: string) => {
        this.logger.log('info', `Downloading: ${subtitleID}`);
        const options = {
            url: `${this.baseUrl}/Download`,
            method: 'POST',
            headers: {"User-Agent": this.userAgent, "Accept": "*/*"},
            encoding: null,
            json: {
                request: {
                    subtitleID: subtitleID
                }
            }
        };

        this.logger.log('debug', JSON.stringify(options));

        request(options, (error, response, body) => {
            if (!error && response.statusCode == 200) {
                let destination = path.resolve(relativePath, filenameNoExtension + ".Hebrew.srt");
                if (fs.existsSync(destination)) {
                    destination = path.resolve(relativePath, filenameNoExtension + ".HebrewSZ.srt");
                }
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

module.exports = ScrewziraUtils;