// ============= State Management =============
let focusTimerInterval = null;
let focusStartTime = null;
let focusElapsedSeconds = 0;
let isPaused = false;

// Current planner date (will be set from template or default to today)
let currentPlannerDate = typeof window.currentPlannerDate !== 'undefined'
    ? window.currentPlannerDate
    : new Date().toISOString().split('T')[0];

// ============= Utility Functions =============
function formatDateForDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
    const date = new Date(dateStr + 'T00:00:00');
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
}

// ============= Planner Functions =============
function loadPlannerSessions(date) {
    fetch(`/api/sessions?date=${date}`)
        .then(response => response.json())
        .then(sessions => {
            renderSessionsOnCalendar(sessions);
        })
        .catch(error => console.error('Error loading sessions:', error));
}

function renderSessionsOnCalendar(sessions) {
    const grid = document.getElementById('scheduleGrid');
    if (!grid) return;

    // Clear existing sessions
    grid.innerHTML = '';

    sessions.forEach(session => {
        const block = createSessionBlock(session);
        grid.appendChild(block);
    });
}

function createSessionBlock(session) {
    const block = document.createElement('div');
    block.className = `session-block ${session.color}`;
    block.dataset.sessionId = session.id;

    // Calculate position based on time
    const [startHour, startMinute] = session.startTime.split(':').map(Number);
    const [endHour, endMinute] = session.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const durationMinutes = endMinutes - startMinutes;

    // Each hour is 60px in height
    const top = startMinutes; // 1 minute = 1px
    const height = durationMinutes;

    block.style.top = `${top}px`;
    block.style.height = `${Math.max(height, 30)}px`; // Minimum height of 30px

    // Format time for display
    const formatTime = (h, m) => {
        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 || 12;
        return `${hour12}:${m.toString().padStart(2, '0')} ${period}`;
    };

    block.innerHTML = `
        <div class="session-block-title">${session.title}</div>
        <div class="session-block-time">${formatTime(startHour, startMinute)} - ${formatTime(endHour, endMinute)}</div>
    `;

    block.onclick = () => {
        // Could open edit modal here
        console.log('Session clicked:', session);
    };

    return block;
}

function changeDate(delta) {
    currentPlannerDate = addDays(currentPlannerDate, delta);
    updateDateDisplay();
    loadPlannerSessions(currentPlannerDate);
}

function goToToday() {
    currentPlannerDate = getTodayDate();
    updateDateDisplay();
    loadPlannerSessions(currentPlannerDate);
}

function updateDateDisplay() {
    const display = document.getElementById('currentDateDisplay');
    if (display) {
        display.textContent = formatDateForDisplay(currentPlannerDate);
    }

    // Also update the date input in the modal
    const dateInput = document.getElementById('sessionDate');
    if (dateInput) {
        dateInput.value = currentPlannerDate;
    }
}

// ============= Session Modal Functions =============
function openAddSessionModal() {
    const modal = document.getElementById('addSessionModal');
    if (modal) {
        modal.classList.add('active');

        // Set default date: use planner date if on planner, otherwise today
        const dateInput = document.getElementById('sessionDate');
        if (dateInput) {
            if (window.location.pathname === '/planner' && currentPlannerDate) {
                dateInput.value = currentPlannerDate;
            } else {
                dateInput.value = getTodayDate();
            }
        }

        // Set default time to next hour
        const now = new Date();
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');
        if (startTimeInput && endTimeInput) {
            const currentHour = now.getHours();
            const nextHour = (currentHour + 1) % 24;
            const hourAfter = (currentHour + 2) % 24;
            startTimeInput.value = `${String(nextHour).padStart(2, '0')}:00`;
            endTimeInput.value = `${String(hourAfter).padStart(2, '0')}:00`;
        }
    }
}

