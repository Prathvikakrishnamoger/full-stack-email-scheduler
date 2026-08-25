import api from './axios';

/**
 * Schedule a batch of emails.
 * @param {FormData} formData - Contains csv file, subject, body, startTime, delayBetweenEmails
 * @returns {Promise<Object>}
 */
export async function scheduleEmails(formData) {
  const response = await api.post('/api/emails/schedule', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}

/**
 * Get paginated scheduled emails.
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<Object>}
 */
export async function getScheduledEmails(page = 1, limit = 20) {
  const response = await api.get('/api/emails/scheduled', {
    params: { page, limit }
  });
  return response.data;
}

/**
 * Get paginated sent emails.
 * @param {number} page
 * @param {number} limit
 * @returns {Promise<Object>}
 */
export async function getSentEmails(page = 1, limit = 20) {
  const response = await api.get('/api/emails/sent', {
    params: { page, limit }
  });
  return response.data;
}
