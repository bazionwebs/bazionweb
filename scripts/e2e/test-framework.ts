/**
 * Lightweight, robust E2E Test Framework & Assertion Library
 * Runs natively with Node 24 (--experimental-strip-types) or ts-node.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';

export const require = createRequire(import.meta.url);

export interface TestCaseResult {
  id: string;
  name: string;
  suite: string;
  tier: number;
  status: 'pass' | 'fail';
  durationMs: number;
  error?: string;
  detail?: string;
}

export interface SuiteSummary {
  tier: number;
  name: string;
  total: number;
  passed: number;
  failed: number;
}

class TestContext {
  results: TestCaseResult[] = [];
  currentSuite: string = '';
  currentTier: number = 1;
  workspaceRoot: string = process.cwd();

  setSuite(name: string, tier: number = 1) {
    this.currentSuite = name;
    this.currentTier = tier;
  }

  record(res: TestCaseResult) {
    this.results.push(res);
  }

  getWorkspacePath(relPath: string): string {
    return path.resolve(this.workspaceRoot, relPath);
  }

  fileExists(relPath: string): boolean {
    return fs.existsSync(this.getWorkspacePath(relPath));
  }

  readFileSafe(relPath: string): string {
    const full = this.getWorkspacePath(relPath);
    if (!fs.existsSync(full)) return '';
    return fs.readFileSync(full, 'utf8');
  }
}

export const context = new TestContext();

export class ExpectationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExpectationError';
  }
}

export function expect<T>(received: T) {
  const isNot = false;

  const matchers = (notModifier: boolean) => ({
    toBe(expected: any) {
      const pass = Object.is(received, expected);
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(
          `Expected ${notModifier ? 'NOT ' : ''}${JSON.stringify(expected)}, received: ${JSON.stringify(received)}`
        );
      }
    },
    toEqual(expected: any) {
      const receivedJson = JSON.stringify(received);
      const expectedJson = JSON.stringify(expected);
      const pass = receivedJson === expectedJson;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(
          `Expected ${notModifier ? 'NOT ' : ''}deep equality with: ${expectedJson}, received: ${receivedJson}`
        );
      }
    },
    toBeTruthy() {
      const pass = Boolean(received);
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? 'falsy' : 'truthy'}`);
      }
    },
    toBeFalsy() {
      const pass = !received;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? 'truthy' : 'falsy'}`);
      }
    },
    toBeNull() {
      const pass = received === null;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? 'non-null' : 'null'}`);
      }
    },
    toBeDefined() {
      const pass = received !== undefined;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? 'undefined' : 'defined'}`);
      }
    },
    toBeGreaterThan(n: number) {
      const pass = Number(received) > n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? '<=' : '>'} ${n}`);
      }
    },
    toBeGreaterThanOrEqual(n: number) {
      const pass = Number(received) >= n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? '<' : '>='} ${n}`);
      }
    },
    toBeLessThan(n: number) {
      const pass = Number(received) < n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? '>=' : '<'} ${n}`);
      }
    },
    toBeLessThanOrEqual(n: number) {
      const pass = Number(received) <= n;
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected ${received} to be ${notModifier ? '>' : '<='} ${n}`);
      }
    },
    toContain(expected: any) {
      let pass = false;
      if (typeof received === 'string') {
        pass = received.includes(String(expected));
      } else if (Array.isArray(received)) {
        pass = received.includes(expected);
      } else if (received && typeof (received as any).has === 'function') {
        pass = (received as any).has(expected);
      }
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(
          `Expected ${JSON.stringify(received)} to ${notModifier ? 'NOT ' : ''}contain ${JSON.stringify(expected)}`
        );
      }
    },
    toMatch(regex: RegExp | string) {
      const re = typeof regex === 'string' ? new RegExp(regex) : regex;
      const pass = re.test(String(received));
      if (notModifier ? pass : !pass) {
        throw new ExpectationError(`Expected "${received}" to ${notModifier ? 'NOT ' : ''}match ${re}`);
      }
    },
    toThrow(expectedMessage?: string | RegExp) {
      if (typeof received !== 'function') {
        throw new ExpectationError('toThrow matcher requires a function input');
      }
      let threw = false;
      let caughtError: any = null;
      try {
        (received as any)();
      } catch (err) {
        threw = true;
        caughtError = err;
      }
      if (notModifier ? threw : !threw) {
        throw new ExpectationError(
          `Expected function ${notModifier ? 'NOT to throw' : 'to throw an error, but it did not throw'}`
        );
      }
      if (threw && expectedMessage && !notModifier) {
        const msg = caughtError?.message || String(caughtError);
        if (expectedMessage instanceof RegExp) {
          if (!expectedMessage.test(msg)) {
            throw new ExpectationError(`Expected error message "${msg}" to match ${expectedMessage}`);
          }
        } else if (!msg.includes(expectedMessage)) {
          throw new ExpectationError(`Expected error message "${msg}" to include "${expectedMessage}"`);
        }
      }
    },
    get not() {
      return matchers(true);
    },
  });

  return matchers(isNot);
}

export async function test(
  id: string,
  name: string,
  fn: () => void | Promise<void>,
  tierOverride?: number
): Promise<TestCaseResult> {
  const start = Date.now();
  const tier = tierOverride ?? context.currentTier;
  try {
    await fn();
    const result: TestCaseResult = {
      id,
      name,
      suite: context.currentSuite,
      tier,
      status: 'pass',
      durationMs: Date.now() - start,
    };
    context.record(result);
    return result;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    const result: TestCaseResult = {
      id,
      name,
      suite: context.currentSuite,
      tier,
      status: 'fail',
      durationMs: Date.now() - start,
      error: errorMsg,
      detail: err?.stack,
    };
    context.record(result);
    return result;
  }
}

export function describe(name: string, tier: number, fn: () => void | Promise<void>) {
  context.setSuite(name, tier);
  return fn();
}
