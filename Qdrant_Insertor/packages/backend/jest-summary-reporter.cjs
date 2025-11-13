/* eslint-disable no-undef, @typescript-eslint/no-require-imports */
/**
 * 自定义Jest Reporter - 生成简易总结和关键调试信息
 * @note CommonJS file for Jest reporter - ESLint disabled for CommonJS syntax
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

class SummaryReporter {
  constructor(globalConfig, options = {}) {
    this.globalConfig = globalConfig;
    this.options = options;
    this.failedTests = [];
    this.passedTests = [];
    this.skippedTests = [];
  }

  onTestResult(test, testResult) {
    const testSuite = testResult.testFilePath.replace(this.globalConfig.rootDir, '');
    
    if (!testResult.success) {
      this.failedTests.push({
        file: testSuite,
        numFailingTests: testResult.numFailingTests,
        failures: testResult.testResults
          .filter(t => t.status === 'failed')
          .map(t => ({
            name: t.title,
            error: t.failureMessages?.[0]?.split('\n').slice(0, 5).join('\n') || 'Unknown error',
          })),
      });
    } else {
      this.passedTests.push(testSuite);
    }

    testResult.testResults.forEach(t => {
      if (t.status === 'pending') {
        this.skippedTests.push(`${testSuite} - ${t.title}`);
      }
    });
  }

  onRunComplete(contexts, results) {
    const summary = {
      timestamp: new Date().toISOString(),
      totals: {
        testSuites: {
          total: results.numTotalTestSuites,
          passed: results.numPassedTestSuites,
          failed: results.numFailedTestSuites,
          skipped: results.numPendingTestSuites,
        },
        tests: {
          total: results.numTotalTests,
          passed: results.numPassedTests,
          failed: results.numFailedTests,
          skipped: results.numPendingTests,
        },
        duration: `${(results.testResults.reduce((sum, r) => sum + (r.perfStats.end - r.perfStats.start), 0) / 1000).toFixed(2)}s`,
      },
      failedTestSuites: this.failedTests
        .sort((a, b) => b.numFailingTests - a.numFailingTests)
        .slice(0, 20)
        .map(suite => ({
          file: suite.file,
          failingTests: suite.numFailingTests,
          firstFailure: suite.failures[0] || null,
        })),
      coverage: results.coverageMap
        ? {
            statements: results.coverageMap.getCoverageSummary().statements.pct,
            branches: results.coverageMap.getCoverageSummary().branches.pct,
            functions: results.coverageMap.getCoverageSummary().functions.pct,
            lines: results.coverageMap.getCoverageSummary().lines.pct,
          }
        : null,
    };

    // 保存简易总结
    const summaryPath = path.join(this.globalConfig.rootDir, 'test-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

    // 保存详细的失败信息用于调试
    const detailsPath = path.join(this.globalConfig.rootDir, 'test-failures.json');
    fs.writeFileSync(
      detailsPath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          failedTestSuites: this.failedTests,
          summaryStats: summary.totals,
        },
        null,
        2
      ),
      'utf8'
    );

    console.log('\n✅ 测试总结已生成:');
    console.log(`  📊 test-summary.json (简易总结)`);
    console.log(`  🐛 test-failures.json (详细失败信息)`);
  }
}

module.exports = SummaryReporter;

