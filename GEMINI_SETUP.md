# Gemini Setup Quick Guide

1. Create/get a Gemini API key from Google AI Studio:
   https://aistudio.google.com/app/apikey

2. Copy `.env.example` to `.env`.

3. Set:

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-3.6-flash
```

4. Install:

```powershell
pip install -r requirements.txt
```

5. Start:

```powershell
python -m uvicorn app.main:app --reload --port 8000
```

Google's official Gemini SDK for Python is `google-genai`.

This project uses:

```python
from google import genai
```

and:

```python
client.models.generate_content_stream(...)
```

so you can see Gemini streaming directly rather than using an OpenAI compatibility layer.