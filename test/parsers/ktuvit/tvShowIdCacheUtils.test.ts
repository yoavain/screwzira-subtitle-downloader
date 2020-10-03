import { TvShowIdCache } from "~src/parsers/ktuvit/tvShowIdCacheUtils";
import { v4 as uuid } from "uuid";

describe("test tvShowId cache", () => {
    it("Test - not found", async () => {
        const mockFetch = jest.fn(async () => undefined);
        const tvShowIdCache = new TvShowIdCache(uuid());
        const tvShowId = await tvShowIdCache.getTvShowId("TV SHOW 1", mockFetch);
        expect(tvShowId).toBeUndefined();
        expect(mockFetch).toBeCalledTimes(1);
    });
    it("Test - found", async () => {
        const mockFetch = jest.fn(async () => "tvShowId1");
        const tvShowIdCache = new TvShowIdCache(uuid());
        const tvShowId1st = await tvShowIdCache.getTvShowId("TV SHOW 1", mockFetch);
        const tvShowId2nd = await tvShowIdCache.getTvShowId("TV SHOW 1", mockFetch);
        expect(tvShowId1st).toBe("tvShowId1");
        expect(tvShowId2nd).toBe("tvShowId1");
        expect(mockFetch).toBeCalledTimes(1);
    });
});