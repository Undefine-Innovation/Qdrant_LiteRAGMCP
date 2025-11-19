/**
 * 统一的测试断言库
 * 提供常用的测试断言函数，减少测试代码重复
 */

import { DataSource } from 'typeorm';
import { Collection } from '@infrastructure/database/entities/Collection.js';
import { Doc } from '@infrastructure/database/entities/Doc.js';
import { Chunk } from '@infrastructure/database/entities/Chunk.js';
import { ChunkMeta } from '@infrastructure/database/entities/ChunkMeta.js';
import { SystemMetrics } from '@infrastructure/database/entities/SystemMetrics.js';
import { AlertRules } from '@infrastructure/database/entities/AlertRules.js';
import { AlertHistory } from '@infrastructure/database/entities/AlertHistory.js';
import { SystemHealth } from '@infrastructure/database/entities/SystemHealth.js';
import { ScrapeResults } from '@infrastructure/database/entities/ScrapeResults.js';
import { Event } from '@infrastructure/database/entities/Event.js';
import { CollectionId, DocId, PointId } from '@domain/entities/types.js';

/**
 * 数据库断言工具
 */
export class DatabaseAssertions {
  /**
   * 断言集合存在
   */
  static async assertCollectionExists(
    dataSource: DataSource,
    collectionId: CollectionId,
  ): Promise<Collection> {
    const repository = dataSource.getRepository(Collection);
    const collection = await repository.findOne({
      where: { id: collectionId },
    });

    if (!collection) {
      throw new Error(`Collection with id ${collectionId} not found`);
    }

    return collection;
  }

  /**
   * 断言集合不存在
   */
  static async assertCollectionNotExists(
    dataSource: DataSource,
    collectionId: CollectionId,
  ): Promise<void> {
    const repository = dataSource.getRepository(Collection);
    const collection = await repository.findOne({
      where: { id: collectionId },
    });

    if (collection) {
      throw new Error(`Collection with id ${collectionId} should not exist`);
    }
  }

  /**
   * 断言文档存在
   */
  static async assertDocExists(
    dataSource: DataSource,
    docId: DocId,
  ): Promise<Doc> {
    const repository = dataSource.getRepository(Doc);
    const doc = await repository.findOne({ where: { docId } });

    if (!doc) {
      throw new Error(`Document with id ${docId} not found`);
    }

    return doc;
  }

  /**
   * 断言文档不存在
   */
  static async assertDocNotExists(
    dataSource: DataSource,
    docId: DocId,
  ): Promise<void> {
    const repository = dataSource.getRepository(Doc);
    const doc = await repository.findOne({ where: { docId } });

    if (doc) {
      throw new Error(`Document with id ${docId} should not exist`);
    }
  }

  /**
   * 断言块存在
   */
  static async assertChunkExists(
    dataSource: DataSource,
    pointId: PointId,
  ): Promise<Chunk> {
    const repository = dataSource.getRepository(Chunk);
    const chunk = await repository.findOne({ where: { pointId } });

    if (!chunk) {
      throw new Error(`Chunk with pointId ${pointId} not found`);
    }

    return chunk;
  }

  /**
   * 断言块不存在
   */
  static async assertChunkNotExists(
    dataSource: DataSource,
    pointId: PointId,
  ): Promise<void> {
    const repository = dataSource.getRepository(Chunk);
    const chunk = await repository.findOne({ where: { pointId } });

    if (chunk) {
      throw new Error(`Chunk with pointId ${pointId} should not exist`);
    }
  }

  /**
   * 断言记录数量
   */
  static async assertRecordCount<T>(
    dataSource: DataSource,
    entityClass: new () => T,
    expectedCount: number,
    whereCondition: object = {},
  ): Promise<void> {
    const repository = dataSource.getRepository(entityClass);
    const count = await repository.count({ where: whereCondition });

    if (count !== expectedCount) {
      const entityName = entityClass.name;
      throw new Error(
        `Expected ${expectedCount} records in ${entityName}, but found ${count}`,
      );
    }
  }

