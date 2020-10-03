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
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};
