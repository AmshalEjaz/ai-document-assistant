import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import ReactMarkdown from 'react-markdown'
import {
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
 UploadCloud,
 X,
} from "lucide-react";

const API_BASE_URL =
 import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";

type ChatMessage = {
 id: number;
 role: "user" | "assistant";
 text: string;
 source?: string;
};

type UploadedDocument = {
 name: string;
 size: number;
 type: string;
};

type UploadDocumentResult = {
 filename: string;
 status: "success" | "failed";
 characters?: number;
 chunks_created?: number;
 error?: string;
};

type UploadResponse = {
 message: string;
 total_files: number;
 successful: number;
 failed: number;
 documents: UploadDocumentResult[];
};

const quickPrompts = [
 "Summarize the key points",
 "What decisions are mentioned?",
 "Find dates and deadlines",
];

function formatFileSize(bytes: number) {
 if (!bytes) return "0 KB";

 const kb = bytes / 1024;

 if (kb < 1024) {
  return `${kb.toFixed(0)} KB`;
 }

 return `${(kb / 1024).toFixed(1)} MB`;
}

export default function App() {
 const [files, setFiles] = useState<File[]>([]);
 const [documents, setDocuments] = useState<UploadedDocument[]>([]);

 const [question, setQuestion] = useState("");
 const [isUploading, setIsUploading] = useState(false);

 const [isSending, setIsSending] = useState(false);

 const [status, setStatus] = useState("Ready for your first document");

 const [messages, setMessages] = useState<ChatMessage[]>([
  {
   id: 1,
   role: "assistant",
   text:
    "Upload one or more PDF, DOCX, or TXT files and I’ll help you explore them.",
  },
 ]);

 const fileInputRef = useRef<HTMLInputElement>(null);

 const documentMeta = useMemo(() => {
  if (documents.length === 0) {
   return null;
  }

  const totalSize = documents.reduce((sum, document) => sum + document.size, 0);

  return `${documents.length} document${
   documents.length > 1 ? "s" : ""
  } · ${formatFileSize(totalSize)}`;
 }, [documents]);

 const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
  const selectedFiles = Array.from(event.target.files ?? []);

  if (selectedFiles.length === 0) {
   return;
  }

  setFiles(selectedFiles);

  setStatus(
   `${selectedFiles.length} document${
    selectedFiles.length > 1 ? "s" : ""
   } selected — ready to process`,
  );
 };

 const removeSelectedFile = (indexToRemove: number) => {
  setFiles((current) => current.filter((_, index) => index !== indexToRemove));
 };

 const uploadDocument = async () => {
  if (files.length === 0) {
   fileInputRef.current?.click();
   return;
  }

  setIsUploading(true);
  setStatus("Reading documents…");

  try {
   const formData = new FormData();

   files.forEach((file) => {
    formData.append("files", file);
   });

   const response = await fetch(`${API_BASE_URL}/api/upload`, {
    method: "POST",
    body: formData,
   });

   const data = (await response.json()) as UploadResponse;

   if (!response.ok) {
    throw new Error("Document upload failed");
   }

   const successfulFileNames = new Set(
    data.documents
     .filter((item) => item.status === "success")
     .map((item) => item.filename),
   );

   const uploadedDocuments = files
    .filter((file) => successfulFileNames.has(file.name))
    .map((file) => ({
     name: file.name,
     size: file.size,
     type: file.type || "Document",
    }));

   setDocuments((current) => [
      ...current,
      ...uploadedDocuments,
    ]);
   setStatus(`${data.successful}/${data.total_files} documents indexed`);

   setMessages((current) => [
    ...current,
    {
     id: Date.now(),
     role: "assistant",
     text:
      data.successful > 0
       ? `${data.successful} document(s) are ready. You can now ask questions about them.`
       : "No documents were processed successfully.",
    },
   ]);

   setFiles([]);

   if (fileInputRef.current) {
    fileInputRef.current.value = "";
   }
  } catch (error) {
   console.error("UPLOAD ERROR:", error);

   setStatus("Document upload failed");

   setMessages((current) => [
    ...current,
    {
     id: Date.now(),
     role: "assistant",
     text:
      error instanceof Error ? error.message : "Could not upload documents.",
    },
   ]);
  } finally {
   setIsUploading(false);
  }
 };

 const sendMessage = async (event?: FormEvent) => {
  event?.preventDefault();

  const cleanQuestion = question.trim();

  if (!cleanQuestion || isSending) {
   return;
  }

  if (documents.length === 0) {
   setMessages((current) => [
    ...current,
    {
     id: Date.now(),
     role: "assistant",
     text: "Please upload and process at least one document first.",
    },
   ]);

   return;
  }

  const userMessage: ChatMessage = {
   id: Date.now(),
   role: "user",
   text: cleanQuestion,
  };

  setMessages((current) => [...current, userMessage]);

  setQuestion("");
  setIsSending(true);

  try {
   const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",

    headers: {
     "Content-Type": "application/json",
    },

    body: JSON.stringify({
     message: cleanQuestion,

     document_names: documents.map((document) => document.name),
    }),
   });

   let data;

   try {
    data = await response.json();
   } catch {
    throw new Error(`Backend returned status ${response.status}`);
   }

   console.log("CHAT RESPONSE:", data);

   if (!response.ok) {
    throw new Error(
     data.detail ?? data.message ?? `Chat request failed (${response.status})`,
    );
   }

   const answer = data.answer ?? data.reply ?? "No answer returned.";

   let source: string | undefined;

   if (Array.isArray(data.source)) {
    source = data.source.join(", ");
   } else {
    source = data.source ?? data.citation ?? undefined;
   }

   setMessages((current) => [
    ...current,
    {
     id: Date.now() + 1,

     role: "assistant",

     text: answer,

     source,
    },
   ]);
  } catch (error) {
   console.error("CHAT ERROR:", error);

   setMessages((current) => [
    ...current,
    {
     id: Date.now() + 1,

     role: "assistant",

     text:
      error instanceof Error
       ? `Chat error: ${error.message}`
       : "Could not get an answer from the backend.",
    },
   ]);
  } finally {
   setIsSending(false);
  }
 };
 const usePrompt = (prompt: string) => {
  setQuestion(prompt);
 };

 return (
  <div className="app-shell">
   <aside className="rail">
    <div className="brand-mark" aria-label="PaperMind">
     <span>P</span>
    </div>

    <nav className="rail-nav" aria-label="Main navigation">
     <button className="rail-button active" title="Workspace" type="button">
      <BookOpenText size={20} />
     </button>

     <button className="rail-button" title="Documents" type="button">
      <Files size={20} />
     </button>

     <button className="rail-button" title="Search" type="button">
      <Search size={20} />
     </button>

     <button className="rail-button" title="Highlights" type="button">
      <Highlighter size={20} />
     </button>
    </nav>

    <div className="rail-footer">
     <div className="avatar">A</div>
    </div>
   </aside>

   <main className="workspace">
    <header className="topbar">
     <div>
      <p className="eyebrow">AI DOCUMENT WORKSPACE</p>

      <h1>PaperMind</h1>
     </div>

     <div className="status-pill">
      <span className="status-dot" />
      {status}
     </div>
    </header>

    <section className="hero-grid">
     <div className="hero-copy">
      <span className="mini-tag">
       <Sparkles size={15} />
       built for focused reading
      </span>

      <h2>
       Turn long documents into <em>clear answers.</em>
      </h2>

      <p>
       Upload your material, ask a question, and trace every useful answer back
       to the document.
      </p>
     </div>

     <div className="upload-card">
      <div className="paper-corner" />

      <div className="upload-icon">
       <UploadCloud size={28} />
      </div>

      <div>
       <h3>Drop in documents</h3>

       <p>PDF, DOCX or TXT · multiple files supported</p>
      </div>

      <input
       ref={fileInputRef}
       type="file"
       accept=".pdf,.docx,.txt"
       multiple
       onChange={chooseFile}
       hidden
      />

      <button
       className="browse-button"
       type="button"
       onClick={() => fileInputRef.current?.click()}
      >
       <FolderOpen size={17} />
       Choose files
      </button>

      {files.length > 0 && (
       <div>
        {files.map((file, index) => (
         <div
          className="selected-file"
          key={`${file.name}-${file.size}-${index}`}
         >
          <FileText size={18} />

          <div>
           <strong>{file.name}</strong>

           <span>{formatFileSize(file.size)}</span>
          </div>

          <button
           type="button"
           onClick={() => removeSelectedFile(index)}
           aria-label={`Remove ${file.name}`}
          >
           <X size={16} />
          </button>
         </div>
        ))}
       </div>
      )}

      <button
       className="process-button"
       type="button"
       disabled={isUploading || files.length === 0}
       onClick={uploadDocument}
      >
       {isUploading
        ? "Processing…"
        : files.length > 0
          ? `Process ${files.length} document${files.length > 1 ? "s" : ""}`
          : "Process documents"}

       <ArrowUp size={17} />
      </button>
     </div>
    </section>

    <section className="content-grid">
     <div className="document-panel">
      <div className="section-heading">
       <div>
        <p className="eyebrow">CURRENT DOCUMENTS</p>

        <h3>
         {documents.length > 0
          ? `${documents.length} document${
             documents.length > 1 ? "s" : ""
            } ready`
          : "No document selected"}
        </h3>
       </div>

       <FileText size={21} />
      </div>

      {documents.length > 0 ? (
       <div className="document-preview">
        <div className="preview-sheet">
         <div className="preview-lines">
          <span />
          <span />
          <span />
          <span />
          <span />
         </div>

         <div className="preview-highlight">AI-ready documents</div>

         <div className="preview-lines short">
          <span />
          <span />
          <span />
         </div>
        </div>

        <div className="doc-details">
         <strong>Ready to explore</strong>

         <span>{documentMeta}</span>

         <div>
          {documents.map((document) => (
           <p key={document.name}>{document.name}</p>
          ))}
         </div>

         <p>
          Your RAG pipeline will retrieve the most relevant sections from the
          uploaded documents.
         </p>
        </div>
       </div>
      ) : (
       <div className="empty-document">
        <Paperclip size={24} />

        <p>Your processed documents will appear here.</p>
       </div>
      )}

      <div className="prompt-block">
       <span>Try asking</span>

       <div className="prompt-list">
        {quickPrompts.map((prompt) => (
         <button key={prompt} type="button" onClick={() => usePrompt(prompt)}>
          {prompt}
         </button>
        ))}
       </div>
      </div>
     </div>

     <div className="chat-panel">
      <div className="chat-heading">
       <div className="chat-icon">
        <MessageSquareText size={19} />
       </div>

       <div>
        <strong>Ask the documents</strong>

        <span>Grounded answers with sources</span>
       </div>
      </div>

      <div className="messages">
       {messages.map((message) => (
        <div key={message.id} className={`message ${message.role}`}>
         <div className="message-label">
          {message.role === "assistant" ? "PaperMind" : "You"}
         </div>

         <div className="message-bubble markdown-content">
            <ReactMarkdown>
              {message.text}
            </ReactMarkdown>
          </div>

         {message.source && (
          <div className="source-chip">
           <FileText size={12} />

           {message.source}
          </div>
         )}
        </div>
       ))}

       {isSending && (
        <div className="message assistant">
         <div className="message-label">PaperMind</div>

         <div className="message-bubble typing">
          <span />
          <span />
          <span />
         </div>
        </div>
       )}
      </div>

      <form className="composer" onSubmit={sendMessage}>
       <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
         if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
         }
        }}
        placeholder="Ask something about your documents…"
        rows={2}
       />

       <button
        type="submit"
        disabled={!question.trim() || isSending}
        aria-label="Send message"
       >
        <ArrowUp size={18} />
       </button>
      </form>
     </div>
    </section>
   </main>
  </div>
 );
}
