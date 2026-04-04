document.addEventListener('DOMContentLoaded', () => {

    const API_BASE = 'http://127.0.0.1:5000/api';

    if (window.pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    // ─── TAB SWITCHING ────────────────────────────────────────────────────────
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.onclick = () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
        };
    });

    // ─── FILE UPLOAD UI ───────────────────────────────────────────────────────
    const uploadArea = document.getElementById('upload-area');
    const fileInput  = document.getElementById('file-upload');

    if (uploadArea && fileInput) {
        uploadArea.onclick = () => fileInput.click();
        uploadArea.ondragover = e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; };
        uploadArea.ondragleave = e => { e.preventDefault(); uploadArea.style.borderColor = '#cbd5e1'; };
        uploadArea.ondrop = e => {
            e.preventDefault();
            uploadArea.style.borderColor = '#cbd5e1';
            if (e.dataTransfer.files.length) {
                fileInput.files = e.dataTransfer.files;
                updateFileName(e.dataTransfer.files[0].name);
            }
        };
        fileInput.onchange = () => {
            if (fileInput.files.length) updateFileName(fileInput.files[0].name);
        };
        function updateFileName(name) {
            const hint = uploadArea.querySelector('.file-hint');
            if (hint) hint.innerHTML = `Selected: <strong style="color:var(--primary);">${name}</strong>`;
        }
    }

    // ─── RENDERING HELPERS ───────────────────────────────────────────────────
    function toggleBtn(btn, loading, originalHTML, loadText) {
        if (!btn) return;
        btn.disabled = loading;
        btn.innerHTML = loading ? `<i class="fa-solid fa-circle-notch fa-spin"></i> ${loadText}` : originalHTML;
    }

    function formatMdToHtml(markdownText) {
        // Use marked library from CDN to safely parse all markdown syntax to clean HTML
        return marked.parse(markdownText || 'No content generated.');
    }

    function renderResult(containerId, title, icon, htmlContent) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.style.display = 'block';
        el.innerHTML = `<h3><i class="fa-solid ${icon}"></i> ${title}</h3><div class="result-content markdown-styled">${htmlContent}</div>`;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    async function renderVisualMindMap(containerId, mermaidCode) {
        const target = document.getElementById(containerId).querySelector('.result-content');
        try {
            const mmId = 'mermaid-' + Math.random().toString(36).substr(2, 5);
            
            // Clean up the code to ensure it's valid mermaid syntax
            let diagram = mermaidCode.replace(/```mermaid/g, '').replace(/```/g, '').trim();
            if(!diagram.startsWith('mindmap')) {
                diagram = 'mindmap\n' + diagram;
            }

            const { svg } = await window.mermaid.render(mmId, diagram);
            
            // Force SVG to be responsive and large 
            const responsiveSvg = svg.replace(/<svg /, '<svg style="max-width:100%; height:auto; width:100%; min-height:400px;" ');

            const container = document.createElement('div');
            container.className = 'mermaid-container';
            container.style.cssText = "background:#f8fafc; padding:30px; border-radius:15px; box-shadow:inset 0 2px 10px rgba(0,0,0,0.05); margin-top:20px; overflow:auto; text-align:center; border: 2px solid #e2e8f0;";
            container.innerHTML = responsiveSvg;
            
            target.appendChild(container);
        } catch(e) {
            console.error("Mermaid parsing error:", e);
            target.innerHTML += `<div style="color:red; margin-top:20px; padding:15px; border:1px solid red; border-radius:10px;"><p>Failed to generate picture format. The AI structure was invalid. Here is the raw text:</p><pre>${mermaidCode}</pre></div>`;
        }
    }

    function renderError(containerId, message) {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.style.display = 'block';
        
        let friendlyMessage = message;
        if (message.includes("429") || message.includes("quota")) {
            friendlyMessage = "<strong>Rate Limit Exceeded:</strong> You are making requests too quickly. Google's Free Tier only allows a few requests per minute. Please wait 30 seconds and try again.";
        }

        el.innerHTML = `<h3 style="color:#ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> Error</h3>
                        <div class="result-content"><p style="color:#ef4444;">${friendlyMessage}</p>
                        <p style="font-size:0.9em; margin-top:10px;">If this says "Failed to fetch", ensure your backend server (app.py) is running locally and you are opening this file from your project folder.</p></div>`;
    }

    // ─── 1. AUTO GENERATION (BACKEND CALL) ────────────────────────────────────
    const btnAutoGen = document.getElementById('btn-auto-gen');
    if (btnAutoGen) {
        btnAutoGen.onclick = async () => {
            const topic = document.getElementById('topic-input').value.trim();
            if (!topic) return alert('Please enter a topic.');

            const include_summary  = document.getElementById('chk-summary').checked;
            const include_analysis = document.getElementById('chk-analysis').checked;
            const include_mindmap  = document.getElementById('chk-mindmap').checked;

            const origHTML = btnAutoGen.innerHTML;
            toggleBtn(btnAutoGen, true, origHTML, 'Generating Notes...');
            document.getElementById('res-auto-gen').style.display = 'none';

            try {
                const res = await fetch(`${API_BASE}/generate-notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topic, include_summary, include_analysis, include_mindmap })
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Server error');
                const data = await res.json();

                let html = `<div class="result-section"><h4>Notes on: ${data.topic}</h4>${formatMdToHtml(data.notes)}</div>`;
                if (data.summary) html += `<div class="result-section"><h4>Summary</h4>${formatMdToHtml(data.summary)}</div>`;
                if (data.analysis) html += `<div class="result-section"><h4>Critical Analysis</h4>${formatMdToHtml(data.analysis)}</div>`;
                
                renderResult('res-auto-gen', 'Generated Result', 'fa-wand-magic-sparkles', html);
                
                // Render mindmap visually if requested
                if (data.mindmap) {
                    await renderVisualMindMap('res-auto-gen', data.mindmap);
                }

            } catch (err) {
                renderError('res-auto-gen', err.message);
            } finally { toggleBtn(btnAutoGen, false, origHTML, ''); }
        };
    }

    // ─── 2. PDF PROCESSING (BACKEND CALL) ─────────────────────────────────────
    const btnPdf = document.getElementById('btn-pdf');
    if (btnPdf) {
        btnPdf.onclick = async () => {
            const file = fileInput.files[0];
            if (!file) return alert('Please upload a PDF file first.');

            const origHTML = btnPdf.innerHTML;
            toggleBtn(btnPdf, true, origHTML, 'Extracting & Processing...');
            document.getElementById('res-pdf').style.display = 'none';

            try {
                const fd = new FormData();
                fd.append('file', file);

                const res = await fetch(`${API_BASE}/process-document`, {
                    method: 'POST', body: fd
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Server error');
                const data = await res.json();

                // FIX 4: Build the list without re-processing HTML tags in marked.parse
                let keyPointsHTML = data.key_points.map(kp => `<li>${formatMdToHtml(kp)}</li>`).join('');
                const html = `
                    <div class="result-section"><h4>Document: ${data.filename}</h4>${formatMdToHtml(data.notes)}</div>
                    <div class="result-section"><h4>Key Points</h4><ul>${keyPointsHTML}</ul></div>
                `;
                renderResult('res-pdf', 'Document Analyzed', 'fa-file-invoice', html);
            } catch (err) {
                renderError('res-pdf', err.message);
            } finally { toggleBtn(btnPdf, false, origHTML, ''); }
        };
    }

    // ─── 3. CONTENT SUMMARIZER (BACKEND CALL) ─────────────────────────────────
    const btnSummary = document.getElementById('btn-summary');
    if (btnSummary) {
        btnSummary.onclick = async () => {
            const content = document.getElementById('summary-input').value.trim();
            if (!content) return alert('Please paste some content.');

            const length = document.querySelector('input[name="length"]:checked').value;
            const origHTML = btnSummary.innerHTML;
            toggleBtn(btnSummary, true, origHTML, 'Summarizing...');
            document.getElementById('res-summary').style.display = 'none';

            try {
                const res = await fetch(`${API_BASE}/summarize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content, length })
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Server error');
                const data = await res.json();

                const html = `<div class="result-section"><h4>${length.charAt(0).toUpperCase() + length.slice(1)} Summary</h4>
                              ${formatMdToHtml(data.summary)}<br><small style="color:#64748b;">Original length: ${data.original_length} chars</small></div>`;
                renderResult('res-summary', 'Extracted Summary', 'fa-compress', html);
            } catch (err) {
                renderError('res-summary', err.message);
            } finally { toggleBtn(btnSummary, false, origHTML, ''); }
        };
    }

    // ─── 4. MIND MAP CREATOR (BACKEND CALL) ───────────────────────────────────
    const btnMindmap = document.getElementById('btn-mindmap');
    if (btnMindmap) {
        btnMindmap.onclick = async () => {
            const topic = document.getElementById('mindmap-input').value.trim();
            if (!topic) return alert('Enter a topic.');

            const origHTML = btnMindmap.innerHTML;
            toggleBtn(btnMindmap, true, origHTML, 'Structuring Visual Map...');
            document.getElementById('res-mindmap').style.display = 'none';

            try {
                const fd = new FormData();
                fd.append('source_type', 'text');
                fd.append('topic', topic);

                const res = await fetch(`${API_BASE}/generate-mindmap`, { method: 'POST', body: fd });
                if (!res.ok) throw new Error((await res.json()).error || 'Server error');
                const data = await res.json();

                renderResult('res-mindmap', 'Generated Visual Mind Map', 'fa-project-diagram', '<p>Rendering image...</p>');
                await renderVisualMindMap('res-mindmap', data.mindmap_data);

            } catch (err) {
                renderError('res-mindmap', err.message);
            } finally { toggleBtn(btnMindmap, false, origHTML, ''); }
        };
    }

    // ─── 5. DEEP ANALYSIS (BACKEND CALL) ──────────────────────────────────────
    const btnAnalysis = document.getElementById('btn-analysis');
    if (btnAnalysis) {
        btnAnalysis.onclick = async () => {
            const subject = document.getElementById('analysis-input').value.trim();
            if (!subject) return alert('Enter a subject.');

            const historical_context  = document.getElementById('chk-historical').checked;
            const future_implications = document.getElementById('chk-future').checked;
            const cite_sources        = document.getElementById('chk-sources').checked;

            const origHTML = btnAnalysis.innerHTML;
            toggleBtn(btnAnalysis, true, origHTML, 'Analyzing...');
            document.getElementById('res-analysis').style.display = 'none';

            try {
                const res = await fetch(`${API_BASE}/deep-analysis`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject, historical_context, future_implications, cite_sources })
                });
                if (!res.ok) throw new Error((await res.json()).error || 'Server error');
                const data = await res.json();

                let html = `<div class="result-section"><h4>Deep Analysis: ${data.subject}</h4>${formatMdToHtml(data.analysis)}</div>`;
                if (data.historical_context) html += `<div class="result-section"><h4>Historical Context</h4>${formatMdToHtml(data.historical_context)}</div>`;
                if (data.future_implications) html += `<div class="result-section"><h4>Future Implications</h4>${formatMdToHtml(data.future_implications)}</div>`;
                if (data.sources) {
                    const srcLi = data.sources.map(s => `<li>${formatMdToHtml(s)}</li>`).join('');
                    html += `<div class="result-section"><h4>Cited Sources</h4><ul>${srcLi}</ul></div>`;
                }

                renderResult('res-analysis', 'Deep Analysis Completed', 'fa-microscope', html);
            } catch (err) {
                renderError('res-analysis', err.message);
            } finally { toggleBtn(btnAnalysis, false, origHTML, ''); }
        };
    }
});
