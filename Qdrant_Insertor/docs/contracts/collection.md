# Collection API 契约

## CreateCollectionRequestSchema

### 用途
用于验证创建 Collection 的请求体。

### 字段

#### `name`
*   **数据类型**: 字符串
*   **是否必填**: 是
*   **描述**: Collection 的名称。

#### `description`
*   **数据类型**: 字符串
*   **是否必填**: 否
*   **描述**: Collection 的描述。

---

## UpdateCollectionRequestSchema

### 用途
用于验证更新 Collection 的请求体。

### 字段

#### `name`
*   **数据类型**: 字符串
*   **是否必填**: 否
*   **描述**: Collection 的新名称。

#### `description`
*   **数据类型**: 字符串
*   **是否必填**: 否
*   **描述**: Collection 的新描述。

---

## CollectionResponseSchema

### 用途
用于定义 Collection 响应的数据结构。

### 字段

#### `collectionId`
*   **数据类型**: 字符串
*   **是否必填**: 是
*   **描述**: Collection 的唯一标识符。

#### `name`
*   **数据类型**: 字符串
*   **是否必填**: 是
*   **描述**: Collection 的名称。

#### `description`
*   **数据类型**: 字符串
*   **是否必填**: 否
*   **描述**: Collection 的描述。

#### `createdAt`
*   **数据类型**: 数字
*   **是否必填**: 是
*   **描述**: Collection 的创建时间戳（Unix 时间）。