# 错误码表

本文档定义了系统 API 返回的统一错误码及其含义。客户端应根据这些错误码进行相应的处理。

## 1. 统一错误格式

所有 API 错误响应均遵循以下 JSON 格式：

```jsonc
{
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable error message",
    "details": {
      /* Optional: additional details about the error */
    },
  },
}
```

## 2. 错误码定义

| 错误码                       | HTTP 状态码 | 描述                 | 备注                                                                 |
| :--------------------------- | :---------- | :------------------- | :------------------------------------------------------------------- |
| `VALIDATION_ERROR`           | 422         | 请求参数校验失败     | `details` 字段包含具体的校验错误信息，例如哪个字段不符合要求。       |
| `NOT_FOUND`                  | 404         | 请求的资源不存在     | 例如，尝试删除一个不存在的文档。                                     |
| `UNAUTHORIZED`               | 401         | 未认证或认证失败     | 请求未提供有效的认证凭证。                                           |
| `FORBIDDEN`                  | 403         | 无权限访问资源       | 用户已认证，但没有执行该操作的权限。                                 |
| `INTERNAL_SERVER_ERROR`      | 500         | 服务器内部错误       | 未预期的服务器端错误，通常是代码 bug 或系统异常。                    |
| `SERVICE_UNAVAILABLE`        | 503         | 服务不可用           | 例如，健康检查失败，Qdrant 或 SQLite 不可达。                        |
| `FILE_UPLOAD_FAILED`         | 500         | 文件上传失败         | 文件存储或处理过程中发生错误。                                       |
| `DOCUMENT_PROCESSING_FAILED` | 500         | 文档处理失败         | 文档加载、切片、向量化过程中发生错误。                               |
| `SYNC_FAILED`                | 500         | 向量与元数据同步失败 | Qdrant 与 SQLite 数据一致性同步过程中发生错误。                      |
| `INVALID_INPUT`              | 400         | 无效的输入           | 请求参数格式正确，但业务逻辑上不合法（例如，尝试创建已存在的资源）。 |
