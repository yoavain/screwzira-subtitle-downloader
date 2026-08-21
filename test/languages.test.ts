import { aliasesFor, isLanguage, strippableTags, VARIANT_TAGS } from "~src/languages";

describe("aliasesFor", () => {
    it("returns every spelling of a known language", () => {
        expect(aliasesFor("fr")).toEqual(expect.arrayContaining(["fr", "fra", "fre", "french"]));
        expect(aliasesFor("he")).toEqual(expect.arrayContaining(["he", "heb", "iw", "hebrew"]));
    });

    it("resolves the same group from any of its spellings", () => {
        // The lookup is keyed by every alias, not only the primary code.
        expect(aliasesFor("fre")).toEqual(aliasesFor("fr"));
        expect(aliasesFor("french")).toEqual(aliasesFor("fr"));
        expect(aliasesFor("iw")).toEqual(aliasesFor("he"));
    });

    it("is case and whitespace insensitive", () => {
        expect(aliasesFor("FR")).toEqual(aliasesFor("fr"));
        expect(aliasesFor("  He  ")).toEqual(aliasesFor("he"));
    });

    it("falls back to the code itself when the language is unknown", () => {
        expect(aliasesFor("zz")).toEqual(["zz"]);
        expect(aliasesFor("KLINGON")).toEqual(["klingon"]);
    });

    it("covers the languages a Blu-ray or a WEB-DL commonly carries", () => {
        // Regression: referenceLanguages is user-facing, and a track tagged "ger" or "deu"
        // used to be invisible because only fr/en/he were in the table.
        expect(aliasesFor("de")).toEqual(expect.arrayContaining(["ger", "deu"]));
        expect(aliasesFor("es")).toEqual(expect.arrayContaining(["spa"]));
        expect(aliasesFor("zh")).toEqual(expect.arrayContaining(["chi", "zho"]));
    });
});

describe("isLanguage", () => {
    it("matches across ISO 639-2/B and 639-2/T spellings", () => {
        expect(isLanguage("fre", "fr")).toBe(true);
        expect(isLanguage("fra", "fr")).toBe(true);
        expect(isLanguage("ger", "de")).toBe(true);
        expect(isLanguage("deu", "de")).toBe(true);
    });

    it("matches the English name form", () => {
        expect(isLanguage("french", "fr")).toBe(true);
        expect(isLanguage("hebrew", "he")).toBe(true);
    });

    it("is case and whitespace insensitive on both sides", () => {
        expect(isLanguage("FRE", "fr")).toBe(true);
        expect(isLanguage(" fra ", "FR")).toBe(true);
    });

    it("rejects a different language", () => {
        expect(isLanguage("eng", "fr")).toBe(false);
        expect(isLanguage("spa", "he")).toBe(false);
    });

    it("treats undefined and empty as no match", () => {
        expect(isLanguage(undefined, "fr")).toBe(false);
        expect(isLanguage("", "fr")).toBe(false);
    });
});

describe("strippableTags", () => {
    it("includes every spelling of the target language", () => {
        expect(strippableTags("he")).toEqual(expect.arrayContaining(["he", "heb", "iw", "hebrew"]));
    });

    it("includes the subtitle variant tags", () => {
        expect(strippableTags("he")).toEqual(expect.arrayContaining(VARIANT_TAGS));
    });

    it("does not include another language", () => {
        expect(strippableTags("he")).not.toContain("fra");
    });
});
