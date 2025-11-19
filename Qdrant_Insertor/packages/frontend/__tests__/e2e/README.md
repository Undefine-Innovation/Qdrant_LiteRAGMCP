# 前端端到端(E2E)测试

本目录包含了Qdrant MCP RAG前端应用的端到端测试套件，用于验证主要用户流程和功能。

## 测试结构

```
__tests__/e2e/
├── setup.ts                    # 测试环境设置
├── utils/
│   └── test-helpers.ts         # 测试工具和辅助函数
├── document-upload.test.tsx     # 文档上传流程测试
├── search-functionality.test.tsx # 搜索功能测试
├── batch-operations.test.tsx    # 批量操作测试
├── collection-management.test.tsx # 集合管理测试
├── document-preview-download.test.tsx # 文档预览和下载测试
├── user-workflows.test.tsx      # 完整用户工作流测试
├── jest.e2e.config.js         # Jest配置文件
├── run-e2e-tests.js           # 测试运行脚本
└── README.md                  # 本文档
```

## 测试覆盖范围

### 1. 文档上传流程测试

- 单个文档上传
- 批量文档上传
- 文件拖拽上传
- 上传进度显示
- 上传错误处理
- 文件格式验证
- 文件大小限制

### 2. 搜索功能测试

- 基本搜索功能
- 搜索结果展示
- 搜索历史记录
- 搜索建议
- 集合筛选搜索
- 搜索结果分页
- 搜索状态指示器
- 键盘导航

### 3. 批量操作测试

- 批量文档删除
- 批量集合删除
- 批量操作状态跟踪
- 批量操作进度显示
- 部分失败处理
- 操作确认对话框

### 4. 集合管理测试

- 集合创建
- 集合编辑
- 集合删除
- 集合列表显示
- 集合分页
- 表单验证
- 错误处理

### 5. 文档预览和下载测试

- 文档详情查看
- 文本文件预览
- Markdown文件预览
- PDF文件预览
- 不支持文件类型处理
- 文档下载
- 多格式下载选项

### 6. 完整用户工作流测试

- 创建集合 → 上传文档 → 搜索 → 删除的完整流程
- 批量上传 → 批量删除的工作流
- 搜索和导航工作流
- 错误处理工作流

## 运行测试

### 前置条件

1. 确保已安装所有依赖：

```bash
cd packages/frontend
npm install
```

2. 确保后端服务正在运行：

```bash
cd packages/backend
npm run start
```

### 运行所有E2E测试

```bash
# 使用运行脚本
node __tests__/e2e/run-e2e-tests.js --all

# 或直接使用Jest
npx jest --config __tests__/e2e/jest.e2e.config.js
```

### 运行特定测试文件

```bash
# 运行文档上传测试
node __tests__/e2e/run-e2e-tests.js --test document-upload.test.tsx

# 运行搜索功能测试
node __tests__/e2e/run-e2e-tests.js --test search-functionality.test.tsx
```

### 生成覆盖率报告

```bash
node __tests__/e2e/run-e2e-tests.js --all --coverage
```

### 开发模式（监视模式）

```bash
NODE_ENV=development node __tests__/e2e/run-e2e-tests.js --all
```

## 测试配置

### 环境变量

测试使用以下环境变量：

```bash
NODE_ENV=test                    # 测试环境标识
JEST_WORKER_ID=1               # Jest工作进程ID
```

### Jest配置

主要配置项：

- `testEnvironment`: 'jsdom' - 模拟浏览器环境
- `testTimeout`: 30000 - 测试超时时间
- `maxWorkers`: 1 - 使用单线程避免并发问题
- `setupFilesAfterEnv`: 测试环境设置文件
- `collectCoverage`: false - E2E测试通常不收集覆盖率

## 测试工具和辅助函数

### TestDataFactory

用于创建测试数据的工厂类：

```typescript
// 创建测试集合
const collection = TestDataFactory.createCollection({
  name: '测试集合',
  description: '测试描述',
});

// 创建多个测试文档
const documents = TestDataFactory.createDocuments(5, 'collection-id');

// 创建测试搜索结果
const searchResults = TestDataFactory.createSearchResults(3);
```

### ApiMockFactory

用于模拟API响应的工厂类：

```typescript
// 模拟集合API
const mockCollectionsApi = ApiMockFactory.mockCollectionsApi();

// 模拟文档API
const mockDocumentsApi = ApiMockFactory.mockDocumentsApi();

// 模拟搜索API
const mockSearchApi = ApiMockFactory.mockSearchApi();
```

### ComponentTestHelpers

组件测试辅助函数：

