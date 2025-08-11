// Dynamic Environment-Based Configuration System
// Automatically determines the correct base URL and environment variables
// depending on the current runtime environment

/**
 * Environment Detection Logic
 * - Local: localhost:3000, localhost:3001, openappointmentapplication.netlify.app
 * - Production/Staging: All other URLs (default fallback)
 */

// Environment detection function
const detectEnvironment = () => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return 'production'; // Default for server-side rendering
  }

  const origin = window.location.origin;
  const hostname = window.location.hostname;

  console.log('🌍 Detecting environment for origin:', origin);

  // Local environment detection
  const isLocal = (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' 
    // || origin === 'https://openappointmentapplication.netlify.app/'
  );

  const environment = isLocal ? 'local' : 'production';
  console.log('🎯 Detected environment:', environment);

  return environment;
};

// Environment-specific configuration
const ENVIRONMENT_CONFIG = {
  local: {
    N8N_BASE_URL: 'https://local-n8n.vitonta.com',
    WEBHOOK_PATH: '/webhook/115d0f35-6f15-4b38-9697-a702343ceccd',
    API_BASE_URL: 'https://localhost:44360' //'https://ooh_web.vitonta.com'
  },
  production: {
    N8N_BASE_URL: 'https://demo-ooh-n8n.vitonta.com',
    WEBHOOK_PATH: '/webhook/115d0f35-6f15-4b38-9697-a702343ceccd',
    API_BASE_URL: 'https://ooh_web.vitonta.com'
  },
  staging: {
    N8N_BASE_URL: 'https://demo-ooh-n8n.vitonta.com',
    WEBHOOK_PATH: '/webhook/115d0f35-6f15-4b38-9697-a702343ceccd',
   API_BASE_URL: 'https://ooh_web.vitonta.com'
  }
};

// Get current environment configuration
const getCurrentEnvironmentConfig = () => {
  const environment = detectEnvironment();
  const config = ENVIRONMENT_CONFIG[environment];

  if (!config) {
    console.warn(`⚠️ Unknown environment: ${environment}, falling back to production`);
    return ENVIRONMENT_CONFIG.production;
  }

  console.log('⚙️ Using configuration for environment:', environment, config);
  return config;
};

// Dynamic webhook configuration
const createDynamicWebhookConfig = () => {
  const envConfig = getCurrentEnvironmentConfig();
  const webhookUrl = `${envConfig.N8N_BASE_URL}${envConfig.WEBHOOK_PATH}`;

  return {
    // Dynamic N8N Webhook URLs - Auto-detected based on environment
    LOOKUPS_WEBHOOK: webhookUrl,
    TREATMENT_CENTRES_WEBHOOK: webhookUrl,
    PATIENT_REGISTRATION_WEBHOOK: webhookUrl,
    APPOINTMENT_WEBHOOK: webhookUrl,

    // Centralized API endpoints
    PATIENT_INFO_API: `${envConfig.API_BASE_URL}/AppBooking/GetPatientInfoPreReqs`,
    VIDEO_TOKEN_API: `${envConfig.API_BASE_URL}/api/video/token`,

    // Environment info
    CURRENT_ENVIRONMENT: detectEnvironment(),
    ENVIRONMENT_CONFIG: envConfig,

    // Webhook types
    WORKFLOW_TYPES: {
      LOOKUPS: 'lookups',
      BOOKING: 'booking',
      BOOK_APPOINTMENT: 'book_appointment',
      SEND_CONFIRMATION_EMAILS: 'send_confirmation_emails',
      PATIENT_DATA: 'patient_data',
      PATIENT_REGISTRATION: 'save_patient_details',
      TREATMENT_CENTRES: 'treatment_centres'
    },

    // Default headers for webhook requests
    DEFAULT_HEADERS: {
      'Content-Type': 'application/json',
      "Authorization": "2-danleri@murtceps-1",
    },

    // Request timeout in milliseconds
    REQUEST_TIMEOUT: 10000
  };
};

