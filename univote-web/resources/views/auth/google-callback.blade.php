<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Univote - Google Sign-In</title>
    <style>
        body {
            font-family: 'Inter Variable', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
                Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1B5E20 0%, #2E7D32 100%);
            color: #fff;
        }
        .card {
            background: #ffffff;
            color: #1f2937;
            padding: 2.5rem;
            border-radius: 1.25rem;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
            text-align: center;
            max-width: 380px;
            width: 90%;
        }
        .spinner {
            width: 44px;
            height: 44px;
            border: 4px solid #dcfce7;
            border-top: 4px solid #16a34a;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
            margin: 0 auto 1.5rem;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        h2 { margin: 0 0 0.5rem; font-size: 1.25rem; color: #111827; font-weight: 700; }
        p { margin: 0 0 1.5rem; font-size: 0.875rem; color: #6b7280; line-height: 1.4; }
        .btn {
            display: inline-block;
            background: #16a34a;
            color: #fff;
            padding: 0.75rem 1.5rem;
            border-radius: 9999px;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.875rem;
            transition: background 0.2s;
        }
        .btn:hover { background: #15803d; }
    </style>
</head>
<body>
    <div class="card">
        <div class="spinner"></div>
        <h2>Sign-In Complete</h2>
        <p id="status-text">Returning to Univote app...</p>
        <a id="app-btn" href="#" class="btn" style="display: none;">Open Univote App</a>
    </div>

    <script>
        (function() {
            const rawHash = window.location.hash || '';
            const rawSearch = window.location.search || '';
            const payload = rawHash.startsWith('#') ? rawHash.substring(1) : (rawSearch.startsWith('?') ? rawSearch.substring(1) : '');

            // 1. PostMessage to opener for Web browser / popups
            if (window.opener) {
                try {
                    window.opener.postMessage({ url: window.location.href, type: 'google-auth-success' }, '*');
                } catch(e) {}
            }

            // 2. Deep link back to native mobile app via univote://
            const deepLink = 'univote://auth/google?' + payload;
            const btn = document.getElementById('app-btn');
            if (btn) {
                btn.href = deepLink;
                btn.style.display = 'inline-block';
            }

            // Attempt automatic redirect
            setTimeout(() => {
                window.location.href = deepLink;
            }, 300);
        })();
    </script>
</body>
</html>
