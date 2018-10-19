import {NodeNotifier , WindowsToaster} from 'node-notifier';
import {ISzLogger} from './szLogger';

export interface ISzNotifier {
    // new(logger: ISzLogger, snoreToastPath: string, quiet: boolean): SzNotifier
    notif(message: string);
}

export class SzNotifier implements ISzNotifier {
    private readonly logger: ISzLogger;
    private readonly notifier: NodeNotifier;

    constructor(logger: ISzLogger, snoreToastPath: string, quiet: boolean) {
        this.logger = logger;
        if (!quiet) {
            this.logger.debug(`snoreToastPath: ${snoreToastPath}`);
            // @ts-ignore
            this.notifier = new WindowsToaster({withFallback: false, customPath: snoreToastPath});
        }
        else {
            this.logger.debug('Quiet Mode. Not initializing notifier');
        }
    }

    public notif = (message: string) => {
        if (this.notifier) {
            this.notifier.notify({title: 'Screwzira Subtitle Downloader', message});
        }
        else {
            this.logger.info(`Quiet Mode. Skipping notification message: ${message}`);
        }
    };
}
