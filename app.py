import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import PyPDF2
from werkzeug.utils import secure_filename
# FIX 1: Add dotenv and load it
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=[
    "https://amirtha-varshine.github.io",
    "http://127.0.0.1:5000",
    "http://localhost:5000"
])

# FIX 1: Fail gracefully if environment variable is missing
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("Missing GOOGLE_API_KEY environment variable. Application cannot start.")
genai.configure(api_key=GOOGLE_API_KEY)

# FIX 2: Using gemini-2.5-flash as this is the model supported by your API key.
model = genai.GenerativeModel('gemini-2.5-flash')

def extract_text_from_pdf(file_path):
    """Extracts text from a saved PDF file."""
    text = ""
    try:
        with open(file_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return None
    return text


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "INKRIA backend is running."})


@app.route('/api/generate-notes', methods=['POST'])
def generate_notes():
    data = request.json
    topic = data.get('topic', '').strip()
    include_summary  = data.get('include_summary', False)
    include_analysis = data.get('include_analysis', False)
    include_mindmap  = data.get('include_mindmap', False)

    if not topic:
        return jsonify({"error": "Topic is required"}), 400

    try:
        prompt = (
            f'Act as an expert professor. Create comprehensive, well-structured educational notes '
            f'on the topic: "{topic}". Use headings, bullet points, and examples.'
        )

        if include_summary:
            prompt += '\n\nAfter the notes, add a section titled "## SUMMARY" with a 2-paragraph summary.'
        if include_analysis:
            prompt += '\n\nAdd a section titled "## CRITICAL ANALYSIS" covering modern impacts, pros, and cons.'
        if include_mindmap:
            prompt += (
                '\n\nAdd a section titled "## MIND MAP" with a Mermaid.js syntax mindmap (starting with \'mindmap\', no outer brackets).\n'
                'CRITICAL RULES FOR MINDMAP:\n'
                '1. Use different shapes for different levels: Root node MUST be a circle `((Root))`, Main branches MUST be squares `[Branch]`, sub-branches MUST be rounded `(Sub)`, and leaf nodes MUST be hexagons `{{Leaf}}`.\n'
                '2. Keep node text extremely concise (2-5 words max) so it does not look clumsy.\n'
                '3. Avoid overly deep or crowded trees to guarantee a clear visual view.'
            )

        result_text = model.generate_content(prompt).text

        notes_text    = result_text
        summary_text  = ''
        analysis_text = ''
        mindmap_text  = ''

        if include_summary and '## SUMMARY' in result_text:
            parts = result_text.split('## SUMMARY')
            notes_text   = parts[0]
            rest         = parts[1] if len(parts) > 1 else ''
            summary_text = rest.split('## CRITICAL ANALYSIS')[0].split('## MIND MAP')[0]

        if include_analysis and '## CRITICAL ANALYSIS' in result_text:
            parts         = result_text.split('## CRITICAL ANALYSIS')
            analysis_text = (parts[1] if len(parts) > 1 else '').split('## MIND MAP')[0]

        if include_mindmap and '## MIND MAP' in result_text:
            mindmap_text = result_text.split('## MIND MAP')[1] if '## MIND MAP' in result_text else ''

        response = {
            "status":  "success",
            "topic":   topic,
            "notes":   notes_text.strip(),
        }
        if summary_text.strip():
            response["summary"]  = summary_text.strip()
        if analysis_text.strip():
            response["analysis"] = analysis_text.strip()
        if mindmap_text.strip():
            response["mindmap"]  = mindmap_text.strip()

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/process-document', methods=['POST'])
def process_document():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported."}), 400

    try:
        os.makedirs('temp', exist_ok=True)
        filepath = os.path.join('temp', secure_filename(file.filename))
        file.save(filepath)

        # FIX 3: Wrap temporary file handling in try...finally
        try:
            extracted_text = extract_text_from_pdf(filepath)
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

        if not extracted_text or not extracted_text.strip():
            return jsonify({"error": "Could not extract text from the PDF. It may be scanned/image-based."}), 400

        prompt = (
            f'Read this extracted document text and:\n'
            f'1. Generate comprehensive, well-structured notes summarizing the entire document.\n'
            f'2. Under the heading "## KEY POINTS", list the 5 most important takeaways.\n\n'
            f'Document Text:\n{extracted_text[:25000]}'
        )

        result_text = model.generate_content(prompt).text
        notes_text = result_text
        key_points = []
        
        if '## KEY POINTS' in result_text:
            parts      = result_text.split('## KEY POINTS')
            notes_text = parts[0].strip()
            kp_text    = parts[1].strip() if len(parts) > 1 else ''
            key_points = [line.lstrip('0123456789.-• ').strip()
                          for line in kp_text.split('\n') if line.strip()]

        return jsonify({
            "status":     "success",
            "filename":   file.filename,
            "notes":      notes_text,
            "key_points": key_points or ["See notes above for key information."]
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/summarize', methods=['POST'])
def summarize_content():
    data    = request.json
    content = data.get('content', '').strip()
    length  = data.get('length', 'medium')

    if not content:
        return jsonify({"error": "Content is required"}), 400

    length_instructions = {
        "short":  "Summarize this in exactly 3-5 concise bullet points.",
        "medium": "Provide a well-rounded 2-3 paragraph summary.",
        "long":   "Perform a detailed, comprehensive review with headings summarizing all major themes."
    }

    try:
        prompt = f"{length_instructions.get(length, length_instructions['medium'])}\n\nContent:\n{content}"
        result = model.generate_content(prompt).text
        return jsonify({
            "status":          "success",
            "summary":         result,
            "original_length": len(content)
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/generate-mindmap', methods=['POST'])
def generate_mindmap():
    source_type = request.form.get('source_type', 'text')

    try:
        content = ""
        if source_type == 'file':
            if 'file' not in request.files:
                return jsonify({"error": "No file uploaded"}), 400
            file = request.files['file']
            if not file.filename:
                return jsonify({"error": "No file selected"}), 400
                
            # FIX 2: Added strict validation logic equivalent to /api/process-document + MIME + sizing limit
            if not file.filename.lower().endswith('.pdf'):
                return jsonify({"error": "Only PDF files are supported."}), 400
            if file.mimetype != 'application/pdf':
                return jsonify({"error": "Invalid file content. Must be application/pdf."}), 400
            MAX_FILE_SIZE = 5 * 1024 * 1024
            if request.content_length and request.content_length > MAX_FILE_SIZE:
                return jsonify({"error": "File size exceeds 5MB limit."}), 400

            os.makedirs('temp', exist_ok=True)
            filepath = os.path.join('temp', secure_filename(file.filename))
            file.save(filepath)
            
            # FIX 3: Try...finally for cleanup
            try:
                content = extract_text_from_pdf(filepath) or ''
            finally:
                if os.path.exists(filepath):
                    os.remove(filepath)
        else:
            content = request.form.get('topic', '').strip()

        if not content:
            return jsonify({"error": "No content provided"}), 400

        prompt = (
            f'Create a highly detailed, hierarchical mind map in Mermaid.js syntax (starting with "mindmap" -> "\\n").\n'
            f'CRITICAL RULES:\n'
            f'1. Use indentation to show parent-child relationships according to Mermaid guidelines.\n'
            f'2. Use different shapes for different hierarchy levels: Root node MUST be a circle `((Root))`, Main branches MUST be squares `[Branch]`, sub-branches MUST be rounded `(Sub)`, and leaf nodes MUST be hexagons `{{Leaf}}`.\n'
            f'3. Keep node text extremely concise (2-5 words max) so it does not look clumsy. Do not output sentences inside shapes.\n'
            f'4. Avoid overly deep or crowded trees to guarantee a clear visual view.\n'
            f'5. Do NOT wrap the result in any other markdown code block delimiters.\n\n'
            f'Content/Topic:\n{content[:25000]}'
        )

        result = model.generate_content(prompt).text
        return jsonify({"status": "success", "mindmap_data": result})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/deep-analysis', methods=['POST'])
def deep_analysis():
    data       = request.json
    subject    = data.get('subject', '').strip()
    historical = data.get('historical_context', False)
    future     = data.get('future_implications', False)
    cite       = data.get('cite_sources', False)

    if not subject:
        return jsonify({"error": "Subject is required"}), 400

    try:
        prompt = (
            f'Conduct a highly detailed, academic deep-dive analysis on: "{subject}".\n'
            f'Explore nuances, opposing viewpoints, and underlying mechanisms. Use clear section headings.'
        )
        if historical:
            prompt += '\n\nInclude a section "## HISTORICAL CONTEXT" covering origins and evolution.'
        if future:
            prompt += '\n\nInclude a section "## FUTURE IMPLICATIONS" covering predictions and impacts.'
        if cite:
            prompt += '\n\nFinally, include "## SOURCES" with 5 foundational books/papers for research.'

        result_text = model.generate_content(prompt).text

        main_text      = result_text
        response       = {"status": "success", "subject": subject}

        if historical and '## HISTORICAL CONTEXT' in result_text:
            parts     = result_text.split('## HISTORICAL CONTEXT')
            main_text = parts[0].strip()
            hist_text = (parts[1] if len(parts) > 1 else '').split('## FUTURE IMPLICATIONS')[0].split('## SOURCES')[0]
            response['historical_context'] = hist_text.strip()

        if future and '## FUTURE IMPLICATIONS' in result_text:
            fut_text = result_text.split('## FUTURE IMPLICATIONS')[1].split('## SOURCES')[0]
            response['future_implications'] = fut_text.strip()

        if cite and '## SOURCES' in result_text:
            src_text = result_text.split('## SOURCES')[1]
            response['sources'] = [s.strip() for s in src_text.split('\n') if s.strip()]

        response['analysis'] = main_text
        return jsonify(response)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)), debug=False)
