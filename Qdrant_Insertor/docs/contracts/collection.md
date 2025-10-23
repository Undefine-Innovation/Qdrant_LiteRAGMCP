# Collection Contracts

此文件定义了 Collection 相关的 API 请求和响应的数据传输对象 (DTO) 及其 Zod 验证模式。

## `CreateCollectionRequestSchema`

- **用途**：创建 Collection 的请求体。
- **字段列表**：
  - `name`: 字符串，必填，Collection 的名称。
  - `description`: 字符串，可选，Collection 的描述。

```typescript
export const CreateCollectionRequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});
```

## `UpdateCollectionRequestSchema`

- **用途**：更新 Collection 的请求体。
- **字段列表**：
  - `name`: 字符串，可选，Collection 的新名称。
  - `description`: 字符串，可选，Collection 的新描述。

```typescript
export const UpdateCollectionRequestSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});
```

## `CollectionResponseSchema`

- **用途**：Collection 响应的数据结构。
- **字段列表**：
  - `collectionId`: 字符串，必填，Collection 的唯一标识符。
  - `name`: 字符串，必填，Collection 的名称。
  - `description`: 字符串，可选，Collection 的描述。
  - `createdAt`: 数字，必填，Collection 的创建时间戳。

```typescript
export const CollectionResponseSchema = z.object({
  collectionId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  createdAt: z.number(),
});
```
