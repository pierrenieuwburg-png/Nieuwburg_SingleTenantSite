import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { BarLoader } from 'react-spinners';
import ScheduleBookingModal from '../components/ScheduleBookingModal';
import EditBookingModal from '../components/EditBookingModal';

const Bookings = () => {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [csrfToken, setCsrfToken] = useState('');
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState(null);

    const calendarRef = useRef(null);

    const fetchJobs = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/jobs/scheduled');
            if (!response.ok) throw new Error('Failed to fetch jobs');
            const data = await response.json();
            
            const formattedEvents = data.map(job => {
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
            setEvents(formattedEvents);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        setCsrfToken(token || '');
        fetchJobs();
    }, []);

    // Handlers
    const handleDateClick = (arg) => {
        setSelectedDate(arg.dateStr);
        setIsAddModalOpen(true);
    };

    const handleEventClick = (info) => {
        setSelectedJobId(info.event.id);
        setIsEditModalOpen(true);
    };

    const handleEventDrop = async (info) => {
        const jobId = info.event.id;
        const newStart = info.event.start;
        const year = newStart.getFullYear();
        const month = String(newStart.getMonth() + 1).padStart(2, '0');
        const day = String(newStart.getDate()).padStart(2, '0');
        const newDate = `${year}-${month}-${day}`;
        
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
            const currentJob = await jobRes.json();
            
            const updateData = {
                scheduled_date: newDate,
                start_time: newTime,
                staff_id: currentJob.assigned_staff_id,
                status: currentJob.status,
                notes: currentJob.notes
            };

            const updateRes = await fetch(`/api/admin/jobs/${jobId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(updateData)
            });

            if (!updateRes.ok) throw new Error('Failed to update job');
        } catch (err) {
            alert(`Error rescheduling: ${err.message}`);
            info.revert();
        }
    };

    return (
        <div>
            <div className="admin-header">
                <h1>Schedule</h1>
                <div className="header-actions">
                    <button className="cta" onClick={() => { setSelectedDate(null); setIsAddModalOpen(true); }}>
                        + Add Manual Booking
                    </button>
                </div>
            </div>

            {error && <div className="flash error">{error}</div>}

            <div className="calendar-wrapper" style={{ background: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                {loading ? (
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
                        events={events}
                        editable={true}
                        droppable={true}
                        eventDrop={handleEventDrop}
                        eventClick={handleEventClick}
                        dateClick={handleDateClick}
                        height="auto"
                        contentHeight={800}
                        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false }}
                    />
                )}
            </div>

            {/* Modals */}
            <ScheduleBookingModal 
                isOpen={isAddModalOpen} 
                initialDate={selectedDate}
                onClose={() => setIsAddModalOpen(false)}
                onSuccess={() => { setIsAddModalOpen(false); fetchJobs(); }}
            />

            <EditBookingModal 
                isOpen={isEditModalOpen}
                jobId={selectedJobId}
                onClose={() => setIsEditModalOpen(false)}
                onUpdate={() => { setIsEditModalOpen(false); fetchJobs(); }}
            />
        </div>
    );
};

export default Bookings;