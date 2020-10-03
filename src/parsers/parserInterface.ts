export interface ParserInterface {
    handleMovie: (movieName: string, movieYear: number, filenameNoExtension: string, relativePath: string) => Promise<void>;
    handleEpisode: (series: string, season: number, episode: number, filenameNoExtension: string, relativePath: string) => Promise<void>;
}