module.exports = {
  apps: [
    {
      name: 'jizhang-api',
      script: 'src/app.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '300M',
      kill_timeout: 5000,
      listen_timeout: 5000
    }
  ]
}
