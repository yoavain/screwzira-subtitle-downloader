import { toTitleCase } from "~src/stringUtils";
import type { Subtitle } from "~src/parsers/commonParser";
import { CommonParser } from "~src/parsers/commonParser";
import { parseDownloadIdentifier, parseId, parseSubtitles } from "~src/parsers/ktuvit/ktuvitSiteUtils";
import * as fs from "fs";
import * as path from "path";
import type { OptionsOfBufferResponseBody, OptionsOfJSONResponseBody, OptionsOfTextResponseBody } from "got";
import got from "got";
import type { ParserInterface } from "~src/parsers/parserInterface";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import { NotificationType } from "~src/notifier";
import type { ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import { FileClassification } from "~src/classifier";

export type GetMovieResponse = {
    EngName: string,
    ID: string,
    HebName: string,
    ReleaseDate: number,
    IsSeries: boolean,
    ImdbID: string,
    IMDB_Link?: string,
    FilmRunTimeMinutes?: number,
    Summary?: string,
    FolderID?: string,
    CreateDate?: string,
    Rating?: number,
    NumberOfVoters?: number,
    NumOfSubs?: number,
    FilmImage?: any,
    UrlParam?: any,
    Actors?: string,
    Countries?: any[],
    Directors?: string,
    Genres?: string,
    Languages?: any[],
    Studios?: any[]
}

type DownloadBestSubtitlesResponse = {
    success: boolean,
    errorMessage?: string
}

export class KtuvitParser extends CommonParser implements ParserInterface {
    private readonly baseUrl: string = "https://www.ktuvit.me";
    private readonly email: string;
    private readonly password: string;

    private cookie: string[];

    constructor(email: string, password: string, logger: LoggerInterface, notifier: NotifierInterface, classifier: ClassifierInterface) {
        super(logger, notifier, classifier);
        this.email = email;
        this.password = password;
    }

    async handleMovie(movie: MovieFileClassificationInterface): Promise<void> {
        const { filenameNoExtension, relativePath, movieName, movieYear } = movie;
        const contextMessage = `movie "${toTitleCase(movieName)}" (${movieYear})`;
        this.logger.info(`Handling ${contextMessage}`);

        if (!this.cookie) {
            await this.login(this.email, this.password);
        }
        if (!this.cookie) {
            this.notifier.notif(`Failed to login to ${this.baseUrl}`, NotificationType.FAILED, true);
            return;
        }

        let movieId: string = await this.findId(movie, contextMessage, movieName, movieYear);
        if (!movieId) {
            const alternativeName: string = this.classifier.findAlternativeName(movieName);
            if (alternativeName && movieName !== alternativeName) {
                const alternativeContextMessage = `movie "${toTitleCase(alternativeName)}" (${movieYear})`; 
                movieId = await this.findId(movie, alternativeContextMessage, alternativeName, movieYear);
            }
        }
        if (!movieId) {
            this.notifier.notif(`Unable to find movie ID for ${contextMessage}`, NotificationType.FAILED, true);
            return;
        }

        const options: OptionsOfTextResponseBody = this.getMovieSubtitlesOptions(movieId);
        const subtitles: Subtitle[] = await this.getSubtitles(options, contextMessage);
        if (!subtitles?.length) {
            this.notifier.notif(`Unable to find subtitles for ${contextMessage}`, NotificationType.FAILED, true);
            return;
        }

        const excludeList: string[] = this.getMovieExcludeList(movieName, movieYear);
        const downloadResponse: DownloadBestSubtitlesResponse = await this.downloadBestSubtitles(movieId, subtitles, excludeList, filenameNoExtension, relativePath, contextMessage);
        if (downloadResponse.success) {
            this.notifier.notif(`Successfully downloaded Subtitles for ${contextMessage}`, NotificationType.DOWNLOAD);
        }
        else {
            this.notifier.notif(downloadResponse.errorMessage, NotificationType.FAILED);
        }
    }

    // eslint-disable-next-line no-unused-vars
    async handleEpisode(tvEpisode: TvEpisodeFileClassificationInterface): Promise<void> {
        const { filenameNoExtension, relativePath, series, season, episode } = tvEpisode;
        const contextMessage = `series "${toTitleCase(series)}" season ${season} episode ${episode}`;
        this.logger.info(`Handling ${contextMessage}`);

        if (!this.cookie) {
            await this.login(this.email, this.password);
        }
        if (!this.cookie) {
            this.notifier.notif(`Failed to login to ${this.baseUrl}`, NotificationType.FAILED, true);
            return;
        }

        const seriesId: string = await this.findId(tvEpisode, contextMessage, series);
        if (!seriesId) {
            this.notifier.notif(`Unable to find series ID for ${contextMessage}`, NotificationType.FAILED, true);
            return;
        }

        const options: OptionsOfTextResponseBody = this.getEpisodeSubtitlesOptions(seriesId, season, episode);
        const subtitles: Subtitle[] = await this.getSubtitles(options, contextMessage);
        if (!subtitles?.length) {
            this.notifier.notif(`Unable to find subtitles for ${contextMessage}`, NotificationType.FAILED, true);
            return;
        }

        const excludeList: string[] = this.getTvSeriesExcludeList(series);
        const downloadResponse: DownloadBestSubtitlesResponse = await this.downloadBestSubtitles(seriesId, subtitles, excludeList, filenameNoExtension, relativePath, contextMessage);
        if (downloadResponse.success) {
            this.notifier.notif(`Successfully downloaded Subtitles for ${contextMessage}`, NotificationType.DOWNLOAD);
        }
        else {
            this.notifier.notif(downloadResponse.errorMessage, NotificationType.FAILED);
        }
    }

    private login = async (email: string, password: string): Promise<void> => {
        const options: OptionsOfJSONResponseBody = {
            url: `${this.baseUrl}/Services/MembershipService.svc/Login`,
            headers: {
                "User-Agent": this.userAgent
            },
            json: {
                request: {
                    Email: email,
                    Password: password
                }
            },
            responseType: "json"
        };

        let response;
        try {
            this.logger.debug("Login into Ktuvit.me");
            response = await got.post(options);
            if (response.statusCode === 200) {
                this.cookie = response.headers["set-cookie"];
            }
            else {
                this.handleError(response.error, response);
            }
        }
        catch (error) {
            this.handleError(error, response);
        }
    };

    private buildSearchOptions(name: string, type: FileClassification, movieYear?: number): OptionsOfJSONResponseBody {
        return {
            url: `${this.baseUrl}/Services/ContentProvider.svc/SearchPage_search`,
            headers: {
                "User-Agent": this.userAgent,
                "Cookie": this.cookie.join("; ")
            },
            json: {
                request: {
                    FilmName: name,
                    Actors: [],
                    Studios: null,
                    Directors: [],
                    Genres: [],
                    Countries: [],
                    Languages: [],
                    Rating: [],
                    Page: 1,
                    WithSubsOnly: false,
                    SearchType: type === FileClassification.MOVIE ? "0" : "1",
                    Year: type === FileClassification.MOVIE ? movieYear : ""
                }
            },
            responseType: "json"
        };
    }

    private findId = async (classification: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface, contextMessage: string, name: string, year?: number): Promise<string> => {
        const { type } = classification;
        const options: OptionsOfJSONResponseBody = this.buildSearchOptions(name, type, year);

        let response;
        try {
            this.logger.debug(`Searching for ${contextMessage}`);
            response = await got.post(options);
            if (response.statusCode === 200) {
                return parseId(response.body.d, name, year);
            }
            else {
                this.handleError(response.error, response);
            }
        }
        catch (error) {
            this.handleError(error, response);
        }
    }

    private getMovieSubtitlesOptions = (movieId: string): OptionsOfTextResponseBody => ({
        url: `${this.baseUrl}/MovieInfo.aspx?ID=${movieId}`,
        headers: {
            "User-Agent": this.userAgent,
            "Cookie": this.cookie.join("; ")
        }
    });

    private getEpisodeSubtitlesOptions = (seriesId: string, season: number, episode: number): OptionsOfTextResponseBody => ({
        url: `${this.baseUrl}/Services/GetModuleAjax.ashx?moduleName=SubtitlesList&SeriesID=${seriesId}&Season=${season}&Episode=${episode}`,
        headers: {
            "User-Agent": this.userAgent,
            "Referer": `${this.baseUrl}/MovieInfo.aspx?ID=${seriesId}`,
            "Cookie": this.cookie.join("; ")
        }
    });

    private getSubtitles = async (options: OptionsOfTextResponseBody, contextMessage: string): Promise<Subtitle[]> => {
        let response;
        try {
            this.logger.debug(`Searching subtitles for ${contextMessage}`);
            response = await got.get(options);
            if (response.statusCode === 200) {
                return parseSubtitles(response.body);
            }
            else {
                this.handleError(response.error, response);
            }
        }
        catch (error) {
            this.handleError(error, response);
        }
    }

    private getDownloadIdentifier = async (id: string, subtitleId: string, contextMessage: string): Promise<string> => {
        this.logger.info(`Downloading: ${subtitleId}`);
        const options: OptionsOfJSONResponseBody = {
            url: `${this.baseUrl}/Services/ContentProvider.svc/RequestSubtitleDownload`,
            headers: {
                "User-Agent": this.userAgent,
                "Accept": "*/*",
                "Referer": `${this.baseUrl}/MovieInfo.aspx?ID=${id}`,
                "Cookie": this.cookie.join("; ")
            },
            json: {
                request: {
                    FilmID: id,
                    SubtitleID: subtitleId,
                    FontSize: 0,
                    FontColor: "",
                    PredefinedLayout: -1
                }
            },
            responseType: "json"
        };

        let response;
        try {
            this.logger.debug(`Looking for download identifier for ${contextMessage}`);
            response = await got.post(options);
            if (response.statusCode === 200) {
                return parseDownloadIdentifier(response.body.d);
            }
            else {
                this.logger.error(response.error);
            }
        }
        catch (error) {
            this.logger.error(error);
        }
    };

    private downloadFile = async (movieId: string, downloadIdentifier: string, filenameNoExtension: string, relativePath: string, contextMessage: string): Promise<boolean> => {
        this.logger.info(`Downloading: ${downloadIdentifier}`);
        const options: OptionsOfBufferResponseBody = {
            url: `${this.baseUrl}/Services/DownloadFile.ashx?DownloadIdentifier=${downloadIdentifier}`,
            headers: {
                "User-Agent": this.userAgent,
                "Accept": "*/*",
                "Referer": `${this.baseUrl}/MovieInfo.aspx?ID=${movieId}`,
                "Cookie": this.cookie.join("; ")
            },
            responseType: "buffer"
        };

        let response;
        try {
            this.logger.debug(`Downloading subtitle for ${contextMessage}`);
            response = await got.get(options);
            if (response.statusCode === 200) {
                const destination: string = path.resolve(relativePath, `${filenameNoExtension}.${this.classifier.getSubtitlesSuffix()}`);
                this.logger.verbose(`writing response to ${destination}`);
                fs.writeFileSync(destination, response.body);
                return true;
            }
            else {
                this.logger.error(response.error);
            }
        }
        catch (error) {
            this.logger.error(error);
        }
    };

    private downloadBestSubtitles = async (id: string, subtitles: Subtitle[], excludeList: string[], filenameNoExtension: string, relativePath: string, contextMessage: string)
        : Promise<DownloadBestSubtitlesResponse> => {
        const subtitleId: string = this.findClosestMatch(filenameNoExtension, subtitles, excludeList);
        const downloadIdentifier: string = await this.getDownloadIdentifier(id, subtitleId, contextMessage);
        if (!downloadIdentifier) {
            return {
                success: false,
                errorMessage: `Unable to find subtitle download identifier for ${contextMessage}`
            };
        }

        const success: boolean = await this.downloadFile(id, downloadIdentifier, filenameNoExtension, relativePath, contextMessage);
        return {
            success,
            errorMessage: !success && `Failed downloading subtitle for ${contextMessage}`
        };
    };
}
