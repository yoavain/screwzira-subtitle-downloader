import * as path from "path";

const SONARR = "sonarr";
const INPUT = "input";
const QUIET = "quiet";
const SYNC = "sync";
const SONARR_EPISODE_FILE_PATH = "sonarr_episodefile_path";

export interface ArgsParserInterface {
    isSonarrMode: () => boolean;
    getInput: () => string;
    isQuiet: () => boolean;
    isSync: () => boolean;
    getSnoreToastPath: () => string;
    getMkvMergePath: () => string;
    getMkvExtractPath: () => string;
    getHelp: () => string;
}

export class ArgsParser implements ArgsParserInterface {
    private readonly sonarrMode: boolean;
    private readonly input: string;
    private readonly quiet: boolean;
    private readonly sync: boolean;
    private readonly snoreToastPath: string;
    private readonly mkvMergePath: string;
    private readonly mkvExtractPath: string;

    constructor(argv: string[]) {
        if (argv.length >= 2 && (argv[argv.length - 2].endsWith(".exe") || argv[argv.length - 2].endsWith(".js")) && ![SONARR, INPUT, QUIET, SYNC].includes(argv[argv.length - 1])) {
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
            this.sync = argv.indexOf(SYNC) >= 0;
        }
        const isInstalledExe = argv[0].endsWith("-downloader.exe");
        this.snoreToastPath = isInstalledExe ? path.join(argv[0], "../", "snoretoast-x64.exe") : null;
        this.mkvMergePath = isInstalledExe
            ? path.join(path.dirname(argv[0]), "mkvtoolnix", "mkvmerge.exe")
            : path.join(__dirname, "..", "dist", "mkvtoolnix", "mkvmerge.exe");
        this.mkvExtractPath = isInstalledExe
            ? path.join(path.dirname(argv[0]), "mkvtoolnix", "mkvextract.exe")
            : path.join(__dirname, "..", "dist", "mkvtoolnix", "mkvextract.exe");
    }

    public isSonarrMode(): boolean {
        return !!this.sonarrMode;
    }

    public getInput(): string {
        return this.input;
    }

    public isQuiet(): boolean {
        return !!this.quiet;
    }

    public isSync(): boolean {
        return !!this.sync;
    }

    public getSnoreToastPath(): string {
        return this.snoreToastPath;
    }

    public getMkvMergePath(): string {
        return this.mkvMergePath;
    }

    public getMkvExtractPath(): string {
        return this.mkvExtractPath;
    }

    public getHelp(): string {
        return [
            "\nOptions:",
            `\t${INPUT}\tinput file`,
            `\t${SONARR}\tsonnar mode (input is taken from ENV VAR ${SONARR_EPISODE_FILE_PATH})`,
            `\t${QUIET}\tquiet mode (no notifications)`,
            `\t${SYNC}\tsync mode (re-time Hebrew subtitles against English source)\n`
        ].join("\n");
    }

    private getSonarrEpisodePathEnvVar(): string {
        return process.env[SONARR_EPISODE_FILE_PATH];
    }
}
