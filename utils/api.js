/**
 * Runtime API contract for custom translation providers.
 *
 * POST JSON to apiEndpoint:
 * {
 *   "text": "Bonjour",
 *   "sourceLanguage": "auto",
 *   "targetLanguage": "en"
 * }
 *
 * Expected response:
 * {
 *   "translatedText": "Hello"
 * }
 */
export {};
