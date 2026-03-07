import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { isExist, isExistSync, ensureDirSync, isDirectory, readDir, writeFile, writeJsonSync, readJsonSync } from "~src/fileUtils";

describe("fileUtils", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-fileutils-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe("isExist (async)", () => {
        it("returns true for an existing file", async () => {
            const file = path.join(tmpDir, "existing.txt");
            fs.writeFileSync(file, "hello");
            expect(await isExist(file)).toBe(true);
        });

        it("returns false for a non-existing file", async () => {
            expect(await isExist(path.join(tmpDir, "does-not-exist.txt"))).toBe(false);
        });
    });

    describe("isExistSync", () => {
        it("returns true for an existing file", () => {
            const file = path.join(tmpDir, "sync-existing.txt");
            fs.writeFileSync(file, "hello");
            expect(isExistSync(file)).toBe(true);
        });

        it("returns false for a non-existing file", () => {
            expect(isExistSync(path.join(tmpDir, "sync-missing.txt"))).toBe(false);
        });
    });

    describe("ensureDirSync", () => {
        it("creates directory when it does not exist", () => {
            const newDir = path.join(tmpDir, "new-subdir");
            ensureDirSync(newDir);
            expect(fs.existsSync(newDir)).toBe(true);
        });

        it("does not throw when directory already exists", () => {
            expect(() => ensureDirSync(tmpDir)).not.toThrow();
        });
    });

    describe("isDirectory", () => {
        it("returns true for a directory", async () => {
            expect(await isDirectory(tmpDir)).toBe(true);
        });

        it("returns false for a file", async () => {
            const file = path.join(tmpDir, "file.txt");
            fs.writeFileSync(file, "data");
            expect(await isDirectory(file)).toBe(false);
        });
    });

    describe("readDir", () => {
        it("returns directory contents", async () => {
            fs.writeFileSync(path.join(tmpDir, "a.txt"), "");
            fs.writeFileSync(path.join(tmpDir, "b.txt"), "");
            const entries = await readDir(tmpDir);
            expect(entries).toContain("a.txt");
            expect(entries).toContain("b.txt");
        });
    });

    describe("writeFile", () => {
        it("writes buffer data to a file", async () => {
            const file = path.join(tmpDir, "out.bin");
            const data = Buffer.from("hello bytes");
            await writeFile(file, data);
            expect(fs.readFileSync(file)).toEqual(data);
        });
    });

    describe("writeJsonSync", () => {
        it("serialises an object to JSON and writes to disk", () => {
            const file = path.join(tmpDir, "config.json");
            const obj = { key: "value", num: 42 };
            writeJsonSync(file, obj);
            const content = JSON.parse(fs.readFileSync(file, "utf-8")) as typeof obj;
            expect(content).toEqual(obj);
        });
    });

    describe("readJsonSync", () => {
        it("reads and parses a JSON file", () => {
            const file = path.join(tmpDir, "data.json");
            fs.writeFileSync(file, JSON.stringify({ x: 1 }));
            const result = readJsonSync<{ x: number }>(file);
            expect(result).toEqual({ x: 1 });
        });
    });
});
