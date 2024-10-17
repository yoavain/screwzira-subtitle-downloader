import { TvShowIdCache } from "~src/parsers/ktuvit/tvShowIdCache";
import { randomUUID as uuid } from "crypto";
import path from "path";

export const PERSISTENT_CACHE_DIR: string = path.resolve(__dirname, "..", "..", "resources", "cache", "persistent");
export const TRANSIENT_CACHE_DIR: string = path.resolve(__dirname, "..", "..", "resources", "cache", "transient");

describe("test tvShowId cache", () => {
    it("Test - not found", async () => {
        const mockFetch = jest.fn(async () => undefined);
        const tvShowIdCache: TvShowIdCache = new TvShowIdCache(uuid(), TRANSIENT_CACHE_DIR);
        const tvShowId = await tvShowIdCache.getTvShowId("TV SHOW 1", mockFetch);
        expect(tvShowId).toBeUndefined();
        expect(mockFetch).toBeCalledTimes(1);
    });

    it("Test - found", async () => {
        const mockFetch = jest.fn(async () => "tvShowId1");
        const tvShowIdCache: TvShowIdCache = new TvShowIdCache(uuid(), TRANSIENT_CACHE_DIR);
        const tvShowId1st = await tvShowIdCache.getTvShowId("TV SHOW 1", mockFetch);
        const tvShowId2nd = await tvShowIdCache.getTvShowId("TV SHOW 1", mockFetch);
        expect(tvShowId1st).toBe("tvShowId1");
        expect(tvShowId2nd).toBe("tvShowId1");
        expect(mockFetch).toBeCalledTimes(1);
    });

    it("Test persistence", async () => {
        const id: string = "1e369381-ec96-47ef-b9cc-48d13f570441";
        const mockFetch = jest.fn(async () => "tvShowId1");
        const tvShowIdCache: TvShowIdCache = new TvShowIdCache(id, PERSISTENT_CACHE_DIR);
        await tvShowIdCache.getTvShowId("TV SHOW 1", mockFetch);
        expect(mockFetch).not.toHaveBeenCalled();
    });
});
