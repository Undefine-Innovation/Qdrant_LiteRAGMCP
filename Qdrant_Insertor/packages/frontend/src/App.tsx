import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import BatchOperationStatus from './components/BatchOperationStatus';
import HomePage from './pages/HomePage';
import CollectionsPage from './pages/CollectionsPage';
import DocumentsPage from './pages/DocumentsPage';
import SearchPage from './pages/SearchPage';
import ScrapePage from './pages/ScrapePage';
import ScrapeReviewPage from './pages/ScrapeReviewPage';
import MonitoringDashboard from './pages/MonitoringDashboard';

function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/scrape" element={<ScrapePage />} />
          <Route path="/scrape/review" element={<ScrapeReviewPage />} />
          <Route path="/monitoring" element={<MonitoringDashboard />} />
        </Routes>
      </Layout>
      <BatchOperationStatus />
    </>
  );
}

export default App;
