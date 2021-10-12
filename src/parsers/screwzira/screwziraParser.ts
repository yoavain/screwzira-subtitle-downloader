import { toTitleCase } from "~src/stringUtils";
import type { Subtitle } from "~src/parsers/commonParser";
import { CommonParser } from "~src/parsers/commonParser";
import * as fs from "fs";
import * as path from "path";
import type { OptionsOfBufferResponseBody, OptionsOfJSONResponseBody } from "got";
import got from "got";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import { NotificationType } from "~src/notifier";
import type { ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import type { ParserInterface } from "~src/parsers/parserInterface";

export class ScrewziraParser extends CommonParser implements ParserInterface {
    private readonly baseUrl: string = "http://api.screwzira.com";

    constructor(logger: LoggerInterface, notifier: NotifierInterface, classifier: ClassifierInterface) {
        super(logger, notifier, classifier);
    }

    public handleMovie = async (movie: MovieFileClassificationInterface): Promise<void> => {
        const { filenameNoExtension, relativePath, movieName, movieYear } = movie;
        const contextMessage = `movie "${toTitleCase(movieName)}" (${movieYear})`;
        this.logger.info(`Handling ${contextMessage}`);
        const options: OptionsOfJSONResponseBody = {
            url: `${this.baseUrl}/FindFilm`,
            headers: { "User-Agent": this.userAgent },
            json: {
                request: {
                    SearchPhrase: movieName,
                    SearchType: "FilmName",
                    Version: "1.0",
                    Year: movieYear
                }
            },
            responseType: "json"
        };

        const excludeList: string[] = this.getMovieExcludeList(movieName, movieYear);

        this.logger.debug(`Handle movie request options: ${JSON.stringify(options)}`);

        await this.requestSubtitles(options, excludeList, filenameNoExtension, relativePath, contextMessage, true);
    };

    public handleEpisode = async (tvEpisode: TvEpisodeFileClassificationInterface): Promise<void> => {
        const { filenameNoExtension, relativePath, series, season, episode } = tvEpisode;
        const contextMessage = `series "${toTitleCase(series)}" season ${season} episode ${episode}`;
        this.logger.info(`Handling ${contextMessage}`);
        const options: OptionsOfJSONResponseBody = {
            url: `${this.baseUrl}/FindSeries`,
            headers: { "User-Agent": this.userAgent },
            json: {
                request: {
                    SearchPhrase: series,
                    SearchType: "FilmName",
                    Version: "1.0",
                    Season: season,
                    Episode: episode
                }
            },
            responseType: "json"
        };

        const excludeList: string[] = this.getTvSeriesExcludeList(series);

        this.logger.debug(`Handle episode request options: ${JSON.stringify(options)}`);

        await this.requestSubtitles(options, excludeList, filenameNoExtension, relativePath, contextMessage);
    };


    private downloadBestMatch = async (subtitleID: string, filenameNoExtension: string, relativePath: string, contextMessage: string): Promise<void> => {
        this.logger.info(`Downloading: ${subtitleID}`);
        const options: OptionsOfBufferResponseBody = {
            url: `${this.baseUrl}/Download`,
            headers: { "User-Agent": this.userAgent, "Accept": "*/*" },
            json: {
                request: {
                    subtitleID
                }
            },
            responseType: "buffer"
        };

        this.logger.debug(JSON.stringify(options));

        let response;
        try {
            response = await got.post(options);
            if (response.statusCode === 200) {
                // Check if already exists
                if (this.classifier.isSubtitlesAlreadyExist(relativePath, filenameNoExtension)) {
                    this.notifier.notif(`Hebrew subtitles already exist for ${contextMessage}`, NotificationType.WARNING);
                    return;
                }

                const destination: string = path.resolve(relativePath, filenameNoExtension + ".Hebrew.srt");
                this.logger.verbose(`writing response to ${destination}`);
                fs.writeFileSync(destination, response.body);
                this.notifier.notif(`Successfully downloaded Subtitles for ${contextMessage}`, NotificationType.DOWNLOAD);
            }
            else {
                this.logger.error(response.error);
                this.notifier.notif(`Failed downloading subtitle for ${contextMessage}`, NotificationType.FAILED);
            }
        }
        catch (error) {
            this.logger.error(error);
            this.notifier.notif(`Failed downloading subtitle for ${contextMessage}`, NotificationType.FAILED);
        }
    };

    private requestSubtitles = async (options: OptionsOfJSONResponseBody, excludeList: string[], filenameNoExtension: string, relativePath: string, contextMessage: string, allowRetry?: boolean) => {
        let response;
        try {
            response = await got.post(options);
            if (response.statusCode === 200) {
                const results: Subtitle[] = this.parseResults(response.body);
                if (results && results.length > 0) {
                    await this.handleResults(results, excludeList, filenameNoExtension, relativePath, contextMessage);
                    return;
                }

                if (allowRetry) {
                    const alternativeName: string = this.classifier.findAlternativeName(options.json?.request?.SearchPhrase);

                    // retry
                    if (alternativeName) {
                        this.logger.info(`Retrying with "${alternativeName}"`);
                        const optionsWithAlternativeName = { ...options };
                        optionsWithAlternativeName.json.request.SearchPhrase = alternativeName;
                        await this.requestSubtitles(optionsWithAlternativeName, excludeList, filenameNoExtension, relativePath, contextMessage, false);
                        return;
                    }
                }

                this.handleNoSubtitlesFound(contextMessage);
            }
            else {
                this.handleError(response.error, response);
            }
        }
        catch (error) {
            this.handleError(error, response);
        }
    };

    private parseResults = (body: string): Subtitle[] => {
        const results: Subtitle[] = body && JSON.parse(body).Results;
        if (Array.isArray(results)) {
            return body && JSON.parse(body).Results;
        }
    };

    private handleResults = async (results: Subtitle[], excludeList: string[], filenameNoExtension: string, relativePath: string, contextMessage: string): Promise<void> => {
        if (Array.isArray(results) && results.length) {
            const subtitleID: string = this.findClosestMatch(filenameNoExtension, results, excludeList);
            await this.downloadBestMatch(subtitleID, filenameNoExtension, relativePath, contextMessage);
        }
    };
}