  /**
   * 断言实体字段值
   */
  static async assertEntityField<T>(
    dataSource: DataSource,
    entityClass: new () => T,
    id: string,
    fieldName: keyof T,
    expectedValue: any,
  ): Promise<void> {
    const repository = dataSource.getRepository(entityClass);
    const entity = await repository.findOne({ where: { id } as any });

    if (!entity) {
      const entityName = entityClass.name;
      throw new Error(`${entityName} with id ${id} not found`);
    }

    const actualValue = (entity as any)[fieldName];

    if (actualValue !== expectedValue) {
      const entityName = entityClass.name;
      throw new Error(
        `Expected ${fieldName} to be ${expectedValue} in ${entityName} ${id}, but found ${actualValue}`,
      );
    }
  }

  /**
   * 断言两个数组相等
   */
  static assertArraysEqual<T>(
    actual: T[],
    expected: T[],
    message?: string,
  ): void {
    if (actual.length !== expected.length) {
      throw new Error(
        message ||
          `Arrays have different lengths: expected ${expected.length}, got ${actual.length}`,
      );
    }

    for (let i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) {
        throw new Error(
          message ||
            `Arrays differ at index ${i}: expected ${expected[i]}, got ${actual[i]}`,
        );
      }
    }
  }

  /**
   * 断言两个数组包含相同的元素（顺序不重要）
   */
  static assertArraysContainSameElements<T>(
    actual: T[],
    expected: T[],
    message?: string,
  ): void {
    if (actual.length !== expected.length) {
      throw new Error(
        message ||
          `Arrays have different lengths: expected ${expected.length}, got ${actual.length}`,
      );
    }

    const sortedActual = [...actual].sort();
    const sortedExpected = [...expected].sort();

    for (let i = 0; i < sortedActual.length; i++) {
      if (sortedActual[i] !== sortedExpected[i]) {
        throw new Error(
          message ||
            `Arrays contain different elements: expected [${sortedExpected.join(', ')}], got [${sortedActual.join(', ')}]`,
        );
      }
    }
  }

  /**
   * 断言数组为空
   */
  static assertEmptyArray<T>(array: T[], message?: string): void {
    if (array.length !== 0) {
      throw new Error(
        message ||
          `Expected array to be empty, but has ${array.length} elements`,
      );
    }
  }

  /**
   * 断言数组不为空
   */
  static assertNotEmptyArray<T>(array: T[], message?: string): void {
    if (array.length === 0) {
      throw new Error(
        message || 'Expected array to not be empty, but it is empty',
      );
    }
  }

  /**
   * 断言两个实体相等
   */
  static assertEntitiesEqual<T>(
    actual: T | null,
    expected: T | null,
    message?: string,
  ): void {
    if (actual === null && expected === null) {
      return;
    }

    if (actual === null && expected !== null) {
      throw new Error(
        message ||
          `Expected entity to be ${JSON.stringify(expected)}, but got null`,
      );
    }

    if (actual !== null && expected === null) {
      throw new Error(
        message ||
          `Expected entity to be null, but got ${JSON.stringify(actual)}`,
      );
    }

    // 比较实体的所有属性
    const actualKeys = Object.keys(actual as any);
    const expectedKeys = Object.keys(expected as any);

    if (actualKeys.length !== expectedKeys.length) {
      throw new Error(
        message ||
          `Entities have different number of properties: expected ${expectedKeys.length}, got ${actualKeys.length}`,
      );
    }

    for (const key of actualKeys) {
      const actualValue = (actual as any)[key];
      const expectedValue = (expected as any)[key];

      if (actualValue !== expectedValue) {
        throw new Error(
          message ||
            `Entity property ${key} differs: expected ${expectedValue}, got ${actualValue}`,
        );
      }
    }
  }

  /**
   * 断言实体列表包含特定ID的实体
   */
  static assertEntityListContainsId<T>(
    entities: T[],
    idField: string,
    expectedId: string,
    message?: string,
  ): void {
    const found = entities.some(
      (entity) => (entity as any)[idField] === expectedId,
    );

    if (!found) {
      throw new Error(
        message ||
          `Entity list does not contain entity with ${idField} = ${expectedId}`,
      );
    }
  }

  /**
   * 断言实体列表不包含特定ID的实体
   */
  static assertEntityListDoesNotContainId<T>(
    entities: T[],
    idField: string,
    unexpectedId: string,
    message?: string,
  ): void {
    const found = entities.some(
      (entity) => (entity as any)[idField] === unexpectedId,
    );

    if (found) {
      throw new Error(
        message ||
          `Entity list should not contain entity with ${idField} = ${unexpectedId}`,
      );
    }
  }
}

