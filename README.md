# Project 1 — LLM Chatbot with Gemini

A beginner-friendly AI Engineer project demonstrating:

- Python
- FastAPI
- Google's official `google-genai` Python SDK
- Gemini API
- Tokens / token usage
- System prompt
- User + assistant conversation
- Streaming
- React
- Server-Sent Events (SSE)
- Conversation history

## Architecture

```text
React
  ↓ HTTP POST
FastAPI
  ↓
Google GenAI SDK
  ↓
Gemini API
  ↓ streaming chunks
FastAPI
  ↓ SSE
React
  ↓
Live assistant response
```

Google recommends the official Google GenAI SDK (`google-genai`) for Gemini applications. The SDK supports Python and provides the `generate_content_stream` method used by this project. See the official Gemini documentation for current SDK and model information.

## 1. Software required on Windows 11

Install:

1. Git
2. Python 3.10+
3. Node.js LTS
4. VS Code
5. A Gemini API key

Official download/setup pages:

- Git: https://git-scm.com/download/win
- Python: https://www.python.org/downloads/windows/
- Node.js: https://nodejs.org/en/download
- VS Code: https://code.visualstudio.com/download
- Gemini API / Google AI Studio: https://ai.google.dev/gemini-api/docs

Verify from PowerShell:

```powershell
git --version
py --version
python --version
node --version
npm --version
```

## 2. Create/configure the backend

Open PowerShell:

```powershell
cd backend
py -m venv .venv
```

Activate:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then activate again:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

The important Gemini dependency is:

```text
google-genai
```

## 3. Configure your Gemini API key

Copy:

```text
.env.example
```

to:

```text
.env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
FRONTEND_ORIGIN=http://localhost:5173
```

Replace `your_gemini_api_key_here` with your actual Gemini API key.

IMPORTANT:

- Keep the Gemini key only in the FastAPI backend.
- Do NOT put it in React/Vite code.
- Do NOT commit `.env` to Git.

The project `.gitignore` already ignores `.env`.

## 4. Start FastAPI

From the `backend` directory:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Test:

```text
http://localhost:8000/api/health
```

Expected:

```json
{
  "status": "ok"
}
```

## 5. Start React

Open a SECOND PowerShell window.

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL, normally:

```text
http://localhost:5173
```

## 6. How the request works

You type:

```text
What is FastAPI?
```

React creates:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is FastAPI?"
    }
  ]
}
```

It sends:

```text
POST http://localhost:8000/api/chat
```

FastAPI validates the request with Pydantic.

Then:

```text
FastAPI
  ↓
app/llm.py
  ↓
Google GenAI SDK
  ↓
Gemini API
```

The backend calls:

```python
client.models.generate_content_stream(
    model=GEMINI_MODEL,
    contents=contents,
    config=types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
    ),
)
```

The Gemini API returns response chunks as they are generated.

FastAPI forwards those chunks to React using Server-Sent Events.

React reads the stream and appends each text chunk to the assistant message.

## 7. File-by-file explanation

### `backend/requirements.txt`

Python dependencies:

```text
fastapi
uvicorn[standard]
google-genai
python-dotenv
pydantic
```

`google-genai` is Google's official GenAI Python SDK.

### `backend/.env.example`

Template for backend configuration:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=...
FRONTEND_ORIGIN=...
```

Copy it to `.env`.

### `backend/app/config.py`

Loads environment variables:

```python
load_dotenv()
```

reads `.env`.

```python
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
```

gets your Gemini secret.

```python
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
```

selects the Gemini model.

```python
SYSTEM_PROMPT = ...
```

defines the system-level behavior.

### `backend/app/schemas.py`

Defines the API contract.

```python
class ChatMessage(BaseModel):
```

represents one message.

The role is restricted to:

```text
user
assistant
```

The frontend conversation looks like:

```json
{
  "role": "user",
  "content": "Hello"
}
```

### `backend/app/llm.py`

This is the Gemini integration layer.

```python
from google import genai
from google.genai import types
```

imports the official SDK.

```python
client = genai.Client(api_key=GEMINI_API_KEY)
```

creates the Gemini API client.

The application conversation uses:

```text
user
assistant
```

Gemini's content model uses:

```text
user
model
```

Therefore the code maps:

```python
role = "model" if message["role"] == "assistant" else "user"
```

Then it builds Gemini `Content` objects:

```python
types.Content(
    role=role,
    parts=[types.Part.from_text(text=message["content"])],
)
```

This converts our simple API messages into the Gemini SDK's content format.

### Gemini streaming

The important call is:

```python
client.models.generate_content_stream(...)
```

This asks Gemini to return generated content incrementally.

For every chunk:

```python
if chunk.text:
    yield {
        "type": "delta",
        "text": chunk.text,
    }
```

we forward the generated text to FastAPI.

At the end, the code attempts to read:

```python
chunk.usage_metadata
```

and expose:

```text
input_tokens
output_tokens
total_tokens
```

