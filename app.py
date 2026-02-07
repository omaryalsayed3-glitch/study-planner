from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta, date, time as time_type
from models import db, User, StudySession, Task, FocusSession, CurrentFocusSession
import os
from openai import OpenAI

app = Flask(__name__)

# OpenAI configuration
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Database configuration
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'study_planner.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize database
db.init_app(app)

# Helper function to get today's date string
def get_today():
    return datetime.now().strftime('%Y-%m-%d')

def get_formatted_date(date_str=None):
    if date_str:
        date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    else:
        date_obj = datetime.now()
    return date_obj.strftime('%B %d, %Y')

# AI recommendations (static for now - can be migrated to database later)
ai_recommendations = [
    "Consider reviewing past Calculus II problems for 15 minutes before your next session.",
    "Your current study intensity for Linear Algebra is high; ensure you take short breaks.",
    "Explore additional resources on quantum mechanics for Physics I to deepen understanding.",
    "Utilize flashcards for Chemistry terms; spaced repetition is highly effective.",
    "Try active recall techniques for Literature analysis to improve retention."
]

def format_time_12h(time_24h):
    """Convert 24h time to 12h format"""
    hour, minute = map(int, time_24h.split(':'))
    period = 'AM' if hour < 12 else 'PM'
    hour_12 = hour % 12 or 12
    return f"{hour_12}:{minute:02d} {period}"

def calculate_duration(start_time, end_time):
    """Calculate duration between two times"""
    start_h, start_m = map(int, start_time.split(':'))
    end_h, end_m = map(int, end_time.split(':'))
    total_minutes = (end_h * 60 + end_m) - (start_h * 60 + start_m)
    
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours == 0:
        return f"{minutes} min"
    elif minutes == 0:
        return f"{hours} hour{'s' if hours > 1 else ''}"
    else:
        return f"{hours} hour{'s' if hours > 1 else ''} {minutes} min"

def get_sessions_for_date(date_str):
    """Get sessions formatted for display on a specific date"""
    session_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    sessions = StudySession.query.filter_by(user_id=1, date=session_date).order_by(StudySession.start_time).all()

    formatted = []
    for s in sessions:
        formatted.append({
            'id': s.id,
            'time': format_time_12h(s.start_time.strftime('%H:%M')),
            'subject': s.title,
            'duration': calculate_duration(s.start_time.strftime('%H:%M'), s.end_time.strftime('%H:%M')),
            'color': s.color,
            'startTime': s.start_time.strftime('%H:%M'),
            'endTime': s.end_time.strftime('%H:%M')
        })
    return formatted

def format_task_due(due_date_str):
    """Format task due date relative to today"""
    due_date = datetime.strptime(due_date_str, '%Y-%m-%d').date()
    today_date = datetime.now().date()
    diff = (due_date - today_date).days

    if diff == 0:
        return "Due: Today"
    elif diff == 1:
        return "Due: Tomorrow"
    elif diff < 0:
        return f"Overdue: {abs(diff)} day{'s' if abs(diff) > 1 else ''}"
    else:
        return f"Due: {due_date.strftime('%b %d')}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    today_str = get_today()
    formatted_sessions = get_sessions_for_date(today_str)

    # Fetch tasks from database and format with relative due dates
    tasks = Task.query.filter_by(user_id=1).order_by(Task.due_date).all()
    formatted_tasks = []
    for task in tasks:
        task_dict = task.to_dict()
        formatted_tasks.append({
            **task_dict,
            'due': format_task_due(task_dict['dueDate'])
        })

    return render_template('dashboard.html',
                         sessions=formatted_sessions,
                         tasks=formatted_tasks,
                         recommendations=ai_recommendations,
                         current_date=get_formatted_date())

@app.route('/planner')
def planner():
    return render_template('planner.html',
                          current_date=get_today(),
                          formatted_date=get_formatted_date())

@app.route('/features')
def features():
    return render_template('features.html')

@app.route('/progress')
def progress():
    return render_template('progress.html')

@app.route('/settings')
def settings():
    return render_template('settings.html')

# API Endpoints

