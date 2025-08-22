import React, { useState, useRef, useEffect } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { CreditCard, Lock, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { WEBHOOK_CONFIG, makeWebhookRequest } from '../config/webhooks';

const StripePayment = ({ 
  amount, 
  onPaymentSuccess, 
  onPaymentError, 
  isProcessing, 
  setIsProcessing,
  bookingData,
  timeRemaining,
  isTimerActive,
  startTimer,
  formatTime,
  showTimer
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);

  // Check if timer expired
  const isTimerExpired = timeRemaining <= 0 && showTimer;

  // Start timer when user first interacts with card field
  const handleCardFocus = () => {
    if (!isTimerActive && !isTimerExpired) {
      startTimer();
    }
  };

  const handleCardChange = (event) => {
    setCardComplete(event.complete);
    
    // Start timer on first input
    if (!isTimerActive && !isTimerExpired) {
      startTimer();
    }
    
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#1f2937',
        fontFamily: 'system-ui, sans-serif',
        '::placeholder': {
          color: '#9ca3af',
        },
        iconColor: '#0f766e',
      },
      invalid: {
        color: '#ef4444',
        iconColor: '#ef4444',
      },
    },
    hidePostalCode: true,
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Test n8n connection function
  const testN8nConnection = async () => {
    try {
      console.log('🧪 Testing n8n connection...');
      const testPayload = {
        "workflowtype": "test_connection",
        "type": "ping"
      };

      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, testPayload);
      console.log('🧪 Test response status:', response.status);

      const responseText = await response.text();
      console.log('🧪 Test response:', responseText);

      return response.ok;
    } catch (error) {
      console.error('🧪 n8n connection test failed:', error);
      return false;
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || isTimerExpired) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);

    try {
      console.log('🔄 Starting Stripe payment process...');

      // Step 1: Call n8n workflow to create payment intent
      console.log('📞 Calling n8n workflow to create payment intent...');

      const paymentIntentPayload = {
        "workflowtype": "stripe",
        "type": "create_payment_intent",
        "stripe_amount": Math.round(amount * 100), // Dynamic amount in cents
        "stripe_currency": "EUR",
        "stripe_payment_method_type": "card",
        "stripe_email": bookingData.email || "teststripe@gpooh.ie"
      };

      console.log('📤 Payment intent payload:', JSON.stringify(paymentIntentPayload, null, 2));
      console.log('💰 Using dynamic amount:', amount, 'EUR →', Math.round(amount * 100), 'cents');
      console.log('🌐 Webhook URL:', WEBHOOK_CONFIG.LOOKUPS_WEBHOOK);

      let paymentIntentResponse;
      try {
        paymentIntentResponse = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, paymentIntentPayload);
      } catch (networkError) {
        console.error('❌ Network error calling n8n:', networkError);
        throw new Error(`Network error: ${networkError.message}. Check if n8n workflow is active and accessible.`);
      }

      console.log('📊 Response status:', paymentIntentResponse.status);
      console.log('📊 Response headers:', Object.fromEntries(paymentIntentResponse.headers.entries()));

      if (!paymentIntentResponse.ok) {
        const errorText = await paymentIntentResponse.text();
        console.error('❌ n8n error response:', errorText);
        throw new Error(`n8n workflow failed (${paymentIntentResponse.status}): ${errorText || 'Unknown error'}`);
      }

      // Handle response body
      const responseText = await paymentIntentResponse.text();
      console.log('📥 Raw n8n response:', responseText);
      console.log('📏 Response length:', responseText.length);

      if (!responseText || responseText.trim() === '') {
        console.error('❌ Empty response from n8n workflow');
        console.error('🔧 Check n8n workflow has a "Respond to Webhook" node with proper JSON response');
        throw new Error('Empty response from n8n workflow. Check workflow configuration.');
      }

      let paymentIntentData;
      try {
        paymentIntentData = JSON.parse(responseText);
        console.log('📥 Parsed n8n response:', JSON.stringify(paymentIntentData, null, 2));
      } catch (parseError) {
        console.error('❌ JSON parsing failed:', parseError.message);
        console.error('❌ Raw response:', responseText);
        console.error('🔧 Check n8n workflow returns valid JSON in "Respond to Webhook" node');
        throw new Error(`Invalid JSON from n8n workflow: ${parseError.message}`);
      }

      // Step 2: Validate the response
      let validatedData = null;

      console.log('🔍 Analyzing payment intent response structure...');
      console.log('📊 Response type:', typeof paymentIntentData);
      console.log('📊 Is array:', Array.isArray(paymentIntentData));

      if (Array.isArray(paymentIntentData) && paymentIntentData.length > 0) {
        validatedData = paymentIntentData[0];
        console.log('✅ Using first element from array response');
      } else if (paymentIntentData && typeof paymentIntentData === 'object') {
        validatedData = paymentIntentData;
        console.log('✅ Using direct object response');
      } else {
        console.error('❌ Unexpected response format:', paymentIntentData);
        throw new Error('Unexpected response format from payment intent API');
      }

      console.log('🔍 Validating required fields in response:', validatedData);

      // Check each required field individually for better error messages
      const missingFields = [];
      if (!validatedData.paymentIntent) missingFields.push('paymentIntent');
      if (!validatedData.ephemeralKey) missingFields.push('ephemeralKey');
      if (!validatedData.customer) missingFields.push('customer');

      if (missingFields.length > 0) {
        console.error('❌ Missing required fields:', missingFields);
        console.error('❌ Received data:', validatedData);
        throw new Error(`Invalid payment intent response. Missing required fields: ${missingFields.join(', ')}`);
      }

      console.log('✅ Payment intent validation successful:', {
        paymentIntent: validatedData.paymentIntent ? `Present (${validatedData.paymentIntent.substring(0, 20)}...)` : 'Missing',
        ephemeralKey: validatedData.ephemeralKey ? `Present (${validatedData.ephemeralKey.substring(0, 20)}...)` : 'Missing',
        customer: validatedData.customer ? `Present (${validatedData.customer})` : 'Missing',
        chargeID: validatedData.chargeID || 'null',
        createdAt: validatedData.createdAt || 'not provided'
      });

      // Step 3: Create payment method
      console.log('💳 Creating payment method...');
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: `${bookingData.firstName} ${bookingData.lastName}`,
          email: bookingData.email,
          phone: bookingData.phone,
        },
      });

      if (paymentMethodError) {
        throw new Error(paymentMethodError.message);
      }

      console.log('✅ Payment method created:', paymentMethod.id);

      // Step 4: Confirm payment with the payment intent
      console.log('🔐 Confirming payment...');
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        validatedData.paymentIntent,
        {
          payment_method: paymentMethod.id
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (paymentIntent.status === 'succeeded') {
        console.log('✅ Payment successful!');

        // Pass the validated data along with payment info
        onPaymentSuccess({
          paymentMethod,
          paymentIntent,
          amount,
          currency: 'eur',
          stripeData: validatedData
        });
      } else {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }

    } catch (err) {
      console.error('❌ Payment error:', err);
      setError(err.message);
      onPaymentError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
      {isTimerExpired && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">Payment session expired. Please choose another time slot.</span>
        </div>
      )}

      <div className="flex items-center space-x-2 mb-4">
        <CreditCard className="h-5 w-5 text-teal-600" />
        <h3 className="text-lg font-semibold text-gray-900">Payment Information</h3>
        <Lock className="h-4 w-4 text-gray-400" />
      </div>

      <div className="mb-4 p-3 bg-teal-50 rounded-lg border border-teal-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-teal-800">Consultation Fee:</span>
          <span className="text-lg font-bold text-teal-900">{formatAmount(amount)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Card Details
          </label>
          <div className={`p-3 border rounded-lg ${isTimerExpired 
            ? 'border-red-300 bg-red-50 opacity-50' 
            : 'border-gray-300 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500'}`}>
            <CardElement 
              options={cardElementOptions}
              onChange={handleCardChange}
              onFocus={handleCardFocus}
              disabled={isTimerExpired}
            />
          </div>
          {/* {isTimerExpired && (
            <p className="mt-1 text-sm text-red-600">
              Payment time expired. Please refresh to try again.
            </p>
          )} */}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">Payment Failed</h4>
                <p className="text-sm text-red-700">{error}</p>
                <p className="text-xs text-red-600 mt-2">
                  If you continue to experience issues, please try a different payment method or contact your bank.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={!stripe || !cardComplete || isProcessing || isTimerExpired}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
            !stripe || !cardComplete || isProcessing || isTimerExpired
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-md hover:shadow-lg'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Creating Payment Intent...</span>
            </>
          ) : isTimerExpired ? (
            <>
              <Lock className="h-4 w-4" />
              <span>Session Expired</span>
            </>
          ) : (
            <>
              <Lock className="h-4 w-4" />
              <span>Pay {formatAmount(amount)}</span>
            </>
          )}
        </button>
      </form>

      <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-gray-500">
        <Lock className="h-3 w-3" />
        <span>Secured by Stripe • Your payment information is encrypted</span>
      </div>

      {/* Debug section - only show in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Debug Information</h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div>Amount: €{amount} ({Math.round(amount * 100)} cents)</div>
            <div>Email: {bookingData.email || 'teststripe@gpooh.ie'}</div>
            <div>Webhook URL: {WEBHOOK_CONFIG.LOOKUPS_WEBHOOK}</div>
          </div>
          <button
            type="button"
            onClick={testN8nConnection}
            className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          >
            Test n8n Connection
          </button>
        </div>
      )}
    </div>
  );
};

export default StripePayment;







































