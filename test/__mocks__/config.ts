import { ConfigInterface } from "~src/config";

export class MockConfig implements ConfigInterface {
    replaceTitleIfNeeded = (): string => "";
    getLogLevel = (): string => "";
    getExtensions = (): string[] => [];
}
