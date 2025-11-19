# 值对象 (Value Objects)

本目录包含了Qdrant MCP RAG项目的核心值对象实现，遵循领域驱动设计(DDD)原则。

## 概述

值对象是DDD中的重要概念，用于表示没有唯一标识符的业务概念。它们是不可变的，包含业务规则验证，并通过值而不是引用来比较相等性。

## 已实现的值对象

### 1. DocumentContent

文档内容值对象，包含内容验证和业务规则。

**特性：**

- 内容长度验证（1-10,000,000字符）
- 空白内容检查
- 内容统计（长度、单词数、行数、字节大小）
- 内容预览和搜索功能

**使用示例：**

```typescript
import { DocumentContent } from '@domain/value-objects/index.js';

try {
  const content = DocumentContent.create('这是文档内容');
  console.log(content.getLength()); // 获取字符数
  console.log(content.getWordCount()); // 获取单词数
  console.log(content.getPreview(100)); // 获取预览
} catch (error) {
  console.error('内容验证失败:', error.message);
}
```

### 2. CollectionName

集合名称值对象，包含名称验证和业务规则。

**特性：**

- 名称长度验证（1-255字符）
- 字符格式验证（仅允许字母、数字、下划线、连字符和点）
- 保留名称检查
- 大小写不敏感比较

**使用示例：**

```typescript
import { CollectionName } from '@domain/value-objects/index.js';

try {
  const name = CollectionName.create('my-collection');
  console.log(name.getDisplayName()); // My-collection
  console.log(name.getNormalizedName()); // my-collection
} catch (error) {
  console.error('名称验证失败:', error.message);
}

// 检查名称格式
if (CollectionName.isValidFormat('test-name')) {
  console.log('名称格式有效');
}
```

### 3. ChunkContent

块内容值对象，包含内容验证和业务规则。

**特性：**

- 内容长度验证（10-50,000字符）
- 空白字符比例检查
- 内容复杂度计算
- 关键词提取
- 搜索适用性评估

**使用示例：**

```typescript
import { ChunkContent } from '@domain/value-objects/index.js';

try {
  const chunk = ChunkContent.create('这是块内容');
  console.log(chunk.calculateComplexity()); // 计算复杂度
  console.log(chunk.extractKeywords(5)); // 提取关键词
  console.log(chunk.isSuitableForSearch()); // 检查是否适合搜索
} catch (error) {
  console.error('块内容验证失败:', error.message);
}
```

### 4. EmbeddingVector

嵌入向量值对象，包含向量验证和数学运算。

**特性：**

- 向量维度验证（1-10,000维）
- 数值范围验证（-1.0到1.0）
- 零向量检查
- 向量运算（余弦相似度、欧几里得距离等）
- 向量标准化

**使用示例：**

```typescript
import { EmbeddingVector } from '@domain/value-objects/index.js';

try {
  const vector1 = EmbeddingVector.create([0.1, 0.2, 0.3]);
  const vector2 = EmbeddingVector.create([0.4, 0.5, 0.6]);

  console.log(vector1.cosineSimilarity(vector2)); // 余弦相似度
  console.log(vector1.euclideanDistance(vector2)); // 欧几里得距离
  console.log(vector1.getL2Norm()); // L2范数

  const normalized = vector1.normalize(); // 标准化
} catch (error) {
  console.error('向量验证失败:', error.message);
}
```

## 基础架构

### BaseValueObject

所有值对象的基类，提供通用功能：

- 不可变性
- 相等性比较
- 值访问
- 验证框架

### IValueObject

值对象接口，定义标准契约：

- `getValue()`: 获取原始值
- `equals()`: 相等性比较
- `toString()`: 字符串表示

## 设计原则

### 1. 不可变性

值对象创建后不能修改，确保线程安全和数据一致性。

### 2. 验证

每个值对象都包含业务规则验证，在创建时确保数据有效性。

### 3. 相等性

通过值而不是引用比较相等性，确保语义正确性。

### 4. 业务行为

值对象包含相关的业务行为，不仅仅是数据容器。

## 最佳实践

### 1. 创建值对象

始终使用静态工厂方法创建值对象：

```typescript
// ✅ 正确
const content = DocumentContent.create('valid content');

// ❌ 错误
const content = new DocumentContent('valid content'); // 构造函数是私有的
```

### 2. 错误处理

始终处理值对象创建可能抛出的验证错误：

```typescript
try {
  const name = CollectionName.create(userInput);
  // 使用name
} catch (error) {
  // 处理验证错误
  return { error: error.message };
}
```

### 3. 类型安全

利用TypeScript的类型系统确保类型安全：

```typescript
function processContent(content: DocumentContent): void {
  // content保证是有效的DocumentContent实例
  console.log(content.getLength());
}
```

### 4. 持久化

在持久化层使用原始值，在应用层使用值对象：

```typescript
// 应用层
const content = DocumentContent.create(userInput);
await repository.save({
  id: docId,
  content: content.getValue(), // 持久化原始值
  // ...
});
```

## 扩展指南

### 添加新值对象

1. 继承`BaseValueObject<T>`
2. 实现必需的抽象方法：
   - `validate()`: 验证逻辑
   - `isEqual()`: 相等性比较
3. 提供静态工厂方法`create()`
4. 添加业务行为方法
5. 更新导出文件

### 示例

```typescript
export class NewValueObject extends BaseValueObject<string> {
  public static create(value: string): NewValueObject {
    return new NewValueObject(value);
  }

  private constructor(value: string) {
    super(value);
    this.validate(value);
  }

  protected validate(value: string): void {
    // 验证逻辑
  }

  protected isEqual(otherValue: string): boolean {
    return this.value === otherValue;
  }

  // 业务行为方法
  public someBusinessMethod(): string {
    return this.value.toUpperCase();
  }
}
```

## 测试

值对象应该包含全面的单元测试：

- 验证逻辑测试
- 边界条件测试
- 业务行为测试
- 相等性测试

## 相关文档

- [领域层设计指南](../../docs/notes/coding_style.md)
- [DDD最佳实践](../../docs/notes/code-management-standards.md)
- [值对象示例服务](../services/ValueObjectExampleService.ts)
