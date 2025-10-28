# Qdrant MCP RAG 项目代码规范指南

## 概述

本文档定义了Qdrant MCP RAG项目的代码规范和最佳实践，确保代码质量、可维护性和团队协作效率。

## 1. TypeScript 规范

### 1.1 类型定义

- **严格类型检查**: 启用TypeScript严格模式，避免使用`any`类型
- **接口优先**: 使用接口定义数据结构，而非类型别名
- **联合类型**: 合理使用联合类型和泛型，提高类型安全性
- **Brand类型**: 对关键ID使用Brand类型确保类型安全

```typescript
// ✅ 正确示例
interface User {
  id: UserId;
  name: string;
  email: string;
}

type UserId = string & { readonly brand: unique symbol };

// ❌ 错误示例
function processData(data: any): any {
  return data;
}
```

### 1.2 类型导入

- **使用`.js`扩展名**: 所有ES模块导入必须使用`.js`扩展名
- **相对路径**: 依赖路径使用`../`相对路径
- **领域类型别名**: 使用`@domain/*`别名导入领域类型

```typescript
// ✅ 正确示例
import { CollectionId, DocId } from '@domain/types.js';
import { CollectionService } from '../application/CollectionService.js';

// ❌ 错误示例
import { CollectionId, DocId } from '@domain/types';
import { CollectionService } from '../application/CollectionService';
```

## 2. 命名约定

### 2.1 变量和函数

- **camelCase**: 变量、函数名使用驼峰命名
- **描述性命名**: 名称应清晰表达意图和用途

```typescript
// ✅ 正确示例
const getUserById = (userId: string): User => { ... };
const isDocumentProcessed = true;

// ❌ 错误示例
const getuserbyid = (uid: string): any => { ... };
const doc_processed = true;
```

### 2.2 类和接口

- **PascalCase**: 类名、接口名使用帕斯卡命名
- **描述性命名**: 名称应反映实体的职责

```typescript
// ✅ 正确示例
class DocumentService {
  async getDocument(id: DocId): Promise<Document> { ... }
}

interface FileProcessingOptions {
  maxSize: number;
  allowedTypes: string[];
}

// ❌ 错误示例
class documentService {
  async getdocument(id: string): Promise<any> { ... }
}

interface file_processing_options {
  max_size: number;
  allowed_types: string[];
}
```

### 2.3 常量

- **SCREAMING_SNAKE_CASE**: 常量使用全大写下划线命名
- **枚举优先**: 优先使用枚举而非字符串常量

```typescript
// ✅ 正确示例
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_TIMEOUT = 30000;

enum DocumentStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// ❌ 错误示例
const maxFileSize = 10 * 1024 * 1024;
const defaultTimeout = 30000;
```

## 3. 文件组织

### 3.1 文件长度限制

- **400-500行**: 单个文件不应超过400-500行
- **模块化**: 超过限制的文件应拆分为多个模块
- **单一职责**: 每个文件应只负责一个明确的功能

### 3.2 目录结构

```
src/
├── domain/           # 领域层：接口、类型、业务规则
├── application/     # 应用层：服务协调、业务流程
├── infrastructure/   # 基础设施层：数据访问、外部服务
├── api/            # API层：路由、控制器、中间件
└── utils/           # 工具层：通用工具函数
```

### 3.3 导入顺序

1. Node.js内置模块
2. 第三方库模块
3. 项目内部模块（按层级排序）

```typescript
// ✅ 正确示例
import fs from 'fs/promises';
import path from 'path';
import { Collection } from '@domain/types.js';
import { CollectionService } from '../application/CollectionService.js';
import { SQLiteRepo } from '../infrastructure/SQLiteRepo.js';
```

## 4. JSDoc 注释规范

### 4.1 函数注释

```typescript
/**
 * 函数简短描述（一行）
 * 详细描述（可选，多行）
 * 
 * @param param1 - 参数描述
 * @param param2 - 参数描述
 * @returns 返回值描述
 * @throws {Error} 可能抛出的错误类型
 * 
 * @example
 * ```typescript
 * const result = functionName('arg1', 'arg2');
 * ```
 */
function functionName(param1: string, param2: number): string {
  // 实现
}
```

### 4.2 类和接口注释

```typescript
/**
 * 类或接口简短描述
 * 
 * @example
 * ```typescript
 * const instance = new ClassName({
 *   option1: 'value1',
 *   option2: 42
 * });
 * ```
 */
class ClassName {
  /**
   * 属性描述
   */
  public property: string;

  /**
   * 方法描述
   * @param param - 参数描述
   * @returns 返回值描述
   */
  public method(param: string): boolean {
    // 实现
  }
}
```

## 5. 错误处理

### 5.1 错误类型

- **自定义错误类**: 使用统一的错误类
- **错误链**: 保持错误调用链
- **错误上下文**: 提供足够的错误上下文信息

