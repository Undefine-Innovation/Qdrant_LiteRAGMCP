#!/bin/bash

# SQLite 数据库文件路径，默认为 ./data/app.db
DB_PATH="./data/app.db"
SCHEMA_FILE="./migrations/001_initial_schema.sql"

# 检查 sqlite3 是否安装
if ! command -v sqlite3 &> /dev/null
then
    echo "错误: sqlite3 命令行工具未安装。请安装 sqlite3。"
    exit 1
fi

# 检查 .env 文件是否存在并加载 DB_PATH
if [ -f .env ]; then
    source .env
    if [ -n "$DB_PATH" ]; then
        echo "从 .env 文件加载 DB_PATH: $DB_PATH"
    else
        echo "警告: .env 文件中未找到 DB_PATH，使用默认值: $DB_PATH"
    fi
else
    echo "警告: .env 文件未找到，使用默认 DB_PATH: $DB_PATH"
fi

DB_DIR=$(dirname "$DB_PATH")

# 确保数据库目录存在
if [ ! -d "$DB_DIR" ]; then
    echo "创建数据库目录: $DB_DIR"
    mkdir -p "$DB_DIR"
fi

# 检查数据库文件是否存在
if [ -f "$DB_PATH" ]; then
    echo "数据库文件已存在: $DB_PATH"
    echo "跳过初始化，如果需要重新初始化，请手动删除数据库文件。"
else
    echo "数据库文件不存在，开始初始化: $DB_PATH"
    # 执行 SQL 脚本来创建表结构
    sqlite3 "$DB_PATH" < "$SCHEMA_FILE"
    if [ $? -eq 0 ]; then
        echo "SQLite 数据库初始化成功。"
    else
        echo "错误: SQLite 数据库初始化失败。"
        exit 1
    fi
fi

echo "初始化脚本执行完毕。"