import { toTitleCase } from "~src/stringUtils";
import type { Subtitle } from "~src/parsers/commonParser";
import { CommonParser } from "~src/parsers/commonParser";
import { parseDownloadIdentifier, parseMovieId, parseMovieSubtitles } from "~src/parsers/ktuvit/ktuvitSiteUtils";
import { NotificationIcon } from "~src/parsers/notificationIconsInterface";
import * as fs from "fs";
import * as path from "path";
import type { OptionsOfBufferResponseBody, OptionsOfJSONResponseBody, OptionsOfTextResponseBody } from "got";
import got from "got";
import type { ParserInterface } from "~src/parsers/parserInterface";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import type { ClassifierInterface } from "~src/classifier";

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

    async handleMovie(movieName: string, movieYear: number, filenameNoExtension: string, relativePath: string): Promise<void> {
        const contextMessage = `movie "${toTitleCase(movieName)}" (${movieYear})`;
        this.logger.info(`Handling ${contextMessage}`);

        if (!this.cookie) {
            await this.login(this.email, this.password);
        }
        if (!this.cookie) {
            this.notifier.notif(`Failed to login to ${this.baseUrl}`, NotificationIcon.FAILED, true);
            return;
        }

        let movieId: string = await this.findMovieId(movieName, movieYear, contextMessage);
        if (!movieId) {
            const alternativeName: string = this.classifier.findAlternativeName(movieName);
            if (movieName !== alternativeName) {
                movieId = await this.findMovieId(alternativeName, movieYear, contextMessage);
            }
        }
        if (!movieId) {
            this.notifier.notif(`Unable to find movie ID for ${contextMessage}`, NotificationIcon.FAILED, true);
            return;
        }

        const subtitles: Subtitle[] = await this.getMovieSubtitles(movieId, contextMessage);
        if (!subtitles) {
            this.notifier.notif(`Unable to find subtitles for ${contextMessage}`, NotificationIcon.FAILED, true);
            return;
        }

        const excludeList: string[] = this.getMovieExcludeList(movieName, movieYear);

        const subtitleId: string = this.findClosestMatch(filenameNoExtension, subtitles, excludeList);

        const downloadIdentifier: string = await this.getDownloadIdentifier(movieId, subtitleId, contextMessage);
        if (!downloadIdentifier) {
            this.notifier.notif(`Unable to find subtitle download identifier for ${contextMessage}`, NotificationIcon.FAILED, true);
            return;
        }

        const success: boolean = await this.downloadFile(movieId, downloadIdentifier, filenameNoExtension, relativePath, contextMessage);
        if (!success) {
            this.notifier.notif(`Failed downloading subtitle for ${contextMessage}`, NotificationIcon.FAILED);
            return;
        }

        this.notifier.notif(`Successfully downloaded Subtitles for ${contextMessage}`, NotificationIcon.DOWNLOAD);
    }


    // eslint-disable-next-line no-unused-vars
    async handleEpisode(series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string): Promise<void> {
        return undefined;
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

    private findMovieId = async (movieName: string, movieYear: number, contextMessage: string): Promise<string> => {
        const options: OptionsOfJSONResponseBody = {
            url: `${this.baseUrl}/Services/ContentProvider.svc/SearchPage_search`,
            headers: {
                "User-Agent": this.userAgent,
                "Cookie": this.cookie.join("; ")
            },
            json: {
                request: {
                    FilmName: movieName,
                    Actors: [],
                    Studios: null,
                    Directors: [],
                    Genres: [],
                    Countries: [],
                    Languages: [],
                    Year: movieYear,
                    Rating: [],
                    Page: 1,
                    SearchType: "0",
                    WithSubsOnly: false
                }
            },
            responseType: "json"
        };

        let response;
        try {
            this.logger.debug(`Searching for ${contextMessage}`);
            response = await got.post(options);
            if (response.statusCode === 200) {
                return parseMovieId(response.body.d, movieName, movieYear);
            }
            else {
                this.handleError(response.error, response);
            }
        }
        catch (error) {
            this.handleError(error, response);
        }
    }

    private getMovieSubtitles = async (movieId: string, contextMessage: string): Promise<Subtitle[]> => {
        const options: OptionsOfTextResponseBody = {
            url: `${this.baseUrl}/MovieInfo.aspx?ID=${movieId}`,
            headers: {
                "User-Agent": this.userAgent,
                "Cookie": this.cookie.join("; ")
            }
        };

        let response;
        try {
            this.logger.debug(`Searching subtitles for ${contextMessage}`);
            response = await got.get(options);
            if (response.statusCode === 200) {
                return parseMovieSubtitles(response.body);
            }
            else {
                this.handleError(response.error, response);
            }
        }
        catch (error) {
            this.handleError(error, response);
        }
    }

    private getDownloadIdentifier = async (movieId: string, subtitleId: string, contextMessage: string): Promise<string> => {
        this.logger.info(`Downloading: ${subtitleId}`);
        const options: OptionsOfJSONResponseBody = {
            url: `${this.baseUrl}/Services/ContentProvider.svc/RequestSubtitleDownload`,
            headers: {
                "User-Agent": this.userAgent,
                "Accept": "*/*",
                "Referer": `${this.baseUrl}/MovieInfo.aspx?ID=${movieId}`,
                "Cookie": this.cookie.join("; ")
            },
            json: {
                request: {
                    FilmID: movieId,
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
                const destination: string = path.resolve(relativePath, filenameNoExtension + ".Hebrew.srt");
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
}
