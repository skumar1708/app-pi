import { useEffect, useState, useRef } from "react";
import CodeSandboxClone from "../components/CodeEditor"

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessages, setStatusMessages] = useState([]);
  const [deployedUrl, setDeployedUrl] = useState(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const textareaRef = useRef(null);
  const [appName, setAppName] = useState("");

  const API_BASE_URL = "https://app-generator-backend.vercel.app";

  const handleGenerate = async () => {
    setStatusMessages([]);
    setLoading(true);
    setIsDeployed(false);
    setDeployedUrl(null);
    setShowStatusPopup(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generateProject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input }),
      });

      if (!response.ok) alert("Prompt is required!!");

      const data = await response.json();
      setAppName(data?.appName);

      checkStatus(data?.appName);
    } catch (error) {
      console.error("Error:", error);
      setStatusMessages([{ text: `❌ Error: ${error.message}`, loading: false }]);
      setLoading(false);
    }
  };

  const checkStatus = async (appName) => {
    try {
      let isComplete = false;
      while (!isComplete) {
        const response = await fetch(`${API_BASE_URL}/status`, {
          method: "POST",  headers: {
            "Content-Type": "application/json",
        },
         body: JSON.stringify({appName})
        });

        if (!response.ok) alert("Please copy your prompt,  refresh page and try again");

        const data = response.json ? await response.json() : null;
        const currentStatus = { status: data?.status, url: data?.url};

        if (currentStatus && currentStatus?.status) {
          setStatusMessages((prev) => [
            ...prev.filter((msg) => msg.text !== currentStatus.status).map(item => {
              return {
                ...item,
                loading: false
              }
             }),
            { text: currentStatus.status, loading: true },
          ]);

          if (currentStatus.status === "Completed") {
            setDeployedUrl(currentStatus.url);
            setIsDeployed(true);
            setLoading(false);
            isComplete = true;

            setStatusMessages((prev) => [
              ...prev.map(item => {
                return {
                  ...item,
                  loading: false
                }
               })
            ]);

            if (!currentStatus.url) {
              setStatusMessages((prev) => [
                ...prev.map(item => {
                  return {
                    ...item,
                    loading: false
                  }
                 }),
                 { text: "System encountered some error, please close this popup and retry again", loading: false, isError: true }
              ]);
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 5000)); // Poll every 5s
      }
    } catch (error) {
      console.error("Error checking status:", error);
    }
  };

  const handlePreview = () => {
    if (deployedUrl) {
      window.open(`https://${deployedUrl}`, "_blank");
    }
  };

  const closeStatusPopup = () => {
    setShowStatusPopup(false);
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.style.maxHeight = "300px";
    }
  };

  
  const handleStatusButtonClick = () => {
    setShowStatusPopup(true);
  };

 // if (true) {
  //   return <CodeSandboxClone owner="skumar1708" repo="app-1740982882661"/>
  // }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">Generate Your Web App</h1>
      <textarea
        ref={textareaRef}
        className="p-2 border rounded w-1/2 resize-none overflow-y-auto"
        value={input}
        onChange={handleTextareaChange}
        placeholder="Describe your app idea..."
        style={{ minHeight: "100px" }}
      />
      <div className="flex mt-4">
        <button disabled={loading} className="cursor-pointer bg-blue-500 text-white px-4 py-2 rounded" onClick={handleGenerate}>
          {loading ? "Generating..." : isDeployed ? "Regenerate" : "Generate"}
        </button>
        {!showStatusPopup && !isDeployed && statusMessages.length > 0 && (
          <button
            className="bg-gray-500 text-white px-4 py-2 rounded ml-2"
            onClick={handleStatusButtonClick}
          >
            Status
          </button>
        )}
        {isDeployed && deployedUrl && (
          <button className="cursor-pointer bg-green-500 text-white px-4 py-2 rounded ml-2" onClick={handlePreview}>
            Preview
          </button>
        )}
      </div>

      {showStatusPopup && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
          <div className="relative p-8 bg-white w-1/2 rounded-xl shadow-lg">
            <button className="cursor-pointer absolute top-2 right-2 text-gray-600 hover:text-gray-800" onClick={closeStatusPopup}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold mb-4">Generation Status</h2>
            <div className="relative w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div
                className="bg-green-500 h-2.5 rounded-full"
                style={{ width: `${(statusMessages.length / (isDeployed ? statusMessages.length : 10)) * 100}%` }}
              ></div>
            </div>
            <ul className="space-y-1 rounded-xl overflow-hidden divide-y divide-gray-300">
              {statusMessages.map((item, index) => (
                <li key={index} className="flex items-center gap-3 transition duration-300">
                  {item.loading ?  <span className="animate-spin text-blue-600">↻ </span> : (item.isError ? <span>❌</span> : <span>✅</span>)}
                  <span className="font-medium">{item.text}</span>
                </li>
              ))}
            </ul>
            {isDeployed && (
              <div className="flex justify-center mt-4">
                <button className="cursor-pointer bg-green-500 text-white px-4 py-2 rounded" onClick={handlePreview}>
                  Preview
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
