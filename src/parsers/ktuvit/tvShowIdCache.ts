import { FlatCache } from "flat-cache";
import type { LoggerInterface } from "~src/logger";

export type FetchFunction = () => Promise<string>

export class TvShowIdCache {
    private readonly cache: FlatCache;
    private readonly logger: LoggerInterface;

    constructor(id: string, cacheDir: string, logger?: LoggerInterface) {
        const cache = new FlatCache();
        cache.load(id, cacheDir);
        this.cache = cache;
        this.logger = logger;
        this.logger?.info(`Initialized TvShowIdCache with id ${id} and cache dir ${cacheDir}`);
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