import type { NotifierInterface } from "~src/notifier";

export class MockNotifier implements NotifierInterface {
    notif = (message: string): void => console.log(`Notification: ${message}`);
}
