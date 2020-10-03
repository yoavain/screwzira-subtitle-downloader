import notifier, { NodeNotifier } from "node-notifier";
import * as path from "path";
import { execFile } from "child_process";
import { LoggerInterface } from "~src/logger";
import { NotificationIcon, NotificationIconsInterface } from "~src/parsers/notificationIconsInterface";
import { ScrewziraNotificationIcons } from "~src/parsers/screwzira/screwziraNotificationIcons";

const WindowsToaster = notifier.WindowsToaster;

declare type NodeNotifier = any;
declare type Notification = any;

export interface NotifierInterface {
    notif: (message: string, notificationIcon: NotificationIcon, openLog?: boolean) => void;
}

export class Notifier implements NotifierInterface {
    private readonly logger: LoggerInterface;
    private readonly notifier: NodeNotifier;
    private readonly notificationIcons: NotificationIconsInterface;

    constructor(logger: LoggerInterface, snoreToastPath: string, quiet: boolean) {
        this.logger = logger;
        this.notificationIcons = ScrewziraNotificationIcons;
        if (!quiet) {
            this.logger.debug(`snoreToastPath: ${snoreToastPath}`);
            // @ts-ignore
            this.notifier = new WindowsToaster({ withFallback: false, customPath: snoreToastPath });
        } else {
            this.logger.debug("Quiet Mode. Not initializing notifier");
        }
    }

    public notif = (message: string, notificationIcon: NotificationIcon, openLog?: boolean) => {
        const icon: string = this.notificationIcons[notificationIcon];
        this.logger.verbose(`Looking for icon in: ${path.join("notif-icons", icon)}`);
        if (this.notifier) {
            const notification: Notification = {
                title: "Screwzira Subtitle Downloader",
                message,
                icon: path.join("notif-icons", icon)
            };
            if (openLog) {
                notification.actions = ["Log", "Close"];
            }
            this.notifier.notify(notification);
            this.notifier.on("log", () => {
                const file = path.join(process.env.ProgramData, "Screwzira-Downloader", "screwzira-downloader.log");
                execFile(file, { shell: "powershell" });
            });
        }
        else {
            this.logger.info(`Quiet Mode. Skipping notification message: ${message}`);
        }
    };
}
