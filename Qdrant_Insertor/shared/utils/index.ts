/**
 * 共享工具函数
 * 提供前后端共用的工具函数
 */

/**
 * 格式化日期为ISO字符串
 * @param date - 日期对象
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date): string {
    return date.toISOString();
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的文件大小字符串
 */
export function formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    const threshold = 1024;

    if (bytes < threshold) {
        return bytes + " B";
    }

    let i = 0;
    let size = bytes;

    while (size >= threshold && i < units.length - 1) {
        size /= threshold;
        i++;
    }

    return `${Math.round(size * 100) / 100} ${units[i]}`;
}

/**
 * 验证邮箱格式
 * @param email - 邮箱字符串
 * @returns 是否为有效邮箱
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * 生成随机ID
 * @param length - ID长度，默认为8
 * @returns 随机ID字符串
 */
export function generateId(length: number = 8): string {
    const chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 深度克隆对象
 * @param obj - 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }

    return JSON.parse(JSON.stringify(obj));
}

/**
 * 防抖函数
 * @param func - 要防抖的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 防抖后的函数
 */
export function debounce(
    func: (...args: any[]) => any,
    delay: number,
): (...args: any[]) => any {
    let timeoutId: NodeJS.Timeout;

    return (...args: any[]) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

/**
 * 节流函数
 * @param func - 要节流的函数
 * @param delay - 延迟时间（毫秒）
 * @returns 节流后的函数
 */
export function throttle(
    func: (...args: any[]) => any,
    delay: number,
): (...args: any[]) => any {
    let lastCallTime = 0;
    let timeoutId: NodeJS.Timeout;

    return (...args: any[]) => {
        const now = Date.now();
        if (now - lastCallTime >= delay) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func(...args);
                lastCallTime = now;
            }, delay);
        } else {
            func(...args);
            lastCallTime = now;
        }
    };
}
