import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError, ErrorCode } from '../api/contracts/error.js';

// 定义一个类型，用于扩展 Express 的 Request 接口
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
 * 创建一个 Express 中间件，用于根据 Zod Schema 验证请求数据。
 * 它会尝试验证 req.body, req.query, req.params。
 * 验证成功的数据将存储在 req.validated 中。
 * 如果验证失败，将抛出一个错误。
 *
 * @param schema Zod Schema 对象，包含 body, query, params 的可选 schema。
 * @returns Express 中间件函数。
 */
export const validate =
  (schema: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema }) =>
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
          AppError.createValidationError(
            { issues: validationErrors },
            `Validation failed for fields: ${validationErrors.map((e) => e.path).join(', ')}`,
          ),
        );
      }
      next(error);
    }
  };
