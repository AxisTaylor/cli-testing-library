import { cleanupAll, prepareEnvironment } from '../src';

jest.setTimeout(10000);

describe('Tests testing the CLI and so, the testing lib itself', () => {
    describe('general', () => {
        afterAll(cleanupAll);
        it('runs with multiple runners', async () => {
            const { execute, cleanup } = await prepareEnvironment();

            expect(await execute(
                'node',
                './test/testing-cli-entry.js --help'
            )).exitCodeToBe(0);

            expect(await execute(
                'ts-node',
                './test/testing-cli.ts --help'
            )).exitCodeToBe(0);

            await cleanup();
        });
        it('runs with execute and captures errors and time outs', async () => {
            const { execute, cleanup } = await prepareEnvironment();

            expect(await execute(
                'ts-node',
                './test/testing-cli.ts error'
            )).exitCodeToBe(1);

            expect(await execute(
                'ts-node',
                './test/testing-cli.ts wait',
                { timeout: 1000 }
            )).exitCodeToBeNull();

            await cleanup();
        });

        it('runs with spawn or execute and passes through environmental variables', async () => {
            const { execute, spawn, cleanup } = await prepareEnvironment();

            const executeResult = await execute(
                'node',
                './test/testing-cli-entry.js env',
                { env: { HELLO: 'WORLD' } }
            );
            expect(executeResult).exitCodeToBe(0);
            expect(executeResult.stdout).toContain('- HELLO: WORLD');

            const { waitForText, waitForFinish } = await spawn(
                'node',
                './test/testing-cli-entry.js env',
                { env: { HELLO: 'UNIVERSE', NODE_ENV: 'Yes' } }
            );

            expect(await waitForText('- HELLO: UNIVERSE')).toBeFoundInOutput();
            expect(await waitForText('- NODE_ENV: Yes')).toBeFoundInOutput();
            expect(await waitForFinish()).exitCodeToBe(0);

            await cleanup();
        });

        it('should fail without any params', async () => {
            const { execute, cleanup } = await prepareEnvironment();

            const { code, stdout, stderr } = await execute(
                'node',
                './test/testing-cli-entry.js'
            );

            expect(stdout).toMatchInlineSnapshot(`[]`);
            expect(stderr).toMatchInlineSnapshot(`
                [
                  "testing-cli-entry.js <command>",
                  "Commands:",
                  "testing-cli-entry.js print [input]  print a string",
                  "testing-cli-entry.js text           ask text input",
                  "testing-cli-entry.js error          exit with error",
                  "testing-cli-entry.js select         ask select input",
                  "testing-cli-entry.js wait           wait for 5 seconds",
                  "testing-cli-entry.js env            print environment variables",
                  "testing-cli-entry.js random         print a phrase with random number",
                  "Options:",
                  "--help     Show help                                             [boolean]",
                  "--version  Show version number                                   [boolean]",
                  "-v, --verbose  Run with verbose logging                              [boolean]",
                  "Not enough non-option arguments: got 0, need at least 1",
                ]
            `);
            expect(code).toBe(1);

            await cleanup();
        });

        it('should wait for one second', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            const { wait, waitForFinish } = await spawn(
                'node',
                './test/testing-cli-entry.js select'
            );

            const start = new Date();
            await wait(1000);
            const end = new Date();
            const delay = end.getTime() - start.getTime();

            expect(await waitForFinish()).exitCodeToBe(0);

            expect(delay).toBeGreaterThan(990);
            expect(delay).toBeLessThan(1010);

            await cleanup();
        });

        it('should kill process', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            const { waitForText, kill, getStderr, getStdout, getExitCode } =
                await spawn('node', './test/testing-cli-entry.js select');

            expect(await waitForText('Pick option')).toBeFoundInOutput();

            kill('SIGINT');

            expect(getStderr()).toMatchInlineSnapshot(`[]`);
            expect(getStdout()).toMatchInlineSnapshot(`
                [
                  "? Pick option: › - Use arrow-keys. Return to submit.",
                  "❯   First",
                  "Second",
                ]
            `);
            expect(getExitCode()).toBeNull();

            await cleanup();
        });

        it('should enable debug logging', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            process.stdout.write = jest.fn();

            const { waitForFinish } = await spawn(
                'node',
                './test/testing-cli-entry.js --help'
            );

            expect(await waitForFinish()).exitCodeToBe(0);

            expect(process.stdout.write).not.toHaveBeenCalled();

            const { debug, waitForFinish: waitForFinishOnceMore } = await spawn(
                'node',
                './test/testing-cli-entry.js --help'
            );

            debug();

            expect(await waitForFinishOnceMore()).exitCodeToBe(0);

            expect(process.stdout.write).toHaveBeenCalled();

            await cleanup();
        });
    });

    describe('command:help', () => {
        it('should print help', async () => {
            const { execute, cleanup } = await prepareEnvironment();

            const { code, stdout, stderr } = await execute(
                'node',
                './test/testing-cli-entry.js --help'
            );

            expect(stdout).toMatchInlineSnapshot(`
                            [
                              "testing-cli-entry.js <command>",
                              "Commands:",
                              "testing-cli-entry.js print [input]  print a string",
                              "testing-cli-entry.js text           ask text input",
                              "testing-cli-entry.js error          exit with error",
                              "testing-cli-entry.js select         ask select input",
                              "testing-cli-entry.js wait           wait for 5 seconds",
                              "testing-cli-entry.js env            print environment variables",
                              "testing-cli-entry.js random         print a phrase with random number",
                              "Options:",
                              "--help     Show help                                             [boolean]",
                              "--version  Show version number                                   [boolean]",
                              "-v, --verbose  Run with verbose logging                              [boolean]",
                            ]
                    `);
            expect(stderr).toMatchInlineSnapshot(`[]`);
            expect(code).toBe(0);

            await cleanup();
        });
    });

    describe('command:input', () => {
        it('should print the value provided', async () => {
            const { execute, cleanup } = await prepareEnvironment();

            const { code, stdout } = await execute(
                'node',
                './test/testing-cli-entry.js print print-this-string'
            );

            expect(stdout).toMatchInlineSnapshot(`
                            [
                              "cli:print: print-this-string",
                            ]
                    `);
            expect(code).toBe(0);
        });

        it('should print the value provided with verbose option', async () => {
            const { execute, cleanup } = await prepareEnvironment();

            const { code, stdout } = await execute(
                'node',
                './test/testing-cli-entry.js print print-this-string -v'
            );

            expect(stdout).toMatchInlineSnapshot(`
                            [
                              "Running in verbose mode.",
                              "cli:print: print-this-string",
                            ]
                    `);
            expect(code).toBe(0);

            await cleanup();
        });
    });

    describe('command:text', () => {
        it('should give exit code when program finished', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            const { waitForFinish, getExitCode } = await spawn(
                'node',
                './test/testing-cli-entry.js --help'
            );
            expect(getExitCode()).toBe(null);

            await waitForFinish();

            expect(getExitCode()).toBe(0);

            await cleanup();
        });

        it('should ask for text and print it', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            const {
                waitForText,
                waitForFinish,
                writeText,
                pressKey,
                getStdout,
                getExitCode,
            } = await spawn('node', './test/testing-cli-entry.js text');

            expect(await waitForText('Give me a number')).toBeFoundInOutput();
            await writeText('15');
            await pressKey('enter');
            await waitForFinish();

            expect([
                [
                    "? Give me a number: ›",
                    "? Give me a number: › 1",
                    "? Give me a number: › 15",
                    "✔ Give me a number: … 15",
                    "Answered: 15"
                ],
                [
                    "? Give me a number: ›",
                    "? Give me a number: › 1? Give me a number: › 15",
                    "✔ Give me a number: … 15",
                    "Answered: 15"
                ],
                [
                    "? Give me a number: ›",
                    "? Give me a number: › 1",
                    "? Give me a number: › 15✔ Give me a number: … 15",
                    "Answered: 15"
                ],
            ]).toContainEqual(getStdout());
            expect(getExitCode()).toBe(0);

            await cleanup();
        });

        it('should ask for text using regular expression', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            const {
                waitForText,
                waitForFinish,
            } = await spawn('node', './test/testing-cli-entry.js random');

            expect(
                await waitForText('\\d+ dogs, \\d+ cats, and \\d+ birds', { useRegex: true })
            ).toBeFoundInOutput();
            expect(await waitForFinish()).exitCodeToBe(0);

            await cleanup();
        });

        it('should ask for text and continue with process exits early', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            const {
                waitForText,
                writeText,
                getStderr,
                getExitCode,
                waitForFinish,
            } = await spawn('node', './test/testing-cli-entry.js error');

            expect(getExitCode()).toBeNull();

            expect(await waitForText('An error occurred')).toBeFoundInOutput();

            expect(await waitForText('Missing Text', { timeout: 100 })).queryToTimeOut();
            await writeText('input');

            expect(await waitForFinish()).exitCodeToBe(1);

            expect(await waitForText('Missing Text', { timeout: 10000 })).processToExit(); 

            expect(await waitForText('An error occurred', { checkHistory: true })).toBeFoundInOutput();
            
            expect(getStderr()).toMatchInlineSnapshot(`
                [
                  "An error occurred",
                ]
            `);

            await cleanup();
        });
    });

    describe('command:select', () => {
        it('should select an option and print it', async () => {
            const { spawn, cleanup } = await prepareEnvironment();

            const { waitForText, waitForFinish, getStdout, pressKey } =
                await spawn('node', './test/testing-cli-entry.js select');

            expect(await waitForText('Pick option')).toBeFoundInOutput();
            await pressKey('arrowDown');
            await pressKey('enter');
            await waitForFinish();

            expect(getStdout()).toMatchInlineSnapshot(`
                [
                  "? Pick option: › - Use arrow-keys. Return to submit.",
                  "❯   First",
                  "Second",
                  "? Pick option: › - Use arrow-keys. Return to submit.",
                  "First",
                  "❯   Second",
                  "✔ Pick option: › Second",
                  "Picked: second option",
                ]
            `);

            await cleanup();
        });
    });
});