```typescript
// ✅ 正确示例
class AppError extends Error {
  public static createNotFoundError(message: string): AppError {
    const error = new AppError(message);
    error.name = 'NotFoundError';
    return error;
  }
}

// ❌ 错误示例
throw new Error('Not found');
```

### 5.2 异步错误处理

- **try-catch**: 所有异步操作都应有错误处理
- **错误传播**: 正确传播和处理异步错误
- **资源清理**: 确保错误情况下的资源清理

```typescript
// ✅ 正确示例
try {
  const result = await riskyOperation();
  return result;
} catch (error) {
  logger.error('Operation failed', error);
  throw AppError.createOperationError('Failed to process operation', error);
}
```

## 6. 代码质量

### 6.1 代码复杂度

- **单一职责**: 每个函数只做一件事
- **函数长度**: 函数不应超过50行
- **嵌套深度**: 避免过深的嵌套（最多3层）

### 6.2 魔法数字

- **常量定义**: 所有魔数都应定义为常量
- **配置化**: 可配置的值应从配置文件读取
- **注释说明**: 临时魔数必须有清晰注释

```typescript
// ✅ 正确示例
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT = 5000;

if (retryCount >= MAX_RETRY_ATTEMPTS) {
  throw new Error('Max retry attempts exceeded');
}

// ❌ 错误示例
if (retryCount >= 3) {
  throw new Error('Max retry attempts exceeded');
}
```

## 7. 测试规范

### 7.1 测试文件命名

- **`.test.ts`后缀**: 测试文件使用`.test.ts`后缀
- **`__tests__`目录**: 复杂模块可使用`__tests__`目录
- **测试描述**: 测试名称应清晰描述测试场景

### 7.2 测试结构

```typescript
// ✅ 正确示例
describe('UserService', () => {
  describe('getUserById', () => {
    it('should return user when valid id is provided', async () => {
      // Arrange
      const userId = 'user-123';
      const expectedUser = { id: userId, name: 'Test User' };
      
      // Act
      const result = await userService.getUserById(userId);
      
      // Assert
      expect(result).toEqual(expectedUser);
    });

    it('should throw error when invalid id is provided', async () => {
      // Arrange
      const invalidId = '';
      
      // Act & Assert
      await expect(userService.getUserById(invalidId))
        .rejects.toThrow('Invalid user ID');
    });
  });
});
```

## 8. 性能优化

### 8.1 异步操作

- **并发控制**: 合理控制并发操作数量
- **资源池**: 使用连接池或对象池
- **缓存策略**: 实现适当的缓存策略

### 8.2 内存管理

- **及时释放**: 及时释放不再使用的资源
- **避免泄漏**: 注意事件监听器和定时器的清理
- **内存监控**: 监控关键组件的内存使用

## 9. 安全规范

### 9.1 输入验证

- **严格验证**: 所有外部输入都必须验证
- **类型检查**: 使用TypeScript进行编译时检查
- **运行时检查**: 关键操作进行运行时验证

### 9.2 敏感信息

- **避免日志**: 不在日志中记录敏感信息
- **环境变量**: 敏感配置使用环境变量
- **数据脱敏**: 必要时对敏感数据进行脱敏

## 10. Git 提交规范

### 10.1 提交消息格式

使用Conventional Commits规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**作用域**:
- `backend`: 后端相关
- `frontend`: 前端相关
- `api`: API相关
- `docs`: 文档相关
- `ci`: CI/CD相关

### 10.2 提交示例

```bash
feat(backend): implement cascade deletion for documents and collections
fix(frontend): resolve search rate limiting issues
docs(api): update OpenAPI specifications for new features
refactor(search): optimize search performance with caching
```

## 11. 代码审查清单

### 11.1 提交前检查

- [ ] 代码通过ESLint检查
- [ ] 代码通过Prettier格式化
- [ ] 所有测试通过
- [ ] 文档已更新
- [ ] 性能影响已评估
- [ ] 安全影响已评估

### 11.2 审查要点

- [ ] 类型安全性：是否正确使用TypeScript类型
- [ ] 错误处理：是否妥善处理所有错误情况
- [ ] 性能影响：是否考虑性能影响
- [ ] 安全考虑：是否存在安全隐患
- [ ] 代码复用：是否充分利用现有代码
- [ ] 测试覆盖：是否充分测试关键路径

## 12. 工具配置

### 12.1 ESLint配置

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": "error",
    "max-lines-per-function": ["warn", 50],
    "complexity": ["warn", 10]
  }
}
```

### 12.2 Prettier配置

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false
}
```

## 13. 最佳实践总结

1. **可读性优先**: 代码首先是写给人读的
2. **一致性原则**: 保持代码风格和模式的一致性
3. **简单性原则**: 选择简单、直接的解决方案
4. **重构勇气**: 勇于重构，保持代码整洁
5. **测试驱动**: 关键功能优先编写测试
6. **文档同步**: 代码变更时同步更新文档
7. **性能意识**: 编写时考虑性能影响
8. **安全思维**: 始终考虑安全影响

---

*本规范文档会根据项目发展和团队反馈持续更新。*