"use client";

import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ProfileViewer from "./components/ProfileViewer";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

function App() {
  const [profileData, setProfileData] = useState(null);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data.action === "RENDER_PROFILE") {
        setProfileData(event.data.payload);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleClose = () => {
    window.parent.postMessage({ action: "CLOSE_POPUP" }, "*");
  };

  if (!profileData) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ProfileViewer
        addressOrName={profileData.value}
        type={profileData.type}
        onClose={handleClose}
      />
    </QueryClientProvider>
  );
}

document.addEventListener("click", (e) => {
  e.stopPropagation();
});

const root = createRoot(document.getElementById("root"));
root.render(<App />);
