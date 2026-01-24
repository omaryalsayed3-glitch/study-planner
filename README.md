# StudyFlow AI

A comprehensive AI-powered study planner web application built with Flask (Python backend), HTML, and CSS.

## Features

- **Landing Page**: Hero section with features and call-to-action
- **Dashboard**: Personalized study plan, upcoming tasks, progress overview, and AI recommendations
- **Planner**: Interactive calendar view with ability to add study sessions
- **Features Page**: Detailed feature descriptions
- **Progress Page**: Analytics with charts and milestone tracking
- **Settings Page**: User profile and preferences

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application

1. Start the Flask server:
```bash
python app.py
```

2. Open your web browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
Study Planner AI/
├── app.py                 # Flask backend application
├── requirements.txt       # Python dependencies
├── templates/            # HTML templates
│   ├── index.html        # Landing page
│   ├── dashboard.html    # Dashboard page
│   ├── planner.html      # Planner page
│   ├── features.html     # Features page
│   ├── progress.html     # Progress page
│   └── settings.html     # Settings page
├── static/               # Static files
│   ├── css/
│   │   └── style.css     # Main stylesheet
│   └── js/
│       └── script.js     # JavaScript for interactivity
└── README.md             # This file
```

## Pages

- **Home** (`/`): Landing page with hero section and features
- **Dashboard** (`/dashboard`): Main dashboard with study plan and tasks
- **Planner** (`/planner`): Calendar view for scheduling study sessions
- **Features** (`/features`): Detailed feature descriptions
- **Progress** (`/progress`): Progress tracking with charts and milestones
- **Settings** (`/settings`): User settings and preferences

## Technologies Used

- **Backend**: Python with Flask
- **Frontend**: HTML5, CSS3, JavaScript
- **Design**: Responsive design with modern UI/UX

## License

© 2026 StudyFlow AI. All rights reserved.
