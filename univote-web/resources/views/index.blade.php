<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Univote - Student Election Platform</title>
    
    <!-- Vite CSS and JS -->
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        html, body {
            width: 100%;
            height: 100%;
        }

        body {
            background-color: #f5f5f5;
            overflow-x: hidden;
        }

        #app {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div id="app"></div>
</body>
</html>
