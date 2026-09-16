import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import type {
  ChangeEvent,
  FormEvent,
} from 'react'

import ReactMarkdown from 'react-markdown'

import {
  ArrowRight,
  ArrowUp,
  BookOpenText,
  FileText,
  Files,
  FolderOpen,
  Highlighter,
  MessageSquareText,
  Paperclip,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  'http://127.0.0.1:8000'

type ChatMessage = {
  id: number
  role: 'user' | 'assistant'
  text: string
  source?: string
}

type UploadedDocument = {
  name: string
  size: number
  type: string
}

type UploadDocumentResult = {
  filename: string
  status: 'success' | 'failed'
  characters?: number
  chunks_created?: number
  error?: string
}

type UploadResponse = {
  message: string
  total_files: number
  successful: number
  failed: number
  documents: UploadDocumentResult[]
}

type AppView =
  | 'workspace'
  | 'documents'
  | 'search'
  | 'highlights'

type HighlightItem = {
  id: number
  text: string
  source?: string
  note: string
  createdAt: string
}

const quickPrompts = [
  'Summarize the key points',
  'What decisions are mentioned?',
  'Find dates and deadlines',
]

function formatFileSize(
  bytes: number
) {
  if (!bytes) {
    return '0 KB'
  }

  const kb = bytes / 1024

  if (kb < 1024) {
    return `${kb.toFixed(0)} KB`
  }

  return `${(
    kb / 1024
  ).toFixed(1)} MB`
}

export default function App() {
  const [
    activeView,
    setActiveView,
  ] =
    useState<AppView>(
      'workspace'
    )

  const [
    files,
    setFiles,
  ] =
    useState<File[]>([])

  const [
    documents,
    setDocuments,
  ] =
    useState<
      UploadedDocument[]
    >([])

  const [
    documentSearch,
    setDocumentSearch,
  ] =
    useState('')

  const [
    question,
    setQuestion,
  ] =
    useState('')

  const [
    isUploading,
    setIsUploading,
  ] =
    useState(false)

  const [
    isSending,
    setIsSending,
  ] =
    useState(false)

  const [
    status,
    setStatus,
  ] =
    useState(
      'Ready for your first document'
    )

  const [
    messages,
    setMessages,
  ] =
    useState<
      ChatMessage[]
    >([
      {
        id: 1,
        role: 'assistant',
        text:
          'Upload one or more PDF, DOCX, TXT, or CSV files and I’ll help you explore them.',
      },
    ])

  const [
    highlights,
    setHighlights,
  ] =
    useState<
      HighlightItem[]
    >(() => {
      try {
        const saved =
          localStorage.getItem(
            'papermind-highlights'
          )

        if (!saved) {
          return []
        }

        return JSON.parse(
          saved
        ) as HighlightItem[]
      } catch {
        return []
      }
    })

  const fileInputRef =
    useRef<HTMLInputElement>(
      null
    )

  useEffect(() => {
    localStorage.setItem(
      'papermind-highlights',
      JSON.stringify(
        highlights
      )
    )
  }, [highlights])

  const documentMeta =
    useMemo(() => {
      if (
        documents.length ===
        0
      ) {
        return null
      }

      const totalSize =
        documents.reduce(
          (
            total,
            document
          ) =>
            total +
            document.size,
          0
        )

      return `${
        documents.length
      } document${
        documents.length ===
        1
          ? ''
          : 's'
      } · ${formatFileSize(
        totalSize
      )}`
    }, [documents])

  const filteredDocuments =
    useMemo(() => {
      const query =
        documentSearch
          .trim()
          .toLowerCase()

      if (!query) {
        return documents
      }

      return documents.filter(
        (document) =>
          document.name
            .toLowerCase()
            .includes(query)
      )
    }, [
      documents,
      documentSearch,
    ])

  const chooseFile = (
    event:
      ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles =
      Array.from(
        event.target.files ??
          []
      )

    if (
      selectedFiles.length ===
      0
    ) {
      return
    }

    setFiles(
      selectedFiles
    )

    setStatus(
      `${
        selectedFiles.length
      } document${
        selectedFiles.length ===
        1
          ? ''
          : 's'
      } selected — ready to process`
    )
  }

  const removeSelectedFile =
    (
      indexToRemove:
        number
    ) => {
      setFiles(
        (current) =>
          current.filter(
            (
              _,
              index
            ) =>
              index !==
              indexToRemove
          )
      )
    }

  const uploadDocument =
    async () => {
      if (
        files.length === 0
      ) {
        fileInputRef.current?.click()
        return
      }

      setIsUploading(true)

      setStatus(
        'Reading documents…'
      )

      try {
        const formData =
          new FormData()

        files.forEach(
          (file) => {
            formData.append(
              'files',
              file
            )
          }
        )

        const response =
          await fetch(
            `${API_BASE_URL}/api/upload`,
            {
              method:
                'POST',
              body:
                formData,
            }
          )

        const data =
          (await response.json()) as UploadResponse

        if (
          !response.ok
        ) {
          throw new Error(
            'Document upload failed'
          )
        }

        const successfulNames =
          new Set(
            data.documents
              .filter(
                (
                  document
                ) =>
                  document.status ===
                  'success'
              )
              .map(
                (
                  document
                ) =>
                  document.filename
              )
          )

        const uploadedDocuments =
          files
            .filter(
              (
                file
              ) =>
                successfulNames.has(
                  file.name
                )
            )
            .map(
              (
                file
              ) => ({
                name:
                  file.name,
                size:
                  file.size,
                type:
                  file.type ||
                  'Document',
              })
            )

        setDocuments(
          (
            current
          ) => {
            const merged =
              [
                ...current,
                ...uploadedDocuments,
              ]

            return merged.filter(
              (
                document,
                index,
                array
              ) =>
                index ===
                array.findIndex(
                  (
                    item
                  ) =>
                    item.name ===
                    document.name
                )
            )
          }
        )

        setStatus(
          `${data.successful}/${data.total_files} documents indexed`
        )

        setMessages(
          (
            current
          ) => [
            ...current,
            {
              id:
                Date.now(),
              role:
                'assistant',
              text:
                data.successful >
                0
                  ? `${data.successful} document(s) are ready. You can now ask questions about all documents in this workspace.`
                  : 'No documents were processed successfully.',
            },
          ]
        )

        setFiles([])

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            ''
        }
      } catch (
        error
      ) {
        console.error(
          'UPLOAD ERROR:',
          error
        )

        setStatus(
          'Document upload failed'
        )

        setMessages(
          (
            current
          ) => [
            ...current,
            {
              id:
                Date.now(),
              role:
                'assistant',
              text:
                error instanceof
                Error
                  ? error.message
                  : 'Could not upload documents.',
            },
          ]
        )
      } finally {
        setIsUploading(
          false
        )
      }
    }

  const sendMessage =
    async (
      event?:
        FormEvent
    ) => {
      event?.preventDefault()

      const cleanQuestion =
        question.trim()

      if (
        !cleanQuestion ||
        isSending
      ) {
        return
      }

      if (
        documents.length ===
        0
      ) {
        setMessages(
          (
            current
          ) => [
            ...current,
            {
              id:
                Date.now(),
              role:
                'assistant',
              text:
                'Please upload at least one document first.',
            },
          ]
        )

        return
      }

      const userMessage:
        ChatMessage = {
        id:
          Date.now(),
        role:
          'user',
        text:
          cleanQuestion,
      }

      setMessages(
        (
          current
        ) => [
          ...current,
          userMessage,
        ]
      )

      setQuestion('')

      setIsSending(true)

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/chat`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify(
                  {
                    message:
                      cleanQuestion,

                    document_names:
                      documents.map(
                        (
                          document
                        ) =>
                          document.name
                      ),
                  }
                ),
            }
          )

        const data =
          await response.json()

        if (
          !response.ok
        ) {
          throw new Error(
            data?.detail ??
              data?.message ??
              'Chat request failed'
          )
        }

        setMessages(
          (
            current
          ) => [
            ...current,
            {
              id:
                Date.now() +
                1,
              role:
                'assistant',
              text:
                data.reply ??
                data.answer ??
                'I found relevant information in your documents.',
              source:
                data.source ??
                data.citation,
            },
          ]
        )
      } catch (
        error
      ) {
        setMessages(
          (
            current
          ) => [
            ...current,
            {
              id:
                Date.now() +
                1,
              role:
                'assistant',
              text:
                error instanceof
                Error
                  ? error.message
                  : 'Could not reach PaperMind AI.',
            },
          ]
        )
      } finally {
        setIsSending(
          false
        )
      }
    }

  const isMessageHighlighted =
    (
      message:
        ChatMessage
    ) => {
      return highlights.some(
        (
          highlight
        ) =>
          highlight.text ===
            message.text &&
          highlight.source ===
            message.source
      )
    }

  const saveHighlight =
    (
      message:
        ChatMessage
    ) => {
      if (
        !message.source
      ) {
        return
      }

      if (
        isMessageHighlighted(
          message
        )
      ) {
        return
      }

      const newHighlight:
        HighlightItem = {
        id:
          Date.now(),
        text:
          message.text,
        source:
          message.source,
        note:
          '',
        createdAt:
          new Date()
            .toLocaleString(),
      }

      setHighlights(
        (
          current
        ) => [
          newHighlight,
          ...current,
        ]
      )
    }

  const removeHighlight =
    (
      id:
        number
    ) => {
      setHighlights(
        (
          current
        ) =>
          current.filter(
            (
              highlight
            ) =>
              highlight.id !==
              id
          )
      )
    }

  const updateHighlightNote =
    (
      id:
        number,
      note:
        string
    ) => {
      setHighlights(
        (
          current
        ) =>
          current.map(
            (
              highlight
            ) =>
              highlight.id ===
              id
                ? {
                    ...highlight,
                    note,
                  }
                : highlight
          )
      )
    }

  const usePrompt = (
    prompt:
      string
  ) => {
    setQuestion(
      prompt
    )

    setActiveView(
      'workspace'
    )
  }

  const askDocument =
    (
      document:
        UploadedDocument
    ) => {
      setQuestion(
        `Tell me about ${document.name}`
      )

      setActiveView(
        'workspace'
      )
    }

  const openFilePicker =
    () => {
      setActiveView(
        'workspace'
      )

      window.setTimeout(
        () => {
          fileInputRef.current?.click()
        },
        100
      )
    }

  const pageTitle =
    activeView ===
    'workspace'
      ? 'PaperMind'
      : activeView ===
        'documents'
      ? 'Documents'
      : activeView ===
        'search'
      ? 'Search'
      : 'Highlights'

  return (
    <div className="app-shell">

      <aside className="rail">

        <button
          className="brand-mark"
          aria-label="PaperMind"
          type="button"
          onClick={() =>
            setActiveView(
              'workspace'
            )
          }
        >
          P
        </button>

        <nav className="rail-nav">

          <button
            className={`rail-button ${
              activeView ===
              'workspace'
                ? 'active'
                : ''
            }`}
            type="button"
            title="Workspace"
            onClick={() =>
              setActiveView(
                'workspace'
              )
            }
          >
            <BookOpenText
              size={20}
            />
          </button>

          <button
            className={`rail-button ${
              activeView ===
              'documents'
                ? 'active'
                : ''
            }`}
            type="button"
            title="Documents"
            onClick={() =>
              setActiveView(
                'documents'
              )
            }
          >
            <Files
              size={20}
            />
          </button>

          <button
            className={`rail-button ${
              activeView ===
              'search'
                ? 'active'
                : ''
            }`}
            type="button"
            title="Search"
            onClick={() =>
              setActiveView(
                'search'
              )
            }
          >
            <Search
              size={20}
            />
          </button>

          <button
            className={`rail-button ${
              activeView ===
              'highlights'
                ? 'active'
                : ''
            }`}
            type="button"
            title="Highlights"
            onClick={() =>
              setActiveView(
                'highlights'
              )
            }
          >
            <Highlighter
              size={20}
            />
          </button>

        </nav>

        <div className="rail-footer">
          <div className="avatar">
            A
          </div>
        </div>

      </aside>

      <main className="workspace">

        <header className="topbar">

          <div>
            <p className="eyebrow">
              AI DOCUMENT WORKSPACE
            </p>

            <h1>
              {pageTitle}
            </h1>
          </div>

          <div className="status-pill">
            <span className="status-dot" />
            {status}
          </div>

        </header>

        {activeView ===
          'workspace' && (
          <>

            <section className="hero-grid">

              <div className="hero-copy">

                <span className="mini-tag">
                  <Sparkles
                    size={15}
                  />

                  built for focused reading
                </span>

                <h2>
                  Turn long
                  documents into{' '}
                  <em>
                    clear answers.
                  </em>
                </h2>

                <p>
                  Upload your
                  material, ask a
                  question, and trace
                  every useful answer
                  back to the
                  document.
                </p>

              </div>

              <div className="upload-card">

                <div className="paper-corner" />

                <div className="upload-icon">
                  <UploadCloud
                    size={28}
                  />
                </div>

                <h3>
                  Drop in documents
                </h3>

                <p>
                  PDF, DOCX, TXT or
                  CSV · multiple
                  files supported
                </p>

                <input
                  ref={
                    fileInputRef
                  }
                  type="file"
                  accept=".pdf,.docx,.txt,.csv"
                  multiple
                  onChange={
                    chooseFile
                  }
                  hidden
                />

                <button
                  className="browse-button"
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  <FolderOpen
                    size={17}
                  />
                  Choose files
                </button>

                {files.length >
                  0 && (
                  <div className="selected-files">

                    {files.map(
                      (
                        file,
                        index
                      ) => (
                        <div
                          className="selected-file"
                          key={`${file.name}-${file.size}-${index}`}
                        >
                          <FileText
                            size={18}
                          />

                          <div className="selected-file-copy">
                            <strong>
                              {
                                file.name
                              }
                            </strong>

                            <span>
                              {formatFileSize(
                                file.size
                              )}
                            </span>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            onClick={() =>
                              removeSelectedFile(
                                index
                              )
                            }
                          >
                            <X
                              size={16}
                            />
                          </button>
                        </div>
                      )
                    )}

                  </div>
                )}

                <button
                  className="process-button"
                  type="button"
                  disabled={
                    isUploading ||
                    files.length ===
                      0
                  }
                  onClick={
                    uploadDocument
                  }
                >
                  {isUploading
                    ? 'Processing…'
                    : files.length >
                      0
                    ? `Process ${
                        files.length
                      } document${
                        files.length ===
                        1
                          ? ''
                          : 's'
                      }`
                    : 'Process documents'}

                  <ArrowUp
                    size={17}
                  />
                </button>

              </div>

            </section>

            <section className="content-grid">

              <div className="document-panel">

                <div className="section-heading">

                  <div>
                    <p className="eyebrow">
                      CURRENT DOCUMENTS
                    </p>

                    <h3>
                      {documents.length >
                      0
                        ? `${
                            documents.length
                          } document${
                            documents.length ===
                            1
                              ? ''
                              : 's'
                          } ready`
                        : 'No document selected'}
                    </h3>
                  </div>

                  <FileText
                    size={21}
                  />

                </div>

                {documents.length >
                0 ? (
                  <div className="document-preview">

                    <div className="preview-sheet">

                      <div className="preview-lines">
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>

                      <div className="preview-highlight">
                        AI-ready documents
                      </div>

                      <div className="preview-lines short">
                        <span />
                        <span />
                        <span />
                      </div>

                    </div>

                    <div className="doc-details">

                      <strong>
                        Ready to explore
                      </strong>

                      <span>
                        {
                          documentMeta
                        }
                      </span>

                      <div className="workspace-doc-list">

                        {documents.map(
                          (
                            document
                          ) => (
                            <div
                              className="workspace-doc-item"
                              key={
                                document.name
                              }
                            >
                              <FileText
                                size={14}
                              />

                              <span>
                                {
                                  document.name
                                }
                              </span>
                            </div>
                          )
                        )}

                      </div>

                      <p>
                        PaperMind can
                        retrieve relevant
                        sections from all
                        documents in this
                        workspace.
                      </p>

                    </div>

                  </div>
                ) : (
                  <div className="empty-document">
                    <Paperclip
                      size={24}
                    />

                    <p>
                      Your processed
                      documents will
                      appear here.
                    </p>
                  </div>
                )}

                <div className="prompt-block">

                  <span>
                    Try asking
                  </span>

                  <div className="prompt-list">

                    {quickPrompts.map(
                      (
                        prompt
                      ) => (
                        <button
                          key={
                            prompt
                          }
                          type="button"
                          onClick={() =>
                            usePrompt(
                              prompt
                            )
                          }
                        >
                          {
                            prompt
                          }
                        </button>
                      )
                    )}

                  </div>

                </div>

              </div>

              <div className="chat-panel">

                <div className="chat-heading">

                  <div className="chat-icon">
                    <MessageSquareText
                      size={19}
                    />
                  </div>

                  <div>
                    <strong>
                      Ask the documents
                    </strong>

                    <span>
                      Grounded answers
                      with sources
                    </span>
                  </div>

                </div>

                <div className="messages">

                  {messages.map(
                    (
                      message
                    ) => (
                      <div
                        className={`message ${message.role}`}
                        key={
                          message.id
                        }
                      >

                        <div className="message-label">
                          {message.role ===
                          'assistant'
                            ? 'PaperMind'
                            : 'You'}
                        </div>

                        <div className="message-bubble markdown-content">
                          <ReactMarkdown>
                            {
                              message.text
                            }
                          </ReactMarkdown>
                        </div>

                        {message.source && (
                          <div className="source-chip">
                            <FileText
                              size={12}
                            />

                            <span>
                              {
                                message.source
                              }
                            </span>
                          </div>
                        )}

                        {message.role ===
                          'assistant' &&
                          Boolean(
                            message.source
                          ) && (
                          <div className="message-actions">

                            <button
                              type="button"
                              className={`highlight-action ${
                                isMessageHighlighted(
                                  message
                                )
                                  ? 'saved'
                                  : ''
                              }`}
                              disabled={
                                isMessageHighlighted(
                                  message
                                )
                              }
                              onClick={() =>
                                saveHighlight(
                                  message
                                )
                              }
                            >
                              <Highlighter
                                size={14}
                              />

                              <span>
                                {isMessageHighlighted(
                                  message
                                )
                                  ? 'Saved to highlights'
                                  : 'Save highlight'}
                              </span>
                            </button>

                          </div>
                        )}

                      </div>
                    )
                  )}

                  {isSending && (
                    <div className="message assistant">

                      <div className="message-label">
                        PaperMind
                      </div>

                      <div className="message-bubble typing">
                        <span />
                        <span />
                        <span />
                      </div>

                    </div>
                  )}

                </div>

                <form
                  className="composer"
                  onSubmit={
                    sendMessage
                  }
                >
                  <textarea
                    value={
                      question
                    }
                    rows={2}
                    placeholder="Ask something about your documents…"
                    onChange={(
                      event
                    ) =>
                      setQuestion(
                        event.target
                          .value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                          'Enter' &&
                        !event.shiftKey
                      ) {
                        event.preventDefault()
                        sendMessage()
                      }
                    }}
                  />

                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={
                      !question.trim() ||
                      isSending
                    }
                  >
                    <ArrowUp
                      size={18}
                    />
                  </button>

                </form>

              </div>

            </section>

          </>
        )}

        {activeView ===
          'documents' && (
          <section className="page-view">

            <div className="page-view-header">

              <div>
                <p className="eyebrow">
                  DOCUMENT LIBRARY
                </p>

                <h2>
                  Your documents
                </h2>

                <p>
                  Everything currently
                  available in this
                  PaperMind workspace.
                </p>
              </div>

              <button
                type="button"
                className="page-primary-button"
                onClick={
                  openFilePicker
                }
              >
                <UploadCloud
                  size={17}
                />
                Add documents
              </button>

            </div>

            <div className="document-stats">

              <div className="stat-card">
                <span>
                  Total documents
                </span>

                <strong>
                  {
                    documents.length
                  }
                </strong>
              </div>

              <div className="stat-card">
                <span>
                  Workspace status
                </span>

                <strong>
                  {documents.length >
                  0
                    ? 'Ready'
                    : 'Empty'}
                </strong>
              </div>

              <div className="stat-card">
                <span>
                  Total size
                </span>

                <strong>
                  {formatFileSize(
                    documents.reduce(
                      (
                        total,
                        document
                      ) =>
                        total +
                        document.size,
                      0
                    )
                  )}
                </strong>
              </div>

            </div>

            {documents.length >
            0 ? (
              <div className="documents-page-grid">

                {documents.map(
                  (
                    document,
                    index
                  ) => (
                    <article
                      className="document-library-card"
                      key={`${document.name}-${index}`}
                    >
                      <div className="library-file-icon">
                        <FileText
                          size={22}
                        />
                      </div>

                      <div className="library-file-info">
                        <strong>
                          {
                            document.name
                          }
                        </strong>

                        <span>
                          {formatFileSize(
                            document.size
                          )}
                        </span>

                        <small>
                          Indexed and ready
                          for questions
                        </small>
                      </div>

                      <button
                        type="button"
                        className="ask-file-button"
                        onClick={() =>
                          askDocument(
                            document
                          )
                        }
                      >
                        Ask
                      </button>
                    </article>
                  )
                )}

              </div>
            ) : (
              <div className="page-empty-state">

                <div className="page-empty-icon">
                  <Files
                    size={30}
                  />
                </div>

                <h3>
                  No documents yet
                </h3>

                <p>
                  Upload documents from
                  your workspace and
                  they will appear here.
                </p>

                <button
                  type="button"
                  onClick={
                    openFilePicker
                  }
                >
                  Add document
                </button>

              </div>
            )}

          </section>
        )}

        {activeView ===
          'search' && (
          <section className="page-view">

            <div className="page-view-header">
              <div>
                <p className="eyebrow">
                  DOCUMENT SEARCH
                </p>

                <h2>
                  Find what you need
                </h2>

                <p>
                  Search documents
                  available in your
                  current workspace.
                </p>
              </div>
            </div>

            <div className="document-search-box">

              <Search
                size={20}
              />

              <input
                type="text"
                value={
                  documentSearch
                }
                placeholder="Search document names…"
                onChange={(
                  event
                ) =>
                  setDocumentSearch(
                    event.target.value
                  )
                }
              />

              {documentSearch && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() =>
                    setDocumentSearch(
                      ''
                    )
                  }
                >
                  <X
                    size={17}
                  />
                </button>
              )}

            </div>

            <div className="search-info-row">
              <span>
                {
                  filteredDocuments.length
                }{' '}
                result
                {filteredDocuments.length ===
                1
                  ? ''
                  : 's'}
              </span>

              <span>
                Current workspace
              </span>
            </div>

            {filteredDocuments.length >
            0 ? (
              <div className="search-results">

                {filteredDocuments.map(
                  (
                    document,
                    index
                  ) => (
                    <button
                      type="button"
                      className="search-result-card"
                      key={`${document.name}-${index}`}
                      onClick={() =>
                        askDocument(
                          document
                        )
                      }
                    >
                      <div className="search-result-icon">
                        <FileText
                          size={20}
                        />
                      </div>

                      <div className="search-result-copy">
                        <strong>
                          {
                            document.name
                          }
                        </strong>

                        <span>
                          {formatFileSize(
                            document.size
                          )}
                        </span>
                      </div>

                      <ArrowRight
                        size={17}
                      />
                    </button>
                  )
                )}

              </div>
            ) : (
              <div className="page-empty-state compact">
                <Search
                  size={30}
                />

                <h3>
                  No matching documents
                </h3>

                <p>
                  Try another filename
                  or upload more
                  documents.
                </p>
              </div>
            )}

            <div className="future-feature-note">
              <Sparkles
                size={17}
              />

              <div>
                <strong>
                  Semantic search
                </strong>

                <p>
                  This page currently
                  searches document
                  filenames.
                </p>
              </div>
            </div>

          </section>
        )}

        {activeView ===
          'highlights' && (
          <section className="page-view">

            <div className="page-view-header">
              <div>
                <p className="eyebrow">
                  SAVED INSIGHTS
                </p>

                <h2>
                  Highlights
                </h2>

                <p>
                  Save useful answers,
                  findings and your
                  personal notes.
                </p>
              </div>
            </div>

            <div className="highlight-intro-card">

              <div className="highlight-big-icon">
                <Highlighter
                  size={24}
                />
              </div>

              <div className="highlight-intro-copy">
                <span>
                  PERSONAL KNOWLEDGE SPACE
                </span>

                <h3>
                  Keep the important parts.
                </h3>

                <p>
                  Save useful PaperMind
                  answers while exploring
                  your documents.
                </p>
              </div>

              <div className="highlight-total">
                <strong>
                  {
                    highlights.length
                  }
                </strong>

                <span>
                  saved
                </span>
              </div>

            </div>

            <div className="highlight-page-grid">

              <div className="highlights-main">

                <div className="highlight-section-heading">

                  <div>
                    <span>
                      SAVED ANSWERS
                    </span>

                    <h3>
                      Your highlights
                    </h3>
                  </div>

                  <small>
                    {
                      highlights.length
                    }{' '}
                    saved
                  </small>

                </div>

                {highlights.length ===
                0 ? (
                  <div className="highlight-empty">

                    <div className="highlight-empty-icon">
                      <Highlighter
                        size={26}
                      />
                    </div>

                    <h3>
                      No highlights yet
                    </h3>

                    <p>
                      Ask PaperMind a
                      question and save
                      an answer from the
                      workspace.
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveView(
                          'workspace'
                        )
                      }
                    >
                      Go to workspace
                    </button>

                  </div>
                ) : (
                  <div className="saved-highlights-list">

                    {highlights.map(
                      (
                        highlight
                      ) => (
                        <article
                          className="saved-highlight-card"
                          key={
                            highlight.id
                          }
                        >

                          <div className="saved-highlight-header">

                            <div className="saved-highlight-title">

                              <div className="saved-highlight-icon">
                                <Highlighter
                                  size={16}
                                />
                              </div>

                              <div>
                                <strong>
                                  Saved insight
                                </strong>

                                <span>
                                  {
                                    highlight.createdAt
                                  }
                                </span>
                              </div>

                            </div>

                            <button
                              type="button"
                              className="delete-highlight"
                              aria-label="Delete highlight"
                              title="Delete highlight"
                              onClick={() =>
                                removeHighlight(
                                  highlight.id
                                )
                              }
                            >
                              <Trash2
                                size={16}
                              />
                            </button>

                          </div>

                          <div className="saved-highlight-content">
                            <ReactMarkdown>
                              {
                                highlight.text
                              }
                            </ReactMarkdown>
                          </div>

                          {highlight.source && (
                            <div className="highlight-source">
                              <FileText
                                size={13}
                              />

                              <span>
                                {
                                  highlight.source
                                }
                              </span>
                            </div>
                          )}

                          <div className="highlight-note-area">

                            <label>
                              <StickyNote
                                size={14}
                              />
                              Personal note
                            </label>

                            <textarea
                              rows={3}
                              value={
                                highlight.note
                              }
                              placeholder="Add your own note..."
                              onChange={(
                                event
                              ) =>
                                updateHighlightNote(
                                  highlight.id,
                                  event.target
                                    .value
                                )
                              }
                            />

                          </div>

                        </article>
                      )
                    )}

                  </div>
                )}

              </div>

              <aside className="highlight-documents-panel">

                <div className="highlight-documents-heading">

                  <div>
                    <span>
                      WORKSPACE
                    </span>

                    <h3>
                      Documents
                    </h3>
                  </div>

                  <div className="document-count-badge">
                    {
                      documents.length
                    }
                  </div>

                </div>

                <p className="highlight-documents-description">
                  All documents
                  currently available
                  to PaperMind.
                </p>

                {documents.length >
                0 ? (
                  <div className="highlight-document-list">

                    {documents.map(
                      (
                        document,
                        index
                      ) => (
                        <button
                          type="button"
                          className="highlight-document-item"
                          key={`${document.name}-${index}`}
                          onClick={() =>
                            askDocument(
                              document
                            )
                          }
                        >
                          <div className="highlight-document-icon">
                            <FileText
                              size={18}
                            />
                          </div>

                          <div className="highlight-document-info">
                            <strong>
                              {
                                document.name
                              }
                            </strong>

                            <span>
                              {formatFileSize(
                                document.size
                              )}
                            </span>
                          </div>

                          <ArrowRight
                            size={16}
                          />
                        </button>
                      )
                    )}

                  </div>
                ) : (
                  <div className="highlight-documents-empty">
                    <Files
                      size={24}
                    />

                    <span>
                      No documents
                      uploaded
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  className="highlight-add-document"
                  onClick={
                    openFilePicker
                  }
                >
                  <UploadCloud
                    size={16}
                  />

                  Add document
                </button>

              </aside>

            </div>

          </section>
        )}

      </main>

    </div>
  )
}