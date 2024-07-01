/** @license CLI testing library
 * Copyright (c) Georgy Marchuk.
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChildProcessWithoutNullStreams } from 'child_process';
import {
    copyFile,
    readFile,
    unlink,
    rm,
    writeFile,
    mkdtemp,
    access,
    readdir,
    mkdir,
} from 'fs';
import path from 'path';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { CLITestEnvironment, SpawnResult } from './types';
import { Output, OutputType } from './Output';
import { checkRunningProcess } from './utils';
import { createExecute, ExecResult, ExitCode } from './createExecute';
import { keyToHEx, KeyMap } from './keyToHEx';
import { v4 } from 'uuid';

export type * from './types';
export type * from './createExecute';
export type * from './Output';
export type * from './keyToHEx';

export const copy = promisify(copyFile);
export const fsRead = promisify(readFile);
export const fsWrite = promisify(writeFile);
export const fsRemove = promisify(unlink);
export const fsRemoveDir = promisify(rm);
export const fsMakeDir = promisify(mkdir);
export const fsMakeTempDir = promisify(mkdtemp);
export const fsReadDir = promisify(readdir);
export const fsAccess = promisify(access);
export const relative = (p: string) => path.resolve(__dirname, p);

type Task = { current: ChildProcessWithoutNullStreams | null };
type CleanupStatus = { current: boolean };

type Job = {
    id: string;
    tasks: Task[];
    cleanupStatus: CleanupStatus;
    dir: string;
};

globalThis.jobs = {};
declare global {
    var jobs: Record<string, Job>;
}

const newJob = (dir: string, cleanupStatusRef: CleanupStatus) => {
    const id = v4();
    globalThis.jobs[id] = {
        id,
        dir,
        cleanupStatus: cleanupStatusRef,
        tasks: [],
    };

    return id;
};

const addTasks = (id: string, ...newTasks: Task[]) => {
    if (!globalThis.jobs[id]) {
        throw new Error(`Job with id ${id} does not exist`);
    }

    globalThis.jobs[id].tasks.push(...newTasks);
}

export const cleanupJob = async (id: string) => {
    if (!globalThis.jobs[id]) {
        throw new Error(`Job with id ${id} does not exist`);
    }

    if (globalThis.jobs[id].cleanupStatus.current) {
        return;
    }

    globalThis.jobs[id].cleanupStatus.current = true;
    globalThis.jobs[id].tasks.forEach((task) => {
        task.current?.kill(0);
        task.current?.stdin.end();
        task.current?.stdin.destroy();
        task.current?.stdout.destroy();
        task.current?.stderr.destroy();

        task.current = null;
    });

    await fsRemoveDir(globalThis.jobs[id].dir, { recursive: true });

    delete globalThis.jobs[id];
}

export const cleanupAll = async () => {
    const jobIds = Object.keys(globalThis.jobs);

    for (const id of jobIds) {
        await cleanupJob(id);
    }
}

export const prepareEnvironment = async (): Promise<CLITestEnvironment> => {
    const hasCalledCleanup: { current: boolean; } = { current: false };
    const tempDir = await fsMakeTempDir(
        path.join(tmpdir(), 'cli-testing-library-')
    );

    const jobId = newJob(tempDir, hasCalledCleanup);

    const relative = (p: string) => path.resolve(tempDir, p);
    const cleanup = () => cleanupJob(jobId);

    try {
        const execute = async (
            runner: string,
            command: string,
            runFrom?: string,
            timeout?: number
        ) => {
            const output = new Output();
            const currentProcessRef: {
                current: ChildProcessWithoutNullStreams | null;
            } = { current: null };

            const scopedExecute = createExecute(
                tempDir,
                output,
                currentProcessRef
            );

            addTasks(jobId, currentProcessRef);

            return new Promise<ExecResult>(async (resolve) => {
                let timeoutId: NodeJS.Timeout | undefined;
                if (timeout) {
                    timeoutId = setTimeout(() => {
                        resolve({
                            code: null,
                            stdout: output.stdout,
                            stderr: output.stderr,
                        });
                    }, timeout);
                }

                const result = await scopedExecute(runner, command, runFrom);
                resolve(result);
                timeoutId && clearTimeout(timeoutId);
            });
        };
        
        const spawn = async (
            runner: string,
            command: string,
            runFrom?: string
        ): Promise<SpawnResult> => {
            const output = new Output();
            const currentProcessRef: {
                current: ChildProcessWithoutNullStreams | null;
            } = { current: null };
            const exitCodeRef: { current: ExitCode | null } = { current: null };
            let currentProcessPromise: Promise<ExecResult> | null = null;

            const scopedExecute = createExecute(
                tempDir,
                output,
                currentProcessRef,
                exitCodeRef
            );

            addTasks(jobId, currentProcessRef);

            currentProcessPromise = scopedExecute(runner, command, runFrom);

            const waitForText = (
                input: string,
                options: Partial<{
                    timeout: number,
                    ignoreExit: boolean,
                    checkHistory: boolean,
                }> = {}
            ): Promise<{ line: string; type: "found" | "timeout" | "exit" }> => {
                return new Promise((resolve) => {
                    const { timeout, ignoreExit, checkHistory } = {
                        timeout: 5000,
                        ignoreExit: false,
                        checkHistory: true,
                        ...options,
                    };
                    const processExited = exitCodeRef.current !== null;

                    if (checkHistory && String(output.stdout.join('\n') + output.stderr.join('\n')).includes(input)) {
                        resolve({
                            type: 'found',
                            line: input,
                        });
                        return;
                    }
                    
                    if (!ignoreExit && processExited) {
                        resolve({
                            type: 'exit',
                            line: input,
                        });
                        return;
                    }

                    let timeoutId: NodeJS.Timeout;
                    timeoutId = setTimeout(() => {
                        resolve({
                            type: 'timeout',
                            line: input,
                        });

                        output.off(handler);
                    }, timeout);

                    const handler = (value: string) => {
                        if (value.toString().includes(input)) {
                            resolve({
                                type: 'found',
                                line: input,
                            });

                            timeoutId && clearTimeout(timeoutId);
                            output.off(handler);
                        } else if (!ignoreExit && processExited) {
                            resolve({
                                type: 'exit',
                                line: input,
                            });

                            timeoutId && clearTimeout(timeoutId);
                            output.off(handler);
                        }
                    };
                    
                    output.on(handler);
                });
            };
            const wait = (delay: number): Promise<void> => {
                return new Promise((resolve) => {
                    setTimeout(resolve, delay);
                });
            };
            const waitForFinish = async (timeout?: number): Promise<ExecResult> => {
                if (currentProcessPromise) {
                    currentProcessRef.current?.stdin.end();

                    return new Promise(async (resolve) => {
                        let timeoutId: NodeJS.Timeout | undefined;
                        if (timeout) {
                            timeoutId = setTimeout(() => {
                                resolve({
                                    code: null,
                                    stdout: output.stdout,
                                    stderr: output.stderr,
                                }); 
                            }, timeout);
                        }

                        const execResult = await currentProcessPromise;
                        resolve(execResult);
                        timeoutId && clearTimeout(timeoutId);
                    });
                }
                
                return new Promise((resolve) => {
                    resolve({
                        code: exitCodeRef.current as ExitCode,
                        stdout: output.stdout,
                        stderr: output.stderr,
                    });
                });
            };
            const writeText = async (input: string): Promise<void> => {
                return new Promise((resolve) => {
                    if (checkRunningProcess(currentProcessRef)) {
                        currentProcessRef.current.stdin.write(input, () =>
                            resolve()
                        );
                    }
                });
            };
            const pressKey = async (input: KeyMap): Promise<void> => {
                return new Promise((resolve) => {
                    if (checkRunningProcess(currentProcessRef)) {
                        currentProcessRef.current.stdin.write(
                            keyToHEx(input),
                            () => {
                                resolve();
                            }
                        );
                    }
                });
            };
            const kill = (signal: NodeJS.Signals) => {
                if (checkRunningProcess(currentProcessRef)) {
                    currentProcessRef.current.kill(signal);
                }
            };
            const debug = () => {
                const handler = (value: string, type: OutputType) => {
                    process[type].write(value);
                };

                output.on(handler);
            };

            return {
                wait,
                waitForFinish,
                waitForText,
                pressKey,
                writeText,
                kill,
                debug,
                getStdout: () => output.stdout,
                getStderr: () => output.stderr,
                getExitCode: () => exitCodeRef.current,
            };
        };
        const exists = async (path: string) => {
            try {
                await fsAccess(relative(path));

                return true;
            } catch {
                return false;
            }
        };
        const makeDir = async (path: string) => {
            await fsMakeDir(relative(path), { recursive: true });
        };
        const writeFile = async (p: string, content: string) => {
            const dir = path.dirname(relative(p));
            if (!(await exists(dir))) {
                await makeDir(dir);
            }
            await fsWrite(relative(p), content);
        };
        const readFile = async (path: string) => {
            return (await fsRead(relative(path))).toString();
        };
        const removeFile = async (path: string) => {
            return await fsRemove(relative(path));
        };
        const removeDir = async (path: string) => {
            return await fsRemoveDir(relative(path), { recursive: true });
        };
        const ls = async (path?: string) => {
            return await fsReadDir(path ? relative(path) : tempDir);
        };

        return {
            jobId,
            path: tempDir,
            cleanup,
            writeFile,
            readFile,
            removeFile,
            removeDir,
            ls,
            exists,
            makeDir,
            execute,
            spawn,
        };
    } catch (e) {
        await cleanup();
        throw e;
    }
};
