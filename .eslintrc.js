module.exports = {
  extends: 'erb',
  plugins: ['@typescript-eslint'],
  rules: {
    // A temporary hack related to IDE not resolving correct package.json
    'no-console': 'off',
    'no-unused-vars': 'off',

    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-filename-extension': 'off',
    'import/extensions': 'off',
    'import/no-unresolved': 'off',
    'import/no-import-module-exports': 'off',
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'off',
    'max-classes-per-file': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    camelcase: 'off',
    'generator-star-spacing': 'off',
    'no-tabs': 'off',
    'no-irregular-whitespace': 'off',
    'no-debugger': 'off',
    'no-restricted-syntax': 'off',
    'no-await-in-loop': 'off',
    'no-void': 'off',
    eqeqeq: 'off',
    'no-unused-expressions': 'off',
    'no-underscore-dangle': 'off',
    'no-return-await': 'off',
    'no-plusplus': 'off',
    'class-methods-use-this': 'off',
    'no-else-return': 'off',
    'object-shorthand': 'off',
    'import/order': 'off',
    'spaced-comment': 'off',
    'no-new-func': 'off',
    'no-useless-constructor': 'off',
    'dot-notation': 'off',
    'react/require-default-props': 'off',
    'react/jsx-props-no-spreading': 'off',
    'no-use-before-define': 'off',
    'react/self-closing-comp': 'off',
  },
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      // See https://github.com/benmosher/eslint-plugin-import/issues/1396#issuecomment-575727774 for line below
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        moduleDirectory: ['node_modules', 'src/'],
      },
      webpack: {
        config: require.resolve('./.erb/configs/webpack.config.eslint.ts'),
      },
      typescript: {},
    },
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts', '.tsx'],
    },
  },
};
