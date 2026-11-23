import React, { useState, useEffect } from 'react';
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
  Flame,
  Radio
} from 'lucide-react';

export default function App() {
  // Navigation & Role State
  const [activeTab, setActiveTab] = useState('catalogue'); // catalogue | ai | bookings | faculty | analytics
  const [currentRole, setCurrentRole] = useState('student'); // student | faculty | admin
  const [currentStudentId, setCurrentStudentId] = useState('std_1');

  // Data State
  const [equipmentList, setEquipmentList] = useState([]);
  const [bookingsList, setBookingsList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // AI Matcher State
  const [aiTitle, setAiTitle] = useState('Characterization of High-Frequency GaN Half-Bridge Inverter');
  const [aiDesc, setAiDesc] = useState('Characterization of fast switching transients and ringing in Gallium Nitride half-bridge modules at 500 kHz. Requires 1 GHz real-time bandwidth and high voltage differential probes.');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState(null);

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [bookingStartTime, setBookingStartTime] = useState('2026-11-25T14:00');
  const [bookingEndTime, setBookingEndTime] = useState('2026-11-25T16:00');
  const [bookingProjectId, setBookingProjectId] = useState('proj_1');
  const [bookingPurpose, setBookingPurpose] = useState('');
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [conflictResponse, setConflictResponse] = useState(null);

  // Load Data
  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const [eqRes, bookRes, projRes] = await Promise.all([
        fetch('/api/equipment'),
        fetch('/api/bookings'),
        fetch('/api/projects')
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

      // Fetch analytics
      const anaRes = await fetch('/api/analytics');
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

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Equipment List
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

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'rf_microwave': return <Radio size={18} className="text-teal-600" />;
      case 'microscopy': return <Microscope size={18} className="text-teal-600" />;
      case 'compute_gpu': return <Cpu size={18} className="text-teal-600" />;
      case 'prototyping': return <Box size={18} className="text-teal-600" />;
      default: return <Layers size={18} className="text-teal-600" />;
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
              <p style={{ fontSize: '0.75rem', color: '#CBD5E1' }}>Fair & Feasible Cross-Departmental Allocation</p>
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
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--forest-800)' }}>
                GenAI Project-to-Equipment Matcher
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                State your hypothesis, test method, or deliverable needs. AI extracts hardware parameters and identifies suitable equipment grounded in actual campus inventory.
              </p>
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

                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
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
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                      onClick={() => {
                        setAiTitle('High-Resolution SEM Surface Topology for Thin Films');
                        setAiDesc('Requires field emission scanning electron microscope with EDX elemental spectrometer and ultra-high vacuum chamber up to 30 kV accelerating voltage.');
                      }}
                    >
                      Preset: Nanotech SEM
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
                    {/* Extracted Parameters Card */}
                    <div className="card" style={{ marginBottom: '1rem', borderLeft: '4px solid var(--teal-600)' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--forest-800)', marginBottom: '0.5rem' }}>
                        Extracted Hardware Requirements
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.5rem' }}>
                        {aiResults.extractedRequirements?.extractedCapabilities?.map((cap, i) => (
                          <span key={i} className="badge badge-fairalloc">{cap}</span>
                        ))}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Recommended Session Duration: ~{aiResults.extractedRequirements?.estimatedSessionHours || 2} hours.
                      </p>
                    </div>

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
                                {rec.department} â€¢ Room: {rec.labRoom}
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
                    </div>
                  );
                })}
              </div>
            )}
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
