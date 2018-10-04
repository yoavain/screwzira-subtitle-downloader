import {NodeNotifier , WindowsToaster} from 'node-notifier';
import {ISzLogger} from './szLogger';

export interface ISzNotifier {
    // new(logger: ISzLogger, snoreToastPath: string): SzNotifier
    notif(message: string);
}

export class SzNotifier implements ISzNotifier {
    public logger: ISzLogger;
    public notifier: NodeNotifier;

    constructor(logger: ISzLogger, snoreToastPath: string) {
        this.logger = logger;
        this.logger.log('debug', `Custom path: ${snoreToastPath}`);
        // @ts-ignore
        this.notifier = new WindowsToaster({ withFallback: false, customPath: snoreToastPath });
    }

    public notif = (message: string) => {
        this.notifier.notify({ title: 'Screwzira Subtitle Downloader', message });
    };
}
