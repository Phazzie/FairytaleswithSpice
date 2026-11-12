// Karma configuration file, see link for more information
// https://karma-runner.github.io/6.4/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution order
        // random: false
        timeoutInterval: 10000 // Increase timeout for async tests from default 5000ms
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/story-generator'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcov' },
        { type: 'clover' }
      ]
      // No numeric `check` gate. Coverage is still well under 85%. The test
      // target loads this file, so a threshold here would fail CI on a number
      // the suite was never held to. `npm run test:coverage` still collects reports.
    },
    // Default `npm test` does not run the coverage reporter. `npm run test:coverage`
    // turns it on through the Angular builder's `codeCoverage` option.
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    // Chrome's socket ping otherwise dies at ~30s (25s interval + the 5s
    // default pingTimeout) while this suite is still running.
    browserDisconnectTimeout: 10000,
    browserDisconnectTolerance: 0,
    browserNoActivityTimeout: 120000,
    captureTimeout: 120000,
    pingTimeout: 60000,
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--headless', '--disable-gpu', '--disable-dev-shm-usage']
      }
    },
    restartOnFileChange: true
  });
};
