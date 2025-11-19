import { GraphQLClient } from 'graphql-request';
// import gql from 'graphql-tag'; // 暂时注释掉未使用的导入
// import { RequestOptions } from 'graphql-request'; // 暂时注释掉未使用的导入
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never;
    };
// type GraphQLClientRequestHeaders = RequestOptions['requestHeaders']; // 暂时注释掉未使用的类型
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Upload: { input: File; output: File };
};

export type Collection = {
  collectionId: Scalars['String']['output'];
  createdAt?: Maybe<Scalars['Int']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type CollectionCreate = {
  collectionId: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
};

export type Document = {
  collectionId?: Maybe<Scalars['String']['output']>;
  content?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['Int']['output']>;
  docId: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name?: Maybe<Scalars['String']['output']>;
  updatedAt?: Maybe<Scalars['Int']['output']>;
};

export type DocumentPagination = {
  data: Array<Document>;
  pagination: PaginationMeta;
};

export type DocumentResponse = {
  collectionId?: Maybe<Scalars['String']['output']>;
  docId: Scalars['String']['output'];
  name?: Maybe<Scalars['String']['output']>;
};

export type Mutation = {
  createCollection: Collection;
  deleteDocument: Scalars['Boolean']['output'];
  resyncDocument: DocumentResponse;
  uploadDocumentToCollection: DocumentResponse;
};

export type MutationCreateCollectionArgs = {
  input: CollectionCreate;
};

export type MutationDeleteDocumentArgs = {
  docId: Scalars['ID']['input'];
};

export type MutationResyncDocumentArgs = {
  docId: Scalars['ID']['input'];
};

export type MutationUploadDocumentToCollectionArgs = {
  collectionId: Scalars['ID']['input'];
  file: Scalars['Upload']['input'];
};

export type PaginationMeta = {
  hasNext?: Maybe<Scalars['Boolean']['output']>;
  hasPrev?: Maybe<Scalars['Boolean']['output']>;
  limit?: Maybe<Scalars['Int']['output']>;
  page?: Maybe<Scalars['Int']['output']>;
  total?: Maybe<Scalars['Int']['output']>;
  totalPages?: Maybe<Scalars['Int']['output']>;
};

export type Query = {
  collection?: Maybe<Collection>;
  document?: Maybe<Document>;
  documents?: Maybe<DocumentPagination>;
};

export type QueryCollectionArgs = {
  collectionId: Scalars['ID']['input'];
};

export type QueryDocumentArgs = {
  docId: Scalars['ID']['input'];
};

export type QueryDocumentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  order?: InputMaybe<Scalars['String']['input']>;
  page?: InputMaybe<Scalars['Int']['input']>;
  sort?: InputMaybe<Scalars['String']['input']>;
};

/**
 * SDK函数包装器类型
 * @template T - 返回值类型
 * @param action - 要执行的操作函数
 * @returns Promise包装的结果
 */
export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
) => Promise<T>;

/**
 * 默认的SDK函数包装器
 * @param action - 要执行的操作函数
 * @returns 执行操作的结果
 */
const defaultWrapper: SdkFunctionWrapper = (action) => action();

/**
 * 获取GraphQL SDK
 * @param client - GraphQL客户端实例
 * @param withWrapper - 函数包装器，默认使用defaultWrapper
 * @returns SDK对象
 */
export function getSdk(
  client: GraphQLClient,
  withWrapper: SdkFunctionWrapper = defaultWrapper,
) {
  // 使用withWrapper参数避免未使用变量警告
  void withWrapper;
  return {};
}
export type Sdk = ReturnType<typeof getSdk>;
