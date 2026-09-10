# 🧠 INKRIA — AI-Powered Note Generator

**INKRIA** is an intelligent note-generation web app powered by Google's Gemini AI. Enter any topic, upload a PDF, or paste text — and get beautifully structured notes, summaries, visual mind maps, and deep academic analysis in seconds.

🔗 **Live Demo:** [inkria.onrender.com](https://inkria.onrender.com)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📝 **Auto Note Generation** | Enter any topic and get comprehensive, well-structured educational notes with headings, bullet points, and examples |
| 📄 **PDF Processing** | Upload a PDF document and extract key points with AI-generated structured notes |
| 📋 **Content Summarizer** | Paste long articles or text and get concise summaries in short, medium, or detailed formats |
| 🗺️ **Visual Mind Maps** | Generate interactive, zoomable mind maps from any topic or text — with download as PNG |
| 🔬 **Deep Analysis** | Get academic-level deep-dive analysis with historical context, future implications, and cited sources |
| 🌙 **Dark Mode** | Toggle between light and dark themes |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML, CSS, JavaScript |
| **Backend** | Python, Flask |
| **AI Engine** | Google Gemini 2.5 Flash |
| **Mind Maps** | Markmap (D3.js-based) |
| **PDF Parsing** | PyPDF2 |
| **Deployment** | Render |

---

## 🚀 Run Locally

### Prerequisites
- Python 3.9+
- A [Google Gemini API key](https://aistudio.google.com/apikey)

### Setup

```bash
# Clone the repository
git clone https://github.com/amirtha-varshine/INKRIA.git
cd INKRIA

# Create a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Create a .env file with your API key
echo GOOGLE_API_KEY="your_api_key_here" > .env

# Run the app
python app.py
```

Open [http://localhost:5000](http://localhost:5000) in your browser.

---

## 📁 Project Structure

```
INKRIA/
├── app.py              # Flask backend with API routes
├── index.html          # Main frontend page
├── script.js           # Frontend logic & API calls
├── style.css           # Styling & dark mode
├── requirements.txt    # Python dependencies
├── Procfile            # Deployment config for Render
├── .env                # API key (not committed)
└── .gitignore
```

---

## 📸 Screenshots

<!-- Add screenshots here if you want! Example: -->
<!-- ![Home Page](screenshots/home.png) -->

---

## 📄 License

This project is open source and available for personal and educational use.

---

<p align="center">Made with ❤️ by <a href="https://github.com/amirtha-varshine">amirtha-varshine</a></p>
