export const cleanText = (text: string): string => {
    return text
        .toLowerCase()
        .replace(/[.|-]/g, " ")
        .trim();
};

export const splitText = (text: string): string[] => {
    return text.split(" ");
};

export const toTitleCase = (str: string): string => {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
};

/**
 * Message from an unknown thrown value. Six copies of this expression existed across
 * src/sync and scripts/, two of which used `(e as Error).message` and would throw on a
 * non-Error rejection.
 */
export const errorText = (e: unknown): string => {
    return e instanceof Error ? e.message : String(e);
};