// Export the dynamic configuration
export const WEBHOOK_CONFIG = createDynamicWebhookConfig();

// Utility functions for environment management
export const getEnvironmentInfo = () => {
  return {
    current: WEBHOOK_CONFIG.CURRENT_ENVIRONMENT,
    config: WEBHOOK_CONFIG.ENVIRONMENT_CONFIG,
    webhookUrl: WEBHOOK_CONFIG.LOOKUPS_WEBHOOK,
    apiUrl: WEBHOOK_CONFIG.PATIENT_INFO_API
  };
};

// Function to manually override environment (for testing purposes)
export const setEnvironmentOverride = (environment) => {
  if (!ENVIRONMENT_CONFIG[environment]) {
    console.error(`❌ Invalid environment: ${environment}`);
    return false;
  }

  console.log(`🔄 Overriding environment to: ${environment}`);

  // Update the configuration
  const envConfig = ENVIRONMENT_CONFIG[environment];
  const webhookUrl = `${envConfig.N8N_BASE_URL}${envConfig.WEBHOOK_PATH}`;

  WEBHOOK_CONFIG.LOOKUPS_WEBHOOK = webhookUrl;
  WEBHOOK_CONFIG.TREATMENT_CENTRES_WEBHOOK = webhookUrl;
  WEBHOOK_CONFIG.PATIENT_REGISTRATION_WEBHOOK = webhookUrl;
  WEBHOOK_CONFIG.PATIENT_INFO_API = `${envConfig.API_BASE_URL}/AppBooking/GetPatientInfoPreReqs`;
  WEBHOOK_CONFIG.CURRENT_ENVIRONMENT = environment;
  WEBHOOK_CONFIG.ENVIRONMENT_CONFIG = envConfig;

  return true;
};

// Helper function to create webhook request body
export const createWebhookRequestBody = (workflowType, additionalData = {}) => {
  return {
    workflowtype: workflowType,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    source: 'Spectrum IRE Booking System',
    environment: WEBHOOK_CONFIG.CURRENT_ENVIRONMENT,
    ...additionalData
  };
};

// Helper function to make webhook requests with enhanced logging
export const makeWebhookRequest = async (url, body, options = {}) => {
  const controller = new AbortController();
  const timeout = options.timeout || WEBHOOK_CONFIG.REQUEST_TIMEOUT;
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Log the request details
  console.log('🌐 Making webhook request:', {
    url,
    environment: WEBHOOK_CONFIG.CURRENT_ENVIRONMENT,
    workflowType: body?.workflowtype,
    timestamp: new Date().toISOString()
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...WEBHOOK_CONFIG.DEFAULT_HEADERS,
        ...options.headers
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      ...options
    });

    clearTimeout(timeoutId);

    // Log response status
    console.log('📥 Webhook response:', {
      status: response.status,
      statusText: response.statusText,
      url,
      environment: WEBHOOK_CONFIG.CURRENT_ENVIRONMENT
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Enhanced error logging
    console.error('❌ Webhook request failed:', {
      error: error.message,
      url,
      environment: WEBHOOK_CONFIG.CURRENT_ENVIRONMENT,
      workflowType: body?.workflowtype
    });

    // Handle AbortError specifically
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }

    throw error;
  }
};

// Debug function to log current configuration
export const logCurrentConfiguration = () => {
  console.group('🔧 Current Webhook Configuration');
  console.log('Environment:', WEBHOOK_CONFIG.CURRENT_ENVIRONMENT);
  console.log('N8N Base URL:', WEBHOOK_CONFIG.ENVIRONMENT_CONFIG.N8N_BASE_URL);
  console.log('Webhook URL:', WEBHOOK_CONFIG.LOOKUPS_WEBHOOK);
  console.log('API URL:', WEBHOOK_CONFIG.PATIENT_INFO_API);
  console.log('Full Config:', WEBHOOK_CONFIG.ENVIRONMENT_CONFIG);
  console.groupEnd();
};







