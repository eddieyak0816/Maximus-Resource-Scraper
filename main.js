const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { Worker } = require('worker_threads');
require('dotenv').config();

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const startUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : `file://${path.join(__dirname, 'build/index.html')}`;
  mainWindow.loadURL(startUrl);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(path.join(__dirname, 'maximus_scraper.db'), (err) => {
      if (err) {
        console.error('Database opening error: ', err);
        reject(err);
      } else {
        console.log('Database connected');
        // Create tables
        db.serialize(() => {
          db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`);

          db.run(`CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            url TEXT NOT NULL,
            type TEXT CHECK(type IN ('youtube', 'article', 'podcast', 'social', 'forum')) NOT NULL,
            title TEXT,
            content TEXT,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
          )`);

          db.run(`CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER,
            summary TEXT,
            key_points TEXT,
            timestamps TEXT,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
          )`);

          db.run(`CREATE TABLE IF NOT EXISTS outputs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            summary_id INTEGER,
            type TEXT CHECK(type IN ('podcast', 'video', 'document')) NOT NULL,
            content TEXT,
            file_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (summary_id) REFERENCES summaries(id) ON DELETE CASCADE
          )`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
    });
  });
}

app.whenReady().then(async () => {
  await initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for database operations
ipcMain.handle('db-query', async (event, query, params) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(new Error(err.message));
      } else {
        resolve(rows);
      }
    });
  });
});

ipcMain.handle('db-run', async (event, query, params) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(new Error(err.message));
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
});

// IPC for content processing with worker threads
ipcMain.handle('process-content', async (event, contentData) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'contentProcessor.js'), {
      workerData: contentData
    });

    worker.on('message', async (result) => {
      if (result.error) {
        reject(new Error(result.error));
      } else {
        try {
          // Save to database
          await new Promise((res, rej) => {
            db.run('UPDATE sources SET content = ?, title = ? WHERE id = ?',
              [result.content, result.title, contentData.sourceId], function(err) {
              if (err) rej(err);
              else res();
            });
          });

          const summaryId = await new Promise((res, rej) => {
            db.run('INSERT INTO summaries (source_id, summary, key_points) VALUES (?, ?, ?)',
              [contentData.sourceId, result.summary, JSON.stringify(result.keyPoints)], function(err) {
              if (err) rej(err);
              else res(this.lastID);
            });
          });

          // Save podcast output if generated
          if (result.podcastPath) {
            await new Promise((res, rej) => {
              db.run('INSERT INTO outputs (summary_id, type, file_path) VALUES (?, ?, ?)',
                [summaryId, 'podcast', result.podcastPath], function(err) {
                if (err) rej(err);
                else res();
              });
            });
          }

          resolve({ summaryId, summary: result.summary, keyPoints: result.keyPoints, podcastPath: result.podcastPath });
        } catch (dbError) {
          reject(new Error(`Database error: ${dbError.message}`));
        }
      }
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
});