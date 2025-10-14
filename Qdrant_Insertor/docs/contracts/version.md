# Version 模块契约文档

本文档定义了 Version 模块相关的 API 请求体、响应体和核心数据模型结构。

## 1. CreateVersionRequestSchema (创建 Version 请求体)

用于验证创建 Version 的请求体。

### 结构

| 字段名       | 类型     | 必填 | 用途         | Zod Schema 定义                               |
| :----------- | :------- | :--- | :----------- | :-------------------------------------------- |
| `name`       | `string` | 是   | Version 名称 | `z.string()`                                  |
| `description`| `string` | 否   | Version 描述 | `z.string().optional()`                       |
| `collectionId`| `string` | 是   | 所属 Collection ID | `z.string()`                                  |

### Zod Schema

```typescript
import { z } from 'zod';

export const CreateVersionRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  collectionId: z.string(),
});
```

## 2. UpdateVersionStatusRequestSchema (更新 Version 状态请求体)

用于验证更新 Version 状态的请求体。

### 结构

| 字段名   | 类型     | 必填 | 用途         | Zod Schema 定义 |
| :------- | :------- | :--- | :----------- | :-------------- |
| `status` | `string` | 是   | Version 状态 | `z.string()`    |

### Zod Schema

```typescript
import { z } from 'zod';

export const UpdateVersionStatusRequestSchema = z.object({
  status: z.string(),
});
```

## 3. VersionResponseSchema (Version 响应数据结构)

用于定义 Version 响应的数据结构。

### 结构

| 字段名       | 类型     | 必填 | 用途             | Zod Schema 定义                                   |
| :----------- | :------- | :--- | :--------------- | :------------------------------------------------ |
| `versionId`  | `string` | 是   | Version ID       | `z.string()`                                      |
| `collectionId`| `string` | 是   | 所属 Collection ID | `z.string()`                                      |
| `name`       | `string` | 是   | Version 名称     | `z.string()`                                      |
| `description`| `string` | 否   | Version 描述     | `z.string().optional()`                           |
| `status`     | `string` | 是   | Version 状态     | `z.string()`                                      |
| `isCurrent`  | `number` | 是   | 是否为当前版本 (0 或 1) | `z.number().int().refine(val => val === 0 || val === 1)` |
| `createdAt`  | `number` | 是   | 创建时间戳       | `z.number()`                                      |
| `updatedAt`  | `number` | 是   | 更新时间戳       | `z.number()`                                      |

### Zod Schema

```typescript
import { z } from 'zod';

export const VersionResponseSchema = z.object({
  versionId: z.string(),
  collectionId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.string(),
  isCurrent: z.number().int().refine(val => val === 0 || val === 1),
  createdAt: z.number(),
  updatedAt: z.number(),
});