# 基本代码规范记录

本文档记录了项目开发过程中应遵循的基本代码规范和风格指南，旨在提高代码的可读性、可维护性和团队协作效率。

## 1. 语言与框架规范

- **TypeScript**：
  - 遵循 TypeScript 官方推荐的最佳实践。
  - 严格的类型定义，避免使用 `any`。
  - 使用 `interface` 或 `type` 定义数据结构。
- **Node.js / Express / Koa**：
  - 遵循各自框架的惯例和最佳实践。
  - 异步操作使用 `async/await`。
- **前端框架 (Vue/React/Svelte)**：
  - 遵循所选框架的官方风格指南。
  - 组件化开发，确保组件职责单一、可复用。

## 2. 命名约定

- **变量与函数**：使用 `camelCase` (小驼峰命名法)。
  - 示例：`userName`, `getUserProfile`
- **类与接口**：使用 `PascalCase` (大驼峰命名法)。
  - 示例：`UserService`, `IUserRepository`
- **常量**：使用 `SCREAMING_SNAKE_CASE` (全大写下划线命名法)。
  - 示例：`MAX_RETRIES`, `DEFAULT_PAGE_SIZE`
- **文件名**：
  - TypeScript/JavaScript 文件：使用 `kebab-case` (烤串命名法) 或 `camelCase`。
    - 示例：`user-service.ts`, `userService.ts`
  - Markdown 文件：使用 `kebab-case`。
    - 示例：`coding-style.md`

## 3. 代码格式化与 Linting

- **ESLint**：
  - 使用 ESLint 进行代码静态分析，捕获潜在错误和风格问题。
  - 项目根目录下的 `eslint.config.ts` (或 `.eslintrc.js`) 定义了 ESLint 规则。
  - 建议在 VS Code 中安装 ESLint 插件，并启用“保存时自动修复”功能。
- **Prettier**：
  - 使用 Prettier 进行代码自动格式化，确保代码风格一致。
  - 项目根目录下的 `.prettierrc` 定义了 Prettier 规则。
  - 建议在 VS Code 中安装 Prettier 插件，并启用“保存时自动格式化”功能。

## 4. 注释规范

- **JSDoc**：
  - 为所有函数、类、接口、复杂变量提供 JSDoc 注释，说明其目的、参数、返回值和可能抛出的异常。
  - 示例：
    ```typescript
    /**
     * 获取用户列表
     * @param {number} page - 页码
     * @param {number} limit - 每页数量
     * @returns {Promise<User[]>} 用户列表
     * @throws {AppError} 如果获取失败
     */
    async function getUsers(page: number, limit: number): Promise<User[]> {
      // ...
    }
    ```
- **行内注释**：
  - 用于解释复杂逻辑、算法或非显而易见的实现细节。
  - 保持简洁明了。

## 5. 分支命名约定

- **主分支**：`main` 或 `master`
- **开发分支**：`develop`
- **特性分支**：`feature/<feature-name>` (例如：`feature/add-user-auth`)
- **Bug 修复分支**：`bugfix/<bug-description>` (例如：`bugfix/fix-login-issue`)
- **发布分支**：`release/<version>` (例如：`release/v1.0.0`)
- **热修复分支**：`hotfix/<hotfix-description>` (例如：`hotfix/fix-critical-bug`)

## 6. Commit 消息规范

- 遵循 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 规范，以便于自动生成变更日志和版本号。
- 格式：`<type>(<scope>): <description>`
  - `type`：`feat` (新功能), `fix` (Bug 修复), `docs` (文档), `style` (代码风格), `refactor` (重构), `test` (测试), `chore` (构建过程或辅助工具的变动) 等。
  - `scope` (可选)：表示改动范围，例如 `api`, `ui`, `db`, `sync`。
  - `description`：简短的描述，首字母小写，句末不加句号。
- 示例：
  - `feat(api): add /upload endpoint`
  - `fix(search): resolve RRF fusion bug`
  - `docs(architecture): update domain models`
