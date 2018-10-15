import {ISzConfig} from './szConfig'
import {ISzLogger} from './szLogger';

// RegEx
const episodeRegex = /(.+?)S?0*(\d+)?[xE]0*(\d+)/;
const movieRegex = /([ .\w']+?)\.(\d+)/;
const movieParentRegex = /((?:[^(]+))\s+(?:\((\d+)\))/;

interface IFileClassification {
    type: string
}

export interface IMovieFileClassification extends IFileClassification {
    movieName: string,
    movieYear: number
}

export interface ITvEpisodeFileClassification extends IFileClassification {
    series: string,
    season: number,
    episode: number
}

export interface ISzClassifier  {
    // new(logger: ISzLogger, config: ISzConfig): any;

    cleanText(text: string): string;

    splitText(text: string): string[];

    commonWordsInSentences(s1: string, s2: string, excludeList: string[]): string[];

    classify(filenameNoExtension: string, parentFolder: string): IMovieFileClassification | ITvEpisodeFileClassification;
}

export class SzClassifier implements ISzClassifier {
    public logger: ISzLogger;
    public config: ISzConfig;

    constructor(logger: ISzLogger, config: ISzConfig) {
        this.logger = logger;
        this.config = config;
    }

    public cleanText = (text: string): string => {
        return text.toLowerCase().replace(/[.|-]/g, ' ').trim();
    };

    public splitText = (text: string): string[] => {
        return text.split(' ');
    };

    public commonWordsInSentences = (s1: string, s2: string, excludeList: string[]): string[] => {
        const split1 = this.splitText(this.cleanText(s1));
        const split2 = this.splitText(this.cleanText(s2));

        const commonWords = split1.filter(word1 => word1.length > 1 && !excludeList.includes(word1) && split2.includes(word1));
        this.logger.log('debug', `"${s1}" & "${s2}" have ${commonWords.length} words in common [${commonWords.join("#")}]`);
        return commonWords;
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
        const episodeMatch = episodeRegex.exec(filenameNoExtension);
        if (episodeMatch && episodeMatch.length > 2 && episodeMatch[1] && episodeMatch[2] && episodeMatch[3]) {
            this.logger.log('verbose', `Classification match episode: ${JSON.stringify(episodeMatch)}`);
            return {
                type: "episode",
                series: this.config.replaceTitleIfNeeded(this.cleanText(episodeMatch[1])),
                season: Number(episodeMatch[2]),
                episode: Number(episodeMatch[3])
            };
        }
        else {
            const movieMatch = movieRegex.exec(filenameNoExtension);
            if (movieMatch && movieMatch.length > 1 && movieMatch[1] && movieMatch[2]) {
                this.logger.log('verbose', `Classification match movie: ${JSON.stringify(movieMatch)}`);
                return {
                    type: "movie",
                    movieName: this.config.replaceTitleIfNeeded(this.cleanText(movieMatch[1])),
                    movieYear: Number(movieMatch[2])
                };
            }
            else if (parentFolder) {
                const movieMatchFromParent = movieParentRegex.exec(parentFolder);
                if (movieMatchFromParent && movieMatchFromParent.length > 1 && movieMatchFromParent[1] && movieMatchFromParent[2]) {
                    this.logger.log('verbose', `Classification match movie folder: ${JSON.stringify(movieMatchFromParent)}`);
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