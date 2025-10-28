import { useState, useEffect } from 'react';
import { Document, Collection, PaginationParams } from '../types';
import { useApi } from '../hooks/useApi';
import { documentsApi, collectionsApi } from '../services/api';
import DocumentUpload from '../components/DocumentUpload';
import BatchDocumentUpload from '../components/BatchDocumentUpload';
import BatchDelete from '../components/BatchDelete';
import DocumentList from '../components/DocumentList';
import DocumentDetail from '../components/DocumentDetail';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';

/**
 * 文档管理页面组件
 * 用于上传、查看和管理文档
 */
const DocumentsPage = () => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showBatchUploadModal, setShowBatchUploadModal] = useState(false);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('');
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [paginationParams, setPaginationParams] = useState<PaginationParams>({
    page: 1,
    limit: 20,
    sort: 'created_at',
    order: 'desc',
  });

  // 获取文档列表
  const { state: documentsState, execute: loadDocuments } = useApi(() =>
    documentsApi.getDocuments({
      ...paginationParams,
      collectionId: selectedCollection || undefined,
    }),
  );

  // 获取集合列表
  const { state: collectionsState, execute: loadCollections } = useApi(() =>
    collectionsApi.getCollections(),
  );

  // 上传文档
  const handleUpload = async (files: FileList) => {
    if (files.length === 0) return;

    const file = files[0]; // 只处理第一个文件
    if (selectedCollection) {
      await documentsApi.uploadToCollection(selectedCollection, file);
    } else {
      await documentsApi.uploadDocument(file);
    }

    setShowUploadModal(false);
    loadDocuments();
  };

  // 删除文档
  const handleDeleteDocument = async (documentId: string) => {
    await documentsApi.deleteDocument(documentId);
    loadDocuments();
  };

  // 重试文档
  const handleRetryDocument = async (documentId: string) => {
    await documentsApi.resyncDocument(documentId);
    loadDocuments();
  };

  // 查看文档详情
  const handleViewDocument = (documentId: string) => {
    setSelectedDocumentId(documentId);
    setShowDetailModal(true);
  };

  // 刷新数据
  const handleRefresh = () => {
    loadDocuments();
  };

  // 处理页码变化
  const handlePageChange = (page: number) => {
    setPaginationParams(prev => ({ ...prev, page }));
  };

  // 处理每页数量变化
  const handleLimitChange = (limit: number) => {
    setPaginationParams(prev => ({ ...prev, limit, page: 1 }));
  };

  // 处理集合变化
  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollection(collectionId);
    setPaginationParams(prev => ({ ...prev, page: 1 }));
  };

  // 当分页参数或集合变化时重新加载数据
  useEffect(() => {
    loadDocuments();
  }, [paginationParams, selectedCollection]);

  // 初始加载
  useEffect(() => {
    loadDocuments();
    loadCollections();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-secondary-800">文档管理</h1>
        <div className="space-x-2">
          <select
            value={selectedCollection}
            onChange={e => handleCollectionChange(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">选择集合</option>
            {(collectionsState.data as { data: Collection[] })?.data?.map(
              (collection: Collection) => (
                <option
                  key={collection.collectionId}
                  value={collection.collectionId}
                >
                  {collection.name}
                </option>
              ),
            )}
          </select>
          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary"
          >
            上传文档
          </button>
          <button
            onClick={() => setShowBatchUploadModal(true)}
            className="btn btn-secondary"
          >
            批量上传
          </button>
          <button
            onClick={() => setShowBatchDeleteModal(true)}
            className="btn btn-danger"
          >
            批量删除
          </button>
        </div>
      </div>

      <DocumentList
        documents={
          (documentsState.data as { data: Document[] })?.data ||
          (documentsState.data as unknown as Document[])
        }
        loading={documentsState.loading}
        error={documentsState.error}
        onRefresh={handleRefresh}
        onDelete={handleDeleteDocument}
        onRetry={handleRetryDocument}
        onView={handleViewDocument}
      />

      {/* 分页组件 - 仅在有分页数据时显示 */}
      {(documentsState.data as { pagination: { page: number; totalPages: number; total: number; limit: number } })?.pagination &&
        (documentsState.data as { data: Document[] })?.data?.length > 0 && (
          <Pagination
            currentPage={(documentsState.data as { pagination: { page: number } }).pagination.page}
            totalPages={(documentsState.data as { pagination: { totalPages: number } }).pagination.totalPages}
            total={(documentsState.data as { pagination: { total: number } }).pagination.total}
            limit={(documentsState.data as { pagination: { limit: number } }).pagination.limit}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            loading={documentsState.loading}
          />
        )}

      {/* 上传模态框 */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="上传文档"
        size="lg"
      >
        <DocumentUpload
          onUpload={handleUpload}
          multiple={true}
          accept=".txt,.md,.pdf,.doc,.docx"
        />
      </Modal>

      {/* 批量上传模态框 */}
      <Modal
        isOpen={showBatchUploadModal}
        onClose={() => setShowBatchUploadModal(false)}
        title="批量上传文档"
        size="xl"
      >
        <BatchDocumentUpload
          collectionId={selectedCollection}
          onComplete={() => {
            setShowBatchUploadModal(false);
            loadDocuments();
          }}
        />
      </Modal>

      {/* 批量删除模态框 */}
      <Modal
        isOpen={showBatchDeleteModal}
        onClose={() => setShowBatchDeleteModal(false)}
        title="批量删除"
        size="xl"
      >
        <BatchDelete
          collectionId={selectedCollection}
          onComplete={() => {
            setShowBatchDeleteModal(false);
            loadDocuments();
          }}
        />
      </Modal>

      {/* 详情模态框 */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="文档详情"
        size="xl"
      >
        <DocumentDetail
          documentId={selectedDocumentId}
          onClose={() => setShowDetailModal(false)}
        />
      </Modal>
    </div>
  );
};

export default DocumentsPage;
