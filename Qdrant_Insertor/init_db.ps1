# SQLite 数据库文件路径，默认为 ./data/app.db
$DB_PATH = "./data/app.db"
$SCHEMA_FILE = "./migrations/001_initial_schema.sql"

# 检查 sqlite3 是否安装
try {
    Get-Command sqlite3 -ErrorAction Stop | Out-Null
} catch {
    Write-Host "错误: sqlite3 命令行工具未安装。请安装 sqlite3。" -ForegroundColor Red
    exit 1
}

# 检查 .env 文件是否存在并加载 DB_PATH
$envFile = ".env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match "DB_PATH=(.*)") {
            $DB_PATH = $Matches[1]
            Write-Host "从 .env 文件加载 DB_PATH: $DB_PATH" -ForegroundColor Green
        }
    }
    if (-not $DB_PATH) {
        Write-Host "警告: .env 文件中未找到 DB_PATH，使用默认值: $DB_PATH" -ForegroundColor Yellow
    }
} else {
    Write-Host "警告: .env 文件未找到，使用默认 DB_PATH: $DB_PATH" -ForegroundColor Yellow
}

$DB_DIR = Split-Path $DB_PATH -Parent

# 确保数据库目录存在
if (-not (Test-Path $DB_DIR)) {
    Write-Host "创建数据库目录: $DB_DIR" -ForegroundColor Green
    New-Item -ItemType Directory -Path $DB_DIR | Out-Null
}

# 检查数据库文件是否存在
if (Test-Path $DB_PATH) {
    Write-Host "数据库文件已存在: $DB_PATH" -ForegroundColor Yellow
    Write-Host "跳过初始化，如果需要重新初始化，请手动删除数据库文件。" -ForegroundColor Yellow
} else {
    Write-Host "数据库文件不存在，开始初始化: $DB_PATH" -ForegroundColor Green
    # 执行 SQL 脚本来创建表结构
    try {
        Get-Content $SCHEMA_FILE | sqlite3 $DB_PATH
        if ($LASTEXITCODE -eq 0) {
            Write-Host "SQLite 数据库初始化成功。" -ForegroundColor Green
        } else {
            Write-Host "错误: SQLite 数据库初始化失败。sqlite3 退出码: $LASTEXITCODE" -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "错误: 执行 SQL 脚本时发生异常: $($_.Exception.Message)" -ForegroundColor Red
        exit 1
    }
}

Write-Host "初始化脚本执行完毕。" -ForegroundColor Green