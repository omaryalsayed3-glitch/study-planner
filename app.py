from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta

app = Flask(__name__)

# Sample data for demonstration
study_sessions = [
    {"id": 1, "time": "09:00 AM", "subject": "Calculus II", "duration": "2 hours", "color": "blue"},
    {"id": 2, "time": "11:00 AM", "subject": "Linear Algebra", "duration": "1 hour 30 min", "color": "cyan"},
    {"id": 3, "time": "02:00 PM", "subject": "Physics I Lab", "duration": "2 hours 15 min", "color": "blue"},
    {"id": 4, "time": "04:30 PM", "subject": "Chemistry Basics", "duration": "1 hour", "color": "blue"},
    {"id": 5, "time": "06:00 PM", "subject": "Literature Analysis", "duration": "1 hour", "color": "blue"},
]

upcoming_tasks = [
    {"id": 1, "title": "Complete Calculus II homework", "due": "Due: Today", "completed": False},
    {"id": 2, "title": "Read Chapter 5 of 'Physics I'", "due": "Due: Tomorrow", "completed": False},
    {"id": 3, "title": "Prepare for Linear Algebra quiz", "due": "Due: Oct 28", "completed": False},
    {"id": 4, "title": "Review Chemistry Lab Report", "due": "Due: Oct 29", "completed": True},
    {"id": 5, "title": "Outline Literature Essay", "due": "Due: Oct 30", "completed": False},
]

# Focus session tracking
focus_sessions = []
current_focus_session = None

ai_recommendations = [
    "Consider reviewing past Calculus II problems for 15 minutes before your next session.",
    "Your current study intensity for Linear Algebra is high; ensure you take short breaks.",
    "Explore additional resources on quantum mechanics for Physics I to deepen understanding.",
    "Utilize flashcards for Chemistry terms; spaced repetition is highly effective.",
    "Try active recall techniques for Literature analysis to improve retention."
]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html',
                         sessions=study_sessions,
                         tasks=upcoming_tasks,
                         recommendations=ai_recommendations,
                         current_date="October 26, 2023")

@app.route('/planner')
def planner():
    return render_template('planner.html')

@app.route('/features')
def features():
    return render_template('features.html')

@app.route('/progress')
def progress():
    return render_template('progress.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

@app.route('/api/sessions', methods=['GET', 'POST'])
def handle_sessions():
    if request.method == 'POST':
        new_session = request.json
        new_session['id'] = len(study_sessions) + 1
        study_sessions.append(new_session)
        return jsonify(new_session), 201
    return jsonify(study_sessions)

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    task = next((t for t in upcoming_tasks if t['id'] == task_id), None)
    if task:
        task['completed'] = not task['completed']
        return jsonify(task)
    return jsonify({'error': 'Task not found'}), 404

@app.route('/api/tasks', methods=['GET', 'POST'])
def handle_tasks():
    if request.method == 'POST':
        new_task = request.json
        new_task['id'] = max([t['id'] for t in upcoming_tasks]) + 1 if upcoming_tasks else 1
        new_task['completed'] = False
        upcoming_tasks.append(new_task)
        return jsonify(new_task), 201
    return jsonify(upcoming_tasks)

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    global upcoming_tasks
    upcoming_tasks = [t for t in upcoming_tasks if t['id'] != task_id]
    return jsonify({'success': True})

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    completed_tasks = sum(1 for t in upcoming_tasks if t['completed'])
    total_tasks = len(upcoming_tasks)
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

    # Calculate focus time stats
    total_minutes = sum(session['duration'] for session in focus_sessions)
    total_hours = total_minutes // 60
    total_mins = total_minutes % 60

    avg_minutes = total_minutes // len(focus_sessions) if focus_sessions else 0
    avg_hours = avg_minutes // 60
    avg_mins = avg_minutes % 60

    # Calculate streak
    longest_streak = calculate_longest_streak()

    return jsonify({
        'completedTasks': completed_tasks,
        'totalTasks': total_tasks,
        'completionRate': round(completion_rate),
        'totalFocusTime': f"{total_hours}h {total_mins}m",
        'averageSession': f"{avg_hours}h {avg_mins}m",
        'longestStreak': f"{longest_streak} days"
    })

@app.route('/api/focus/start', methods=['POST'])
def start_focus_session():
    global current_focus_session
    current_focus_session = {
        'start_time': datetime.now().isoformat(),
        'subject': request.json.get('subject', 'General Study')
    }
    return jsonify({'success': True, 'session': current_focus_session})

@app.route('/api/focus/end', methods=['POST'])
def end_focus_session():
    global current_focus_session, focus_sessions

    if not current_focus_session:
        return jsonify({'error': 'No active session'}), 400

    start_time = datetime.fromisoformat(current_focus_session['start_time'])
    end_time = datetime.now()
    duration_minutes = int((end_time - start_time).total_seconds() / 60)

    session_record = {
        'start_time': current_focus_session['start_time'],
        'end_time': end_time.isoformat(),
        'duration': duration_minutes,
        'subject': current_focus_session['subject'],
        'date': end_time.strftime('%Y-%m-%d')
    }

    focus_sessions.append(session_record)
    current_focus_session = None

    return jsonify({
        'success': True,
        'session': session_record,
        'duration_minutes': duration_minutes
    })

@app.route('/api/focus/current', methods=['GET'])
def get_current_session():
    return jsonify({
        'active': current_focus_session is not None,
        'session': current_focus_session
    })

def calculate_longest_streak():
    if not focus_sessions:
        return 0

    # Group sessions by date
    dates = set(session['date'] for session in focus_sessions)
    if not dates:
        return 0

    sorted_dates = sorted([datetime.strptime(d, '%Y-%m-%d') for d in dates])

    longest = 1
    current = 1

    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i] - sorted_dates[i-1]).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1

    return longest

if __name__ == '__main__':
    app.run(debug=True, port=5000)
