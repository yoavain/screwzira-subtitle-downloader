import {ISzConfig} from './szConfig'
import {ISzLogger} from './szLogger';

interface FileClassification {
    type: string
}

interface MovieFileClassification extends FileClassification {
    movieName: string,
    movieYear: number
}

interface TvEpisodeFileClassification extends FileClassification {
    series: string,
    season: number,
    episode: number
}

export interface ISzClassifier {
    new(logger: ISzLogger, config: ISzConfig): SzClassifier;
    cleanText(text: string): string;
    splitText(text: string): string[];
    commonWordsInSentences(s1: string, s2: string, excludeList: string[]): string[];
    classify(filenameNoExtension: string, parentFolder: string): MovieFileClassification | TvEpisodeFileClassification;
}

class SzClassifier {
    episodeRegex: RegExp;
    movieRegex: RegExp;
    movieParentRegex: RegExp;
    logger: ISzLogger;
    config: ISzConfig;

    constructor(logger: ISzLogger, config: ISzConfig) {
        // Regex
        this.episodeRegex = /(.+?)S?0*(\d+)?[xE]0*(\d+)/;
        this.movieRegex = /([ .\w']+?)\.(\d+)/;
        this.movieParentRegex = /((?:[^(]+))\s+(?:\((\d+)\))/;
        this.logger = logger;
        this.config = config;
    }

    cleanText = (text: string): string => {
        return text.toLowerCase().replace(/[.|-]/g, ' ').trim();
    };

    splitText = (text: string): string[] => {
        return text.split(' ');
    };

    commonWordsInSentences = (s1: string, s2: string, excludeList: string[]): string[] => {
        let split1 = this.splitText(this.cleanText(s1));
        let split2 = this.splitText(this.cleanText(s2));

        let commonWords = split1.filter(word1 => word1.length > 1 && !excludeList.includes(word1) && split2.includes(word1));
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
    classify = (filenameNoExtension: string, parentFolder: string): MovieFileClassification | TvEpisodeFileClassification => {
        let episodeMatch = this.episodeRegex.exec(filenameNoExtension);
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
            let movieMatch = this.movieRegex.exec(filenameNoExtension);
            if (movieMatch && movieMatch.length > 1 && movieMatch[1] && movieMatch[2]) {
                this.logger.log('verbose', `Classification match movie: ${JSON.stringify(movieMatch)}`);
                return {
                    type: "movie",
                    movieName: this.config.replaceTitleIfNeeded(movieMatch[1]),
                    movieYear: Number(movieMatch[2])
                };
            }
            else {
                let movieMatchFromParent = this.movieParentRegex.exec(parentFolder);
                if (movieMatchFromParent && movieMatchFromParent.length > 1 && movieMatchFromParent[1] && movieMatchFromParent[2]) {
                    this.logger.log('verbose', `Classification match movie folder: ${JSON.stringify(movieMatchFromParent)}`);
                    return {
                        type: "movie",
                        movieName: this.config.replaceTitleIfNeeded(movieMatchFromParent[1]),
                        movieYear: Number(movieMatchFromParent[2])
                    };
                }
            }
        }
        return undefined;
    };
}

module.exports = SzClassifier;