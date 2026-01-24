// ============= State Management =============
let focusTimerInterval = null;
let focusStartTime = null;
let focusElapsedSeconds = 0;
let isPaused = false;

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
    const subject = document.getElementById('focusSubject').value;
    const subjectDisplay = document.getElementById('timerSubject');

    if (subjectDisplay) {
        subjectDisplay.textContent = subject;
    }

    // Disable subject selector when timer starts
    const subjectSelect = document.getElementById('focusSubject');
    if (subjectSelect) {
        subjectSelect.disabled = true;
    }

    if (!focusStartTime) {
        focusStartTime = Date.now() - (focusElapsedSeconds * 1000);

        // Notify backend
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

    // Update progress circle (one full rotation per hour)
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
        const circumference = 2 * Math.PI * 90; // radius is 90
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

    // Send to backend
    fetch('/api/focus/end', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log('Focus session ended:', data);

        // Update dashboard stats
        updateDashboardStats();

        // Show success message
        alert(`Great job! You studied for ${Math.floor(data.duration_minutes / 60)}h ${data.duration_minutes % 60}m`);

        // Reset and close
        focusStartTime = null;
        focusElapsedSeconds = 0;

        // Re-enable subject selector
        const subjectSelect = document.getElementById('focusSubject');
        if (subjectSelect) {
            subjectSelect.disabled = false;
        }

        closeFocusSessionModal();
    })
    .catch(error => {
        console.error('Error ending focus session:', error);
        alert('Error saving session. Please try again.');
    });
}

// ============= Dashboard Stats Update =============
function updateDashboardStats() {
    fetch('/api/dashboard/stats')
        .then(response => response.json())
        .then(data => {
            // Update progress circle
            updateProgressCircle(data.completionRate);

            // Update progress message
            const progressMessage = document.querySelector('.progress-message');
            if (progressMessage) {
                progressMessage.textContent = `${data.completedTasks} of ${data.totalTasks} tasks completed. Keep up the great work!`;
            }

            // Update focus time stats
            const focusStats = document.querySelectorAll('.focus-stat .stat-value');
            if (focusStats.length >= 3) {
                focusStats[0].textContent = data.totalFocusTime;
                focusStats[1].textContent = data.averageSession;
                focusStats[2].textContent = data.longestStreak;
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
        const circumference = 2 * Math.PI * 50; // radius is 50
        const offset = circumference * (1 - percentage / 100);
        progressCircle.style.strokeDashoffset = offset;
    }
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

                // Update dashboard stats after task toggle
                setTimeout(() => {
                    updateDashboardStats();
                }, 100);
            })
            .catch(error => {
                console.error('Error toggling task:', error);
                // Revert checkbox if error
                this.checked = !this.checked;
            });
        });
    });
}

// ============= Planner Session Modal =============
function openAddSessionModal() {
    const modal = document.getElementById('addSessionModal');
    if (modal) {
        modal.classList.add('active');
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
        notes: formData.get('notes')
    };

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
        location.reload();
    })
    .catch(error => {
        console.error('Error adding session:', error);
        alert('Error adding session. Please try again.');
    });
}

// ============= Modal Click Outside =============
window.addEventListener('click', function(event) {
    const addSessionModal = document.getElementById('addSessionModal');
    const focusModal = document.getElementById('focusSessionModal');

    if (event.target === addSessionModal) {
        closeAddSessionModal();
    }

    if (event.target === focusModal) {
        // Don't close focus modal by clicking outside if timer is running
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
            console.log('Settings section:', this.getAttribute('href'));
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

// ============= Utility Functions =============
function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
}

function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function calculateDuration(startTime, endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);

    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    const durationMinutes = endTotalMinutes - startTotalMinutes;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours === 0) {
        return `${minutes} min`;
    } else if (minutes === 0) {
        return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
        return `${hours} hour${hours > 1 ? 's' : ''} ${minutes} min`;
    }
}

function animateProgress(element, targetPercentage) {
    let currentPercentage = 0;
    const increment = targetPercentage / 50;

    const interval = setInterval(() => {
        currentPercentage += increment;
        if (currentPercentage >= targetPercentage) {
            currentPercentage = targetPercentage;
            clearInterval(interval);
        }

        element.textContent = Math.round(currentPercentage) + '%';
    }, 20);
}

// ============= Smooth Scroll =============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// ============= LocalStorage Management =============
function saveFocusSessionToLocal(sessionData) {
    const sessions = JSON.parse(localStorage.getItem('focusSessions') || '[]');
    sessions.push(sessionData);
    localStorage.setItem('focusSessions', JSON.stringify(sessions));
}

function loadFocusSessionsFromLocal() {
    return JSON.parse(localStorage.getItem('focusSessions') || '[]');
}

// ============= Initialization =============
document.addEventListener('DOMContentLoaded', function() {
    console.log('StudyFlow AI loaded successfully');

    // Setup event handlers
    setupTaskHandlers();
    setupSettingsNav();
    setupViewToggle();

    // Initialize progress animation
    const progressElements = document.querySelectorAll('.progress-text');
    progressElements.forEach(element => {
        const percentage = parseInt(element.textContent);
        if (!isNaN(percentage)) {
            element.textContent = '0%';
            setTimeout(() => {
                animateProgress(element, percentage);
            }, 500);
        }
    });

    // Load initial dashboard stats
    if (window.location.pathname === '/dashboard') {
        updateDashboardStats();
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

// ============= Keyboard Shortcuts =============
document.addEventListener('keydown', function(e) {
    // Escape key to close modals
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
