import type { MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";

export interface ParserInterface {
    handleMovie: (movie: MovieFileClassificationInterface) => Promise<void>;
    handleEpisode: (tvEpisode: TvEpisodeFileClassificationInterface) => Promise<void>;
}