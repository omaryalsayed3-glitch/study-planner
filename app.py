from flask import Flask, render_template, jsonify, request
from datetime import datetime

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
