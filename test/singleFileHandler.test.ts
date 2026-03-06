import { handleSingleFile } from "~src/singleFileHandler";
import { FileClassification } from "~src/classifier";
import { NotificationType } from "~src/notifier";
import type { ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import type { ParserInterface } from "~src/parsers/parserInterface";
import { MockNotifier } from "~test/__mocks__";

const makeClassifier = (overrides: Partial<ClassifierInterface> = {}): ClassifierInterface => ({
    getSubtitlesSuffix: jest.fn(() => "srt"),
    isSubtitlesAlreadyExist: jest.fn(async () => false),
    commonWordsInSentences: jest.fn(),
    calculateSimilarityMark: jest.fn(() => 0),
    classify: jest.fn(() => undefined),
    findAlternativeName: jest.fn((name) => name),
    ...overrides
});


const makeParser = (): ParserInterface => ({
    handleMovie: jest.fn() as jest.MockedFunction<ParserInterface["handleMovie"]>,
    handleEpisode: jest.fn() as jest.MockedFunction<ParserInterface["handleEpisode"]>
});

const MOVIE: MovieFileClassificationInterface = {
    type: FileClassification.MOVIE,
    movieName: "Some Movie",
    movieYear: 2023,
    filenameNoExtension: "some.movie.2023",
    relativePath: "/some/dir"
};

const EPISODE: TvEpisodeFileClassificationInterface = {
    type: FileClassification.EPISODE,
    series: "Some Show",
    season: 1,
    episode: 1,
    filenameNoExtension: "some.show.S01E01",
    relativePath: "/some/dir"
};

describe("handleSingleFile", () => {
    it("returns false and notifies when subtitles already exist", async () => {
        const classifier = makeClassifier({ isSubtitlesAlreadyExist: jest.fn(async () => true) });
        const notifier = new MockNotifier();
        const parser = makeParser();

        const result = await handleSingleFile("/some/dir/movie.mkv", true, classifier, notifier, parser);

        expect(result).toBe(false);
        expect(notifier.notif).toHaveBeenCalledWith("Hebrew subtitles already exist", NotificationType.WARNING);
        expect(classifier.classify).not.toHaveBeenCalled();
        expect(parser.handleMovie).not.toHaveBeenCalled();
        expect(parser.handleEpisode).not.toHaveBeenCalled();
    });

    it("returns false and notifies when classification fails", async () => {
        const classifier = makeClassifier({ classify: jest.fn(() => undefined) });
        const notifier = new MockNotifier();
        const parser = makeParser();

        const result = await handleSingleFile("/some/dir/unclassifiable.mkv", true, classifier, notifier, parser);

        expect(result).toBe(false);
        expect(notifier.notif).toHaveBeenCalledWith("Unable to classify input file as movie or episode", NotificationType.FAILED);
    });

    it("calls handleMovie and returns true for a movie", async () => {
        const classifier = makeClassifier({ classify: jest.fn(() => MOVIE) });
        const notifier = new MockNotifier();
        const parser = makeParser();

        const result = await handleSingleFile("/some/dir/some.movie.2023.mkv", true, classifier, notifier, parser);

        expect(result).toBe(true);
        expect(parser.handleMovie).toHaveBeenCalledWith(MOVIE);
        expect(parser.handleEpisode).not.toHaveBeenCalled();
    });

    it("calls handleEpisode and returns true for an episode", async () => {
        const classifier = makeClassifier({ classify: jest.fn(() => EPISODE) });
        const notifier = new MockNotifier();
        const parser = makeParser();

        const result = await handleSingleFile("/some/dir/some.show.S01E01.mkv", true, classifier, notifier, parser);

        expect(result).toBe(true);
        expect(parser.handleEpisode).toHaveBeenCalledWith(EPISODE);
        expect(parser.handleMovie).not.toHaveBeenCalled();
    });

    it("passes undefined parentFolder when useParentFolder is false", async () => {
        const classifyMock = jest.fn(() => MOVIE);
        const classifier = makeClassifier({ classify: classifyMock });
        const notifier = new MockNotifier();
        const parser = makeParser();

        await handleSingleFile("/some/dir/some.movie.2023.mkv", false, classifier, notifier, parser);

        // When useParentFolder=false, parentFolder arg to classify should be undefined
        expect(classifyMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            undefined
        );
    });

    it("passes undefined parentFolder when useParentFolder is true but file is at root (empty basename)", async () => {
        const classifyMock = jest.fn(() => MOVIE);
        const classifier = makeClassifier({ classify: classifyMock });
        const notifier = new MockNotifier();
        const parser = makeParser();

        // File at root: path.basename(path.dirname("/movie.mkv")) = path.basename("/") = ""
        // "" || undefined = undefined
        await handleSingleFile("/some.movie.2023.mkv", true, classifier, notifier, parser);

        expect(classifyMock).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            undefined
        );
    });
});
