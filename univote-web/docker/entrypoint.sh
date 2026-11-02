#!/bin/sh
set -e

# Cache configuration, routes, and views for production performance
php artisan config:cache || true
php artisan route:cache || true
php artisan view:cache || true

# Create the public/storage symlink so uploaded files (avatars, candidate photos) are served
php artisan storage:link || true

# Automatically run database migrations on Render startup
echo "Running database migrations..."
php artisan migrate --force || true

# Ensure Laravel storage (including log files written by root while caching the
# config/routes/views and running migrations) is owned by PHP-FPM (www-data).
# Otherwise the app cannot append to storage/logs/laravel.log at runtime.
mkdir -p /var/www/html/storage/logs
touch /var/www/html/storage/logs/laravel.log
chown -R www-data:www-data /var/www/html/storage /var/www/html/bootstrap/cache || true
chmod -R 775 /var/www/html/storage /var/www/html/bootstrap/cache || true

# Start Supervisor (which starts Nginx and PHP-FPM)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
