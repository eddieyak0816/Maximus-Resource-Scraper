-- Database setup for Maximus Resource Scraper
CREATE DATABASE IF NOT EXISTS maximus_scraper;
USE maximus_scraper;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sources table
CREATE TABLE IF NOT EXISTS sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT,
  url VARCHAR(500) NOT NULL,
  type ENUM('youtube', 'article', 'podcast', 'social', 'forum') NOT NULL,
  title VARCHAR(255),
  content TEXT,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Summaries table
CREATE TABLE IF NOT EXISTS summaries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_id INT,
  summary TEXT,
  key_points TEXT,
  timestamps TEXT,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Outputs table
CREATE TABLE IF NOT EXISTS outputs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  summary_id INT,
  type ENUM('podcast', 'video', 'document') NOT NULL,
  content TEXT,
  file_path VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE
);