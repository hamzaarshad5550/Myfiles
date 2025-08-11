import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MapPin, Phone, Users, Video, Palette, Check, Search, Navigation, ChevronDown, Clock, Calendar, Info } from 'lucide-react';

import { WEBHOOK_CONFIG, createWebhookRequestBody, makeWebhookRequest, logCurrentConfiguration, getEnvironmentInfo } from './config/webhooks';
import { testCurrentEnvironment } from './utils/environmentTester';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise, STRIPE_CONFIG } from './config/stripe';
import StripePayment from './components/StripePayment';

// Modern UI Components
import { Button } from './modern-ui/ui/button.tsx';
import { Input } from './modern-ui/ui/input.tsx';
import { Label } from './modern-ui/ui/label.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './modern-ui/ui/card.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './modern-ui/ui/select.tsx';

// Additional imports
import { languages, translations, getTranslation, saveLanguageToStorage, getLanguageFromStorage } from './languages';
import PhoneNumberInput from './components/PhoneNumberInput';
import SendSms from './components/SendSms';
import EmergencyNotice from './components/EmergencyNotice.tsx';

// CSS imports
import './styles/flags.css';

// Constants
const DEFAULT_CONSULTATION_FEE = 35; // Default consultation fee - will be updated from API response

// Animated Tick Component
const AnimatedTick = ({ size = 32, className = '', color = 'text-green-600' }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`relative ${className}`}>
      {/* Animated checkmark using SVG */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={`${color} transition-all duration-500 ${isVisible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
      >
        {/* Circle background with animation */}
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          className="animate-pulse"
          style={{
            strokeDasharray: '63',
            strokeDashoffset: isVisible ? '0' : '63',
            transition: 'stroke-dashoffset 0.6s ease-in-out'
          }}
        />
        {/* Checkmark path with animation */}
        <path
          d="M8 12l2 2 4-4"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          style={{
            strokeDasharray: '10',
            strokeDashoffset: isVisible ? '0' : '10',
            transition: 'stroke-dashoffset 0.8s ease-in-out 0.3s'
          }}
        />
      </svg>

      {/* Success pulse effect */}
      {isVisible && (
        <div className="absolute inset-0 rounded-full bg-green-200 animate-ping opacity-20"></div>
      )}
    </div>
  );
};




// Modern Loading Spinner Component
const LoadingSpinner = ({ size = 'w-4 h-4', color = 'border-blue-500' }) => {
  return (
    <div className={`${size} flex items-center justify-center relative`}>
      {/* Modern spinning loader */}
      <div className={`${size} border-2 ${color} border-t-transparent rounded-full animate-spin`}></div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

// Medical Cross Loading Animation
const MedicalLoader = ({ size = 'w-6 h-6', color = 'text-blue-500' }) => {
  return (
    <div className={`${size} flex items-center justify-center relative`}>
      <div className={`${color} animate-pulse`}>
        <svg
          className={size}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2C13.1 2 14 2.9 14 4V8H18C19.1 8 20 8.9 20 10V14C20 15.1 19.1 16 18 16H14V20C14 21.1 13.1 22 12 22H10C8.9 22 8 21.1 8 20V16H4C2.9 16 2 15.1 2 14V10C2 8.9 2.9 8 4 8H8V4C8 2.9 8.9 2 10 2H12Z"/>
        </svg>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

// Heartbeat Loading Animation
const HeartbeatLoader = ({ size = 'w-6 h-6', color = 'text-red-500' }) => {
  return (
    <div className={`${size} flex items-center justify-center relative`}>
      <div className={`${color}`} style={{ animation: 'heartbeat 1.5s ease-in-out infinite' }}>
        <svg
          className={size}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
      </div>

      <style jsx>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          14% { transform: scale(1.3); }
          28% { transform: scale(1); }
          42% { transform: scale(1.3); }
          70% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

// Searchable Dropdown Component
const SearchableDropdown = ({
  options = [],
  value,
  onChange,
  placeholder = "Search or select...",
  isMultiSelect = false,
  disabled = false,
  loading = false,
  className = "",
  name = "",
  required = false,
  focusColor = "blue" // Add theme color prop with default
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState(isMultiSelect ? (Array.isArray(value) ? value : []) : []);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);


  // Sync with external value changes
  useEffect(() => {
    if (isMultiSelect && Array.isArray(value) && options.length > 0) {
      // Convert value IDs to full option objects for multi-select
      const selectedOptions = value.map(val => {
        const valStr = val?.toString();
        return options.find(opt => 
          opt.value?.toString() === valStr
        );
      }).filter(Boolean); // Remove undefined values

      // Only update if the selection actually changed to prevent infinite loops
      const currentIds = selectedItems.map(item => item.value?.toString()).sort();
      const newIds = selectedOptions.map(item => item.value?.toString()).sort();

      if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
        setSelectedItems(selectedOptions);
        console.log(`🔄 SearchableDropdown (${name}) synced selectedItems:`, selectedOptions);
      }
    } else if (isMultiSelect && (!Array.isArray(value) || value.length === 0)) {
      if (selectedItems.length > 0) {
        setSelectedItems([]);
        console.log(`🔄 SearchableDropdown (${name}) cleared selectedItems`);
      }
    }
  }, [value, options, isMultiSelect, name, selectedItems]);

  // Get selected options
  const selectedOptions = useMemo(() => {
    if (isMultiSelect) {
      return selectedItems;
    } else if (value && options.length > 0) {
      const option = options.find(opt => opt.value?.toString() === value?.toString());
      return option ? [option] : [];
    }
    return [];
  }, [value, options, isMultiSelect, selectedItems]);

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    return options.filter(option =>
      option.label?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm(''); // Clear search when closing
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (option) => {
    if (isMultiSelect) {
      const newSelected = selectedItems.some(item => item.value === option.value)
        ? selectedItems.filter(item => item.value !== option.value)
        : [...selectedItems, option];
      setSelectedItems(newSelected);
      onChange({ target: { name, value: newSelected.map(item => item.value) } });
    } else {
      onChange({ target: { name, value: option.value } });
      setIsOpen(false);
      setSearchTerm(''); // Clear search after selection
    }
  };

  // Handle removing selected item (for multi-select)
  const handleRemoveItem = (valueToRemove, e) => {
    e.stopPropagation();
    if (isMultiSelect) {
      const newSelected = selectedItems.filter(item => item.value !== valueToRemove);
      setSelectedItems(newSelected);
      onChange({ target: { name, value: newSelected.map(item => item.value) } });
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className={`w-full min-h-[44px] sm:min-h-[48px] px-3 py-2 border border-input rounded-md focus-within:border-transparent focus-within:ring-2 focus-within:ring-${focusColor}-500 transition-all bg-background text-sm cursor-pointer ${disabled ? 'bg-muted cursor-not-allowed' : 'hover:border-muted-foreground/50'}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <div className="flex items-center justify-between min-h-[28px] sm:min-h-[32px]">
          <div className="flex-1 flex flex-wrap gap-1 items-center">
            {loading ? (
              <span className="text-muted-foreground text-sm">Loading...</span>
            ) : selectedOptions.length > 0 && !isOpen ? (
              isMultiSelect ? (
                selectedOptions.map((option, index) => (
                  <span
                    key={`selected-${option.value || index}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground text-xs sm:text-sm rounded-md"
                  >
                    <span className="truncate max-w-[100px] sm:max-w-none">{option.label || option.text || option.name}</span>
                    <button
                      type="button"
                      onClick={(e) => handleRemoveItem(option.value, e)}
                      className="hover:bg-secondary/80 rounded-full p-0.5 transition-colors flex-shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18"></path>
                        <path d="m6 6 12 12"></path>
                      </svg>
                    </button>
                  </span>
                ))
              ) : (
                <span className="text-foreground text-sm sm:text-base truncate">{selectedOptions[0].label || selectedOptions[0].text || selectedOptions[0].name}</span>
              )
            ) : isOpen ? (
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                placeholder={placeholder}
                className="w-full border-none focus:ring-0 p-0 outline-none bg-transparent text-foreground placeholder:text-muted-foreground text-sm sm:text-base"
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="text-muted-foreground text-sm sm:text-base">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center ml-2 flex-shrink-0">
            {!disabled && (isOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5">
                <path d="m18 15-6-6-6 6"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sm:w-5 sm:h-5">
                <path d="m6 9 6 6 6-6"/>
              </svg>
            ))}
          </div>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[9999] w-full mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden" style={{ position: 'absolute', zIndex: 9999 }}>
          <div className="max-h-48 sm:max-h-60 overflow-y-auto">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <div
                  key={`option-${option.value || index}`}
                  className={`px-3 py-2.5 sm:py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-center justify-between ${
                    (isMultiSelect ? selectedItems.some(item => item.value === option.value) : value === option.value)
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground'
                  }`}
                  onClick={() => handleSelect(option)}
                >
                  <span className="text-sm sm:text-base break-words flex-1">{option.label || option.text || option.name}</span>
                  {isMultiSelect && selectedItems.some(item => item.value === option.value) && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary flex-shrink-0 ml-2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>
              ))
            ) : (
              <div className="px-3 py-2.5 sm:py-2 text-muted-foreground text-sm sm:text-base">No options found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Google Maps API configuration from environment variables
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_API_URL = `https://maps.googleapis.com/maps/api/js?v=3.47&libraries=places&key=${GOOGLE_MAPS_API_KEY}`;

/*
 * OpenStreetMap Integration Support:
 *
 * OpenStreetMap (OSM) can be integrated as an alternative or fallback to Google Maps.
 * Benefits of OSM integration:
 * - Free and open-source alternative
 * - No API key requirements or usage limits
 * - Good coverage for Irish addresses via Nominatim API
 *
 * Implementation considerations:
 * - OSM Nominatim API: https://nominatim.openstreetmap.org/
 * - Requires User-Agent header for requests
 * - Response format differs from Google Maps (address components structure)
 * - May have less precise geocoding for some rural Irish addresses
 * - Can be used as fallback when Google Maps quota is exceeded
 *
 * Current implementation uses Google Maps for better accuracy and reliability.
 */

// Custom hook for geolocation and reverse geocoding using OpenStreetMap Nominatim API
const useCurrentLocationOSM = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCurrentLocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude } = position.coords;

      // Use OpenStreetMap Nominatim API for reverse geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Booking-App/1.0 (contact@Practice.ie)' // Required by Nominatim
          }
        }
      );

      if (!response.ok) {
        throw new Error(`OpenStreetMap Nominatim API failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('🌍 OpenStreetMap Nominatim reverse geocoding response:', data);

      if (!data || data.error) {
        throw new Error(`No address found for coordinates: ${data.error || 'Unknown error'}`);
      }

      const address = data.address || {};

      // Helper function for fuzzy matching area names
      const fuzzyMatchArea = (addressComponents) => {
        // Define hierarchy of area types from most specific to least specific
        const areaHierarchy = [
          'suburb', 'neighbourhood', 'quarter', 'sublocality', 'sublocality_level_1',
          'town', 'village', 'hamlet', 'locality', 'city_district', 'district',
          'residential', 'commercial', 'industrial'
        ];

        // Look for the most specific area name available
        for (const areaType of areaHierarchy) {
          if (addressComponents[areaType] && addressComponents[areaType].trim()) {
            console.log(`📍 Found area from ${areaType}:`, addressComponents[areaType]);
            return addressComponents[areaType].trim();
          }
        }

        // Fallback: try to extract area from display_name if no specific area found
        if (data.display_name) {
          const displayParts = data.display_name.split(',').map(part => part.trim());
          // Look for the second part (after street/building) as potential area
          if (displayParts.length > 2 && displayParts[1] && displayParts[1] !== displayParts[0]) {
            console.log('📍 Extracted area from display_name:', displayParts[1]);
            return displayParts[1];
          }
        }

        return '';
      };

      // Map OpenStreetMap address components to our structure with enhanced area detection
      // Building → house_number, building, or premise
      const building = address.house_number || address.building || address.premise || address.shop || '';

      // Street → road, street, way, or pedestrian
      const street = address.road || address.street || address.way || address.pedestrian || address.footway || '';

      // Enhanced area extraction with fuzzy matching
      const area = fuzzyMatchArea(address);

      // Enhanced city extraction to avoid conflicts with area
      const city = address.city || address.municipality ||
                   address.county || address.state_district || 
                   address.administrative_area_level_2 || '';

      // Country → country (with proper fallback)
      const country = address.country || address.country_code?.toUpperCase() || '';

      // Eircode/Postcode → postcode
      const eircode = address.postcode || address.postal_code || '';

      // Create full formatted address
      const fullAddress = data.display_name || '';

      const locationResult = {
        latitude,
        longitude,
        eircode,
        address: fullAddress,
        components: {
          building,
          street,
          area,
          city,
          country,
          eircode
        }
      };

      console.log('🌍 OpenStreetMap current location result:', locationResult);
      console.log('📋 Address components found:', address);
      console.log('📍 Extracted components:', { building, street, area, city, country, eircode });
      return locationResult;

    } catch (err) {
      console.error('❌ OpenStreetMap geolocation error:', err);
      const errorMessage = err.code
        ? getGeolocationErrorMessage(err.code)
        : err.message || 'Failed to get current location';

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getGeolocationErrorMessage = (code) => {
    switch (code) {
      case 1:
        return 'Location access denied. Please enable location permissions.';
      case 2:
        return 'Location unavailable. Please try again.';
      case 3:
        return 'Location request timed out. Please try again.';
      default:
        return 'Failed to get current location.';
    }
  };

  return {
    getCurrentLocation,
    isLoading,
    error
  };
};

// Legacy Google Maps hook (kept for fallback)
const useCurrentLocation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getCurrentLocation = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      // Get current position
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const { latitude, longitude } = position.coords;

      // Use Google Maps Geocoding API for reverse geocoding
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(`Google Maps Geocoding failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('🌍 Google Maps reverse geocoding response:', data);

      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        throw new Error(`No address found for coordinates: ${data.status}`);
      }

      const result = data.results[0];
      const addressComponents = result.address_components || [];

      // Extract address components using Google Maps structure
      const getComponent = (types) => {
        const component = addressComponents.find(comp =>
          types.some(type => comp.types.includes(type))
        );
        return component ? component.long_name : '';
      };

      // Enhanced address component extraction for Irish addresses
      const building = getComponent(['street_number', 'premise', 'subpremise']) || '';
      const street = getComponent(['route', 'street_address']) || '';
      const area = getComponent(['sublocality', 'neighborhood', 'sublocality_level_1', 'sublocality_level_2', 'locality']) || '';
      const city = getComponent(['postal_town', 'administrative_area_level_2', 'administrative_area_level_1']) || '';
      const country = getComponent(['country']) || 'Ireland';
      const eircode = getComponent(['postal_code']) || '';

      // Create full formatted address
      const fullAddress = result.formatted_address || '';

      const locationResult = {
        latitude,
        longitude,
        eircode,
        address: fullAddress,
        components: {
          building,
          street,
          area,
          city,
          country,
          eircode
        }
      };

      console.log('🌍 Google Maps current location result:', locationResult);
      console.log('📋 Address components found:', addressComponents);
      console.log('📍 Extracted components:', { building, street, area, city, country, eircode });
      return locationResult;

    } catch (err) {
      console.error('❌ Google Maps geolocation error:', err);
      const errorMessage = err.code
        ? getGeolocationErrorMessage(err.code)
        : err.message || 'Failed to get current location';

      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getGeolocationErrorMessage = (code) => {
    switch (code) {
      case 1:
        return 'Location access denied. Please enable location permissions.';
      case 2:
        return 'Location unavailable. Please try again.';
      case 3:
        return 'Location request timed out. Please try again.';
      default:
        return 'Failed to get current location.';
    }
  };

  return {
    getCurrentLocation,
    isLoading,
    error
  };
};

// Multiple theme configurations
const themes = {
  ocean: {
    name: 'Ocean Blue',
    primary: 'from-blue-600 to-blue-700',
    primarySolid: 'bg-blue-600',
    // primaryHover: 'hover:bg-blue-700',
    accent: 'text-blue-600',
    accentBg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    gradient: 'from-blue-400 to-blue-600'
  },
  sunset: {
    name: 'Sunset Orange',
    primary: 'from-orange-500 to-red-500',
    primarySolid: 'bg-orange-500',
    primaryHover: 'hover:bg-orange-600',
    accent: 'text-orange-600',
    accentBg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-800',
    gradient: 'from-orange-400 to-red-500'
  },
  forest: {
    name: 'Forest Green',
    primary: 'from-emerald-600 to-green-700',
    primarySolid: 'bg-emerald-600',
    primaryHover: 'hover:bg-emerald-700',
    accent: 'text-emerald-600',
    accentBg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-800',
    gradient: 'from-emerald-400 to-green-600'
  },
  lavender: {
    name: 'Lavender Purple',
    primary: 'from-purple-600 to-violet-700',
    primarySolid: 'bg-purple-600',
    primaryHover: 'hover:bg-purple-700',
    accent: 'text-purple-600',
    accentBg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-800',
    gradient: 'from-purple-400 to-violet-600'
  },
  rose: {
    name: 'Rose Pink',
    primary: 'from-pink-500 to-rose-600',
    primarySolid: 'bg-pink-500',
    primaryHover: 'hover:bg-pink-600',
    accent: 'text-pink-600',
    accentBg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-800',
    gradient: 'from-pink-400 to-rose-500'
  },
  midnight: {
    name: 'Midnight Dark',
    primary: 'from-slate-700 to-slate-900',
    primarySolid: 'bg-slate-700',
    primaryHover: 'hover:bg-slate-800',
    accent: 'text-slate-700',
    accentBg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-800',
    gradient: 'from-slate-500 to-slate-700'
  },
  teal: {
    name: 'Teal Wave',
    primary: 'from-teal-600 to-cyan-700',
    primarySolid: 'bg-teal-600',
    primaryHover: 'hover:bg-teal-700',
    accent: 'text-teal-600',
    accentBg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-800',
    gradient: 'from-teal-400 to-cyan-600'
  },
  amber: {
    name: 'Golden Amber',
    primary: 'from-amber-500 to-yellow-600',
    primarySolid: 'bg-amber-500',
    primaryHover: 'hover:bg-amber-600',
    accent: 'text-amber-600',
    accentBg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    gradient: 'from-amber-400 to-yellow-500'
  }
};

export default function CareHQBooking() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [currentTheme, setCurrentTheme] = useState(() => {
    const savedTheme = localStorage.getItem('careHQTheme');
    const theme = savedTheme && themes[savedTheme] ? savedTheme : 'teal';
    return theme;
  });

  // Force viewport recalculation on mount and resize - ENHANCED
  useEffect(() => {
    const forceViewportRecalc = () => {
      // Force immediate reflow without using 100vw to prevent horizontal overflow
      document.documentElement.style.width = '100%';
      document.documentElement.style.maxWidth = '100%';
      document.documentElement.style.overflowX = 'hidden';
      document.body.style.width = '100%';
      document.body.style.maxWidth = '100%';
      document.body.style.overflowX = 'hidden';

      // Set CSS custom property for mobile viewport height
      if (window.innerWidth <= 768) {
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
      }

      // Trigger reflow
      const height = document.body.offsetHeight; // Use the value to avoid unused expression
      console.log('Viewport recalculated, height:', height);

      // Reset styles after reflow (keep overflow hidden)
      setTimeout(() => {
        document.documentElement.style.width = '';
        document.body.style.width = '';
        // Keep maxWidth and overflowX for mobile
      }, 50);
    };

    // Multiple attempts to ensure proper mobile layout
    const timeouts = [0, 50, 100, 200, 500];
    const timeoutIds = timeouts.map(delay => 
      setTimeout(forceViewportRecalc, delay)
    );

    // Event listeners
    const handleResize = () => {
      forceViewportRecalc();
    };

    const handleOrientationChange = () => {
      setTimeout(forceViewportRecalc, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    // Cleanup
    return () => {
      timeoutIds.forEach(id => clearTimeout(id));
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Additional effect to handle viewport changes
  useEffect(() => {
    const handleViewportChange = () => {
      const viewport = window.visualViewport;
      if (viewport) {
        document.documentElement.style.setProperty('--viewport-height', `${viewport.height}px`);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      handleViewportChange(); // Initial call
      
      return () => {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
      };
    }
  }, []);

  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [formData, setFormData] = useState({
    reasonForContact: [],
    firstName: '',
    lastName: '',
    fullName: '',
    dateOfBirth: '',
    gender: '',
    phoneNumber: '',
    email: '',
    city: '',
    postcode: '',
    symptoms: '',
    // GMS Number field
    gmsNumber: '',
    // GP and Surgery fields
    gp: '',
    surgery: '',
    // GMS Expiry field
    gmsExpiry: '',
    // Appointment Type field
    appointmentType: '',
    // Eircode field
    eircode: '',
    // Home Location fields
    homeBuilding: '',
    homeStreet: '',
    homeArea: '',
    homeCity: '',
    homeCountry: '',
    homePostcode: '',
    homeEircode: '',
    // Current Location fields
    currentBuilding: '',
    currentStreet: '',
    currentArea: '',
    currentCity: '',
    currentCountry: '',
    currentPostcode: '',
    currentEircode: '',
    // Payment fields removed - using Stripe instead
  });
  const [useHomeAsCurrentLocation, setUseHomeAsCurrentLocation] = useState(false);
  const [isLoadingEircode, setIsLoadingEircode] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [eircodeError, setEircodeError] = useState('');

  // GMS validation states
  const [isLoadingGMS, setIsLoadingGMS] = useState(false);
  const [gmsValidationData, setGmsValidationData] = useState(null);
  const [gmsError, setGmsError] = useState('');
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [bookingReference, setBookingReference] = useState('');
  const [showSignInPopup, setShowSignInPopup] = useState(false);
  const [webhookResponse, setWebhookResponse] = useState(null);
   const [isLoadingWebhook, setIsLoadingWebhook] = useState(false); // Commented out - no longer using webhooks

  // Priority-based field disabling and messaging
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [isEmergencyOrUrgent, setIsEmergencyOrUrgent] = useState(false);
  const [priorityMessage, setPriorityMessage] = useState('');
  const [priorityMessageColor, setPriorityMessageColor] = useState('');

  // Age validation state
  const [ageValidationError, setAgeValidationError] = useState('');
  const [isAgeInvalid, setIsAgeInvalid] = useState(false);

  // Appointment slots state
  const [appointmentSlots, setAppointmentSlots] = useState({});
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState('');

  // Clinic display state
  const [showAllClinics, setShowAllClinics] = useState(false);
  const INITIAL_CLINICS_COUNT = 5;

  // Calendar and date selection state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filteredSlots, setFilteredSlots] = useState([]);

  // Timer state for appointment completion (3 minutes)
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showTimer, setShowTimer] = useState(false); // New state to control timer visibility
  const timerRef = useRef(null);

  // Refs to store current values for timer callbacks
  const selectedSlotRef = useRef(null);
  const reservedAppointmentRef = useRef(null);

  // Language state
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return getLanguageFromStorage();
  });
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Translation helper function
  const t = getTranslation(currentLanguage);

  // Add state for "Unknown" GP checkbox
  const [isUnknownGPChecked, setIsUnknownGPChecked] = useState(false);

  // Language options and translations
  const languages = {
    en: { name: 'English', flag: '🇬🇧' },
    ur: { name: 'Urdu', flag: '🇵🇰' },
    hi: { name: 'Hindi', flag: '🇮🇳' },
    ga: { name: 'Irish', flag: '🇮🇪' }
  };

  // Enhanced translation helper function
  // const t = (key) => {
  //   // First try to get translation from current language
  //   const translation = translations[currentLanguage]?.[key];
    
  //   // If translation exists, return it
  //   if (translation) return translation;
    
  //   // Fallback to English if translation doesn't exist
  //   const fallbackTranslation = translations.en?.[key];
    
  //   // Return fallback or key itself as last resort
  //   return fallbackTranslation || key;
  // };

  // Text search field for Reason for Contact
  const [reasonTextSearch, setReasonTextSearch] = useState('');
  const [isSearchingReasons, setIsSearchingReasons] = useState(false);

  // AbortController for canceling previous requests
  const abortControllerRef = useRef(null);

  // Current location functionality using OpenStreetMap Nominatim API
  const { getCurrentLocation: getLocationFromOSM, isLoading: isLoadingOSM, error: osmError } = useCurrentLocationOSM();

  // Coordinates and treatment centres state
  const [coordinates, setCoordinates] = useState({
    latitude: null,
    longitude: null
  });
  const [treatmentCentres, setTreatmentCentres] = useState([]);
  const [isLoadingTreatmentCentres, setIsLoadingTreatmentCentres] = useState(false);

  // Form validation state
  const [validationErrors, setValidationErrors] = useState({});
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [treatmentCentresError, setTreatmentCentresError] = useState('');

  // Dropdown data from centralized API
  const [dropdownData, setDropdownData] = useState({
    gender: [],
    doctors: [],
    surgeries: [],
    appointmentTypes: [],
    complaints: []
  });
  const [isLoadingDropdowns, setIsLoadingDropdowns] = useState(false);

  // Payment-related state
  const [paymentAmount, setPaymentAmount] = useState(DEFAULT_CONSULTATION_FEE); // Default consultation fee - will be updated from API
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Add state for API loading
  const [isSavingPatient, setIsSavingPatient] = useState(false);
  
  // Add state for storing patient registration data
  const [patientRegistrationData, setPatientRegistrationData] = useState(null);
  
  // Add bypass validation state
  const [bypassValidation, setBypassValidation] = useState(false);

  // Emergency notice state (no auto-fade)
  const [showEmergencyNotice, setShowEmergencyNotice] = useState(true);

  // GMS info popup state
  const [showGmsInfo, setShowGmsInfo] = useState(false);

  // DOB validation state
  const [dobValidationError, setDobValidationError] = useState('');

  // SMS form state
  const [showSmsForm, setShowSmsForm] = useState(false);

  // Helper function to format dates to DD/MM/YYYY
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return 'Invalid Date';
    }
  };

  // Helper function to compare dates (ignoring time)
  const compareDates = (date1, date2) => {
    if (!date1 || !date2) return false;
    try {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    } catch (error) {
      return false;
    }
  };

  // Close theme selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showThemeSelector && !event.target.closest('.theme-selector-container')) {
        setShowThemeSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemeSelector]);

  // Helper function to check if appointment type requires clinic selection
  const isVirtualAppointment = () => {
    // Check if the appointment type is Video Consult or Phone Consult based on CaseType
    const selectedAppointmentType = dropdownData.appointmentTypes.find(
      type => type.CaseTypeID.toString() === formData.appointmentType.toString()
    );

    if (selectedAppointmentType) {
      const caseType = selectedAppointmentType.CaseType.toLowerCase();
      return caseType.includes('video') || caseType.includes('phone');
    }

    // Fallback to old logic for backward compatibility
    return formData.appointmentType === 'vc' || formData.appointmentType === 'pc';
  };

  // Calculate payment amount based on appointment type
  const calculatePaymentAmount = () => {
    // For virtual appointments, check if we have a specific virtual price from API
    if (isVirtualAppointment()) {
      // Use dynamic pricing from API response, fallback to current paymentAmount
      return paymentAmount || DEFAULT_CONSULTATION_FEE; // Use API value or fallback to default
    } else {
      // For face-to-face appointments, use clinic-specific pricing or API default
      if (selectedClinic?.advancePaymentValue) {
        return selectedClinic.advancePaymentValue;
      }
      // Use the payment amount from AdvPayment (set in fetchTreatmentCentres)
      return paymentAmount || DEFAULT_CONSULTATION_FEE; // Default fallback if no AdvPayment received
    }
  };

  // Initialize environment configuration logging
  useEffect(() => {
    // Log current environment configuration on app startup
    logCurrentConfiguration();

    // Also log environment info for debugging
    const envInfo = getEnvironmentInfo();
    console.log('🌍 Environment Info:', envInfo);

    // Run environment tests
    testCurrentEnvironment();
  }, []);

  // Update payment amount when appointment type or clinic changes
  useEffect(() => {
    const newAmount = calculatePaymentAmount();
    setPaymentAmount(newAmount);
  }, [formData.appointmentType, selectedClinic]);

  // Set default appointment type to "Face 2 Face" when dropdown data is loaded
  useEffect(() => {
    if (dropdownData.appointmentTypes.length > 0 && !formData.appointmentType) {
      console.log('🔍 Available appointment types:', dropdownData.appointmentTypes);

      // Find "Face 2 Face" option by exact match first, then fallback to variations
      const face2FaceOption = dropdownData.appointmentTypes.find(
        type => type.CaseType === 'Face 2 Face' ||
                type.CaseTypeID === 3 || // Based on your API response
                type.CaseType.toLowerCase() === 'face 2 face' ||
                type.CaseType.toLowerCase().includes('face 2 face') ||
                type.CaseType.toLowerCase().includes('face to face') ||
                type.CaseType.toLowerCase().includes('face-to-face') ||
                type.CaseType.toLowerCase().includes('f2f') ||
                type.CaseType.toLowerCase().includes('in person') ||
                type.CaseType.toLowerCase().includes('clinic')
      );

      if (face2FaceOption) {
        console.log('🎯 Setting default appointment type to Face 2 Face:', face2FaceOption);
        setFormData(prev => ({
          ...prev,
          appointmentType: face2FaceOption.CaseTypeID.toString()
        }));
      } else {
        // Fallback: look for any non-virtual appointment type first
        const nonVirtualOption = dropdownData.appointmentTypes.find(
          type => !type.CaseType.toLowerCase().includes('video') &&
                  !type.CaseType.toLowerCase().includes('phone') &&
                  !type.CaseType.toLowerCase().includes('virtual')
        );

        if (nonVirtualOption) {
          console.log('🎯 Setting default to non-virtual appointment type:', nonVirtualOption);
          setFormData(prev => ({
            ...prev,
            appointmentType: nonVirtualOption.CaseTypeID.toString()
          }));
        } else {
          // Final fallback to first option if no face-to-face found
          console.log('⚠️ No face-to-face option found, using first appointment type:', dropdownData.appointmentTypes[0]);
          setFormData(prev => ({
            ...prev,
            appointmentType: dropdownData.appointmentTypes[0].CaseTypeID.toString()
          }));
        }
      }
    }
  }, [dropdownData.appointmentTypes, formData.appointmentType]);

  // Fetch treatment centres when navigating to Tab 2 and coordinates are available
  useEffect(() => {
    if (currentStep === 2 && coordinates.latitude && coordinates.longitude && treatmentCentres.length === 0) {
      console.log('🏥 Tab 2 loaded with coordinates, fetching treatment centres...');
      fetchTreatmentCentres(coordinates.latitude, coordinates.longitude);
    }
  }, [currentStep, coordinates.latitude, coordinates.longitude]);

  // Auto-select first clinic and load its slots when treatment centres are loaded
  useEffect(() => {
    if (currentStep === 2 && treatmentCentres.length > 0 && !selectedClinic && !isVirtualAppointment()) {
      const firstClinic = getClinicsData()[0]; // Use getClinicsData to ensure proper format
      console.log('🎯 Auto-selecting first clinic on Tab 2 load:', firstClinic.name);
      
      // Set selected clinic
      setSelectedClinic(firstClinic);
      setSelectedSlot(null);

      // Auto-load slots for the first clinic
      if (firstClinic && firstClinic.id) {
        console.log('🕐 Auto-loading slots for first clinic:', firstClinic.name, 'ID:', firstClinic.id);
        fetchAppointmentSlots(firstClinic.id);
      }
    }
  }, [currentStep, treatmentCentres, isVirtualAppointment]);

  const theme = themes[currentTheme];

  // Helper function to get theme color for focus states
  const getThemeFocusColor = () => {
    const colorMap = {
      ocean: 'blue',
      sunset: 'orange',
      forest: 'emerald',
      lavender: 'purple',
      rose: 'pink',
      midnight: 'slate',
      teal: 'teal',
      amber: 'amber'
    };
    return colorMap[currentTheme] || 'teal';
  };

  // Function to get clinics data - use treatment centres if available, otherwise fallback to dummy data
  const getClinicsData = () => {
    if (treatmentCentres.length > 0) {
      // Transform treatment centres data to match expected clinic structure
      return treatmentCentres.map((centre, index) => {
        // Extract dynamic price from centre data or use default
        let clinicPrice = paymentAmount; // Default fallback
        let priceDisplay = `€${paymentAmount}`;

        // Check for AdvPayment in centre data
        if (centre.AdvPayment) {
          if (typeof centre.AdvPayment === 'string') {
            // Extract numeric value from string like "€ 20"
            const numericValue = parseInt(centre.AdvPayment.replace(/[^0-9]/g, '')) || paymentAmount;
            clinicPrice = numericValue;
            priceDisplay = centre.AdvPayment;
          } else if (typeof centre.AdvPayment === 'number') {
            clinicPrice = centre.AdvPayment;
            priceDisplay = `€${centre.AdvPayment}`;
          }
        }

        return {
          id: centre.TrCenterID || index + 1,
          name: centre.TrCentreName || 'Unknown Centre',
          distance: centre.DistanceKMs ? `${centre.DistanceKMs} km` : 'N/A',
          direction: centre.Direction || 'No directions available',
          address: centre.Address || '',
          price: priceDisplay, // Dynamic price from webhook response
          advancePayment: priceDisplay,
          advancePaymentValue: clinicPrice,
          rating: 4.8
        };
      });
    }

    // Return empty array if no treatment centres available (don't use dummy data)
    return [];
  };

  const handleUnknownGPChange = (e) => {
    const isChecked = e.target.checked;
    setIsUnknownGPChecked(isChecked);
    setBypassValidation(isChecked); // Also update bypass validation state
    
    if (isChecked) {
      // When checked, set GP to "Unknown" and clear surgery
      setFormData(prev => ({
        ...prev,
        gp: 'Unknown', // Set value to "Unknown"
        surgery: 'Unknown' // Also set surgery to "Unknown"
      }));
      
      // Clear validation errors for GP and Surgery
      setValidationErrors(prev => ({
        ...prev,
        gp: undefined,
        surgery: undefined
      }));
      
      console.log('🔄 Unknown GP checked - setting GP and Surgery to "Unknown"');
    } else {
      // When unchecked, clear both fields
      setFormData(prev => ({
        ...prev,
        gp: '', // Clear GP value
        surgery: '' // Clear surgery value
      }));
      console.log('🔄 Unknown GP unchecked - clearing GP and Surgery fields');
    }
  };

  // Debounce timer refs
  const eircodeTimeoutRef = useRef(null);

  // WebhookDropdownCall function to fetch dropdown data from n8n
  // COMMENTED OUT - Now using centralized API via APICallFunction
  
  const WebhookDropdownCall = async () => {
    setIsLoadingDropdowns(true);
    console.log('🔄 Starting WebhookDropdownCall...');

    try {
      const requestBody = createWebhookRequestBody(WEBHOOK_CONFIG.WORKFLOW_TYPES.LOOKUPS);
      console.log('📤 Request body:', requestBody);
      console.log('🌐 Webhook URL:', WEBHOOK_CONFIG.LOOKUPS_WEBHOOK);

      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, requestBody);
      console.log('📥 Response status:', response.status);
      debugger;
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Raw webhook response:', data);

        // Handle different response structures
        let parsedData;

        // Check if response is an array (n8n often returns arrays)
        if (Array.isArray(data) && data.length > 0) {
          console.log('📦 Response is an array, using first element...');
          const firstElement = data[0];

          // Check if the first element has a 'data' field with JSON string
          if (firstElement.data && typeof firstElement.data === 'string') {
            try {
              console.log('🔍 Parsing array[0].data as JSON string...');
              parsedData = JSON.parse(firstElement.data);
              console.log('✅ Successfully parsed array[0].data:', parsedData);
            } catch (parseError) {
              console.error('❌ Error parsing array[0].data as JSON:', parseError);
              console.log('📄 Raw array[0].data value:', firstElement.data);

              // Try to fix malformed JSON
              try {
                console.log('🔧 Attempting to fix malformed JSON...');
                let fixedData = firstElement.data;

                // Fix common JSON issues
                fixedData = fixedData.replace(/,\s*,/g, ','); // Remove double commas
                fixedData = fixedData.replace(/,\s*}/g, '}'); // Remove trailing commas before }
                fixedData = fixedData.replace(/,\s*]/g, ']'); // Remove trailing commas before ]

                // Fix missing array brackets for Doctors and Surgeries
                fixedData = fixedData.replace(/"Doctors":\s*,/, '"Doctors":[],'); // Handle missing Doctors array
                fixedData = fixedData.replace(/,"Surgeries":\s*,/, ',"Surgeries":[],'); // Handle missing Surgeries array

                // Fix incomplete arrays by adding proper closing brackets
                if (fixedData.includes('"Doctors":[') && !fixedData.includes('],"Surgeries"')) {
                  fixedData = fixedData.replace(/("Doctors":\[.*?),("Surgeries")/, '$1],$2');
                }

                console.log('🔧 Fixed JSON data:', fixedData);
                parsedData = JSON.parse(fixedData);
                console.log('✅ Successfully parsed fixed JSON data:', parsedData);
              } catch (fixError) {
                console.error('❌ Failed to fix malformed JSON:', fixError);
                return;
              }
            }
          } else {
            console.log('📦 Using array[0] as object...');
            parsedData = firstElement;
          }
        }
        // Check if data is in 'data' field as string (common n8n format)
        else if (data.data && typeof data.data === 'string') {
          try {
            console.log('🔍 Parsing data.data as JSON string...');
            parsedData = JSON.parse(data.data);
            console.log('✅ Successfully parsed data.data:', parsedData);
          } catch (parseError) {
            console.error('❌ Error parsing data.data as JSON:', parseError);
            console.log('📄 Raw data.data value:', data.data);

            // Try to fix malformed JSON
            try {
              console.log('🔧 Attempting to fix malformed JSON...');
              let fixedData = data.data;

              // Fix common JSON issues
              fixedData = fixedData.replace(/,\s*,/g, ','); // Remove double commas
              fixedData = fixedData.replace(/,\s*}/g, '}'); // Remove trailing commas before }
              fixedData = fixedData.replace(/,\s*]/g, ']'); // Remove trailing commas before ]

              // Fix missing array brackets for Doctors and Surgeries
              fixedData = fixedData.replace(/"Doctors":\s*,/, '"Doctors":[],'); // Handle missing Doctors array
              fixedData = fixedData.replace(/,"Surgeries":\s*,/, ',"Surgeries":[],'); // Handle missing Surgeries array

              console.log('🔧 Fixed JSON data:', fixedData);
              parsedData = JSON.parse(fixedData);
              console.log('✅ Successfully parsed fixed JSON data:', parsedData);
            } catch (fixError) {
              console.error('❌ Failed to fix malformed JSON:', fixError);
              return;
            }
          }
        }
        // Check if data is in 'data' field as object
        else if (data.data && typeof data.data === 'object') {
          console.log('📦 Using data.data as object...');
          parsedData = data.data;
        }
        // Check if the response itself contains the arrays
        else if (data.Gender || data.Doctors || data.AppointmentTypes) {
          console.log('🎯 Using root data object...');
          parsedData = data;
        }
        else {
          console.error('❌ Unexpected response structure:', data);
          return;
        }

        console.log('🎉 Final parsed data:', parsedData);
        console.log('👥 Gender array length:', parsedData.Gender?.length || 0);
        console.log('👨‍⚕️ Doctors array length:', parsedData.Doctors?.length || 0);
        console.log('📋 AppointmentTypes array length:', parsedData.AppointmentTypes?.length || 0);

        // Filter and clean the data
        const cleanGender = (parsedData.Gender || []).filter(item =>
          item.Id && item.Id !== 0 && item.GenderName && item.GenderName.trim() !== ''
        );

        const cleanDoctors = (parsedData.Doctors || []).filter(item =>
          item.GPID && item.GPID !== 0 && item.GPName && item.GPName.trim() !== ''
        ).map(item => ({
          GPID: item.GPID,
          GPName: item.GPName,
          SurgeryID: item.SurgeryID,
          RegisterationType: item.RegisterationType // Include RegisterationType with fallback
        }));

        const cleanAppointmentTypes = (parsedData.AppointmentTypes || []).filter(item =>
          item.CaseTypeID && item.CaseType && item.CaseType.trim() !== ''
        );

        // Handle surgeries - use provided Surgeries array or extract from doctors
        let cleanSurgeries = [];
        if (parsedData.Surgeries && Array.isArray(parsedData.Surgeries)) {
          // Use provided Surgeries array if available
          cleanSurgeries = parsedData.Surgeries.filter(item =>
            item.SurgeryID && item.SurgeryID !== 0 && item.SurgeryName && item.SurgeryName.trim() !== ''
          );
          console.log('🏥 Using provided Surgeries array:', cleanSurgeries);
        } else {
          // Fallback: Extract unique surgeries from doctors array
          console.log('🏥 No Surgeries array found, extracting from doctors...');
          if (cleanDoctors && Array.isArray(cleanDoctors)) {
            const surgeryMap = new Map();
            cleanDoctors.forEach(doctor => {
              if (doctor.SurgeryID && doctor.SurgeryID !== 0 && !surgeryMap.has(doctor.SurgeryID)) {
                surgeryMap.set(doctor.SurgeryID, {
                  SurgeryID: doctor.SurgeryID,
                  SurgeryName: `Surgery ${doctor.SurgeryID}` // Placeholder name since surgery names aren't provided
                });
              }
            });
            cleanSurgeries = Array.from(surgeryMap.values());
          }
        }

        // Handle complaints - filter and clean the data
        const cleanComplaints = (parsedData.Complaints || []).filter(item =>
          item.ComplaintID && item.ComplaintID !== 0 && item.Complaint && item.Complaint.trim() !== ''
        );
        console.log('📋 Complaints array length:', cleanComplaints.length);

        // Update dropdown data state
        const newDropdownData = {
          gender: cleanGender,
          doctors: cleanDoctors,
          surgeries: cleanSurgeries,
          appointmentTypes: cleanAppointmentTypes,
          complaints: cleanComplaints
        };

        console.log('💾 Setting dropdown data:', newDropdownData);
        setDropdownData(newDropdownData);

      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch dropdown data:', response.status, response.statusText);
        console.error('📄 Error response body:', errorText);
      }
    } catch (error) {
      console.error('💥 Error fetching dropdown data:', error);
      console.error('🔍 Error details:', error.message);
    } finally {
      setIsLoadingDropdowns(false);
      console.log('✅ WebhookDropdownCall completed');
    }
  };
  

  // Function to parse direct API response data (no webhook wrapper)
  const parseDirectApiResponse = (data) => {
    console.log('🔄 Parsing direct API response...');
    console.log('🎉 Raw API data:', data);
    console.log('👥 Gender array length:', data.Gender?.length || 0);
    console.log('👨‍⚕️ Doctors array length:', data.Doctors?.length || 0);
    console.log('📋 AppointmentTypes array length:', data.AppointmentTypes?.length || 0);
    console.log('🏥 Surgeries array length:', data.Surgeries?.length || 0);

    // Filter and clean the data
    const cleanGender = (data.Gender || []).filter(item =>
      item.Id && item.Id !== 0 && item.GenderName && item.GenderName.trim() !== ''
    );

    const cleanDoctors = (data.Doctors || []).filter(item =>
      item.GPID && item.GPID !== 0 && item.GPName && item.GPName.trim() !== ''
    ).map(item => ({
      GPID: item.GPID,
      GPName: item.GPName,
      SurgeryID: item.SurgeryID,
      RegisterationType: item.RegisterationType // Include RegisterationType with fallback
    }));

    const cleanAppointmentTypes = (data.AppointmentTypes || []).filter(item =>
      item.CaseTypeID && item.CaseType && item.CaseType.trim() !== ''
    );

    // Handle surgeries - use provided Surgeries array
    let cleanSurgeries = [];
    if (data.Surgeries && Array.isArray(data.Surgeries)) {
      cleanSurgeries = data.Surgeries.filter(item =>
        item.SurgeryID && item.SurgeryID !== 0 && item.SurgeryName && item.SurgeryName.trim() !== ''
      );
      console.log('🏥 Using provided Surgeries array:', cleanSurgeries);
    } else {
      // Fallback: Extract unique surgeries from doctors array
      console.log('🏥 No Surgeries array found, extracting from doctors...');
      if (cleanDoctors && Array.isArray(cleanDoctors)) {
        const surgeryMap = new Map();
        cleanDoctors.forEach(doctor => {
          if (doctor.SurgeryID && doctor.SurgeryID !== 0 && !surgeryMap.has(doctor.SurgeryID)) {
            surgeryMap.set(doctor.SurgeryID, {
              SurgeryID: doctor.SurgeryID,
              SurgeryName: `Surgery ${doctor.SurgeryID}` // Placeholder name since surgery names aren't provided
            });
          }
        });
        cleanSurgeries = Array.from(surgeryMap.values());
      }
    }

    // Add "All" option at the beginning of surgeries
    if (cleanSurgeries.length > 0) {
      cleanSurgeries.unshift({ SurgeryID: 'all', SurgeryName: 'All' });
    }

    // Return structured data
    const result = {
      gender: cleanGender,
      doctors: cleanDoctors,
      surgeries: cleanSurgeries,
      appointmentTypes: cleanAppointmentTypes
    };

    console.log('💾 Parsed direct API data:', result);
    return result;
  };

  // COMMENTED OUT: Function to parse webhook response data (no longer using webhooks)
  
  const parseApiResponse = (data) => {
    console.log('🔄 Parsing webhook response...');

    // Handle different response structures from webhook
    let parsedData;

    // Check if response is an array (n8n often returns arrays)
    if (Array.isArray(data) && data.length > 0) {
      console.log('📦 Response is an array, using first element...');
      const firstElement = data[0];

      // Check if the first element has a 'data' field with JSON string
      if (firstElement.data && typeof firstElement.data === 'string') {
        try {
          console.log('🔍 Parsing array[0].data as JSON string...');
          parsedData = JSON.parse(firstElement.data);
          console.log('✅ Successfully parsed array[0].data:', parsedData);
        } catch (parseError) {
          console.error('❌ Error parsing array[0].data as JSON:', parseError);
          console.log('📄 Raw array[0].data value:', firstElement.data);
          throw parseError;
        }
      } else {
        console.log('📦 Using array[0] as object...');
        parsedData = firstElement;
      }
    }
    // Check if data is in 'data' field as string (common n8n format)
    else if (data.data && typeof data.data === 'string') {
      try {
        console.log('🔍 Parsing data.data as JSON string...');
        parsedData = JSON.parse(data.data);
        console.log('✅ Successfully parsed data.data:', parsedData);
      } catch (parseError) {
        console.error('❌ Error parsing data.data as JSON:', parseError);
        console.log('📄 Raw data.data value:', data.data);
        throw parseError;
      }
    }
    // Check if data is in 'data' field as object
    else if (data.data && typeof data.data === 'object') {
      console.log('📦 Using data.data as object...');
      parsedData = data.data;
    }
    // Check if the response itself contains the arrays (direct API response)
    else if (data.Gender || data.Doctors || data.AppointmentTypes) {
      console.log('🎯 Using root data object...');
      parsedData = data;
    }
    else {
      console.error('❌ Unexpected response structure:', data);
      throw new Error('Unexpected response structure');
    }

    console.log('🎉 Final parsed data:', parsedData);
    console.log('👥 Gender array length:', parsedData.Gender?.length || 0);
    console.log('👨‍⚕️ Doctors array length:', parsedData.Doctors?.length || 0);
    console.log('📋 AppointmentTypes array length:', parsedData.AppointmentTypes?.length || 0);
    console.log('🏥 Surgeries array length:', parsedData.Surgeries?.length || 0);

    // Filter and clean the data
    const cleanGender = (parsedData.Gender || []).filter(item =>
      item.Id && item.Id !== 0 && item.GenderName && item.GenderName.trim() !== ''
    );

    const cleanDoctors = (parsedData.Doctors || []).filter(item =>
      item.GPID && item.GPID !== 0 && item.GPName && item.GPName.trim() !== ''
    ).map(item => ({
      GPID: item.GPID,
      GPName: item.GPName,
      SurgeryID: item.SurgeryID,
      RegisterationType: item.RegisterationType // Include RegisterationType with fallback
    }));

    const cleanAppointmentTypes = (parsedData.AppointmentTypes || []).filter(item =>
      item.CaseTypeID && item.CaseType && item.CaseType.trim() !== ''
    );

    // Handle surgeries - use provided Surgeries array
    let cleanSurgeries = [];
    if (parsedData.Surgeries && Array.isArray(parsedData.Surgeries)) {
      cleanSurgeries = parsedData.Surgeries.filter(item =>
        item.SurgeryID && item.SurgeryID !== 0 && item.SurgeryName && item.SurgeryName.trim() !== ''
      );
      console.log('🏥 Using provided Surgeries array:', cleanSurgeries);
    } else {
      // Fallback: Extract unique surgeries from doctors array
      console.log('🏥 No Surgeries array found, extracting from doctors...');
      if (cleanDoctors && Array.isArray(cleanDoctors)) {
        const surgeryMap = new Map();
        cleanDoctors.forEach(doctor => {
          if (doctor.SurgeryID && doctor.SurgeryID !== 0 && !surgeryMap.has(doctor.SurgeryID)) {
            surgeryMap.set(doctor.SurgeryID, {
              SurgeryID: doctor.SurgeryID,
              SurgeryName: `Surgery ${doctor.SurgeryID}` // Placeholder name since surgery names aren't provided
            });
          }
        });
        cleanSurgeries = Array.from(surgeryMap.values());
      }
    }

    // Add "All" option at the beginning of surgeries
    if (cleanSurgeries.length > 0) {
      cleanSurgeries.unshift({ SurgeryID: 'all', SurgeryName: 'All' });
    }

    // Return structured data
    const result = {
      gender: cleanGender,
      doctors: cleanDoctors,
      surgeries: cleanSurgeries,
      appointmentTypes: cleanAppointmentTypes
    };

    console.log('💾 Parsed webhook data:', result);
    return result;
  };
  

  // APICallFunction to fetch dropdown data from centralized API (direct call with CORS handling)
  
  const APICallFunction = async () => {
    setIsLoadingDropdowns(true);
    console.log('🔄 Starting APICallFunction...');

    try {
      // Direct API call to centralized endpoint
      const apiUrl = 'https://ooh_web.vitonta.com/AppBooking/GetPatientInfoPreReqs';
      console.log('🌐 API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        mode: 'cors', // Explicitly set CORS mode
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Raw API response:', data);

        // Parse the API response directly
        const parsedData = parseDirectApiResponse(data);
        console.log('💾 Setting dropdown data from API:', parsedData);
        setDropdownData(parsedData);
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to fetch dropdown data:', response.status, response.statusText);
        console.error('📄 Error response body:', errorText);
      }

    } catch (error) {
      console.error('💥 Error in APICallFunction:', error);
      console.error('🔍 Error details:', error.message);

      // If CORS error, provide helpful message
      if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
        console.error('🚫 CORS Error: The API server needs to allow cross-origin requests from this domain');
        console.error('💡 Solution: Ask the API team to add CORS headers or use a proxy server');
      }
    } finally {
      setIsLoadingDropdowns(false);
      console.log('✅ APICallFunction completed');
    }
  };

  // Function to get filtered GPs based on selected surgery
  const getFilteredGPs = () => {
    if (!formData.surgery || formData.surgery === '') {
      // Show all GPs when no surgery selected
      return dropdownData.doctors;
    } else {
      // Filter GPs by selected SurgeryID
      return dropdownData.doctors.filter(doctor =>
        doctor.SurgeryID && doctor.SurgeryID.toString() === formData.surgery.toString()
      );
    }
  };

  // Function to fetch complaint data from n8n webhook
  const fetchComplaintData = async () => {
    console.log('🔄 Fetching complaint data from webhook...');
    try {
      const requestBody = createWebhookRequestBody(WEBHOOK_CONFIG.WORKFLOW_TYPES.LOOKUPS, {
        requestType: 'complaints'
      });

      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, requestBody);

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Raw complaint webhook response:', data);

        // Parse complaint data from webhook response
        let complaints = [];

        // Handle different response formats
        if (Array.isArray(data) && data.length > 0) {
          if (data[0].data) {
            // Response wrapped in array with data field
            console.log('🔍 Processing array[0].data field...');
            console.log('📄 Raw data field type:', typeof data[0].data);
            console.log('📄 Raw data field content:', data[0].data);

            if (typeof data[0].data === 'string') {
              try {
                const parsedData = JSON.parse(data[0].data);
                complaints = parsedData.Complaints || [];
                console.log('✅ Successfully parsed JSON from data field');
              } catch (parseError) {
                console.error('❌ Error parsing JSON from data field:', parseError);

                // Try to manually fix the malformed JSON
                try {
                  console.log('🔧 Attempting to fix malformed JSON...');
                  let fixedData = data[0].data;

                  // Remove extra commas and fix array structure
                  fixedData = fixedData.replace(/,\s*,/g, ','); // Remove double commas
                  fixedData = fixedData.replace(/,\s*}/g, '}'); // Remove trailing commas before }
                  fixedData = fixedData.replace(/,\s*]/g, ']'); // Remove trailing commas before ]

                  // Fix incomplete JSON by ensuring proper closing
                  if (!fixedData.endsWith('}')) {
                    fixedData += '}';
                  }

                  console.log('🔧 Fixed JSON attempt:', fixedData);
                  const fixedParsedData = JSON.parse(fixedData);
                  complaints = fixedParsedData.Complaints || [];
                  console.log('✅ Successfully parsed fixed JSON data');
                } catch (fixError) {
                  console.error('❌ Failed to fix malformed JSON:', fixError);
                  console.log('🔍 Will try to extract complaints manually...');

                  // Last resort: try to extract complaints using regex
                  try {
                    const complaintsMatch = data[0].data.match(/"Complaints":\[(.*?)\]/s);
                    if (complaintsMatch) {
                      const complaintsStr = '[' + complaintsMatch[1] + ']';
                      complaints = JSON.parse(complaintsStr);
                      console.log('✅ Successfully extracted complaints using regex');
                    }
                  } catch (regexError) {
                    console.error('❌ Regex extraction also failed:', regexError);
                  }
                }
              }
            } else if (typeof data[0].data === 'object') {
              complaints = data[0].data.Complaints || [];
            }
          } else if (data[0].Complaints) {
            // Direct array with Complaints field
            complaints = data[0].Complaints;
          }
        } else if (data.Complaints) {
          // Direct object with Complaints field
          complaints = data.Complaints;
        }

        console.log('💾 Setting complaint data:', complaints);
        setDropdownData(prev => ({
          ...prev,
          complaints: complaints
        }));
      } else {
        console.error('❌ Failed to fetch complaint data:', response.status, response.statusText);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error('⏰ Complaint data fetch timed out');
      } else {
        console.error('💥 Error fetching complaint data:', error);
      }
    }
  };

  // Enhanced form validation with Irish mobile number validation
  const validateForm = () => {
    const errors = {};
    
    // Basic required field validation
    if (!formData.firstName.trim()) errors.firstName = translations[currentLanguage].firstNameRequired;
    if (!formData.lastName.trim()) errors.lastName = translations[currentLanguage].lastNameRequired;
    if (!formData.dateOfBirth) errors.dateOfBirth = translations[currentLanguage].dateOfBirthRequired;
    if (!formData.gender) errors.gender = translations[currentLanguage].genderRequired;
    
    // Enhanced Irish mobile number validation
    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = 'Phone number is required';
    } else {
      const validation = validateIrishMobileNumber(formData.phoneNumber);
      if (!validation.isValid) {
        errors.phoneNumber = validation.error;
      }
    }
      // Email validation helper function
    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };
    // Email validation - OPTIONAL (only validate format if provided)
    if (formData.email.trim() && !isValidEmail(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Validate GP and Surgery fields - required if Unknown GP is not checked
    if (!isUnknownGPChecked) {
      if (!formData.gp) errors.gp = 'General Practitioner is required';
      if (!formData.surgery) errors.surgery = 'Surgery is required';
    }
    
    // Current location validation - MANDATORY
    if (!formData.currentBuilding.trim()) errors.currentBuilding = 'Current location building is required';
    if (!formData.currentStreet.trim()) errors.currentStreet = 'Current location street is required';
    
    // Home location validation - MANDATORY (always required regardless of checkbox)
    if (!formData.homeBuilding.trim()) errors.homeBuilding = 'Home location building is required';
    if (!formData.homeStreet.trim()) errors.homeStreet = 'Home location street is required';
    
    // Set validation errors and show them
    setValidationErrors(errors);
    setShowValidationErrors(true);
    
    // Log validation results
    if (Object.keys(errors).length > 0) {
      console.log('❌ Form validation failed with errors:', errors);
    } else {
      console.log('✅ Form validation passed - all mandatory fields complete');
    }
    
    // Return true if no errors, false if there are errors
    return Object.keys(errors).length === 0;
  };

  // Function to handle complaint selection and priority checking
  const handleComplaintChange = (complaintIds) => {
    console.log('🔄 handleComplaintChange called with:', complaintIds);
    
    // Handle both single value and array of values for multi-select
    const idsArray = Array.isArray(complaintIds) ? complaintIds : [complaintIds];

    // Find all selected complaints
    const selectedComplaints = idsArray
      .filter(id => id) // Remove empty values
      .map(id => dropdownData.complaints.find(c => c.ComplaintID.toString() === id.toString()))
      .filter(Boolean); // Remove undefined values

    console.log('🔍 Selected complaints:', selectedComplaints);
    setSelectedComplaint(selectedComplaints.length > 0 ? selectedComplaints[0] : null);

    // Check if any selected complaint has emergency or urgent priority
    const hasEmergency = selectedComplaints.some(complaint => 
      complaint && complaint.Priority && complaint.Priority.toLowerCase() === 'emergency'
    );
    const hasUrgent = selectedComplaints.some(complaint => 
      complaint && complaint.Priority && complaint.Priority.toLowerCase() === 'urgent'
    );

    console.log('🚨 Priority check - Emergency:', hasEmergency, 'Urgent:', hasUrgent);

    if (hasEmergency) {
      setIsEmergencyOrUrgent(true);
      setPriorityMessage('**If you are experiencing a medical emergency, please call **📞 999 immediately.');
      setPriorityMessageColor('text-red-600 bg-red-50 border-red-200');
      console.log('🚨 Emergency priority detected - showing message');
    } else if (hasUrgent) {
      setIsEmergencyOrUrgent(true);
      setPriorityMessage('If your reason for contacting us is urgent, please call **📞 0818 123 456');
      setPriorityMessageColor('text-yellow-600 bg-yellow-50 border-yellow-200');
      console.log('⚠️ Urgent priority detected - showing message');
    } else {
      setIsEmergencyOrUrgent(false);
      setPriorityMessage('');
      setPriorityMessageColor('');
      console.log('✅ Normal priority - clearing messages');
    }

    // Force re-render by updating form data immediately
    setFormData(prev => ({
      ...prev,
      reasonForContact: idsArray
    }));
  };
  // Payment handler functions
  const handlePaymentSuccess = async (paymentResult) => {
    console.log('💳 Payment successful:', paymentResult);
    setPaymentSuccess(true);
    setPaymentError(null);

    try {
      // Make final booking confirmation call after successful payment
      if (reservedAppointment?.AppointmentID && patientID && reservedAppointment?.VisitID) {
        console.log('🔄 Making final booking confirmation call after payment...');
        
        const confirmationPayload = {
          "workflowtype": "book_appointment",
          "PatientID": patientID,
          "VisitID": reservedAppointment.VisitID,
          "CaseType": parseInt(formData.appointmentType) || 3,
          "TrCentreID": selectedClinic?.id || 0,
          "AppointmentID": reservedAppointment.AppointmentID,
          "StartTime": reservedAppointment.StartTime,
          "EndTime": reservedAppointment.EndTime,
          "Status": true, // True to confirm booking after payment
          "Email": formData.email || "",
          "VideoURL": ""
        };

        console.log('📤 Final booking confirmation payload:', confirmationPayload);

        const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, confirmationPayload);

        if (!response.ok) {
          console.error('❌ Final booking confirmation failed:', response.status, response.statusText);
        } else {
          const responseText = await response.text();
          console.log('📥 Raw final booking confirmation response:', responseText);

          if (responseText && responseText.trim() !== '') {
            try {
              const confirmationResult = JSON.parse(responseText);
              console.log('✅ Parsed final booking confirmation response:', confirmationResult);

              // Handle nested data structure if present
              if (confirmationResult.data && typeof confirmationResult.data === 'string') {
                try {
                  const nestedData = JSON.parse(confirmationResult.data);
                  console.log('✅ Final booking confirmed with details:', nestedData);

                  // Check if this is a successful booking confirmation
                  const isSuccessfulBooking = confirmationPayload.workflowtype === "book_appointment" &&
                                            confirmationPayload.Status === true &&
                                            nestedData.AppointmentID;

                  // Update reservation with final confirmation data
                  setReservedAppointment(prev => ({
                    ...prev,
                    Status: nestedData.Status || 'Confirmed',
                    AppointmentID: nestedData.AppointmentID || prev.AppointmentID,
                    CaseNo: nestedData.CaseNo || prev.CaseNo, // Capture Case Number
                    TrCentreName: nestedData.TrCentreName || prev.TrCentreName,
                    TrCentreAddress: nestedData.TrCentreAddress || prev.TrCentreAddress,
                    PatientName: nestedData.PatientName || prev.PatientName,
                    ContactNo: nestedData.ContactNo || prev.ContactNo,
                    Email: nestedData.Email || prev.Email
                  }));

                  // Trigger confirmation emails if booking was successful
                  if (isSuccessfulBooking) {
                    console.log('🎯 Successful booking detected, triggering confirmation emails...');
                    await sendConfirmationEmails(nestedData);
                  }

                } catch (parseError) {
                  console.log('📋 Final booking confirmation data:', confirmationResult);
                }
              } else {
                // Handle direct response without nested data
                console.log('📋 Final booking confirmation completed:', confirmationResult);

                // Check if this is a successful booking confirmation
                const isSuccessfulBooking = confirmationPayload.workflowtype === "book_appointment" &&
                                          confirmationPayload.Status === true &&
                                          confirmationResult.AppointmentID;

                // Update with direct response data if available
                if (confirmationResult.CaseNo) {
                  setReservedAppointment(prev => ({
                    ...prev,
                    CaseNo: confirmationResult.CaseNo,
                    Status: confirmationResult.Status || 'Confirmed'
                  }));
                }

                // Trigger confirmation emails if booking was successful
                if (isSuccessfulBooking) {
                  console.log('🎯 Successful booking detected, triggering confirmation emails...');
                  await sendConfirmationEmails(confirmationResult);
                }
              }
            } catch (parseError) {
              console.log('📋 Final booking confirmation response (text):', responseText);
            }
          }
        }
      } else {
        console.warn('⚠️ Missing required data for final booking confirmation:', {
          appointmentID: reservedAppointment?.AppointmentID,
          patientID,
          visitID: reservedAppointment?.VisitID
        });
      }
    } catch (error) {
      console.error('❌ Error in final booking confirmation:', error);
      // Don't block the success flow if confirmation fails
    }

    // Generate booking reference and show success popup
    const reference = `SIR${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    setBookingReference(reference);
    setShowSuccessPopup(true);

    // Stop the timer when booking is completed
    stopTimer();

    // Prepare booking data for backend submission with comma-separated reasonForContact IDs
    const bookingDataForSubmission = {
      ...formData,
      reasonForContact: Array.isArray(formData.reasonForContact)
        ? formData.reasonForContact.join(',')
        : formData.reasonForContact || ''
    };

    console.log('📋 Booking data prepared for submission:', bookingDataForSubmission);
    console.log('🔗 Reason for Contact IDs (comma-separated):', bookingDataForSubmission.reasonForContact);
  };
    // Place this function near other handler functions, after handlePaymentSuccess and before handleSuccessPopupClose
  
  // Function to send confirmation emails after successful booking
  const sendConfirmationEmails = async (bookingData) => {
    try {
      console.log('📧 Sending confirmation emails for booking:', bookingData);

       // Generate dynamic video URLs based on AppointmentID and PatientID
      const appointmentID = bookingData.AppointmentID || reservedAppointment?.AppointmentID || 0;
      const currentPatientID = patientID || bookingData.PatientID || 0;

      // Get current domain for video URLs
      const currentDomain = window.location.origin;
      const roomName = `room-visit-${appointmentID}`;
      
      const patientIdentity = `patient_${currentPatientID}`;
      const practiceIdentity = `practice_${bookingData.PracticeID || '0'}`; // ensure PracticeID is available

      const practiceVideoURL = `${currentDomain}/practice-call/${roomName}?identity=${practiceIdentity}`;
      const patientVideoURL = `${currentDomain}/video-call/${roomName}?identity=${patientIdentity}`;

      // // Generate dynamic video URLs
      // const practiceVideoURL = `${currentDomain}/practice-call/${roomName}`;
      // const patientVideoURL = `${currentDomain}/video-call/${roomName}`;

      console.log('🎥 Generated video URLs:', {
        appointmentID,
        patientID: currentPatientID,
        roomName,
        practiceVideoURL,
        patientVideoURL
      });


      // Extract data from the booking response
      const confirmationPayload = {
        "workflowtype": "send_confirmation_emails",
        "TrCentreName": bookingData.TrCentreName || selectedClinic?.name || "",
        "PatientName": bookingData.PatientName || `${formData.firstName} ${formData.lastName}`.trim() || "",
        "ContactNo": bookingData.ContactNo || formData.phoneNumber || "",
        "Email": bookingData.Email || formData.email || "",
        "CaseNo": bookingData.CaseNo || "",
        "AppointmentID": appointmentID,
        "PatientID": currentPatientID,
        "AppointmentType": bookingData.AppointmentType || (formData.appointmentType === "1" ? "Video Consult" : "Face 2 Face"),
        "Price": bookingData.Price || paymentAmount || 0,
        "practiceVideoURL": practiceVideoURL ,
        "TrCentreAddress": bookingData.TrCentreAddress || selectedClinic?.address || "",
        "TrCentreLatitude": bookingData.TrCentreLatitude || selectedClinic?.latitude || "",
        "TrCentreLongitude": bookingData.TrCentreLongitude || selectedClinic?.longitude || "",
        "StartTime": bookingData.StartTime || reservedAppointment?.StartTime || "",
        "EndTime": bookingData.EndTime || reservedAppointment?.EndTime || "",
        "patientVideoURL": patientVideoURL,
        "roomName": roomName
      };

      console.log('📤 Confirmation email payload:', confirmationPayload);

      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, confirmationPayload);

      if (!response.ok) {
        console.error('❌ Confirmation email sending failed:', response.status, response.statusText);
        // Don't throw error - email failure shouldn't break the booking flow
        return false;
      }

      const responseText = await response.text();
      console.log('📥 Confirmation email response:', responseText);

      if (responseText && responseText.trim() !== '') {
        try {
          const emailResult = JSON.parse(responseText);
          console.log('✅ Confirmation emails sent successfully:', emailResult);
          return true;
        } catch (parseError) {
          console.log('📧 Confirmation email sent (text response):', responseText);
          return true;
        }
      }

      return true;
    } catch (error) {
      console.error('❌ Error sending confirmation emails:', error);
      // Don't throw error - email failure shouldn't break the booking flow
      return false;
    }
  };

  // Add function to handle directions
  const handleGetDirections = async () => {
    try {
      console.log('🗺️ Getting directions for appointment...');
      
      if (!reservedAppointment?.AppointmentID || !patientID || !reservedAppointment?.VisitID) {
        console.error('❌ Missing required data for directions request');
        return;
      }

      const directionsPayload = {
        "workflowtype": "book_appointment",
        "PatientID": patientID,
        "VisitID": reservedAppointment.VisitID,
        "CaseType": parseInt(formData.appointmentType) || 3,
        "TrCentreID": selectedClinic?.id || 0,
        "AppointmentID": reservedAppointment.AppointmentID,
        "StartTime": reservedAppointment.StartTime,
        "EndTime": reservedAppointment.EndTime,
        "Status": true,
        "VideoURL": ""
      };

      console.log('📤 Directions request payload:', directionsPayload);

      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, directionsPayload);

      if (!response.ok) {
        console.error('❌ Directions request failed:', response.status, response.statusText);
        return;
      }

      const responseText = await response.text();
      console.log('📥 Raw directions response:', responseText);

      if (responseText && responseText.trim() !== '') {
        try {
          const directionsResult = JSON.parse(responseText);
          console.log('✅ Parsed directions response:', directionsResult);

          let latitude, longitude;

          // Handle nested data structure if present
          if (directionsResult.data && typeof directionsResult.data === 'string') {
            try {
              const nestedData = JSON.parse(directionsResult.data);
              console.log('✅ Parsed nested directions data:', nestedData);
              latitude = nestedData.TrCentreLatitude;
              longitude = nestedData.TrCentreLongitude;

            } catch (parseError) {
              console.error('❌ Failed to parse nested directions data:', parseError);
              latitude = directionsResult.TrCentreLatitude;
              longitude = directionsResult.TrCentreLongitude;
            }
          } else {
            latitude = directionsResult.TrCentreLatitude;
            longitude = directionsResult.TrCentreLongitude;
          }

          console.log('📍 Extracted coordinates:', { latitude, longitude });

          if (latitude && longitude) {
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
            console.log('🗺️ Opening Google Maps:', googleMapsUrl);
            window.open(googleMapsUrl, '_blank');
          } else {
            console.error('❌ No coordinates found in response');
            // Fallback to clinic address if available
            if (selectedClinic?.address) {
              const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedClinic.address)}`;
              console.log('🗺️ Opening Google Maps with address fallback:', fallbackUrl);
              window.open(fallbackUrl, '_blank');
            }
          }
        } catch (parseError) {
          console.error('❌ Failed to parse directions response:', parseError);
        }
      }
    } catch (error) {
      console.error('❌ Error getting directions:', error);
    }
  };

  const handlePaymentError = (error) => {
    console.error('💳 Payment failed:', error);
    setPaymentError(error);
    setPaymentSuccess(false);
  };
  // Debounce timer ref for reason text search
  const reasonSearchTimeoutRef = useRef(null);

  // Age calculation function
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;

    const today = new Date();
    const birthDate = new Date(dateOfBirth);

    // Check if the birth date is valid
    if (isNaN(birthDate.getTime())) return null;

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  // Function to extract advance payment from webhook response
  // Add state for correspondence checkboxes
  const [currentLocationCorrespondence, setCurrentLocationCorrespondence] = useState(false);
  const [homeLocationCorrespondence, setHomeLocationCorrespondence] = useState(false);

  // Handle correspondence checkbox changes (only one can be selected at a time)
  const handleCurrentLocationCorrespondenceChange = (e) => {
    const isChecked = e.target.checked;
    setCurrentLocationCorrespondence(isChecked);
    if (isChecked) {
      setHomeLocationCorrespondence(false);
    }
  };

  const handleHomeLocationCorrespondenceChange = (e) => {
    const isChecked = e.target.checked;
    setHomeLocationCorrespondence(isChecked);
    if (isChecked) {
      setCurrentLocationCorrespondence(false);
    }
  };
  const extractAdvancePayment = (responseData) => {
    try {
      console.log('🔍 Extracting advance payment from:', responseData);
      
      // Check if responseData has a data field that's a string
      if (responseData && responseData.data && typeof responseData.data === 'string') {
        // Parse the stringified JSON
        const parsedData = JSON.parse(responseData.data);
        console.log('✅ Parsed data field:', parsedData);
        
        // Check if AdvPayment exists and has its own AdvPayment property
        if (parsedData.AdvPayment && parsedData.AdvPayment.AdvPayment) {
          const paymentValue = parsedData.AdvPayment.AdvPayment;
          const numericValue = parseInt(paymentValue.replace(/[^0-9]/g, '')) || 0;
          
          console.log('💰 Extracted payment:', { display: paymentValue, numeric: numericValue });
          return { displayValue: paymentValue, numericValue: numericValue };
        }
      }
      
      // Default to zero if AdvPayment not found
      return { displayValue: '€0', numericValue: 0 };
    } catch (error) {
      console.error('❌ Error extracting advance payment:', error);
      return { displayValue: '€45', numericValue: 45 };
    }
  };

  // Usage example in your webhook handler:
  const handleClinicWebhookResponse = (responseData) => {
    // Extract advance payment
    const advancePayment = extractAdvancePayment(responseData);
    
    // Update clinic data with the advance payment
    const updatedClinic = {
      ...selectedClinic,
      advancePayment: advancePayment.displayValue,
      advancePaymentValue: advancePayment.numericValue
    };
    
    setSelectedClinic(updatedClinic);
    
    // Update payment amount if needed
    if (advancePayment.numericValue > 0) {
      setPaymentAmount(advancePayment.numericValue);
    }
    
    console.log('💰 Updated clinic with advance payment:', updatedClinic);
  };

  // Age validation function
  const validateAge = (dateOfBirth) => {
    const age = calculateAge(dateOfBirth);

    if (age === null) {
      setAgeValidationError('Please enter a valid date of birth.');
      setIsAgeInvalid(true);
      return false;
    }

    if (age < 3) {
      setAgeValidationError('Patients under 3 years of age cannot book online. Please call 📞 0818 123 456');
      setIsAgeInvalid(true);
      return false;
    }

    if (age > 75) {
      setAgeValidationError('Patients over 75 years of age cannot book online. Please call 📞 0818 123 456');
      setIsAgeInvalid(true);
      return false;
    }

    // Age is valid
    setAgeValidationError('');
    setIsAgeInvalid(false);
    return true;
  };

  /**
   * Programmatically selects multiple complaints in the dropdown
   * @param {Array<number|string>} complaintIds - Array of complaint IDs to select
   * @param {boolean} replaceExisting - Whether to replace existing selections (true) or add to them (false)
   * @param {Object} responseData - Optional raw response data to parse for complaints
   */
  const selectComplaints = (complaintIds, replaceExisting = false, responseData = null) => {
    // If responseData is provided, extract complaint IDs from it
    if (responseData) {
      console.log('🔍 Parsing response data to extract complaint IDs');
      
      try {
        let extractedIds = [];
        
        // Handle the specific nested structure from n8n webhook
        if (responseData.message && 
            responseData.message.content && 
            responseData.message.content.Complaints) {
          
          const complaints = responseData.message.content.Complaints;
          extractedIds = complaints.map(complaint => complaint.ComplaintID);
          console.log('✅ Successfully extracted complaint IDs from response:', extractedIds);
        } else {
          console.warn('⚠️ Response data does not match expected structure');
        }
        
        // If we extracted IDs, use those instead of the provided complaintIds
        if (extractedIds.length > 0) {
          complaintIds = extractedIds;
        }
      } catch (error) {
        console.error('❌ Error parsing response data:', error);
      }
    }
    
    // Validate input
    if (!Array.isArray(complaintIds) || complaintIds.length === 0) {
      console.warn('⚠️ No complaint IDs provided for selection');
      return;
    }

    // Convert all IDs to strings for consistent comparison
    const idsToSelect = complaintIds.map(id => id.toString());
    console.log('🎯 Attempting to select complaints with IDs:', idsToSelect);

    // Validate that the complaints exist in the dropdown options
    const availableComplaintIds = (dropdownData.complaints || []).map(c => c.ComplaintID.toString());
    const validIds = idsToSelect.filter(id => availableComplaintIds.includes(id));
    
    if (validIds.length < idsToSelect.length) {
      const invalidIds = idsToSelect.filter(id => !availableComplaintIds.includes(id));
    
      console.warn('⚠️ Some complaint IDs were not found in available options:', invalidIds);
    }

  
    if (validIds.length === 0) {
      console.error('❌ None of the provided complaint IDs exist in the dropdown options');
      return;
    }

    // Get current selections or empty array
    const currentSelections = formData.reasonForContact || [];
    
    // Create new selection array based on replace flag
    const newSelections = replaceExisting 
      ? [...validIds] // Replace existing with new selection
      : [...new Set([...currentSelections, ...validIds])]; // Add to existing (using Set to remove duplicates)
    
    // Update form data with new selections
    setFormData(prev => ({
      ...prev,
      reasonForContact: newSelections
    }));
    
    // Also trigger the complaint change handler to update priority messages
    handleComplaintChange(newSelections);
    
    // Force the SearchableDropdown to update its internal state by triggering a synthetic event
    // This ensures the dropdown displays the selected options correctly
    const syntheticEvent = {
      target: {
        name: 'reasonForContact',
        value: newSelections
      }
    };
    handleInputChange(syntheticEvent);
    
    console.log('✅ Successfully selected complaints:', newSelections);
  };

  // Simplified handleReasonTextSearch - only update text, no API calls
  const handleReasonTextSearch = (searchText) => {
    // Only update the search text immediately for UI responsiveness
    setReasonTextSearch(searchText);
    
    // Clear any existing timeouts
    if (reasonSearchTimeoutRef.current) {
      clearTimeout(reasonSearchTimeoutRef.current);
    }
    
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Stop any current searching indicator
    setIsSearchingReasons(false);
  };

  
  // Add currentLanguage as a dependency to any useEffect that renders UI text
  useEffect(() => {
    // Example of an effect that should re-run when language changes
    document.title = t('appTitle') || 'Booking';
  }, [currentLanguage]);

  // Add a blur handler for the text input
  

  // Clear text search field and dropdown selection
  const clearReasonTextSearch = () => {
    setReasonTextSearch('');
    setFormData(prev => ({
      ...prev,
      reasonForContact: []
    }));
    console.log('🔄 Reason for Contact cleared - both text field and dropdown selection');
  };

  // Load dropdown data on component mount
  useEffect(() => {
    WebhookDropdownCall();
  }, []);

  // Validate GMS Number on page load if it exists
  useEffect(() => {
    const trimmedGmsNumber = formData.gmsNumber?.trim();
    if (trimmedGmsNumber && trimmedGmsNumber.length >= 5 && trimmedGmsNumber.length <= 10) {
      validateGMSNumber(trimmedGmsNumber);
    }
  }, []); // Only run on mount

  // Eircode sanitization function
  const sanitizeEircode = (eircode) => {
    if (!eircode) return '';
    // Remove all spaces and convert to uppercase
    return eircode.replace(/\s+/g, '').toUpperCase();
  };

  // Simplified Eircode validation - remove hardcoded routing keys
  const isValidEircodeFormat = (eircode) => {
    const sanitized = sanitizeEircode(eircode);

    // Must be exactly 7 characters
    if (sanitized.length !== 7) return false;

    // Irish Eircode format: 3 alphanumeric + 4 alphanumeric (e.g., D02XY45)
    const eircodeRegex = /^[A-Z0-9]{3}[A-Z0-9]{4}$/;
    return eircodeRegex.test(sanitized);
  };

  // Remove the hardcoded routing key validation function
  // Real-time validation will happen through Google Maps API



  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const newFormData = {
      ...formData,
      [name]: value
    };

    // Auto-update fullName when firstName or lastName changes
    if (name === 'firstName') {
      newFormData.fullName = `${value} ${formData.lastName}`.trim();
    } else if (name === 'lastName') {
      newFormData.fullName = `${formData.firstName} ${value}`.trim();
    }

    // Handle GP selection - automatically select corresponding surgery (GP -> Surgery)
    if (name === 'gp' && value) {
      console.log('🔄 GP selected:', value);

      // Specific GP selected - find the selected doctor and auto-populate surgery
      const selectedDoctor = dropdownData.doctors.find(doctor => doctor.GPID.toString() === value.toString());
      if (selectedDoctor && selectedDoctor.SurgeryID) {
        console.log('✅ Auto-selecting surgery:', selectedDoctor.SurgeryID, 'for GP:', selectedDoctor.GPName);
        newFormData.surgery = selectedDoctor.SurgeryID.toString();
      } else {
        console.log('❌ No matching surgery found for GP:', value);
        newFormData.surgery = '';
      }
    }

    // Handle Surgery selection - clear GP selection to force user to choose from filtered list
    if (name === 'surgery' && value) {
      console.log('🔄 Surgery selected:', value);
      // Clear GP selection when surgery changes so user can see filtered GPs
      newFormData.gp = '';

  

  // You can now call this function from anywhere in your component
  // Example: selectComplaints([8, 57, 130], true);
      console.log('🏥 Specific surgery selected - filtering GPs for SurgeryID:', value);
    }

    // Handle Reason for Contact (Complaint) selection
    if (name === 'reasonForContact' && value) {
      handleComplaintChange(value);
    }

    // Handle Date of Birth validation
    if (name === 'dateOfBirth' && value) {
      // Validate age when date of birth changes
      validateAge(value);

      // Also validate DOB against GMS data if available
      if (gmsValidationData && gmsValidationData.DOB) {
        if (compareDates(value, gmsValidationData.DOB)) {
          setDobValidationError('');
        } else {
          <span className="mr-1">⚠️</span>
          setDobValidationError('DOB does not match');
        }
      }
    }

    // If checkbox is checked and a home location field is being updated,
    // also update the corresponding current location field
    if (useHomeAsCurrentLocation) {
      if (name === 'homeBuilding') newFormData.currentBuilding = value;
      else if (name === 'homeStreet') newFormData.currentStreet = value;
      else if (name === 'homeArea') newFormData.currentArea = value;
      else if (name === 'homeCity') newFormData.currentCity = value;
      else if (name === 'homeCountry') newFormData.currentCountry = value;
      else if (name === 'homePostcode') newFormData.currentPostcode = value;
      else if (name === 'homeEircode') newFormData.currentEircode = value;
    }

    setFormData(newFormData);

    // Trigger EirCode lookup when EirCode field changes
    if (name === 'eircode' || name === 'currentEircode') {
      // Clear previous timeout
      if (eircodeTimeoutRef.current) {
        clearTimeout(eircodeTimeoutRef.current);
      }

      // Clear error when user starts typing
      setEircodeError('');

      const sanitizedEircode = sanitizeEircode(value);

      if (value.length === 0) {
        // Clear current location fields when EirCode is cleared
        setFormData(prev => ({
          ...prev,
          currentBuilding: '',
          currentStreet: '',
          currentArea: '',
          currentCity: '',
          currentCountry: '',
          currentPostcode: ''
        }));
      } else if (sanitizedEircode.length >= 6) {
        // Debounce the API call - only trigger when we have enough characters
        eircodeTimeoutRef.current = setTimeout(() => {
          // Get the current value from the form data to ensure we're using the latest value
          const currentEircode = sanitizeEircode(newFormData[name]);
          if (currentEircode.length >= 6) {
            lookupEircode(currentEircode);
          }
        }, 1000);
      }
    }

    // Clear GMS error when user starts typing (but don't trigger validation)
    if (name === 'gmsNumber') {
      setGmsError('');

      if (value.length === 0) {
        // Clear validation data and expiry date when GMS Number is cleared
        setGmsValidationData(null);
        setFormData(prev => ({
          ...prev,
          gmsExpiry: ''
        }));
      }
    }
  };

  // Handle GMS Number field blur event
  const handleGmsNumberBlur = (e) => {
    const gmsNumber = e.target.value.trim();

    // Clear any existing errors first
    setGmsError('');
    setGmsValidationData(null);

    // If field is empty, no validation needed
    if (!gmsNumber) {
      return;
    }

    // Validate length - must be between 5 and 10 characters
    if (gmsNumber.length < 5) {
      setGmsError('GMS number must be at least 5 characters long');
      return;
    }

    if (gmsNumber.length > 10) {
      setGmsError('GMS number must not exceed 10 characters');
      return;
    }

    // If length is valid (5-10 characters), trigger API call
    console.log('🔍 GMS Number field blurred, triggering validation...', gmsNumber);
    validateGMSNumber(gmsNumber);
  };


  const handleClinicSelect = (clinic) => {
    // Note: Slot release now happens only when timer expires, not on clinic change

    if (selectedClinic?.id === clinic.id) {
      setSelectedClinic(null);
      setSelectedSlot(null);
    } else {
      setSelectedClinic(clinic);
      setSelectedSlot(null);

      // Update payment amount with clinic-specific price
      if (clinic.advancePaymentValue && !isVirtualAppointment()) {
        console.log('💰 Updating payment amount for selected clinic:', clinic.advancePaymentValue);
        setPaymentAmount(clinic.advancePaymentValue);
      }

      // Fetch appointment slots for the selected clinic (only if not already loading or loaded)
      if (clinic && clinic.id && !isLoadingSlots && !appointmentSlots[clinic.id]) {
        console.log('🏥 Fetching slots for selected clinic:', clinic.name, 'ID:', clinic.id, 'Type:', typeof clinic.id);
        fetchAppointmentSlots(clinic.id);
      } else if (appointmentSlots[clinic.id]) {
        console.log('🏥 Slots already loaded for clinic:', clinic.name, 'ID:', clinic.id);
      }
    }
  };

  // Remove the useEffect to prevent duplicate calls
  // The fetchAppointmentSlots is already called in handleClinicSelect

  
  const handleThemeChange = (themeKey) => {
    setCurrentTheme(themeKey);
    setShowThemeSelector(false);
    // Save theme to localStorage for persistence
    localStorage.setItem('careHQTheme', themeKey);
  };

  // Language change handler - fix for language switching issues
  const handleLanguageChange = (languageKey) => {
    console.log('🌐 Changing language from', currentLanguage, 'to', languageKey);
    setCurrentLanguage(languageKey);
    setShowLanguageSelector(false);
    saveLanguageToStorage(languageKey);
    
    // Force re-render to ensure all components update
    forceUpdate({});
    
    console.log('🌐 Language changed to:', languages[languageKey].name);
  };

  // Add a forceUpdate function to trigger re-render
  const [, forceUpdate] = useState({});

  // Ensure translations are properly loaded on component mount
  useEffect(() => {
    // Load saved language from localStorage
    const savedLanguage = localStorage.getItem('southDocLanguage') || 'en';
    if (savedLanguage !== currentLanguage) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  // Reset language to English after successful form submission
  const resetLanguageToEnglish = () => {
    if (currentLanguage !== 'en') {
      setCurrentLanguage('en');
      localStorage.setItem('southDocLanguage', 'en');
      console.log('🌐 Language reset to English after form submission');
    }
  };

  // Timer functions for appointment completion
  const startTimer = () => {
    if (isTimerActive) return; // Don't restart if already active
    
    setIsTimerActive(true);
    setShowTimer(true); // Show timer when started
    setTimeRemaining(180); // Reset to 3 minutes
    console.log('⏰ Starting 3-minute appointment timer');

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Timer expired - trigger slot release
          setIsTimerActive(false);
          clearInterval(timerRef.current);
          console.log('⏰ Timer expired - releasing slot');

          // Use setTimeout to ensure state is current when releasing slot
          setTimeout(() => {
            console.log('⏰ Timer expired callback executing...');

            // Get current values from refs (to avoid stale closure)
            const currentSlot = selectedSlotRef.current;
            const currentReservation = reservedAppointmentRef.current;

            console.log('🔍 Current state values from refs:', {
              selectedSlot: currentSlot,
              reservedAppointment: currentReservation,
              hasSlot: !!currentSlot,
              hasVisitID: !!currentReservation?.VisitID,
              hasAppointmentID: !!currentReservation?.AppointmentID,
              visitID: currentReservation?.VisitID,
              appointmentID: currentReservation?.AppointmentID
            });

            if (currentSlot && currentReservation?.VisitID && currentReservation?.AppointmentID) {
              console.log('🚀 All conditions met - Triggering slot release for timer expiration');
              console.log('📞 Calling releaseSlot with:', {
                visitID: currentReservation.VisitID,
                appointmentID: currentReservation.AppointmentID
              });
              releaseSlot(currentReservation.VisitID, currentReservation.AppointmentID);
            } else {
              console.log('⚠️ Cannot release slot - missing required data');
              console.log('❌ Missing data details:', {
                hasSlot: !!currentSlot,
                hasReservation: !!currentReservation,
                hasVisitID: !!currentReservation?.VisitID,
                hasAppointmentID: !!currentReservation?.AppointmentID
              });
            }
          }, 100);

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const resetTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setTimeRemaining(180); // Reset to 3 minutes
    setIsTimerActive(true);
    setShowTimer(true); // Ensure timer is visible
    console.log('⏰ Timer reset to 3 minutes');

    // Restart the timer
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setIsTimerActive(false);
          clearInterval(timerRef.current);
          console.log('⏰ Timer expired - releasing slot');

          // Use setTimeout to ensure state is current when releasing slot
          setTimeout(() => {
            console.log('⏰ Reset timer expired callback executing...');

            // Get current values from refs (to avoid stale closure)
            const currentSlot = selectedSlotRef.current;
            const currentReservation = reservedAppointmentRef.current;

            console.log('🔍 Current state values from refs:', {
              selectedSlot: currentSlot,
              reservedAppointment: currentReservation,
              hasSlot: !!currentSlot,
              hasVisitID: !!currentReservation?.VisitID,
              hasAppointmentID: !!currentReservation?.AppointmentID,
              visitID: currentReservation?.VisitID,
              appointmentID: currentReservation?.AppointmentID
            });

            if (currentSlot && currentReservation?.VisitID && currentReservation?.AppointmentID) {
              console.log('🚀 All conditions met - Triggering slot release for reset timer expiration');
              console.log('📞 Calling releaseSlot with:', {
                visitID: currentReservation.VisitID,
                appointmentID: currentReservation.AppointmentID
              });
              releaseSlot(currentReservation.VisitID, currentReservation.AppointmentID);
            } else {
              console.log('⚠️ Cannot release slot - missing required data');
              console.log('❌ Missing data details:', {
                hasSlot: !!currentSlot,
                hasReservation: !!currentReservation,
                hasVisitID: !!currentReservation?.VisitID,
                hasAppointmentID: !!currentReservation?.AppointmentID
              });
            }
          }, 100);

          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsTimerActive(false);
    setShowTimer(false); // Hide timer when stopped
    console.log('⏰ Timer stopped');
  };

  // Format time for display (MM:SS)
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };



  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleUseCurrentAsHomeLocation = (e) => {
    const isChecked = e.target.checked;
    setUseHomeAsCurrentLocation(isChecked);

    if (isChecked) {
      // Copy current location fields to home location fields
      setFormData(prev => ({
        ...prev,
        homeBuilding: prev.currentBuilding,
        homeStreet: prev.currentStreet,
        homeArea: prev.currentArea,
        homeCity: prev.currentCity,
        homeCountry: prev.currentCountry,
        homePostcode: prev.currentPostcode,
        homeEircode: prev.currentEircode
      }));
    }
  };

  // Generate random booking reference number
  const generateBookingReference = () => {
    const prefix = 'BK';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}${timestamp}${random}`;
  };

  // Handle booking completion
  const handleCompleteBooking = () => {
    const reference = generateBookingReference();
    setBookingReference(reference);
    setShowSuccessPopup(true);
  };

  // Handle success popup close
    const handleSuccessPopupClose = () => {
    // Note: Slot release now happens only when timer expires, not on reset

    // Remove the booking confirmation call - just do the reset
    setShowSuccessPopup(false);
    setCurrentStep(1);

    // Reset all form selections and data
    setSelectedClinic(null);
    setSelectedSlot(null);
    setBookingReference('');
    setPaymentAmount(DEFAULT_CONSULTATION_FEE); // Reset to default, will be updated from API
    setPaymentError(null);
    setPaymentSuccess(false);
    setValidationErrors({});
    setShowValidationErrors(false);
    setBookingError('');
    setPatientID(null);
    setReservedAppointment(null);

    // Reset form data to initial state
    setFormData({
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      gender: '',
      email: '',
      phone: '',
      gmsNumber: '',
      gmsExpiry: '',
      gp: '',
      surgery: '',
      appointmentType: '',
      reasonForContact: [],
      currentBuilding: '',
      currentStreet: '',
      currentArea: '',
      currentCity: '',
      currentCountry: '',
      currentPostcode: '',
      currentEircode: '',
      homeBuilding: '',
      homeStreet: '',
      homeArea: '',
      homeCity: '',
      homeCountry: '',
      homePostcode: '',
      homeEircode: ''
    });

    // Reset bypass button state
    setBypassValidation(false);
    setIsUnknownGPChecked(false);

    // Reset all other states...
    setGmsValidationData(null);
    setGmsError('');
    setIsLoadingGMS(false);
    setEircodeError('');
    setIsLoadingEircode(false);
    setIsLoadingLocation(false);

    // Reset validation errors that were missing
    setDobValidationError('');
    setAgeValidationError('');
    setIsAgeInvalid(false);

    // Reset explanation icon states
    setShowGmsInfo(false);
    setCoordinates({ latitude: null, longitude: null });
    setTreatmentCentres([]);
    setIsLoadingTreatmentCentres(false);
    setTreatmentCentresError('');
    setIsLoadingDropdowns(false);
    setDropdownData({ gender: [], doctors: [], surgeries: [], appointmentTypes: [], complaints: [] });
    setIsEmergencyOrUrgent(false);
    setPriorityMessage('');
    setPriorityMessageColor('');
    setSelectedComplaint(null);
    setReasonTextSearch('');
    setIsSearchingReasons(false);
    setUseHomeAsCurrentLocation(false);
    setCurrentLocationCorrespondence(false);
    setHomeLocationCorrespondence(false);
    setAppointmentSlots({});
    setIsLoadingSlots(false);
    setSlotsError('');
    setFilteredSlots([]);
    setAvailableDates([]);
    stopTimer();
    setTimeRemaining(180);
    setIsTimerActive(false);
    setShowTimer(false);
    setIsProcessingPayment(false);
    setIsBookingAppointment(false);
    setShowSignInPopup(false);
    setWebhookResponse(null);
    setIsLoadingWebhook(false);
    setShowThemeSelector(false);
    setShowLanguageSelector(false);
    setShowAllClinics(false);
    setSelectedDate(new Date());
    resetLanguageToEnglish();

    console.log('🔄 Reloading dropdown data after booking completion...');
    WebhookDropdownCall();
    console.log('🔄 Complete reset: All form data, states, and dropdowns have been reset');
  };

  // Webhook sign-in function - COMMENTED OUT (no longer using webhooks for dropdown data)
  
  const handleSignIn = async () => {
    setIsLoadingWebhook(true);
    setWebhookResponse(null);

    try {
      const requestBody = createWebhookRequestBody(WEBHOOK_CONFIG.WORKFLOW_TYPES.LOOKUPS);
      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, requestBody);

      if (response.ok) {
        const data = await response.json();
        setWebhookResponse(data);
        setShowSignInPopup(true);
      } else {
        // Handle non-JSON responses or errors
        const text = await response.text();
        setWebhookResponse({
          error: true,
          status: response.status,
          statusText: response.statusText,
          message: text || 'Failed to connect to webhook'
        });
        setShowSignInPopup(true);
      }
    } catch (error) {
      console.error('Webhook error:', error);
      setWebhookResponse({
        error: true,
        message: error.message || 'Network error occurred',
        details: 'Unable to connect to the webhook endpoint'
      });
      setShowSignInPopup(true);
    } finally {
      setIsLoadingWebhook(false);
    }
  };
  

  const handleSignInPopupClose = () => {
    setShowSignInPopup(false);
    setWebhookResponse(null);
  };

  // Function to render JSON data as a table
  const renderJsonAsTable = (data, parentKey = '') => {
    if (!data || typeof data !== 'object') {
      return (
        <div className="text-sm text-gray-600 p-2">
          {String(data)}
        </div>
      );
    }

    if (Array.isArray(data)) {
      return (
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h4 className="font-medium text-gray-700">Item {index + 1}</h4>
              </div>
              <div className="p-4">
                {renderJsonAsTable(item, `${parentKey}[${index}]`)}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const entries = Object.entries(data);
    if (entries.length === 0) {
      return <div className="text-sm text-gray-500 italic">Empty object</div>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Property
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Value
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map(([key, value]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {key}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {typeof value === 'object' && value !== null ? (
                    <div className="max-w-md">
                      {Array.isArray(value) ? (
                        <div className="space-y-2">
                          {value.map((item, idx) => (
                            <div key={idx} className="bg-gray-50 p-2 rounded text-xs">
                              {typeof item === 'object' ? JSON.stringify(item, null, 2) : String(item)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre className="text-xs bg-gray-50 p-2 rounded whitespace-pre-wrap">
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      )}
                    </div>
                  ) : (
                    <span className={`${
                      typeof value === 'string' ? 'text-green-600' :
                      typeof value === 'number' ? 'text-blue-600' :
                      typeof value === 'boolean' ? 'text-purple-600' :
                      'text-gray-600'
                    }`}>
                      {String(value)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    typeof value === 'string' ? 'bg-green-100 text-green-800' :
                    typeof value === 'number' ? 'bg-blue-100 text-blue-800' :
                    typeof value === 'boolean' ? 'bg-purple-100 text-purple-800' :
                    Array.isArray(value) ? 'bg-orange-100 text-orange-800' :
                    typeof value === 'object' ? 'bg-gray-100 text-gray-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {Array.isArray(value) ? 'array' : typeof value}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Add PatientID state
  const [patientID, setPatientID] = useState(null);

  // State for appointment booking
  const [isBookingAppointment, setIsBookingAppointment] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [reservedAppointment, setReservedAppointment] = useState(null);

  // Update refs when state changes for timer callbacks
  useEffect(() => {
    selectedSlotRef.current = selectedSlot;
  }, [selectedSlot]);

  useEffect(() => {
    reservedAppointmentRef.current = reservedAppointment;
  }, [reservedAppointment]);

  // Process appointment slots and properly group by date
  const processAppointmentSlots = (rawSlots) => {
    if (!rawSlots || !Array.isArray(rawSlots)) return [];

    console.log('🔄 Processing raw slots:', rawSlots);

    return rawSlots.map(slot => {
      const startTime = new Date(slot.AvailableStartTime);
      const endTime = new Date(slot.AvailableEndTime);

      // Format time in 24-hour format
      const startFormatted = startTime.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const endFormatted = endTime.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      // Extract date properly from AvailableStartTime
      const dateISO = slot.AvailableStartTime.split('T')[0]; // Extract YYYY-MM-DD
      
      console.log(`🕐 Slot: ${startFormatted} - ${endFormatted} | Date: ${dateISO} | StartTime: ${slot.AvailableStartTime}`);

      return {
        display: `${startFormatted} - ${endFormatted}`,
        startTime: slot.AvailableStartTime,
        endTime: slot.AvailableEndTime,
        date: startTime.toDateString(),
        dateISO: dateISO, // Extract date directly from ISO string
        trCenterID: slot.TrCenterID,
        trCentreName: slot.TrCentreName
      };
    });
  };

  // Fetch appointment slots from n8n webhook with PatientID
  const fetchAppointmentSlots = async (trCentreID) => {
    if (!trCentreID) {
      console.log('❌ No trCentreID provided to fetchAppointmentSlots');
      return;
    }

    if (!patientID) {
      console.log('❌ No PatientID available for fetchAppointmentSlots');
      return;
    }
    
    setIsLoadingSlots(true);
    setSlotsError('');
    console.log('🕐 Fetching appointment slots for clinic ID:', trCentreID, 'PatientID:', patientID);

    try {
      const requestBody = {
        workflowtype: "appointment_slots",
        type: "get_slots",
        trCentreID: trCentreID,
        PatientID: patientID,
      };

      console.log('📋 Appointment slots request:', requestBody);
      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, requestBody);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log('📋 Raw appointment slots response:', data);

      if (data.status === 'error') {
        throw new Error(`n8n webhook error: ${data.message || 'Unknown error'}`);
      }

      let slots = [];
      let parsedData = null;

      // Handle the nested JSON string structure from n8n
      if (data && data.data && typeof data.data === 'string') {
        try {
          parsedData = JSON.parse(data.data);
          console.log('✅ Parsed nested appointment slots data:', parsedData);
        } catch (parseError) {
          console.error('❌ Error parsing nested JSON data:', parseError);
          throw new Error('Failed to parse appointment slots data');
        }
      } else if (Array.isArray(data)) {
        parsedData = data;
      } else if (data && Array.isArray(data.data)) {
        parsedData = data.data;
      }

      if (parsedData && Array.isArray(parsedData)) {
        // Use the new processing function that properly handles date separation
        slots = processAppointmentSlots(parsedData);
        console.log('✅ Processed appointment slots with proper date separation:', slots);
      }

      // Update the appointment slots state
      setAppointmentSlots(prev => ({
        ...prev,
        [trCentreID]: slots
      }));

      // Extract and set available dates - this will now properly show multiple dates
      const dates = [...new Set(slots.map(slot => slot.dateISO))].sort();
      setAvailableDates(dates);
      console.log('📅 Available dates extracted (with proper date separation):', dates);

      // Auto-select first available date if none selected
      if (dates.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todayHasSlots = dates.includes(today);
        
        if (todayHasSlots) {
          setSelectedDate(new Date(today));
          console.log('📅 Auto-selected today with available slots:', today);
        } else {
          setSelectedDate(new Date(dates[0]));
          console.log('📅 Auto-selected first available date:', dates[0]);
        }
      }

      console.log('✅ Successfully loaded appointment slots with proper date grouping:', slots);
    } catch (error) {
      console.error('❌ Error fetching appointment slots:', error);
      setSlotsError(error.message || 'Failed to load appointment slots');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // Function to get clinics to display (top 5 or all)
  const getClinicsToDisplay = () => {
    const allClinics = getClinicsData();
    return showAllClinics ? allClinics : allClinics.slice(0, INITIAL_CLINICS_COUNT);
  };

  // Function to handle "View More" button click
  const handleViewMoreClinics = () => {
    setShowAllClinics(true);
  };

  // Function to filter slots by selected date
  const filterSlotsByDate = (slots, date) => {
    if (!slots || slots.length === 0) return [];

    const selectedDateString = date.toDateString();

    // If slots are objects with date information (from webhook)
    if (slots.length > 0 && typeof slots[0] === 'object' && slots[0].date) {
      return slots.filter(slot => slot.date === selectedDateString);
    }

    // If slots are simple strings (virtual appointments), return all for today
    if (slots.length > 0 && typeof slots[0] === 'string') {
      const today = new Date().toDateString();
      return selectedDateString === today ? slots : [];
    }

    return slots;
  };

  // Get available time slots based on appointment type and selected date - ALL from webhook
  const getAvailableTimeSlots = () => {
    // For ALL appointment types, return clinic-specific slots from webhook
    const clinicSlots = selectedClinic && appointmentSlots[selectedClinic.id]
      ? appointmentSlots[selectedClinic.id]
      : [];
    return filterSlotsByDate(clinicSlots, selectedDate);
  };

  // Function to get slots for the selected date only
  const getSlotsForSelectedDate = () => {
    if (!selectedClinic || !appointmentSlots[selectedClinic.id]) {
      return [];
    }
    
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    const clinicSlots = appointmentSlots[selectedClinic.id];
    
    // Filter slots by dateISO and return display format
    return clinicSlots.filter(slot => {
      return slot.dateISO === selectedDateStr;
    }).map(slot => slot.display);
  };

  // Function to get slots for a specific date string - properly filtered by actual date
   const getSlotsForDate = (dateStr) => {
    if (!selectedClinic || !appointmentSlots[selectedClinic.id]) {
      return [];
    }
    
    const clinicSlots = appointmentSlots[selectedClinic.id];
    
    // Filter slots by the specific date using dateISO
    const filteredSlots = clinicSlots.filter(slot => {
      return slot.dateISO === dateStr;
    });
    
    // Only log if there are no slots or if it's a different date than previously logged
    if (filteredSlots.length === 0) {
      console.log(`📅 No slots found for ${dateStr}`);
    }
    
    return filteredSlots;
  };

  // Get appointment type display name
  const getAppointmentTypeDisplay = () => {
    const selectedAppointmentType = dropdownData.appointmentTypes.find(
      type => type.CaseTypeID.toString() === formData.appointmentType.toString()
    );

    if (selectedAppointmentType) {
      return selectedAppointmentType.CaseType;
    }

    // Fallback to old logic for backward compatibility
    switch (formData.appointmentType) {
      case 'vc': return 'Video Consultation';
      case 'pc': return 'Phone Consultation';
      case 'ftf': return 'Face-to-Face Appointment';
      default: return 'Appointment';
    }
  };

  // Updated Eircode lookup with real-time validation
  const lookupEircode = async (searchInput) => {
    const trimmedInput = searchInput.trim();

    if (!trimmedInput || trimmedInput.length < 3) {
      if (trimmedInput.length > 0) {
        setEircodeError('Please enter at least 3 characters to search for an address.');
      } else {
        setEircodeError('Please enter an EirCode or address to search.');
      }
      return;
    }

    const sanitizedEircode = sanitizeEircode(trimmedInput);
    const isEircodeFormat = sanitizedEircode.length === 7 && isValidEircodeFormat(sanitizedEircode);

    // For Eircode format, let Google Maps API validate the routing key in real-time
    if (sanitizedEircode.length === 7 && !isEircodeFormat) {
      setEircodeError('Invalid EirCode format. Must be 3 letters/numbers + 4 letters/numbers (e.g., D02XY45)');
      return;
    }

    setIsLoadingEircode(true);
    setEircodeError('');

    // Determine search type and prepare search query
    const searchQuery = isEircodeFormat ? sanitizedEircode : trimmedInput;
    const searchType = isEircodeFormat ? 'EirCode' : 'address';

    console.log(`🔍 Starting ${searchType} lookup with Google Maps Geocoding API...`);
    console.log(`📝 Search query: "${searchQuery}"`);

    try {
      // Use Google Maps Geocoding API for address/EirCode lookup
      // For Eircode, restrict to Ireland; for general addresses, allow worldwide search
      let geocodingUrl;
      if (isEircodeFormat) {
        // Restrict Eircode searches to Ireland only
        geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&components=country:IE&region=ie&language=en&key=${GOOGLE_MAPS_API_KEY}`;
      } else {
        // Allow worldwide search for general addresses
        geocodingUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&language=en&key=${GOOGLE_MAPS_API_KEY}`;
      }
      console.log('🌍 Google Maps Geocoding API URL:', geocodingUrl);

      const response = await fetch(geocodingUrl);

      if (!response.ok) {
        throw new Error(`Google Maps Geocoding API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🌍 Google Maps Geocoding API response:', data);

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const addressComponents = result.address_components || [];

        // Extract address components using Google Maps structure
        const getComponent = (types) => {
          const component = addressComponents.find(comp =>
            types.some(type => comp.types.includes(type))
          );
          return component ? component.long_name : '';
        };

        // Enhanced address component extraction for Irish addresses
        const building = getComponent(['street_number', 'premise', 'subpremise']) || '';
        const street = getComponent(['route', 'street_address']) || '';
        const area = getComponent(['sublocality', 'neighborhood', 'sublocality_level_1']) || '';
        const city = getComponent(['locality', 'postal_town', 'administrative_area_level_2', 'administrative_area_level_1']) || '';
        const country = getComponent(['country']) || 'Ireland';
        const extractedEircode = getComponent(['postal_code']) || (isEircodeFormat ? sanitizedEircode : '');

        const addressData = {
          building,
          street,
          area,
          city,
          country,
          eircode: extractedEircode
        };

        console.log(`✅ Successfully retrieved address from Google Maps API (${searchType}):`, addressData);
        console.log('📋 Full formatted address:', result.formatted_address);

        // Store coordinates for treatment centres lookup
        const lat = result.geometry.location.lat;
        const lon = result.geometry.location.lng;
        setCoordinates({ latitude: lat, longitude: lon });
        console.log(`📍 Coordinates stored from ${searchType} lookup:`, { latitude: lat, longitude: lon });

        // Update current location fields with the found address
        setFormData(prev => ({
          ...prev,
          currentBuilding: addressData.building || '',
          currentStreet: addressData.street || '',
          currentArea: addressData.area || '',
          currentCity: addressData.city || '',
          currentCountry: addressData.country || 'Ireland',
          currentPostcode: addressData.eircode || (isEircodeFormat ? sanitizedEircode : ''),
          currentEircode: addressData.eircode || (isEircodeFormat ? sanitizedEircode : '')
        }));

        // Fetch treatment centres for the coordinates
        fetchTreatmentCentres(lat, lon);

        setEircodeError('');
      } else {
        console.log(`❌ No results found for ${searchType}:`, searchQuery, 'Status:', data.status);
        setEircodeError(`No address found for "${searchQuery}". Please verify the ${searchType.toLowerCase()} is correct and try again.`);
      }

    } catch (error) {
      console.error(`❌ Error looking up ${searchType}:`, error);
      setEircodeError('Error looking up address.');
    } finally {
      setIsLoadingEircode(false);
      console.log(`🏁 ${searchType} lookup completed`);
    }
  };

  // Function to fetch treatment centres based on coordinates
  const fetchTreatmentCentres = async (latitude, longitude) => {
    setIsLoadingTreatmentCentres(true);
    setTreatmentCentresError('');
    console.log('🏥 Fetching treatment centres for coordinates:', { latitude, longitude });

    try {
      const requestBody = {
        workflowtype: 'treatment_centres',
        type: 'get_treatment_centres',
        latitude: latitude,
        longitude: longitude
      };

      console.log('🌐 Treatment centres request body:', requestBody);

      const response = await fetch(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, {
        method: 'POST',
        headers: WEBHOOK_CONFIG.DEFAULT_HEADERS,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Treatment centres API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🏥 Raw treatment centres response:', data);

      // Handle response structure - check if data is wrapped in an array or has nested data field
      let treatmentResult = data;
      if (Array.isArray(data) && data.length > 0) {
        treatmentResult = data[0];
      }

      // Check if the data is nested inside a 'data' field as a JSON string
      if (treatmentResult && treatmentResult.data && typeof treatmentResult.data === 'string') {
        try {
          const parsedData = JSON.parse(treatmentResult.data);
          console.log('✅ Parsed nested treatment centres data:', parsedData);
          
          // Extract TrCentres array and AdvPayment from the parsed response
          if (parsedData && parsedData.TrCentres && Array.isArray(parsedData.TrCentres)) {
            console.log('✅ Successfully fetched treatment centres:', parsedData.TrCentres);
            setTreatmentCentres(parsedData.TrCentres);
            setTreatmentCentresError('');
            
            // Extract and set AdvPayment for consultation fee
            if (parsedData.AdvPayment && parsedData.AdvPayment.AdvPayment) {
              const advPaymentValue = parsedData.AdvPayment.AdvPayment;
              console.log('💰 AdvPayment found:', advPaymentValue);
              
              // Extract numeric value from the payment string (e.g., "€ 20" -> 20)
              const numericValue = parseInt(advPaymentValue.replace(/[^0-9]/g, '')) || 45;
              console.log('💰 Setting payment amount from AdvPayment:', numericValue);
              
              // Update payment amount for Stripe
              setPaymentAmount(numericValue);
            } else {
              console.log('⚠️ No AdvPayment found in response, using default amount');
              setPaymentAmount(DEFAULT_CONSULTATION_FEE); // Default fallback
            }
          } else {
            console.log('❌ No treatment centres found in parsed response');
            setTreatmentCentresError('No treatment centres found for your location');
            setTreatmentCentres([]);
          }
        } catch (parseError) {
          console.error('❌ Failed to parse nested treatment centres data:', parseError);
          setTreatmentCentresError('Invalid response format from server');
          return;
        }
      } else {
        console.log('❌ Unexpected response structure or missing data field');
        setTreatmentCentresError('Invalid response format from server');
        setTreatmentCentres([]);
      }

    } catch (error) {
      console.error('❌ Error fetching treatment centres:', error);
      setTreatmentCentresError('Failed to fetch treatment centres. Please try again.');
      setTreatmentCentres([]);
    } finally {
      setIsLoadingTreatmentCentres(false);
    }
  };

  // GMS Number validation function
  

  // Add these functions and state variables before the return statement
  const [availableDates, setAvailableDates] = useState([]);

  // Enhanced function to extract available dates from appointment slots
  const extractAvailableDates = (slots) => {
    if (!slots || Object.keys(slots).length === 0) return [];
    
    // Collect all unique dates from all clinics' slots
    const dates = new Set();
    
    // Iterate through all clinics' slots
    Object.values(slots).forEach(clinicSlots => {
      if (Array.isArray(clinicSlots)) {
        clinicSlots.forEach(slot => {
          if (slot.dateISO) {
            dates.add(slot.dateISO);
          } else if (slot.startTime) {
            // Extract date part from ISO string - this handles midnight crossover
            const dateStr = new Date(slot.startTime).toISOString().split('T')[0];
            dates.add(dateStr);
          }
        });
      }
    });
    
    // Convert to array and sort chronologically
    const sortedDates = Array.from(dates).sort();
    console.log('📅 Extracted available dates from webhook data:', sortedDates);
    
    return sortedDates;
  };

  // Update availableDates whenever appointmentSlots changes
  useEffect(() => {
    // Extract dates from all appointment slots for all clinics
    const allDates = new Set();
    
    Object.values(appointmentSlots).forEach(clinicSlots => {
      if (Array.isArray(clinicSlots)) {
        clinicSlots.forEach(slot => {
          if (slot.dateISO) {
            allDates.add(slot.dateISO);
          } else if (slot.startTime) {
            const dateStr = new Date(slot.startTime).toISOString().split('T')[0];
            allDates.add(dateStr);
          }
        });
      }
    });
    
    const dates = Array.from(allDates).sort();
    setAvailableDates(dates);
    console.log('📅 Updated available dates from all slots:', dates);
    
    // Auto-select appropriate date
    if (dates.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const currentSelectedDateStr = selectedDate.toISOString().split('T')[0];
      
      // If current selected date is not in available dates, select first available
      if (!dates.includes(currentSelectedDateStr)) {
        if (dates.includes(today)) {
          setSelectedDate(new Date(today));
          console.log('📅 Auto-selected today:', today);
        } else {
          setSelectedDate(new Date(dates[0]));
          console.log('📅 Auto-selected first available date:', dates[0]);
        }
      }
    }
  }, [appointmentSlots]);

  // Enhanced navigation functions with proper validation
  const goToPreviousDate = () => {
    const currentDateStr = selectedDate.toISOString().split('T')[0];
    const currentIndex = availableDates.indexOf(currentDateStr);
    const today = new Date().toISOString().split('T')[0];
    
    // Don't allow navigation to dates before today
    if (currentIndex > 0) {
      const previousDate = availableDates[currentIndex - 1];
      if (previousDate >= today) {
        const newDate = new Date(previousDate);
        setSelectedDate(newDate);
        console.log('📅 Navigated to previous date:', newDate.toDateString());
      }
    }
  };

  const goToNextDate = () => {
    const currentDateStr = selectedDate.toISOString().split('T')[0];
    const currentIndex = availableDates.indexOf(currentDateStr);
    
    if (currentIndex < availableDates.length - 1) {
      const newDate = new Date(availableDates[currentIndex + 1]);
      setSelectedDate(newDate);
      console.log('📅 Navigated to next date:', newDate.toDateString());
    }
  };

  // Helper functions to determine navigation button states
  const canNavigateToPrevious = () => {
    const currentDateStr = selectedDate.toISOString().split('T')[0];
    const currentIndex = availableDates.indexOf(currentDateStr);
    const today = new Date().toISOString().split('T')[0];
    
    // Can navigate previous if:
    // 1. Not at first available date AND
    // 2. Previous date is not before today
    if (currentIndex > 0) {
      const previousDate = availableDates[currentIndex - 1];
      return previousDate >= today;
    }
    return false;
  };

  const canNavigateToNext = () => {
    const currentDateStr = selectedDate.toISOString().split('T')[0];
    const currentIndex = availableDates.indexOf(currentDateStr);
    
    // Can navigate next if not at last available date
    return currentIndex < availableDates.length - 1 && currentIndex !== -1;
  };
  const validateGMSNumber = async (gmsNumber) => {
    if (!gmsNumber || gmsNumber.trim().length === 0) {
      setGmsValidationData(null);
      setGmsError('');
      return;
    }

    const trimmedGmsNumber = gmsNumber.trim();

    // Validate length - must be between 5 and 10 characters
    if (trimmedGmsNumber.length < 5) {
      setGmsError('GMS number must be at least 5 characters long');
      return;
    }

    if (trimmedGmsNumber.length > 10) {
      setGmsError('GMS number must not exceed 10 characters');
      return;
    }

    setIsLoadingGMS(true);
    setGmsError('');
    console.log('🔍 Starting GMS Number validation...', trimmedGmsNumber);

    try {
      const requestBody = createWebhookRequestBody('validate_gms', {
        type: 'get_gms_validation',
        gms_no: trimmedGmsNumber
      });

      console.log('📤 Sending GMS validation request:', requestBody);

      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, requestBody);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();
      console.log('📥 Raw GMS validation response:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ Failed to parse GMS validation response as JSON:', parseError);
        throw new Error('Invalid response format from server');
      }

      console.log('✅ Parsed GMS validation data:', data);

      // Handle response structure - check if data is wrapped in an array or has nested data field
      let validationResult = data;
      if (Array.isArray(data) && data.length > 0) {
        validationResult = data[0];
      }

      // Check if the data is nested inside a 'data' field as a JSON string
      if (validationResult && validationResult.data && typeof validationResult.data === 'string') {
        try {
          validationResult = JSON.parse(validationResult.data);
          console.log('✅ Parsed nested GMS data:', validationResult);
        } catch (parseError) {
          console.error('❌ Failed to parse nested GMS data:', parseError);
          setGmsError('Invalid response format from server');
          return;
        }
      }

      // Check if we have the expected data structure and PatientFound is true
      if (validationResult && validationResult.SchemeID && validationResult.PatientFound !== false) {
        // Convert both values to uppercase for case-insensitive comparison
        const inputGmsUpper = trimmedGmsNumber.toUpperCase();
        const schemeIdUpper = validationResult.SchemeID.toString().toUpperCase();

        console.log('🔍 Comparing GMS Numbers:', { input: inputGmsUpper, schemeId: schemeIdUpper });

        // If SchemeID matches the entered GMS Number (case-insensitive), populate the expiry date
        if (schemeIdUpper === inputGmsUpper) {
          console.log('✅ GMS validated successfully');
          setGmsValidationData(validationResult);

          // Validate DOB if both user DOB and GMS DOB are available
          if (formData.dateOfBirth && validationResult.DOB) {
            const userDOB = formData.dateOfBirth; // YYYY-MM-DD format from input
            const gmsDOB = validationResult.DOB; // ISO format from GMS

            console.log('🔍 Comparing DOB:', { userDOB, gmsDOB });

            if (compareDates(userDOB, gmsDOB)) {
              console.log('✅ DOB matches');
              setDobValidationError('');
            } else {
              console.log('❌ DOB does not match');
              setDobValidationError('DOB does not match');
            }
          } else {
            // Clear DOB error if no comparison can be made
            setDobValidationError('');
          }

          // Update the expiry date in form data - convert ISO date to YYYY-MM-DD format
          if (validationResult.ExpiryDate) {
            // Convert ISO date string to YYYY-MM-DD format for HTML date input
            const isoDate = validationResult.ExpiryDate;
            const formattedDate = isoDate.split('T')[0]; // Extract YYYY-MM-DD part
            console.log('📅 Converting expiry date:', { original: isoDate, formatted: formattedDate });

            setFormData(prev => ({
              ...prev,
              gmsExpiry: formattedDate
            }));
          }
        } else {
          console.log('⚠️ SchemeID does not match entered GMS Number');
          setGmsValidationData(null);
          setGmsError('No valid GMS data found');
        }
      } else {
        console.log('⚠️ No valid GMS data found in response or PatientFound is false');
        setGmsValidationData(null);
        setGmsError('No valid GMS data found');
      }

    } catch (error) {
      console.error('❌ Error validating GMS Number:', error);
      setGmsError('Error validating GMS Number.');
    } finally {
      setIsLoadingGMS(false);
      console.log('🏁 GMS validation completed');
    }
  };

  // Geolocation function using OpenStreetMap Nominatim API
  const getCurrentLocation = async () => {
    setIsLoadingLocation(true);
    setEircodeError('');
    console.log('🌍 Starting OpenStreetMap Nominatim geolocation request...');

    try {
      const locationData = await getLocationFromOSM();

      // Store coordinates for treatment centres lookup
      setCoordinates({
        latitude: locationData.latitude,
        longitude: locationData.longitude
      });
      console.log('📍 Coordinates stored from current location:', {
        latitude: locationData.latitude,
        longitude: locationData.longitude
      });

      // Update current location fields with the geocoded data
      setFormData(prev => ({
        ...prev,
        currentBuilding: locationData.components.building,
        currentStreet: locationData.components.street,
        currentArea: locationData.components.area,
        currentCity: locationData.components.city,
        currentCountry: locationData.components.country,
        currentPostcode: locationData.components.eircode,
        currentEircode: locationData.components.eircode
      }));

      // Fetch treatment centres for the coordinates
      fetchTreatmentCentres(locationData.latitude, locationData.longitude);

      setEircodeError('');
      console.log('✅ Location fields updated successfully with OpenStreetMap data');

    } catch (error) {
      console.error('❌ Error getting location:', error);
      setEircodeError(error.message);
    } finally {
      setIsLoadingLocation(false);
      console.log('🏁 OpenStreetMap geolocation request completed');
    }
  };

  // Enhanced blur handler for the Reason for Contact text field (merged and optimized)
  const handleReasonTextBlur = async () => {
    // Only trigger if there's meaningful text in the field
    if (!reasonTextSearch || reasonTextSearch.trim().length < 3) {
      setIsSearchingReasons(false);
      return;
    }
    
    console.log('🔍 Triggering AI filtering on blur with text:', reasonTextSearch);
    
    // Show searching indicator only when actually making the call
    setIsSearchingReasons(true);
    
    try {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      // Prepare webhook request body for AI filtering
      const requestBody = {
        workflowtype: "lookups",
        reasoninput: reasonTextSearch.trim()
      };
      
      console.log('📤 Sending AI filtering request:', requestBody);
      
      // Make request to n8n webhook with abort signal
      const response = await fetch(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...WEBHOOK_CONFIG.DEFAULT_HEADERS
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📥 AI filtering response:', data);
        
        // Extract complaints from the response - handle the specific structure
        let aiComplaints = [];
        
        if (data && data.message && data.message.content && data.message.content.Complaints) {
          // Format from the API with nested content.Complaints
          aiComplaints = data.message.content.Complaints;
        } else if (data && Array.isArray(data)) {
          // Direct array format
          aiComplaints = data;
        } else if (data && data.Complaints && Array.isArray(data.Complaints)) {
          // Object with Complaints array
          aiComplaints = data.Complaints;
        }
        
        console.log('🤖 AI suggested complaints:', aiComplaints);
        
        if (aiComplaints.length > 0) {
          // Get current selections
          const currentSelections = formData.reasonForContact || [];
          
          // Extract ComplaintIDs from AI suggestions and filter out already selected
          const aiComplaintIds = aiComplaints.map(complaint => complaint.ComplaintID.toString());
          const newSelections = aiComplaintIds.filter(id => !currentSelections.includes(id));
          
          if (newSelections.length > 0) {
            // Combine current and new selections
            const updatedSelections = [...currentSelections, ...newSelections];
            
            // Update form data
            setFormData(prev => ({
              ...prev,
              reasonForContact: updatedSelections
            }));
            
            // Also trigger the complaint change handler to update priority messages
            handleComplaintChange(updatedSelections);
            
            console.log('✅ Added AI suggestions to selection:', newSelections);
          } else {
            console.log('ℹ️ All AI suggestions already selected');
          }
        } else {
          console.log('ℹ️ No complaints found in AI response');
        }
      } else {
        console.error('❌ AI filtering request failed:', response.status, response.statusText);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏰ AI filtering request aborted');
      } else {
        console.error('💥 Error in AI filtering request:', error);
      }
    } finally {
      setIsSearchingReasons(false);
    }
  };

  // Enhanced slot selection with reservation
  const handleSlotSelect = async (slot) => {
    // Don't proceed if already processing a reservation
    if (isBookingAppointment) {
      console.log('⚠️ Already processing a reservation, please wait...');
      return;
    }

    // Reset timer if expired and user selects a new slot
    if (timeRemaining <= 0 && showTimer) {
      console.log('🔄 Timer expired, resetting for new slot selection');
      resetTimer();
    }

    // Check if we have all required data for reservation
    if (!patientID || !reservedAppointment?.VisitID || !selectedClinic?.id) {
      console.log('❌ Missing required data for slot reservation:', {
        patientID,
        visitID: reservedAppointment?.VisitID,
        clinicID: selectedClinic?.id
      });
      setBookingError('Missing required booking information. Please try again.');
      return;
    }

    // Note: Slot release now happens only when timer expires, not on slot change

    // If changing slots and timer is active, reset the timer
    if (selectedSlot && selectedSlot !== slot && isTimerActive) {
      console.log('🔄 Slot changed, resetting timer');
      resetTimer();
    } else if (!selectedSlot && !isTimerActive) {
      // First time selecting a slot, start timer
      startTimer();
    }

    try {
      setIsBookingAppointment(true);
      setBookingError('');
      console.log('🔄 Reserving slot:', slot);

      // Parse the selected slot to get start and end times
      const { startTime, endTime } = parseSlotTime(slot, selectedDate);

      // Prepare reservation payload with dynamic values
      const reservationPayload = {
        workflowtype: "book_appointment",
        PatientID: patientID,
        VisitID: reservedAppointment.VisitID,
        CaseType: parseInt(formData.appointmentType) ,
        TrCentreID: selectedClinic.id,
        AppointmentID: 0, // Always 0 for new reservations
        StartTime: startTime,
        EndTime: endTime,
        Status: false // Always false for initial reservation
      };

      console.log('📤 Slot reservation payload:', reservationPayload);

      // Make the reservation call to n8n webhook
      const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, reservationPayload);

      if (!response.ok) {
        throw new Error(`Reservation failed: ${response.status} ${response.statusText}`);
      }

      // Try to get response as JSON first, then fall back to text
      let reservationResult;
      try {
        reservationResult = await response.json();
        console.log('📥 Parsed slot reservation response:', reservationResult);
      } catch (jsonError) {
        console.log('⚠️ Failed to parse as JSON, trying as text...');
        const responseText = await response.text();
        console.log('📥 Raw slot reservation response:', responseText);
        
        if (!responseText || responseText.trim() === '') {
          console.log('⚠️ Empty response from webhook - assuming reservation successful');
          
          // Generate a mock AppointmentID for tracking
          const mockAppointmentID = Math.floor(Math.random() * 100000) + 100000;
          
          // Update the reserved appointment with mock data
          setReservedAppointment(prev => ({
            ...prev,
            AppointmentID: mockAppointmentID,
            StartTime: startTime,
            EndTime: endTime,
            Status: 'Reserved'
          }));

          // Set the selected slot
          setSelectedSlot(slot);
          
          console.log('🎯 Slot reservation completed (empty response):', {
            slot,
            appointmentID: mockAppointmentID,
            status: 'Reserved'
          });
          
          return;
        }

        // Try to parse the text as JSON
        try {
          reservationResult = JSON.parse(responseText);
        } catch (parseError) {
          console.error('❌ Failed to parse reservation response:', parseError);
          throw new Error('Invalid response format from reservation service');
        }
      }

      // Handle array response format
      if (Array.isArray(reservationResult) && reservationResult.length > 0) {
        const firstResult = reservationResult[0];
        
        // Parse the data field if it's a string
        let parsedData;
        if (typeof firstResult.data === 'string') {
          try {
            parsedData = JSON.parse(firstResult.data);
            console.log('✅ Parsed nested reservation data:', parsedData);
          } catch (parseError) {
            console.error('❌ Failed to parse nested data:', parseError);
            parsedData = firstResult;
          }
        } else {
          parsedData = firstResult.data || firstResult;
        }

        console.log('✅ Slot reserved successfully:', parsedData);
        
        // Update the reserved appointment with the new AppointmentID
        setReservedAppointment(prev => ({
          ...prev,
          PatientID: parsedData.PatientID || prev.PatientID,
          VisitID: parsedData.VisitID || prev.VisitID,
          AppointmentID: parsedData.AppointmentID || Math.floor(Math.random() * 100000) + 100000,
          StartTime: parsedData.StartTime || startTime,
          EndTime: parsedData.EndTime || endTime,
          Status: parsedData.Status || 'Reserved',
          TrCentreID: parsedData.TrCentreID || selectedClinic.id,
          TrCentreName: parsedData.TrCentreName || selectedClinic.name || '',
          TrCentreAddress: parsedData.TrCentreAddress || selectedClinic.address || '',
          AppointmentType: parsedData.AppointmentType || formData.appointmentType || '',
          Price: parsedData.Price || paymentAmount.toString() || '',
          PatientName: parsedData.PatientName || `${formData.firstName} ${formData.lastName}`.trim() || '',
          ContactNo: parsedData.ContactNo || formData.phoneNumber || '',
          Email: parsedData.Email || formData.email || ''
        }));

        // Set the selected slot
        setSelectedSlot(slot);
        
        console.log('🎯 Slot reservation completed with parsed data:', {
          slot,
          appointmentID: parsedData.AppointmentID,
          status: parsedData.Status,
          patientID: parsedData.PatientID,
          visitID: parsedData.VisitID
        });

      } else if (reservationResult && typeof reservationResult.data === 'string') {
        // Handle direct response with nested data string
        try {
          const parsedData = JSON.parse(reservationResult.data);
          console.log('✅ Parsed direct reservation data:', parsedData);
          
          setReservedAppointment(prev => ({
            ...prev,
            PatientID: parsedData.PatientID || prev.PatientID,
            VisitID: parsedData.VisitID || prev.VisitID,
            AppointmentID: parsedData.AppointmentID || Math.floor(Math.random() * 100000) + 100000,
            StartTime: parsedData.StartTime || startTime,
            EndTime: parsedData.EndTime || endTime,
            Status: parsedData.Status || 'Reserved',
            TrCentreID: parsedData.TrCentreID || selectedClinic.id,
            TrCentreName: parsedData.TrCentreName || selectedClinic.name || '',
            TrCentreAddress: parsedData.TrCentreAddress || selectedClinic.address || '',
            AppointmentType: parsedData.AppointmentType || formData.appointmentType || '',
            Price: parsedData.Price || paymentAmount.toString() || '',
            PatientName: parsedData.PatientName || `${formData.firstName} ${formData.lastName}`.trim() || '',
            ContactNo: parsedData.ContactNo || formData.phoneNumber || '',
            Email: parsedData.Email || formData.email || ''
          }));

          setSelectedSlot(slot);
        } catch (parseError) {
          console.error('❌ Failed to parse direct reservation data:', parseError);
          // Fallback to basic reservation
          setReservedAppointment(prev => ({
            ...prev,
            AppointmentID: Math.floor(Math.random() * 100000) + 100000,
            StartTime: startTime,
            EndTime: endTime,
            Status: 'Reserved'
          }));
          setSelectedSlot(slot);
        }
      } else {
        // Handle non-array response or direct object
        console.log('✅ Slot reserved successfully (direct response):', reservationResult);
        
        setReservedAppointment(prev => ({
          ...prev,
          AppointmentID: reservationResult.AppointmentID || Math.floor(Math.random() * 100000) + 100000,
          StartTime: reservationResult.StartTime || startTime,
          EndTime: reservationResult.EndTime || endTime,
          Status: reservationResult.Status || 'Reserved'
        }));

        setSelectedSlot(slot);
      }

    } catch (error) {
      console.error('❌ Error reserving slot:', error);
      setBookingError(`Failed to reserve slot: ${error.message}`);
      
      // Don't set the slot as selected if reservation failed
      setSelectedSlot(null);
    } finally {
      setIsBookingAppointment(false);
    }
  };

  // Helper function to parse slot time and create ISO datetime strings
  const parseSlotTime = (slot, date) => {
    // Parse slot format "HH:MM - HH:MM"
    const [startTimeStr, endTimeStr] = slot.split(' - ');
    
    // Create datetime objects for the selected date
    const appointmentDate = new Date(date);
    const startDateTime = new Date(appointmentDate);
    const endDateTime = new Date(appointmentDate);
    
    // Parse and set start time
    const [startHour, startMin] = startTimeStr.split(':');
    startDateTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
    
    // Parse and set end time
    const [endHour, endMin] = endTimeStr.split(':');
    endDateTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);
    
    // Format as local ISO string to preserve the actual time
    const formatLocalISO = (dateTime) => {
      const year = dateTime.getFullYear();
      const month = String(dateTime.getMonth() + 1).padStart(2, '0');
      const day = String(dateTime.getDate()).padStart(2, '0');
      const hours = String(dateTime.getHours()).padStart(2, '0');
      const minutes = String(dateTime.getMinutes()).padStart(2, '0');
      const seconds = String(dateTime.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
    };
    
    return {
      startTime: formatLocalISO(startDateTime),
      endTime: formatLocalISO(endDateTime)
    };
  };

  // Irish mobile number validation and formatting functions
  const validateIrishMobileNumber = (phoneNumber) => {
    if (!phoneNumber) return { isValid: false, error: 'Phone number is required' };
    
    // Remove all spaces and non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Valid Irish mobile prefixes
    const validPrefixes = ['083', '085', '086', '087', '089'];
    
    // Regex patterns
    const localPattern = /^(08[3,5,6,7,9])\d{7}$/;
    const internationalPattern = /^(\+353)(83|85|86|87|89)\d{7}$/;
    const combinedPattern = /^(?:08[3,5,6,7,9]\d{7}|\+353(83|85|86|87|89)\d{7})$/;
    
    // Check if it matches either format
    if (!combinedPattern.test(cleaned)) {
      // Provide specific error messages
      if (cleaned.startsWith('+353')) {
        if (cleaned.length !== 13) {
          return { isValid: false, error: 'International format must be 13 characters (+353 + 9 digits)' };
        }
        const prefix = cleaned.substring(4, 7);
        if (!validPrefixes.includes(prefix)) {
          return { isValid: false, error: `Invalid prefix ${prefix}. Must be one of: ${validPrefixes.join(', ')}` };
        }
      } else if (cleaned.startsWith('0')) {
        if (cleaned.length !== 10) {
          return { isValid: false, error: 'Local format must be 10 digits (08X XXXXXXX)' };
        }
        const prefix = cleaned.substring(0, 3);
        if (!validPrefixes.includes(prefix)) {
          return { isValid: false, error: `Invalid prefix ${prefix}. Must be one of: ${validPrefixes.join(', ')}` };
        }
      } else {
        return { isValid: false, error: 'Number must start with 0 (local) or +353 (international)' };
      }
    }
    
    return { isValid: true, error: null };
  };

  const formatIrishMobileNumber = (phoneNumber) => {
    if (!phoneNumber) return null;
    
    // Remove all spaces and non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it's already in international format, return as is
    if (cleaned.startsWith('+353')) {
      return cleaned;
    }
    
    // If it starts with 0, convert to international format
    if (cleaned.startsWith('0')) {
      return '+353' + cleaned.substring(1);
    }
    
  
    // If it doesn't start with 0 or +353, assume it needs 0 prefix first
    if (cleaned.length === 9 && /^(83|85|86|87|89)\d{7}$/.test(cleaned)) {
      return '+353' + cleaned;
    }
    
    // If it's 8 digits starting with valid prefix, add 0 then convert
    if (cleaned.length === 8 && /^(3|5|6|7|9)\d{7}$/.test(cleaned)) {
      return '+3538' + cleaned;
    }
    
    return null; // Invalid format
  };

  const formatPhoneNumberForDisplay = (phoneNumber) => {
    if (!phoneNumber) return '';
    
    // Remove all spaces and non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // Format international numbers for display
    if (cleaned.startsWith('+353')) {
      const number = cleaned.substring(4); // Remove +353
      if (number.length === 9) {
        return `+353 ${number.substring(0, 2)} ${number.substring(2, 5)} ${number.substring(5)}`;
      }
    }
    
    // Format local numbers for display
    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6)}`;
    }
    
    return phoneNumber; // Return original if can't format
  };

  // Updated phone number validation function
  const formatAndValidatePhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return null;
    
    // Validate Irish mobile number
    const validation = validateIrishMobileNumber(phoneNumber);
    if (!validation.isValid) {
      return null;
    }
    
    // Format to international standard
    return formatIrishMobileNumber(phoneNumber);
  };

  // Function to release a previously selected slot
  const releaseSlot = async (visitID, appointmentID) => {
    try {
      console.log('🔄 RELEASE SLOT FUNCTION CALLED!');
      console.log('🔄 Releasing slot with parameters:', { visitID, appointmentID });
      console.log('🔄 Parameter types:', {
        visitIDType: typeof visitID,
        appointmentIDType: typeof appointmentID
      });

      const releasePayload = {
        "workflowtype": "appointment_slots",
        "type": "release_slot",
        "visitID": visitID,
        "appointmentID": appointmentID
      };

      console.log('📤 Release slot payload:', JSON.stringify(releasePayload, null, 2));
      console.log('🌐 Webhook URL:', WEBHOOK_CONFIG.APPOINTMENT_WEBHOOK);

      const response = await makeWebhookRequest(WEBHOOK_CONFIG.APPOINTMENT_WEBHOOK, releasePayload);

      if (response.ok) {
        // Clone response to allow multiple reads
        const responseClone = response.clone();

        try {
          // First try to parse as JSON
          const responseData = await response.json();
          console.log('✅ Slot released successfully. Response:', responseData);

          // Handle different response formats
          if (Array.isArray(responseData) && responseData.length > 0) {
            const firstResult = responseData[0];
            if (typeof firstResult.data === 'string') {
              try {
                const parsedData = JSON.parse(firstResult.data);
                console.log('📋 Parsed release response data:', parsedData);
              } catch (parseError) {
                console.log('📋 Release response (string):', firstResult.data);
              }
            } else {
              console.log('📋 Release response (object):', firstResult);
            }
          } else {
            console.log('📋 Direct release response:', responseData);
          }
        } catch (jsonError) {
          console.log('⚠️ JSON parsing failed, trying as text:', jsonError.message);
          try {
            // Use cloned response for text parsing
            const responseText = await responseClone.text();
            console.log('📋 Release response (text):', responseText);
          } catch (textError) {
            console.error('❌ Failed to read response as text:', textError);
          }
        }
      } else {
        console.warn('⚠️ Failed to release slot:', response.status, response.statusText);
        // Try to get error response body
        try {
          const errorText = await response.text();
          console.warn('📋 Error response body:', errorText);
        } catch (readError) {
          console.warn('📋 Could not read error response body');
        }
      }
    } catch (error) {
      console.error('❌ Error releasing slot:', error);
      // Don't throw error as this is a cleanup operation
    }
  };

  // Function to generate patient registration payload
  const createPatientPayload = () => {
    // Format and validate Irish mobile number
    const formattedPhone = formatAndValidatePhoneNumber(formData.phoneNumber);
    if (!formattedPhone) {
      const validation = validateIrishMobileNumber(formData.phoneNumber);
      setValidationErrors(prev => ({
        ...prev,
        phoneNumber: validation.error || 'Invalid Irish mobile number format'
      }));
      return null;
    }

    // Get selected GP and Surgery IDs - set to null if Unknown GP is checked
    const selectedGPID = isUnknownGPChecked ? null : (formData.gp ? parseInt(formData.gp) : null);
    const selectedSurgeryID = isUnknownGPChecked ? null : (formData.surgery ? parseInt(formData.surgery) : null);

    // Get RegisterationType from selected doctor - set to null if Unknown GP is checked
    let registrationType = null;
    if (!isUnknownGPChecked && formData.gp) {
      const selectedDoctor = dropdownData.doctors.find(doctor => 
        doctor.GPID.toString() === formData.gp.toString()
      );
      registrationType = selectedDoctor?.RegisterationType || 2;
    }


    // Calculate tomorrow's date with time for current address expiration
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999); // Set to end of day
    const tomorrowISO = tomorrow.toISOString(); // Full ISO string with time

    // Handle reasonForContact - ensure it's always an array for the payload
    let reasonForContactArray = [];
    if (Array.isArray(formData.reasonForContact)) {
      reasonForContactArray = formData.reasonForContact;
    } else if (formData.reasonForContact) {
      // If it's a string, split by comma or treat as single item
      if (typeof formData.reasonForContact === 'string') {
        reasonForContactArray = formData.reasonForContact.split(',').map(item => item.trim()).filter(item => item);
      } else {
        reasonForContactArray = [formData.reasonForContact];
      }
    }

    // Convert reasonForContact array to comma-separated string for symptoms
    const symptomsString = reasonForContactArray.join(',');

    // Get gender as string (name, not ID)
    const selectedGender = dropdownData.gender.find(g => g.Id.toString() === formData.gender.toString());
    const genderString = selectedGender ? selectedGender.GenderName : formData.gender;

    const payload = {
      "Gender": genderString, // Pass as string, not integer
      "DOB": formData.dateOfBirth,
      "Firstname": formData.firstName,
      "Lastname": formData.lastName,
      "RegisterationType": registrationType, // Dynamic from selected doctor 
      "GeneralPractitionerID": selectedGPID,// null if Unknown GP checked
      "Surgery": selectedSurgeryID,// null if Unknown GP checked
      "GMSNO": formData.gmsNumber || null,
      "GMSExpiry": formData.gmsExpiry || null,
      "PatientAddress": [
        {
          "AddressTypeID": 1,
          "AddressLine1": formData.homeBuilding || "",
          "AddressLine2": formData.homeStreet || "",
          "AddressLine3": formData.homeArea || "",
          "IsCorrespondence": homeLocationCorrespondence,
          "AddressLine4": formData.homeCity || "",
          "AddressLine5": formData.homeCountry || "",
          "AddressLine6": formData.homeEircode || "",
          "AddressExpiration": null
        },
        {
          "AddressTypeID": 2,
          "AddressLine1": formData.currentBuilding || "",
          "AddressLine2": formData.currentStreet || "",
          "AddressLine3": formData.currentArea || "",
          "IsCorrespondence": currentLocationCorrespondence,
          "AddressLine4": formData.currentCity || "",
          "AddressLine5": formData.currentCountry || "",
          "AddressLine6": formData.currentEircode || "",
          "AddressExpiration": tomorrowISO // Full ISO string with time
        }
      ],
      "ContactNumber": formattedPhone,
      "Email": formData.email || "",
      "Symptoms": symptomsString,
      "SymptomsComments": reasonTextSearch || ""
    };


    return payload;
  };

  
  // Function to save patient registration via API
const savePatientRegistration = async (payload) => {
  try {
    console.log('📤 Sending patient registration payload:', JSON.stringify(payload, null, 2));
    
    // Create webhook request body for patient registration with correct workflow type
    const requestBody = {
      workflowtype: 'save_patient_details',
      PatientID: 0, // Set to 0 for new patient registration
      ...payload // Spread the patient data
    };

    console.log('📤 Full webhook request body:', JSON.stringify(requestBody, null, 2));

    // Use the dynamic webhook endpoint for patient registration
    const response = await makeWebhookRequest(WEBHOOK_CONFIG.PATIENT_REGISTRATION_WEBHOOK, requestBody);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    console.log('📥 Raw patient registration response:', responseText);

    // Check if response is empty
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from server');
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse patient registration response as JSON:', parseError);
      throw new Error('Invalid response format from server');
    }

    console.log('✅ Parsed patient registration response:', data);

    // Handle the nested data structure
    let registrationResult = data;
    
    // Check if the data is nested inside a 'data' field as a JSON string
    if (registrationResult && registrationResult.data && typeof registrationResult.data === 'string') {
      try {
        registrationResult = JSON.parse(registrationResult.data);
        console.log('✅ Parsed nested registration data:', registrationResult);
      } catch (parseError) {
        console.error('❌ Failed to parse nested registration data:', parseError);
        throw new Error('Invalid nested response format from server');
      }
    }

    // Validate that we have the required fields
    if (!registrationResult || !registrationResult.PatientID) {
      console.error('❌ Missing PatientID in response:', registrationResult);
      throw new Error('Patient registration failed - missing PatientID');
    }

    if (!registrationResult.VisitID) {
      console.error('❌ Missing VisitID in response:', registrationResult);
      throw new Error('Patient registration failed - missing VisitID');
    }

    console.log('✅ Patient registration successful:', registrationResult);
    return registrationResult;

  } catch (error) {
    console.error('❌ Error saving patient registration:', error);
    throw error;
  }
}; // Add function to book appointment after patient registration
const bookAppointment = async (patientID, visitID) => {
  if (!selectedSlot || (!selectedClinic && !isVirtualAppointment())) {
    throw new Error('Missing appointment details');
  }

  // Parse slot time - assuming selectedSlot format is "HH:MM - HH:MM"
  const [startTimeStr, endTimeStr] = selectedSlot.split(' - ');
  
  // Create datetime strings for today (or selected date)
  const appointmentDate = selectedDate || new Date();
  const startDateTime = new Date(appointmentDate);
  const endDateTime = new Date(appointmentDate);
  
  // Parse and set times
  const [startHour, startMin] = startTimeStr.split(':');
  const [endHour, endMin] = endTimeStr.split(':');
  
  startDateTime.setHours(parseInt(startHour), parseInt(startMin), 0, 0);
  endDateTime.setHours(parseInt(endHour), parseInt(endMin), 0, 0);

  const bookingPayload = {
    "workflowtype": "book_appointment",
    "PatientID": patientID,
    "VisitID": visitID,
    "CaseType": parseInt(formData.appointmentType),
    "TrCentreID": selectedClinic?.id || 0,
    "AppointmentID": 0,
    "StartTime": startDateTime.toISOString(),
    "EndTime": endDateTime.toISOString(),
    "Status": false
  };

  console.log('📅 Booking appointment with payload:', bookingPayload);

  const response = await makeWebhookRequest(WEBHOOK_CONFIG.LOOKUPS_WEBHOOK, bookingPayload);
  
  if (!response.ok) {
    throw new Error(`Booking failed: ${response.status}`);
  }

  const result = await response.json();
  console.log('📅 Booking response:', result);
  
  // Parse the response
  if (result && result.length > 0 && result[0].data) {
    const appointmentData = JSON.parse(result[0].data);
    console.log('✅ Appointment booked successfully:', appointmentData);
    return appointmentData;
  }
  
  throw new Error('Invalid booking response format');
};

// Update the continue button handler
const handleContinueToBooking = async () => {
  try {
    setIsLoadingDropdowns(true);
    setBookingError(''); // Clear any previous errors
    
    // 1. Validate form data first - STOP if validation fails
    if (!validateForm()) {
      console.log('❌ Form validation failed - stopping webhook call');
      setIsLoadingDropdowns(false);
      return; // Exit early if validation fails
    }
    
    console.log('✅ Form validation passed - proceeding with patient registration');
    
    // 2. Create patient registration payload
    const patientPayload = createPatientPayload();
    if (!patientPayload) {
      throw new Error('Failed to create patient registration data');
    }
    
    // 3. Register patient and get PatientID and VisitID
    const registrationResult = await savePatientRegistration(patientPayload);
    
    console.log('✅ Patient registered with ID:', registrationResult.PatientID);
    setPatientID(registrationResult.PatientID);
    
    // Store the complete registration result including VisitID
    setReservedAppointment({
      PatientID: registrationResult.PatientID,
      VisitID: registrationResult.VisitID,
      CaseNo: registrationResult.CaseNo
    });
    
    console.log('✅ Registration data stored:', {
      PatientID: registrationResult.PatientID,
      VisitID: registrationResult.VisitID,
      CaseNo: registrationResult.CaseNo
    });
    
    // 4. Move to step 2 for clinic selection and payment
    setCurrentStep(2);
    
  } catch (error) {
    console.error('❌ Error in continue to booking:', error);
    setBookingError(error.message || 'Failed to process booking. Please try again.');
  } finally {
    setIsLoadingDropdowns(false);
  }
};

  // Mobile layout fix - ensure proper rendering on initial mobile load
  useEffect(() => {
    const handleMobileLayoutFix = () => {
      if (window.innerWidth <= 768) {
        // Force proper mobile viewport behavior
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        document.body.style.width = '100%';
        document.body.style.maxWidth = '100%';
        document.body.style.overflowX = 'hidden';

        // Trigger resize event to force layout recalculation
        window.dispatchEvent(new Event('resize'));
      }
    };

    // Run immediately and after DOM is ready
    handleMobileLayoutFix();
    const timeoutId = setTimeout(handleMobileLayoutFix, 100);

    // Handle orientation changes
    const handleOrientationChange = () => {
      setTimeout(handleMobileLayoutFix, 150);
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleMobileLayoutFix);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('orientationchange', handleOrientationChange);
      window.removeEventListener('resize', handleMobileLayoutFix);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 relative w-full overflow-x-hidden">
      {/* Mobile-first responsive container */}
      

      {/* Add top padding to main content to account for fixed header */}
<div className="pt-16">
  {/* Theme Selector Button */}
  <div className="fixed top-4 right-4 z-50 flex space-x-2">

    {/* SMS Demo Button */}
    {/* <div className="relative">
      <button
        onClick={() => setShowSmsForm(true)}
        className={`p-3 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-lg transition-all transform hover:scale-105`}
        title="SMS Demo"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    </div> */}
    {/* Language Selector Button - HIDDEN */}
    {/* Commented out language selector
    <div className="relative">
      <button
        onClick={() => setShowLanguageSelector(!showLanguageSelector)}
        className={`p-3 rounded-full ${theme.primarySolid} ${theme.primaryHover} text-white shadow-lg transition-all transform hover:scale-105`}
        title="Change Language"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
          <path d="M2 12h20"></path>
        </svg>
      </button>
    </div>
    */}

    {/* Theme Selector Button */}
    <div className="relative theme-selector-container">
      <button
        onClick={() => setShowThemeSelector(!showThemeSelector)}
        className={`p-3 rounded-full ${theme.primarySolid} ${theme.primaryHover} text-white shadow-lg transition-all transform hover:scale-105`}
        title="Change Theme"
      >
        <Palette size={20} />
      </button>

      {/* Theme Dropdown */}
      {showThemeSelector && (
        <div className="fixed right-4 top-16 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-900 text-base">Choose Theme</h3>
            <p className="text-sm text-gray-500 mt-1">Customize your experience</p>
          </div>

          {/* Theme Options */}
          <div className="py-2 max-h-80 overflow-y-auto">
            {Object.entries(themes).map(([key, themeOption]) => (
              <button
                key={key}
                onClick={() => handleThemeChange(key)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center space-x-3 transition-colors ${
                  currentTheme === key ? `${theme.accentBg} border-r-2 ${theme.border}` : ''
                }`}
              >
                {/* Color Circle */}
                <div className={`w-6 h-6 rounded-lg ${themeOption.primarySolid} flex-shrink-0 shadow-sm`}></div>

                {/* Theme Name */}
                <span className={`font-medium flex-1 ${
                  currentTheme === key ? theme.text : 'text-gray-700'
                }`}>
                  {themeOption.name}
                </span>

                {/* Check Icon for Selected */}
                {currentTheme === key && (
                  <Check size={16} className={`${theme.accent} flex-shrink-0`} />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>

  {/* Main content with proper spacing */}
  
</div>
      {/* Header */}
    {/* Header - Fixed positioned like theme/language buttons */}
{/* Fixed Header with GP Logo on the Left */}
<header className={`fixed top-0 left-0 right-0 z-40 bg-gradient-to-r ${theme.primary} shadow-lg`}>
  <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex items-center justify-between h-16 py-3">

      {/* GP Logo on the Left */}
      <div className="flex items-center">
        <img
          src="/GPOpenApp.png"
          alt="GP Logo"
          className="h-10 sm:h-12 w-auto animate-slide-in-left"
        />
      </div>

      {/* Right side controls with slide-in animation */}
      <div className="flex items-center space-x-2 sm:space-x-3 animate-slide-in-right">
        {/* SouthDoc Description - Right side - Hidden on mobile and console */}
        <div className="hidden lg:flex items-center text-white text-left max-w-md flex-shrink-0">
          <div>
            <div className="font-bold text-sm lg:text-base leading-tight">
              GP out-of-hours service
            </div>
            <div className="text-xs lg:text-sm opacity-90 leading-tight mt-1">
              for medical issues that cannot wait for daytime practice
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</header>

{/* Top-right floating Theme Button */}




      {/* Background doctor image - positioned outside section to start from header */}
      {/* <div className="absolute top-16 left-0 right-0 h-96 z-0 hidden xl:block">
        <img 
          alt="Doctor Consultation" 
          className="w-full h-full object-cover object-top" 
          src="/NewDoctor.jpg"
        />
        <div className="absolute inset-0 bg-white opacity-10"></div>
      </div> */}

      {/* Booking Form with slide-up animation */}
      <section className="py-4 sm:py-8 md:py-4 lg:py-8 animate-slide-up relative z-10">
        <div className="w-full max-w-none sm:max-w-[1600px] mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          {/* <div className="text-center mb-6 sm:mb-8 md:mb-12 relative"> */}

            {/* <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-4 leading-tight px-2 lg:px-0 break-words relative z-10">
              Book Your Consultation
            </h1> */}



            
          {/* </div> */}

          {/* Step indicator with staggered animation - HIDDEN */}
          {/* <div className="flex justify-center items-center mb-6 sm:mb-8 md:mb-12 animate-slide-up animate-delay-3">
            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-bold text-sm sm:text-lg ${
                currentStep === 1 ? `${theme.primarySolid} text-white` : 'bg-gray-200 text-gray-600'
              }`}>
                1
              </div>
              <div className="w-8 sm:w-16 h-1 bg-gray-200 rounded"></div>
              <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full font-bold text-sm sm:text-lg ${
                currentStep === 2 ? `${theme.primarySolid} text-white` : 'bg-gray-200 text-gray-600'
              }`}>
                2
              </div>
            </div>
          </div> */}
{/* Emergency Notice - Appears after Patient Information card */}
                {showEmergencyNotice && (
                  // <div className="lg:col-span-2 px-4 sm:px-6 lg:px-8 py-4">
                    <EmergencyNotice
                      title="🚨 Emergency Notice"
                      message="If you are experiencing a medical emergency, please call"
                      emergencyNumber="999"
                      urgentNumber="0818 123 456"
                      onClose={() => setShowEmergencyNotice(false)}
                    />
                  // still the same siise</div>
                )}
          {currentStep === 1 ? (
            <Card className="shadow-xl overflow-hidden mx-4 sm:mx-0">
              <div className="grid lg:grid-cols-2 gap-6 lg:gap-0">
                {/* Patient Information */}
                <CardContent className="p-4 sm:p-6 lg:p-8 border-r-0 lg:border-r border-gray-100 border-b lg:border-b-0">
                  <CardHeader className="p-0 mb-4 sm:mb-6">
                    <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                      <Users className={theme.accent} size={18} />
                      <span>Patient Information</span>
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">Tell us about yourself</CardDescription>
                  </CardHeader>



                  <div className="space-y-4 sm:space-y-4">
                    {/* Reason for Contact Section */}
                    <div className="">
                      {/* Label and Clear Selection button - Horizontal alignment */}
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-1 sm:gap-0">
                        <label className="block text-sm font-medium text-gray-700">
                          {t('reasonForContact')} <span className="text-red-500">*</span>
                        </label>
                        {/* Only show Clear Selection button when there are selections or text search */}
                        {((formData.reasonForContact && Array.isArray(formData.reasonForContact) && formData.reasonForContact.length > 0) || reasonTextSearch.trim().length > 0) && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, reasonForContact: [] }));
                              setReasonTextSearch('');
                              // Clear validation errors for reason for consultation
                              setValidationErrors(prev => ({
                                ...prev,
                                reasonForContact: undefined
                              }));
                              // Reset complaint-related states
                              setIsEmergencyOrUrgent(false);
                              setPriorityMessage('');
                              setPriorityMessageColor('');
                              setSelectedComplaint(null);
                              console.log('🔄 Reason for Contact cleared - text field, dropdown, and errors cleared');
                            }}
                            className={`${theme.accent} ${theme.primaryHover} text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                          >
                            {t('clearSelection')}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                      {/* Text Input for AI Filtering */}
                      <div className="mb-3 sm:mb-4">
                        <input
                          type="text"
                          value={reasonTextSearch}
                          onChange={(e) => handleReasonTextSearch(e.target.value)}
                          onBlur={handleReasonTextBlur}
                          placeholder="Type your symptoms or reason for consultation..."
                          disabled={isEmergencyOrUrgent}
                          className={`w-full min-h-[44px] px-3 py-2.5 sm:py-3 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 text-sm sm:text-base ${
                            isEmergencyOrUrgent ? 'bg-gray-100 cursor-not-allowed' : ''
                          }`}
                        />

                        
                      </div>

                      {/* OR Divider */}
                      <div className="flex items-center justify-center my-4">
                        <div className="border-t border-gray-300 flex-grow"></div>
                        <span className="px-4 text-gray-500 text-sm">{t('or')}</span>
                        <div className="border-t border-gray-300 flex-grow"></div>
                        
                      </div>
                      {/* Loading complaints indicator */}
                      {isSearchingReasons && (
                        <div className={`flex items-center space-x-2 ${theme.accent} mt-2 mb-2`}>
                          <MedicalLoader size="w-4 h-4" color={theme.accent} />
                          <span className="text-xs sm:text-sm">Loading complaints...</span>
                        </div>
                      )}



                      {/* Dropdown Selection */}
                      <SearchableDropdown
                        key={`reason-${formData.reasonForContact?.length || 0}`} // Force re-render when selection changes
                        name="reasonForContact"
                        value={formData.reasonForContact}
                        onChange={handleInputChange}
                        options={(dropdownData.complaints || []).map(complaint => ({
                          value: complaint.ComplaintID.toString(),
                          label: complaint.Complaint,
                          priority: complaint.Priority
                        }))}
                        placeholder={isLoadingDropdowns ? 'Loading complaints...' : 'Select reason for consultation'}
                        disabled={isEmergencyOrUrgent || isLoadingDropdowns}
                        loading={isLoadingDropdowns}
                        isMultiSelect={true}
                        required={true}
                        className={isEmergencyOrUrgent ? 'opacity-50' : ''}
                        focusColor={getThemeFocusColor()}
                      />

                      {/* Priority Message Display */}
                      {priorityMessage && (
                        <div className={`mt-3 p-4 border rounded-lg ${priorityMessageColor}`}>
                          <div className="flex items-start space-x-2">
                            {priorityMessage.includes('emergency') ? (
                              <span className="text-red-600 text-lg">🚨</span>
                            ) : (
                              <span className="text-yellow-600 text-lg">⚠️</span>
                            )}
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {priorityMessage.includes('emergency') ? 'Emergency Priority Detected' : 'Urgent Priority Detected'}
                              </p>
                              <p className="text-sm mt-1">
                                {priorityMessage.replace(/\*\*/g, '')}
                              </p>
                              
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Validation Error */}
                      {showValidationErrors && validationErrors.reasonForContact && (
                        <p className="mt-1 text-red-600 text-sm">{validationErrors.reasonForContact}</p>
                      )}

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="firstName"
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleInputChange}
                          placeholder="Enter first name"
                          disabled={isEmergencyOrUrgent}
                          className={`min-h-[44px] text-sm sm:text-base focus:ring-2 focus:ring-${getThemeFocusColor()}-500 ${
                            showValidationErrors && validationErrors.firstName ? 'border-red-500' : ''
                          }`}
                        />
                        {showValidationErrors && validationErrors.firstName && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm break-words">{validationErrors.firstName}</p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="lastName"
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleInputChange}
                          placeholder="Enter last name"
                          disabled={isEmergencyOrUrgent}
                          className={`min-h-[44px] text-sm sm:text-base focus:ring-2 focus:ring-${getThemeFocusColor()}-500 ${
                            showValidationErrors && validationErrors.lastName ? 'border-red-500' : ''
                          }`}
                        />
                        {showValidationErrors && validationErrors.lastName && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm break-words">{validationErrors.lastName}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date of Birth <span className="text-red-500">*</span>
                        </label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          name="dateOfBirth"
                          value={formData.dateOfBirth}
                          onChange={handleInputChange}
                          disabled={isEmergencyOrUrgent}
                          className={`w-full min-h-[44px] sm:min-h-[48px] px-3 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${getThemeFocusColor()}-500 focus:border-transparent transition-all text-sm sm:text-base appearance-none bg-white ${
                             showValidationErrors && validationErrors.dateOfBirth ? 'border-red-500' : ''
                          }`}
                        />
                        {showValidationErrors && validationErrors.dateOfBirth && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm break-words">{validationErrors.dateOfBirth}</p>
                        )}
                        {isAgeInvalid && ageValidationError && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm flex items-start break-words">
                            <span className="mr-1 flex-shrink-0">⚠️</span>
                            <span>{ageValidationError}</span>
                          </p>
                        )}
                      </div>
                      <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <select
                          name="gender"
                          value={formData.gender}
                          onChange={handleInputChange}
                          disabled={isEmergencyOrUrgent || isLoadingDropdowns}
                          className={`w-full min-h-[44px] px-3 py-2.5 sm:py-3 rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 text-sm sm:text-base appearance-none ${
                            isEmergencyOrUrgent ? 'bg-gray-100 cursor-not-allowed' : ''
                          } ${showValidationErrors && validationErrors.gender ? 'border-red-500' : ''}`}
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 0.75rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.25em 1.25em',
                            WebkitAppearance: 'none',
                            MozAppearance: 'none'
                          }}
                        >
                          <option value="">
                            {isLoadingDropdowns ? 'Loading genders...' : 'Select gender'}
                          </option>
                          {dropdownData.gender.map(genderOption => (
                            <option key={genderOption.Id} value={genderOption.Id}>
                              {genderOption.GenderName}
                            </option>
                          ))}
                        </select>
                        {showValidationErrors && validationErrors.gender && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm break-words">{validationErrors.gender}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">GMS Number</label>
                          <div className="relative overflow-visible">
                            {/* Only show Info icon when GMS validation data is available */}
                            {gmsValidationData && (
                              <Info
                                size={16}
                                className="text-blue-500 hover:text-blue-700 cursor-help transition-colors"
                                onMouseEnter={() => setShowGmsInfo(true)}
                                onMouseLeave={() => setShowGmsInfo(false)}
                              />
                            )}

                            {/* GMS Info Popup - Mobile Responsive */}
                            {showGmsInfo && gmsValidationData && (
                              <div className="absolute z-[60] w-72 sm:w-80 md:w-96 bg-white border border-gray-200 rounded-lg shadow-xl p-3 sm:p-4 max-w-[calc(100vw-2rem)]">
                                <h3 className="font-semibold text-gray-800 mb-3 text-xs sm:text-sm border-b pb-2">GMS Validation Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                                  <div className="space-y-1.5 sm:space-y-2">
                                    <div>
                                      <span className="block text-sm font-medium text-gray-700 mb-2">Date of Birth:</span>
                                      <div className="text-gray-800">{formatDate(gmsValidationData.DOB)}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Doctor Number:</span>
                                      <div className="text-gray-800">{gmsValidationData.DoctorNum || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Expiry Date:</span>
                                      <div className="text-gray-800">{formatDate(gmsValidationData.ExpiryDate)}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Hi-Tech Card:</span>
                                      <div className="text-gray-800">{gmsValidationData.HiTechCard ? 'Yes' : 'No'}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Invalid Reason:</span>
                                      <div className="text-gray-800">{gmsValidationData.InvalidReason || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Valid Patient:</span>
                                      <div className="text-gray-800">{gmsValidationData.ValidPatient ? 'Yes' : 'No'}</div>
                                    </div>
                                  </div>
                                  <div className="space-y-1.5 sm:space-y-2">
                                    <div>
                                      <span className="font-medium text-gray-600 block">Patient Found:</span>
                                      <div className="text-gray-800">{gmsValidationData.PatientFound ? 'Yes' : 'No'}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Review Letter Date:</span>
                                      <div className="text-gray-800">{formatDate(gmsValidationData.ReviewLetterDate)}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Review Reminder Date:</span>
                                      <div className="text-gray-800">{formatDate(gmsValidationData.ReviewReminderLetterDate)}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Scheme ID:</span>
                                      <div className="text-gray-800">{gmsValidationData.SchemeID || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Scheme Type:</span>
                                      <div className="text-gray-800">{gmsValidationData.SchemeType || 'N/A'}</div>
                                    </div>
                                    <div>
                                      <span className="font-medium text-gray-600 block">Start Date:</span>
                                      <div className="text-gray-800">{formatDate(gmsValidationData.StartDate)}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            name="gmsNumber"
                            value={formData.gmsNumber}
                            onChange={handleInputChange}
                            onBlur={handleGmsNumberBlur}
                            placeholder="Enter your GMS number"
                            disabled={isEmergencyOrUrgent || isLoadingGMS}
                            className={`w-full min-h-[44px] px-3 py-2.5 sm:py-3 rounded-md border bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 text-sm sm:text-base ${
                              gmsError ? 'border-red-500' : 'border-input'
                            } ${
                              isEmergencyOrUrgent || isLoadingGMS ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`}
                          />
                          {isLoadingGMS && (
                            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                              <LoadingSpinner size="w-4 h-4" color="border-blue-500" />
                            </div>
                          )}
                        </div>

                        {/* GMS Loading Message */}
                        {isLoadingGMS && (
                          <div className={`mt-2 flex items-center space-x-2 ${theme.accent}`}>
                            <LoadingSpinner size="w-5 h-5" color={`border-${getThemeFocusColor()}-600`} />
                            <span className="text-xs sm:text-sm">Validating GMS number...</span>
                          </div>
                        )}

                        {gmsError && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm break-words">{gmsError}</p>
                        )}
                        {dobValidationError && (
                        <p className="mt-1 text-red-600 text-xs sm:text-sm break-words flex items-start">
                        <span className="mr-1">⚠️</span>
                        <span>{dobValidationError}</span>
                        </p>
                         )}
                      </div>
                      <div>
                        <label htmlFor="gmsExpiry" className="block text-sm font-medium text-gray-700 mb-2">
                          GMS Expiry
                        </label>
                        <input
                          type="date"
                          id="gmsExpiry"
                          name="gmsExpiry"
                          value={formData.gmsExpiry}
                          onChange={handleInputChange}
                          disabled={true ||isEmergencyOrUrgent || (gmsValidationData && gmsValidationData.ExpiryDate && gmsValidationData.InvalidReason !== 'EXPIRED')}
                          className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-${getThemeFocusColor()}-500 focus:border-transparent transition-all ${
                            isEmergencyOrUrgent
                              ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                              : (gmsValidationData && gmsValidationData.ExpiryDate && gmsValidationData.InvalidReason !== 'EXPIRED')
                                ? 'bg-gray-100 cursor-not-allowed border-gray-200'
                                : gmsValidationData && gmsValidationData.InvalidReason === 'EXPIRED'
                                  ? 'border-red-500 bg-red-50'
                                  : 'border-gray-200'
                          }`}
                        />
                        {gmsValidationData && gmsValidationData.InvalidReason === 'EXPIRED' && (
                          <p className="mt-1 text-sm text-red-600 flex items-center">
                            <span className="mr-1">⚠️</span>
                            GMS has expired
                          </p>
                        )}
                        {gmsValidationData && gmsValidationData.ExpiryDate && gmsValidationData.InvalidReason !== 'EXPIRED' && (
                          <p className={`mt-1 text-sm ${theme.accent} flex items-center`}>
                            <span className="mr-1">ℹ️</span>
                            Expiry date populated automatically from GMS validation
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Contact Number and Email Address - Responsive Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Contact Number <span className="text-red-500">*</span>
                        </label>
                        <PhoneNumberInput
                          value={formData.phoneNumber}
                          onChange={(value) => setFormData(prev => ({ ...prev, phoneNumber: value }))}
                          disabled={isEmergencyOrUrgent}
                          error={showValidationErrors ? validationErrors.phoneNumber : null}
                          placeholder="Enter your phone number"
                          required={true}
                          className="w-full"
                          themeColor={getThemeFocusColor()}
                        />
                      </div>
                      <div className="w-full">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          {t('Email Address')}
                        </label>
                        <input
                          id="email"
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder={t('emailPlaceholder')}
                          disabled={isEmergencyOrUrgent}
                          className={`w-full min-h-[44px] px-3 py-2.5 sm:py-3 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 text-sm sm:text-base`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-1 sm:gap-0">
                          <label htmlFor="gp" className="block text-sm font-medium text-gray-700">
                            General Practitioner<span className="text-red-500"> *</span>
                          </label>
                          {/* ByPass GP Checkbox - Horizontally placed with label */}
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="unknownGP"
                              checked={isUnknownGPChecked}
                              onChange={handleUnknownGPChange}
                              disabled={isLoadingDropdowns || isEmergencyOrUrgent}
                              className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                            />
                            <label htmlFor="unknownGP" className="ml-2 text-sm font-medium text-gray-700 whitespace-nowrap">
                              ByPass GP
                            </label>
                          </div>
                        </div>
                        <div className="w-full">
                          <SearchableDropdown
                            name="gp"
                            value={formData.gp}
                            onChange={handleInputChange}
                            options={getFilteredGPs().map(doctor => ({
                              value: doctor.GPID,
                              label: doctor.GPName
                            }))}
                            placeholder={isLoadingDropdowns
                              ? 'Loading doctors...'
                              : `Select your GP available`
                            }
                            disabled={isLoadingDropdowns || isEmergencyOrUrgent || isUnknownGPChecked}
                            loading={isLoadingDropdowns}
                            isMultiSelect={false}
                            required={!isUnknownGPChecked}
                            className={`min-h-[44px] ${isEmergencyOrUrgent ? 'opacity-50' : ''} ${
                              showValidationErrors && validationErrors.gp ? 'border-red-500' : 'border-gray-200'
                            } ${isUnknownGPChecked ? 'opacity-50' : ''}`}
                            focusColor={getThemeFocusColor()}
                          />
                        </div>
                        {showValidationErrors && validationErrors.gp && !isUnknownGPChecked && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm break-words">{validationErrors.gp}</p>
                        )}
                      </div>
                      <div>
                        {/* Surgery label with Clear Section button - Mobile responsive */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-1 sm:gap-0">
                          <label htmlFor="surgery" className="block text-sm font-medium text-gray-700">
                            {t('Surgery Clinic')} <span className="text-red-500">*</span>
                          </label>
                          {/* Only show Clear Selection button when there are selections */}
                          {(formData.gp || formData.surgery) && (
                            <button
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  gp: '',
                                  surgery: ''
                                }));
                                setIsUnknownGPChecked(false);
                                console.log('🔄 GP and Surgery section cleared');
                              }}
                              disabled={isLoadingDropdowns || isEmergencyOrUrgent}
                              className={`${theme.accent} ${theme.primaryHover} text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                            >
                              Clear Selection
                            </button>
                          )}
                        </div>
                        <div className="w-full">
                          <SearchableDropdown
                            name="surgery"
                            value={formData.surgery}
                            onChange={handleInputChange}
                            options={dropdownData.surgeries.map(surgery => ({
                              value: surgery.SurgeryID,
                              label: surgery.SurgeryName
                            }))}
                            placeholder={isLoadingDropdowns ? 'Loading surgeries...' : 'Select clinic/surgery'}
                            disabled={isLoadingDropdowns || isEmergencyOrUrgent || isUnknownGPChecked}
                            loading={isLoadingDropdowns}
                            isMultiSelect={false}
                            required={!isUnknownGPChecked}
                            className={`min-h-[44px] ${isEmergencyOrUrgent ? 'opacity-50' : ''} ${
                              showValidationErrors && validationErrors.surgery ? 'border-red-500' : 'border-gray-200'
                            } ${isUnknownGPChecked ? 'opacity-50' : ''}`}
                            focusColor={getThemeFocusColor()}
                          />
                        </div>
                        {showValidationErrors && validationErrors.surgery && !isUnknownGPChecked && (
                          <p className="mt-1 text-red-600 text-xs sm:text-sm break-words">{validationErrors.surgery}</p>
                        )}
                        
                        {/* Unknown GP message */}
                        {isUnknownGPChecked && (
                          <div className="mt-3 p-3 text-yellow-600 bg-yellow-50 border-yellow-200">
                            <div className="flex items-start space-x-2">
                              <span className="text-blue-600 text-lg">⚠️</span>
                              <div className="flex-1">
                                <p className="text-sm mt-1">
                                  Outcome of this appointment won't send to your GP
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    


                  </div>
                </CardContent>

                {/* Location */}
                <CardContent className="p-4 sm:p-6 lg:p-8 bg-gray-50">
                  <CardHeader className="p-0 mb-4 sm:mb-6">
                    <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                      <MapPin className={theme.accent} size={18} />
                      <span>Location</span>
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base">Enter your location details</CardDescription>
                  </CardHeader>

                  {/* <button className={`w-full ${theme.primarySolid} ${theme.primaryHover} text-white py-3 rounded-lg font-semibold mb-6 transition-colors flex items-center justify-center space-x-2`}>
                    <MapPin size={20} />
                    <span>Use Current Location</span>
                  </button> */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Search size={14} className="inline mr-1" />
                      Search Address or Eircode
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          name="eircode"
                          value={formData.eircode}
                          onChange={handleInputChange}
                          placeholder="Enter address or Eircode"
                          className={`w-full min-h-[44px] px-3 py-2.5 sm:py-2 pr-10 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 text-sm sm:text-base ${isLoadingEircode ? 'bg-gray-50' : ''} ${isEmergencyOrUrgent ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          disabled={isLoadingEircode || isEmergencyOrUrgent}
                        />
                        {isLoadingEircode ? (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <LoadingSpinner size="w-4 h-4" color="border-blue-500" />
                          </div>
                        ) : (
                          <Search size={16} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={getCurrentLocation}
                        disabled={isLoadingLocation || isLoadingEircode}
                        className={`px-3 py-2.5 sm:py-2 ${theme.primarySolid} ${theme.primaryHover} text-white rounded-lg transition-all flex items-center justify-center min-w-[44px] w-full sm:w-auto ${isLoadingLocation || isLoadingEircode ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 shadow-md hover:shadow-lg'}`}
                        title={isLoadingLocation ? "Getting your location..." : "Use Current Location"}
                        aria-label="Use current location to fill address fields"
                      >
                        {isLoadingLocation ? (
                          <LoadingSpinner size="w-4 h-4" color="border-white" />
                        ) : (
                          <Navigation size={16} className="animate-pulse" />
                        )}
                        <span className="ml-2 sm:hidden">Use Location</span>
                      </button>
                    </div>
                    {eircodeError && (
                      <p className="mt-1 text-xs sm:text-sm text-red-600 flex items-center break-words">
                        <span className="mr-1 flex-shrink-0">⚠️</span>
                        {eircodeError}
                      </p>
                    )}
                    {formData.eircode && !isLoadingEircode && !eircodeError && formData.currentCity && (
                      <p className="mt-1 text-xs sm:text-sm text-green-600 flex items-center break-words">
                        <span className="mr-1 flex-shrink-0">✅</span>
                        Address found and populated in Current Location below
                      </p>
                    )}
                    {!formData.eircode && !isLoadingLocation && !eircodeError && formData.currentCity && (
                      <p className="mt-1 text-xs sm:text-sm text-green-600 flex items-center break-words">
                        <span className="mr-1 flex-shrink-0">📍</span>
                        Current location detected and populated below
                      </p>
                    )}

                  </div>
                  {/* <div className="text-center text-gray-500 mb-6">OR</div> */}
                  {/* Current Location Section */}
                  <div className="flex justify-between items-center mb-1 py-4 sm:py-6">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Current Location</h3>
                    </div>
                  </div>
                  
                  {/* Manual Location Fields */}
                  <div className="space-y-4">
                    {/* Row 1: Building - Street */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Building <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="currentBuilding"
                          value={formData.currentBuilding}
                          onChange={handleInputChange}
                          placeholder="Building number"
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                            showValidationErrors && validationErrors.currentBuilding
                              ? 'border-red-500'
                              : ''
                          }`}
                        />
                        {showValidationErrors && validationErrors.currentBuilding && (
                          <p className="mt-1 text-red-600 text-sm">{validationErrors.currentBuilding}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Street <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="currentStreet"
                          value={formData.currentStreet}
                          onChange={handleInputChange}
                          placeholder="Street name"
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                            showValidationErrors && validationErrors.currentStreet
                              ? 'border-red-500'
                              : ''
                          }`}
                        />
                        {showValidationErrors && validationErrors.currentStreet && (
                          <p className="mt-1 text-red-600 text-sm">{validationErrors.currentStreet}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Area - City */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
                        <input
                          type="text"
                          name="currentArea"
                          value={formData.currentArea}
                          onChange={handleInputChange}
                          placeholder="Area/Neighborhood"
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                        <input
                          type="text"
                          name="currentCity"
                          value={formData.currentCity}
                          onChange={handleInputChange}
                          placeholder="City"
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50`}
                        />
                      </div>
                    </div>

                    {/* Row 3: Country - EIRCode with IsCorrespondence - Mobile responsive */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                        <input
                          type="text"
                          name="currentCountry"
                          value={formData.currentCountry}
                          onChange={handleInputChange}
                          placeholder="Country"
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50`}
                        />
                      </div>
                      <div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2 gap-1 sm:gap-0">
                          <label className="block text-sm font-medium text-gray-700">EIRCode</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="currentLocationCorrespondence"
                              name="currentLocationCorrespondence"
                              checked={currentLocationCorrespondence}
                              onChange={handleCurrentLocationCorrespondenceChange}
                              className="form-checkbox h-4 w-4 text-blue-600 flex-shrink-0"
                            />
                            <label htmlFor="currentLocationCorrespondence" className="text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">
                              IsCorrespondence
                            </label>
                          </div>
                        </div>
                        <input
                          type="text"
                          name="currentEircode"
                          value={formData.currentEircode}
                          onChange={handleInputChange}
                          placeholder="Enter EIRCode"
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50`}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Visual Divider */}
                  <div className={`my-5 h-1 bg-gradient-to-r ${theme.primary} shadow-lg rounded-full`}></div>
                  
                  {/* Home Location Section */}
                  <div className="flex justify-between items-center py-1">
                    <h3 className="text-xl font-semibold text-gray-900">Home Location</h3>

                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col items-end">
                        <label className="flex items-center space-x-2 sm:space-x-3 cursor-pointer" title="Copies address from Current Location section">
                          <input
                            type="checkbox"
                            className="form-checkbox h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-4 text-blue-600"
                            checked={useHomeAsCurrentLocation}
                            onChange={handleUseCurrentAsHomeLocation}
                          />
                          <span className="text-sm sm:text-base md:text-lg font-semibold text-gray-900">Set as Current Location</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Manual Location Fields */}
                  <div className="space-y-4 py-5">
                    {/* Row 1: Building - Street */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Building <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="homeBuilding"
                          value={formData.homeBuilding}
                          onChange={handleInputChange}
                          placeholder="Building number"
                          disabled={useHomeAsCurrentLocation}
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                            useHomeAsCurrentLocation
                              ? 'bg-gray-100 cursor-not-allowed'
                              : showValidationErrors && validationErrors.homeBuilding
                                ? 'border-red-500'
                                : ''
                          }`}
                        />
                        {showValidationErrors && validationErrors.homeBuilding && (
                          <p className="mt-1 text-red-600 text-sm">{validationErrors.homeBuilding}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Street <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="homeStreet"
                          value={formData.homeStreet}
                          onChange={handleInputChange}
                          placeholder="Street name"
                          disabled={useHomeAsCurrentLocation}
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                            useHomeAsCurrentLocation
                              ? 'bg-gray-100 cursor-not-allowed'
                              : showValidationErrors && validationErrors.homeStreet
                                ? 'border-red-500'
                                : ''
                          }`}
                        />
                        {showValidationErrors && validationErrors.homeStreet && (
                          <p className="mt-1 text-red-600 text-sm">{validationErrors.homeStreet}</p>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Area - City */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Area</label>
                        <input
                          type="text"
                          name="homeArea"
                          value={formData.homeArea}
                          onChange={handleInputChange}
                          placeholder="Area/Neighborhood"
                          disabled={useHomeAsCurrentLocation}
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${useHomeAsCurrentLocation ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                        <input
                          type="text"
                          name="homeCity"
                          value={formData.homeCity}
                          onChange={handleInputChange}
                          placeholder="City"
                          disabled={useHomeAsCurrentLocation}
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${useHomeAsCurrentLocation ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>

                    {/* Row 3: Country - EIRCode with IsCorrespondence */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                        <input
                          type="text"
                          name="homeCountry"
                          value={formData.homeCountry}
                          onChange={handleInputChange}
                          placeholder="Country"
                          disabled={useHomeAsCurrentLocation}
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${useHomeAsCurrentLocation ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-gray-700">EIRCode</label>
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id="homeLocationCorrespondence"
                              name="homeLocationCorrespondence"
                              checked={homeLocationCorrespondence}
                              onChange={handleHomeLocationCorrespondenceChange}
                              className="form-checkbox h-4 w-4 text-blue-600 flex-shrink-0"
                            />
                            <label htmlFor="homeLocationCorrespondence" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                              IsCorrespondence
                            </label>
                          </div>
                        </div>
                        <input
                          type="text"
                          name="homeEircode"
                          value={formData.homeEircode}
                          onChange={handleInputChange}
                          placeholder="Enter EIRCode"
                          disabled={useHomeAsCurrentLocation}
                          className={`w-full px-3 py-2 rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 ${useHomeAsCurrentLocation ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </div>

              {/* Continue Button */}
              <div className="p-4 sm:p-6 lg:p-8 bg-white border-t border-gray-100 flex justify-center">
                <button
                  onClick={handleContinueToBooking}
                  disabled={isEmergencyOrUrgent || isAgeInvalid || isLoadingDropdowns}
                  className={`w-full max-w-md min-h-[44px] sm:min-h-[48px] px-8 py-3 rounded-lg font-semibold text-sm transition-all transform hover:scale-105 shadow-md hover:shadow-lg ${
                    isEmergencyOrUrgent || isAgeInvalid || isLoadingDropdowns
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : `${theme.primarySolid} ${theme.primaryHover} text-white text-xl text-gray-900`
                  }`}
                >
                  {isLoadingDropdowns
                    ? 'Processing...'
                    : isEmergencyOrUrgent
                    ? 'Please Contact Emergency Services'
                    : isAgeInvalid
                    ? 'Age Validation Required'
                    : 'Continue to Booking & Payment'}
                </button>
              </div>
            </Card>
          ) : (
            // Step 2: Clinic Selection & Payment
            <Card className="shadow-xl overflow-hidden mx-4 sm:mx-0">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <CardHeader className="p-0 mb-4 sm:mb-6">
                  <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                    {isVirtualAppointment() ? (
                      <Video className={theme.accent} size={18} />
                    ) : (
                      <MapPin className={theme.accent} size={18} />
                    )}
                    <span>
                      {isVirtualAppointment() ? 'Select Time Slot' : 'Select Clinic & Time Slot'}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base">
                    {isVirtualAppointment()
                      ? `Choose your preferred time for your ${getAppointmentTypeDisplay().toLowerCase()}`
                      : 'Choose from available clinics nearby'
                    }
                  </CardDescription>
                </CardHeader>

                {/* Appointment Type Selection and Info - Responsive Layout */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
                  {/* Appointment Type Selection */}
                  <div className="w-full">
                    <div className="mb-2">
                      <label htmlFor="appointmentType" className="block text-sm font-medium text-gray-700">
                        Appointment Type <span className="text-red-500">*</span>
                      </label>
                    </div>
                    <select
                      name="appointmentType"
                      value={formData.appointmentType}
                      onChange={handleInputChange}
                      disabled={isLoadingDropdowns}
                      required={true}
                      className={`w-full min-h-[44px] px-3 py-2.5 sm:py-3 rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus:border-transparent focus:ring-2 focus:ring-${getThemeFocusColor()}-500 disabled:cursor-not-allowed disabled:opacity-50 text-sm sm:text-base appearance-none`}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.75rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.25em 1.25em',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none'
                      }}
                    >
                      <option value="">
                        {isLoadingDropdowns ? 'Loading appointment types...' : 'Select your appointment type'}
                      </option>
                      {dropdownData.appointmentTypes.map(type => (
                        <option key={type.CaseTypeID} value={type.CaseTypeID}>
                          {type.CaseType}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Right Side - Appointment Type Info */}
                  {formData.appointmentType && (
                    <div className={`p-4 rounded-lg ${theme.accentBg} h-fit`}>
                      <div className="flex items-center space-x-2 mb-2">
                        {(() => {
                          const selectedType = dropdownData.appointmentTypes.find(
                            type => type.CaseTypeID.toString() === formData.appointmentType.toString()
                          );
                          const caseType = selectedType?.CaseType.toLowerCase() || '';

                          if (caseType.includes('video')) {
                            return <Video size={16} className={theme.accent} />;
                          } else if (caseType.includes('phone')) {
                            return <Phone size={16} className={theme.accent} />;
                          } else {
                            return <MapPin size={16} className={theme.accent} />;
                          }
                        })()}
                        <span className="font-medium text-gray-900">
                          {getAppointmentTypeDisplay()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {(() => {
                          const selectedType = dropdownData.appointmentTypes.find(
                            type => type.CaseTypeID.toString() === formData.appointmentType.toString()
                          );
                          const caseType = selectedType?.CaseType.toLowerCase() || '';

                          if (caseType.includes('video')) {
                            return 'You will receive a video call link via email before your appointment.';
                          } else if (caseType.includes('phone')) {
                            return 'You will receive a phone call at your registered number at the scheduled time.';
                          } else {
                            return 'For appointment please select a time slot below.';
                          }
                        })()}
                      </p>
                    </div>
                  )}
                </div>

                {/* Clinics Grid - Only show for face-to-face appointments */}
                {!isVirtualAppointment() && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    {/* Loading state for treatment centres */}
                    {isLoadingTreatmentCentres && (
                      <div className="col-span-full text-center py-6 sm:py-8">
                        <div className="mx-auto mb-3 sm:mb-4 flex justify-center">
                          <HeartbeatLoader size="w-6 h-6 sm:w-8 sm:h-8" color="text-blue-600" />
                        </div>
                        <p className="text-gray-600 text-sm sm:text-base">Loading nearby treatment centres...</p>
                      </div>
                    )}

                    {/* Error state for treatment centres */}
                    {treatmentCentresError && !isLoadingTreatmentCentres && (
                      <div className="col-span-full text-center py-6 sm:py-8">
                        <p className="text-red-600 mb-3 sm:mb-4 text-sm sm:text-base">{treatmentCentresError}</p>
                        <p className="text-gray-600 text-xs sm:text-sm">Using default clinics instead.</p>
                      </div>
                    )}

                    {/* Clinics/Treatment centres grid */}
                    {!isLoadingTreatmentCentres && getClinicsToDisplay().map((clinic) => (
                      <div
                        key={clinic.id}
                        onClick={() => handleClinicSelect(clinic)}
                        className={`p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md min-h-[80px] sm:min-h-[60px] relative group ${selectedClinic?.id === clinic.id
                          ? `${theme.border} ${theme.accentBg}`
                          : 'border-gray-200 hover:border-gray-300'
                          }`}
                        title={clinic.direction && clinic.direction !== 'No directions available' ? clinic.direction : ''}
                      >
                        <h5 className="font-semibold text-xs sm:text-sm text-gray-900 mb-1 break-words">{clinic.name}</h5>
                        <div className="text-xs text-gray-600 mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs">{clinic.distance}</span>
                          </div>
                          {/* Direction information for treatment centres - simplified display */}
                          {clinic.direction && clinic.direction !== 'No directions available' && (
                            <div className="text-xs text-gray-500 mt-1 line-clamp-2 break-words">
                              📍 {clinic.direction.length > 40 ? `${clinic.direction.substring(0, 40)}...` : clinic.direction}
                            </div>
                          )}
                        </div>

                        {/* Hover tooltip for full directions */}
                        {clinic.direction && clinic.direction !== 'No directions available' && clinic.direction.length > 40 && (
                          <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                            <div className="font-medium mb-1">📍 Directions:</div>
                            <div>{clinic.direction}</div>
                            <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* View More Button - Aligned to Right */}
                    {!isLoadingTreatmentCentres && !showAllClinics && getClinicsData().length > INITIAL_CLINICS_COUNT && (
                      <div className="col-span-full flex justify-center sm:justify-end mt-3 sm:mt-4">
                        <button
                          onClick={handleViewMoreClinics}
                          className={`px-4 sm:px-6 py-2 bg-gradient-to-r ${theme.primarySolid} ${theme.primaryHover} text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 ease-in-out flex items-center space-x-2 text-sm sm:text-base`}
                        >
                          <span>View More</span>
                          <ChevronDown size={16} className="animate-bounce sm:w-[18px] sm:h-[18px]" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                
                                {/* Time Slots */}
                {(isVirtualAppointment() || selectedClinic) && (
                  <div className="">


                    <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">
                      {isVirtualAppointment()
                        ? `Available Time Slots for ${getAppointmentTypeDisplay()}:`
                        : `Available Time Slots for ${selectedClinic.name}:`
                      }
                    </h4>

                    {/* Date Selection - Show only dates with available slots */}
                    <div className="mb-4 sm:mb-6">
                      <h4 className="font-semibold text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base">Select Date</h4>
                      
                      {/* Only show date selection if there are available dates with slots */}
                      {availableDates.length > 0 && (
                        <>
                          {/* Available dates as buttons */}
                          <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                            {availableDates.map((dateStr) => {
                              const date = new Date(dateStr);
                              const isSelected = selectedDate.toISOString().split('T')[0] === dateStr;

                              return (
                                <Button
                                  key={dateStr}
                                  onClick={() => setSelectedDate(date)}
                                  variant={isSelected ? "default" : "secondary"}
                                  className={`px-3 sm:px-4 py-2 h-auto font-medium ${
                                    isSelected
                                      ? `${theme.primarySolid} ${theme.primaryHover} text-white border-transparent`
                                      : `bg-gray-100 text-gray-700 border-gray-200 hover:${theme.accentBg} hover:${theme.border}`
                                  }`}
                                >
                                  <div className="text-xs sm:text-sm">
                                    {date.toLocaleDateString('en-GB', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  </div>
                                </Button>
                              );
                            })}
                          </div>
                          
                          {/* Show available slots count for selected date */}
                          
                        </>
                      )}
                    </div>

                    {/* Loading state for appointment slots */}
                    {!isVirtualAppointment() && selectedClinic && isLoadingSlots && (
                      <div className="flex items-center justify-center py-8">
                        <LoadingSpinner size="w-8 h-8" color="border-blue-500" />
                        <span className="ml-3 text-gray-600">Loading appointment slots...</span>
                      </div>
                    )}

                    {/* Error state for appointment slots */}
                    {!isVirtualAppointment() && selectedClinic && slotsError && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-600 text-sm">
                          Error loading appointment slots: {slotsError}
                        </p>
                        <button
                          onClick={() => fetchAppointmentSlots(selectedClinic.id)}
                          className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {/* Time slots grid */}
                    {/* {!isLoadingSlots && !slotsError && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {getAvailableTimeSlots().length > 0 ? (
                          getAvailableTimeSlots().map((slot, index) => {
                            // Handle both string and object slot formats
                            const slotDisplay = typeof slot === 'object' ? slot.display : slot;
                            const slotValue = typeof slot === 'object' ? slot.display : slot;

                            return (
                              <Button
                                key={index}
                                onClick={() => handleSlotSelect(slotValue)}
                                variant={selectedSlot === slotValue ? "default" : "outline"}
                                className="px-3 py-2 h-auto text-sm font-medium"
                              >
                                {slotDisplay}
                              </Button>
                            );
                          })
                        ) : (
                          <div className="col-span-full text-center py-8 text-gray-500">
                            {!isVirtualAppointment() && selectedClinic
                              ? selectedDate.toDateString() === new Date().toDateString()
                                ? 'No appointment slots available for this clinic today.'
                                : `No appointment slots available for ${selectedDate.toLocaleDateString()}.`
                              : selectedDate.toDateString() === new Date().toDateString()
                                ? 'No time slots available today.'
                                : `No time slots available for ${selectedDate.toLocaleDateString()}.`
                            }
                          </div>
                        )}
                      </div>
                    )} */}
                    {/* Time slots grid with reservation functionality */}
{!isLoadingSlots && !slotsError && (
  <div className="space-y-4">
    {/* Show booking error if any */}
    {bookingError && (
      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
        <p className="text-red-700 text-sm">{bookingError}</p>
        <button
          onClick={() => setBookingError('')}
          className="text-red-600 hover:text-red-800 text-xs mt-1 underline"
        >
          Dismiss
        </button>
      </div>
    )}

    {/* Show reservation status */}
    {isBookingAppointment && (
      <div className={`${theme.accentBg} ${theme.border} rounded-lg p-3`}>
        <div className="flex items-center space-x-2">
          <LoadingSpinner size="w-4 h-4" color={`border-${getThemeFocusColor()}-600`} />
          <p className={`${theme.text} text-sm`}>Reserving your selected time slot...</p>
        </div>
      </div>
    )}
    
    {/* Time slots grid */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
      {getSlotsForSelectedDate().length > 0 ? (
        getSlotsForSelectedDate().map((slot, index) => {
          const slotDisplay = typeof slot === 'object' ? slot.display : slot;
          const slotValue = typeof slot === 'object' ? slot.display : slot;
          const isSelected = selectedSlot === slotValue;
          const isReserved = reservedAppointment?.AppointmentID && isSelected;

          return (
            <button
              key={index}
              onClick={() => handleSlotSelect(slotValue)}
              disabled={isBookingAppointment}
              className={`px-2 sm:px-3 py-2 border rounded-lg text-xs sm:text-sm font-medium transition-colors relative ${
                isSelected
                  ? isReserved
                    ? 'bg-green-500 text-white border-green-500'
                    : `${theme.primarySolid} text-white ${theme.border}`
                  : isBookingAppointment
                  ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                  : `border-gray-200 text-gray-700 hover:${theme.border} hover:${theme.accentBg}`
              }`}
            >
              {slotDisplay}
              {isSelected && isReserved && (
                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-xs rounded-full w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center">
                  ✓
                </span>
              )}
            </button>
          );
        })
      ) : (
        <div className="col-span-full text-center py-6 sm:py-8 text-gray-500">
          <div className="text-sm sm:text-base">
            {!isVirtualAppointment() && selectedClinic
              ? selectedDate.toDateString() === new Date().toDateString()
                ? 'No appointment slots available for this clinic today.'
                : `No appointment slots available for ${selectedDate.toLocaleDateString()}.`
              : isVirtualAppointment()
                ? 'Virtual appointments use different scheduling.'
                : 'Please select a clinic to view available slots.'
            }
          </div>
          {/* Only show "Check next available date" if there are actually more dates available */}
          {!isVirtualAppointment() && selectedClinic && availableDates.length > 0 && canNavigateToNext() && (
            <div className="mt-2">
              <button
                onClick={goToNextDate}
                className={`text-sm ${theme.accent} hover:underline`}
              >
                Check next available date →
              </button>
            </div>
          )}
        </div>
      )}
    </div>

    {/* Show reservation confirmation */}
    {/* Timer Display - Only show when card input is active */}
                    {selectedSlot && showTimer && (
                      <div className="flex justify-center mb-6">
                        <div className={`relative px-6 py-4 rounded-xl shadow-lg flex flex-col items-center space-y-2 transition-all duration-300 ${
                          timeRemaining <= 1
                            ? 'bg-red-500 text-white shadow-red-300 border-2 border-red-300'
                           
                          :timeRemaining <= 30
                            ? 'bg-red-500 text-white shadow-red-300 border-2 border-red-300'
                            : timeRemaining <= 60
                            ? 'bg-orange-500 text-white shadow-orange-300 border-2 border-orange-300'
                            : timeRemaining <= 120
                            ? 'bg-yellow-500 text-white shadow-yellow-300 border-2 border-yellow-300'
                            : 'bg-green-500 text-white shadow-green-300'
                        }`}>
                          <div className="flex items-center space-x-3">
                            <Clock 
                              size={24} 
                              className={
                                timeRemaining <= 30 
                                  ? 'animate-spin' 
                                  : timeRemaining <= 60 
                                  ? 'animate-bounce' 
                                  : ''
                              } 
                            />
                            <span className={`font-mono font-bold text-xl ${timeRemaining <= 30 ? 'animate-pulse' : ''}`}>
                              {formatTime(timeRemaining)}
                            </span>
                          </div>
                          <div className="text-center">
                            <p className={`text-sm font-medium ${timeRemaining <= 30 ? 'animate-pulse' : ''}`}>
                              {timeRemaining <= 1
                                ? '⚠️ Time up! Please choose another slot.'
                                :timeRemaining <= 30
                                ? '⚠️ HURRY UP! Time is running out!'
                                : timeRemaining <= 60
                                ? '⏰ Please complete your booking soon'
                                : timeRemaining <= 120
                                ? '⏳ Time remaining to complete payment'
                                : '✅ Payment session active'
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
  </div>
)}
                  </div>
                )}

                {/* Payment and Booking Summary - Fully Responsive Layout */}
                {((isVirtualAppointment() && selectedSlot) || (selectedClinic && selectedSlot)) && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 pt-6">
                    {/* Left Side - Payment Information */}
                    <div className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 lg:p-6 order-2 lg:order-1">
                      <div className="mb-4 lg:mb-6">
                        <div className="flex justify-between items-center mb-2 lg:mb-4">
                          {/* <span className="text-sm font-medium text-gray-700">Consultation Fee:</span> */}
                          {/* <span className="text-lg font-bold text-gray-900">€{paymentAmount}</span> */}
                        </div>
                      </div>

                      <Elements stripe={stripePromise} options={{ appearance: STRIPE_CONFIG.APPEARANCE }}>
                        <StripePayment
                          amount={paymentAmount}
                          onPaymentSuccess={handlePaymentSuccess}
                          onPaymentError={handlePaymentError}
                          isProcessing={isProcessingPayment}
                          setIsProcessing={setIsProcessingPayment}
                          bookingData={formData}
                          timeRemaining={timeRemaining}
                          isTimerActive={isTimerActive}
                          startTimer={startTimer}
                          formatTime={formatTime}
                          showTimer={showTimer}
                        />
                      </Elements>
                    </div>

                    {/* Right Side - Booking Summary */}
                    <div className={`p-3 sm:p-4 lg:p-6 rounded-lg ${theme.accentBg} border border-gray-200 order-1 lg:order-2`}>
                      <div className="flex items-center space-x-2 mb-4 lg:mb-6">

                        <h4 className="text-base sm:text-lg font-semibold text-gray-900">Booking Summary</h4>
                      </div>

                      <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm text-gray-600 mb-4 lg:mb-6">
                        <p className="break-words">👤 Patient: {formData.fullName || `${formData.firstName} ${formData.lastName}`.trim() || 'Not specified'}</p>

                        <p>📋 Type: {getAppointmentTypeDisplay()}</p>
                        {!isVirtualAppointment() && selectedClinic && (
                          <p className="break-words">🏥 Clinic: {selectedClinic.name}</p>
                        )}
                        <p>🕐 Time: {selectedSlot}</p>
                        <p className="break-words">📧 Email: {formData.email || 'Not specified'}</p>
                        <p className="break-words">📞 Phone: {formData.phoneNumber || 'Not specified'}</p>

                        {isVirtualAppointment() && (
                          <div className={`mt-3 sm:mt-4 p-2 sm:p-3 ${theme.accentBg} rounded-lg`}>
                            <p className={`${theme.text} font-medium text-xs sm:text-sm break-words`}>
                              {formData.appointmentType === 'vc'
                                ? '💻 Video link will be sent to your email'
                                : '📞 You will receive a call at the scheduled time'
                              }
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-gray-900">Total:</span>
                          <span className={`text-2xl font-bold ${theme.accent}`}>
                            €{paymentAmount}
                          </span>
                        </div>

                        {paymentSuccess && (
                          <div className="mt-3 flex items-center space-x-2 text-green-600">
                            <Check className="h-4 w-4" />
                            <span className="text-sm font-medium">Payment Completed</span>
                          </div>
                        )}

                        {paymentError && (
                          <div className="mt-3 text-red-600 text-sm">
                            Payment failed: {paymentError}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="p-4 sm:p-6 md:p-8 bg-white border-t border-gray-100">
                  <div className="flex justify-center">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className={`px-8 py-3 ${theme.primarySolid} text-white rounded-lg font-semibold text-sm transition-all transform hover:scale-105 shadow-md hover:shadow-lg ${theme.primaryHover}`}
                    >
                      Back to Details
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Success Popup */}
      {showSuccessPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
            {/* Header */}
            <div className="p-6 text-center">
              <div className={`w-16 h-16 ${theme.accentBg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                <AnimatedTick size={32} className="" color={theme.accent} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
              {/* <p className={`text-lg font-bold ${theme.accent} mb-4`}>{bookingReference}</p> */}
            </div>

            {/* Booking Summary */}
            <div className="px-6 pb-6">
              <div className="space-y-3">
                {/* Case Number - Display if available */}
                {reservedAppointment?.CaseNo && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Case Number:</span>
                    <span className="font-medium text-gray-900">
                      {reservedAppointment.CaseNo}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Patient:</span>
                  <span className="font-medium text-gray-900">
                    {formData.fullName || `${formData.firstName} ${formData.lastName}`.trim() || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium text-gray-900">
                    {getAppointmentTypeDisplay()}
                  </span>
                </div>

                {selectedSlot && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Time:</span>
                    <span className="font-medium text-gray-900">{selectedSlot}</span>
                  </div>
                )}

                {!isVirtualAppointment() && selectedClinic && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Clinic:</span>
                      <span className="font-medium text-gray-900">{selectedClinic.name}</span>
                    </div>
                    {selectedClinic.direction && selectedClinic.direction !== 'No directions available' && (
                      <div className="mt-1">
                        <span className="text-xs text-gray-500 break-words">
                          📍 {selectedClinic.direction}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div className="flex justify-between items-center pt-2 h-12 sm:h-16 border-t border-gray-200">
                  <span className="text-gray-600 text-sm sm:text-base">Amount:</span>
                  <span className={`font-bold text-base sm:text-lg ${theme.accent}`}>
                    {isVirtualAppointment() ? `€${paymentAmount}` : (selectedClinic?.price || `€${paymentAmount}`)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                {/* Go to Home Button */}
                <button
                  onClick={handleSuccessPopupClose}
                  className={`flex-1 ${theme.primarySolid} ${theme.primaryHover} text-white py-3 px-4 rounded-lg font-medium text-base transition-all transform hover:scale-105 shadow-md hover:shadow-lg flex items-center justify-center space-x-2`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>Home</span>
                </button>

                {/* Get Directions Button */}
                <button
                  onClick={handleGetDirections}
                  className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg font-medium text-base transition-all transform hover:scale-105 shadow-md hover:shadow-lg flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Directions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMS Form Popup */}
      {showSmsForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            {/* Close Button */}
            <button
              onClick={() => setShowSmsForm(false)}
              className="absolute -top-2 -right-2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* SMS Form Component */}
            <SendSms
              currentTheme={currentTheme}
              apiEndpoint="https://your-backend.com/api/sms"
              onSuccess={(data) => {
                console.log('SMS sent successfully:', data);
                // You can add success handling here
              }}
              onError={(error) => {
                console.error('SMS sending failed:', error);
                // You can add error handling here
              }}
            />
          </div>
        </div>
      )}

      {/* Sign In Webhook Response Popup */}
      {showSignInPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Webhook Response</h2>
                <button
                  onClick={handleSignInPopupClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Response Content */}
            <div className="p-6 overflow-y-auto max-h-96">
              {webhookResponse ? (
                <div className="space-y-4">
                  {/* Status Indicator */}
                  <div className={`flex items-center space-x-2 p-3 rounded-lg ${
                    webhookResponse.error
                      ? 'bg-red-50 text-red-700'
                      : 'bg-green-50 text-green-700'
                  }`}>
                    {webhookResponse.error ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="font-medium">
                      {webhookResponse.error ? 'Error Response' : 'Success Response'}
                    </span>
                  </div>

                  {/* Table Response */}
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                      <h3 className="text-sm font-medium text-gray-700">Response Data</h3>
                    </div>
                    <div className="p-4">
                      {renderJsonAsTable(webhookResponse)}
                    </div>
                  </div>

                  {/* Response Details */}
                  {webhookResponse.status && (
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-blue-700 mb-2">HTTP Details:</h3>
                      <div className="text-sm text-blue-600 space-y-1">
                        <p><strong>Status:</strong> {webhookResponse.status} {webhookResponse.statusText}</p>
                        <p><strong>Timestamp:</strong> {new Date().toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 flex justify-center">
                    <LoadingSpinner size="w-8 h-8" color="border-blue-500" />
                  </div>
                  <p className="text-gray-600">Loading webhook response...</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={handleSignInPopupClose}
                className={`w-full ${theme.primarySolid} ${theme.primaryHover} text-white py-3 px-6 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 shadow-lg`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








































































































































