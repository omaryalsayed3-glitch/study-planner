// Modal Functions
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

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('addSessionModal');
    if (event.target === modal) {
        closeAddSessionModal();
    }
});

// Handle Add Session Form
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

    // Send to backend
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
        // Optionally reload or update the UI
        location.reload();
    })
    .catch(error => {
        console.error('Error adding session:', error);
        alert('Error adding session. Please try again.');
    });
}

// Task Toggle
document.addEventListener('DOMContentLoaded', function() {
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
            })
            .catch(error => {
                console.error('Error toggling task:', error);
            });
        });
    });

    // Settings Navigation
    const settingsNavItems = document.querySelectorAll('.settings-nav-item');

    settingsNavItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();

            // Remove active class from all items
            settingsNavItems.forEach(nav => nav.classList.remove('active'));

            // Add active class to clicked item
            this.classList.add('active');

            // In a real application, you would load the corresponding settings content here
            console.log('Settings section:', this.getAttribute('href'));
        });
    });

    // View Toggle for Planner
    const toggleBtns = document.querySelectorAll('.toggle-btn');

    toggleBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            toggleBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
});

// Form Validation
function validateSessionForm(formData) {
    const startTime = formData.get('startTime');
    const endTime = formData.get('endTime');

    if (startTime >= endTime) {
        alert('End time must be after start time');
        return false;
    }

    return true;
}

// Date Formatting
function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('en-US', options);
}

// Time Formatting
function formatTime(time) {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Calculate Duration
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

// Progress Animation
function animateProgress(element, targetPercentage) {
    let currentPercentage = 0;
    const increment = targetPercentage / 100;

    const interval = setInterval(() => {
        currentPercentage += increment;
        if (currentPercentage >= targetPercentage) {
            currentPercentage = targetPercentage;
            clearInterval(interval);
        }

        element.textContent = Math.round(currentPercentage) + '%';
    }, 10);
}

// Smooth Scroll
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

// Initialize tooltips and other UI enhancements
document.addEventListener('DOMContentLoaded', function() {
    console.log('StudyFlow AI loaded successfully');

    // Add any initialization code here
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
});
