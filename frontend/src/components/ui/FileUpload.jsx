import React, { useState, useRef, useCallback } from 'react';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse email addresses from file text content.
 * Handles CSV with headers and plain text lists.
 */
function parseEmails(text) {
  const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
  const emails = [];

  for (const line of lines) {
    // Split by comma for CSV rows
    const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
    for (const part of parts) {
      if (EMAIL_REGEX.test(part)) {
        emails.push(part);
      }
    }
  }

  return [...new Set(emails)]; // deduplicate
}

export default function FileUpload({ onFileSelect, accept = '.csv,.txt' }) {
  const [file, setFile] = useState(null);
  const [emailCount, setEmailCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const emails = parseEmails(e.target.result);
      setEmailCount(emails.length);
      onFileSelect(selectedFile, emails);
    };
    reader.readAsText(selectedFile);
  }, [onFileSelect]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setEmailCount(0);
    onFileSelect(null, []);
    if (inputRef.current) inputRef.current.value = '';
  }, [onFileSelect]);

  return (
    <div>
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
          }`}
        >
          <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="mt-2 text-sm text-gray-600">
            <span className="font-medium text-indigo-600">Click to upload</span> or drag and drop
          </p>
          <p className="mt-1 text-xs text-gray-500">CSV or TXT file with email addresses</p>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
          <div className="flex items-center space-x-3">
            <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-indigo-600 font-medium">
                {emailCount} email{emailCount !== 1 ? 's' : ''} detected
              </p>
            </div>
          </div>
          <button
            onClick={clearFile}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