/**
 * API响应断言工具
 */
export class ApiAssertions {
  /**
   * 断言成功响应
   */
  static assertSuccessResponse(response: any, expectedData?: any): void {
    if (response.success !== true) {
      throw new Error(
        `Expected success response, but got: ${JSON.stringify(response)}`,
      );
    }

    if (expectedData !== undefined) {
      if (JSON.stringify(response.data) !== JSON.stringify(expectedData)) {
        throw new Error(
          `Expected response data to be ${JSON.stringify(expectedData)}, but got ${JSON.stringify(response.data)}`,
        );
      }
    }
  }

  /**
   * 断言错误响应
   */
  static assertErrorResponse(response: any, expectedError?: string): void {
    if (response.success !== false) {
      throw new Error(
        `Expected error response, but got: ${JSON.stringify(response)}`,
      );
    }

    if (expectedError !== undefined) {
      if (!response.error.includes(expectedError)) {
        throw new Error(
          `Expected error message to contain "${expectedError}", but got "${response.error}"`,
        );
      }
    }
  }

  /**
   * 断言分页响应
   */
  static assertPaginatedResponse(
    response: any,
    expectedDataCount?: number,
    expectedPagination?: any,
  ): void {
    this.assertSuccessResponse(response);

    if (!response.pagination) {
      throw new Error('Expected pagination in response, but not found');
    }

    if (expectedDataCount !== undefined) {
      if (response.data.length !== expectedDataCount) {
        throw new Error(
          `Expected ${expectedDataCount} items in response data, but got ${response.data.length}`,
        );
      }
    }

    if (expectedPagination !== undefined) {
      for (const [key, value] of Object.entries(expectedPagination)) {
        if (response.pagination[key] !== value) {
          throw new Error(
            `Expected pagination.${key} to be ${value}, but got ${response.pagination[key]}`,
          );
        }
      }
    }
  }

  /**
   * 断言状态码
   */
  static assertStatusCode(response: any, expectedStatusCode: number): void {
    if (response.statusCode !== expectedStatusCode) {
      throw new Error(
        `Expected status code ${expectedStatusCode}, but got ${response.statusCode}`,
      );
    }
  }
}

/**
 * 通用断言工具
 */
export class CommonAssertions {
  /**
   * 断言数组包含特定元素
   */
  static assertArrayContains<T>(
    array: T[],
    element: T,
    message?: string,
  ): void {
    if (!array.includes(element)) {
      throw new Error(
        message ||
          `Array does not contain expected element: ${JSON.stringify(element)}`,
      );
    }
  }

  /**
   * 断言数组不包含特定元素
   */
  static assertArrayDoesNotContain<T>(
    array: T[],
    element: T,
    message?: string,
  ): void {
    if (array.includes(element)) {
      throw new Error(
        message ||
          `Array should not contain element: ${JSON.stringify(element)}`,
      );
    }
  }

  /**
   * 断言对象包含特定属性
   */
  static assertObjectContainsProperty(
    obj: object,
    propertyName: string,
    message?: string,
  ): void {
    if (!(propertyName in obj)) {
      throw new Error(
        message || `Object does not contain property: ${propertyName}`,
      );
    }
  }

  /**
   * 断言对象不包含特定属性
   */
  static assertObjectDoesNotContainProperty(
    obj: object,
    propertyName: string,
    message?: string,
  ): void {
    if (propertyName in obj) {
      throw new Error(
        message || `Object should not contain property: ${propertyName}`,
      );
    }
  }

  /**
   * 断言字符串匹配正则表达式
   */
  static assertStringMatchesRegex(
    str: string,
    regex: RegExp,
    message?: string,
  ): void {
    if (!regex.test(str)) {
      throw new Error(
        message || `String "${str}" does not match regex ${regex}`,
      );
    }
  }

  /**
   * 断言数字在范围内
   */
  static assertNumberInRange(
    num: number,
    min: number,
    max: number,
    message?: string,
  ): void {
    if (num < min || num > max) {
      throw new Error(
        message || `Number ${num} is not in range [${min}, ${max}]`,
      );
    }
  }

