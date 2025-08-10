import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import LandingPage from './LandingPage';
import CareHQBooking from '../App'; // Import the main booking app
import VideoCallPage from './VideoCallPage';

// Landing Page Wrapper to handle navigation
const LandingPageWrapper = () => {
  const navigate = useNavigate();

  const handleOpenAppointment = () => {
    navigate('/booking');
  };

  return <LandingPage onOpenAppointment={handleOpenAppointment} />;
};

// Booking Page Wrapper
const BookingPageWrapper = () => {
  return (
    <div>
      {/* Back to Landing Button - HIDDEN */}
      {/* <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => navigate('/')}
          className="bg-white shadow-lg hover:shadow-xl px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:text-blue-600 transition-all duration-300 flex items-center gap-2"
        >
          ← Back to Home
        </button>
      </div> */}
      <CareHQBooking />
    </div>
  );
};

export default function AppRouter() {
  return (
    <Router>
      <Routes>
        {/* Main application routes */}
        <Route path="/" element={<LandingPageWrapper />} />
        <Route path="/booking" element={<BookingPageWrapper />} />

        {/* Video call routes */}
        <Route
          path="/video-call/:roomName"
          element={<VideoCallPage identityPrefix="patient" />}
        />
        <Route
          path="/practice-call/:roomName"
          element={<VideoCallPage identityPrefix="practice" />}
        />

        {/* Fallback route */}
        <Route path="*" element={<LandingPageWrapper />} />
      </Routes>
    </Router>
  );
}
