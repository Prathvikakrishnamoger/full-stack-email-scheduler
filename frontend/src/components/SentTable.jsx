import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import Table from './ui/Table';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { getSentEmails } from '../api/emailApi';

const columns = [
  { key: 'to', label: 'Email' },
  { key: 'subject', label: 'Subject' },
  {
    key: 'sentAt',
    label: 'Sent Time',
    render: (value, row) => {
      const date = value || row.updatedAt;
      return date ? format(new Date(date), 'MMM dd, yyyy HH:mm:ss') : '—';
    }
  },
  {
    key: 'status',
    label: 'Status',
    render: (value) => <Badge status={value} />
  }
];

export default function SentTable() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchData = useCallback(async (pageNum) => {
    try {
      const result = await getSentEmails(pageNum);
      setData(result.emails);
      setPagination(result.pagination);
    } catch (error) {
      console.error('Failed to fetch sent emails:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh every 10 seconds
  useEffect(() => {
    fetchData(page);
    const interval = setInterval(() => fetchData(page), 10000);
    return () => clearInterval(interval);
  }, [page, fetchData]);

  return (
    <div>
      <Table
        columns={columns}
        data={data}
        loading={loading}
        emptyMessage="No sent emails yet. Scheduled emails will appear here once sent."
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex space-x-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
