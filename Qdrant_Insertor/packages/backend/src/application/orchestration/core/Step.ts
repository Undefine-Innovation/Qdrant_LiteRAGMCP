/**
 * Step 执行上下文
 * 记录 Step 的输入、输出和错误信息
 */
export interface StepContext<I = unknown, O = unknown> {
  /**
   * Step 的输入数据
   */
  input: I;

  /**
   * Step 的输出数据（执行后设置）
   */
  output?: O;

  /**
   * 执行过程中发生的错误
   */
  error?: Error;

  /**
   * Step 执行是否成功
   */
  success: boolean;

  /**
   * 执行耗时（毫秒）
   */
  duration?: number;

  /**
   * 额外的元数据
   */
  metadata?: Record<string, unknown>;
}

/**
 * Step 接口
 * 定义管线中的每一步应该实现的契约
 */
export interface Step<I = unknown, O = unknown> {
  /**
   * Step 的唯一名称
   */
  readonly name: string;

  /**
   * 验证输入数据的合法性
   * @param input 待验证的输入
   * @throws 如果验证失败，抛出错误
   */
  validate(input: I): Promise<void>;

  /**
   * 执行 Step 的主逻辑
   * @param input 输入数据
   * @returns 输出数据
   * @throws 如果执行失败，抛出错误
   */
  run(input: I): Promise<O>;

  /**
   * 错误处理钩子
   * 当 run() 或 validate() 抛出异常时调用
   * @param context Step 执行上下文
   * @param error 捕获到的错误
   */
  onError(context: StepContext<I, O>, error: Error): Promise<void>;
}

/**
 * 管线执行结果
 */
export interface PipelineResult {
  /**
   * 执行成功
   */
  success: boolean;

  /**
   * 最终输出（最后一个 Step 的输出）
   */
  output?: unknown;

  /**
   * 所有 Step 的执行上下文
   */
  steps: Array<StepContext & { stepName: string }>;

  /**
   * 首次失败的 Step 名称
   */
  failedStep?: string;

  /**
   * 最终的错误信息
   */
  error?: Error;

  /**
   * 总执行耗时（毫秒）
   */
  totalDuration: number;
}
