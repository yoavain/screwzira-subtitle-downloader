import { NodeNotifier, WindowsToaster } from 'node-notifier';
import * as path from 'path';
import { ISzLogger } from './szLogger';

export enum NotificationIcon {
    LOGO = 'sz-logo-300.png',
    DOWNLOAD = 'sz-download-300.png',
    WARNING = 'sz-warning-300.png',
    NOT_FOUND = 'sz-not-found-300.png',
    FAILED = 'sz-failed-300.png'
}

export interface ISzNotifier {
    // new(logger: ISzLogger, snoreToastPath: string, quiet: boolean): SzNotifier
    notif: (message: string, notificationIcon?: NotificationIcon) => void;
}

export class SzNotifier implements ISzNotifier {
    private readonly logger: ISzLogger;
    private readonly notifier: NodeNotifier;

    constructor(logger: ISzLogger, snoreToastPath: string, quiet: boolean) {
        this.logger = logger;
        if (!quiet) {
            this.logger.debug(`snoreToastPath: ${snoreToastPath}`);
            // @ts-ignore
            this.notifier = new WindowsToaster({ withFallback: false, customPath: snoreToastPath });
        }
        else {
            this.logger.debug('Quiet Mode. Not initializing notifier');
        }
    }

    public notif = (message: string, notificationIcon: NotificationIcon = NotificationIcon.LOGO): void => {
        this.logger.verbose(`Looking for icon in: ${path.join('notif-icons', notificationIcon)}`);
        if (this.notifier) {
            this.notifier.notify({
                title: 'Screwzira Subtitle Downloader',
                message,
                icon: path.join('notif-icons', notificationIcon)
            });
        }
        else {
            this.logger.info(`Quiet Mode. Skipping notification message: ${message}`);
        }
    };
}
