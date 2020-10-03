export enum NotificationIcon {
    LOGO = "LOGO",
    DOWNLOAD = "DOWNLOAD",
    WARNING = "WARNING",
    NOT_FOUND = "NOT_FOUND",
    FAILED = "FAILED"
}

export type NotificationIconsInterface = { [key in NotificationIcon]: string }
