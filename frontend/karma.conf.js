// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    // Explicit port: the default Angular/karma port can collide with other
    // local dev servers (e.g. this machine's app server on 15078), which makes
    // the browser load the wrong page and never get captured.
    port: 9876,
    autoWatch: true,
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      jasmine: {
        // you can add configuration options for Jasmine here
        // the possible options are listed at https://jasmine.github.io/api/edge/Configuration.html
        // for example, you can disable the random execution with `random: false`
        // or set a specific seed with `seed: 4321`
      },
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    jasmineHtmlReporter: {
      suppressAll: true // removes the duplicated traces
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage'),
      subdir: '.',
      // 'lcovonly' is the only machine-readable format SonarQube can import
      // (sonar.javascript.lcov.reportsPaths). The existing html/text-summary
      // reporters are kept unchanged for local developer use.
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly', file: 'lcov.info' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        // Dedicated profile dir so an already-running Chrome instance does not
        // swallow the launch (which would prevent Karma from capturing the browser).
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--no-proxy-server',
          '--proxy-bypass-list=*',
          '--user-data-dir=' + require('path').join(require('os').tmpdir(), 'karma-chrome-profile')
        ]
      }
    },
    browsers: ['ChromeHeadlessNoSandbox'],
    restartOnFileChange: true
  });
};
