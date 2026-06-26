export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['core', 'cli', 'docs', 'deps', 'ci', 'release']],
    'scope-empty': [0], // scope is optional
    'body-max-line-length': [2, 'always', 200],
  },
};
