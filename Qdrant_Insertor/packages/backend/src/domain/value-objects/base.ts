/**
 * 值对象基础接口
 * 所有值对象都应该实现此接口
 */
export interface IValueObject<T> {
  /**
   * 获取值对象的原始值
   */
  getValue(): T;

  /**
   * 检查两个值对象是否相等
   */
  equals(other: IValueObject<T>): boolean;

  /**
   * 将值对象转换为字符串
   */
  toString(): string;
}

/**
 * 值对象基础抽象类
 * 提供值对象的通用实现
 */
export abstract class BaseValueObject<T> implements IValueObject<T> {
  protected readonly value: T;

  /**
   * 构造函数
   * @param value 值对象的原始值
   */
  protected constructor(value: T) {
    this.value = value;
  }

  /**
   * 获取值对象的原始值
   * @returns 值对象的原始值
   */
  getValue(): T {
    return this.value;
  }

  /**
   * 检查两个值对象是否相等
   * @param other 另一个值对象
   * @returns 是否相等
   */
  equals(other: IValueObject<T>): boolean {
    if (this === other) {
      return true;
    }

    if (!(other instanceof BaseValueObject)) {
      return false;
    }

    return this.isEqual(other.value);
  }

  /**
   * 将值对象转换为字符串
   * @returns 字符串表示
   */
  toString(): string {
    return String(this.value);
  }

  /**
   * 子类需要实现的相等性比较逻辑
   */
  protected abstract isEqual(otherValue: T): boolean;

  /**
   * 子类需要实现的验证逻辑
   */
  protected abstract validate(value: T): void;
}
