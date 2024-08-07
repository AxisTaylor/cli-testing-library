import { ExecResult, ExitCode } from './createExecute';
import { KeyMap } from './keyToHEx';

export type SpawnResult = {
    wait: (delay: number) => Promise<void>;
    waitForText: (
        output: string,
        options?: Partial<{
            timeout?: number,
            ignoreExit?: boolean,
            checkHistory?: boolean,
            useRegex?: boolean,
        }>,
    ) => Promise<{ line: string; type: "found" | "timeout" | "exit" }>;
    waitForFinish: () => Promise<ExecResult>;
    writeText: (input: string) => Promise<void>;
    getStdout: () => string[];
    getStderr: () => string[];
    getExitCode: () => null | ExitCode;
    kill: (signal: NodeJS.Signals) => void;
    debug: () => void;
    pressKey: (input: KeyMap) => Promise<void>;
};

export type CLITestEnvironment = {
    jobId: string;
    path: string;
    cleanup: () => Promise<void>;
    writeFile: (path: string, content: string) => Promise<void>;
    readFile: (path: string) => Promise<string>;
    removeFile: (path: string) => Promise<void>;
    removeDir: (path: string) => Promise<void>;
    ls: (path?: string) => Promise<string[]>;
    exists: (path: string) => Promise<boolean>;
    makeDir: (path: string) => Promise<void>;

    execute: (
        runner: string,
        command: string,
        options?: Partial<{
            runFrom?: string,
            timeout?: number,
            env?: Record<string, unknown>,
        }>,
    ) => Promise<ExecResult>;
    spawn: (
        runner: string,
        command: string,
        options?: Partial<{
            runFrom?: string,
            env?: Record<string, unknown>,
        }>,
    ) => Promise<SpawnResult>;
};
