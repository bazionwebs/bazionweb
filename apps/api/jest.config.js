module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir:              'src',
  testRegex:            '.*\\.spec\\.ts$',
  transform:            { '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { experimentalDecorators: true, emitDecoratorMetadata: true } }] },
  collectCoverageFrom:  [
    '**/*.service.ts',
    '!**/main.ts',
    '!**/prisma.service.ts',
    '!**/diagnostics.service.ts',
  ],
  coverageDirectory:    '../coverage',
  testEnvironment:      'node',
  setupFiles:           ['reflect-metadata'],
  coverageThreshold: {
    global: { branches: 50, functions: 60, lines: 65, statements: 65 },
  },
};
