import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [sources, setSources] = useState([]);
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceType, setNewSourceType] = useState('article');
  const [summaries, setSummaries] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [editingSourceId, setEditingSourceId] = useState(null);
  const [editUrl, setEditUrl] = useState('');
  const [editType, setEditType] = useState('article');
  const [selectedModel, setSelectedModel] = useState('meta-llama/llama-3-8b-instruct');

  const loadProjects = async () => {
    try {
      const result = await window.electronAPI.dbQuery('SELECT * FROM projects');
      setProjects(result);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const loadSources = async (projectId) => {
    try {
      const result = await window.electronAPI.dbQuery('SELECT * FROM sources WHERE project_id = ?', [projectId]);
      setSources(result);
      // Load summaries for these sources
      const sourceIds = result.map(s => s.id);
      if (sourceIds.length > 0) {
        const summariesResult = await window.electronAPI.dbQuery('SELECT * FROM summaries WHERE source_id IN (' + sourceIds.map(() => '?').join(',') + ')', sourceIds);
        setSummaries(summariesResult);
        
        // Load outputs for these summaries
        const summaryIds = summariesResult.map(s => s.id);
        if (summaryIds.length > 0) {
          const outputsResult = await window.electronAPI.dbQuery('SELECT * FROM outputs WHERE summary_id IN (' + summaryIds.map(() => '?').join(',') + ')', summaryIds);
          setOutputs(outputsResult);
        } else {
          setOutputs([]);
        }
      } else {
        setSummaries([]);
        setOutputs([]);
      }
    } catch (error) {
      console.error('Failed to load sources:', error);
    }
  };

  useEffect(() => {
    // Load projects from database
    loadProjects();
  }, []);

  const deleteSource = async (sourceId) => {
    try {
      await window.electronAPI.dbRun('DELETE FROM sources WHERE id = ?', [sourceId]);
      loadSources(currentProject.id);
    } catch (error) {
      console.error('Failed to delete source:', error);
    }
  };

  const startEdit = (source) => {
    setEditingSourceId(source.id);
    setEditUrl(source.url);
    setEditType(source.type);
  };

  const saveEdit = async () => {
    try {
      await window.electronAPI.dbRun('UPDATE sources SET url = ?, type = ? WHERE id = ?', [editUrl.trim(), editType, editingSourceId]);
      setEditingSourceId(null);
      loadSources(currentProject.id);
    } catch (error) {
      console.error('Failed to update source:', error);
    }
  };

  const cancelEdit = () => {
    setEditingSourceId(null);
  };

  const addSource = async () => {
    if (!newSourceUrl.trim() || !currentProject) return;
    try {
      await window.electronAPI.dbRun('INSERT INTO sources (project_id, url, type) VALUES (?, ?, ?)', [currentProject.id, newSourceUrl.trim(), newSourceType]);
      setNewSourceUrl('');
      loadSources(currentProject.id);
    } catch (error) {
      console.error('Failed to add source:', error);
    }
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    try {
      await window.electronAPI.dbRun('INSERT INTO projects (name) VALUES (?)', [newProjectName.trim()]);
      setNewProjectName('');
      loadProjects();
    } catch (error) {
      console.error('Failed to create project:', error);
    }
  };

  const processContent = async (sourceId, url, type) => {
    try {
      const result = await window.electronAPI.processContent({ sourceId, url, type, model: selectedModel });
      console.log('Processed content:', result);
      loadSources(currentProject.id); // Reload to show updated data
    } catch (error) {
      console.error('Failed to process content:', error);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Maximus Resource Scraper</h1>
        <p>Content Aggregation Research Tool</p>
        <div>
          <label>AI Model: </label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="meta-llama/llama-3-8b-instruct">Llama 3 8B (Free)</option>
            <option value="microsoft/wizardlm-2-8x22b">WizardLM 2 8x22B (Free)</option>
            <option value="google/gemini-flash-1.0">Gemini Flash 1.0 (Free)</option>
            <option value="mistralai/mistral-7b-instruct">Mistral 7B (Free)</option>
            <option value="openai/gpt-3.5-turbo">GPT-3.5 Turbo (Paid)</option>
            <option value="openai/gpt-4">GPT-4 (Paid)</option>
            <option value="anthropic/claude-3-haiku">Claude 3 Haiku (Paid)</option>
          </select>
        </div>
      </header>
      <main>
        <section>
          <h2>Projects</h2>
          <ul>
            {projects.map(project => (
              <li key={project.id} onClick={() => {
                setCurrentProject(project);
                loadSources(project.id);
              }}>
                {project.name}
              </li>
            ))}
          </ul>
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Enter project name"
          />
          <button onClick={createProject}>
            Create New Project
          </button>
        </section>
        {currentProject && (
          <section>
            <h2>{currentProject.name}</h2>
            <h3>Sources</h3>
            <ul>
              {sources.map(source => (
                <li key={source.id}>
                  {editingSourceId === source.id ? (
                    <div>
                      <input
                        type="url"
                        value={editUrl}
                        onChange={(e) => setEditUrl(e.target.value)}
                        placeholder="Enter source URL"
                      />
                      <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                        <option value="article">Article</option>
                        <option value="youtube">YouTube</option>
                        <option value="podcast">Podcast</option>
                        <option value="social">Social Media</option>
                        <option value="forum">Forum</option>
                      </select>
                      <button onClick={saveEdit}>Save</button>
                      <button onClick={cancelEdit}>Cancel</button>
                    </div>
                  ) : (
                    <div>
                      <strong>{source.title || source.type}</strong>: {source.url}
                      <button onClick={() => processContent(source.id, source.url, source.type)}>
                        Process
                      </button>
                      <button onClick={() => startEdit(source)}>
                        Edit
                      </button>
                      <button onClick={() => deleteSource(source.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <input
              type="url"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              placeholder="Enter source URL"
            />
            <select value={newSourceType} onChange={(e) => setNewSourceType(e.target.value)}>
              <option value="article">Article</option>
              <option value="youtube">YouTube</option>
              <option value="podcast">Podcast</option>
              <option value="social">Social Media</option>
              <option value="forum">Forum</option>
            </select>
            <button onClick={addSource}>
              Add Resource
            </button>
            <h3>Summaries</h3>
            <ul>
              {summaries.map(summary => {
                const summaryOutputs = outputs.filter(output => output.summary_id === summary.id);
                const podcastOutput = summaryOutputs.find(output => output.type === 'podcast');
                
                return (
                  <li key={summary.id}>
                    <div style={{whiteSpace: 'pre-wrap'}}>{summary.summary}</div>
                    <br />
                    <strong>Key Points:</strong>
                    <ul>
                      {JSON.parse(summary.key_points || '[]').map((point, index) => (
                        <li key={index}>{point}</li>
                      ))}
                    </ul>
                    {podcastOutput && (
                      <div>
                        <br />
                        <strong>Podcast Generated:</strong> 
                        <span style={{marginLeft: '10px', color: '#666'}}>
                          Audio file saved to: {podcastOutput.file_path.split('\\').pop()}
                        </span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;