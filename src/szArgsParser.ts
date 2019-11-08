import * as path from 'path';

const SONARR = 'sonarr';
const INPUT = 'input';
const QUIET = 'quiet';
const SONARR_EPISODE_FILE_PATH = 'sonarr_episodefile_path';

export interface ISzArgsParser {
    isSonarrMode: () => boolean;
    getInput: () => string;
    isQuiet: () => boolean;
    getSnoreToastPath: () => string;
    getHelp: () => string;
}
export class SzArgsParser implements ISzArgsParser {
    private readonly sonarrMode: boolean;
    private readonly input: string;
    private readonly quiet: boolean;
    private readonly snoreToastPath: string;

    constructor(argv: string[]) {
        if (argv.length >= 2 && (argv[argv.length - 2].endsWith('.exe') || argv[argv.length - 2].endsWith('.js')) && ![SONARR, INPUT, QUIET].includes(argv[argv.length - 1])) {
            this.input = argv[argv.length - 1];
        }
        else {
            const indexOfInput: number = argv.indexOf(INPUT);
            if (indexOfInput >= 0 && indexOfInput + 1 < argv.length) {
                this.input = argv[indexOfInput + 1];
            }
            else if (argv.indexOf(SONARR) >= 0) {
                this.sonarrMode = true;
                this.input = this.getSonarrEpisodePathEnvVar();
            }
            this.quiet = argv.indexOf(QUIET) >= 0;
        }
        this.snoreToastPath = argv[0].endsWith('screwzira-downloader.exe') ? path.join(argv[0], '../', 'snoretoast-x64.exe') : null;
    }

    public isSonarrMode(): boolean {
        return !!this.sonarrMode;
    }

    public getInput = (): string => {
        return this.input;
    };

    public isQuiet = (): boolean => {
        return !!this.quiet;
    };

    public getSnoreToastPath(): string {
        return this.snoreToastPath;
    }

    public getHelp = (): string => {
        return `\nOptions:\n\t${INPUT}\tinput file\n\t${SONARR}\tsonnar mode (input is taken from ENV VAR ${SONARR_EPISODE_FILE_PATH})\n\t${QUIET}\tquiet mode (no notifications)\n`;
    };

    private getSonarrEpisodePathEnvVar = (): string => {
        return process.env[SONARR_EPISODE_FILE_PATH];
    };
}
