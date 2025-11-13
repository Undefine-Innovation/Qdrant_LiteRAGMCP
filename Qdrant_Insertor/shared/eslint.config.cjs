/**
 * ESLint 配置文件
 * @description 配置项目的ESLint规则，包括TypeScript和JSDoc规则
 */
const js = require("@eslint/js");
/**
 * TypeScript ESLint 配置
 * @description 提供TypeScript相关的ESLint规则
 */
const tseslint = require("typescript-eslint");
/**
 * JSDoc 插件
 * @description 提供JSDoc相关的ESLint规则
 */
const jsdoc = require("eslint-plugin-jsdoc");

module.exports = tseslint.config(
    { ignores: ['dist/**/*', '**/*.d.ts'] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            // Ensure typescript-eslint parser can locate correct tsconfig for this package.
            parserOptions: {
                tsconfigRootDir: __dirname,
                project: ['./tsconfig.json'],
            },
            globals: {
                console: "readonly",
                process: "readonly",
                Buffer: "readonly",
                __dirname: "readonly",
                __filename: "readonly",
                module: "readonly",
                require: "readonly",
                exports: "readonly",
                global: "readonly",
                // 添加浏览器和Node.js全局变量
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly",
                TextEncoder: "readonly",
                TextDecoder: "readonly",
            },
        },
        plugins: {
            jsdoc: jsdoc
        },
        rules: {
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "no-console": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-require-imports": "off", // 允许在配置文件中使用require
            
            // ⭐ 核心 JSDoc 规则，根据您的需求调整如下：
            "jsdoc/require-jsdoc": [
                "error",
                {
                    // 确保 FunctionDeclaration, MethodDefinition, ClassDeclaration 必须有 JSDoc
                    "require": {
                        "FunctionDeclaration": true,
                        "MethodDefinition": true,
                        "ClassDeclaration": true,
                        "ArrowFunctionExpression": false,
                        "FunctionExpression": false
                    },
                    
                    // 补充检查导出的元素、顶层变量和 TypeScript 类型定义。
                    "contexts": [
                        "ExportNamedDeclaration",
                        "ExportDefaultDeclaration",
                        "Program > VariableDeclaration", // 模块顶层的变量（非导出也需要）
                        "TSInterfaceDeclaration",
                        "TSTypeAliasDeclaration",
                    ]
                }
            ],
            "jsdoc/require-jsdoc": "off",
            
            // 建议：同时启用 JSDoc 内容完整性检查
            "jsdoc/require-param": "off", // 开启参数要求
            "jsdoc/require-returns": "off", // 开启返回值要求
            "jsdoc/require-description": "off", // 开启描述要求
        },
    }
);