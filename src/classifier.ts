import { cleanText, splitText } from "~src/stringUtils";
import * as fs from "fs";
import * as path from "path";
import type { ConfigInterface } from "~src/config";
import type { LoggerInterface } from "~src/logger";

// RegEx
const episodeRegex = /(.+?)[Ss]?0?(\d+)?[xeE]0?(\d+)/;
const movieRegex = /([ .\w']+?)[. ](\d{4})[. ]/;
const movieParentRegex = /((?:[^(]+))\s+(?:\((\d+)\))/;

const SUBTITLES_EXTENSION = "srt";

interface IWordWeight {
    [key: string]: number;
}

export const SPECIAL_EDITION_MARK = 4;
export const RIP_MARK = 3;
export const ENCODING_MARK = 1.2;
export const DIMENSION_MARK = 0.8;
export const AUDIO_MARK = 0.5;
export const COMMON_WORDS_MARK = 0.1;
const WORD_WEIGHTS: IWordWeight = {
    "theatrical": SPECIAL_EDITION_MARK,
    "final": SPECIAL_EDITION_MARK / 2,
    "cut": SPECIAL_EDITION_MARK / 2,
    "bluray": RIP_MARK,
    "hddvd": RIP_MARK,
    "webrip": RIP_MARK,
    "hdtv": RIP_MARK,
    "web": RIP_MARK / 2,
    "dl": RIP_MARK / 2,
    "x264": ENCODING_MARK,
    "x265": ENCODING_MARK,
    "1080p": DIMENSION_MARK,
    "720p": DIMENSION_MARK,
    "5.1": AUDIO_MARK,
    "dts": AUDIO_MARK,
    "dd5": AUDIO_MARK,
    "ac3": AUDIO_MARK,
    "the": COMMON_WORDS_MARK
};

export enum FileClassification {
    MOVIE = "movie",
    EPISODE = "episode"
}

interface FileClassificationInterface {
    filenameNoExtension: string,
    relativePath: string,
    type: FileClassification;
}

export interface MovieFileClassificationInterface extends FileClassificationInterface {
    type: FileClassification.MOVIE,
    movieName: string;
    movieYear: number;
}

export interface TvEpisodeFileClassificationInterface extends FileClassificationInterface {
    type: FileClassification.EPISODE,
    series: string;
    season: number;
    episode: number;
}

export interface CommonWordsInSentenceResponseInterface {
    commonWords: string[];
    mark: number;
}

export interface ClassifierInterface {
    getSubtitlesSuffix: () => string;
    isSubtitlesAlreadyExist: (relativePath: string, filenameNoExtension: string) => boolean;
    commonWordsInSentences: (s1: string, s2: string, excludeList: string[]) => CommonWordsInSentenceResponseInterface;
    calculateSimilarityMark: (words: string[]) => number;
    classify: (filenameNoExtension: string, relativePath: string, parentFolder: string) => MovieFileClassificationInterface | TvEpisodeFileClassificationInterface;
    findAlternativeName: (movieName: string) => string;
}

export class Classifier implements ClassifierInterface {
    private readonly logger: LoggerInterface;
    private readonly config: ConfigInterface;

    constructor(logger: LoggerInterface, config: ConfigInterface) {
        this.logger = logger;
        this.config = config;
    }

    public getSubtitlesSuffix = () => {
        return `${this.config.getLanguageCode()}.${SUBTITLES_EXTENSION}`;
    };


    public isSubtitlesAlreadyExist = (relativePath: string, filenameNoExtension: string): boolean => {
        const destination: string = path.resolve(relativePath, `${filenameNoExtension}.${this.getSubtitlesSuffix()}`);
        return fs.existsSync(destination);
    };

    public commonWordsInSentences = (s1: string, s2: string, excludeList: string[]): CommonWordsInSentenceResponseInterface => {
        const split1: string[] = splitText(cleanText(s1));
        const split2: string[] = splitText(cleanText(s2));

        const commonWords: string[] = split1.filter((word1) => word1.length > 1 && !excludeList.includes(word1) && split2.includes(word1));
        const mark: number = this.calculateSimilarityMark(commonWords);
        this.logger.debug(`"${s1}" & "${s2}" have ${commonWords.length} words in common [${commonWords.join("#")}] with total mark: ${mark}`);
        return { commonWords, mark };
    };

    public calculateSimilarityMark = (words: string[]): number => {
        return words.reduce((acc, word) => {
            acc += WORD_WEIGHTS[word] !== undefined ? WORD_WEIGHTS[word] : Math.min(5, word.length) / 5;
            return acc;
        }, 0);
    };

    /**
     * Classify filename:
     * 1. Try episode regex
     * 2. Try movie regex
     * 3. Try movie folder regex
     * @param filenameNoExtension
     * @param relativePath
     * @param parentFolder
     */
    public classify = (filenameNoExtension: string, relativePath: string, parentFolder: string): MovieFileClassificationInterface | TvEpisodeFileClassificationInterface => {
        const episodeMatch: RegExpExecArray = episodeRegex.exec(filenameNoExtension);
        if (episodeMatch?.length >= 3 && episodeMatch[1] && episodeMatch[2] && episodeMatch[3]) {
            this.logger.verbose(`Classification match episode: ${JSON.stringify(episodeMatch)}`);
            return {
                filenameNoExtension,
                relativePath,
                type: FileClassification.EPISODE,
                series: this.config.replaceTitleIfNeeded(cleanText(episodeMatch[1])),
                season: Number(episodeMatch[2]),
                episode: Number(episodeMatch[3])
            };
        }
        else {
            const movieMatch: RegExpExecArray = movieRegex.exec(filenameNoExtension);
            if (movieMatch?.length >= 2 && movieMatch[1] && movieMatch[2]) {
                this.logger.verbose(`Classification match movie: ${JSON.stringify(movieMatch)}`);
                return {
                    filenameNoExtension,
                    relativePath,
                    type: FileClassification.MOVIE,
                    movieName: this.config.replaceTitleIfNeeded(cleanText(movieMatch[1])),
                    movieYear: Number(movieMatch[2])
                };
            }
            else if (parentFolder) {
                const movieMatchFromParent: RegExpExecArray = movieParentRegex.exec(parentFolder);
                if (movieMatchFromParent?.length >= 2 && movieMatchFromParent[1] && movieMatchFromParent[2]) {
                    this.logger.verbose(`Classification match movie folder: ${JSON.stringify(movieMatchFromParent)}`);
                    return {
                        filenameNoExtension,
                        relativePath,
                        type: FileClassification.MOVIE,
                        movieName: this.config.replaceTitleIfNeeded(cleanText(movieMatchFromParent[1])),
                        movieYear: Number(movieMatchFromParent[2])
                    };
                }
            }
        }
        return undefined;
    };

    /**
     * Id movie name ends with a number < 10, assume an alternative name can be in ROMAN representation
     * @param movieName
     */
    public findAlternativeName = (movieName: string): string => {
        const movieNameParts = movieName.split(" ");
        if (movieNameParts.length > 1) {
            const lastMovieNamePart: string = movieNameParts.pop();
            const sequelNumber = Number(lastMovieNamePart);
            if (!isNaN(sequelNumber) && sequelNumber < 10) {
                return `${movieNameParts.join(" ")} ${this.intToRomanUpto9(sequelNumber).toLowerCase()}`;
            }
        }
        return undefined;
    };

    intToRomanUpto9 = (num: number): string => {
        switch (num) {
            case 1:
                return "I";
            case 2:
                return "II";
            case 3:
                return "III";
            case 4:
                return "IV";
            case 5:
                return "V";
            case 6:
                return "VI";
            case 7:
                return "VII";
            case 8:
                return "VIII";
            case 9:
                return "IX";
            default:
                throw new Error("Unexpected input");

        }
    };
}
