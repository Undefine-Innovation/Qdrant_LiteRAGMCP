# 4.2 API 层 ⭐

## 2.1 概述

API 层是系统的对外接口，负责接收来自前端或其他客户端的请求，进行参数校验、认证授权，并将请求转发给应用层处理。它是整个系统的门面，旨在提供统一、易用、可自动生成文档的 RESTful API 接口。本次重构的重点模块之一。

## 2.2 模块列表

*   **Router & Middleware**
*   **DTO Validator**
*   **Controller**

## 2.3 模块详情

### 2.3.1 Router & Middleware

#### 2.3.1.1 职责

*   **路由管理**：定义 API 接口的路径和对应的处理函数。
*   **统一处理**：处理跨域资源共享 (CORS)、请求认证 (Auth) 和全局错误捕获。
*   **请求预处理**：在请求到达 Controller 之前进行一些通用的处理，如日志记录、请求体解析等。

#### 2.3.1.2 接口与数据流

*   **对外接口**：接收 HTTP 请求。
*   **对内接口**：将处理后的请求转发给 DTO Validator 或 Controller。
*   **数据流**：HTTP Request -> Middleware Chain -> DTO Validator -> Controller。

#### 2.3.1.3 关键实现与技术栈

*   **技术栈**：Express 或 Koa。
*   **CORS**：使用 `cors` 中间件。
*   **认证**：使用 `passport.js` 或自定义 JWT/Session 中间件。
*   **错误捕获**：全局错误处理中间件，捕获同步和异步错误。

#### 2.3.1.4 开发需求与约定

*   **编码规范**：
    *   路由定义应清晰、有组织，可按资源类型进行分组。
    *   中间件应职责单一，避免在中间件中包含复杂的业务逻辑。
*   **错误处理**：
    *   全局错误处理中间件应能捕获所有未处理的异常，并返回统一的错误格式。
    *   区分操作性错误 (如参数校验失败) 和编程性错误 (如代码 bug)。
*   **测试策略**：
    *   使用 `supertest` 对路由和中间件进行集成测试，确保请求能够正确路由和处理。
*   **依赖管理**：
    *   管理 Express/Koa 及其相关中间件的依赖。

### 2.3.2 DTO Validator

#### 2.3.2.1 职责

*   **请求校验**：对进入 Controller 的请求参数 (Query, Body, Params) 进行严格的数据格式和业务规则校验。
*   **错误响应**：当校验失败时，返回统一的 `422 Unprocessable Entity` 错误响应。

#### 2.3.2.2 接口与数据流

*   **对外接口**：接收来自 Router & Middleware 的请求。
*   **对内接口**：如果校验通过，将校验后的数据传递给 Controller。
*   **数据流**：Middleware -> DTO Validator -> Controller。

#### 2.3.2.3 关键实现与技术栈

*   **技术栈**：Zod。
*   **集成**：通过 `express-zod-openapi` 实现与 Express/Koa 的集成，并自动生成 OpenAPI 文档。

#### 2.3.2.4 开发需求与约定

*   **编码规范**：
    *   为每个 API 端点定义清晰的 Zod Schema。
    *   Schema 命名应具有描述性，并与对应的 DTO 保持一致。
*   **错误处理**：
    *   校验失败时，返回的错误信息应包含详细的字段错误信息。
    *   错误格式应遵循统一错误格式约定。
*   **测试策略**：
    *   对 DTO Schema 进行单元测试，确保其校验逻辑的正确性。
    *   集成测试中应包含参数校验失败的场景。
*   **依赖管理**：
    *   管理 Zod 和 `express-zod-openapi` 的依赖。

### 2.3.3 Controller

#### 2.3.3.1 职责

*   **参数解包**：从 HTTP 请求中提取所需的参数。
*   **服务调用**：调用应用层 (Service) 的相应方法来执行业务逻辑。
*   **响应封装**：将应用层返回的结果封装成 HTTP 响应，并设置正确的状态码。
*   **职责单一**：Controller 应该保持轻量，不包含复杂的业务逻辑，只负责协调请求和响应。

#### 2.3.3.2 接口与数据流

*   **对外接口**：接收来自 DTO Validator 的校验通过的请求。
*   **对内接口**：调用应用层 Service 的方法。
*   **数据流**：DTO Validator -> Controller -> Application Layer Service -> Controller -> HTTP Response。

#### 2.3.3.3 关键实现与技术栈

*   **技术栈**：Express 或 Koa 的路由处理函数。
*   **依赖注入**：可能使用简单的工厂模式或 IoC 容器来注入 Service 依赖。

#### 2.3.3.4 开发需求与约定

*   **编码规范**：
    *   Controller 方法命名应清晰，反映其功能。
    *   避免在 Controller 中直接访问数据库或执行复杂业务逻辑。
*   **错误处理**：
    *   捕获 Service 层抛出的业务异常，并转换为合适的 HTTP 错误响应。
*   **测试策略**：
    *   对 Controller 进行集成测试，模拟 HTTP 请求，验证其参数解包、服务调用和响应封装的正确性。
    *   使用 Mock 对象模拟 Service 层的行为，隔离测试 Controller 自身的逻辑。
*   **依赖管理**：
    *   管理 Controller 对应用层 Service 的依赖。

## 2.4 主要端点（REST 版）

| 方法   | 路径                | 功能                | 状态码 | 备注                           |
| ------ | ------------------- | ------------------- | ------ | ------------------------------ |
| POST   | `/upload`           | 上传文件            | 201    | `multipart/form-data`；返回 `docId` |
| DELETE | `/doc/:id`          | 删除文档            | 204    | 触发同步状态机进行清理          |
| GET    | `/doc/:id/chunks`   | 查询文档 Chunk 列表 | 200    | 支持分页                       |
| GET    | `/search`           | 向量检索            | 200    | 返回 `RetrievalResultDTO`      |
| GET    | `/healthz`          | 健康检查            | 200    | 检查 Qdrant 和 SQLite 是否可达 |
| GET    | `/metrics`          | Prometheus 指标暴露 | 200    | 可选启用                       |

## 2.5 统一错误格式

```jsonc
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "field 'q' is required",
    "details": { /* 校验字段详情 */ }
  }
}
```

所有 API 可通过 `express-zod-openapi` 自动生成 OpenAPI 文档。