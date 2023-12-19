import type { PathLike, Stats } from "fs";
import * as fs from "fs";
import * as os from "os";


export const isExist = async (filePath: PathLike): Promise<boolean> => {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    }
    catch (err) {
        return false;
    }
};

export const isExistSync = (filePath: PathLike): boolean => {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    }
    catch (err) {
        return false;
    }
};

export const ensureDirSync = (dir: PathLike) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

export const isDirectory = async (filePath: PathLike): Promise<boolean> => {
    const stats: Stats = await fs.promises.lstat(filePath);
    return stats.isDirectory();
};

export const readDir = (path: PathLike) => {
    return fs.promises.readdir(path);
};


export const writeFile = (...args: Parameters<typeof fs.promises.writeFile>) => {
    return fs.promises.writeFile(...args);
};

export const writeJsonSync = (fileName: PathLike, json: object): void => {
    const jsonString: string = JSON.stringify(json, null, 2);
    fs.writeFileSync(fileName, jsonString, { encoding: "utf-8" });
};

export const readJsonSync = <T>(fileName: PathLike): T => {
    const stringify: string = fs.readFileSync(fileName, { encoding: "utf-8" });
    return JSON.parse(stringify) as T;
};
