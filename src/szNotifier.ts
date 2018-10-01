import {ISzLogger} from './szLogger';
const WindowsToaster = require('node-notifier').WindowsToaster;

export interface ISzNotifier {
    new(logger: ISzLogger, snoreToastPath: string): SzNotifier
    notif(message: string);
}

class SzNotifier {
    logger: ISzLogger;
    notifier: any;

    constructor(logger: ISzLogger, snoreToastPath: string) {
        this.logger = logger;
        this.logger.log('debug', `Custom path: ${snoreToastPath}`);
        this.notifier = new WindowsToaster({ withFallback: false, customPath: snoreToastPath });
    }

    notif = (message: string) => {
        this.notifier.notify({ title: 'Screwzira Subtitle Downloader', message });
    };
}

module.exports = SzNotifier;