-- Create the scheduler log table to track execution history
CREATE TABLE IF NOT EXISTS scheduler_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    scheduler_job_id INT UNSIGNED NOT NULL,
    run_time DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    FOREIGN KEY (scheduler_job_id) REFERENCES scheduler_job(id) ON DELETE CASCADE
);

-- Create notification table for SLA threshold alerts
CREATE TABLE IF NOT EXISTS notification (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NULL,
    message TEXT NOT NULL,
    sent_at DATETIME NOT NULL,
    status VARCHAR(50) NOT NULL
);