function closeAddSessionModal() {
    const modal = document.getElementById('addSessionModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function handleAddSession(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const sessionData = {
        title: formData.get('title'),
        subject: formData.get('subject'),
        date: formData.get('date'),
        startTime: formData.get('startTime'),
        endTime: formData.get('endTime'),
        priority: formData.get('priority'),
        color: formData.get('color'),
        notes: formData.get('notes') || ''
    };

    // Validate times
    if (sessionData.startTime >= sessionData.endTime) {
        alert('End time must be after start time');
        return;
    }

    fetch('/api/sessions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData)
    })
    .then(response => response.json())
    .then(data => {
        console.log('Session added:', data);
        closeAddSessionModal();

        // If we're on the planner page, reload sessions
        if (document.getElementById('scheduleGrid')) {
            loadPlannerSessions(currentPlannerDate);
        }

        // If we're on the dashboard, reload Today's Study Plan dynamically
        if (window.location.pathname === '/dashboard') {
            loadTodaysSessions();
        }

        // Clear the form
        event.target.reset();
    })
    .catch(error => {
        console.error('Error adding session:', error);
        alert('Error adding session. Please try again.');
    });
}

// Load Today's Study Plan sessions dynamically
function loadTodaysSessions() {
    fetch('/api/sessions/formatted')
        .then(response => response.json())
        .then(sessions => {
            const sessionsContainer = document.querySelector('.study-sessions');
            if (!sessionsContainer) return;

            if (sessions.length === 0) {
                sessionsContainer.innerHTML = '<p style="color: var(--text-gray); text-align: center;">No sessions scheduled for today.</p>';
                return;
            }

            sessionsContainer.innerHTML = sessions.map(session => {
                const colorMap = {
                    'blue': '#3B82F6',
                    'cyan': '#06B6D4',
                    'green': '#10B981',
                    'yellow': '#F59E0B',
                    'red': '#EF4444'
                };
                const dotColor = colorMap[session.color] || '#3B82F6';

                return `
                    <div class="session-item">
                        <div class="session-time">
                            <span class="time-dot" style="background-color: ${dotColor};"></span>
                            <span class="time-text">${session.time}</span>
                        </div>
                        <div class="session-details">
                            <span class="session-subject">${session.subject}</span>
                            <span class="session-duration">${session.duration}</span>
                        </div>
                    </div>
                `;
            }).join('');
        })
        .catch(error => console.error('Error loading sessions:', error));
}

// ============= Focus Session Modal =============
function openFocusSessionModal() {
    const modal = document.getElementById('focusSessionModal');
    if (modal) {
        modal.classList.add('active');
        resetFocusTimer();
    }
}

function closeFocusSessionModal() {
    const modal = document.getElementById('focusSessionModal');
    if (modal) {
        if (focusTimerInterval) {
            if (confirm('You have an active session. Do you want to end it?')) {
                endFocusSession();
            } else {
                return;
            }
        }
        modal.classList.remove('active');
    }
}

