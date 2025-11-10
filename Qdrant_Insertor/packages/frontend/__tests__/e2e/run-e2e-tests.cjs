/**
 * E2E测试运行脚本
 * 用于运行前端端到端测试
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置
const CONFIG = {
  // Jest配置文件路径
  jestConfig: path.join(__dirname, 'jest.e2e.config.js'),
  
  // 测试报告目录
  reportDir: path.join(__dirname, '../../coverage/e2e'),
  
  // 测试超时时间（毫秒）
  timeout: 300000, // 5分钟
  
  // 是否生成覆盖率报告
  coverage: false,
  
  // 是否运行所有测试
  runAll: false,
  
  // 特定测试文件
  testFile: null,
};

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--coverage':
        CONFIG.coverage = true;
        break;
      case '--all':
        CONFIG.runAll = true;
        break;
      case '--timeout':
        CONFIG.timeout = parseInt(args[++i]) || CONFIG.timeout;
        break;
      case '--test':
        CONFIG.testFile = args[++i];
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.error(`未知参数: ${arg}`);
          showHelp();
          process.exit(1);
        }
    }
  }
}

// 显示帮助信息
function showHelp() {
  console.log(`
E2E测试运行脚本

用法: node run-e2e-tests.cjs [选项]

选项:
  --coverage          生成覆盖率报告
  --all              运行所有测试
  --timeout <ms>      设置测试超时时间（默认: 300000ms）
  --test <file>       运行特定测试文件
  --help              显示此帮助信息

示例:
  node run-e2e-tests.cjs --all
  node run-e2e-tests.cjs --test document-upload.test.tsx
  node run-e2e-tests.cjs --coverage --timeout 600000
`);
}

// 创建报告目录
function ensureReportDir() {
  if (!fs.existsSync(CONFIG.reportDir)) {
    fs.mkdirSync(CONFIG.reportDir, { recursive: true });
  }
}

// 构建Jest命令
function buildJestCommand() {
  const jestPath = path.join(__dirname, '../../node_modules/.bin/jest');
  const command = [jestPath];
  
  // 添加配置文件
  command.push(`--config=${CONFIG.jestConfig}`);
  
  // 添加测试文件
  if (CONFIG.testFile) {
    command.push(CONFIG.testFile);
  } else if (CONFIG.runAll) {
    command.push('e2e/');
  } else {
    // 默认运行所有e2e测试
    command.push('e2e/');
  }
  
  // 添加覆盖率选项
  if (CONFIG.coverage) {
    command.push('--coverage');
    command.push('--coverageDirectory=coverage/e2e');
    command.push('--collectCoverageFrom=src/**/*.{ts,tsx}');
  }
  
  // 添加超时选项
  command.push(`--testTimeout=${CONFIG.timeout}`);
  
  // 添加详细输出
  command.push('--verbose');
  
  // 添加监视模式（用于开发）
  if (process.env.NODE_ENV === 'development') {
    command.push('--watch');
  }
  
  return command.join(' ');
}

// 运行测试
function runTests() {
  console.log('🧪 开始运行E2E测试...');
  console.log(`📁 测试报告目录: ${CONFIG.reportDir}`);
  console.log(`⏱️  测试超时: ${CONFIG.timeout}ms`);
  console.log(`📊 覆盖率: ${CONFIG.coverage ? '启用' : '禁用'}`);
  console.log('');
  
  try {
    // 确保报告目录存在
    ensureReportDir();
    
    // 构建Jest命令
    const command = buildJestCommand();
    console.log(`🚀 执行命令: ${command}`);
    console.log('');
    
    // 执行测试
    execSync(command, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '../..'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        JEST_WORKER_ID: '1',
      },
    });
    
    console.log('');
    console.log('✅ E2E测试完成');
    
    // 显示报告位置
    if (fs.existsSync(CONFIG.reportDir)) {
      console.log(`📊 测试报告: ${path.join(CONFIG.reportDir, 'report.html')}`);
      if (CONFIG.coverage) {
        console.log(`📈 覆盖率报告: ${path.join(CONFIG.reportDir, 'lcov-report/index.html')}`);
      }
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ E2E测试失败');
    console.error(`错误代码: ${error.status}`);
    
    // 显示报告位置（即使测试失败）
    if (fs.existsSync(CONFIG.reportDir)) {
      console.log(`📊 测试报告: ${path.join(CONFIG.reportDir, 'report.html')}`);
    }
    
    process.exit(error.status || 1);
  }
}

// 主函数
function main() {
  parseArgs();
  runTests();
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  runTests,
  CONFIG,
};