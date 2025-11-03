import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { scrapeApiService } from '../services/scrape-api';
import { collectionsApi } from '../services/collections-api';
import type { Collection } from '../types';
import type { ScrapeResultItem } from '../types/scrape';

const ScrapeReviewPage: React.FC = () => {
  const [results, setResults] = useState<ScrapeResultItem[]>([]);
  const [groups, setGroups] = useState<Array<{
    taskId: string;
    total: number;
    pending: number;
    imported: number;
    deleted: number;
    first_at: number;
    last_at: number;
  }>>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(0);
  const limit = 30;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<ScrapeResultItem | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  // 每条结果自定义导入目标集合（为空则使用全局selectedCollectionId）
  const [itemCollection, setItemCollection] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, cols, grp] = await Promise.all([
        scrapeApiService.getScrapeResults({ status: 'PENDING', taskId: activeTaskId, limit, offset: page * limit, includeContent: false }),
        collectionsApi.getCollections(),
        scrapeApiService.getScrapeGroups({ limit: 50 }),
      ]);
      const list = Array.isArray((cols as any)) ? (cols as any) : (cols as any).data;
      setCollections(list || []);
      setResults(res.items || []);
      setGroups(grp.groups || []);
      if (!selectedCollectionId && (list?.length ?? 0) > 0) {
        setSelectedCollectionId(list[0].collectionId);
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [activeTaskId, page]);

  const onImport = async (id: string) => {
    const targetCollectionId = itemCollection[id] || selectedCollectionId;
    if (!targetCollectionId) {
      alert('请先为该条选择目标集合，或在顶部选择默认集合');
      return;
    }
    setImportingId(id);
    try {
      const resp = await scrapeApiService.importScrapeResult(id, {
        collectionId: targetCollectionId,
      });
      if (!resp.success) {
        alert(`导入失败: ${resp.error || '未知错误'}`);
      } else {
        // 重新加载列表
        await load();
      }
    } catch (e: any) {
      alert(`导入失败: ${e?.message || '未知错误'}`);
    } finally {
      setImportingId(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('确定要删除该抓取结果吗？')) return;
    setDeletingId(id);
    try {
      const resp = await scrapeApiService.deleteScrapeResult(id);
      if (!resp.success) {
        alert('删除失败');
      } else {
        await load();
        setSelected((prev) => {
          const cp = { ...prev };
          delete cp[id];
          return cp;
        });
      }
    } catch (e: any) {
      alert(`删除失败: ${e?.message || '未知错误'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const onImportSelected = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!ids.length) return alert('请先选择要导入的结果');
    setImportingId('batch');
    try {
      for (const id of ids) {
        const cid = itemCollection[id] || selectedCollectionId;
        if (!cid) {
          console.warn('跳过：未为该条选择集合且未设置全局集合', id);
          continue;
        }
        const resp = await scrapeApiService.importScrapeResult(id, { collectionId: cid });
        if (!resp.success) {
          console.warn('批量导入失败', id, resp.error);
        }
      }
      await load();
      setSelected({});
    } finally {
      setImportingId(null);
    }
  };

  const onDeleteSelected = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!ids.length) return alert('请先选择要删除的结果');
    if (!confirm(`确定删除选中的 ${ids.length} 条结果吗？`)) return;
    setDeletingId('batch');
    try {
      for (const id of ids) {
        await scrapeApiService.deleteScrapeResult(id);
      }
      await load();
      setSelected({});
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">抓取结果审核</h1>
            <p className="mt-2 text-gray-600">查看并将抓取内容导入到指定集合，或删除不需要的结果</p>
          </div>
          <div>
            <button onClick={() => load()} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white">刷新</button>
          </div>
        </div>

        {/* 任务分组 */}
        <div className="mb-6 flex gap-4">
          <div className="w-72 bg-white border rounded p-3 max-h-[60vh] overflow-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">任务分组</div>
              <button className="text-sm text-blue-600" onClick={() => setActiveTaskId(undefined)}>全部</button>
            </div>
            <ul className="space-y-2">
              {groups.map((g) => (
                <li key={g.taskId}
                    className={`p-2 rounded cursor-pointer ${activeTaskId === g.taskId ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}
                    onClick={() => { setActiveTaskId(g.taskId); setPage(0); }}>
                  <div className="text-sm font-medium truncate">{g.taskId}</div>
                  <div className="text-xs text-gray-500">待审 {g.pending} / 共 {g.total}</div>
                  <div className="text-xs text-gray-400">{new Date(g.last_at).toLocaleString('zh-CN')}</div>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1">
        {/* 目标集合选择 & 批量操作 */}
        <div className="mb-6 p-4 bg-white border rounded">
          <label className="block text-sm text-gray-600 mb-2">目标集合</label>
          <select
            className="border rounded p-2"
            value={selectedCollectionId}
            onChange={(e) => setSelectedCollectionId(e.target.value)}
          >
            {(collections || []).map((c) => (
              <option key={c.collectionId} value={c.collectionId}>{c.name} ({c.collectionId})</option>
            ))}
          </select>
          <div className="mt-3 space-x-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 mr-2">当前任务：{activeTaskId ? <span className="text-gray-800">{activeTaskId}</span> : <span className="text-gray-400">未选择</span>}</span>
            <button
              onClick={onImportSelected}
              className={`px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white ${importingId ? 'opacity-60 cursor-not-allowed' : ''}`}
              disabled={!!importingId}
            >批量导入选中</button>
            <button
              onClick={onDeleteSelected}
              className={`px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white ${deletingId ? 'opacity-60 cursor-not-allowed' : ''}`}
              disabled={!!deletingId}
            >批量删除选中</button>
            <button
              title={!activeTaskId ? '请选择左侧一个任务后使用' : ''}
              onClick={async () => {
                if (!activeTaskId) return alert('请先在左侧选择一个任务');
                if (!selectedCollectionId) return alert('请先选择目标集合');
                setImportingId('task');
                try {
                  const r = await scrapeApiService.importTask(activeTaskId, { collectionId: selectedCollectionId });
                  if (!r.success) alert('批量导入失败'); else await load();
                } finally { setImportingId(null); }
              }}
              className={`px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white ${(importingId || !activeTaskId) ? 'opacity-60 cursor-not-allowed' : ''}`}
              disabled={!!importingId || !activeTaskId}
            >导入本任务全部</button>
            <button
              title={!activeTaskId ? '请选择左侧一个任务后使用' : ''}
              onClick={async () => {
                if (!activeTaskId) return alert('请先在左侧选择一个任务');
                if (!confirm('确定删除本任务的所有待审核结果吗？')) return;
                setDeletingId('task');
                try {
                  await scrapeApiService.deleteTask(activeTaskId);
                  await load();
                } finally { setDeletingId(null); }
              }}
              className={`px-3 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white ${(deletingId || !activeTaskId) ? 'opacity-60 cursor-not-allowed' : ''}`}
              disabled={!!deletingId || !activeTaskId}
            >删除本任务待审</button>
          </div>
        </div>

        {loading ? (
          <div>加载中...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : results.length === 0 ? (
          <div className="text-gray-600">暂无待审核的抓取结果</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {results.map((item) => (
              <div key={item.id} className="bg-white border rounded p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-2">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={!!selected[item.id]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                      />
                      <span className="text-sm text-gray-500">选择</span>
                    </div>
                    <div className="text-sm text-gray-500">{new Date(item.created_at).toLocaleString('zh-CN')}</div>
                    <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{item.url}</a>
                    {item.title && (<div className="mt-1 font-semibold text-gray-900 break-words">{item.title}</div>)}
                    {item.snippet && (
                      <div className="mt-2 text-sm text-gray-600 line-clamp-3 max-w-3xl">{item.snippet}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="border rounded p-1 text-sm"
                      value={itemCollection[item.id] ?? ''}
                      onChange={(e) => setItemCollection((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    >
                      <option value="">默认（使用上方选择）</option>
                      {(collections || []).map((c) => (
                        <option key={c.collectionId} value={c.collectionId}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={async () => {
                        try {
                          const d = await scrapeApiService.getScrapeResult(item.id);
                          if (d.success) setPreviewItem(d.item as any);
                          else alert('加载详情失败');
                        } catch (e: any) {
                          alert(e?.message || '加载详情失败');
                        }
                      }}
                    >查看详情</button>
                    <button
                      className={`px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white ${importingId === item.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                      onClick={() => onImport(item.id)}
                      disabled={importingId === item.id}
                    >
                      {importingId === item.id ? '导入中...' : '导入到集合'}
                    </button>
                    <button
                      className={`px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white ${deletingId === item.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                      onClick={() => onDelete(item.id)}
                      disabled={deletingId === item.id}
                    >
                      {deletingId === item.id ? '删除中...' : '删除'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {/* 分页 */}
            <div className="flex items-center justify-end gap-2">
              <button className="px-2 py-1 border rounded" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>上一页</button>
              <div className="text-sm text-gray-600">第 {page + 1} 页</div>
              <button className="px-2 py-1 border rounded" disabled={results.length < limit} onClick={() => setPage((p) => p + 1)}>下一页</button>
            </div>
          </div>
        )}
          </div>
        </div>
        {/* 预览模态框 */}
        {previewItem && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded shadow-xl w-11/12 md:w-3/4 lg:w-2/3 max-h-[85vh] overflow-hidden">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="font-semibold text-gray-900 truncate">{previewItem.title || previewItem.url}</div>
                <button onClick={() => setPreviewItem(null)} className="text-gray-500 hover:text-gray-700">关闭</button>
              </div>
              <div className="p-4 overflow-auto max-h-[75vh] prose">
                {/* 模态内也可选择导入集合（优先于全局选择） */}
                <div className="mb-3 flex items-center gap-2">
                  <label className="text-sm text-gray-600">导入到集合</label>
                  <select
                    className="border rounded p-1 text-sm"
                    value={itemCollection[previewItem.id] ?? ''}
                    onChange={(e) => setItemCollection((prev) => ({ ...prev, [previewItem.id]: e.target.value }))}
                  >
                    <option value="">默认（使用上方选择）</option>
                    {(collections || []).map((c) => (
                      <option key={c.collectionId} value={c.collectionId}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewItem.content || ''}</ReactMarkdown>
              </div>
              <div className="border-t px-4 py-3 flex items-center justify-between">
                <a href={previewItem.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">{previewItem.url}</a>
                <div className="space-x-2">
                  <button className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                    if (!selectedCollectionId) return alert('请先选择目标集合');
                    void onImport(previewItem.id);
                  }}>导入到集合</button>
                  <button className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setPreviewItem(null)}>关闭</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScrapeReviewPage;
