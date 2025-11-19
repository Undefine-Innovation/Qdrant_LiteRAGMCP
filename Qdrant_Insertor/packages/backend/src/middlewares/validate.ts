import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError, ErrorCode } from '@api/contracts/Error.js';

// 定义一个类型，用于扩展 Express Request 接口
/**
 * 扩展的Express请求类型，包含验证后的数据
 */
export type ValidatedRequest<
  Body = unknown,
  Query = unknown,
  Params = unknown,
> = Request & {
  validated?: {
    body?: Body;
    query?: Query;
    params?: Params;
  };
};

/**
 * 创建一个Express中间件，用于根据 Zod Schema 验证请求数据
 * 它会尝试验证 req.body, req.query, req.params
 * 验证成功的数据将存储在req.validated 中
 * 如果验证失败，将抛出一个错误
 *
 * @param schema Zod Schema 对象，包含body, query, params 的可选schema
 * @param schema.body - 请求体schema
 * @param schema.query - 查询参数schema
 * @param schema.params - 路径参数schema
 * @param opts 额外配置
 * @param opts.statusCode 验证失败时返回的状态码
 * @returns Express 中间件函数
 */
export const validate =
  (
    schema: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema },
    opts?: { statusCode?: number },
  ) =>
  async (req: ValidatedRequest, res: Response, next: NextFunction) => {
    try {
      req.validated = {};

      if (schema.body) {
        req.validated.body = await schema.body.parseAsync(req.body);
      }

      if (schema.query) {
        req.validated.query = await schema.query.parseAsync(req.query);
      }

      if (schema.params) {
        req.validated.params = await schema.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        }));
        return next(
          new AppError(
            ErrorCode.VALIDATION_ERROR,
            `Validation failed for fields: ${validationErrors.map((e) => e.path).join(', ')}`,
            opts?.statusCode ?? 400,
            { issues: validationErrors },
          ),
        );
      }
      next(error);
    }
  };
