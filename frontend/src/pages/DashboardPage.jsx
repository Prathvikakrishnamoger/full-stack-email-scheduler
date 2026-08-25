import React, { useState, useCallback } from 'react';
import Header from '../components/Header';
import Button from '../components/ui/Button';
import ComposeModal from '../components/ComposeModal';
import ScheduledTable from '../components/ScheduledTable';
import SentTable from '../components/SentTable';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleScheduleSuccess = useCallback(() => {
    setComposeOpen(false);
    setActiveTab('scheduled');
    setRefreshKey((k) => k + 1); // force refresh tables
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar: tabs + compose button */}
        <div className="flex items-center justify-between mb-6">
          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'scheduled'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Scheduled Emails
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'sent'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Sent Emails
            </button>
          </div>

          <Button onClick={() => setComposeOpen(true)} size="md">
            <svg className="-ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Compose New Email
          </Button>
        </div>

        {/* Tab content */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable key={`scheduled-${refreshKey}`} />
        ) : (
          <SentTable key={`sent-${refreshKey}`} />
        )}
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSuccess={handleScheduleSuccess}
      />
    </div>
  );
}
