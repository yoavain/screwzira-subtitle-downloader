import { Logger } from "~src/logger";
import type { Cache } from "flat-cache";
import * as flatCache from "flat-cache";

export type FetchFunction = () => Promise<string>

export class TvShowIdCache {
    private readonly cache: Cache;
    private readonly logger: Logger

    constructor(id: string, logger?: Logger) {
        this.cache = flatCache.load(id);
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