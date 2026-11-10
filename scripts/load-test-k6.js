import http from 'k6/http';
import { check, sleep } from 'k6';

// ==============================================================================
// k6 Load Testing Script for Hotel Dream Heaven's Platform
// ==============================================================================
// Usage:
//   k6 run scripts/load-test-k6.js
//   k6 run --vus 50 --duration 1m scripts/load-test-k6.js
// ==============================================================================

export const options = {
  stages: [
    { duration: '15s', target: 10 }, // Ramp up to 10 VUs
    { duration: '30s', target: 30 }, // Stress test at 30 concurrent VUs
    { duration: '15s', target: 0 },  // Ramp down to 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(95)<350'], // 95% of requests must complete below 350ms
    http_req_failed: ['rate<0.02'],   // Failure rate must remain below 2%
  },
};

const BASE_URL = __ENV.TARGET_URL || 'http://127.0.0.1:8001';

export default function () {
  const rand = Math.random();

  // 1. 60% Traffic: Public Room Categories & Availability Search
  if (rand < 0.6) {
    const res = http.get(`${BASE_URL}/api/v1/availability/categories`);
    check(res, {
      'categories status 200': (r) => r.status === 200,
      'has room categories': (r) => JSON.parse(r.body).length > 0,
    });
  }
  // 2. 20% Traffic: Dining QR Menu Lookups
  else if (rand < 0.8) {
    const res = http.get(`${BASE_URL}/api/v1/pos/menu`);
    check(res, {
      'menu status 200': (r) => r.status === 200,
    });
  }
  // 3. 15% Traffic: Health check / Ping
  else if (rand < 0.95) {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health status 200': (r) => r.status === 200,
      'service healthy': (r) => JSON.parse(r.body).status === 'healthy',
    });
  }
  // 4. 5% Traffic: Readiness probe (DB ping verification)
  else {
    const res = http.get(`${BASE_URL}/health/ready`);
    check(res, {
      'readiness status 200': (r) => r.status === 200,
      'db connected': (r) => JSON.parse(r.body).database === 'connected',
    });
  }

  sleep(0.5);
}
