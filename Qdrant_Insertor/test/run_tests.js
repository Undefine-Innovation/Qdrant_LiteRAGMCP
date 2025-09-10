import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @file This script is the main test runner for the project.
 * It automatically discovers and executes all test files located in the same directory
 * that follow the naming convention 'test_*.ts'.
 *
 * @summary 此脚本是项目的主测试运行器。
 * 它会自动发现并执行位于同一目录下、遵循 'test_*.ts' 命名规范的所有测试文件。
 */

async function runTests() {
  console.log('Starting test suite...');
  console.log('=======================');

  // Step 1: Discover all test files in the current directory.
  // 步骤 1: 发现当前目录下的所有测试文件。
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const files = fs.readdirSync(__dirname);
  const testFiles = files.filter(f => f.startsWith('test_') && f.endsWith('.ts'));

  let passed = 0;
  let failed = 0;

  // Step 2: Iterate over each test file and execute it.
  // 步骤 2: 遍历并执行每个测试文件。
  for (const file of testFiles) {
    try {
      console.log(`\nRunning test: ${file}`);
      console.log('--------------------------');
      // Dynamically import the test module.
      // 动态导入测试模块。
      const testModule = await import(`./${file}`);
      // Each test module must export a 'run' function.
      // 每个测试模块必须导出一个 'run' 函数。
      await testModule.run();
      console.log(`[SUCCESS] ${file} passed.`);
      passed++;
    } catch (error) {
      console.error(`[FAILED] ${file} failed.`);
      console.error(error);
      failed++;
    }
  }

  // Step 3: Report the final results of the test suite.
  // 步骤 3: 报告测试套件的最终结果。
  console.log('\n=======================');
  console.log('Test suite finished.');
  console.log(`Summary: ${passed} passed, ${failed} failed.`);

  // Step 4: Exit with a non-zero status code if any test failed, for CI/CD integration.
  // 步骤 4: 如果有任何测试失败，则以非零状态码退出，以便于 CI/CD 集成。
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();