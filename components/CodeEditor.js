import { useState, useEffect, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { basicSetup } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { indentWithTab } from "@codemirror/commands";
import { useRouter } from 'next/router';

export default function CodeEditor({ owner, repo }) {
  const router = useRouter();
  const [fileTree, setFileTree] = useState({ _children: [] });
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [openFiles, setOpenFiles] = useState([]);
  const [unsavedChanges, setUnsavedChanges] = useState({});

  const editorRef = useRef(null);
  const editorViewRef = useRef(null);

  const token = "";
  // Load dark mode preference
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDarkMode(localStorage.getItem("theme") === "dark");
    }
  }, []);

  // Toggle dark mode
  function toggleTheme() {
    const newMode = !darkMode;
    setDarkMode(newMode);
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newMode ? "dark" : "light");
    }
  }

  // Fetch files and update tree
  async function fetchFiles(path = "", parentNode = null) {
    try {
      if (parentNode) {
        parentNode.isOpen = !parentNode.isOpen;

        // If already expanded, just toggle visibility
        if (parentNode._children.length > 0) {
          setFileTree({ ...fileTree });
          return;
        }
      }

      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();

      const sortedFiles = data.sort((a, b) => (a.type === "dir" ? -1 : 1));
      const newChildren = sortedFiles.map((file) => ({
        ...file,
        isOpen: false,
        _children: file.type === "dir" ? [] : null,
      }));

      if (parentNode) {
        parentNode._children = newChildren;
        setFileTree({ ...fileTree });
      } else {
        setFileTree({ _children: newChildren });
      }
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  }

  useEffect(() => {
    fetchFiles();
  }, [owner, repo]);

  // Fetch file content
  async function loadFile(path) {
    try {
      setLoading(true);
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!res.ok) throw new Error("Failed to load file");
      const data = await res.json();

      if (data.type === "file") {
        const decodedContent = atob(data.content.replace(/\n/g, ""));
        setFileContent(decodedContent);
        setSelectedFile(path);

        if (!openFiles.includes(path)) {
          setOpenFiles([...openFiles, path]);
        }
      }
    } catch (error) {
      console.error("Error loading file:", error);
    } finally {
      setLoading(false);
    }
  }

  // Initialize CodeMirror editor
  useEffect(() => {
    if (!editorRef.current) return;

    if (editorViewRef.current) {
      editorViewRef.current.dispatch({
        changes: {
          from: 0,
          to: editorViewRef.current.state.doc.length,
          insert: fileContent,
        },
      });
    } else {
      editorViewRef.current = new EditorView({
        doc: fileContent,
        extensions: [
          basicSetup,
          javascript(),
          syntaxHighlighting(defaultHighlightStyle),
          lineNumbers(),
          darkMode ? oneDark : [],
          keymap.of([indentWithTab]),
        //   EditorView.updateListener.of((update) => {
        //     if (update.docChanged) {
        //       const newContent = update.state.doc.toString();
        //       setFileContent(newContent);
        //       if (selectedFile) {
        //         setUnsavedChanges({
        //           ...unsavedChanges,
        //           [selectedFile]: true,
        //         });
        //       }
        //     }
        //   }),
        ],
        parent: editorRef.current,
      });
    }

    // return () => editorViewRef.current?.destroy();
  }, [fileContent, darkMode]);

  // Save file function
  async function saveFile() {
    if (!selectedFile) return;

    try {
      // Step 1: Fetch the file metadata to get the SHA
      const metaRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${selectedFile}`,
        {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!metaRes.ok) throw new Error("Failed to fetch file metadata");
      const metaData = await metaRes.json();
      const sha = metaData.sha; // ✅ Extract SHA hash

      // Step 2: Encode the new content
      const content = btoa(editorViewRef.current.state.doc.toString());

      // Step 3: Send PUT request to update file
      const saveRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${selectedFile}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          body: JSON.stringify({
            message: `Updated ${selectedFile}`,
            content: content,
            sha: sha, // ✅ Required for updating the file
          }),
        }
      );

      if (!saveRes.ok) throw new Error("Failed to save file");

      alert("✅ File saved successfully!");
      setUnsavedChanges({ ...unsavedChanges, [selectedFile]: false });
    } catch (error) {
      console.error("Error saving file:", error);
      alert("❌ Failed to save file.");
    }
  }

  // Render collapsible file tree
  function renderTree(node, path = "") {
    return (
      <ul>
        {node._children?.map((file) => {
            const filePath = path ? `${path}/${file.name}` : file.name;
          return (
            <li key={filePath} className="ml-4">
              {file.type === "dir" ? (
                <span
                  className="cursor-pointer text-blue-500 hover:underline"
                  onClick={() => fetchFiles(filePath, file)}
                >
                  {file.isOpen ? "📂" : "📁"} {file.name}
                </span>
              ) : (
                <span
                  className="cursor-pointer text-blue-500 hover:underline"
                  onClick={() => loadFile(filePath)}
                >
                  📄 {file.name}
                </span>
              )}
              {file.isOpen && file._children ? renderTree(file, filePath) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  function handleTabClick(file) {
    loadFile(file);
  }

  function handleTabClose(file) {
    setOpenFiles(openFiles.filter((f) => f !== file));
    if (selectedFile === file) {
      if (openFiles.length > 1) {
        const newSelectedFile = openFiles[0] === file ? openFiles[1] : openFiles[0];
        loadFile(newSelectedFile);
      } else {
        setSelectedFile(null);
        setFileContent("");
      }
    }
  }

  const [isPreviewing, setPreviewing] = useState(false);

  const handleBuildAndPreview = async () => {
    setPreviewing(true);
    try {
      const fetchedCall = await fetch('/api/preview', 
        {
          method: "POST",
          body: JSON.stringify({ owner, repo, filePath:"frontend" }),
        });
      const response = await fetchedCall.json();  
      router.push(`${response.previewUrl}`); // Navigate to the preview page
    } catch (error) {
      console.error('Error building preview:', error);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className={`flex flex-col h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-white text-black"}`}>
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-xl font-bold">GitHub File Explorer</h1>
        <button
          onClick={toggleTheme}
          className="flex items-center bg-gray-800 text-white px-4 py-1 rounded-md hover:bg-gray-700 transition"
        >
          {darkMode ? "🌙 Dark" : "☀️ Light"}
        </button>
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - File Explorer */}
        <div className="w-1/4 pl-2 border-r overflow-auto scrollbar-thin scrollbar-thin-track-gray-lighter scrollbar-thin-thumb-gray">
            <h2 className="text-lg font-bold sticky top-0  mt-0 bg-white z-10">Files</h2>
            <div className="overflow-auto scrollbar-thin scrollbar-thin-track-gray-lighter scrollbar-thin-thumb-gray">
                {renderTree(fileTree)}
            </div>
        </div>

        {/* Code Editor */}
        <div className="w-3/4 p-2 flex flex-col">
          {/* Tabs */}
          <div className="flex overflow-x-auto mb-2">
            {openFiles.map((file) => (
              <div
                key={file}
                className={`flex items-center px-4 py-2 rounded-t-md cursor-pointer ${
                  selectedFile === file ? "bg-gray-200 dark:bg-gray-700" : "bg-gray-100 dark:bg-gray-800"
                } mr-2`}
                onClick={() => handleTabClick(file)}
              >
                {file.split('/').pop()}
                {unsavedChanges[file] && <span className="text-red-500">*</span>}
                <button
                  className="ml-2 text-gray-500 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTabClose(file);
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">{selectedFile ? selectedFile.split('/').pop() : "Select a file"}</h2>
            {selectedFile && (
              <>
                <button onClick={saveFile} className="bg-green-500 text-white px-4 py-1 rounded-md">
                  💾 Save
                </button>
                <button disabled={isPreviewing} onClick={handleBuildAndPreview} className="bg-green-500 text-white px-4 py-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                  {isPreviewing ? "Building..." : "Preview"}
                </button>
              </>
            )}
          </div>

          <div ref={editorRef} className="flex-1 border rounded-md bg-gray-100 dark:bg-gray-800 overflow-auto relative">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200 bg-opacity-50">
                <div className="w-8 h-8 border-4 border-blue-500 border-dashed rounded-full animate-spin"></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}