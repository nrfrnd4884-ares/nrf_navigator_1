/* Shared service configuration. */
const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const apiUrl = isLocal
  ? 'http://127.0.0.1:5001/nrf-helper/asia-northeast3/api'
  : 'https://asia-northeast3-nrf-helper.cloudfunctions.net/api';

window.APP_CONFIG = Object.freeze({
  appsScriptUrl: apiUrl,
  patentApiUrl: apiUrl
});