  /**
   * 断言时间戳在合理范围内
   */
  static assertTimestampInRange(
    timestamp: number,
    rangeStart: number,
    rangeEnd: number,
    fieldName: string = 'timestamp',
  ): void {
    if (timestamp < rangeStart || timestamp > rangeEnd) {
      throw new Error(
        `${fieldName} ${timestamp} is not in expected range ${rangeStart} - ${rangeEnd}`,
      );
    }
  }

  /**
   * 断言函数被调用
   */
  static assertFunctionCalled(
    mockFn: jest.Mock,
    expectedCallCount: number = 1,
    message?: string,
  ): void {
    if (mockFn.calls.length !== expectedCallCount) {
      throw new Error(
        message ||
          `Expected function to be called ${expectedCallCount} time(s), but was called ${mockFn.calls.length} time(s)`,
      );
    }
  }

  /**
   * 断言函数未被调用
   */
  static assertFunctionNotCalled(mockFn: jest.Mock, message?: string): void {
    if (mockFn.calls.length > 0) {
      throw new Error(
        message ||
          `Expected function not to be called, but was called ${mockFn.calls.length} time(s)`,
      );
    }
  }

  /**
   * 断言函数被调用时带有特定参数
   */
  static assertFunctionCalledWith(
    mockFn: jest.Mock,
    expectedArgs: any[],
    callIndex: number = 0,
    message?: string,
  ): void {
    if (mockFn.calls.length <= callIndex) {
      throw new Error(
        message ||
          `Expected function to be called at least ${callIndex + 1} time(s), but was called ${mockFn.calls.length} time(s)`,
      );
    }

    const actualArgs = mockFn.calls[callIndex];
    if (JSON.stringify(actualArgs) !== JSON.stringify(expectedArgs)) {
      throw new Error(
        message ||
          `Expected function to be called with ${JSON.stringify(expectedArgs)}, but was called with ${JSON.stringify(actualArgs)}`,
      );
    }
  }
}

/**
 * 业务逻辑断言工具
 */
export class BusinessAssertions {
  /**
   * 断言集合中的文档数量
   */
  static async assertCollectionDocCount(
    dataSource: DataSource,
    collectionId: CollectionId,
    expectedCount: number,
  ): Promise<void> {
    const repository = dataSource.getRepository(Doc);
    const count = await repository.count({ where: { collectionId } });

    if (count !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} documents in collection ${collectionId}, but found ${count}`,
      );
    }
  }

  /**
   * 断言文档中的块数量
   */
  static async assertDocChunkCount(
    dataSource: DataSource,
    docId: DocId,
    expectedCount: number,
  ): Promise<void> {
    const repository = dataSource.getRepository(Chunk);
    const count = await repository.count({ where: { docId } });

    if (count !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} chunks in document ${docId}, but found ${count}`,
      );
    }
  }

  /**
   * 断言系统指标存在
   */
  static async assertSystemMetricsExists(
    dataSource: DataSource,
    metricName: string,
  ): Promise<SystemMetrics> {
    const repository = dataSource.getRepository(SystemMetrics);
    const metric = await repository.findOne({
      where: { metric_name: metricName },
    });

    if (!metric) {
      throw new Error(`System metric ${metricName} not found`);
    }

    return metric;
  }

  /**
   * 断言告警规则存在
   */
  static async assertAlertRuleExists(
    dataSource: DataSource,
    ruleName: string,
  ): Promise<AlertRules> {
    const repository = dataSource.getRepository(AlertRules);
    const rule = await repository.findOne({ where: { name: ruleName } });

    if (!rule) {
      throw new Error(`Alert rule ${ruleName} not found`);
    }

    return rule;
  }

  /**
   * 断言系统健康状态
   */
  static async assertSystemHealthStatus(
    dataSource: DataSource,
    component: string,
    expectedStatus: string,
  ): Promise<void> {
    const repository = dataSource.getRepository(SystemHealth);
    const health = await repository.findOne({ where: { component } });

    if (!health) {
      throw new Error(`System health for component ${component} not found`);
    }

    if (health.status !== expectedStatus) {
      throw new Error(
        `Expected health status ${expectedStatus} for component ${component}, but found ${health.status}`,
      );
    }
  }
}

// 导出所有断言类，方便测试文件使用
export {
  DatabaseAssertions as DB,
  ApiAssertions as API,
  CommonAssertions as Common,
  BusinessAssertions as Business,
};
