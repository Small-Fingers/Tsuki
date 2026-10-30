export default {
  extends: ['stylelint-config-recommended'],
  ignoreFiles: ['frontend/dist/**'],
  rules: {
    'no-duplicate-selectors': null,
    'no-descending-specificity': null,
    'property-no-deprecated': null,
  },
};
