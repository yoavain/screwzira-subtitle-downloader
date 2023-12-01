import { parseDownloadIdentifier, parseId, parseSubtitles } from "~src/parsers/ktuvit/ktuvitSiteUtils";
import { readFile } from "fs/promises";
import * as path from "path";
import type { Subtitle } from "~src/parsers/commonParser";


describe("Test ktuvit site utils", () => {
    it("test parseId", async () => {
        const queryLocation: string = path.resolve(__dirname, "..", "..", "resources", "parsers", "ktuvit", "findMovieQuery.json");
        const query: string = await readFile(queryLocation, { encoding: "utf8" });

        const movieId: string = parseId(query, "Frozen", 2013);

        expect(movieId).toEqual("0679D248C930F4659069AC9F9FA2E8D7");
    });
    it("Test parseSubtitles", async () => {
        const pageLocation: string = path.resolve(__dirname, "..", "..", "resources", "parsers", "ktuvit", "moviePage.html");
        const page: string = await readFile(pageLocation, { encoding: "utf8" });

        const parsedMovieSubtitles: Subtitle[] = parseSubtitles(page);

        expect(parsedMovieSubtitles).toEqual([
            { id: "E00664CE8F1C1D95D55CC21E85C1A031", name: "Frozen.2013.1080p.BluRay.x264-SPARKS" },
            { id: "8B8AF1119319F258900BD7FF7A92EE5A", name: "Frozen.2013.2160p.UHD.Bluray.x265-Aviator.srt" },
            { id: "4BC6EC91ADEAA0A46AA5E0954BED3347", name: "Frozen.2013.1080p.BluRay.H264.AAC-RARBG" },
            { id: "317670E777F61C4AD2B71E9714A2C5AB", name: "Frozen.2013.720p.BluRay.x264-SPARKS" },
            { id: "316C38680D0F36489DA0C742E8F18F4A", name: "Frozen.2013.720p.BluRay.x264.YIFY" },
            { id: "A31031B5FB5E289E00B59503C61492D9", name: "Frozen.2013.720p.BluRay.H264.AAC-RARBG" },
            { id: "B38789342D9D6377AD83F027F30233DD", name: "Frozen.2013.1080p.Bluray.HEVC.x265.AAC.5.1-GIRAYS" },
            { id: "21263F4C6A84339B6B74148D35AC57F0", name: "Frozen.2013.1080p.BluRay.H264.AAC-RARBG" },
            { id: "A74371FF3C880EC1A1E2824C70B29FF2", name: "Frozen.2013.720p.BluRay.x264.YIFY" },
            { id: "950B139B3B6BD5C20CE0B90F0A73555F", name: "Frozen.2013.720p.BluRay.H264.AAC-RARBG" },
            { id: "8C320E2C5A5E26CB47F050195912E6FB", name: "Frozen.2013.720p.BluRay.x264-SPARKS" },
            { id: "F7B22B89894B2AB7E0D3BADA8263FAEE", name: "Frozen.2013.1080p.BRRip.x264-YIFY" },
            { id: "8AAF8BD11EF634A60A574603CD8083B1", name: "Frozen.2013.1080p.BluRay.x264-SPARKS" }
        ]);
    });
    it("test parseDownloadIdentifier", () => {
        const output = "{\"ValidIn\":0,\"DownloadIdentifier\":\"b53e6717-98ed-4827-9fae-083b5004b22a\",\"IsSuccess\":true,\"ErrorMessage\":\"\"}";
        const downloadIdentifier = parseDownloadIdentifier(output);

        expect(downloadIdentifier).toEqual("b53e6717-98ed-4827-9fae-083b5004b22a");
    });
});