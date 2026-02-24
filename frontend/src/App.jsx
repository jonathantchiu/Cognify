import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [view, setView] = useState('list')
  const [notes, setNotes] = useState([])
  const [selectedNote, setSelectedNote] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [checkedNotes, setCheckedNotes] = useState(new Set())
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [listTab, setListTab] = useState('notes')
  const [selectMode, setSelectMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')

  const [activeTab, setActiveTab] = useState('flashcards')
  const [flashcards, setFlashcards] = useState(null)
  const [flashcardsLoading, setFlashcardsLoading] = useState(false)
  const [quiz, setQuiz] = useState(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [selectedAnswers, setSelectedAnswers] = useState({})
  const [revealedAnswers, setRevealedAnswers] = useState({})
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)

  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [flashcardStudyMode, setFlashcardStudyMode] = useState(false)

  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light')
  const [editingNote, setEditingNote] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const handleKeyDown = (e) => {
      const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (inInput && !['Escape'].includes(e.key)) return

      if (e.key === 'Escape') {
        if (editingNote) {
          setEditingNote(false)
          e.preventDefault()
        } else if (view === 'detail' || view === 'group-detail') {
          setView('list')
          e.preventDefault()
        }
        return
      }

      if (view === 'detail' && selectedNote && e.key.toLowerCase() === 'e' && !inInput) {
        if (editingNote) setEditingNote(false)
        else { setEditTitle(selectedNote.title); setEditContent(selectedNote.content); setEditingNote(true) }
        e.preventDefault()
        return
      }

      if (flashcardStudyMode && flashcards?.length > 0) {
        if (e.key === 'ArrowLeft') {
          setCurrentCardIndex((i) => Math.max(0, i - 1))
          setIsFlipped(false)
          e.preventDefault()
        } else if (e.key === 'ArrowRight') {
          setCurrentCardIndex((i) => Math.min(flashcards.length - 1, i + 1))
          setIsFlipped(false)
          e.preventDefault()
        } else if ((e.key === ' ' || e.key === 'Enter') && !inInput) {
          setIsFlipped((f) => !f)
          e.preventDefault()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [view, selectedNote, editingNote, flashcardStudyMode, flashcards?.length])

  const isGroupDetail = view === 'group-detail'
  const apiBase = isGroupDetail
    ? `/api/groups/${selectedGroup?.id}`
    : `/api/notes/${selectedNote?.id}`

  const fetchNotes = async () => {
    setError('')
    try {
      const res = await fetch('/api/notes')
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setNotes(await res.json())
    } catch (e) {
      setError(e.message)
    }
  }

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups')
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setGroups(await res.json())
    } catch (e) {
      setError(e.message)
    }
  }

  const createNote = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setTitle('')
      setContent('')
      await fetchNotes()
      setView('list')
    } catch (e) {
      setError(e.message)
    }
  }

  const deleteNote = async (noteId, ev) => {
    if (ev) ev.stopPropagation()
    if (!window.confirm('Delete this note? This will also remove its flashcards, quizzes, and study plans.')) return
    setError('')
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      if (view === 'detail' && selectedNote?.id === noteId) {
        setSelectedNote(null)
        setView('list')
      }
      await fetchNotes()
      await fetchGroups()
    } catch (e) {
      setError(e.message)
    }
  }

  const openNote = async (noteId) => {
    setError('')
    resetStudyTools()
    setEditingNote(false)
    try {
      const res = await fetch(`/api/notes/${noteId}`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const note = await res.json()
      setSelectedNote(note)
      setEditTitle(note.title)
      setEditContent(note.content)
      setView('detail')
      await loadSavedStudyTools(`/api/notes/${noteId}`)
    } catch (e) {
      setError(e.message)
    }
  }

  const updateNote = async (e) => {
    e.preventDefault()
    if (!selectedNote) return
    setError('')
    try {
      const res = await fetch(`/api/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      const updated = await res.json()
      setSelectedNote(updated)
      setEditingNote(false)
      await fetchNotes()
      await fetchGroups()
    } catch (e) {
      setError(e.message)
    }
  }

  const toggleCheck = (noteId) => {
    setCheckedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(noteId)) next.delete(noteId)
      else next.add(noteId)
      return next
    })
  }

  const createGroup = async (e) => {
    e.preventDefault()
    if (!groupName.trim()) return
    setError('')
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName.trim(), note_ids: [...checkedNotes] }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || `Request failed (${res.status})`)
      }
      setCheckedNotes(new Set())
      setGroupName('')
      setShowGroupForm(false)
      await fetchGroups()
    } catch (e) {
      setError(e.message)
    }
  }

  const openGroup = async (groupId) => {
    setError('')
    resetStudyTools()
    try {
      const res = await fetch(`/api/groups/${groupId}`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      setSelectedGroup(await res.json())
      setView('group-detail')
      await loadSavedStudyTools(`/api/groups/${groupId}`)
    } catch (e) {
      setError(e.message)
    }
  }

  const deleteGroup = async (groupId, ev) => {
    if (ev) ev.stopPropagation()
    if (!window.confirm('Ungroup these notes? The notes themselves will not be deleted.')) return
    setError('')
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      if (view === 'group-detail' && selectedGroup?.id === groupId) {
        setSelectedGroup(null)
        setView('list')
      }
      await fetchGroups()
    } catch (e) {
      setError(e.message)
    }
  }

  const resetStudyTools = () => {
    setFlashcards(null)
    setQuiz(null)
    setPlan(null)
    setSelectedAnswers({})
    setRevealedAnswers({})
    setActiveTab('flashcards')
    setCurrentCardIndex(0)
    setIsFlipped(false)
    setFlashcardStudyMode(false)
  }

  const loadSavedStudyTools = async (base) => {
    const tryFetch = async (url, setter) => {
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        setter(data)
      } catch { /* no saved data */ }
    }

    await Promise.all([
      tryFetch(`${base}/flashcards/latest`, (data) => setFlashcards(data.flashcards)),
      tryFetch(`${base}/quiz/latest`, (data) => setQuiz(data.quiz)),
      tryFetch(`${base}/study-plan/latest`, (data) => setPlan(data.plan)),
    ])
  }

  const parseErrorResponse = async (res) => {
    const text = await res.text()
    try {
      const err = JSON.parse(text)
      const d = err.detail
      if (typeof d === 'string') return d
      if (Array.isArray(d) && d[0]?.msg) return d.map((e) => e.msg).join('; ')
      return text || `Request failed (${res.status})`
    } catch {
      return text || `Request failed (${res.status})`
    }
  }

  const generateFlashcards = async () => {
    setFlashcardsLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiBase}/flashcards`, { method: 'POST' })
      if (!res.ok) {
        throw new Error(await parseErrorResponse(res))
      }
      const data = await res.json()
      setFlashcards(data.flashcards)
      setCurrentCardIndex(0)
      setIsFlipped(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setFlashcardsLoading(false)
    }
  }

  const generateQuiz = async () => {
    setQuizLoading(true)
    setError('')
    setSelectedAnswers({})
    setRevealedAnswers({})
    try {
      const res = await fetch(`${apiBase}/quiz`, { method: 'POST' })
      if (!res.ok) {
        throw new Error(await parseErrorResponse(res))
      }
      const data = await res.json()
      setQuiz(data.quiz)
    } catch (e) {
      setError(e.message)
    } finally {
      setQuizLoading(false)
    }
  }

  const generatePlan = async () => {
    setPlanLoading(true)
    setError('')
    try {
      const res = await fetch(`${apiBase}/study-plan`, { method: 'POST' })
      if (!res.ok) {
        throw new Error(await parseErrorResponse(res))
      }
      const data = await res.json()
      setPlan(data.plan)
    } catch (e) {
      setError(e.message)
    } finally {
      setPlanLoading(false)
    }
  }

  const selectAnswer = (qi, choice) => {
    if (revealedAnswers[qi]) return
    setSelectedAnswers((prev) => ({ ...prev, [qi]: choice }))
  }

  const revealAnswer = (qi) => {
    setRevealedAnswers((prev) => ({ ...prev, [qi]: true }))
  }

  useEffect(() => {
    fetchNotes()
    fetchGroups()
  }, [])

  const renderStudyTabs = () => (
    <>
      <div className="tabs">
        <button
          className={`tab${activeTab === 'flashcards' ? ' active' : ''}`}
          onClick={() => setActiveTab('flashcards')}
        >
          Flashcards
        </button>
        <button
          className={`tab${activeTab === 'quiz' ? ' active' : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          Quiz
        </button>
        <button
          className={`tab${activeTab === 'plan' ? ' active' : ''}`}
          onClick={() => setActiveTab('plan')}
        >
          Plan
        </button>
      </div>

      {activeTab === 'flashcards' && (
        <div className="tab-content">
          {!flashcards && (
            <button className="btn btn-primary" onClick={generateFlashcards} disabled={flashcardsLoading}>
              {flashcardsLoading ? 'Generating\u2026' : 'Generate Flashcards'}
            </button>
          )}

          {flashcards && flashcards.length === 0 && <p className="empty">No flashcards returned.</p>}

          {flashcards && flashcards.length > 0 && !flashcardStudyMode && (
            <div className="set-card">
              <div className="set-card-top">
                <div className="set-card-info">
                  <span className="set-card-badge">{flashcards.length} cards</span>
                  <h3 className="set-card-title">
                    {isGroupDetail ? selectedGroup?.name : selectedNote?.title}
                  </h3>
                  <span className="set-card-meta">Flashcard set &middot; Ready to study</span>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => { setFlashcardStudyMode(true); setCurrentCardIndex(0); setIsFlipped(false) }}
                >
                  Preview
                </button>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => { setFlashcards(null); setCurrentCardIndex(0); setIsFlipped(false); setFlashcardStudyMode(false) }}
              >
                Regenerate
              </button>
            </div>
          )}

          {flashcards && flashcards.length > 0 && flashcardStudyMode && (() => {
            const card = flashcards[currentCardIndex]
            const total = flashcards.length
            const isFirst = currentCardIndex === 0
            const isLast = currentCardIndex === total - 1

            return (
              <div className="flashcard-study">
                <div className="flashcard-progress">
                  <span>{currentCardIndex + 1} / {total}</span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFlashcardStudyMode(false)}
                  >
                    &larr; Back to set
                  </button>
                </div>

                <div
                  className={`flashcard-container${isFlipped ? ' flipped' : ''}`}
                  onClick={() => setIsFlipped((f) => !f)}
                >
                  <div className="flashcard-inner">
                    <div className="flashcard-face flashcard-front">
                      <div className="flashcard-content-area">
                        <span className="flashcard-label">Question</span>
                        <h3 className="flashcard-text">{card.question}</h3>
                      </div>
                      <div className="flashcard-action-strip">
                        <span>Tap to reveal answer</span>
                      </div>
                    </div>
                    <div className="flashcard-face flashcard-back">
                      <div className="flashcard-content-area">
                        <span className="flashcard-label">Answer</span>
                        <h3 className="flashcard-text">{card.answer}</h3>
                      </div>
                      <div className="flashcard-action-strip">
                        <span>Tap to see question</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flashcard-nav">
                  <button
                    className="btn btn-secondary"
                    disabled={isFirst}
                    onClick={() => { setCurrentCardIndex((i) => i - 1); setIsFlipped(false) }}
                  >
                    &larr; Previous
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={isLast}
                    onClick={() => { setCurrentCardIndex((i) => i + 1); setIsFlipped(false) }}
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'quiz' && (
        <div className="tab-content">
          <button className="btn btn-primary" onClick={generateQuiz} disabled={quizLoading}>
            {quizLoading ? 'Generating\u2026' : 'Generate Quiz'}
          </button>

          {quiz && quiz.length === 0 && <p className="empty">No quiz questions returned.</p>}

          {quiz && quiz.length > 0 && (() => {
            const letterIndex = { a: 0, b: 1, c: 2, d: 3 }
            const normalize = (s) => s?.replace(/^[A-Da-d][.):\s]+/, '').trim().toLowerCase()
            const findCorrectChoice = (q) => {
              if (q.choices.includes(q.answer)) return q.answer
              const idx = letterIndex[q.answer?.trim().toLowerCase()]
              if (idx !== undefined && q.choices[idx]) return q.choices[idx]
              const norm = normalize(q.answer)
              const found = q.choices.find((c) => normalize(c) === norm)
              if (found) return found
              return q.choices[0]
            }
            return (
              <div className="card-stack" style={{ marginTop: '1rem' }}>
                {quiz.map((q, qi) => {
                  const picked = selectedAnswers[qi]
                  const revealed = revealedAnswers[qi]
                  const correctChoice = findCorrectChoice(q)
                  const isCorrect = picked === correctChoice

                  return (
                    <div key={qi} className="card">
                      <p className="quiz-question">{qi + 1}. {q.question}</p>

                      <div className="choices">
                        {q.choices.map((choice) => {
                          let cls = 'choice'
                          if (picked === choice && !revealed) cls += ' selected'
                          if (revealed && choice === correctChoice) cls += ' correct'
                          if (revealed && picked === choice && !isCorrect) cls += ' wrong'

                          return (
                            <button
                              key={choice}
                              className={cls}
                              onClick={() => selectAnswer(qi, choice)}
                              disabled={revealed}
                            >
                              {choice}
                            </button>
                          )
                        })}
                      </div>

                      {picked && !revealed && (
                        <button className="btn btn-secondary" onClick={() => revealAnswer(qi)}>
                          Show Answer
                        </button>
                      )}

                      {revealed && (
                        <p className={`quiz-result ${isCorrect ? 'correct' : 'wrong'}`}>
                          {isCorrect ? 'Correct!' : `Wrong \u2014 the answer is: ${correctChoice}`}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {activeTab === 'plan' && (
        <div className="tab-content">
          <button className="btn btn-primary" onClick={generatePlan} disabled={planLoading}>
            {planLoading ? 'Generating\u2026' : 'Generate 7-Day Plan'}
          </button>

          {plan && plan.length === 0 && <p className="empty">No study plan returned.</p>}

          {plan && plan.length > 0 && (
            <div className="card-stack" style={{ marginTop: '1rem' }}>
              {plan.map((day) => (
                <div key={day.day} className="card">
                  <p className="plan-day">Day {day.day}: {day.focus}</p>
                  <ul className="plan-tasks">
                    {day.tasks.map((task, ti) => (
                      <li key={ti}>{task}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand" onClick={() => setView('list')} role="button" tabIndex={0}>
            <span className="topbar-logo">C</span>
            <div className="topbar-title">
              <span className="topbar-name">Cognify Notes</span>
              <span className="topbar-tagline">AI-powered study tools</span>
            </div>
          </div>
          <nav className="topbar-nav">
            <button
              className={`topbar-link${view === 'list' && listTab === 'notes' ? ' active' : ''}`}
              onClick={() => { setView('list'); setListTab('notes') }}
            >
              Notes
            </button>
            <button
              className={`topbar-link${view === 'list' && listTab === 'groups' ? ' active' : ''}`}
              onClick={() => { setView('list'); setListTab('groups') }}
            >
              Groups
            </button>
            <button
              className={`topbar-link${view === 'create' ? ' active' : ''}`}
              onClick={() => setView('create')}
            >
              + Create
            </button>
            <button
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '\u2600' : '\u{1F319}'}
            </button>
          </nav>
        </div>
      </header>
      <div className="topbar-spacer" />

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="error-dismiss" onClick={() => setError('')}>&times;</button>
        </div>
      )}

      {/* ── Create view ── */}
      {view === 'create' && (
        <section className="section">
          <h2>Create Note</h2>
          <form onSubmit={createNote} className="form">
            <label className="form-label">
              Title
              <input
                className="form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <label className="form-label">
              Content
              <textarea
                className="form-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary">Save Note</button>
          </form>
        </section>
      )}

      {/* ── Notes tab ── */}
      {view === 'list' && listTab === 'notes' && (() => {
        const q = searchQuery.toLowerCase()
        const filtered = q
          ? notes.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
          : notes
        const sorted = [...filtered].sort((a, b) => {
          if (sortOrder === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
          if (sortOrder === 'alpha') return a.title.localeCompare(b.title)
          return new Date(b.created_at) - new Date(a.created_at)
        })

        return (
        <section className="section">
          <div className="stats-bar">
            <div className="stat-card">
              <span className="stat-value">{notes.length}</span>
              <span className="stat-label">Notes</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{groups.length}</span>
              <span className="stat-label">Groups</span>
            </div>
          </div>

          <input
            type="text"
            className="search-bar"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="list-header">
            <h2>Notes</h2>
            <div className="list-header-actions">
              <div className="sort-group">
                {['newest', 'oldest', 'alpha'].map((key) => (
                  <button
                    key={key}
                    className={`sort-btn${sortOrder === key ? ' active' : ''}`}
                    onClick={() => setSortOrder(key)}
                  >
                    {key === 'newest' ? 'Newest' : key === 'oldest' ? 'Oldest' : 'A\u2013Z'}
                  </button>
                ))}
              </div>
              {selectMode && checkedNotes.size >= 2 && !showGroupForm && (
                <button className="btn btn-primary" onClick={() => setShowGroupForm(true)}>
                  Group ({checkedNotes.size})
                </button>
              )}
              <button
                className={`btn ${selectMode ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setSelectMode((m) => !m)
                  setCheckedNotes(new Set())
                  setShowGroupForm(false)
                  setGroupName('')
                }}
              >
                {selectMode ? 'Done' : 'Select'}
              </button>
            </div>
          </div>

          {showGroupForm && (
            <form onSubmit={createGroup} className="group-form">
              <input
                className="form-input"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                required
              />
              <button type="submit" className="btn btn-primary">Create Group</button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowGroupForm(false); setGroupName('') }}
              >
                Cancel
              </button>
            </form>
          )}

          {notes.length === 0 ? (
            <p className="empty">No notes yet. Create one to get started!</p>
          ) : sorted.length === 0 ? (
            <p className="empty">No notes match &ldquo;{searchQuery}&rdquo;</p>
          ) : (
            <div className="card-stack">
              {sorted.map((note) => (
                <div
                  key={note.id}
                  className="note-card"
                  onClick={() => selectMode ? toggleCheck(note.id) : openNote(note.id)}
                >
                  <div className="note-card-body">
                    {selectMode && (
                      <input
                        type="checkbox"
                        className="note-checkbox"
                        checked={checkedNotes.has(note.id)}
                        onChange={() => toggleCheck(note.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className="note-card-info">
                      <span className="note-card-title">{note.title}</span>
                      <span className="note-card-meta">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {selectMode && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => deleteNote(note.id, e)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        )
      })()}

      {/* ── Groups tab ── */}
      {view === 'list' && listTab === 'groups' && (
        <section className="section">
          <div className="list-header">
            <h2>Groups</h2>
          </div>

          {groups.length === 0 ? (
            <p className="empty">No groups yet. Select 2+ notes from the Notes tab to create a group.</p>
          ) : (
            <div className="card-stack">
              {groups.map((group) => (
                <div
                  key={group.id}
                  className="note-card group-card"
                  onClick={() => openGroup(group.id)}
                >
                  <div className="note-card-body">
                    <span className="group-icon">&#128194;</span>
                    <div className="note-card-info">
                      <span className="note-card-title">{group.name}</span>
                      <span className="note-card-meta">{group.notes.length} notes</span>
                    </div>
                  </div>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => deleteGroup(group.id, e)}
                  >
                    Ungroup
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Note detail view ── */}
      {view === 'detail' && selectedNote && (
        <section className="section">
          <div className="detail-header">
            <button className="btn btn-secondary" onClick={() => setView('list')}>
              &larr; Back
            </button>
            <div className="detail-header-actions">
              {!editingNote ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => { setEditTitle(selectedNote.title); setEditContent(selectedNote.content); setEditingNote(true) }}
                >
                  Edit
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => setEditingNote(false)}>
                  Cancel
                </button>
              )}
              <button className="btn btn-danger" onClick={() => deleteNote(selectedNote.id)}>
                Delete Note
              </button>
            </div>
          </div>
          {editingNote ? (
            <form onSubmit={updateNote} className="form">
              <label className="form-label">
                Title
                <input
                  className="form-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </label>
              <label className="form-label">
                Content
                <textarea
                  className="form-textarea"
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  required
                />
              </label>
              <button type="submit" className="btn btn-primary">Save</button>
            </form>
          ) : (
            <>
              <h2>{selectedNote.title}</h2>
              {renderStudyTabs()}
              <div className="content-block">{selectedNote.content}</div>
            </>
          )}
        </section>
      )}

      {/* ── Group detail view ── */}
      {view === 'group-detail' && selectedGroup && (
        <section className="section">
          <div className="detail-header">
            <button className="btn btn-secondary" onClick={() => setView('list')}>
              &larr; Back
            </button>
            <button className="btn btn-danger" onClick={() => deleteGroup(selectedGroup.id)}>
              Ungroup
            </button>
          </div>
          <h2>
            <span className="group-icon">&#128194;</span> {selectedGroup.name}
          </h2>
          <div className="group-notes-list">
            {selectedGroup.notes.map((note) => (
              <span key={note.id} className="group-note-chip">{note.title}</span>
            ))}
          </div>
          {renderStudyTabs()}
          <div className="content-block">
            {selectedGroup.notes.map((note, i) => (
              <div key={note.id}>
                {i > 0 && <hr className="content-divider" />}
                <h3>{note.title}</h3>
                <p>{note.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default App
