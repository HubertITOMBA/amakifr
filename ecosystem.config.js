/**
 * Configuration PM2 pour les applications AMAKI France et HITOMBACOM
 * 
 * Cette configuration permet de lancer deux applications distinctes :
 * - amakifr : Port 9050 (https://amaki.fr)
 * - hitombacom : Port 9051 (https://hitomba.com)
 * 
 * Les applications sont déployées sur une VPS distante avec Nginx et Certbot.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js          # Démarrer toutes les applications
 *   pm2 start ecosystem.config.js --only amakifr  # Démarrer seulement amakifr
 *   pm2 start ecosystem.config.js --only hitombacom  # Démarrer seulement hitombacom
 *   pm2 stop ecosystem.config.js            # Arrêter toutes les applications
 *   pm2 reload ecosystem.config.js          # Recharger toutes les applications (zero-downtime)
 *   pm2 delete ecosystem.config.js          # Supprimer toutes les applications
 * 
 * Chemins de production sur la VPS:
 * - amakifr : /sites/amakifr
 * - hitombacom : /sites/hitombacom
 */

module.exports = {
  apps: [
    {
      name: 'amakifr',
      script: 'npm',
      args: ['run', 'start'],
      cwd: '/sites/amakifr',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 9060,
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_APP_URL: process.env.AMAKIFR_URL || 'https://amaki.fr',
      },
      // Options de redémarrage
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Logs
      error_file: '/sites/amakifr/logs/pm2-error.log',
      out_file: '/sites/amakifr/logs/pm2-out.log',
      log_file: '/sites/amakifr/logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Options de monitoring
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Health check
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
    {
      name: 'hitombacom',
      script: 'npm',
      args: ['run', 'start'],
      cwd: '/sites/hitombacom',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 9052,
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_APP_URL: process.env.HITOMBACOM_URL || 'https://hitomba.com',
      },
      // Options de redémarrage
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Logs
      error_file: '/sites/hitombacom/logs/pm2-error.log',
      out_file: '/sites/hitombacom/logs/pm2-out.log',
      log_file: '/sites/hitombacom/logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Options de monitoring
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Health check
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
    {
      name: 'naxhelfr',
      script: 'npm',
      args: ['run', 'start'],
      cwd: '/sites/naxhelfr',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 9065,
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_APP_URL: process.env.NAXHELFR_URL || 'https://naxhel.fr',
      },
      // Options de redémarrage
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      
      // Logs
      error_file: '/sites/naxhelfr/logs/pm2-error.log',
      out_file: '/sites/naxhelfr/logs/pm2-out.log',
      log_file: '/sites/naxhelfr/logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Options de monitoring
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000,
      
      // Health check
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};

