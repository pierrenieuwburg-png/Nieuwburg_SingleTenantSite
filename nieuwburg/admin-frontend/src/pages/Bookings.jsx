import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { BarLoader } from 'react-spinners';
import ScheduleBookingModal from '../components/ScheduleBookingModal'; 
import EditBookingModal from '../components/EditBookingModal'; 

function Bookings() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  
  // Modals state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null); // Track clicked date
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  const calendarRef = useRef(null);

  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/jobs/scheduled');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      const data = await response.json();
      
      const events = data.map(job => {
        let startDateTime = job.scheduled_date; 
        if (job.start_time) {
            startDateTime = `${job.scheduled_date}T${job.start_time}`; 
        }

        let color = '#3b82f6'; 
        if (job.status === 'Completed') color = '#10b981'; 
        if (job.status === 'Cancelled') color = '#ef4444'; 
        if (job.status === 'In Progress') color = '#f59e0b'; 

        return {
            id: job.id.toString(),
            title: `${job.client_name} (${job.service_name})`,
            start: startDateTime,
            backgroundColor: color,
            borderColor: color,
            extendedProps: {
                status: job.status,
                assigned_staff: job.assigned_staff
            }
        };
      });

      setJobs(events);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    setCsrfToken(token || "");
    fetchJobs();
  }, []);

  // --- 1. HANDLE DATE CLICK (New) ---
  const handleDateClick = (arg) => {
    // arg.dateStr is the clicked date in 'YYYY-MM-DD' format
    setSelectedDate(arg.dateStr);
    setShowScheduleModal(true);
  };

  // --- 2. HANDLE DRAG & DROP ---
  const handleEventDrop = async (info) => {
    const jobId = info.event.id;
    
    // FIX: Construct local date manually to avoid Timezone shifts
    const d = info.event.start;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const newDate = `${year}-${month}-${day}`; // YYYY-MM-DD

    // Extract time HH:MM
    let newTime = "09:00";
    if (info.event.start.getHours() || info.event.start.getMinutes()) {
         newTime = info.event.start.toTimeString().slice(0, 5);
    }

    if (!window.confirm(`Reschedule this job to ${newDate}?`)) {
        info.revert(); 
        return;
    }

    try {
        const jobRes = await fetch(`/api/admin/jobs/${jobId}`);
        const jobData = await jobRes.json();
        
        const payload = {
            scheduled_date: newDate,
            start_time: newTime,
            staff_id: jobData.assigned_staff_id, 
            status: jobData.status,
            notes: jobData.notes
        };

        const response = await fetch(`/api/admin/jobs/${jobId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("Failed to update job");
        
    } catch (err) {
        alert(`Error rescheduling: ${err.message}`);
        info.revert();
    }
  };

  const handleEventClick = (info) => {
    setSelectedJobId(info.event.id);
    setShowEditModal(true);
  };

  return (
    <div>
      <div className="admin-header">
        <h1>Schedule</h1>
        <div className="header-actions">
            <button className="cta" onClick={() => {
                setSelectedDate(null); // No specific date if button clicked
                setShowScheduleModal(true);
            }}>+ Add Manual Booking</button>
        </div>
      </div>

      {error && <div className="flash error">{error}</div>}

      <div className="calendar-wrapper" style={{background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}>
        {isLoading ? (
             <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
                <BarLoader color="#006ac6" />
            </div>
        ) : (
            <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,listWeek'
                }}
                events={jobs}
                editable={true} 
                droppable={true}
                eventDrop={handleEventDrop}
                eventClick={handleEventClick}
                dateClick={handleDateClick} // <--- ADDED THIS
                height="auto"
                contentHeight={800}
                eventTimeFormat={{ 
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: false
                }}
            />
        )}
      </div>

      {/* Create Booking Modal */}
      {showScheduleModal && (
        <ScheduleBookingModal 
            isOpen={showScheduleModal} 
            initialDate={selectedDate} // <--- PASS CLICKED DATE
            onClose={() => setShowScheduleModal(false)} 
            onSuccess={() => {
                setShowScheduleModal(false);
                fetchJobs(); 
            }}
        />
      )}

      {/* Edit Booking Modal */}
      {showEditModal && selectedJobId && (
        <EditBookingModal
            isOpen={showEditModal}
            jobId={selectedJobId}
            onClose={() => setShowEditModal(false)}
            onUpdate={() => {
                setShowEditModal(false);
                fetchJobs();
            }}
        />
      )}

    </div>
  );
}

export default Bookings;