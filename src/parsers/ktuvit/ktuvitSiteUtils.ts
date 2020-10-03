import { GetMovieResponse } from "~src/parsers/ktuvit/ktuvitParser";
import { Subtitle } from "~src/parsers/commonParser";

export const parseMovieId = (queryBody: string, movieName: string, movieYear: number): string => {
    const results: GetMovieResponse[] = queryBody && JSON.parse(queryBody).Films;
    if (Array.isArray(results)) {
        return results.find((result: GetMovieResponse) => result.EngName === movieName && result.ReleaseDate === movieYear)?.ID;
    }
};

export const parseMovieSubtitles = (pageBody: string): Subtitle[] => {
    const subsSplitRegex = /<tr>(.+?)<\/tr>/mgs;
    const subtitleSections: RegExpMatchArray = pageBody.match(subsSplitRegex);
    return subtitleSections?.reduce((acc: Subtitle[], part: string) => {
        const parseSubRegex = /<div style="float.+?>\s+(.+?)<br \/>.+?data-subtitle-id="(.+?)"/mgs;
        const parsedSubtitleInfo = parseSubRegex.exec(part);
        if (parsedSubtitleInfo && parsedSubtitleInfo.length >= 3) {
            acc.push({
                name: parsedSubtitleInfo[1],
                id: parsedSubtitleInfo[2]
            });
        }
        return acc;
    }, []);
};

export const parseDownloadIdentifier = (queryBody: string): string => {
    return queryBody && JSON.parse(queryBody).DownloadIdentifier;
};
