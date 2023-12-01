import * as fs from "fs";

export const isExist = async (filePath: string): Promise<boolean> => {
    try {
        await fs.promises.access(filePath, fs.constants.F_OK);
        return true;
    }
    catch (err) {
        return false;
    }
};

export const isExistSync = (filePath: string): boolean => {
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
    }
    catch (err) {
        return false;
    }
};
