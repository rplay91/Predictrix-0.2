# Predictrix 0.2

Predictrix 0.2 is a web-based essay writing and sentence prediction system for English writing practice. The project provides student writing pages, teacher review pages, homework setup, image-assisted writing support, and AI-generated sentence prediction based on a learner's current essay, historical essays, and uploaded image information.

This project was originally developed by Ben and later maintained as a research/development prototype. Future researchers are welcome to clone, improve, refactor, and extend it.

## Main Features

- **Student and teacher login**
  - Supports separate student and teacher authentication flows.
- **Essay writing workflow**
  - Pre-test writing page.
  - Post-test writing page.
  - Homework writing pages.
  - Essay saving, submitting, resetting, and review-count tracking.
- **Homework image setup**
  - Students can upload images for writing tasks.
  - Images are analyzed to generate keywords and beginner-friendly descriptions for EFL writing support.
- **AI sentence prediction**
  - Predicts possible next sentences based on:
    - current essay content,
    - historical essay content,
    - image information,
    - essay title,
    - writing purpose,
    - reasoning and style analysis.
- **Teacher dashboard**
  - Allows teachers to view submitted essay lists.
- **Research-oriented backend**
  - Stores essays, prediction records, homework states, and student interactions in a MySQL database.

## Tech Stack

### Backend

- Python
- FastAPI
- Uvicorn
- Pydantic
- PyMySQL
- OpenAI API
- LangChain
- ChromaDB
- GraphRAG
- Transformers / PyTorch
- scikit-learn, pandas, NumPy, SciPy

### Frontend

- HTML templates with Jinja2
- Static assets served through FastAPI
- Driver.js for guided UI interaction

### Database

- MySQL / MariaDB
- Default database name in the project configuration: `prediction-db`

## Project Structure

The main application entry point is:

```text
main.py
```

Important backend modules include:

```text
login_api.py              # Student and teacher login logic
index_api.py              # Student essay list retrieval
test_api.py               # Pre-test and post-test workflow
hw_writing_api.py         # Homework writing, saving, submitting, and prediction records
hw_setup_api.py           # Homework image upload and AI image analysis
predict_api.py            # AI-based sentence prediction pipeline
show_essay_api.py         # Essay review tracking
teacher_index_api.py      # Teacher dashboard data
db_config.py              # MySQL database configuration
```

Frontend files are expected in:

```text
templates/
static/
```

## Requirements

- Python 3.10 or newer is recommended.
- MySQL or MariaDB.
- OpenAI API key.
- Node.js and npm are optional, only needed if you want to install or update the frontend dependency listed in `package.json`.

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/rplay91/Predictrix-0.2.git
cd Predictrix-0.2
```

### 2. Create and activate a virtual environment

Windows PowerShell:

```bash
python -m venv .venv
.venv\Scripts\activate
```

macOS / Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 4. Install Node dependency, optional

```bash
npm install
```

## Configuration

### 1. Configure the OpenAI API key

Create a file named `api_config.py` in the project root:

```python
GPT_API_KEY = "your-openai-api-key-here"
```

Do not commit this file. It is intentionally ignored by Git.

### 2. Configure the database

Edit `db_config.py` based on your local MySQL/MariaDB settings:

```python
DB_CONFIG = {
    "host": "localhost",
    "user": "root",
    "password": "your-password",
    "db": "prediction-db",
    "charset": "utf8mb4",
    "cursorclass": DictCursor
}
```

Make sure the database and required tables exist before running the application.

## Running the Application

Start the FastAPI server with:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then open:

```text
http://localhost:8000
```

The app can also be started directly with:

```bash
python main.py
```

## Main Routes

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/login` | Login page |
| `/show_essay` | Essay display/review page |
| `/test1_writing` | Pre-test writing page |
| `/test2_writing` | Post-test writing page |
| `/hw1_writing_setup` | Homework 1 setup page |
| `/hw1_writing` | Homework 1 writing page |
| `/hw2_writing_setup` | Homework 2 setup page |
| `/hw2_writing` | Homework 2 writing page |
| `/teacher_index` | Teacher dashboard |
| `/predict_test` | Prediction testing page |
| `/predict_batch` | Batch prediction page |

## Important API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/verify_login` | Verify student or teacher login |
| `GET` | `/get_user_essays/{sid}` | Get essays for one student |
| `GET` | `/check_pretest_status/{sid}` | Check pre-test availability |
| `GET` | `/check_posttest_status/{sid}` | Check post-test availability |
| `POST` | `/initialize_pretest/{sid}` | Create pre-test essay record |
| `POST` | `/initialize_posttest/{sid}` | Create post-test essay record |
| `POST` | `/analyze_image/` | Analyze uploaded image for writing support |
| `POST` | `/initialize_homework1` | Create Homework 1 essay record |
| `POST` | `/initialize_homework2` | Create Homework 2 essay record |
| `GET` | `/load_hw_data/{eid}` | Load homework data |
| `POST` | `/save_hw_content/{eid}` | Save homework draft |
| `POST` | `/submit_hw/{eid}` | Submit homework content |
| `GET` | `/get_history_essays_content/{sid}` | Retrieve historical essays |
| `POST` | `/predict_sentence` | Generate predicted sentence |
| `POST` | `/save_prediction/{eid}` | Save prediction result |
| `POST` | `/update_review_count/{eid}` | Update essay review count |
| `POST` | `/update_prediction_count/{pid}` | Update prediction check count |
| `GET` | `/api/get_all_essay_list` | Get all essays for teacher dashboard |

## Suggested Research Use

Predictrix can be used as a research prototype for studies related to:

- AI-assisted EFL writing,
- predictive writing support,
- automated writing feedback,
- learner writing history analysis,
- multimodal writing prompts,
- teacher review and student writing analytics.

## Notes for Future Researchers

This repository is a working research prototype, so some parts may need cleaning, documentation, and refactoring. Recommended improvements include:

- Add a database schema or migration file.
- Move secret keys fully into `.env`.
- Add setup scripts for database initialization.
- Add automated tests.
- Add API documentation with FastAPI Swagger examples.
- Refactor repeated imports and duplicated model definitions.
- Separate research logic, database logic, and route logic into clearer modules.
- Add sample data for local testing.

## Security Notes

- Never commit `api_config.py`, `.env`, database credentials, or API keys.
- Change the default database password before deployment.
- Do not expose this application publicly without authentication hardening and input validation review.
