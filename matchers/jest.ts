type TextSearchResult = {
    line: string;
    type: "found" | "timeout" | "exit"
};

type ProcessStats = {
    code: 0 | 1;
    stdout: string[];
    stderr: string[];
};

type Matcher<Actual extends unknown> = (
    this: jest.MatcherContext,
    actual: Actual,
) => jest.CustomMatcherResult

type MatcherWithParams<Actual extends unknown, Params extends unknown[]> = (
    this: jest.MatcherContext,
    actual: Actual,
    ...params: Params
) => jest.CustomMatcherResult

declare global {
    namespace jest {
        interface Matchers<R, T> {
            toBeFoundInOutput(): Promise<T>;
            queryToTimeOut(): Promise<T>;
            processToExit(): Promise<T>;
            exitCodeToBe(expected: number): Promise<T>;
            exitCodeToBeNull(): Promise<T>;
        }
        interface ExpectExtendMap {
            toBeFoundInOutput: Matcher<TextSearchResult>;
            queryToTimeOut: Matcher<TextSearchResult>;
            processToExit: Matcher<TextSearchResult>;
            exitCodeToBe: MatcherWithParams<ProcessStats, [expected: number]>;
            exitCodeToBeNull: Matcher<ProcessStats>;
        }
    }
}

export const customMatchers = {
    toBeFoundInOutput(this: jest.MatcherContext, received: TextSearchResult) {
        const pass = received.type === 'found';
        let occurringAction: string;
        switch(true) {
            case this.isNot && pass:
                occurringAction = 'to not be found';
                break;
            case this.isNot && !pass:
                occurringAction = 'to have not been found';
                break;
            case !this.isNot && pass:
                occurringAction = 'to be found';
                break;
            case !this.isNot && !pass:
                occurringAction = 'to have been found';
                break;
        }
        return {
            pass,
            message: () => `expected the following query: "${received.line}" ${occurringAction} in the process output`
        };
    },
    queryToTimeOut(this: jest.MatcherContext, received: TextSearchResult) {
        const pass = this.equals(received.type, 'timeout');
        let occurringAction: string;
        switch(true) {
            case this.isNot && pass:
                occurringAction = 'to not time out';
                break;
            case this.isNot && !pass:
                occurringAction = 'to have not timed out';
                break;
            case !this.isNot && pass:
                occurringAction = 'to time out';
                break;
            case !this.isNot && !pass:
                occurringAction = 'to have timed out';
                break;
        }

        return {
            pass,
            message: () => `expected query process ${occurringAction} while querying "${received.line}"`
        };
    },
    processToExit(this: jest.MatcherContext, received: TextSearchResult) {
        const pass = this.equals(received.type, 'exit');
        let occurringAction: string;
        switch(true) {
            case this.isNot && pass:
                occurringAction = 'to not exit';
                break;
            case this.isNot && !pass:
                occurringAction = 'to not have exited';
                break;
            case !this.isNot && pass:
                occurringAction = 'to exit';
                break;
            case !this.isNot && !pass:
                occurringAction = 'to have exited';
                break;
        }

        return {
            pass,
            message: () => `expected process ${occurringAction} before the following query: "${received.line}" could be found in the output`
        };
    },
    exitCodeToBe(this: jest.MatcherContext, received: ProcessStats, expected: number) {
        const pass = this.equals(received.code, expected);
        return {
            pass,
            message: () => `Expected: ${this.utils.printExpected(expected)}\nReceived: ${this.utils.printReceived(received.code)}`
        };
    },
    exitCodeToBeNull(this: jest.MatcherContext, received: ProcessStats) {
        const pass = this.equals(received.code, null);
        return {
            pass,
            message: () => `Expected: ${this.utils.printExpected(null)}\nReceived: ${this.utils.printReceived(received.code)}`
        };
    },
};

expect.extend(customMatchers);

// I am exporting nothing just so we can import this file
export default undefined;