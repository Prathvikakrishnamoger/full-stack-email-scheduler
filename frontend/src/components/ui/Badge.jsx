import React from 'react';

const statusColors = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  scheduled: 'bg-yellow-100 text-yellow-800',
  queued: 'bg-blue-100 text-blue-800',
  'rate-limited': 'bg-orange-100 text-orange-800',
  sending: 'bg-purple-100 text-purple-800'
};

export default function Badge({ status, className = '' }) {
  const colorClass = statusColors[status] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colorClass} ${className}`}>
      {status}
    </span>
  );
}
