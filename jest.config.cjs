module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.(js|ts|tsx)'],
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // @turf/turf and its ESM-only transitive deps need Babel transformation in Jest
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|@turf|kdbush|geokdbush|tinyqueue|point-in-polygon-hao|geojson-equality-ts|polyclip-ts|splaytree-ts))',
    '/node_modules/react-native-reanimated/plugin/',
  ],
};
