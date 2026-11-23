import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Sparkles,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  BarChart3,
  UserCheck,
  Search,
  Filter,
  ArrowRight,
  Info,
  RefreshCw,
  Cpu,
  Microscope,
  Box,
  Radio,
  Activity,
  Zap,
  Thermometer,
  Wifi,
  Wrench,
  Play,
  Pause,
  AlertOctagon,
  ExternalLink,
  Download
} from 'lucide-react';

export default function App() {
  // Navigation & Role State
  const [activeTab, setActiveTab] = useState('catalogue'); // catalogue | ai | bookings | faculty | analytics | iot
  const [currentRole, setCurrentRole] = useState('student'); // student | faculty | admin
  const [currentStudentId, setCurrentStudentId] = useState('std_1');

  // Core Data State
  const [equipmentList, setEquipmentList] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // IoT Intelligence State
  const [iotDevices, setIotDevices] = useState([]);
  const [iotAnalytics, setIotAnalytics] = useState(null);
  const [iotDeptFilter, setIotDeptFilter] = useState('all');
  const [simulationPaused, setSimulationPaused] = useState(false);
  const [iotLastUpdated, setIotLastUpdated] = useState('');
  const [iotLoading, setIotLoading] = useState(false);
  const [demoActive, setDemoActive] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // AI Matcher State
  const [aiTitle, setAiTitle] = useState('Characterization of High-Frequency GaN Half-Bridge Inverter');
  const [aiDesc, setAiDesc] = useState('Characterization of fast switching transients and ringing in Gallium Nitride half-bridge modules at 500 kHz. Requires 1 GHz real-time bandwidth and high voltage differential probes.');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null);
  const [aiEngineStatus, setAiEngineStatus] = useState(null);

  // Calendar Connect & OAuth Sync State
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [calendarConflicts, setCalendarConflicts] = useState([]);
  const [syncedEventsList, setSyncedEventsList] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [bookingStartTime, setBookingStartTime] = useState('2026-11-25T14:00');
  const [bookingEndTime, setBookingEndTime] = useState('2026-11-25T16:00');
  const [bookingProjectId, setBookingProjectId] = useState('proj_1');
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [conflictResponse, setConflictResponse] = useState(null);

  // Auto-refresh interval ref
  const timerRef = useRef(null);

  // Load Core Data
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const [eqRes, bookRes, projRes, anaRes] = await Promise.all([
        fetch('/api/equipment'),
        fetch('/api/bookings'),
        fetch('/api/projects'),
        fetch('/api/analytics')
      ]);

      if (eqRes.ok) {
        const eqData = await eqRes.json();
        setEquipmentList(eqData.data || []);
      }
      if (bookRes.ok) {
        const bookData = await bookRes.json();
        setBookingsList(bookData.data || []);
      }
      if (projRes.ok) {
        const projData = await projRes.json();
        setProjectsList(projData.data || []);
      }
      if (anaRes.ok) {
        const anaData = await anaRes.json();
        setAnalyticsData(anaData.data);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setErrorMsg('Failed to connect to LabLink API server.');
    } finally {
      setLoading(false);
    }
  };

  // Load IoT Telemetry Data
  const fetchIotData = async () => {
    try {
      const [devRes, anaRes] = await Promise.all([
        fetch('/api/iot/devices'),
        fetch('/api/iot/analytics')
      ]);

      if (devRes.ok) {
        const devData = await devRes.json();
        setIotDevices(devData.data || []);
        setSimulationPaused(devData.simulationPaused || false);
        setIotLastUpdated(new Date().toLocaleTimeString());
        // Check if demo is currently active
        const eceDev = devData.data?.find(d => d.equipmentId === 'eq_1');
        setDemoActive(eceDev?.telemetry?.temperature > 65);
      }
      if (anaRes.ok) {
        const anaData = await anaRes.json();
        setIotAnalytics(anaData.data);
      }
    } catch (err) {
      console.error('IoT Fetch error:', err);
    }
  };

  // Fetch AI Engine Status
  const fetchAiStatus = async () => {
    try {
      const res = await fetch('/api/ai/status');
      if (res.ok) {
        const data = await res.json();
        setAiEngineStatus(data.data);
      }
    } catch (e) {
      console.warn('AI status check:', e.message);
    }
  };

  // Fetch Google Calendar Sync & Connection Data
  const fetchCalendarData = async (studentId = currentStudentId) => {
    try {
      setCalendarLoading(true);
      const headers = { 'x-student-id': studentId };
      const [statusRes, conflictsRes, eventsRes] = await Promise.all([
        fetch(`/api/calendar/status?studentId=${studentId}`, { headers }),
        fetch(`/api/calendar/conflicts?studentId=${studentId}`, { headers }),
        fetch(`/api/calendar/synced-events?studentId=${studentId}`, { headers })
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setCalendarStatus(statusData.data);
      }
      if (conflictsRes.ok) {
        const confData = await conflictsRes.json();
        setCalendarConflicts(confData.data || []);
      }
      if (eventsRes.ok) {
        const evData = await eventsRes.json();
        setSyncedEventsList(evData.data || []);
      }
    } catch (e) {
      console.warn('Calendar sync data fetch error:', e.message);
    } finally {
      setCalendarLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData();
    fetchIotData();
    fetchAiStatus();
    fetchCalendarData(currentStudentId);

    // Check if returning from Google OAuth redirect
    if (window.location.search.includes('calendar_connected=success')) {
      setSuccessMsg('Google Calendar successfully connected! Two-way reservation synchronization is active.');
      // Clean up URL without reload
      window.history.replaceState({}, document.title, window.location.pathname + '#calendar');
      setActiveTab('calendar');
    }
  }, []);

  // Refetch student calendar data when active student persona changes
  useEffect(() => {
    fetchCalendarData(currentStudentId);
  }, [currentStudentId]);

  // Periodic Telemetry Simulation Polling (every 4 seconds when active)
  useEffect(() => {
    if (activeTab === 'iot' && !simulationPaused) {
      timerRef.current = setInterval(async () => {
        // Trigger simulation tick and refresh
        try {
          await fetch('/api/iot/simulate-tick', { method: 'POST' });
          fetchIotData();
        } catch (e) {}
      }, 4000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeTab, simulationPaused]);

  // Calendar Connect & Synchronization Handlers
  const handleConnectCalendar = async () => {
    try {
      setCalendarLoading(true);
      const res = await fetch(`/api/calendar/connect?studentId=${currentStudentId}`, {
        headers: { Accept: 'application/json', 'x-student-id': currentStudentId }
      });
      const data = await res.json();
      if (res.ok && data.data?.authUrl) {
        window.location.href = data.data.authUrl;
      } else {
        setErrorMsg('Failed to initiate Google Calendar connection.');
      }
    } catch (err) {
      setErrorMsg('Network error connecting to Google Calendar OAuth.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      setCalendarLoading(true);
      const res = await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-id': currentStudentId }
      });
      if (res.ok) {
        setSuccessMsg('Google Calendar disconnected.');
        await fetchCalendarData(currentStudentId);
      }
    } catch (err) {
      setErrorMsg('Failed to disconnect Google Calendar.');
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleTriggerCalendarSync = async () => {
    try {
      setSyncingCalendar(true);
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-student-id': currentStudentId }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Incremental calendar synchronization completed.');
        await fetchCalendarData(currentStudentId);
      } else {
        setErrorMsg(data.error || 'Calendar synchronization failed.');
      }
    } catch (err) {
      setErrorMsg('Network error during calendar synchronization.');
    } finally {
      setSyncingCalendar(false);
    }
  };

  const handleResolveCalendarConflict = async (conflictId) => {
    try {
      const res = await fetch(`/api/calendar/conflicts/${conflictId}/resolve`, {
        method: 'POST'
      });
      if (res.ok) {
        setSuccessMsg('Calendar conflict notification acknowledged.');
        await fetchCalendarData(currentStudentId);
      }
    } catch (err) {
      setErrorMsg('Failed to acknowledge conflict.');
    }
  };

  // IoT Simulation Controls
  const handleTickManual = async () => {
    setIotLoading(true);
    try {
      await fetch('/api/iot/simulate-tick', { method: 'POST' });
      await fetchIotData();
      setSuccessMsg('Telemetry values refreshed.');
    } catch (err) {
      setErrorMsg('Failed to update telemetry values.');
    } finally {
      setIotLoading(false);
    }
  };

  const handleToggleSimulationPause = async () => {
    try {
      const endpoint = simulationPaused ? '/api/iot/resume' : '/api/iot/pause';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        setSimulationPaused(!simulationPaused);
        setSuccessMsg(simulationPaused ? 'Telemetry simulation resumed.' : 'Telemetry simulation paused.');
      }
    } catch (err) {
      setErrorMsg('Failed to toggle simulation state.');
    }
  };

  // Demo Scenario: Trigger Electronics Overheat
  const handleTriggerOverheatDemo = async () => {
    try {
      setIotLoading(true);
      const res = await fetch('/api/iot/demo/overheat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId: 'eq_1' })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchIotData();
        setDemoActive(true);
        setSuccessMsg('Demo Active: Keysight Oscilloscope simulated temperature spiked to 74.8°C! Rule-based thermal warning generated.');
      }
    } catch (err) {
      setErrorMsg('Failed to trigger overheat demo.');
    } finally {
      setIotLoading(false);
    }
  };

  // Demo Scenario: Resolve Overheat
  const handleResolveOverheatDemo = async () => {
    try {
      setIotLoading(true);
      const res = await fetch('/api/iot/demo/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentId: 'eq_1' })
      });
      if (res.ok) {
        await fetchIotData();
        await fetchData(); // refresh equipment status
        setDemoActive(false);
        setSuccessMsg('Demo Resolved: Thermal telemetry returned to nominal 41.2°C. Warnings cleared and equipment restored to operational.');
      }
    } catch (err) {
      setErrorMsg('Failed to resolve overheat demo.');
    } finally {
      setIotLoading(false);
    }
  };

  // Toggle Equipment Maintenance from IoT Intelligence
  const handleToggleDeviceMaintenance = async (deviceId, isMaintenance) => {
    try {
      setIotLoading(true);
      const res = await fetch(`/api/iot/devices/${deviceId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isMaintenance,
          reason: isMaintenance ? 'Emergency maintenance triggered by IoT thermal warning.' : 'Maintenance resolved; telemetry verified safe.'
        })
      });

      if (res.ok) {
        await fetchIotData();
        await fetchData(); // Refresh booking & equipment data
        setSuccessMsg(isMaintenance 
          ? 'Equipment placed under MAINTENANCE. All new bookings blocked; confirmed reservations flagged for review.'
          : 'Equipment restored to OPERATIONAL. Booking eligibility restored.'
        );
      }
    } catch (err) {
      setErrorMsg('Failed to update maintenance state.');
    } finally {
      setIotLoading(false);
    }
  };

  // Filtered Equipment List for Catalogue
  const filteredEquipment = equipmentList.filter(eq => {
    const matchesSearch = !searchQuery ||
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.labRoom.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = selectedDept === 'all' || eq.department === selectedDept;
    const matchesStatus = selectedStatus === 'all' || eq.status === selectedStatus;

    return matchesSearch && matchesDept && matchesStatus;
  });

  // Filtered IoT Devices
  const filteredIotDevices = iotDevices.filter(dev => {
    if (iotDeptFilter === 'all') return true;
    return dev.deptCategory === iotDeptFilter;
  });

  // Handle AI Matching
  const handleAiMatch = async (e) => {
    e.preventDefault();
    if (!aiDesc || aiDesc.trim().length < 5) {
      setErrorMsg('Please enter a descriptive project hypothesis or equipment requirements.');
      return;
    }
    setAiLoading(true);
    setAiResults(null);
    setErrorMsg('');

    try {
      const res = await fetch('/api/ai/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: aiTitle, description: aiDesc })
      });
      const data = await res.json();
      if (res.ok) {
        setAiResults(data.data);
      } else {
        setErrorMsg(data.error || 'AI matching failed.');
      }
    } catch (err) {
      setErrorMsg('Network error connecting to AI matching service.');
    } finally {
      setAiLoading(false);
    }
  };

  // Open Booking Modal for Equipment
  const openBookingModal = (equipment) => {
    setSelectedEquipment(equipment);
    setConflictResponse(null);
    setErrorMsg('');
    setSuccessMsg('');
    setBookingPurpose(`Testing for project ${bookingProjectId}`);
    setBookingModalOpen(true);
  };

  // Submit Booking Request
  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    setBookingSubmitting(true);
    setConflictResponse(null);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        equipmentId: selectedEquipment.id,
        studentId: currentStudentId,
        projectId: bookingProjectId,
        requestedStartTime: new Date(bookingStartTime).toISOString(),
        requestedEndTime: new Date(bookingEndTime).toISOString(),
        purposeSummary: bookingPurpose || 'Experimental testing session'
      };

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 201) {
        setSuccessMsg(`Booking request submitted! Status: Pending Faculty Endorsement. FAIRALLOC Score: ${data.data.allocationMetadata?.fairAllocScore}/100.`);
        setBookingModalOpen(false);
        fetchData();
      } else if (res.status === 409 || res.status === 422 || res.status === 403) {
        // Conflict or eligibility block
        setConflictResponse(data);
      } else {
        setErrorMsg(data.error || 'Booking request failed.');
      }
    } catch (err) {
      setErrorMsg('Failed to submit booking request.');
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Faculty Endorsement Action
  const handleFacultyEndorse = async (bookingId, isApproved) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/endorse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facultyId: 'fac_1',
          isApproved,
          note: isApproved ? 'Verified project necessity for capstone milestone.' : 'Usage scope exceeds allocation guideline.'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Booking ${bookingId} has been ${isApproved ? 'APPROVED and confirmed' : 'REJECTED'}.`);
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to update endorsement status.');
      }
    } catch (err) {
      setErrorMsg('Error submitting faculty action.');
    }
  };

  // Adopt Alternative Feasible Slot
  const adoptAlternativeSlot = (altSlot) => {
    const startLocal = new Date(altSlot.startTime).toISOString().slice(0, 16);
    const endLocal = new Date(altSlot.endTime).toISOString().slice(0, 16);
    setBookingStartTime(startLocal);
    setBookingEndTime(endLocal);
    if (altSlot.equipmentId !== selectedEquipment.id) {
      const altEq = equipmentList.find(e => e.id === altSlot.equipmentId);
      if (altEq) setSelectedEquipment(altEq);
    }
    setConflictResponse(null);
    setSuccessMsg('Feasible alternative slot applied. Click Submit to reserve.');
  };

  // Calendar Connect: Open prefilled Google Calendar URL
  const handleAddToGoogleCalendar = async (booking) => {
    try {
      setErrorMsg('');
      const res = await fetch(`/api/bookings/${booking.id}/calendar`);
      const data = await res.json();
      if (res.ok && data.data?.googleCalendarUrl) {
        window.open(data.data.googleCalendarUrl, '_blank', 'noopener,noreferrer');
        setSuccessMsg(`Google Calendar event generated for ${booking.id}. Review and save in your personal calendar (Asia/Kolkata).`);
      } else {
        setErrorMsg(data.error || 'Cannot export unconfirmed reservation to calendar.');
      }
    } catch (err) {
      setErrorMsg('Failed to generate Google Calendar event link.');
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId) => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by student in portal' })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Reservation ${bookingId} has been cancelled. Calendar synchronization disabled.`);
        fetchData();
      } else {
        setErrorMsg(data.error || 'Failed to cancel booking.');
      }
    } catch (err) {
      setErrorMsg('Error submitting cancellation request.');
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'rf_microwave':
      case 'electronics':
        return <Radio size={18} className="text-teal-600" />;
      case 'microscopy':
        return <Microscope size={18} className="text-teal-600" />;
      case 'compute_gpu':
      case 'computer_science':
        return <Cpu size={18} className="text-teal-600" />;
      case 'prototyping':
      case 'mechanical':
        return <Box size={18} className="text-teal-600" />;
      case 'robotics':
        return <Wrench size={18} className="text-teal-600" />;
      default:
        return <Layers size={18} className="text-teal-600" />;
    }
  };

  return (
    <div className="app-container">
      {/* Top Institutional Header */}
      <header className="header" role="banner">
        <div className="header-inner">
          <div className="logo-group">
            <span className="logo-badge">LABLINK</span>
            <div>
              <h1 className="logo-text">Intelligent Laboratory Network</h1>
              <p style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>Fair Allocation & IoT Hardware Telemetry Intelligence</p>
            </div>
          </div>

          <nav className="nav-links" aria-label="Main Navigation">
            <button
              onClick={() => setActiveTab('catalogue')}
              className={`nav-btn ${activeTab === 'catalogue' ? 'active' : ''}`}
              aria-current={activeTab === 'catalogue' ? 'page' : undefined}
            >
              <Compass size={16} /> Equipment Catalogue
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`nav-btn ${activeTab === 'ai' ? 'active' : ''}`}
              aria-current={activeTab === 'ai' ? 'page' : undefined}
            >
              <Sparkles size={16} /> AI Project Matcher
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={`nav-btn ${activeTab === 'bookings' ? 'active' : ''}`}
              aria-current={activeTab === 'bookings' ? 'page' : undefined}
            >
              <Calendar size={16} /> FAIRALLOC Bookings
            </button>
            <button
              onClick={() => setActiveTab('iot')}
              className={`nav-btn ${activeTab === 'iot' ? 'active' : ''}`}
              aria-current={activeTab === 'iot' ? 'page' : undefined}
            >
              <Activity size={16} /> IoT Intelligence
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`nav-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              aria-current={activeTab === 'calendar' ? 'page' : undefined}
            >
              <Calendar size={16} /> Calendar Sync
              {calendarStatus?.connected && (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--lime-500)', display: 'inline-block' }} />
              )}
              {calendarConflicts.length > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem' }}>
                  {calendarConflicts.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('faculty')}
              className={`nav-btn ${activeTab === 'faculty' ? 'active' : ''}`}
              aria-current={activeTab === 'faculty' ? 'page' : undefined}
            >
              <UserCheck size={16} /> Faculty Approvals
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              aria-current={activeTab === 'analytics' ? 'page' : undefined}
            >
              <BarChart3 size={16} /> Utilization Analytics
            </button>
          </nav>

          {/* Role Persona Switcher for Evaluation */}
          <div className="role-switcher">
            <span className="role-label">Persona:</span>
            <select
              value={currentRole}
              onChange={(e) => {
                const r = e.target.value;
                setCurrentRole(r);
                if (r === 'student') setCurrentStudentId('std_1');
                if (r === 'ineligible_student') setCurrentStudentId('std_ineligible');
              }}
              className="role-select"
              aria-label="Select User Role Persona"
            >
              <option value="student">Student: Aarav (ECE, Eligible)</option>
              <option value="ineligible_student">Student: Karan (Uncertified)</option>
              <option value="faculty">Faculty Supervisor: Dr. Sen</option>
              <option value="admin">Lab Operations Admin</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content" role="main">
        {/* Global Notifications */}
        {errorMsg && (
          <div className="alert alert-error" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Error:</strong> {errorMsg}
            </div>
          </div>
        )}
        {successMsg && (
          <div className="alert alert-success" role="status">
            <CheckCircle2 size={18} />
            <div>{successMsg}</div>
          </div>
        )}

        {/* TAB: IOT INTELLIGENCE */}
        {activeTab === 'iot' && (
          <div>
            {/* Header & Transparency Notice */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)' }}>
                    LabLink IoT Intelligence & Telemetry
                  </h2>
                  <span className="badge badge-iot-simulated">
                    SIMULATED DATA
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Live simulated sensor network monitoring thermal load, power draw, and mechanical stability across laboratory equipment.
                </p>
              </div>

              {/* Simulation Status & Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', background: '#FFFFFF', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)' }}>
                  <span className={simulationPaused ? 'paused-dot' : 'pulse-dot'}></span>
                  <span style={{ fontWeight: 600 }}>
                    {simulationPaused ? 'Simulation Paused' : 'Live Simulation (4s Tick)'}
                  </span>
                  {iotLastUpdated && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({iotLastUpdated})</span>
                  )}
                </div>

                <button
                  onClick={handleToggleSimulationPause}
                  className="btn btn-outline"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                  aria-label={simulationPaused ? 'Resume Simulation' : 'Pause Simulation'}
                >
                  {simulationPaused ? <Play size={14} /> : <Pause size={14} />}
                  {simulationPaused ? 'Resume' : 'Pause'}
                </button>

                <button
                  onClick={handleTickManual}
                  disabled={iotLoading}
                  className="btn btn-outline"
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
                  aria-label="Force Telemetry Update"
                >
                  <RefreshCw size={14} className={iotLoading ? 'spin' : ''} /> Force Update
                </button>
              </div>
            </div>

            {/* Prominent Simulated Data Notice */}
            <div className="alert alert-info" style={{ marginBottom: '1.5rem', padding: '0.85rem 1.25rem' }}>
              <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>SIMULATED DATA NOTICE:</strong> All telemetry values (temperatures, power consumption in watts, and vibration readings) are software-simulated. No physical IoT hardware is connected. Health evaluation uses transparent, rule-based thresholds (no predictive black-box ML).
              </div>
            </div>

            {/* DEMO SCENARIO CONTROL CARD */}
            <div className="card" style={{ marginBottom: '1.5rem', background: demoActive ? '#FFFBEB' : '#F9FAF8', border: demoActive ? '1px solid #F59E0B' : '1px solid #D5E2DC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <Flame size={18} style={{ color: demoActive ? '#D97706' : 'var(--forest-800)' }} />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: demoActive ? '#92400E' : 'var(--forest-900)' }}>
                      Demonstration Scenario: Electronics Workstation Thermal Alert & Booking Lockout
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Simulates an over-temperature condition on the Keysight DSOX3014T Oscilloscope (RF Bench), triggering rule-based warnings and demonstrating how LabLink connects IoT health to booking eligibility.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!demoActive ? (
                    <button
                      onClick={handleTriggerOverheatDemo}
                      disabled={iotLoading}
                      className="btn btn-amber"
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    >
                      <Flame size={16} /> Trigger Overheat Demo (74.8°C)
                    </button>
                  ) : (
                    <button
                      onClick={handleResolveOverheatDemo}
                      disabled={iotLoading}
                      className="btn btn-lime"
                      style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                    >
                      <CheckCircle2 size={16} /> Resolve Overheat & Restore (41.2°C)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* IoT Fleet Macro Metrics */}
            {iotAnalytics && (
              <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Wifi size={16} /> MONITORED NODES
                  </div>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--forest-900)' }}>
                    {iotAnalytics.summary?.totalMonitoredNodes}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--status-operational)' }}>
                    Across 4 Departments
                  </p>
                </div>

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Zap size={16} /> TOTAL POWER LOAD
                  </div>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--teal-600)' }}>
                    {iotAnalytics.summary?.totalPowerConsumptionKw} kW
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Aggregate Simulated Draw
                  </p>
                </div>

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <AlertTriangle size={16} /> ACTIVE WARNINGS
                  </div>
                  <p style={{ fontSize: '1.8rem', fontWeight: 800, color: iotAnalytics.summary?.totalActiveWarnings > 0 ? '#DC2626' : 'var(--status-operational)' }}>
                    {iotAnalytics.summary?.totalActiveWarnings}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Rule-Based Threshold Alerts
                  </p>
                </div>

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 600 }}>
                    <Shield size={16} /> FLEET HEALTH
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    <span className="badge badge-operational">{iotAnalytics.summary?.healthDistribution?.normal} Normal</span>
                    {iotAnalytics.summary?.healthDistribution?.warning > 0 && (
                      <span className="badge badge-conflict">{iotAnalytics.summary?.healthDistribution?.warning} Alert</span>
                    )}
                    <span className="badge badge-maintenance">{iotAnalytics.summary?.healthDistribution?.maintenance} Maint</span>
                  </div>
                </div>
              </div>
            )}

            {/* Department Filter Pills */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {[
                { id: 'all', label: 'All Departments' },
                { id: 'electronics', label: 'Electronics & RF' },
                { id: 'computer_science', label: 'Computer Science & AI' },
                { id: 'mechanical', label: 'Mechanical Engineering' },
                { id: 'robotics', label: 'Robotics & Automation' }
              ].map(d => (
                <button
                  key={d.id}
                  onClick={() => setIotDeptFilter(d.id)}
                  className={`btn ${iotDeptFilter === d.id ? 'btn-primary' : 'btn-outline'}`}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem' }}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Device Monitoring Cards Grid */}
            <div className="grid-3" style={{ marginBottom: '2rem' }}>
              {filteredIotDevices.map((dev) => {
                const temp = dev.telemetry.temperature;
                const maxTemp = dev.thresholds.maxTemperature;
                const isOverTemp = temp > maxTemp;
                const isNearTemp = temp > maxTemp * 0.85 && !isOverTemp;
                const isUnderMaintenance = dev.operationalState === 'maintenance';
                const hasWarnings = dev.activeWarnings && dev.activeWarnings.length > 0;

                return (
                  <div
                    key={dev.deviceId}
                    className="card"
                    style={{
                      borderLeft: isUnderMaintenance 
                        ? '4px solid #F59E0B' 
                        : (hasWarnings ? '4px solid #DC2626' : '4px solid #10B981'),
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      {/* Top Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                            {getCategoryIcon(dev.deptCategory)}
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                              {dev.deviceId}
                            </span>
                          </div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--forest-900)' }}>
                            {dev.name}
                          </h3>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {dev.department} â€¢ {dev.labRoom}
                          </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                          <span className={`badge ${dev.connectionStatus === 'online' ? 'badge-operational' : 'badge-maintenance'}`}>
                            {dev.connectionStatus.toUpperCase()}
                          </span>
                          <span className={`badge ${isUnderMaintenance ? 'badge-maintenance' : (dev.operationalState === 'active' ? 'badge-fairalloc' : 'badge-operational')}`}>
                            {dev.operationalState.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Rule-Based Alert Warning Banner */}
                      {hasWarnings && (
                        <div className="alert alert-error" style={{ padding: '0.65rem 0.85rem', fontSize: '0.8rem', marginBottom: '0.85rem', display: 'block' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                            <AlertOctagon size={16} /> Rule-Based Alert Triggered:
                          </div>
                          <ul style={{ paddingLeft: '1.25rem' }}>
                            {dev.activeWarnings.map((w, idx) => (
                              <li key={idx}>{w.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Telemetry Sensor Readings Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                        {/* Temperature */}
                        <div className="gauge-box">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Thermometer size={14} /> Temp
                            </span>
                            <span style={{ fontWeight: 700, color: isOverTemp ? '#DC2626' : (isNearTemp ? '#D97706' : 'var(--forest-800)') }}>
                              {temp}°C
                            </span>
                          </div>
                          <div className="metric-bar">
                            <div
                              className="metric-fill"
                              style={{
                                width: `${Math.min(100, (temp / maxTemp) * 100)}%`,
                                backgroundColor: isOverTemp ? '#DC2626' : (isNearTemp ? '#F59E0B' : '#10B981')
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Limit: {maxTemp}°C
                          </div>
                        </div>

                        {/* Power Consumption */}
                        <div className="gauge-box">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Zap size={14} /> Power
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--forest-800)' }}>
                              {dev.telemetry.powerWatts} W
                            </span>
                          </div>
                          <div className="metric-bar">
                            <div
                              className="metric-fill"
                              style={{
                                width: `${Math.min(100, (dev.telemetry.powerWatts / dev.thresholds.maxPowerWatts) * 100)}%`,
                                backgroundColor: dev.telemetry.powerWatts > dev.thresholds.maxPowerWatts ? '#DC2626' : 'var(--teal-600)'
                              }}
                            />
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Limit: {dev.thresholds.maxPowerWatts} W
                          </div>
                        </div>

                        {/* Utilization */}
                        <div className="gauge-box">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Activity size={14} /> Util
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--forest-800)' }}>
                              {dev.telemetry.utilizationPercent}%
                            </span>
                          </div>
                          <div className="metric-bar">
                            <div className="metric-fill" style={{ width: `${dev.telemetry.utilizationPercent}%` }} />
                          </div>
                        </div>

                        {/* Vibration / Jitter */}
                        <div className="gauge-box">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Shield size={14} /> Stability
                            </span>
                            <span style={{ fontWeight: 700, color: 'var(--forest-800)' }}>
                              {dev.telemetry.vibrationMmS} mm/s
                            </span>
                          </div>
                          <div className="metric-bar">
                            <div className="metric-fill" style={{ width: `${Math.min(100, (dev.telemetry.vibrationMmS / dev.thresholds.maxVibrationMmS) * 100)}%` }} />
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Last Update: {new Date(dev.telemetry.lastUpdated).toLocaleTimeString()}</span>
                        <span style={{ fontStyle: 'italic' }}>Simulated Value</span>
                      </div>
                    </div>

                    {/* Custodian Maintenance Control */}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
                      {!isUnderMaintenance ? (
                        <button
                          onClick={() => handleToggleDeviceMaintenance(dev.deviceId, true)}
                          className="btn btn-outline"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                        >
                          <Wrench size={14} /> Set Maintenance (Block Bookings)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleDeviceMaintenance(dev.deviceId, false)}
                          className="btn btn-lime"
                          style={{ width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.65rem' }}
                        >
                          <CheckCircle2 size={14} /> Restore Operational Status
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Department Utilization Comparison Chart */}
            {iotAnalytics?.departmentUtilizationComparison && (
              <div className="card">
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--forest-800)' }}>
                  Department-Level Equipment Utilization Comparison
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Aggregated telemetry utilization across active campus laboratory workstations.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {iotAnalytics.departmentUtilizationComparison.map((dept) => (
                    <div key={dept.departmentCategory}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600 }}>{dept.displayName} ({dept.monitoredNodes} Nodes)</span>
                        <span style={{ fontWeight: 700, color: 'var(--forest-800)' }}>{dept.averageUtilizationPercent}%</span>
                      </div>
                      <div className="metric-bar" style={{ height: '10px' }}>
                        <div className="metric-fill" style={{ width: `${dept.averageUtilizationPercent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: EQUIPMENT CATALOGUE */}
        {activeTab === 'catalogue' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)' }}>Shared Laboratory Catalogue</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Explore verified high-value instruments, micro-fabrication suites, and specialized kits across 5 departments.
                </p>
              </div>
              <button onClick={fetchData} className="btn btn-outline" aria-label="Refresh Equipment List">
                <RefreshCw size={16} /> Refresh Catalogue
              </button>
            </div>

            {/* Filter Bar */}
            <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: '1 1 240px', position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search by instrument name, model, room or keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '2.2rem' }}
                    aria-label="Search equipment"
                  />
                </div>

                <div style={{ flex: '0 1 200px' }}>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="form-select"
                    aria-label="Filter by department"
                  >
                    <option value="all">All Departments</option>
                    <option value="Electrical & Computer Engineering">ECE</option>
                    <option value="Materials & Nanotechnology">Materials & Nano</option>
                    <option value="Computer Science & AI">CS & AI</option>
                    <option value="Mechanical Engineering">Mechanical Eng</option>
                    <option value="Robotics & Autonomous Systems">Robotics</option>
                    <option value="Bioengineering">Bioengineering</option>
                  </select>
                </div>

                <div style={{ flex: '0 1 180px' }}>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="form-select"
                    aria-label="Filter by status"
                  >
                    <option value="all">All Statuses</option>
                    <option value="operational">Operational Only</option>
                    <option value="maintenance">Under Maintenance</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Equipment Grid */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <RefreshCw size={32} className="spin" style={{ color: 'var(--forest-800)', margin: '0 auto 1rem' }} />
                <p>Loading institutional equipment inventory...</p>
              </div>
            ) : filteredEquipment.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <Info size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                <p style={{ fontWeight: 600 }}>No equipment matches the selected filters.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Try broadening your search term or department selection.</p>
              </div>
            ) : (
              <div className="grid-3">
                {filteredEquipment.map((eq) => (
                  <div key={eq.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {getCategoryIcon(eq.category)}
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--forest-700)' }}>
                            {eq.department.split('&')[0]}
                          </span>
                        </div>
                        <span className={`badge badge-${eq.status}`}>
                          {eq.status.toUpperCase()}
                        </span>
                      </div>

                      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--forest-900)' }}>
                        {eq.name}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        Model: {eq.model} â€¢ Lab: {eq.labRoom}
                      </p>

                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.4 }}>
                        {eq.description}
                      </p>

                      {/* Technical Specs Tags */}
                      <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                        <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                          TECHNICAL PARAMETERS:
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {Object.entries(eq.specifications || {}).map(([key, val]) => (
                            <span key={key} style={{ fontSize: '0.75rem', background: '#FFFFFF', padding: '0.15rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-light)' }}>
                              <strong>{key}:</strong> {String(val)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Safety Prerequisites */}
                      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Shield size={14} />
                        <span>Prerequisites: {eq.safetyPrerequisites.join(', ') || 'General Lab Safety'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => openBookingModal(eq)}
                      disabled={eq.status !== 'operational'}
                      className={`btn ${eq.status === 'operational' ? 'btn-primary' : 'btn-outline'}`}
                      style={{ width: '100%' }}
                    >
                      {eq.status === 'operational' ? 'Request Project Slot' : 'Unavailable (Maintenance)'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AI PROJECT-TO-EQUIPMENT MATCHER */}
        {activeTab === 'ai' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)' }}>
                  GenAI Project-to-Equipment Matcher
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  State your hypothesis, test method, or deliverable needs. AI extracts hardware parameters and identifies suitable equipment grounded in actual campus inventory.
                </p>
              </div>

              {/* Live Provider Indicator Pill */}
              <div>
                {aiResults ? (
                  aiResults.provider === 'gemini' ? (
                    <span className="badge badge-lime" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                      <Sparkles size={14} /> Google Gemini ({aiResults.model || 'Flash'}) • Live Grounded
                    </span>
                  ) : (
                    <span className="badge badge-fairalloc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                      <Cpu size={14} /> Institutional Deterministic Engine (Offline Fallback)
                    </span>
                  )
                ) : aiEngineStatus ? (
                  aiEngineStatus.isConfigured ? (
                    <span className="badge badge-lime" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                      <Sparkles size={14} /> Gemini {aiEngineStatus.model} Ready
                    </span>
                  ) : (
                    <span className="badge badge-fairalloc" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                      <Cpu size={14} /> Offline Rule Engine Active
                    </span>
                  )
                ) : null}
              </div>
            </div>

            <div className="grid-2" style={{ alignItems: 'start' }}>
              {/* Form Input Card */}
              <div className="card">
                <form onSubmit={handleAiMatch}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ai-title">Project Title / Deliverable</label>
                    <input
                      id="ai-title"
                      type="text"
                      className="form-input"
                      value={aiTitle}
                      onChange={(e) => setAiTitle(e.target.value)}
                      placeholder="e.g. GaN Half-Bridge Inverter Characterization"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="ai-desc">Technical Requirements / Methodology</label>
                    <textarea
                      id="ai-desc"
                      className="form-textarea"
                      rows={5}
                      value={aiDesc}
                      onChange={(e) => setAiDesc(e.target.value)}
                      placeholder="Describe necessary signal bandwidth, resolution, sample prep, lasers, compute VRAM, or materials..."
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                      onClick={() => {
                        setAiTitle('High-Speed GaN Power Inverter Characterization');
                        setAiDesc('Need to capture fast 500 kHz switching transients and gate drive ringing requiring 1 GHz bandwidth and 4 channels.');
                      }}
                    >
                      Preset: RF / Power
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                      onClick={() => {
                        setAiTitle('Robotic Automated Sample Pipetting System');
                        setAiDesc('Requires precision 6-axis articulated robot with sub-millimeter repeatability and automated sample trajectory handling.');
                      }}
                    >
                      Preset: Robotics
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                      onClick={() => {
                        setAiTitle('Fluorescent Antibody Cell Sorter for Tumor Isolation');
                        setAiDesc('Need confocal laser microscope with 488nm and 561nm excitation lines to perform super-resolution imaging on live micro-fluidic channels with sub-100nm resolution.');
                      }}
                    >
                      Preset: Bio-Imaging
                    </button>
                  </div>

                  <button type="submit" className="btn btn-lime" style={{ width: '100%' }} disabled={aiLoading}>
                    {aiLoading ? <RefreshCw size={16} className="spin" /> : <Sparkles size={16} />}
                    {aiLoading ? 'Extracting & Matching...' : 'Analyze & Match Equipment'}
                  </button>
                </form>
              </div>

              {/* Match Results Display */}
              <div>
                {!aiResults && !aiLoading && (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Sparkles size={36} style={{ color: 'var(--teal-600)', margin: '0 auto 1rem' }} />
                    <p style={{ fontWeight: 600 }}>Ready to Match</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Submit your project description to see structured technical extraction and grounded catalogue recommendations.
                    </p>
                  </div>
                )}

                {aiLoading && (
                  <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <RefreshCw size={32} className="spin" style={{ color: 'var(--forest-800)', margin: '0 auto 1rem' }} />
                    <p style={{ fontWeight: 600 }}>Analyzing Project Constraints...</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Extracting specifications, evaluating safety criteria, and querying campus inventory.
                    </p>
                  </div>
                )}

                {aiResults && (
                  <div>
                    {/* Fallback Notice if applicable */}
                    {aiResults.fallbackReason && (
                      <div style={{ background: '#FFFBEB', borderLeft: '3px solid #F59E0B', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#92400E', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Info size={14} style={{ flexShrink: 0 }} />
                        <span><strong>Engine Status:</strong> {aiResults.fallbackReason}</span>
                      </div>
                    )}

                    {/* Extracted Parameters Card */}
                    <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--teal-600)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--forest-800)' }}>
                          Extracted Hardware Requirements
                        </h4>
                        <span className="badge badge-fairalloc" style={{ fontSize: '0.75rem' }}>
                          {aiResults.extractedRequirements?.projectCategory || 'Academic Research'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                        {aiResults.extractedRequirements?.extractedCapabilities?.map((cap, i) => (
                          <span key={i} className="badge badge-fairalloc">{cap}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Recommended Session Duration: ~{aiResults.extractedRequirements?.estimatedSessionHours || 2} hours.
                      </p>
                    </div>

                    {/* Missing / Ambiguous Information Suggestions */}
                    {aiResults.missingOrAmbiguousInfo && aiResults.missingOrAmbiguousInfo.length > 0 && (
                      <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid #F59E0B', background: '#FFFDF5' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <AlertTriangle size={14} /> Identified Clarifications / Suggested Parameters
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#78350F' }}>
                          {aiResults.missingOrAmbiguousInfo.map((item, idx) => (
                            <li key={idx} style={{ marginBottom: '0.2rem' }}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Grounded Recommendations */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {aiResults.recommendations?.map((rec) => (
                        <div key={rec.equipmentId} className="card">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                            <div>
                              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--forest-900)' }}>
                                {rec.equipmentName}
                              </h4>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {rec.department} • Room: {rec.labRoom}
                              </p>
                            </div>
                            <span className="badge badge-fairalloc" style={{ fontSize: '0.85rem' }}>
                              {rec.matchScore}% Fit
                            </span>
                          </div>

                          <p style={{ fontSize: '0.85rem', color: 'var(--forest-800)', background: '#F1F7F4', padding: '0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                            <strong>Grounded Rationale:</strong> {rec.groundedRationale}
                          </p>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Safety: {rec.safetyPrerequisites?.join(', ') || 'Standard'}
                            </span>
                            <button
                              onClick={() => {
                                const matchedEq = equipmentList.find(e => e.id === rec.equipmentId);
                                if (matchedEq) openBookingModal(matchedEq);
                              }}
                              className="btn btn-primary"
                              style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
                            >
                              Reserve This Machine <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Unavailable Equipment (e.g. Under Maintenance) */}
                    {aiResults.unavailableEquipment && aiResults.unavailableEquipment.length > 0 && (
                      <div style={{ marginTop: '1.25rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <AlertTriangle size={14} style={{ color: '#D97706' }} /> Matching Equipment Currently Ineligible for Booking
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {aiResults.unavailableEquipment.map((unav) => (
                            <div key={unav.equipmentId} className="card" style={{ opacity: 0.85, border: '1px dashed var(--border-color)', background: '#F9FAFB' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <h5 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{unav.equipmentName}</h5>
                                <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Under Maintenance</span>
                              </div>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{unav.groundedRationale}</p>
                              <button className="btn btn-outline" disabled style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', cursor: 'not-allowed' }}>
                                FAIRALLOC Lockout Active
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BOOKINGS & FAIRALLOC TRANSPARENCY */}
        {activeTab === 'bookings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)' }}>
                  Active Reservations & FAIRALLOC Priority Logs
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Transparent, explainable multi-factor scoring balancing deadline urgency, academic tier, and historical resource equity.
                </p>
              </div>
              <button onClick={fetchData} className="btn btn-outline">
                <RefreshCw size={16} /> Refresh
              </button>
            </div>

            {bookingsList.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <Calendar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem' }} />
                <p style={{ fontWeight: 600 }}>No bookings recorded yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Submit a booking request from the Catalogue or AI Matcher tab.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {bookingsList.map((booking) => {
                  const eq = equipmentList.find(e => e.id === booking.equipmentId);
                  const isConfirmed = booking.status === 'confirmed';
                  const isRejected = booking.status === 'rejected';
                  const isPending = booking.status === 'pending_faculty';
                  const meta = booking.allocationMetadata;

                  return (
                    <div key={booking.id} className="card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                              ID: {booking.id}
                            </span>
                            <span className={`badge ${isConfirmed ? 'badge-operational' : (isRejected ? 'badge-conflict' : 'badge-maintenance')}`}>
                              {booking.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {/* Maintenance Notice Flag */}
                            {booking.affectedByMaintenance && (
                              <span className="badge badge-conflict">
                                âš ï¸ AFFECTED BY MAINTENANCE
                              </span>
                            )}
                          </div>
                          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--forest-900)' }}>
                            {eq?.name || booking.equipmentId}
                          </h3>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Purpose: <strong>{booking.purposeSummary}</strong> â€¢ Student ID: {booking.studentId}
                          </p>
                        </div>

                        {/* Timing Block */}
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--forest-800)', fontWeight: 600, fontSize: '0.9rem' }}>
                            <Clock size={16} />
                            <span>{new Date(booking.requestedStartTime).toLocaleDateString()}</span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(booking.requestedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.requestedEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Maintenance Warning Banner if equipment went down */}
                      {booking.affectedByMaintenance && (
                        <div className="alert alert-error" style={{ fontSize: '0.85rem', padding: '0.65rem 0.85rem', marginBottom: '0.75rem' }}>
                          <AlertOctagon size={16} />
                          <div>
                            <strong>Maintenance Impact Alert:</strong> {booking.maintenanceReviewNotice || 'This equipment is currently under maintenance. A lab manager is inspecting the unit.'}
                          </div>
                        </div>
                      )}

                      {/* FAIRALLOC Scoring Breakdown */}
                      {meta && (
                        <div className="fairalloc-panel" style={{ marginTop: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest-800)' }}>
                              FAIRALLOC Deterministic Allocation Utility
                            </span>
                            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--forest-900)' }}>
                              {meta.fairAllocScore} / 100
                            </span>
                          </div>

                          <div className="grid-4" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span>Urgency (35%)</span>
                                <strong>{meta.scoreBreakdown?.urgencyScore}</strong>
                              </div>
                              <div className="metric-bar">
                                <div className="metric-fill" style={{ width: `${meta.scoreBreakdown?.urgencyScore}%` }} />
                              </div>
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span>Academic Tier (25%)</span>
                                <strong>{meta.scoreBreakdown?.academicTierScore}</strong>
                              </div>
                              <div className="metric-bar">
                                <div className="metric-fill" style={{ width: `${meta.scoreBreakdown?.academicTierScore}%` }} />
                              </div>
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span>Fairness Index (25%)</span>
                                <strong>{meta.scoreBreakdown?.fairnessScore}</strong>
                              </div>
                              <div className="metric-bar">
                                <div className="metric-fill" style={{ width: `${meta.scoreBreakdown?.fairnessScore}%` }} />
                              </div>
                            </div>

                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                <span>Faculty Endorsement (15%)</span>
                                <strong>{meta.scoreBreakdown?.endorsementScore}</strong>
                              </div>
                              <div className="metric-bar">
                                <div className="metric-fill" style={{ width: `${meta.scoreBreakdown?.endorsementScore}%` }} />
                              </div>
                            </div>
                          </div>

                          <p style={{ fontSize: '0.8rem', color: 'var(--forest-700)', lineHeight: 1.4 }}>
                            {meta.explanation}
                          </p>
                        </div>
                      )}

                      {/* Faculty Endorsement Note */}
                      {booking.facultyEndorsement && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', background: '#F8FAFC', padding: '0.5rem 0.75rem', borderRadius: '4px', borderLeft: `3px solid ${isConfirmed ? '#166534' : '#991B1B'}` }}>
                          <strong>Faculty Supervisor Note:</strong> {booking.facultyEndorsement.note} (Endorsed at {new Date(booking.facultyEndorsement.endorsedAt).toLocaleTimeString()})
                        </div>
                      )}

                      {/* LABLINK CALENDAR CONNECT PANEL (Confirmed Bookings Only) */}
                      {isConfirmed && (
                        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={16} style={{ color: 'var(--teal-600)' }} />
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest-800)' }}>
                              Calendar Connect:
                            </span>
                            <span className="badge badge-fairalloc" style={{ fontSize: '0.7rem' }}>
                              Asia/Kolkata (IST)
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => handleAddToGoogleCalendar(booking)}
                              className="btn btn-outline"
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                              title="Add this confirmed reservation to Google Calendar"
                            >
                              <ExternalLink size={14} /> Add to Google Calendar
                            </button>

                            <a
                              href={`/api/bookings/${booking.id}/calendar.ics`}
                              download={`lablink-booking-${booking.id}.ics`}
                              className="btn btn-primary"
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', textDecoration: 'none' }}
                              title="Download RFC 5545 iCalendar (.ics) file"
                            >
                              <Download size={14} /> Download .ICS
                            </a>

                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="btn btn-outline"
                              style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem', color: '#B91C1C', borderColor: '#FECACA' }}
                              title="Cancel this reservation"
                            >
                              Cancel Slot
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Status Notices for Unconfirmed or Cancelled Bookings */}
                      {isPending && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#F8FAFC', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                          <Clock size={14} />
                          <span>Calendar export will unlock automatically once your faculty supervisor approves this reservation.</span>
                        </div>
                      )}

                      {isRejected && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#FEF2F2', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                          <XCircle size={14} />
                          <span>Reservation rejected by supervisor. Calendar export is disabled.</span>
                        </div>
                      )}

                      {booking.status === 'cancelled' && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#F1F5F9', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                          <XCircle size={14} />
                          <span>Reservation cancelled ({booking.cancellationReason || 'by requester'}). Removed from active campus laboratory calendar.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: GOOGLE CALENDAR SYNC & OAUTH CONNECTIONS */}
        {activeTab === 'calendar' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={24} style={{ color: 'var(--teal-600)' }} /> Google Calendar Live Synchronization
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Secure bidirectional OAuth 2.0 integration with automatic event synchronization, incremental updates, and schedule conflict defense.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {calendarStatus?.connected && (
                  <button
                    onClick={handleTriggerCalendarSync}
                    disabled={syncingCalendar}
                    className="btn btn-outline"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <RefreshCw size={14} className={syncingCalendar ? 'spin' : ''} />
                    {syncingCalendar ? 'Syncing...' : 'Sync Now'}
                  </button>
                )}
                {calendarStatus?.connected ? (
                  <button
                    onClick={handleDisconnectCalendar}
                    disabled={calendarLoading}
                    className="btn btn-outline"
                    style={{ color: '#DC2626', borderColor: '#FECACA', fontSize: '0.85rem' }}
                  >
                    Disconnect Calendar
                  </button>
                ) : (
                  <button
                    onClick={handleConnectGoogleCalendar}
                    disabled={calendarLoading}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
                  >
                    <Calendar size={16} /> Connect Google Calendar
                  </button>
                )}
              </div>
            </div>

            {/* Connection Status Overview Banner */}
            <div className="card" style={{ marginBottom: '1.5rem', borderLeft: calendarStatus?.connected ? '4px solid var(--lime-500)' : '4px solid #F59E0B' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: calendarStatus?.connected ? 'rgba(74, 222, 128, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: calendarStatus?.connected ? 'var(--forest-800)' : '#B45309'
                  }}>
                    {calendarStatus?.connected ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest-900)', marginBottom: '0.2rem' }}>
                      {calendarStatus?.connected
                        ? `Connected to Google Calendar (${calendarStatus.googleEmail})`
                        : 'Google Calendar Not Connected'}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {calendarStatus?.connected
                        ? `Two-way incremental synchronization is active. Last synced: ${calendarStatus.lastSyncedAt ? new Date(calendarStatus.lastSyncedAt).toLocaleString() : 'Never'}`
                        : 'Connect your institutional or personal Google Calendar to automatically receive approved laboratory bookings and detect conflicting personal commitments.'}
                    </p>
                  </div>
                </div>

                <span className={`badge ${calendarStatus?.connected ? 'badge-confirmed' : 'badge-warning'}`} style={{ fontSize: '0.85rem', padding: '0.35rem 0.75rem' }}>
                  {calendarStatus?.connected ? 'OAUTH ACTIVE' : 'UNCONNECTED'}
                </span>
              </div>

              {!calendarStatus?.isConfigured && !calendarStatus?.connected && (
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#FFFBEB', borderRadius: 'var(--radius-sm)', border: '1px solid #FDE68A', fontSize: '0.8rem', color: '#92400E' }}>
                  <strong>Setup Notice:</strong> <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> are not configured in the active environment.
                  Set your OAuth credentials in <code>.env</code> or Google Cloud Run Secrets to complete live OAuth consent.
                </div>
              )}
            </div>

            {/* Grid: External Calendar Conflicts & Synced Reservations */}
            <div className="grid-2" style={{ alignItems: 'start' }}>
              {/* Left Column: Conflicts & Discrepancies */}
              <div>
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <AlertTriangle size={18} style={{ color: calendarConflicts.length > 0 ? '#DC2626' : 'var(--text-muted)' }} />
                      External Scheduling Conflicts ({calendarConflicts.length})
                    </h3>
                    {calendarConflicts.length > 0 && (
                      <span className="badge badge-warning">{calendarConflicts.length} Action Needed</span>
                    )}
                  </div>

                  {calendarConflicts.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-sm)' }}>
                      <CheckCircle2 size={32} style={{ color: 'var(--teal-600)', margin: '0 auto 0.75rem' }} />
                      <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--forest-900)' }}>Zero Calendar Conflicts</p>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        All confirmed laboratory slots are completely conflict-free. No external overlapping meetings detected.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {calendarConflicts.map((conf) => (
                        <div key={conf.id} style={{
                          padding: '0.85rem',
                          borderRadius: 'var(--radius-sm)',
                          background: conf.type === 'schedule_overlap' ? '#FEF2F2' : '#FFFBEB',
                          border: `1px solid ${conf.type === 'schedule_overlap' ? '#FCA5A5' : '#FDE68A'}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                            <span style={{
                              fontWeight: 700,
                              fontSize: '0.8rem',
                              color: conf.type === 'schedule_overlap' ? '#991B1B' : '#92400E',
                              textTransform: 'uppercase'
                            }}>
                              {conf.type === 'schedule_overlap' ? 'Personal Event Overlap' : 'External Calendar Alteration'}
                            </span>
                            <button
                              onClick={() => handleResolveCalendarConflict(conf.id)}
                              className="btn btn-outline"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                            >
                              Acknowledge
                            </button>
                          </div>
                          <p style={{ fontSize: '0.82rem', color: '#1F2937', marginBottom: '0.4rem', lineHeight: 1.4 }}>
                            {conf.message}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Detected at: {new Date(conf.detectedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Conflict Defense Explainer Card */}
                <div className="card" style={{ background: '#F1F7F4', border: '1px solid var(--teal-200)' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--forest-900)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Shield size={16} /> FAIRALLOC Authority & Calendar Policy
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--forest-800)', lineHeight: 1.5 }}>
                    <li><strong>Authoritative Booking Engine:</strong> External edits to Google Calendar events never silently alter university equipment allocations.</li>
                    <li><strong>Two-Way Synchronization:</strong> Approved reservations automatically flow to Google Calendar; modifications or cancellations are synchronized in real-time.</li>
                    <li><strong>Conflict Shield:</strong> LabLink queries your personal calendar to proactively warn you of personal appointments overlapping with lab sessions.</li>
                  </ul>
                </div>
              </div>

              {/* Right Column: Synced Reservations List */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest-800)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={18} style={{ color: 'var(--teal-600)' }} />
                    Synchronized Google Calendar Events ({syncedEventsList.length})
                  </h3>
                </div>

                {syncedEventsList.length === 0 ? (
                  <div style={{ padding: '2.5rem', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-sm)' }}>
                    <Calendar size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 0.75rem' }} />
                    <p style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--forest-900)' }}>No Active Synced Reservations</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      When your laboratory requests are approved by faculty supervisors, they will appear here and sync directly into your Google Calendar.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {syncedEventsList.map((item) => (
                      <div key={item.bookingId} style={{
                        padding: '0.85rem',
                        borderRadius: 'var(--radius-sm)',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-light)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--forest-900)', marginBottom: '0.2rem' }}>
                            {item.equipmentName}
                          </h4>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                            Room: {item.labRoom} • Booking ID: {item.bookingId}
                          </p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--teal-700)', fontWeight: 600 }}>
                            {new Date(item.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span className={`badge badge-${item.status === 'synced' ? 'confirmed' : 'warning'}`} style={{ fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                            {item.status.toUpperCase()}
                          </span>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Synced: {new Date(item.syncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FACULTY SUPERVISOR PORTAL */}
        {activeTab === 'faculty' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)' }}>
                Faculty Supervisor Approval Queue
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Review, endorse, or redirect student lab access requests requiring Principal Investigator authorization.
              </p>
            </div>

            {bookingsList.filter(b => b.status === 'pending_faculty').length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <CheckCircle2 size={36} style={{ color: 'var(--status-operational)', margin: '0 auto 1rem' }} />
                <p style={{ fontWeight: 600 }}>All pending requests have been reviewed.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  New student project requests will populate here for endorsement.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {bookingsList
                  .filter(b => b.status === 'pending_faculty')
                  .map((booking) => {
                    const eq = equipmentList.find(e => e.id === booking.equipmentId);
                    const proj = projectsList.find(p => p.id === booking.projectId);

                    return (
                      <div key={booking.id} className="card" style={{ borderLeft: '4px solid #F59E0B' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <span className="badge badge-maintenance" style={{ marginBottom: '0.35rem' }}>
                              Awaiting Faculty Endorsement
                            </span>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--forest-900)' }}>
                              {eq?.name || booking.equipmentId}
                            </h3>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              Student: <strong>{booking.studentId}</strong> â€¢ Lab: {eq?.labRoom} â€¢ Requested: {new Date(booking.requestedStartTime).toLocaleString()}
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleFacultyEndorse(booking.id, true)}
                              className="btn btn-lime"
                            >
                              <CheckCircle2 size={16} /> Approve & Confirm
                            </button>
                            <button
                              onClick={() => handleFacultyEndorse(booking.id, false)}
                              className="btn btn-danger"
                            >
                              <XCircle size={16} /> Decline Request
                            </button>
                          </div>
                        </div>

                        {proj && (
                          <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--forest-800)', marginBottom: '0.25rem' }}>
                              Project Context: {proj.title} ({proj.category?.replace('_', ' ').toUpperCase()})
                            </p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              {proj.abstract}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: RESOURCE UTILIZATION ANALYTICS */}
        {activeTab === 'analytics' && (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)' }}>
                Campus Laboratory Resource Utilization
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Macro-level allocation efficiency, inter-departmental sharing index, and bottleneck equipment identification.
              </p>
            </div>

            {analyticsData && (
              <div>
                {/* Metric Summary Cards */}
                <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
                  <div className="card">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL INSTRUMENTS</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--forest-900)' }}>
                      {analyticsData.summary?.totalEquipment}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--status-operational)' }}>
                      {analyticsData.summary?.operationalCount} Operational
                    </p>
                  </div>

                  <div className="card">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONFIRMED BOOKINGS</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--forest-900)' }}>
                      {analyticsData.summary?.confirmedBookings}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {analyticsData.summary?.pendingBookings} In Review
                    </p>
                  </div>

                  <div className="card">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>CROSS-DEPT SHARING</p>
                    <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--teal-600)' }}>
                      {analyticsData.summary?.crossDeptSharingRatePercent}%
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Inter-departmental utilization
                    </p>
                  </div>

                  <div className="card">
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>FAIRNESS HEALTH</p>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--forest-800)', marginTop: '0.35rem' }}>
                      {analyticsData.summary?.fairnessAllocationHealth}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Entropy balance metric
                    </p>
                  </div>
                </div>

                {/* Equipment Utilization Table */}
                <div className="card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--forest-800)' }}>
                    Equipment Utilization & Bottleneck Ranking
                  </h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.65rem 0.5rem' }}>EQUIPMENT</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>DEPARTMENT</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>STATUS</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>CONFIRMED BOOKINGS</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>TOTAL HOURS</th>
                          <th style={{ padding: '0.65rem 0.5rem' }}>UTILIZATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsData.equipmentUtilization?.map((item) => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600 }}>{item.name}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{item.department}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>
                              <span className={`badge badge-${item.status}`}>
                                {item.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{item.confirmedBookings}</td>
                            <td style={{ padding: '0.75rem 0.5rem' }}>{item.totalBookedHours} hrs</td>
                            <td style={{ padding: '0.75rem 0.5rem', width: '160px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div className="metric-bar" style={{ flex: 1, margin: 0 }}>
                                  <div className="metric-fill" style={{ width: `${item.utilizationRatePercent}%` }} />
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{item.utilizationRatePercent}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Booking & FAIRALLOC Conflict Resolution Modal */}
      {bookingModalOpen && selectedEquipment && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 43, 34, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 100
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="card" style={{ maxWidth: '580px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <span className="badge badge-fairalloc" style={{ marginBottom: '0.25rem' }}>
                  Project-Based Slot Reservation
                </span>
                <h3 id="modal-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--forest-900)' }}>
                  {selectedEquipment.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Lab: {selectedEquipment.labRoom} â€¢ Operating Hours: {selectedEquipment.operatingHours?.open} - {selectedEquipment.operatingHours?.close} UTC
                </p>
              </div>
              <button
                onClick={() => setBookingModalOpen(false)}
                className="btn btn-outline"
                style={{ padding: '0.35rem 0.65rem' }}
                aria-label="Close modal"
              >
                âœ•
              </button>
            </div>

            {/* Ineligible Warning if current role is uncertified */}
            {currentRole === 'ineligible_student' && (
              <div className="alert alert-error" style={{ fontSize: '0.8rem', padding: '0.65rem 0.85rem' }}>
                <AlertTriangle size={16} />
                <span>
                  <strong>Safety Alert:</strong> Selected student persona (Karan) lacks certifications for this equipment ({selectedEquipment.safetyPrerequisites.join(', ')}).
                </span>
              </div>
            )}

            {/* Conflict / Resolution Box */}
            {conflictResponse && (
              <div className="alert alert-error" style={{ display: 'block', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <XCircle size={18} />
                  <strong>Scheduling Conflict Detected:</strong> {conflictResponse.error}
                </div>

                {/* Conflicts list */}
                {conflictResponse.conflicts && (
                  <ul style={{ fontSize: '0.8rem', paddingLeft: '1.5rem', marginBottom: '0.75rem' }}>
                    {conflictResponse.conflicts.map((c, i) => (
                      <li key={i}>{c.reason} ({new Date(c.startTime).toLocaleTimeString()} - {new Date(c.endTime).toLocaleTimeString()})</li>
                    ))}
                  </ul>
                )}

                {/* Feasible Alternatives Recommendation */}
                {conflictResponse.feasibleAlternatives && conflictResponse.feasibleAlternatives.length > 0 ? (
                  <div style={{ background: '#FFFFFF', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid #FECACA' }}>
                    <p style={{ fontWeight: 700, color: 'var(--forest-800)', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                      FAIRALLOC Verified Feasible Alternative Slots:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {conflictResponse.feasibleAlternatives.map((alt, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', background: '#F8FAFC', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                          <span>
                            {new Date(alt.startTime).toLocaleDateString()} â€¢ {new Date(alt.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({alt.type === 'same_equipment' ? 'Same Instrument' : alt.equipmentName})
                          </span>
                          <button
                            type="button"
                            onClick={() => adoptAlternativeSlot(alt)}
                            className="btn btn-lime"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            Adopt Slot
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: '#991B1B', marginTop: '0.5rem' }}>
                    No alternative slots are feasible within the 7-day horizon.
                  </p>
                )}
              </div>
            )}

            <form onSubmit={handleBookingSubmit}>
              <div className="form-group">
                <label className="form-label">Linked Project</label>
                <select
                  className="form-select"
                  value={bookingProjectId}
                  onChange={(e) => setBookingProjectId(e.target.value)}
                >
                  {projectsList.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({p.category?.replace('_', ' ').toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={bookingStartTime}
                    onChange={(e) => setBookingStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Time</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={bookingEndTime}
                    onChange={(e) => setBookingEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Purpose / Session Summary</label>
                <input
                  type="text"
                  className="form-input"
                  value={bookingPurpose}
                  onChange={(e) => setBookingPurpose(e.target.value)}
                  placeholder="e.g. High-frequency transient characterization"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="btn btn-primary"
                >
                  {bookingSubmitting ? 'Evaluating Allocation...' : 'Submit Booking Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