@app.route('/api/sessions', methods=['GET', 'POST'])
def handle_sessions():
    if request.method == 'POST':
        try:
            data = request.json
            # Parse date and time strings to Python objects
            session_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            start_time = datetime.strptime(data['startTime'], '%H:%M').time()
            end_time = datetime.strptime(data['endTime'], '%H:%M').time()

            new_session = StudySession(
                user_id=1,  # Default user
                title=data['title'],
                subject=data['subject'],
                date=session_date,
                start_time=start_time,
                end_time=end_time,
                color=data.get('color', 'blue'),
                priority=data.get('priority', 'medium'),
                notes=data.get('notes', '')
            )
            db.session.add(new_session)
            db.session.commit()
            return jsonify(new_session.to_dict()), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    # GET - optionally filter by date
    date_filter = request.args.get('date')
    query = StudySession.query.filter_by(user_id=1)

    if date_filter:
        filter_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
        query = query.filter_by(date=filter_date)

    sessions = query.all()
    return jsonify([s.to_dict() for s in sessions])

@app.route('/api/sessions/<int:session_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_session(session_id):
    session = StudySession.query.filter_by(id=session_id, user_id=1).first()

    if request.method == 'DELETE':
        if session:
            try:
                db.session.delete(session)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                return jsonify({'error': str(e)}), 500
        return jsonify({'success': True})

    if request.method == 'PUT':
        if not session:
            return jsonify({'error': 'Session not found'}), 404

        try:
            data = request.json
            # Update fields if provided
            if 'title' in data:
                session.title = data['title']
            if 'subject' in data:
                session.subject = data['subject']
            if 'date' in data:
                session.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
            if 'startTime' in data:
                session.start_time = datetime.strptime(data['startTime'], '%H:%M').time()
            if 'endTime' in data:
                session.end_time = datetime.strptime(data['endTime'], '%H:%M').time()
            if 'color' in data:
                session.color = data['color']
            if 'priority' in data:
                session.priority = data['priority']
            if 'notes' in data:
                session.notes = data['notes']

            session.updated_at = datetime.utcnow()
            db.session.commit()
            return jsonify(session.to_dict())
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    # GET
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    return jsonify(session.to_dict())

@app.route('/api/sessions/formatted', methods=['GET'])
def get_formatted_sessions():
    """Get sessions formatted for dashboard display"""
    date_filter = request.args.get('date', get_today())
    return jsonify(get_sessions_for_date(date_filter))

@app.route('/api/tasks', methods=['GET', 'POST'])
def handle_tasks():
    if request.method == 'POST':
        try:
            data = request.json
            due_date = datetime.strptime(data['dueDate'], '%Y-%m-%d').date()

            new_task = Task(
                user_id=1,
                title=data['title'],
                due_date=due_date,
                completed=False
            )
            db.session.add(new_task)
            db.session.commit()

            result = new_task.to_dict()
            result['due'] = format_task_due(result['dueDate'])
            return jsonify(result), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    # Return tasks with formatted due dates
    tasks = Task.query.filter_by(user_id=1).all()
    formatted = []
    for task in tasks:
        task_dict = task.to_dict()
        task_dict['due'] = format_task_due(task_dict['dueDate'])
        formatted.append(task_dict)
    return jsonify(formatted)

@app.route('/api/tasks/<int:task_id>/toggle', methods=['POST'])
def toggle_task(task_id):
    task = Task.query.filter_by(id=task_id, user_id=1).first()
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    try:
        task.completed = not task.completed
        task.updated_at = datetime.utcnow()
        db.session.commit()

        result = task.to_dict()
        result['due'] = format_task_due(result['dueDate'])
        return jsonify(result)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    task = Task.query.filter_by(id=task_id, user_id=1).first()
    if task:
        try:
            db.session.delete(task)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500
    return jsonify({'success': True})

@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    user_id = 1

    # Task stats
    tasks = Task.query.filter_by(user_id=user_id).all()
    completed_tasks = sum(1 for t in tasks if t.completed)
    total_tasks = len(tasks)
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0

    # Focus time stats
    focus_sessions_list = FocusSession.query.filter_by(user_id=user_id).all()
    total_minutes = sum(s.duration for s in focus_sessions_list)
    total_hours = total_minutes // 60
    total_mins = total_minutes % 60

    avg_minutes = total_minutes // len(focus_sessions_list) if focus_sessions_list else 0
    avg_hours = avg_minutes // 60
    avg_mins = avg_minutes % 60

    # Calculate streak
    longest_streak = calculate_longest_streak_db(user_id)

    # Calculate missed sessions
    today_date = date.today()
    current_time_obj = datetime.now().time()

    missed_sessions = 0
    todays_sessions = StudySession.query.filter_by(user_id=user_id, date=today_date).all()
    for session in todays_sessions:
        if session.start_time < current_time_obj:
            # Check if completed
            focus_completed = FocusSession.query.filter_by(
                user_id=user_id,
                date=today_date,
                subject=session.title
            ).first()
            if not focus_completed:
                missed_sessions += 1

    return jsonify({
        'completedTasks': completed_tasks,
        'totalTasks': total_tasks,
        'completionRate': round(completion_rate),
        'totalFocusTime': f"{total_hours}h {total_mins}m",
        'averageSession': f"{avg_hours}h {avg_mins}m",
        'longestStreak': f"{longest_streak} days",
        'totalFocusMinutes': total_minutes,
        'sessionCount': len(focus_sessions_list),
        'missedSessions': missed_sessions
    })

@app.route('/api/progress/stats', methods=['GET'])
def get_progress_stats():
    """Get comprehensive progress statistics"""
    user_id = 1

    # Task stats
    tasks = Task.query.filter_by(user_id=user_id).all()
    completed_tasks = sum(1 for t in tasks if t.completed)
    total_tasks = len(tasks)

    # Focus time stats
    focus_sessions_list = FocusSession.query.filter_by(user_id=user_id).all()
    total_minutes = sum(s.duration for s in focus_sessions_list)
    total_hours = total_minutes // 60

    # Subject breakdown
    subject_times = {}
    for session in focus_sessions_list:
        subject = session.subject
        subject_times[subject] = subject_times.get(subject, 0) + session.duration

    # Weekly data for charts
    today = datetime.now()
    weekly_data = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_date = day.date()
        day_sessions = FocusSession.query.filter_by(user_id=user_id, date=day_date).all()
        weekly_data.append({
            'date': day_date.strftime('%Y-%m-%d'),
            'dayName': day.strftime('%a'),
            'minutes': sum(s.duration for s in day_sessions),
            'sessions': len(day_sessions)
        })

    # Monthly task completion data (simulated for now)
    monthly_data = []
    for i in range(4, -1, -1):
        month = today - timedelta(days=i*30)
        month_name = month.strftime('%b')
        monthly_data.append({
            'month': month_name,
            'completed': 30 + (4-i) * 5,
            'total': 50 + (4-i) * 3
        })

    return jsonify({
        'totalTasksCompleted': completed_tasks,
        'totalTasks': total_tasks,
        'totalStudyHours': total_hours,
        'totalStudyMinutes': total_minutes,
        'subjectsStudied': len(subject_times),
        'currentStreak': calculate_longest_streak_db(user_id),
        'subjectBreakdown': subject_times,
        'weeklyData': weekly_data,
        'monthlyData': monthly_data
    })

@app.route('/api/focus/start', methods=['POST'])
def start_focus_session():
    try:
        # Check if there's already an active session
        existing = CurrentFocusSession.query.filter_by(user_id=1).first()
        if existing:
            db.session.delete(existing)

        current_session = CurrentFocusSession(
            user_id=1,
            subject=request.json.get('subject', 'General Study'),
            start_time=datetime.utcnow()
        )
        db.session.add(current_session)
        db.session.commit()

        return jsonify({'success': True, 'session': current_session.to_dict()})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/focus/end', methods=['POST'])
def end_focus_session():
    current = CurrentFocusSession.query.filter_by(user_id=1).first()
    if not current:
        return jsonify({'error': 'No active session'}), 400

    try:
        end_time = datetime.utcnow()
        duration_minutes = int((end_time - current.start_time).total_seconds() / 60)

        # Create completed focus session
        focus_session = FocusSession(
            user_id=1,
            subject=current.subject,
            date=end_time.date(),
            start_time=current.start_time,
            end_time=end_time,
            duration=duration_minutes
        )
        db.session.add(focus_session)

        # Remove current session
        db.session.delete(current)
        db.session.commit()

        return jsonify({
            'success': True,
            'session': focus_session.to_dict(),
            'duration_minutes': duration_minutes
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/focus/current', methods=['GET'])
def get_current_session():
    current = CurrentFocusSession.query.filter_by(user_id=1).first()
    return jsonify({
        'active': current is not None,
        'session': current.to_dict() if current else None
    })

@app.route('/api/focus/history', methods=['GET'])
def get_focus_history():
    sessions = FocusSession.query.filter_by(user_id=1).all()
    return jsonify([s.to_dict() for s in sessions])

@app.route('/api/date/current', methods=['GET'])
def get_current_date():
    """Get current date info"""
    today = datetime.now()
    return jsonify({
        'date': today.strftime('%Y-%m-%d'),
        'formatted': today.strftime('%B %d, %Y'),
        'dayName': today.strftime('%A')
    })

def get_user_context(user_id=1):
    """Gather all user data for AI context"""
    today_date = date.today()
    now = datetime.now()

    # Get upcoming tasks (next 7 days)
    upcoming_tasks = Task.query.filter_by(user_id=user_id).filter(
        Task.due_date >= today_date,
        Task.due_date <= today_date + timedelta(days=7)
    ).order_by(Task.due_date).all()

    # Get overdue tasks
    overdue_tasks = Task.query.filter_by(user_id=user_id, completed=False).filter(
        Task.due_date < today_date
    ).all()

    # Get today's study sessions
    todays_sessions = StudySession.query.filter_by(user_id=user_id, date=today_date).order_by(
        StudySession.start_time
    ).all()

    # Get upcoming sessions (next 3 days)
    upcoming_sessions = StudySession.query.filter_by(user_id=user_id).filter(
        StudySession.date > today_date,
        StudySession.date <= today_date + timedelta(days=3)
    ).order_by(StudySession.date, StudySession.start_time).all()

    # Get recent focus history (last 7 days)
    recent_focus = FocusSession.query.filter_by(user_id=user_id).filter(
        FocusSession.date >= today_date - timedelta(days=7)
    ).all()

    # Calculate study patterns
    subject_times = {}
    total_study_minutes = 0
    for session in recent_focus:
        subject_times[session.subject] = subject_times.get(session.subject, 0) + session.duration
        total_study_minutes += session.duration

    # Task completion stats
    all_tasks = Task.query.filter_by(user_id=user_id).all()
    completed_tasks = sum(1 for t in all_tasks if t.completed)
    total_tasks = len(all_tasks)

    context = {
        'current_datetime': now.strftime('%A, %B %d, %Y at %I:%M %p'),
        'upcoming_tasks': [
            {
                'title': t.title,
                'due_date': t.due_date.strftime('%A, %B %d'),
                'days_until': (t.due_date - today_date).days,
                'completed': t.completed
            } for t in upcoming_tasks
        ],
        'overdue_tasks': [
            {
                'title': t.title,
                'due_date': t.due_date.strftime('%B %d'),
                'days_overdue': (today_date - t.due_date).days
            } for t in overdue_tasks
        ],
        'todays_sessions': [
            {
                'title': s.title,
                'subject': s.subject,
                'start_time': s.start_time.strftime('%I:%M %p'),
                'end_time': s.end_time.strftime('%I:%M %p'),
                'priority': s.priority
            } for s in todays_sessions
        ],
        'upcoming_sessions': [
            {
                'title': s.title,
                'subject': s.subject,
                'date': s.date.strftime('%A, %B %d'),
                'start_time': s.start_time.strftime('%I:%M %p'),
                'end_time': s.end_time.strftime('%I:%M %p')
            } for s in upcoming_sessions
        ],
        'study_patterns': {
            'total_minutes_last_7_days': total_study_minutes,
            'total_hours_last_7_days': round(total_study_minutes / 60, 1),
            'subject_breakdown': subject_times,
            'average_daily_minutes': round(total_study_minutes / 7, 1)
        },
        'task_stats': {
            'completed': completed_tasks,
            'total': total_tasks,
            'completion_rate': round((completed_tasks / total_tasks * 100) if total_tasks > 0 else 0)
        },
        'streak': calculate_longest_streak_db(user_id)
    }

    return context

@app.route('/api/ai/recommendations', methods=['GET'])
def get_ai_recommendations():
    """Generate personalized AI recommendations using OpenAI"""
    try:
        # Get user context
        context = get_user_context(user_id=1)

        # Build the prompt
        system_prompt = """You are a helpful study assistant for a student using a study planner app.
Your job is to provide personalized, actionable study recommendations based on their current tasks,
scheduled sessions, and study patterns.

Be encouraging but practical. Focus on:
1. Time management and scheduling advice
2. Task prioritization based on due dates
3. Study technique suggestions for different subjects
4. Reminders about upcoming deadlines or sessions
5. Suggestions for balancing workload across subjects

Keep each recommendation concise (1-2 sentences). Be specific to their actual data.
Return exactly 4-5 recommendations as a JSON array of strings."""

        user_prompt = f"""Here is the student's current study data:

**Current Date/Time:** {context['current_datetime']}

**Today's Scheduled Sessions:**
{format_sessions_for_prompt(context['todays_sessions'])}

**Upcoming Tasks (Next 7 Days):**
{format_tasks_for_prompt(context['upcoming_tasks'])}

**Overdue Tasks:**
{format_overdue_for_prompt(context['overdue_tasks'])}

**Upcoming Sessions (Next 3 Days):**
{format_upcoming_sessions_for_prompt(context['upcoming_sessions'])}

**Study Patterns (Last 7 Days):**
- Total study time: {context['study_patterns']['total_hours_last_7_days']} hours
- Average daily: {context['study_patterns']['average_daily_minutes']} minutes
- Subject breakdown: {context['study_patterns']['subject_breakdown']}
- Current streak: {context['streak']} days

**Task Completion:** {context['task_stats']['completed']}/{context['task_stats']['total']} ({context['task_stats']['completion_rate']}%)

Based on this data, provide 4-5 personalized study recommendations. Return as a JSON array of strings."""

        # Call OpenAI API
        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=500
        )

        # Parse the response
        content = response.choices[0].message.content.strip()

        # Try to extract JSON from the response
        import json
        try:
            # Remove markdown code blocks if present
            if content.startswith('```'):
                content = content.split('```')[1]
                if content.startswith('json'):
                    content = content[4:]
            recommendations = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: split by newlines and clean up
            lines = [line.strip() for line in content.split('\n') if line.strip()]
            recommendations = [line.lstrip('0123456789.-) ') for line in lines if len(line) > 10][:5]

        return jsonify({
            'success': True,
            'recommendations': recommendations,
            'context_summary': {
                'tasks_due_soon': len(context['upcoming_tasks']),
                'overdue_tasks': len(context['overdue_tasks']),
                'sessions_today': len(context['todays_sessions']),
                'study_hours_this_week': context['study_patterns']['total_hours_last_7_days']
            }
        })

    except Exception as e:
        # Fallback to default recommendations on error
        return jsonify({
            'success': False,
            'error': str(e),
            'recommendations': [
                "Review your upcoming tasks and prioritize based on due dates.",
                "Consider scheduling focused study blocks for challenging subjects.",
                "Take regular breaks using the Pomodoro technique (25 min work, 5 min break).",
                "Try active recall techniques like flashcards for better retention.",
                "Make sure to get adequate sleep before exams for optimal performance."
            ]
        })

def format_sessions_for_prompt(sessions):
    if not sessions:
        return "No sessions scheduled for today."
    return "\n".join([f"- {s['title']} ({s['start_time']} - {s['end_time']}, {s['priority']} priority)" for s in sessions])

def format_tasks_for_prompt(tasks):
    if not tasks:
        return "No upcoming tasks."
    return "\n".join([f"- {t['title']} (due {t['due_date']}, {t['days_until']} days left, {'completed' if t['completed'] else 'pending'})" for t in tasks])

def format_overdue_for_prompt(tasks):
    if not tasks:
        return "No overdue tasks."
    return "\n".join([f"- {t['title']} ({t['days_overdue']} days overdue)" for t in tasks])

def format_upcoming_sessions_for_prompt(sessions):
    if not sessions:
        return "No upcoming sessions."
    return "\n".join([f"- {s['title']} on {s['date']} ({s['start_time']} - {s['end_time']})" for s in sessions])

def calculate_longest_streak_db(user_id):
    """Calculate longest streak using database queries"""
    sessions = FocusSession.query.filter_by(user_id=user_id).with_entities(
        FocusSession.date
    ).distinct().order_by(FocusSession.date).all()

    if not sessions:
        return 0

    dates = [s.date for s in sessions]
    longest = 1
    current = 1

    for i in range(1, len(dates)):
        if (dates[i] - dates[i-1]).days == 1:
            current += 1
            longest = max(longest, current)
        else:
            current = 1

    return longest

def cleanup_stale_focus_sessions():
    """Remove focus sessions older than 24 hours"""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    stale = CurrentFocusSession.query.filter(CurrentFocusSession.start_time < cutoff).all()
    for session in stale:
        db.session.delete(session)
    db.session.commit()

def load_sample_data():
    """Load initial sample data matching current in-memory data"""
    today_date = date.today()

    # Sample study sessions
    sample_sessions = [
        StudySession(
            user_id=1, title="Calculus II", subject="calculus",
            date=today_date, start_time=time_type(9, 0), end_time=time_type(11, 0),
            color="blue", priority="high", notes=""
        ),
        StudySession(
            user_id=1, title="Linear Algebra", subject="algebra",
            date=today_date, start_time=time_type(11, 0), end_time=time_type(12, 30),
            color="cyan", priority="medium", notes=""
        ),
        StudySession(
            user_id=1, title="Physics I Lab", subject="physics",
            date=today_date, start_time=time_type(14, 0), end_time=time_type(16, 15),
            color="blue", priority="high", notes=""
        ),
        StudySession(
            user_id=1, title="Chemistry Basics", subject="chemistry",
            date=today_date, start_time=time_type(16, 30), end_time=time_type(17, 30),
            color="green", priority="medium", notes=""
        ),
        StudySession(
            user_id=1, title="Literature Analysis", subject="literature",
            date=today_date, start_time=time_type(18, 0), end_time=time_type(19, 0),
            color="yellow", priority="low", notes=""
        ),
    ]

    # Sample tasks
    sample_tasks = [
        Task(user_id=1, title="Complete Calculus II homework", due_date=today_date, completed=False),
        Task(user_id=1, title="Read Chapter 5 of 'Physics I'", due_date=today_date + timedelta(days=1), completed=False),
        Task(user_id=1, title="Prepare for Linear Algebra quiz", due_date=today_date + timedelta(days=2), completed=False),
        Task(user_id=1, title="Review Chemistry Lab Report", due_date=today_date + timedelta(days=3), completed=True),
        Task(user_id=1, title="Outline Literature Essay", due_date=today_date + timedelta(days=4), completed=False),
    ]

    # Sample focus sessions (historical)
    sample_focus = [
        FocusSession(
            user_id=1, subject="Calculus II", date=today_date - timedelta(days=5),
            start_time=datetime.now() - timedelta(days=5, hours=2),
            end_time=datetime.now() - timedelta(days=5),
            duration=120
        ),
        FocusSession(
            user_id=1, subject="Physics I", date=today_date - timedelta(days=4),
            start_time=datetime.now() - timedelta(days=4, hours=1.5),
            end_time=datetime.now() - timedelta(days=4),
            duration=90
        ),
        FocusSession(
            user_id=1, subject="Chemistry", date=today_date - timedelta(days=3),
            start_time=datetime.now() - timedelta(days=3, hours=1),
            end_time=datetime.now() - timedelta(days=3),
            duration=60
        ),
        FocusSession(
            user_id=1, subject="Linear Algebra", date=today_date - timedelta(days=2),
            start_time=datetime.now() - timedelta(days=2, hours=1.25),
            end_time=datetime.now() - timedelta(days=2),
            duration=75
        ),
        FocusSession(
            user_id=1, subject="Literature", date=today_date - timedelta(days=1),
            start_time=datetime.now() - timedelta(days=1, hours=0.75),
            end_time=datetime.now() - timedelta(days=1),
            duration=45
        ),
    ]

    # Add all to database
    db.session.add_all(sample_sessions)
    db.session.add_all(sample_tasks)
    db.session.add_all(sample_focus)
    db.session.commit()

def init_db():
    """Initialize database with tables and default data"""
    with app.app_context():
        # Create all tables
        db.create_all()

        # Create default user if not exists
        user = User.query.filter_by(id=1).first()
        if not user:
            user = User(
                id=1,
                username='jane_doe',
                email='jane@studyflow.ai',
                full_name='Jane Doe'
            )
            db.session.add(user)
            db.session.commit()

        # Clean up stale focus sessions
        cleanup_stale_focus_sessions()

        # Add sample data only if tables are empty
        if StudySession.query.count() == 0:
            load_sample_data()

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)
