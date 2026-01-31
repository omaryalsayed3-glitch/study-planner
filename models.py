from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(255))
    full_name = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    study_sessions = db.relationship('StudySession', backref='user', lazy=True, cascade='all, delete-orphan')
    tasks = db.relationship('Task', backref='user', lazy=True, cascade='all, delete-orphan')
    focus_sessions = db.relationship('FocusSession', backref='user', lazy=True, cascade='all, delete-orphan')
    current_focus = db.relationship('CurrentFocusSession', backref='user', uselist=False, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name
        }


class StudySession(db.Model):
    __tablename__ = 'study_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, default=1)
    title = db.Column(db.String(200), nullable=False)
    subject = db.Column(db.String(100), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    color = db.Column(db.String(50), default='blue')
    priority = db.Column(db.String(20), default='medium')
    notes = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        db.Index('idx_sessions_date', 'date'),
        db.Index('idx_sessions_user_date', 'user_id', 'date'),
    )

    def to_dict(self):
        """Convert to JSON-compatible dict matching current API format"""
        return {
            'id': self.id,
            'title': self.title,
            'subject': self.subject,
            'date': self.date.strftime('%Y-%m-%d'),
            'startTime': self.start_time.strftime('%H:%M'),
            'endTime': self.end_time.strftime('%H:%M'),
            'color': self.color,
            'priority': self.priority,
            'notes': self.notes
        }


class Task(db.Model):
    __tablename__ = 'tasks'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, default=1)
    title = db.Column(db.String(300), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Indexes
    __table_args__ = (
        db.Index('idx_tasks_due_date', 'due_date'),
        db.Index('idx_tasks_user', 'user_id'),
    )

    def to_dict(self):
        """Convert to JSON-compatible dict matching current API format"""
        return {
            'id': self.id,
            'title': self.title,
            'dueDate': self.due_date.strftime('%Y-%m-%d'),
            'completed': self.completed
        }


class FocusSession(db.Model):
    __tablename__ = 'focus_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, default=1)
    subject = db.Column(db.String(100), nullable=False)
    date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime)
    duration = db.Column(db.Integer, nullable=False)  # minutes
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Indexes
    __table_args__ = (
        db.Index('idx_focus_date', 'date'),
        db.Index('idx_focus_user_date', 'user_id', 'date'),
    )

    def to_dict(self):
        """Convert to JSON-compatible dict matching current API format"""
        return {
            'id': self.id,
            'subject': self.subject,
            'date': self.date.strftime('%Y-%m-%d'),
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration': self.duration
        }


class CurrentFocusSession(db.Model):
    __tablename__ = 'current_focus_session'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True, default=1)
    subject = db.Column(db.String(100), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        """Convert to JSON-compatible dict matching current API format"""
        return {
            'start_time': self.start_time.isoformat(),
            'subject': self.subject
        }
