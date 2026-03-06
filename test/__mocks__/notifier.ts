import type { NotifierInterface } from "~src/notifier";

export class MockNotifier implements NotifierInterface {
    notif = jest.fn();
}
