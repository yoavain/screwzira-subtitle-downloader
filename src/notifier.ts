import {Logger} from "winston";

export interface INotifier {
    new(logger: Logger, snoreToastPath: string): Notifier
    notif(message: string);
}

class Notifier {
    logger: Logger;
    notifier: any;

    constructor(logger: Logger, snoreToastPath: string) {
        this.logger = logger;
        this.logger.log('debug', `Custom path: ${snoreToastPath}`);
        this.notifier = new WindowsToaster({ withFallback: false, customPath: snoreToastPath });
    }

    notif = (message: string) => {
        this.notifier.notify({ title: 'Screwzira Subtitle Downloader', message });
    };
}