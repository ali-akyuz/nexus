import axios from 'axios';
import { toast } from 'sonner';

// All frontend requests go through the Next.js API to utilize secure HttpOnly cookies.
export const api = axios.create({
  baseURL: '/api/proxy',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Specific auth API calls that don't go through the generic proxy
export const authApi = axios.create({
  baseURL: '/api/auth',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add graceful degradation for rate limiting and queue overload
const handleGlobalErrors = (error: any) => {
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;
    
    if (status === 429) {
      toast.error('Too Many Requests', {
        description: data.message || 'You have reached your request limit. Please try again later.',
      });
    } else if (status === 503 && data?.code === 'QUEUE_OVERLOADED') {
      toast.error('Queue Overloaded', {
        description: 'The processing queue is temporarily overloaded. Please wait before submitting more jobs.',
      });
    } else if (status === 400 && data?.code === 'CONCURRENCY_LIMIT_REACHED') {
      toast.error('Concurrency Limit Reached', {
        description: data.message || 'You have too many active jobs. Please wait for them to finish.',
      });
    }
  }
  return Promise.reject(error);
};

api.interceptors.response.use((response) => response, handleGlobalErrors);
authApi.interceptors.response.use((response) => response, handleGlobalErrors);