function resetFocusTimer() {
    focusElapsedSeconds = 0;
    isPaused = false;
    updateTimerDisplay();
    updateTimerProgress(0);

    const startPauseBtn = document.getElementById('startPauseBtn');
    const endSessionBtn = document.getElementById('endSessionBtn');

    if (startPauseBtn) {
        startPauseBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
                <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" stroke-width="2" fill="currentColor"/>
            </svg>
            Start
        `;
    }

    if (endSessionBtn) {
        endSessionBtn.style.display = 'none';
    }
}

function toggleFocusTimer() {
    if (!focusTimerInterval) {
        startFocusTimer();
    } else {
        pauseFocusTimer();
    }
}

function startFocusTimer() {
    const subject = document.getElementById('focusSubject')?.value || 'General Study';
    const subjectDisplay = document.getElementById('timerSubject');

    if (subjectDisplay) {
        subjectDisplay.textContent = subject;
    }

    const subjectSelect = document.getElementById('focusSubject');
    if (subjectSelect) {
        subjectSelect.disabled = true;
    }

    if (!focusStartTime) {
        focusStartTime = Date.now() - (focusElapsedSeconds * 1000);

        fetch('/api/focus/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ subject: subject })
        }).catch(error => console.error('Error starting focus session:', error));
    }

    focusTimerInterval = setInterval(updateFocusTimer, 1000);
    isPaused = false;

    const startPauseBtn = document.getElementById('startPauseBtn');
    const endSessionBtn = document.getElementById('endSessionBtn');

    if (startPauseBtn) {
        startPauseBtn.innerHTML = `
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
                <rect x="6" y="4" width="4" height="16" stroke="currentColor" stroke-width="2" fill="currentColor"/>
                <rect x="14" y="4" width="4" height="16" stroke="currentColor" stroke-width="2" fill="currentColor"/>
            </svg>
            Pause
        `;
    }

    if (endSessionBtn) {
        endSessionBtn.style.display = 'inline-flex';
    }
}

function pauseFocusTimer() {
    if (focusTimerInterval) {
        clearInterval(focusTimerInterval);
        focusTimerInterval = null;
        isPaused = true;

        const startPauseBtn = document.getElementById('startPauseBtn');
        if (startPauseBtn) {
            startPauseBtn.innerHTML = `
                <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
                    <polygon points="5 3 19 12 5 21 5 3" stroke="currentColor" stroke-width="2" fill="currentColor"/>
                </svg>
                Resume
            `;
        }
    }
}

function updateFocusTimer() {
    focusElapsedSeconds = Math.floor((Date.now() - focusStartTime) / 1000);
    updateTimerDisplay();

    const progressPercentage = (focusElapsedSeconds % 3600) / 3600;
    updateTimerProgress(progressPercentage);
}

function updateTimerDisplay() {
    const hours = Math.floor(focusElapsedSeconds / 3600);
    const minutes = Math.floor((focusElapsedSeconds % 3600) / 60);
    const seconds = focusElapsedSeconds % 60;

    const display = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const timerDisplay = document.getElementById('timerDisplay');
    if (timerDisplay) {
        timerDisplay.textContent = display;
    }
}

function updateTimerProgress(percentage) {
    const circle = document.getElementById('timerProgress');
    if (circle) {
        const circumference = 2 * Math.PI * 90;
        const offset = circumference * (1 - percentage);
        circle.style.strokeDashoffset = offset;
    }
}

function endFocusSession() {
    if (!focusStartTime) {
        return;
    }

    if (focusTimerInterval) {
        clearInterval(focusTimerInterval);
        focusTimerInterval = null;
    }

    fetch('/api/focus/end', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Focus session ended:', data);
        updateDashboardStats();

        const mins = data.duration_minutes;
        const hours = Math.floor(mins / 60);
        const minutes = mins % 60;
        alert(`Great job! You studied for ${hours > 0 ? hours + 'h ' : ''}${minutes}m`);

        focusStartTime = null;
        focusElapsedSeconds = 0;

        const subjectSelect = document.getElementById('focusSubject');
        if (subjectSelect) {
            subjectSelect.disabled = false;
        }

        const modal = document.getElementById('focusSessionModal');
        if (modal) {
            modal.classList.remove('active');
        }
    })
    .catch(error => {
        console.error('Error ending focus session:', error);
        alert('Error saving session. Please try again.');
    });
}

// ============= Dashboard Stats =============
function updateDashboardStats() {
    fetch('/api/dashboard/stats')
        .then(response => response.json())
        .then(data => {
            updateProgressCircle(data.completionRate);

            const progressMessage = document.querySelector('.progress-message');
            if (progressMessage) {
                progressMessage.textContent = `${data.completedTasks} of ${data.totalTasks} tasks completed. Keep up the great work!`;
            }

            const focusStats = document.querySelectorAll('.focus-stat .stat-value');
            if (focusStats.length >= 4) {
                focusStats[0].textContent = data.totalFocusTime;
                focusStats[1].textContent = data.averageSession;
                focusStats[2].textContent = data.longestStreak;
                focusStats[3].textContent = data.missedSessions;
            } else if (focusStats.length >= 3) {
                focusStats[0].textContent = data.totalFocusTime;
                focusStats[1].textContent = data.averageSession;
                focusStats[2].textContent = data.longestStreak;
            }

            // Update missed sessions stat if it exists
            const missedStat = document.querySelector('.stat-missed');
            if (missedStat) {
                missedStat.textContent = data.missedSessions;
            }
        })
        .catch(error => console.error('Error updating stats:', error));
}

function updateProgressCircle(percentage) {
    const progressText = document.querySelector('.progress-text');
    const progressCircle = document.querySelector('.progress-circle svg circle:nth-child(2)');

    if (progressText) {
        animateProgress(progressText, percentage);
    }

    if (progressCircle) {
        const circumference = 2 * Math.PI * 50;
        const offset = circumference * (1 - percentage / 100);
        progressCircle.style.strokeDashoffset = offset;
    }
}

function animateProgress(element, targetPercentage) {
    // Get current percentage from element (don't start from 0)
    const currentText = element.textContent.replace('%', '');
    let currentPercentage = parseInt(currentText) || 0;

    // If we're already at target, just set it
    if (currentPercentage === targetPercentage) {
        element.textContent = targetPercentage + '%';
        return;
    }

    const diff = targetPercentage - currentPercentage;
    const increment = diff / 30; // Animate over 30 frames

    const interval = setInterval(() => {
        currentPercentage += increment;

        if ((increment > 0 && currentPercentage >= targetPercentage) ||
            (increment < 0 && currentPercentage <= targetPercentage)) {
            currentPercentage = targetPercentage;
            clearInterval(interval);
        }

        element.textContent = Math.round(currentPercentage) + '%';
    }, 20);
}

// ============= Task Management =============
function setupTaskHandlers() {
    const taskCheckboxes = document.querySelectorAll('.task-checkbox');

    taskCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const taskId = this.id.replace('task-', '');

            fetch(`/api/tasks/${taskId}/toggle`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            })
            .then(response => response.json())
            .then(data => {
                console.log('Task toggled:', data);
                setTimeout(() => {
                    updateDashboardStats();
                }, 100);
            })
            .catch(error => {
                console.error('Error toggling task:', error);
                this.checked = !this.checked;
            });
        });
    });
}

// ============= Progress Page =============
function loadProgressData() {
    fetch('/api/progress/stats')
        .then(response => response.json())
        .then(data => {
            // Update stat cards
            document.getElementById('statTasksCompleted').textContent = data.totalTasksCompleted;
            document.getElementById('statStudyHours').textContent = `${data.totalStudyHours}h`;
            document.getElementById('statSubjects').textContent = data.subjectsStudied;
            document.getElementById('statStreak').textContent = `${data.currentStreak} Days`;

            // Render charts
            renderTaskCompletionChart(data.monthlyData);
            renderWeeklyStudyChart(data.weeklyData);
            renderSubjectProgressChart(data.subjectBreakdown);
            renderFocusSummary(data);
            renderMilestones(data);
        })
        .catch(error => console.error('Error loading progress data:', error));
}

function renderTaskCompletionChart(monthlyData) {
    const container = document.getElementById('taskCompletionChart');
    if (!container) return;

    const maxValue = Math.max(...monthlyData.map(d => d.total));

    let html = '<div class="simple-bar-chart">';
    monthlyData.forEach(item => {
        const completedHeight = (item.completed / maxValue) * 150;
        const totalHeight = (item.total / maxValue) * 150;

        html += `
            <div class="bar-item">
                <div class="bar-group" style="position: relative; height: 160px; display: flex; align-items: flex-end; justify-content: center; gap: 4px;">
                    <div class="bar-fill" style="height: ${totalHeight}px; background-color: #EF4444; width: 20px; border-radius: 4px 4px 0 0;"></div>
                    <div class="bar-fill" style="height: ${completedHeight}px; background-color: #10B981; width: 20px; border-radius: 4px 4px 0 0;"></div>
                </div>
                <span class="bar-label">${item.month}</span>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

function renderWeeklyStudyChart(weeklyData) {
    const container = document.getElementById('weeklyStudyChart');
    if (!container) return;

    const maxMinutes = Math.max(...weeklyData.map(d => d.minutes), 60);

    let html = '<div class="line-chart">';
    weeklyData.forEach(item => {
        const height = (item.minutes / maxMinutes) * 150;

        html += `
            <div class="line-point">
                <div class="point-bar" style="height: ${Math.max(height, 4)}px;"></div>
                <span class="point-label">${item.dayName}</span>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

function renderSubjectProgressChart(subjectBreakdown) {
    const container = document.getElementById('subjectProgressChart');
    const legendContainer = document.getElementById('subjectLegend');
    if (!container) return;

    const colors = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6'];
    const subjects = Object.entries(subjectBreakdown);
    const total = subjects.reduce((sum, [_, mins]) => sum + mins, 0);

    if (total === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-gray);">No study data yet</p>';
        return;
    }

    // Create donut chart
    let html = '<div class="donut-chart-container"><svg viewBox="0 0 200 200">';
    html += '<circle cx="100" cy="100" r="70" fill="none" stroke="#E5E7EB" stroke-width="25"/>';

    const circumference = 2 * Math.PI * 70;
    let offset = 0;

    subjects.forEach(([subject, minutes], index) => {
        const percentage = minutes / total;
        const dashLength = circumference * percentage;
        const color = colors[index % colors.length];

        html += `<circle cx="100" cy="100" r="70" fill="none" stroke="${color}" stroke-width="25"
                  stroke-dasharray="${dashLength} ${circumference}"
                  stroke-dashoffset="${-offset}"
                  transform="rotate(-90 100 100)"/>`;

        offset += dashLength;
    });

    html += '</svg></div>';
    container.innerHTML = html;

    // Render legend
    if (legendContainer) {
        legendContainer.innerHTML = subjects.map(([subject, minutes], index) => `
            <div class="legend-item">
                <span class="legend-dot" style="background-color: ${colors[index % colors.length]};"></span>
                <span>${subject} (${Math.round(minutes)}min)</span>
            </div>
        `).join('');
    }
}

function renderFocusSummary(data) {
    const container = document.getElementById('focusSummary');
    if (!container) return;

    container.innerHTML = `
        <div class="focus-summary-item">
            <div class="focus-summary-value">${data.totalStudyHours}h</div>
            <div class="focus-summary-label">Total Study Hours</div>
        </div>
        <div class="focus-summary-item">
            <div class="focus-summary-value">${data.totalStudyMinutes}</div>
            <div class="focus-summary-label">Total Minutes</div>
        </div>
        <div class="focus-summary-item">
            <div class="focus-summary-value">${data.subjectsStudied}</div>
            <div class="focus-summary-label">Subjects Studied</div>
        </div>
        <div class="focus-summary-item">
            <div class="focus-summary-value">${data.currentStreak}</div>
            <div class="focus-summary-label">Day Streak</div>
        </div>
    `;
}

function renderMilestones(data) {
    const container = document.getElementById('milestonesGrid');
    if (!container) return;

    const milestones = [
        {
            title: 'First Tasks Completed',
            date: 'Achievement Unlocked',
            description: `You've completed ${data.totalTasksCompleted} tasks!`,
            achieved: data.totalTasksCompleted > 0,
            icon: 'check'
        },
        {
            title: 'Study Streak Started',
            date: 'Keep it going!',
            description: `Current streak: ${data.currentStreak} days`,
            achieved: data.currentStreak > 0,
            icon: 'lightning'
        },
        {
            title: 'Multi-Subject Learner',
            date: 'Diverse Learning',
            description: `Studied ${data.subjectsStudied} different subjects`,
            achieved: data.subjectsStudied >= 2,
            icon: 'book'
        },
        {
            title: 'Dedicated Learner',
            date: 'Time Investment',
            description: `${data.totalStudyHours} hours of focused study`,
            achieved: data.totalStudyHours >= 1,
            icon: 'clock'
        }
    ];

    container.innerHTML = milestones.map(milestone => `
        <div class="milestone-card">
            <svg class="milestone-icon" viewBox="0 0 24 24" fill="none">
                ${milestone.icon === 'check' ? '<path d="M9 12l2 2 4-4" stroke="' + (milestone.achieved ? '#10B981' : '#9CA3AF') + '" stroke-width="2"/><circle cx="12" cy="12" r="10" stroke="' + (milestone.achieved ? '#10B981' : '#9CA3AF') + '" stroke-width="2"/>' : ''}
                ${milestone.icon === 'lightning' ? '<path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="' + (milestone.achieved ? '#10B981' : '#9CA3AF') + '" stroke-width="2" stroke-linejoin="round"/>' : ''}
                ${milestone.icon === 'book' ? '<path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="' + (milestone.achieved ? '#10B981' : '#9CA3AF') + '" stroke-width="2"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="' + (milestone.achieved ? '#10B981' : '#9CA3AF') + '" stroke-width="2"/>' : ''}
                ${milestone.icon === 'clock' ? '<circle cx="12" cy="12" r="10" stroke="' + (milestone.achieved ? '#10B981' : '#9CA3AF') + '" stroke-width="2"/><path d="M12 6v6l4 2" stroke="' + (milestone.achieved ? '#10B981' : '#9CA3AF') + '" stroke-width="2"/>' : ''}
            </svg>
            <div class="milestone-content">
                <h4 class="milestone-title">${milestone.title}</h4>
                <p class="milestone-date">${milestone.date}</p>
                <p class="milestone-description">${milestone.description}</p>
            </div>
        </div>
    `).join('');
}

function applyDateFilter() {
    // For now, just reload the data
    loadProgressData();
}

// ============= Modal Click Outside =============
window.addEventListener('click', function(event) {
    const addSessionModal = document.getElementById('addSessionModal');
    const focusModal = document.getElementById('focusSessionModal');

    if (event.target === addSessionModal) {
        closeAddSessionModal();
    }

    if (event.target === focusModal) {
        if (!focusTimerInterval || confirm('You have an active session. Do you want to end it?')) {
            if (focusTimerInterval) {
                endFocusSession();
            } else {
                closeFocusSessionModal();
            }
        }
    }
});

// ============= Settings Navigation =============
function setupSettingsNav() {
    const settingsNavItems = document.querySelectorAll('.settings-nav-item');

    settingsNavItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            settingsNavItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// ============= View Toggle =============
function setupViewToggle() {
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            toggleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

// ============= Keyboard Shortcuts =============
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const focusModal = document.getElementById('focusSessionModal');
        const addSessionModal = document.getElementById('addSessionModal');

        if (focusModal && focusModal.classList.contains('active')) {
            closeFocusSessionModal();
        }

        if (addSessionModal && addSessionModal.classList.contains('active')) {
            closeAddSessionModal();
        }
    }
});

// ============= Initialization =============
document.addEventListener('DOMContentLoaded', function() {
    console.log('StudyFlow AI loaded successfully');

    // Setup event handlers
    setupTaskHandlers();
    setupSettingsNav();
    setupViewToggle();

    // Initialize based on current page
    const path = window.location.pathname;

    if (path === '/dashboard') {
        updateDashboardStats();
    }

    if (path === '/planner') {
        // Initialize planner
        updateDateDisplay();
        loadPlannerSessions(currentPlannerDate);

        // Set up date filter for progress page inputs
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (startDateInput && endDateInput) {
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);

            startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
            endDateInput.value = today.toISOString().split('T')[0];
        }
    }

    if (path === '/progress') {
        // Set default date range
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        if (startDateInput && endDateInput) {
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);

            startDateInput.value = thirtyDaysAgo.toISOString().split('T')[0];
            endDateInput.value = today.toISOString().split('T')[0];
        }

        loadProgressData();
    }

    // Initialize progress - don't reset to 0, just update from API
    if (path === '/dashboard') {
        // The updateDashboardStats call above will handle the animation
    }

    // Check for active focus session on page load
    fetch('/api/focus/current')
        .then(response => response.json())
        .then(data => {
            if (data.active) {
                console.log('Active focus session detected');
            }
        })
        .catch(error => console.error('Error checking focus session:', error));
});
