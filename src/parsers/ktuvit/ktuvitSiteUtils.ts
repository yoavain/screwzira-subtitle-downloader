import type { Subtitle } from "~src/parsers/commonParser";
import type { GetMovieResponse } from "~src/parsers/ktuvit/ktuvitParser";

export const parseId = (queryBody: string, name: string, year?: number): string => {
    const results: GetMovieResponse[] = queryBody && JSON.parse(queryBody).Films;
    if (Array.isArray(results)) {
        return results.find((result: GetMovieResponse) => result.EngName?.toLowerCase() === name.toLowerCase() && (!year || result.ReleaseDate === year))?.ID;
    }
};

export const parseSubtitles = (pageBody: string): Subtitle[] => {
    const subsSplitRegex = new RegExp("<tr>(.+?)</tr>", "mgs");
    const subtitleSections: RegExpMatchArray = pageBody.match(subsSplitRegex);
    return subtitleSections?.reduce((acc: Subtitle[], part: string) => {
        const parseSubRegex = new RegExp("<div style=\"float.+?>\\s+(.+?)<br />.+?data-subtitle-id=\"(.+?)\"", "mgs");
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