to the frontend.

### `backend/app/main.py`

Creates the FastAPI application.

```python
app = FastAPI(...)
```

creates the server.

CORS allows:

```text
React localhost:5173
```

to call:

```text
FastAPI localhost:8000
```

The endpoint:

```python
@app.post("/api/chat")
```

receives the conversation.

`StreamingResponse` sends SSE events back to React.

### `frontend/src/main.jsx`

React entry point.

It renders:

```jsx
<App />
```

and imports the CSS.

### `frontend/src/App.jsx`

Contains the chatbot UI and client-side logic.

Important state:

```jsx
messages
```

stores the current conversation.

```jsx
input
```

stores the textarea.

```jsx
isStreaming
```

prevents another request while Gemini is generating.

```jsx
usage
```

displays Gemini token usage when available.

### `sendMessage()`

This function:

1. Gets the user's message.
2. Adds it to local conversation state.
3. Sends the conversation to FastAPI.
4. Reads the HTTP response stream.
5. Parses SSE events.
6. Adds each Gemini text chunk to the assistant message.
7. Displays final token usage.

### `frontend/src/styles.css`

Only UI styling:

- Chat layout
- Message bubbles
- Input
- Buttons
- Responsive design

### `frontend/package.json`

Defines React/Vite dependencies and commands:

```powershell
npm install
npm run dev
npm run build
```

## 8. Conversation flow

First request:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is Python?"
    }
  ]
}
```

Second request can contain:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "What is Python?"
    },
    {
      "role": "assistant",
      "content": "Python is..."
    },
    {
      "role": "user",
      "content": "Give me an example."
    }
  ]
}
```

The frontend keeps this conversation in React state and sends it back to Gemini on each request.

Refreshing the browser currently loses the conversation.

Later we will persist it in PostgreSQL.

## 9. What you are learning

### LLM

Gemini is the LLM.

```text
FastAPI
  ↓
Gemini
  ↓
Generated answer
```

### Prompt

The project has:

```python
SYSTEM_PROMPT
```

This tells the model how it should behave.

### Tokens

Gemini returns usage metadata when available:

```text
input tokens
output tokens
total tokens
```

The UI displays these values.

### Streaming

Instead of waiting for:

```text
Full answer
```

the backend receives:

```text
chunk 1
chunk 2
chunk 3
...
```

and sends them to React.

### Conversation

React sends previous messages back to FastAPI:

```text
User
 ↓
Assistant
 ↓
User
 ↓
Assistant
 ↓
...
```

This gives Gemini the conversation context for the next request.

## 10. Exercises

### Exercise 1 — Change the system prompt

Change:

```python
SYSTEM_PROMPT = """..."""
```

to:

```text
You are a Python teacher.
Explain concepts for beginners.
Always include one small example.
```

Observe the behavior.

### Exercise 2 — Learn tokens

Ask:

```text
What is Python?
```

Then ask for a very long article.

Compare:

```text
input_tokens
output_tokens
total_tokens
```

### Exercise 3 — Streaming

Experiment with a non-streaming Gemini request and compare the user experience.

### Exercise 4 — Conversation

Ask:

```text
My name is Sam.
```

Then:

```text
What is my name?
```

Now modify the frontend so it sends only the latest message. Observe why conversation history matters.

### Exercise 5 — Context management

Limit the number of previous messages sent to Gemini.

This introduces context-window management.

## 11. Troubleshooting

### `python is not recognized`

Try:

```powershell
py --version
```

Then use:

```powershell
py -m venv .venv
```

### `uvicorn is not recognized`

Use:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

### `No module named google.genai`

Activate your virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Then:

```powershell
pip install -r requirements.txt
```

### `GEMINI_API_KEY is missing`

Check:

```text
backend/.env
```

It should contain:

```env
GEMINI_API_KEY=your_actual_key
```

Make sure Windows has not created:

```text
.env.txt
```

instead.

### Gemini authentication/API error

Check that the API key is valid and that your Gemini API project has access to the model configured in:

```env
GEMINI_MODEL=gemini-3.6-flash
```

You can also change the model to another currently available Gemini model if needed.

### CORS error

Check:

```env
FRONTEND_ORIGIN=http://localhost:5173
```

If Vite is running on another port, update this value and restart FastAPI.

## 12. Security

Never put:

```text
GEMINI_API_KEY
```

inside React.

Wrong:

```text
React
 └── Gemini API key
```

Correct:

```text
React
  ↓
FastAPI
  ↓
Gemini API
```

The Gemini API key stays on the server.

## 13. Next learning steps

Build on this exact project:

```text
PROJECT 1
Gemini LLM Chatbot
    ↓
PostgreSQL chat persistence
    ↓
PROJECT 2
Embeddings + RAG + pgvector
    ↓
PROJECT 3
Structured output + Gemini function/tool calling
    ↓
PROJECT 4
Agent loop + memory
    ↓
Evaluation + observability
    ↓
Docker + cloud + production deployment
```