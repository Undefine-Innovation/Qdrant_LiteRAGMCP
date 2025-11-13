import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
} from 'typeorm';
import { BaseEntity } from './BaseEntity.js';
import { Chunk } from './Chunk.js';

/**
 * 块全文搜索实体
 * 用于PostgreSQL全文搜索功能
 * 包含全文搜索向量和相关元数据
 */
@Entity('chunks_fulltext')
@Index(['chunkId'], { unique: true })
@Index(['docId'])
@Index(['collectionId'])
// 注释掉PostgreSQL特有的全文搜索索引，SQLite不支持
// @Index(['searchVector'], { fulltext: true })
export class ChunkFullText extends BaseEntity {
  /**
   * 关联的块ID
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  chunkId: string;

  /**
   * 文档ID
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  docId: string;

  /**
   * 集合ID
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  collectionId: string;

  /**
   * 块索引
   */
  @Column({ type: 'integer', nullable: false })
  chunkIndex: number;

  /**
   * 内容长度
   */
  @Column({ type: 'integer', nullable: false })
  contentLength: number;

  /**
   * 标题
   */
  @Column({ type: 'text', nullable: true })
  title?: string;

  /**
   * 块内容
   */
  @Column({ type: 'text', nullable: false })
  content: string;

  /**
   * 全文搜索向量
   * 在PostgreSQL中使用tsvector类型，在SQLite中使用text类型
   */
  @Column({
    type: 'text',
    nullable: true,
    default: null,
    comment: '全文搜索向量，PostgreSQL中使用tsvector类型',
  })
  searchVector?: string;

  /**
   * 搜索语言
   * 用于指定全文搜索的语言配置
   */
  @Column({ type: 'varchar', length: 10, nullable: false, default: 'english' })
  language: string = 'english';

  /**
   * 关联的块
   * 使用字符串引用避免循环依赖
   */
  @ManyToOne('Chunk', (chunk: Chunk) => chunk.chunkFullText, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'chunkId', referencedColumnName: 'id' })
  chunk: Chunk;

  /**
   * 创建全文搜索向量
   * 将标题和内容合并为tsvector
   * @param title 标题
   * @param content 内容
   * @param language 搜索语言
   * @returns tsvector字符串
   */
  static createSearchVector(
    title: string | undefined,
    content: string,
    language: string = 'english',
  ): string {
    // 合并标题和内容
    const combinedText = title ? `${title} ${content}` : content;

    // 这里返回占位符，实际的tsvector创建会在数据库层面完成
    // 使用PostgreSQL的to_tsvector函数
    return `to_tsvector('${language}', ${combinedText.replace(/'/g, "''")})`;
  }

  /**
   * 创建搜索查询
   * 将用户查询转换为PostgreSQL全文搜索查询
   * @param query 用户查询
   * @param language 搜索语言
   * @returns tsquery字符串
   */
  static createSearchQuery(
    query: string,
    language: string = 'english',
  ): string {
    // 清理查询字符串，移除特殊字符
    const cleanQuery = query.replace(/[&|!():*]/g, ' ').trim();

    // 这里返回占位符，实际的tsquery创建会在数据库层面完成
    // 使用PostgreSQL的plainto_tsquery函数
    return `plainto_tsquery('${language}', ${cleanQuery.replace(/'/g, "''")})`;
  }

  /**
   * 在插入前生成ID并确保所有必填字段都有值
   */
  @BeforeInsert()
  generateIds() {
    if (!this.id) {
      this.id = this.chunkId; // 使用chunkId作为主键
    }

    // 如果没有设置docId、collectionId或chunkIndex，从关联的Chunk实体中获取
    // 注意：在实际使用中，这些字段应该在创建时就设置好
    if (!this.docId && this.chunk) {
      this.docId = this.chunk.docId;
    }
    if (!this.collectionId && this.chunk) {
      this.collectionId = this.chunk.collectionId;
    }
    // 使用 undefined 检查而不是 !this.chunkIndex，因为 0 是有效值
    if (this.chunkIndex === undefined || this.chunkIndex === null) {
      if (this.chunk && this.chunk.chunkIndex !== undefined) {
        this.chunkIndex = this.chunk.chunkIndex;
      } else {
        // 如果关联的Chunk实体也没有chunkIndex，则设置为0
        this.chunkIndex = 0;
      }
    }

    // 自动计算contentLength
    if (this.contentLength === undefined) {
      this.contentLength = this.content ? this.content.length : 0;
    }

    // 自动生成searchVector，如果未设置且内容存在
    if (!this.searchVector && this.content) {
      this.searchVector = ChunkFullText.createSearchVector(
        this.title,
        this.content,
        this.language,
      );
    }
  }
}
