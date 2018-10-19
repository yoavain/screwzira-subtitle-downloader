import * as yargs from 'yargs'
type Arguments = yargs.Arguments;
type Argv = yargs.Argv;

const SONARR = 'sonarr';
const INPUT = 'input';
const QUIET = 'quiet';
const SONARR_EPISODE_FILE_PATH = 'sonarr_episodefile_path';

export interface ISzArgsParser {
    getInput(): string;
    isQuiet(): boolean;
    showHelp();
}
export class SzArgsParser implements ISzArgsParser {
    private readonly argv: Argv;
    private readonly arguments: Arguments;

    constructor(args: string[]) {
        this.argv = yargs
            .options({
                [`${INPUT}`]: {
                    alias: 'i',
                    describe: 'input file'
                },
                [`${SONARR}`]: {
                    alias: 's',
                    describe: 'sonarr mode'
                },
                [`${QUIET}`]: {
                    alias: 'q',
                    describe: 'quiet mode'
                }
            });
        this.arguments = this.argv.parse(args);
    }


    public getInput = (): string => {
        // Check input
        if (this.getInputArg()) {
            return this.getInputArg();
        }
        else {
            // Check sonarr
            if (this.getSonarrArg()) {
                return this.getSonarrEpisodePathEnvVar();
            }
        }
    };

    public isQuiet = (): boolean => {
        return !!this.arguments[QUIET];
    };

    public showHelp = () => {
        this.argv.showHelp();
    };


    private getInputArg = (): string => {
        return this.arguments[INPUT];
    };

    private getSonarrArg = (): boolean => {
        return this.arguments[SONARR];
    };

    private getSonarrEpisodePathEnvVar= (): string => {
        return process.env[SONARR_EPISODE_FILE_PATH];
    }
}