module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.(js|ts|tsx)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
