import { Step, StepContext, PipelineResult } from './Step.js';
import { Logger } from '@logging/logger.js';

/**
 * 管线编排器
 * 负责顺序执行一系列 Step，每个 Step 有三个钩子：validate、run、onError
 */
export class Pipeline {
  private steps: Step[] = [];

  /**
   * 创建 Pipeline 实例
   * @param logger 日志记录器
   */
  constructor(private readonly logger: Logger) {}

  /**
   * 向管线添加一个 Step
   * @param step 要添加的 Step
   * @returns 返回 this 以支持链式调用
   */
  addStep(step: Step): this {
    this.steps.push(step);
    this.logger.debug(`Step '${step.name}' 已添加到管线`);
    return this;
  }

  /**
   * 执行管线
   * @param initialInput 初始输入数据
   * @returns 管线执行结果
   */
  async execute(initialInput: unknown): Promise<PipelineResult> {
    const startTime = Date.now();
    const stepContexts: Array<StepContext & { stepName: string }> = [];
    let currentOutput = initialInput;
    let failedStep: string | undefined;
    let finalError: Error | undefined;

    this.logger.info(`开始执行管线，共 ${this.steps.length} 个 Step`);

    for (const step of this.steps) {
      const stepStartTime = Date.now();
      const context: StepContext = {
        input: currentOutput,
        success: false,
      };

      try {
        // 1. 验证输入
        this.logger.debug(`Step '${step.name}': 验证输入...`);
        await step.validate(currentOutput);

        // 2. 执行 Step
        this.logger.debug(`Step '${step.name}': 执行...`);
        context.output = await step.run(currentOutput);
        context.success = true;
        currentOutput = context.output;

        // 3. 记录执行时间
        context.duration = Date.now() - stepStartTime;
        this.logger.info(`Step '${step.name}' 完成`, {
          duration: context.duration,
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        context.error = err;
        context.duration = Date.now() - stepStartTime;
        failedStep = step.name;
        finalError = err;

        this.logger.warn(`Step '${step.name}' 失败: ${err.message}`, {
          duration: context.duration,
        });

        // 调用错误钩子
        try {
          await step.onError(context, err);
        } catch (hookError) {
          this.logger.error(
            `Step '${step.name}' 的 onError 钩子抛出异常: ${hookError}`,
          );
        }

        // 错误不继续传播，直接返回失败结果
        break;
      }

      stepContexts.push({
        stepName: step.name,
        ...context,
      });
    }

    const totalDuration = Date.now() - startTime;
    const result: PipelineResult = {
      success: failedStep === undefined,
      output: currentOutput,
      steps: stepContexts,
      failedStep,
      error: finalError,
      totalDuration,
    };

    if (result.success) {
      this.logger.info(`管线执行成功`, {
        totalDuration,
        stepCount: this.steps.length,
      });
    } else {
      this.logger.error(`管线执行失败: ${failedStep}`, {
        totalDuration,
        failedStep,
        error: finalError?.message,
      });
    }

    return result;
  }

  /**
   * 获取管线中所有 Step 的名称
   * @returns Step 名称数组
   */
  getStepNames(): string[] {
    return this.steps.map((step) => step.name);
  }

  /**
   * 清空管线中的所有 Step
   */
  clear(): void {
    this.steps = [];
    this.logger.debug('管线已清空');
  }
}
