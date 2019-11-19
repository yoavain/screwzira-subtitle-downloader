import * as fs from "fs";
import * as path from "path";
import { ISzConfig } from "./szConfig";
import { ISzLogger } from "./szLogger";

// RegEx
const episodeRegex = /(.+?)[Ss]?0?(\d+)?[xeE]0?(\d+)/;
const movieRegex = /([ .\w']+?)[. ](\d{4})[. ]/;
const movieParentRegex = /((?:[^(]+))\s+(?:\((\d+)\))/;

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

interface IFileClassification {
    type: string;
}

export interface IMovieFileClassification extends IFileClassification {
    movieName: string;
    movieYear: number;
}

export interface ITvEpisodeFileClassification extends IFileClassification {
    series: string;
    season: number;
    episode: number;
}

export interface ICommonWordsInSentenceResponse {
    commonWords: string[];
    mark: number;
}

export interface ISzClassifier {
    // new(logger: ISzLogger, config: ISzConfig): any;
    cleanText: (text: string) => string;
    splitText: (text: string) => string[];
    isSubtitlesAlreadyExist: (relativePath: string, filenameNoExtension: string) => boolean;
    commonWordsInSentences: (s1: string, s2: string, excludeList: string[]) => ICommonWordsInSentenceResponse;
    calculateSimilarityMark: (words: string[]) => number;
    classify: (filenameNoExtension: string, parentFolder: string) => IMovieFileClassification | ITvEpisodeFileClassification;
}

export class SzClassifier implements ISzClassifier {
    private readonly logger: ISzLogger;
    private readonly config: ISzConfig;

    constructor(logger: ISzLogger, config: ISzConfig) {
        this.logger = logger;
        this.config = config;
    }

    public cleanText = (text: string): string => {
        return text
            .toLowerCase()
            .replace(/[.|-]/g, " ")
            .trim();
    };

    public splitText = (text: string): string[] => {
        return text.split(" ");
    };

    public isSubtitlesAlreadyExist = (relativePath: string, filenameNoExtension: string): boolean => {
        const destination: string = path.resolve(relativePath, filenameNoExtension + ".Hebrew.srt");
        return fs.existsSync(destination);
    };

    public commonWordsInSentences = (s1: string, s2: string, excludeList: string[]): ICommonWordsInSentenceResponse => {
        const split1: string[] = this.splitText(this.cleanText(s1));
        const split2: string[] = this.splitText(this.cleanText(s2));

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
     * @param parentFolder
     */
    public classify = (filenameNoExtension: string, parentFolder: string): IMovieFileClassification | ITvEpisodeFileClassification => {
        const episodeMatch: RegExpExecArray = episodeRegex.exec(filenameNoExtension);
        if (episodeMatch?.length >= 3 && episodeMatch[1] && episodeMatch[2] && episodeMatch[3]) {
            this.logger.verbose(`Classification match episode: ${JSON.stringify(episodeMatch)}`);
            return {
                type: "episode",
                series: this.config.replaceTitleIfNeeded(this.cleanText(episodeMatch[1])),
                season: Number(episodeMatch[2]),
                episode: Number(episodeMatch[3])
            };
        }
        else {
            const movieMatch: RegExpExecArray = movieRegex.exec(filenameNoExtension);
            if (movieMatch?.length >= 2 && movieMatch[1] && movieMatch[2]) {
                this.logger.verbose(`Classification match movie: ${JSON.stringify(movieMatch)}`);
                return {
                    type: "movie",
                    movieName: this.config.replaceTitleIfNeeded(this.cleanText(movieMatch[1])),
                    movieYear: Number(movieMatch[2])
                };
            }
            else if (parentFolder) {
                const movieMatchFromParent: RegExpExecArray = movieParentRegex.exec(parentFolder);
                if (movieMatchFromParent?.length >= 2 && movieMatchFromParent[1] && movieMatchFromParent[2]) {
                    this.logger.verbose(`Classification match movie folder: ${JSON.stringify(movieMatchFromParent)}`);
                    return {
                        type: "movie",
                        movieName: this.config.replaceTitleIfNeeded(this.cleanText(movieMatchFromParent[1])),
                        movieYear: Number(movieMatchFromParent[2])
                    };
                }
            }
        }
        return undefined;
    };
}