```typescript
// 模拟用户输入
ComponentTestHelpers.simulateUserInput(element, 'value');

// 模拟文件拖拽
ComponentTestHelpers.simulateFileDrop(element, files);

// 模拟点击事件
ComponentTestHelpers.simulateClick(element);

// 模拟键盘事件
ComponentTestHelpers.simulateKeyboard(element, 'Enter');
```

### AssertionHelpers

断言辅助函数：

```typescript
// 断言元素存在
AssertionHelpers.assertElementExists('[data-testid="element"]');

// 断言元素可见
AssertionHelpers.assertElementVisible('[data-testid="element"]');

// 断言元素包含文本
AssertionHelpers.assertElementContainsText('[data-testid="element"]', 'text');

// 断言元素属性值
AssertionHelpers.assertElementAttribute(
  '[data-testid="element"]',
  'attr',
  'value',
);
```

## 测试最佳实践

### 1. 测试命名

```typescript
describe('功能模块', () => {
  describe('具体场景', () => {
    it('应该执行特定行为', async () => {
      // 测试实现
    });
  });
});
```

### 2. 测试结构

1. **Arrange** - 设置测试数据和模拟
2. **Act** - 执行用户操作
3. **Assert** - 验证结果

```typescript
it('应该能够上传文档', async () => {
  // Arrange
  const mockFile = TestDataFactory.createMockFile('test.txt', 'text/plain', 'content');
  const mockOnUpload = jest.fn();

  // Act
  render(<DocumentUpload onUpload={mockOnUpload} />);
  const fileInput = screen.getByTestId('file-input');
  fireEvent.change(fileInput);

  // Assert
  await waitFor(() => {
    expect(mockOnUpload).toHaveBeenCalled();
  });
});
```

### 3. 测试隔离

- 每个测试前清理模拟
- 使用独立的测试数据
- 避免测试之间的依赖

### 4. 异步测试

- 使用`waitFor`等待异步操作
- 设置合理的超时时间
- 处理Promise rejection

### 5. 错误测试

- 测试正常流程和错误场景
- 验证错误处理机制
- 测试边界条件

## 调试技巧

### 1. 启用详细日志

```bash
DEBUG=* node __tests__/e2e/run-e2e-tests.js --test specific-test.test.tsx
```

### 2. 查看DOM状态

```typescript
// 在测试中添加调试代码
screen.debug(); // 打印当前DOM
screen.debug(element); // 打印特定元素
```

### 3. 暂停测试执行

```typescript
// 在测试中添加暂停
await TestUtils.wait(5000); // 暂停5秒
```

### 4. 运行单个测试

```bash
# 使用--testNamePattern
node __tests__/e2e/run-e2e-tests.js --all --testNamePattern="应该能够上传文档"
```

## 持续集成

### GitHub Actions配置示例

```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: node __tests__/e2e/run-e2e-tests.js --all --coverage
      - uses: actions/upload-artifact@v2
        with:
          name: e2e-test-results
          path: coverage/e2e/
```

## 故障排除

### 常见问题

1. **测试超时**
   - 增加测试超时时间
   - 检查异步操作是否正确等待

2. **元素未找到**
   - 确认使用了正确的data-testid
   - 检查元素是否在DOM中渲染

3. **模拟未生效**
   - 确认mock路径正确
   - 检查mock是否在测试前设置

4. **异步操作失败**
   - 使用waitFor等待异步操作
   - 检查Promise是否正确处理

### 获取帮助

如果遇到问题：

1. 查看测试报告和日志
2. 检查控制台错误信息
3. 使用调试技巧定位问题
4. 参考现有测试的写法

## 贡献指南

### 添加新测试

1. 在相应的测试文件中添加测试用例
2. 使用TestDataFactory生成测试数据
3. 使用ComponentTestHelpers模拟用户操作
4. 使用AssertionHelpers进行断言
5. 确保测试具有适当的描述和断言

### 测试命名约定

```typescript
describe('功能模块', () => {
  describe('具体场景', () => {
    it('应该执行特定行为', async () => {
      // 测试实现
    });
  });
});
```

### 断言约定

```typescript
// 使用AssertionHelpers进行断言
AssertionHelpers.assertElementExists('[data-testid="element"]');
AssertionHelpers.assertElementContainsText(
  '[data-testid="element"]',
  'expected text',
);
```

## 相关文档

- [Jest文档](https://jestjs.io/docs/getting-started)
- [React Testing Library文档](https://testing-library.com/docs/react-testing-library/intro)
- [项目开发指南](../../../README.md)
- [API文档](../../../docs/apis/)
