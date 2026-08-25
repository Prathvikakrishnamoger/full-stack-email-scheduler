import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import Modal from './ui/Modal';
import Button from './ui/Button';
import Input from './ui/Input';
import FileUpload from './ui/FileUpload';
import { scheduleEmails } from '../api/emailApi';

export default function ComposeModal({ isOpen, onClose, onSuccess }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const [emailCount, setEmailCount] = useState(0);
  const [startTime, setStartTime] = useState('');
  const [delayBetween, setDelayBetween] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileSelect = useCallback((selectedFile, emails) => {
    setFile(selectedFile);
    setEmailCount(emails.length);
  }, []);

  const canSubmit = subject.trim() && body.trim() && file && startTime;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('csv', file);
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('startTime', new Date(startTime).toISOString());
      formData.append('delayBetweenEmails', delayBetween || '2');
      if (hourlyLimit) formData.append('hourlyLimit', hourlyLimit);

      const result = await scheduleEmails(formData);
      toast.success(result.message || `Scheduled ${result.totalScheduled} emails!`);

      // Reset form
      setSubject('');
      setBody('');
      setFile(null);
      setEmailCount(0);
      setStartTime('');
      setDelayBetween('2');
      setHourlyLimit('');

      onSuccess?.();
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to schedule emails';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose New Email" size="xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Enter email subject"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter email body (HTML supported)"
            rows={5}
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email Recipients (CSV/TXT)</label>
          <FileUpload onFileSelect={handleFileSelect} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Start Time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            label="Delay Between (seconds)"
            type="number"
            min="1"
            value={delayBetween}
            onChange={(e) => setDelayBetween(e.target.value)}
            placeholder="2"
          />
          <Input
            label="Hourly Limit (optional)"
            type="number"
            min="1"
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(e.target.value)}
            placeholder="Default: server setting"
          />
        </div>

        {emailCount > 0 && (
          <p className="text-sm text-indigo-600 font-medium">
            📧 {emailCount} email{emailCount !== 1 ? 's' : ''} will be scheduled
          </p>
        )}

        <div className="flex justify-end space-x-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!canSubmit}>
            Schedule Emails
          </Button>
        </div>
      </form>
    </Modal>
  );
}
