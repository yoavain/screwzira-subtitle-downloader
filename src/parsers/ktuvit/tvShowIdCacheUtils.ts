import type { Cache } from "flat-cache";
import * as flatCache from "flat-cache";
import type { Logger } from "~src/logger";

export type FetchFunction = () => Promise<string>

export class TvShowIdCache {
    private readonly cache: Cache;
    private readonly logger: Logger;

    constructor(id: string, cacheDir: string, logger?: Logger) {
        this.cache = flatCache.load(id, cacheDir);
        this.logger = logger;
    }

    async getTvShowId(tvShowName: string, fetchFunction: FetchFunction): Promise<string> {
        let tvShowId: string = this.cache.getKey(tvShowName) as string;
        if (tvShowId) {
            this.logger?.info(`Got TV show id from cache for ${tvShowName}`);
            return tvShowId;
        }
        try {
            tvShowId = await fetchFunction();
            if (tvShowId) {
                this.logger?.info(`Fetched TV show id for ${tvShowName}`);
                this.cache.setKey(tvShowName, tvShowId);
                this.cache.save(true);
            }
        }
        catch (e) {
            // do nothing
        }
        return tvShowId;
    }
}