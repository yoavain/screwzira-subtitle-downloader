import type { MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";

export interface ParserInterface {
    handleMovie: (movie: MovieFileClassificationInterface, filenameNoExtension: string, relativePath: string) => Promise<void>;
    handleEpisode: (tvEpisode: TvEpisodeFileClassificationInterface, filenameNoExtension: string, relativePath: string) => Promise<void>;
}